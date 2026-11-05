import { describe, expect, it, vi } from "vitest";
import {
  buildOpenRouterConversationRequestBody,
  buildOpenRouterRequestBody,
  serializeOpenRouterRequestBody,
  sendOpenRouterRequest,
  type ConversationMessage,
} from "../../src/integrations/ai/openrouter";

const userContent = "学习诊断请求\n判断这个 WA 提交卡在哪\n\n已选资料\n[提交] record 42\nWA on test 3";
const model = "openai/gpt-4.1-mini";

describe("OpenRouter diagnostic requests", () => {
  it("builds a text-only diagnosis request with the exact visible context", () => {
    const body = buildOpenRouterRequestBody(model, userContent);

    expect(body).toMatchObject({
      model,
      stream: false,
      max_tokens: 1200,
      messages: [
        { role: "system", content: expect.stringContaining("不直接给完整题解") },
        { role: "user", content: userContent },
      ],
    });
    expect("tools" in body).toBe(false);
    expect(JSON.parse(serializeOpenRouterRequestBody(body))).toEqual(body);
  });

  it("rejects missing model IDs and contexts that exceed the request limit", () => {
    expect(() => buildOpenRouterRequestBody("  ", userContent)).toThrow(/模型/);
    expect(() => buildOpenRouterRequestBody(model, "x".repeat(50_001))).toThrow(/过长/);
    expect(() => buildOpenRouterRequestBody(model, "x".repeat(50_000))).not.toThrow();
  });

  it("sends one fixed-endpoint request with the key only in the bearer header", async () => {
    const body = buildOpenRouterRequestBody(model, userContent);
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 1,
      model,
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "较像卡在调试。" } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(sendOpenRouterRequest("sk-or-test-secret", body, fetcher as typeof fetch)).resolves.toBe("较像卡在调试。");

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("https://openrouter.ai/api/v1/chat/completions", expect.objectContaining({
      method: "POST",
      credentials: "omit",
      redirect: "error",
      headers: {
        Authorization: "Bearer sk-or-test-secret",
        "Content-Type": "application/json",
      },
      body: serializeOpenRouterRequestBody(body),
    }));
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).not.toContain("sk-or-test-secret");
  });

  it("rejects an empty key before making a network request", async () => {
    const fetcher = vi.fn(async () => new Response());

    await expect(sendOpenRouterRequest("  ", buildOpenRouterRequestBody(model, userContent), fetcher as typeof fetch))
      .rejects.toThrow(/API key/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not start a request when the draft has already been closed", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "should not be returned" } }],
    }), { status: 200 }));

    await expect(sendOpenRouterRequest("sk-or-test-secret", buildOpenRouterRequestBody(model, userContent), fetcher as typeof fetch, controller.signal))
      .rejects.toThrow(/已取消/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("aborts an in-flight request when its draft is closed", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const request = sendOpenRouterRequest("sk-or-test-secret", buildOpenRouterRequestBody(model, userContent), fetcher as typeof fetch, controller.signal);

    controller.abort();

    await expect(request).rejects.toThrow(/已取消/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("stops a request at 60 seconds without retrying", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | null | undefined;
      const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        signal = init?.signal;
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }));
      const request = sendOpenRouterRequest("sk-or-test-secret", buildOpenRouterRequestBody(model, userContent), fetcher as typeof fetch);
      const rejection = expect(request).rejects.toThrow(/60 秒/);

      await vi.advanceTimersByTimeAsync(59_999);
      expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      await rejection;
      expect(signal?.aborted).toBe(true);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports rate limiting without retrying automatically", async () => {
    const fetcher = vi.fn(async () => new Response("private provider detail", { status: 429 }));

    await expect(sendOpenRouterRequest("sk-or-test-secret", buildOpenRouterRequestBody(model, userContent), fetcher as typeof fetch))
      .rejects.toThrow(/429/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not expose the provider error body on authentication failure", async () => {
    const fetcher = vi.fn(async () => new Response("private provider detail", { status: 401 }));

    const error = await sendOpenRouterRequest("sk-or-test-secret", buildOpenRouterRequestBody(model, userContent), fetcher as typeof fetch)
      .then(() => undefined, value => value as Error);

    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toContain("401");
    expect(error?.message).not.toContain("private provider detail");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed and oversized provider responses", async () => {
    const malformed = vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    await expect(sendOpenRouterRequest("sk-or-test-secret", buildOpenRouterRequestBody(model, userContent), malformed as typeof fetch))
      .rejects.toThrow(/响应/);

    const oversized = vi.fn(async () => new Response("x".repeat(1_100_000), { status: 200 }));
    await expect(sendOpenRouterRequest("sk-or-test-secret", buildOpenRouterRequestBody(model, userContent), oversized as typeof fetch))
      .rejects.toThrow(/过大/);
  });

  it("reports an error envelope even when HTTP 200 includes partial text", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      error: { code: 429, message: "private provider detail", metadata: { provider_name: "test" } },
      choices: [{ index: 0, finish_reason: "error", message: { role: "assistant", content: "incomplete diagnosis" } }],
    }), { status: 200 }));

    const error = await sendOpenRouterRequest("sk-or-test-secret", buildOpenRouterRequestBody(model, userContent), fetcher as typeof fetch)
      .then(() => undefined, value => value as Error);

    expect(error?.message).toContain("429");
    expect(error?.message).not.toContain("private provider detail");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects a failed completion without accepting its partial diagnosis", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ index: 0, finish_reason: "error", message: { role: "assistant", content: "incomplete diagnosis" } }],
    }), { status: 200 }));

    await expect(sendOpenRouterRequest("sk-or-test-secret", buildOpenRouterRequestBody(model, userContent), fetcher as typeof fetch))
      .rejects.toThrow(/生成失败/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("hides raw transport errors that may contain request details", async () => {
    const fetcher = vi.fn(async () => { throw new TypeError("private transport detail sk-or-test-secret"); });

    const error = await sendOpenRouterRequest("sk-or-test-secret", buildOpenRouterRequestBody(model, userContent), fetcher as typeof fetch)
      .then(() => undefined, value => value as Error);

    expect(error?.message).toMatch(/网络|连接/);
    expect(error?.message).not.toContain("private transport detail");
    expect(error?.message).not.toContain("sk-or-test-secret");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("stateless multi-turn diagnosis requests", () => {
  const turns: readonly ConversationMessage[] = [
    { role: "user", content: "判断这个 WA 提交卡在哪" },
    { role: "assistant", content: "目前证据较像卡在调试。" },
    { role: "user", content: "再给我一个最小下一步" },
  ];

  it("sends system + full history + latest question with no tools", () => {
    const body = buildOpenRouterConversationRequestBody(model, turns);
    expect(body).toMatchObject({
      model,
      stream: false,
      max_tokens: 1200,
      messages: [
        { role: "system", content: expect.stringContaining("不直接给完整题解") },
        { role: "user", content: turns[0]!.content },
        { role: "assistant", content: turns[1]!.content },
        { role: "user", content: turns[2]!.content },
      ],
    });
    expect("tools" in body).toBe(false);
    expect(JSON.parse(serializeOpenRouterRequestBody(body))).toEqual(body);
  });

  it("a single user turn is a valid conversation", () => {
    const single = buildOpenRouterConversationRequestBody(model, [{ role: "user", content: userContent }]);
    expect(single.messages).toHaveLength(2);
    expect(single.messages[1]).toEqual({ role: "user", content: userContent });
    expect(single).toEqual(buildOpenRouterRequestBody(model, userContent));
  });

  it("rejects malformed or non-alternating conversations", () => {
    expect(() => buildOpenRouterConversationRequestBody(model, [])).toThrow(/对话内容为空/);
    expect(() => buildOpenRouterConversationRequestBody(model, [{ role: "assistant", content: "x" }])).toThrow(/格式|开头|交替/);
    expect(() => buildOpenRouterConversationRequestBody(model, [
      { role: "user", content: "a" }, { role: "assistant", content: "b" },
    ])).toThrow(/结尾/);
    expect(() => buildOpenRouterConversationRequestBody(model, [
      { role: "user", content: "a" }, { role: "user", content: "b" },
    ])).toThrow(/交替/);
    expect(() => buildOpenRouterConversationRequestBody(model, [{ role: "user", content: "   " }])).toThrow(/格式/);
    expect(() => buildOpenRouterConversationRequestBody(model, [{ role: "tool", content: "x" } as unknown as ConversationMessage])).toThrow(/格式/);
    expect(() => buildOpenRouterConversationRequestBody("  ", turns)).toThrow(/模型/);
  });

  it("enforces the 50,000-character limit on the whole conversation", () => {
    expect(() => buildOpenRouterConversationRequestBody(model, [
      { role: "user", content: "x".repeat(50_000) },
    ])).toThrow(/过长|50,000/);
    expect(() => buildOpenRouterConversationRequestBody(model, [
      { role: "user", content: "x".repeat(49_000) },
    ])).not.toThrow();
  });

  it("sendOpenRouterRequest transmits the serialized conversation with the key only in the header", async () => {
    const body = buildOpenRouterConversationRequestBody(model, turns);
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "最小下一步：检查 test 3。" } }],
    }), { status: 200 }));

    await expect(sendOpenRouterRequest("sk-or-test-secret", body, fetcher as typeof fetch)).resolves.toBe("最小下一步：检查 test 3。");
    expect(fetcher).toHaveBeenCalledWith("https://openrouter.ai/api/v1/chat/completions", expect.objectContaining({
      method: "POST",
      body: serializeOpenRouterRequestBody(body),
      headers: { Authorization: "Bearer sk-or-test-secret", "Content-Type": "application/json" },
    }));
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).not.toContain("sk-or-test-secret");
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain("再给我一个最小下一步");
  });
});

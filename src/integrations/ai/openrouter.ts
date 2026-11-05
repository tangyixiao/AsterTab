export const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_HOST_PERMISSION = "https://openrouter.ai/*";
export const OPENROUTER_MAX_CONTEXT_CHARACTERS = 50_000;
export const OPENROUTER_MAX_RESPONSE_BYTES = 1_000_000;
export const OPENROUTER_MAX_OUTPUT_TOKENS = 1_200;

export type ConversationMessage = { role: "user" | "assistant"; content: string };

export type OpenRouterRequestBody = {
  model: string;
  messages: [
    { role: "system"; content: string },
    ...ConversationMessage[],
  ];
  max_tokens: number;
  stream: false;
};

export const DIAGNOSTIC_SYSTEM_PROMPT = [
  "你是 AsterTab 的学习诊断助手。只根据用户明确提供的请求和资料作判断；不要联网、调用工具或补造事实。",
  "先判断最可能的卡点阶段：题意理解、建模、算法选择、复杂度、实现、调试、提交反馈。证据不足或相互矛盾时，明确指出不确定性和缺失信息。",
  "请依次给出：可能卡点阶段、对应证据、尚缺信息、一个最小下一步。将推断表述为‘目前证据较像’等可能性判断。",
  "默认用苏格拉底式提问或最小提示，不直接给完整题解；只有用户明确要求完整解法时才提供。",
].join("\n");

export function buildOpenRouterRequestBody(modelId: string, userContent: string): OpenRouterRequestBody {
  const model = modelId.trim();
  if (!model || model.length > 200 || /[\s\u0000-\u001f]/.test(model)) {
    throw new Error("请填写有效的 OpenRouter 模型 ID。可从模型目录复制，例如 provider/model。");
  }
  if (!userContent.trim()) throw new Error("诊断内容为空，未发送请求。");
  if (userContent.length > OPENROUTER_MAX_CONTEXT_CHARACTERS) {
    throw new Error(`诊断内容过长，请删减到 ${OPENROUTER_MAX_CONTEXT_CHARACTERS.toLocaleString("en-US")} 个字符以内。`);
  }

  return {
    model,
    messages: [
      { role: "system", content: DIAGNOSTIC_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    max_tokens: OPENROUTER_MAX_OUTPUT_TOKENS,
    stream: false,
  };
}

export function buildOpenRouterConversationRequestBody(
  modelId: string,
  turns: readonly ConversationMessage[],
): OpenRouterRequestBody {
  const model = modelId.trim();
  if (!model || model.length > 200 || /[\s\u0000-\u001f]/.test(model)) {
    throw new Error("请填写有效的 OpenRouter 模型 ID。可从模型目录复制，例如 provider/model。");
  }
  if (!Array.isArray(turns) || turns.length === 0) {
    throw new Error("对话内容为空，未发送请求。");
  }
  for (const turn of turns) {
    if (!turn || (turn.role !== "user" && turn.role !== "assistant") || typeof turn.content !== "string" || !turn.content.trim()) {
      throw new Error("对话消息格式无效。");
    }
  }
  for (let index = 0; index < turns.length; index += 1) {
    const expected = index % 2 === 0 ? "user" : "assistant";
    if (turns[index]!.role !== expected) {
      throw new Error("对话消息必须以用户提问开头，并在 user / assistant 之间交替。");
    }
  }
  if (turns[turns.length - 1]!.role !== "user") {
    throw new Error("对话必须以用户的最新追问结尾。");
  }
  const totalContext = DIAGNOSTIC_SYSTEM_PROMPT.length + turns.reduce((sum, turn) => sum + turn.content.length, 0);
  if (totalContext > OPENROUTER_MAX_CONTEXT_CHARACTERS) {
    throw new Error(`对话内容过长，请删减到 ${OPENROUTER_MAX_CONTEXT_CHARACTERS.toLocaleString("en-US")} 个字符以内。`);
  }
  return {
    model,
    messages: [
      { role: "system", content: DIAGNOSTIC_SYSTEM_PROMPT },
      ...turns.map(turn => ({ role: turn.role, content: turn.content })),
    ],
    max_tokens: OPENROUTER_MAX_OUTPUT_TOKENS,
    stream: false,
  };
}

export function serializeOpenRouterRequestBody(body: OpenRouterRequestBody): string {
  return JSON.stringify(body, null, 2);
}

function statusMessage(status: number): string {
  if (status === 401) return "OpenRouter API key 无效或已撤销（401）。";
  if (status === 402) return "OpenRouter 账户余额不足（402）。";
  if (status === 403) return "OpenRouter 拒绝了本次请求（403），请检查 key 权限或账户设置。";
  if (status === 404) return "OpenRouter 未找到此模型（404），请检查模型 ID。";
  if (status === 429) return "OpenRouter 请求频率受限（429）。请稍后再决定是否手动重试。";
  if (status >= 500) return `OpenRouter 暂时不可用（${status}）。请检查请求状态后再决定是否手动重试。`;
  return `OpenRouter 请求失败（${status}）。`;
}

async function readBoundedResponseText(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > OPENROUTER_MAX_RESPONSE_BYTES) {
    throw new Error("OpenRouter 响应过大，已停止读取。");
  }

  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > OPENROUTER_MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new Error("OpenRouter 响应过大，已停止读取。");
    }
    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

function extractAssistantText(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const providerError = (value as { error?: unknown }).error;
  if (providerError !== undefined && providerError !== null) {
    const code = typeof providerError === "object" ? (providerError as { code?: unknown }).code : undefined;
    throw new Error(typeof code === "number" && Number.isInteger(code) && code >= 400 && code <= 599
      ? statusMessage(code)
      : "OpenRouter 诊断生成失败，未自动重试。");
  }
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0];
  if (!first || typeof first !== "object") return "";
  if ((first as { finish_reason?: unknown }).finish_reason === "error") {
    throw new Error("OpenRouter 诊断生成失败，未自动重试。");
  }
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.flatMap(part => {
      if (!part || typeof part !== "object") return [];
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? [text] : [];
    }).join("").trim();
  }
  return "";
}

export async function sendOpenRouterRequest(
  apiKey: string,
  body: OpenRouterRequestBody,
  fetcher: typeof fetch = fetch,
  externalSignal?: AbortSignal,
): Promise<string> {
  const token = apiKey.trim();
  if (!token) throw new Error("请先保存 OpenRouter API key。");
  if (externalSignal?.aborted) throw new Error("诊断请求已取消。");

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetcher(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: serializeOpenRouterRequestBody(body),
      credentials: "omit",
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    }).catch(() => {
      throw new Error("无法连接 OpenRouter，请检查网络或主机权限；未自动重试。");
    });
    if (!response.ok) throw new Error(statusMessage(response.status));

    let payload: unknown;
    try {
      payload = JSON.parse(await readBoundedResponseText(response));
    } catch (error) {
      if (error instanceof Error && error.message.includes("响应过大")) throw error;
      throw new Error("OpenRouter 返回了无法识别的响应。");
    }

    const answer = extractAssistantText(payload);
    if (!answer) throw new Error("OpenRouter 响应中没有诊断文本。");
    return answer;
  } catch (error) {
    if (externalSignal?.aborted) throw new Error("诊断请求已取消。");
    if (controller.signal.aborted) throw new Error("OpenRouter 请求超过 60 秒，未自动重试。");
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}

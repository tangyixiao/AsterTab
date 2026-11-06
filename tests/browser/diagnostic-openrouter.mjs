// Run against a production extension with an existing Playwright installation.
// Default mode: all external page requests are intercepted; only a fake API key is used.
// --live: openrouter.ai requests reach the real network. First send triggers the
// NATIVE host-permission prompt, which a human must approve (use --headed), unless
// the permission is already granted (then permissions.request resolves immediately).
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Usage: node tests/browser/diagnostic-openrouter.mjs [--live] [--live-success] [--headed] [--playwright-core PATH_TO_INDEX_MJS] [--browser PATH_TO_BROWSER_EXE] [--build PATH_TO_PRODUCTION_BUILD] [--output ARTIFACT_DIRECTORY]\nDefault mode intercepts every external request and uses a fake API key. --live lets openrouter.ai requests reach the real network; the first send raises the native host-permission prompt which must be approved by a human, so combine with --headed and a disposable real API key (expected result on an invalid key: a 401 alert). --live-success is a separate success path: it requires a real key in ASTERTAB_LIVE_KEY (and optionally ASTERTAB_LIVE_MODEL, default google/gemma-4-31b-it:free) and asserts a real HTTP 200 with non-empty diagnosis text; it never invents a key and stops honestly on 402/429. --headed keeps the browser visible and leaves it open after checks.");
  process.exit(0);
}
const liveMode = args.includes("--live");
const liveSuccessMode = args.includes("--live-success");
const headed = args.includes("--headed");
function argument(name, fallback) {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
}
const playwrightPath = argument("--playwright-core");
const { chromium } = await import(playwrightPath ? pathToFileURL(resolve(playwrightPath)).href : "playwright-core");
const executablePath = argument("--browser", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe");
const extensionPath = resolve(argument("--build", ".output/edge-mv3"));
const output = argument("--output");
const endpoint = "https://openrouter.ai/api/v1/chat/completions";
const fakeKey = "sk-or-browser-test-only";
const model = "test/diagnostic-model";
const requests = [];
const unexpectedRequests = [];
const errors = [];
const checks = [];
let responseMode = "success";
let releaseResponse;

const context = await chromium.launchPersistentContext("", {
  executablePath, headless: !headed, ignoreDefaultArgs: ["--disable-extensions"],
  args: ["--enable-unsafe-extension-debugging"],
});
if (headed) console.log("headed run: browser stays open after checks; close it manually or press Ctrl+C once checks are reported.");
context.setDefaultTimeout(10_000);
const browser = context.browser();
try {
  const cdp = await browser.newBrowserCDPSession();
  const { id } = await cdp.send("Extensions.loadUnpacked", { path: extensionPath });
  await context.route("**/*", async route => {
    const request = route.request();
    if (request.url().startsWith("chrome-extension://")) return route.continue();
    if ((liveMode || liveSuccessMode) && request.url() === endpoint) {
      requests.push({ body: request.postData(), headers: request.headers() });
      return route.continue();
    }
    if (request.url() !== endpoint) {
      unexpectedRequests.push(request.url());
      return route.abort();
    }
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization,content-type",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    requests.push({ body: request.postData(), headers: request.headers() });
    if (responseMode === "pending") await new Promise(resolveResponse => { releaseResponse = resolveResponse; });
    if (responseMode === "unauthorized") {
      return route.fulfill({ status: 401, headers: cors, body: "private provider detail" });
    }
    await route.fulfill({ status: 200, headers: cors, contentType: "application/json", body: JSON.stringify({
      id: "chatcmpl-browser-test", object: "chat.completion", created: 1, model,
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: "较像卡在调试。<script>window.diagnosticExecuted=true</script>" } }],
    }) });
  });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  if (!liveMode) {
    await page.addInitScript(() => {
      // Chrome storage stays real. No optional host is granted by this harness.
      window.permissionCalls = [];
      window.permissionMode = "allow";
      chrome.permissions.request = async permissions => {
        window.permissionCalls.push(permissions);
        if (window.permissionMode === "pending") return new Promise(resolve => { window.resolvePermission = resolve; });
        return window.permissionMode === "allow";
      };
    });
  }
  await page.goto(`chrome-extension://${id}/newtab.html`);
  await page.waitForSelector("#command-input");
  assert.equal(requests.length, 0);
  checks.push("production new tab opens without an AI request");

  const button = name => page.getByRole("button", { name, exact: true });
  const consent = () => page.getByRole("checkbox", { name: /我已审阅/ });
  const send = () => button("确认并发送诊断");
  async function openDraft(request = "判断 WA 卡在哪") {
    await page.locator("#command-input").fill(`ai ${request}`);
    await button("搜索").click();
    await page.locator("#openrouter-model").waitFor({ state: "visible" });
    await page.waitForFunction(() => !document.querySelector("#openrouter-model").disabled);
  }
  async function confirm() {
    await consent().check();
    await page.waitForFunction(() => [...document.querySelectorAll("button")].find(item => item.textContent === "确认并发送诊断")?.disabled === false);
  }

  if (liveSuccessMode) {
    // Dedicated success path: a REAL key must reach the real endpoint and come
    // back with HTTP 200 and non-empty assistant text. It is a separate mode so
    // the default keyless regression keeps asserting the 401 path.
    if (!headed) throw new Error("--live-success needs --headed: the native host-permission prompt must be approved by a human.");
    const liveKey = (process.env.ASTERTAB_LIVE_KEY ?? "").trim();
    const liveModel = (process.env.ASTERTAB_LIVE_MODEL ?? "google/gemma-4-31b-it:free").trim();
    if (!liveKey) throw new Error("--live-success needs a real key in ASTERTAB_LIVE_KEY. The harness never invents one.");
    await openDraft("判断 WA 卡在哪");
    await page.locator("#openrouter-model").fill(liveModel);
    await button("保存模型").click();
    await page.getByRole("status").filter({ hasText: "模型 ID 已保存" }).waitFor();
    await page.locator("#openrouter-api-key").fill(liveKey);
    await button("保存到当前会话").click();
    await page.getByRole("status").filter({ hasText: "API key 仅保存" }).waitFor();
    await page.locator("#submission-text-1").fill("WA on test 3");
    await confirm();
    await send().click();
    const granted = await page.evaluate(() => chrome.permissions.contains({ origins: ["https://openrouter.ai/*"] }));
    if (!granted) console.log("ACTION NEEDED: approve the native OpenRouter host permission prompt in the browser window (Ctrl+C aborts).");
    // Either the grant is immediate (already approved) or a human approves it now.
    // Then wait for an actual diagnosis body instead of an error alert.
    const sawResult = await (async () => {
      const deadline = Date.now() + 300_000;
      while (Date.now() < deadline) {
        if (await page.locator(".diagnosis-result").count() > 0) return true;
        const alerts = await page.locator('[role="alert"]').allTextContents();
        const blocking = alerts.filter(text => !text.includes("未获得 OpenRouter"));
        if (blocking.length > 0) throw new Error(`live success failed with alert: ${blocking.join(" | ")}`);
        await new Promise(resolveWait => setTimeout(resolveWait, 250));
      }
      return false;
    })();
    if (!sawResult) throw new Error("timed out waiting for a successful diagnosis result");
    const resultText = (await page.locator(".diagnosis-result").textContent()).trim();
    assert.ok(resultText.length > 0, "the successful diagnosis text must not be empty");
    assert.equal(requests.length, 1);
    const body = JSON.parse(requests[0].body);
    assert.equal(body.model, liveModel);
    assert.deepEqual(body.messages.map(turn => turn.role), ["system", "user"]);
    assert.equal(requests[0].headers.authorization, `Bearer ${liveKey}`);
    assert.ok(!requests[0].body.includes(liveKey), "the key must never appear in the request body");
    assert.ok(!(await page.locator("body").textContent()).includes(liveKey));
    assert.equal(await consent().isChecked(), false);
    checks.push("a real key got HTTP 200 with non-empty diagnosis text over the real OpenRouter endpoint");
    const liveResult = {
      browser: await browser.version(), build: extensionPath, mode: "live-success", checks,
      model: liveModel, apiRequests: "1 real request to https://openrouter.ai/api/v1/chat/completions",
      responseStatus: 200, diagnosisCharacters: resultText.length,
      unexpectedExternalRequests: unexpectedRequests, pageErrors: errors,
      permissionBoundary: "native prompt approved by a human",
    };
    if (output) {
      await mkdir(resolve(output), { recursive: true });
      await writeFile(resolve(output, "diagnostic-live-success.json"), JSON.stringify(liveResult, null, 2));
      await page.screenshot({ path: resolve(output, "diagnostic-live-success.png"), fullPage: true });
    }
    console.log(JSON.stringify(liveResult, null, 2));
    if (headed) await new Promise(() => {});
    await context.close();
    process.exit(0);
  }
  await openDraft();
  assert.equal(await send().isEnabled(), false);
  await page.locator("#openrouter-model").fill(model);
  await button("保存模型").click();
  await page.getByRole("status").filter({ hasText: "模型 ID 已保存" }).waitFor();
  await page.locator("#openrouter-api-key").fill(fakeKey);
  await button("保存到当前会话").click();
  await page.getByRole("status").filter({ hasText: "API key 仅保存" }).waitFor();
  assert.equal(await page.locator("#openrouter-api-key").inputValue(), "");
  const stored = await page.evaluate(async () => ({ local: await chrome.storage.local.get(null), session: await chrome.storage.session.get(null) }));
  assert.deepEqual(stored.local, { openrouterModelId: model });
  assert.deepEqual(stored.session, { openrouterApiKey: fakeKey });
  assert.equal(requests.length, 0);
  if (!liveMode) assert.equal(await page.evaluate(() => window.permissionCalls.length), 0);
  checks.push("saving uses real local/session storage and makes no request or permission call");

  // A fine-grained GitHub PAT may only live in session storage. It must never
  // reach the context preview, the outbound AI request body or local storage.
  const fakePat = "github_pat_browser_test_only";
  await page.locator("#github-pat").fill(fakePat);
  await button("保存 PAT 到当前会话").click();
  await page.getByRole("status").filter({ hasText: "PAT 仅保存在" }).waitFor();
  assert.equal(await page.locator("#github-pat").inputValue(), "");
  assert.deepEqual(await page.evaluate(() => chrome.storage.session.get(null)), { openrouterApiKey: fakeKey, githubPrivatePat: fakePat });
  assert.deepEqual(await page.evaluate(() => chrome.storage.local.get(null)), { openrouterModelId: model });
  assert.ok(!(await page.locator("#diagnostic-preview").textContent()).includes(fakePat));
  assert.ok(!(await page.locator("#openrouter-request-preview").textContent()).includes(fakePat));
  checks.push("a GitHub PAT is kept in session storage only and never reaches the preview or request body");

  await button("清除当前会话 PAT").click();
  await page.getByRole("status").filter({ hasText: "GitHub PAT 已清除" }).waitFor();
  assert.deepEqual(await page.evaluate(() => chrome.storage.session.get(null)), { openrouterApiKey: fakeKey });

  await page.locator("#submission-text-1").fill("WA on test 3; <script>alert(1)</script>");
  await button("添加提交记录").click();
  await page.locator("#submission-text-2").fill("second submission evidence");
  await button("添加 GitHub 文件").click();
  await page.locator("#code-text-2").fill("int main() { return 0; }");
  await page.locator(".draft-submission-source").nth(1).getByRole("checkbox").uncheck();
  const preview = await page.locator("#openrouter-request-preview").textContent();
  assert.ok(preview.includes("WA on test 3"));
  assert.ok(preview.includes("int main()"));
  assert.ok(!preview.includes("second submission evidence"));
  assert.ok(!preview.includes(fakeKey));
  checks.push("repeatable sources, exclusion and inert pasted text reach the exact preview without a key");

  await confirm();
  await page.locator("#diagnostic-request").fill("修改后的诊断请求");
  assert.equal(await consent().isChecked(), false);
  assert.equal(await send().isEnabled(), false);
  assert.equal(requests.length, 0);
  checks.push("editing after confirmation disables sending");

  if (!liveMode) {
    await page.evaluate(() => { window.permissionMode = "deny"; });
    await confirm();
    await send().click();
    await page.getByRole("alert").filter({ hasText: "未获得 OpenRouter" }).waitFor();
    assert.equal(requests.length, 0);
    assert.equal(await consent().isChecked(), false);
    checks.push("permission denial sends nothing and consumes confirmation");

    await page.evaluate(() => { window.permissionMode = "pending"; });
    await confirm();
    await send().click();
    await page.waitForFunction(() => typeof window.resolvePermission === "function");
    await page.locator("#diagnostic-request").fill("permission pending edit");
    // The fill's re-render flushes on a macrotask while resolvePermission's
    // callback is a microtask; without this wait Chrome can resume the send
    // with the stale payload before the render commits the new preview.
    await page.waitForFunction(() => document.querySelector("#openrouter-request-preview")?.textContent.includes("permission pending edit"));
    await page.evaluate(() => window.resolvePermission(true));
    await page.getByRole("alert").filter({ hasText: /当前预览已变更|发送确认已撤销/ }).waitFor();
    assert.equal(requests.length, 0);
    checks.push("an edit while permission is pending prevents the old request");
  } else {
    // Live: permissions.request inside the click handler opens the NATIVE prompt
    // (first grant in this profile) and the send flow resumes automatically once
    // a human approves. Grant is persisted per profile, so later runs skip it.
    // Fail fast BEFORE clicking send so a doomed headless run never issues a
    // real permissions.request.
    if (!headed) throw new Error("--live needs --headed: the native host-permission prompt must be approved by a human.");
    await confirm();
    await send().click();
    console.log("ACTION NEEDED: approve the native OpenRouter host permission prompt in the browser window (Ctrl+C aborts).");
    await page.waitForFunction(
      () => chrome.permissions.contains({ origins: ["https://openrouter.ai/*"] }),
      undefined, { polling: 500, timeout: 300_000 },
    );
    checks.push("a native host permission prompt was approved by a human and persisted for this profile");
    // The SAME confirmed request resumed after the grant and hit the real
    // endpoint. With a disposable invalid key OpenRouter answers 401, which
    // the UI must show as an alert while preserving sources and hiding the
    // raw provider detail.
    await page.getByRole("alert").filter({ hasText: "401" }).waitFor({ timeout: 300_000 });
    assert.equal(requests.length, 1);
    assert.ok(requests[0].body.includes("WA on test 3"));
    assert.equal(requests[0].headers.authorization, `Bearer ${fakeKey}`);
    assert.ok(!(await page.locator("body").textContent()).includes("private provider detail"));
    assert.ok((await page.locator("#diagnostic-preview").textContent()).includes("WA on test 3"));
    assert.equal(await page.locator(".diagnosis-result").count(), 0);
    assert.equal(await consent().isChecked(), false);
    checks.push("real 401 from OpenRouter: preview body sent, source input preserved, provider detail hidden, no retry");

    // Second live send: the grant is persisted, so no prompt appears and the
    // request reaches the real endpoint again without human action.
    await confirm();
    await send().click();
    await page.getByRole("alert").filter({ hasText: "401" }).waitFor();
    assert.equal(requests.length, 2);
    checks.push("persisted grant skips the prompt; a second send reaches the real endpoint again");
  }

  if (!liveMode) {
    await page.evaluate(() => { window.permissionMode = "allow"; });
    await confirm();
    const sentPreview = await page.locator("#openrouter-request-preview").textContent();
    await send().click();
    await page.locator(".diagnosis-result").waitFor();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].body, sentPreview);
    assert.equal(requests[0].headers.authorization, `Bearer ${fakeKey}`);
    assert.equal(await page.evaluate(() => window.diagnosticExecuted), undefined);
    assert.equal(await consent().isChecked(), false);
    const permissions = await page.evaluate(() => window.permissionCalls);
    assert.ok(permissions.every(item => JSON.stringify(item) === JSON.stringify({ origins: ["https://openrouter.ai/*"] })));
    checks.push("send body equals preview, key stays in header, result renders as text and confirmation is consumed");

    // Multi-turn: freeze the answer into in-memory history, then send a follow-up
    // that resends system + the whole committed history + the new question.
    await button("保留这轮回答，准备追问").click();
    await page.getByRole("heading", { name: "继续追问" }).waitFor();
    assert.equal(await page.locator(".diagnosis-result").count(), 0);
    await page.locator("#follow-up-input").fill("只给一个最小提示");
    await confirm();
    const followPreview = await page.locator("#openrouter-request-preview").textContent();
    assert.ok(followPreview.includes("只给一个最小提示"));
    assert.ok(followPreview.includes("较像卡在调试"));
    assert.ok(!followPreview.includes(fakeKey));
    await send().click();
    await page.locator(".diagnosis-result").waitFor();
    assert.equal(requests.length, 2);
    const followBody = JSON.parse(requests[1].body);
    assert.deepEqual(followBody.messages.map(turn => turn.role), ["system", "user", "assistant", "user"]);
    assert.equal(followBody.messages[3].content, "只给一个最小提示");
    assert.ok(followBody.messages[2].content.includes("较像卡在调试"));
    assert.equal(requests[1].headers.authorization, `Bearer ${fakeKey}`);
    assert.deepEqual(await page.evaluate(() => chrome.storage.local.get(null)), { openrouterModelId: model });
    checks.push("multi-turn: a follow-up resends system + committed history + the new question and keeps history out of storage");

    await button("开始新诊断（清空对话）").click();
    assert.equal(await page.locator(".diagnosis-result").count(), 0);
    await page.waitForFunction(() => !document.querySelector("#openrouter-request-preview").textContent.includes("只给一个最小提示"));

    responseMode = "unauthorized";
    await confirm();
    await send().click();
    await page.getByRole("alert").filter({ hasText: "401" }).waitFor();
    assert.equal(requests.length, 3);
    assert.equal(await page.locator(".diagnosis-result").count(), 0);
    assert.ok(!(await page.locator("body").textContent()).includes("private provider detail"));
    assert.ok((await page.locator("#diagnostic-preview").textContent()).includes("WA on test 3"));
    assert.equal(await consent().isChecked(), false);
    checks.push("401 preserves source input, hides raw error and does not retry");

    responseMode = "pending";
    await confirm();
    await send().click();
    await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some(item => item.textContent.includes("60 秒")));
    const responseDeadline = Date.now() + 10_000;
    while (!releaseResponse && Date.now() < responseDeadline) await new Promise(resolveWait => setTimeout(resolveWait, 20));
    assert.ok(releaseResponse, "the pending request reached the intercept boundary");
  }
  await button("关闭并清空").click();
  releaseResponse?.();
  await openDraft("新的诊断");
  assert.equal(await page.locator("#submission-text-1").inputValue(), "");
  assert.equal(await page.locator("#code-text-1").inputValue(), "");
  assert.equal(await page.locator(".diagnosis-result").count(), 0);
  assert.equal(await page.locator("#openrouter-model").inputValue(), model);
  assert.equal(await consent().isChecked(), false);
  await button("清除当前会话 API key").click();
  await page.getByRole("status").filter({ hasText: "API key 已清除" }).waitFor();
  assert.deepEqual(await page.evaluate(() => chrome.storage.session.get(null)), {});
  checks.push("closing during a request clears raw context; reopening retains only settings and key removal works");

  await button("关闭并清空").click();
  if (!liveMode) await context.setOffline(true);
  await page.reload();
  await page.waitForSelector("#command-input");
  await openDraft("offline diagnostic");
  assert.ok((await page.locator("#diagnostic-preview").textContent()).includes("offline diagnostic"));
  assert.equal(await send().isEnabled(), false);
  assert.equal(requests.length, liveMode ? 2 : 4);
  checks.push("offline reload preserves the command entry and local diagnostic editing without an AI call");

  assert.deepEqual(unexpectedRequests, []);
  assert.deepEqual(errors, []);
  const result = { browser: await browser.version(), build: extensionPath, mode: liveMode ? "live" : "stubbed", checks, apiRequests: liveMode ? "sent to the real https://openrouter.ai/api/v1/chat/completions" : `${requests.length} intercepted fakes`, unexpectedExternalRequests: unexpectedRequests, pageErrors: errors, permissionBoundary: liveMode ? "native prompt approved by a human" : "stubbed; no native host grant or live API verified" };
  if (output) {
    await mkdir(resolve(output), { recursive: true });
    await writeFile(resolve(output, "diagnostic-openrouter.json"), JSON.stringify(result, null, 2));
    await page.screenshot({ path: resolve(output, "diagnostic-openrouter.png"), fullPage: true });
  }
  console.log(JSON.stringify(result, null, 2));
  if (headed) {
    console.log("checks complete; browser left open for manual inspection. Press Ctrl+C or close the window when done.");
    await new Promise(() => {});
  }
} finally {
  releaseResponse?.();
  if (!headed) await context.close();
}

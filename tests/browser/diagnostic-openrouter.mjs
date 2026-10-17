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
  console.log("Usage: node tests/browser/diagnostic-openrouter.mjs [--live] [--headed] [--playwright-core PATH_TO_INDEX_MJS] [--browser PATH_TO_BROWSER_EXE] [--build PATH_TO_PRODUCTION_BUILD] [--output ARTIFACT_DIRECTORY]\nDefault mode intercepts every external request and uses a fake API key. --live lets openrouter.ai requests reach the real network; the first send raises the native host-permission prompt which must be approved by a human, so combine with --headed and a disposable real API key (expected result on an invalid key: a 401 alert). --headed keeps the browser visible and leaves it open after checks.");
  process.exit(0);
}
const liveMode = args.includes("--live");
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
    if (liveMode && request.url() === endpoint) {
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
    await confirm();
    await send().click();
    if (!headed) throw new Error("--live needs --headed: the native host-permission prompt must be approved by a human.");
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

    responseMode = "unauthorized";
    await confirm();
    await send().click();
    await page.getByRole("alert").filter({ hasText: "401" }).waitFor();
    assert.equal(requests.length, 2);
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
  assert.equal(requests.length, liveMode ? 2 : 3);
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

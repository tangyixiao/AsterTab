import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { browser } from "wxt/browser";
import { buildContextPreview, type DiagnosticSource } from "../../core/diagnostic/context-preview";
import { isCurrentConfirmedRequest } from "../../core/diagnostic/confirmed-request";
import { createGitHubCodeDraft, getSelectedGitHubCodeSources, removeGitHubCodeDraft, updateGitHubCodeDraft, type GitHubCodeDraft } from "../../core/diagnostic/github-code-drafts";
import { createGitHubPrivateAccess } from "../../core/diagnostic/private-access";
import { buildOpenRouterConversationRequestBody, OPENROUTER_HOST_PERMISSION, OPENROUTER_MAX_CONTEXT_CHARACTERS, sendOpenRouterRequest, serializeOpenRouterRequestBody, type ConversationMessage } from "../../integrations/ai/openrouter";
import { createOpenRouterSettings } from "../../integrations/ai/openrouter-settings";
import { parseGitHubFileUrl, parseLuoguProblemUrl, readGitHubFile, readLuoguProblem } from "../../core/diagnostic/public-sources";
import { createSubmissionDraft, getSelectedSubmissionSources, removeSubmissionDraft, updateSubmissionDraft, type SubmissionDraft } from "../../core/diagnostic/submission-drafts";
import "./diagnostic-draft.css";

export type DiagnosticDraftProps = {
  request: string;
  onClose: () => void;
};

const LUOGU_ORIGIN = "https://www.luogu.com.cn/*";
const GITHUB_API_ORIGIN = "https://api.github.com/*";
const OPENROUTER_PRIVACY_URL = "https://openrouter.ai/privacy/";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/models";

const openRouterSettings = createOpenRouterSettings(
  {
    get: async key => (await browser.storage.local.get(key))[key],
    set: async (key, value) => browser.storage.local.set({ [key]: value }),
    remove: async key => browser.storage.local.remove(key),
  },
  {
    get: async key => (await browser.storage.session.get(key))[key],
    set: async (key, value) => browser.storage.session.set({ [key]: value }),
    remove: async key => browser.storage.session.remove(key),
  },
);

// The fine-grained PAT lives only in the browser session, with the same lifetime as the API key.
// It is never part of the preview, the AI request body or any log.
const githubPrivateAccess = createGitHubPrivateAccess({
  get: async key => (await browser.storage.session.get(key))[key],
  set: async (key, value) => browser.storage.session.set({ [key]: value }),
  remove: async key => browser.storage.session.remove(key),
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "读取失败，请粘贴内容。";
}

export function DiagnosticDraft({ request, onClose }: DiagnosticDraftProps): JSX.Element {
  const [requestText, setRequestText] = useState(request);
  const [modelId, setModelId] = useState("");
  const [settingsReady, setSettingsReady] = useState(false);
  const [hasSessionKey, setHasSessionKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [confirmedPayload, setConfirmedPayload] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [diagnosisPayload, setDiagnosisPayload] = useState("");
  // Multi-turn history lives only in this component's memory. It is committed
  // exclusively when the user starts a follow-up, so the single-shot send flow
  // stays repeatable and the browser acceptance harness keeps working.
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [followUp, setFollowUp] = useState("");
  const [githubPatInput, setGithubPatInput] = useState("");
  const [hasGithubPat, setHasGithubPat] = useState(false);
  const [githubPatMessage, setGithubPatMessage] = useState("");
  const [githubPatError, setGithubPatError] = useState("");
  const [githubPatBusy, setGithubPatBusy] = useState(false);
  const [problemInputUrl, setProblemInputUrl] = useState("");
  const [problemLabel, setProblemLabel] = useState("洛谷题目");
  const [problemText, setProblemText] = useState("");
  const [problemSourceUrl, setProblemSourceUrl] = useState<string>();
  const [problemIncluded, setProblemIncluded] = useState(true);
  const [problemError, setProblemError] = useState("");
  const [problemLoading, setProblemLoading] = useState(false);
  const [submissionDrafts, setSubmissionDrafts] = useState<SubmissionDraft[]>(() => [createSubmissionDraft(1)]);
  const nextSubmissionDraftId = useRef(2);
  const [codeDrafts, setCodeDrafts] = useState<GitHubCodeDraft[]>(() => [createGitHubCodeDraft(1)]);
  const nextCodeDraftId = useRef(2);
  const codeReadVersions = useRef(new Map<number, number>());
  const readVersion = useRef({ problem: 0 });
  const latestPayload = useRef("");
  const latestConfirmation = useRef("");
  const draftActive = useRef(true);
  const activeSend = useRef<AbortController | undefined>(undefined);
  const sendInProgress = useRef(false);
  const lastSentTurns = useRef<ConversationMessage[]>([]);

  function invalidateConfirmation(): void {
    latestConfirmation.current = "";
    setConfirmedPayload("");
  }

  function updateCodeDraft(id: number, update: Partial<Omit<GitHubCodeDraft, "id">>): void {
    invalidateConfirmation();
    setCodeDrafts(drafts => updateGitHubCodeDraft(drafts, id, update));
  }

  function updateSubmission(id: number, update: Partial<Omit<SubmissionDraft, "id">>): void {
    invalidateConfirmation();
    setSubmissionDrafts(drafts => updateSubmissionDraft(drafts, id, update));
  }

  function invalidateCodeRead(id: number): number {
    const version = (codeReadVersions.current.get(id) ?? 0) + 1;
    codeReadVersions.current.set(id, version);
    return version;
  }

  function invalidateCodeReads(): void {
    for (const id of codeReadVersions.current.keys()) invalidateCodeRead(id);
  }

  useEffect(() => () => {
    draftActive.current = false;
    latestConfirmation.current = "";
    activeSend.current?.abort();
    readVersion.current.problem++;
    invalidateCodeReads();
  }, []);

  const selectedSources: DiagnosticSource[] = [];
  if (problemIncluded && problemText.trim()) selectedSources.push({ id: "problem", kind: "problem", label: problemLabel, text: problemText, ...(problemSourceUrl ? { url: problemSourceUrl } : {}) });
  selectedSources.push(...getSelectedSubmissionSources(submissionDrafts));
  selectedSources.push(...getSelectedGitHubCodeSources(codeDrafts));
  const preview = buildContextPreview(requestText, selectedSources);
  const inFollowUp = conversation.length > 0;
  const outbound = useMemo(() => {
    if (!modelId.trim()) return { body: undefined, turns: [] as ConversationMessage[], serialized: "", error: "请先设置 OpenRouter 模型 ID。" };
    const currentUserContent = inFollowUp ? followUp : preview;
    if (inFollowUp && !currentUserContent.trim()) {
      return { body: undefined, turns: [] as ConversationMessage[], serialized: "", error: "请输入本轮追问内容。" };
    }
    const turns: ConversationMessage[] = [...conversation, { role: "user", content: currentUserContent }];
    try {
      const body = buildOpenRouterConversationRequestBody(modelId, turns);
      return { body, turns, serialized: serializeOpenRouterRequestBody(body), error: "" };
    } catch (error) {
      return { body: undefined, turns, serialized: "", error: errorMessage(error) };
    }
  }, [modelId, preview, conversation, followUp, inFollowUp]);
  latestPayload.current = outbound.serialized;
  latestConfirmation.current = confirmedPayload;
  const readingSources = problemLoading || codeDrafts.some(draft => draft.loading);
  const contextLength = [...conversation, { role: "user" as const, content: inFollowUp ? followUp : preview }]
    .reduce((sum, turn) => sum + turn.content.length, 0);

  useEffect(() => {
    let active = true;
    void Promise.all([openRouterSettings.load(), githubPrivateAccess.read()]).then(([settings, pat]) => {
      if (!active) return;
      setModelId(settings.modelId);
      setHasSessionKey(settings.hasApiKey);
      setHasGithubPat(pat.trim().length > 0);
      setSettingsReady(true);
    }).catch(error => {
      if (!active) return;
      setSettingsError(errorMessage(error));
      setSettingsReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    invalidateConfirmation();
    setSendError("");
  }, [outbound.serialized]);

  async function readProblem(): Promise<void> {
    let url: string;
    try {
      url = parseLuoguProblemUrl(problemInputUrl).url;
    } catch (error) {
      setProblemError(errorMessage(error));
      return;
    }
    invalidateConfirmation();
    const version = ++readVersion.current.problem;
    setProblemLoading(true);
    setProblemError("");
    try {
      if (!await browser.permissions.request({ origins: [LUOGU_ORIGIN] })) throw new Error("未获得洛谷读取权限，可直接粘贴题面。");
      if (version !== readVersion.current.problem) return;
      const source = await readLuoguProblem(url, fetch);
      if (version !== readVersion.current.problem) return;
      invalidateConfirmation();
      setProblemLabel(source.label);
      setProblemText(source.text);
      setProblemSourceUrl(source.url);
      setProblemIncluded(true);
    } catch (error) {
      if (version === readVersion.current.problem) setProblemError(`${errorMessage(error)} 可直接粘贴题面。`);
    } finally {
      if (version === readVersion.current.problem) setProblemLoading(false);
    }
  }

  async function readCode(id: number): Promise<void> {
    const draft = codeDrafts.find(item => item.id === id);
    if (!draft) return;
    let url: string;
    try {
      url = parseGitHubFileUrl(draft.inputUrl).url;
    } catch (error) {
      updateCodeDraft(id, { error: errorMessage(error) });
      return;
    }
    const version = invalidateCodeRead(id);
    updateCodeDraft(id, { loading: true, error: "" });
    try {
      if (!await browser.permissions.request({ origins: [GITHUB_API_ORIGIN] })) throw new Error("未获得 GitHub 读取权限，可直接粘贴代码。");
      if (version !== codeReadVersions.current.get(id)) return;
      const pat = await githubPrivateAccess.read();
      if (version !== codeReadVersions.current.get(id)) return;
      const source = await readGitHubFile(url, fetch, pat || undefined);
      if (version !== codeReadVersions.current.get(id)) return;
      updateCodeDraft(id, { label: source.label, text: source.text, sourceUrl: source.url, included: true });
    } catch (error) {
      if (version === codeReadVersions.current.get(id)) updateCodeDraft(id, { error: `${errorMessage(error)} 可直接粘贴代码。` });
    } finally {
      if (version === codeReadVersions.current.get(id)) updateCodeDraft(id, { loading: false });
    }
  }

  function addCodeDraft(): void {
    invalidateConfirmation();
    const id = nextCodeDraftId.current++;
    setCodeDrafts(drafts => [...drafts, createGitHubCodeDraft(id)]);
  }

  function addSubmission(): void {
    invalidateConfirmation();
    const id = nextSubmissionDraftId.current++;
    setSubmissionDrafts(drafts => [...drafts, createSubmissionDraft(id)]);
  }

  function removeSubmission(id: number): void {
    invalidateConfirmation();
    setSubmissionDrafts(drafts => removeSubmissionDraft(drafts, id));
  }

  function removeCodeDraft(id: number): void {
    invalidateConfirmation();
    invalidateCodeRead(id);
    setCodeDrafts(drafts => removeGitHubCodeDraft(drafts, id));
  }

  function closeDraft(): void {
    draftActive.current = false;
    latestConfirmation.current = "";
    activeSend.current?.abort();
    readVersion.current.problem++;
    invalidateCodeReads();
    onClose();
  }

  async function saveModel(): Promise<void> {
    setSettingsBusy(true);
    setSettingsMessage("");
    setSettingsError("");
    try {
      await openRouterSettings.saveModelId(modelId);
      setModelId(value => value.trim());
      setSettingsMessage("模型 ID 已保存在此浏览器，不会同步。");
    } catch (error) {
      setSettingsError(errorMessage(error));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function saveApiKey(): Promise<void> {
    setSettingsBusy(true);
    setSettingsMessage("");
    setSettingsError("");
    try {
      await openRouterSettings.saveApiKey(apiKeyInput);
      setApiKeyInput("");
      setHasSessionKey(true);
      setSettingsMessage("API key 仅保存在当前浏览器会话内存中。");
    } catch (error) {
      setSettingsError(errorMessage(error));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function removeApiKey(): Promise<void> {
    setSettingsBusy(true);
    setSettingsMessage("");
    setSettingsError("");
    try {
      await openRouterSettings.removeApiKey();
      setHasSessionKey(false);
      setSettingsMessage("当前会话中的 API key 已清除。");
    } catch (error) {
      setSettingsError(errorMessage(error));
    } finally {
      setSettingsBusy(false);
    }
  }

  async function saveGithubPat(): Promise<void> {
    setGithubPatBusy(true);
    setGithubPatMessage("");
    setGithubPatError("");
    try {
      await githubPrivateAccess.save(githubPatInput);
      setGithubPatInput("");
      setHasGithubPat(true);
      setGithubPatMessage("PAT 仅保存在当前浏览器会话内存中，只对 api.github.com 请求生效。");
    } catch (error) {
      setGithubPatError(errorMessage(error));
    } finally {
      setGithubPatBusy(false);
    }
  }

  async function removeGithubPat(): Promise<void> {
    setGithubPatBusy(true);
    setGithubPatMessage("");
    setGithubPatError("");
    try {
      await githubPrivateAccess.remove();
      setHasGithubPat(false);
      setGithubPatMessage("当前会话中的 GitHub PAT 已清除。");
    } catch (error) {
      setGithubPatError(errorMessage(error));
    } finally {
      setGithubPatBusy(false);
    }
  }

  // Freeze the round that just produced a diagnosis into the in-memory history.
  // It only depends on what was actually sent plus its answer, never on the draft
  // of the next question, so typing ahead cannot disable the commit button.
  // `diagnosis` is cleared at the start of every send and after a commit, so a
  // single answer can be committed exactly once.
  function commitAnswerToHistory(): void {
    if (!diagnosis || sending) return;
    const previousTurns = lastSentTurns.current;
    if (previousTurns.length === 0) return;
    setConversation([...previousTurns, { role: "assistant", content: diagnosis }]);
    // The committed question is now part of the history; clear the box so the
    // next round starts from an empty prompt instead of resending the old one.
    setFollowUp("");
    setDiagnosis("");
    setDiagnosisPayload("");
    invalidateConfirmation();
    setSendError("");
  }

  function startNewDiagnosis(): void {
    setConversation([]);
    setFollowUp("");
    setDiagnosis("");
    setDiagnosisPayload("");
    lastSentTurns.current = [];
    invalidateConfirmation();
    setSendError("");
  }

  async function sendDiagnosis(): Promise<void> {
    const payloadAtClick = outbound.serialized;
    const bodyAtClick = outbound.body;
    const turnsAtClick = outbound.turns;
    if (!payloadAtClick || !bodyAtClick || !isCurrentConfirmedRequest(payloadAtClick, latestPayload.current, latestConfirmation.current, draftActive.current)) return;
    if (!settingsReady || !hasSessionKey || readingSources || sending || sendInProgress.current) return;

    // Request the optional host directly in this click handler so the browser can show its permission prompt.
    let permissionRequest: Promise<boolean>;
    sendInProgress.current = true;
    try {
      permissionRequest = browser.permissions.request({ origins: [OPENROUTER_HOST_PERMISSION] });
    } catch (error) {
      sendInProgress.current = false;
      setSendError(errorMessage(error));
      return;
    }

    setSending(true);
    setSendError("");
    setDiagnosis("");
    setDiagnosisPayload("");
    try {
      if (!await permissionRequest) throw new Error("未获得 OpenRouter 访问权限，未发送请求。");
      if (!draftActive.current) return;
      if (!isCurrentConfirmedRequest(payloadAtClick, latestPayload.current, latestConfirmation.current, draftActive.current)) {
        throw new Error("发送确认已撤销或预览已变更，未发送请求。请重新审阅并确认。");
      }

      const apiKey = await openRouterSettings.readApiKey();
      if (!apiKey) {
        setHasSessionKey(false);
        throw new Error("当前浏览器会话中没有 API key，请重新保存后再发送。");
      }
      if (!draftActive.current) return;
      if (!isCurrentConfirmedRequest(payloadAtClick, latestPayload.current, latestConfirmation.current, draftActive.current)) {
        throw new Error("发送确认已撤销或预览已变更，未发送请求。请重新审阅并确认。");
      }

      const controller = new AbortController();
      activeSend.current = controller;
      lastSentTurns.current = turnsAtClick;
      const result = await sendOpenRouterRequest(apiKey, bodyAtClick, fetch, controller.signal);
      if (!draftActive.current) return;
      setDiagnosis(result);
      setDiagnosisPayload(payloadAtClick);
    } catch (error) {
      if (draftActive.current) setSendError(latestPayload.current === payloadAtClick
        ? errorMessage(error)
        : "当前预览已变更；本次请求未自动重试，请审阅新的预览再决定是否发送。");
    } finally {
      activeSend.current = undefined;
      sendInProgress.current = false;
      latestConfirmation.current = "";
      if (draftActive.current) {
        setConfirmedPayload("");
        setSending(false);
      }
    }
  }

  return (
    <main class="diagnostic-draft">
      <div class="draft-heading">
        <div>
          <h1>学习诊断资料</h1>
          <p>只使用你选中的内容。只有审阅完整请求并明确发送后，才会交给 OpenRouter 处理。</p>
        </div>
        <button type="button" onClick={closeDraft}>关闭并清空</button>
      </div>

      <label for="diagnostic-request">诊断请求</label>
      <textarea id="diagnostic-request" value={requestText} maxLength={10000} rows={3} onInput={event => { invalidateConfirmation(); setRequestText(event.currentTarget.value); }} />

      <fieldset>
        <legend>洛谷题目</legend>
        <label for="problem-url">题目 URL</label>
        <div class="draft-read-row">
          <input id="problem-url" type="url" value={problemInputUrl} placeholder="https://www.luogu.com.cn/problem/P1001" onInput={event => {
            invalidateConfirmation();
            readVersion.current.problem++;
            setProblemInputUrl(event.currentTarget.value);
            if (problemSourceUrl) { setProblemText(""); setProblemSourceUrl(undefined); }
            setProblemLoading(false);
            setProblemError("");
          }} />
          <button type="button" disabled={problemLoading} onClick={() => { void readProblem(); }}>{problemLoading ? "读取中…" : "读取此题面"}</button>
        </div>
        <p class="draft-help">只读取这一个公开题目；失败时可粘贴题面。站点访问权限可在浏览器扩展设置中撤销。</p>
        <label for="problem-label">显示名称</label>
        <input id="problem-label" value={problemLabel} maxLength={200} onInput={event => { invalidateConfirmation(); setProblemLabel(event.currentTarget.value); }} />
        <label for="problem-text">题面内容</label>
        <textarea id="problem-text" value={problemText} maxLength={200000} rows={7} onInput={event => {
          invalidateConfirmation();
          readVersion.current.problem++;
          setProblemText(event.currentTarget.value);
          setProblemSourceUrl(undefined);
          setProblemLoading(false);
        }} />
        <label class="draft-check"><input type="checkbox" checked={problemIncluded} onChange={event => { invalidateConfirmation(); if (!event.currentTarget.checked) { readVersion.current.problem++; setProblemLoading(false); } setProblemIncluded(event.currentTarget.checked); }} /> 包含在预览中</label>
        <button type="button" onClick={() => {
          invalidateConfirmation();
          readVersion.current.problem++;
          setProblemInputUrl(""); setProblemText(""); setProblemSourceUrl(undefined); setProblemLabel("洛谷题目"); setProblemError(""); setProblemLoading(false);
        }}>移除题目</button>
        {problemError && <p role="alert">{problemError}</p>}
      </fieldset>

      <fieldset>
        <legend>近期提交</legend>
        <p class="draft-help">逐条粘贴你选定的提交代码、Verdict 和反馈；不会读取账户历史。</p>
        {submissionDrafts.map((draft, index) => (
          <fieldset class="draft-submission-source" key={draft.id}>
            <legend>提交记录 {index + 1}</legend>
            <label for={`submission-url-${draft.id}`}>提交链接（可选）</label>
            <input id={`submission-url-${draft.id}`} type="url" value={draft.url} onInput={event => updateSubmission(draft.id, { url: event.currentTarget.value })} />
            <label for={`submission-label-${draft.id}`}>显示名称</label>
            <input id={`submission-label-${draft.id}`} value={draft.label} maxLength={200} onInput={event => updateSubmission(draft.id, { label: event.currentTarget.value })} />
            <label for={`submission-text-${draft.id}`}>提交代码、Verdict 与反馈</label>
            <textarea id={`submission-text-${draft.id}`} value={draft.text} maxLength={200000} rows={7} onInput={event => updateSubmission(draft.id, { text: event.currentTarget.value })} />
            <label class="draft-check"><input type="checkbox" checked={draft.included} onChange={event => updateSubmission(draft.id, { included: event.currentTarget.checked })} /> 包含在预览中</label>
            <button type="button" onClick={() => removeSubmission(draft.id)}>移除此提交</button>
          </fieldset>
        ))}
        <button type="button" onClick={addSubmission}>添加提交记录</button>
      </fieldset>

      <fieldset>
        <legend>GitHub 代码</legend>
        <p class="draft-help">只读取你指定的文件；私有仓库需在下方填入只读细粒度 PAT。自动读取仅支持包含 40 位提交 SHA 的文件永久链接；其他情况请粘贴代码。站点访问权限可在浏览器扩展设置中撤销。</p>
        {codeDrafts.map((draft, index) => (
          <fieldset class="draft-code-source" key={draft.id}>
            <legend>GitHub 文件 {index + 1}</legend>
            <label for={`code-url-${draft.id}`}>文件 URL</label>
            <div class="draft-read-row">
              <input id={`code-url-${draft.id}`} type="url" value={draft.inputUrl} placeholder="https://github.com/owner/repo/blob/提交SHA/file.cpp" onInput={event => {
                invalidateCodeRead(draft.id);
                updateCodeDraft(draft.id, {
                  inputUrl: event.currentTarget.value,
                  ...(draft.sourceUrl ? { text: "", sourceUrl: undefined } : {}),
                  loading: false,
                  error: "",
                });
              }} />
              <button type="button" disabled={draft.loading} onClick={() => { void readCode(draft.id); }}>{draft.loading ? "读取中…" : "读取此文件"}</button>
            </div>
            <label for={`code-label-${draft.id}`}>显示名称</label>
            <input id={`code-label-${draft.id}`} value={draft.label} maxLength={200} onInput={event => updateCodeDraft(draft.id, { label: event.currentTarget.value })} />
            <label for={`code-text-${draft.id}`}>代码内容</label>
            <textarea id={`code-text-${draft.id}`} value={draft.text} maxLength={200000} rows={7} onInput={event => {
              invalidateCodeRead(draft.id);
              updateCodeDraft(draft.id, { text: event.currentTarget.value, sourceUrl: undefined, loading: false });
            }} />
            <label class="draft-check"><input type="checkbox" checked={draft.included} onChange={event => {
              if (!event.currentTarget.checked) {
                invalidateCodeRead(draft.id);
                updateCodeDraft(draft.id, { included: false, loading: false });
              } else {
                updateCodeDraft(draft.id, { included: true });
              }
            }} /> 包含在预览中</label>
            <button type="button" onClick={() => removeCodeDraft(draft.id)}>移除此文件</button>
            {draft.error && <p role="alert">{draft.error}</p>}
          </fieldset>
        ))}
        <button type="button" onClick={addCodeDraft}>添加 GitHub 文件</button>
      </fieldset>

      <fieldset>
        <legend>GitHub 私有仓库访问（可选）</legend>
        <p class="draft-help">读取私有仓库文件时，请在 GitHub 创建只读、仅授权指定仓库的细粒度 PAT。PAT 仅保存在当前浏览器会话内存中，只对 <code>api.github.com</code> 请求添加 Authorization 头；不会进入资料预览、AI 请求正文或日志。可随时在 GitHub 设置中撤销。</p>
        <label for="github-pat">GitHub 细粒度 PAT</label>
        <div class="draft-read-row">
          <input id="github-pat" type="password" value={githubPatInput} maxLength={500} disabled={!settingsReady || githubPatBusy} autoComplete="off" spellcheck={false} placeholder={hasGithubPat ? "当前会话已保存；输入新 PAT 可替换" : "github_pat_…"} onInput={event => { setGithubPatInput(event.currentTarget.value); setGithubPatMessage(""); setGithubPatError(""); }} />
          <button type="button" disabled={!settingsReady || githubPatBusy || !githubPatInput.trim()} onClick={() => { void saveGithubPat(); }}>保存 PAT 到当前会话</button>
        </div>
        {hasGithubPat && <button type="button" disabled={githubPatBusy} onClick={() => { void removeGithubPat(); }}>清除当前会话 PAT</button>}
        {githubPatMessage && <p role="status">{githubPatMessage}</p>}
        {githubPatError && <p role="alert">{githubPatError}</p>}
      </fieldset>

      <fieldset>
        <legend>OpenRouter 设置</legend>
        <p class="draft-help">模型 ID 会保存在此浏览器本地，不会同步。API key 只保存在当前浏览器会话内存中；浏览器关闭、扩展重载或更新后会清除。</p>
        <label for="openrouter-model">模型 ID</label>
        <div class="draft-read-row">
          <input id="openrouter-model" value={modelId} maxLength={200} disabled={!settingsReady || settingsBusy} placeholder="provider/model" onInput={event => { invalidateConfirmation(); setModelId(event.currentTarget.value); setSettingsMessage(""); setSettingsError(""); }} />
          <button type="button" disabled={!settingsReady || settingsBusy || !modelId.trim()} onClick={() => { void saveModel(); }}>保存模型</button>
        </div>
        <p class="draft-help">从 <a href={OPENROUTER_MODELS_URL} target="_blank" rel="noreferrer">OpenRouter 模型目录</a>复制模型 ID。AsterTab 不会自动选择或切换模型。</p>
        <label for="openrouter-api-key">OpenRouter API key</label>
        <div class="draft-read-row">
          <input id="openrouter-api-key" type="password" value={apiKeyInput} maxLength={500} disabled={!settingsReady || settingsBusy} autoComplete="off" spellcheck={false} placeholder={hasSessionKey ? "当前会话已保存；输入新 key 可替换" : "sk-or-v1-…"} onInput={event => { setApiKeyInput(event.currentTarget.value); setSettingsMessage(""); setSettingsError(""); }} />
          <button type="button" disabled={!settingsReady || settingsBusy || !apiKeyInput.trim()} onClick={() => { void saveApiKey(); }}>保存到当前会话</button>
        </div>
        {hasSessionKey && <button type="button" disabled={settingsBusy} onClick={() => { void removeApiKey(); }}>清除当前会话 API key</button>}
        {settingsMessage && <p role="status">{settingsMessage}</p>}
        {settingsError && <p role="alert">{settingsError}</p>}
      </fieldset>

      <section aria-labelledby="preview-title">
        <h2 id="preview-title">OpenRouter 请求预览</h2>
        <p>发送目标：<code>POST https://openrouter.ai/api/v1/chat/completions</code></p>
        <p class="draft-help">仅在点击发送后，浏览器才会申请访问 <code>openrouter.ai</code> 的主机权限；可随时在扩展设置中撤销。</p>
        <p>API key 会通过 HTTPS Authorization header 发送，不包含在下方 JSON 正文中。正文会逐字使用下方完整 JSON 请求正文与模型设置。</p>
        <p class="draft-help">确认后，所选资料会发送至 OpenRouter，并转交所选模型服务商处理。OpenRouter 说明不同模型服务商的数据保留和训练做法可能不同；发送前请查看 <a href={OPENROUTER_PRIVACY_URL} target="_blank" rel="noreferrer">OpenRouter 隐私政策</a>及所选模型的数据政策。AsterTab 不会自动重试或切换模型。</p>
        <h3>当前选中的资料</h3>
        {inFollowUp && <p class="draft-help">本轮是追问：发送正文为下方完整 JSON（system + 全部历史问答 + 本轮追问）。上方资料仅供参照，不随追问重发。</p>}
        <pre id="diagnostic-preview" tabIndex={0}>{preview}</pre>
        <details open>
          <summary>完整 JSON 请求正文（不含 API key 与 GitHub PAT）</summary>
          <pre id="openrouter-request-preview" tabIndex={0}>{outbound.serialized || outbound.error}</pre>
        </details>
        <p class="draft-help">对话正文 {contextLength.toLocaleString("zh-CN")} / {OPENROUTER_MAX_CONTEXT_CHARACTERS.toLocaleString("zh-CN")} 个字符（50,000 上限含固定系统提示）</p>
        {outbound.error && modelId.trim() && <p role={outbound.error === "请输入本轮追问内容。" ? "status" : "alert"}>{outbound.error}</p>}
        {outbound.error && !modelId.trim() && <p class="draft-help">{outbound.error}</p>}
        <label class="draft-check"><input
          type="checkbox"
          checked={!!outbound.serialized && confirmedPayload === outbound.serialized}
          disabled={!outbound.serialized || sending || readingSources}
          onChange={event => {
            const value = event.currentTarget.checked ? outbound.serialized : "";
            latestConfirmation.current = value;
            setConfirmedPayload(value);
          }}
        /> 我已审阅上方完整正文，并同意将其发送给 OpenRouter 及所选模型服务商处理。</label>
        <button type="button" disabled={!settingsReady || !hasSessionKey || !outbound.body || confirmedPayload !== outbound.serialized || sending || readingSources} onClick={() => { void sendDiagnosis(); }}>
          {sending ? "正在请求 OpenRouter…" : "确认并发送诊断"}
        </button>
        {sendError && <p role="alert">{sendError}</p>}
        {sending && <p role="status">请求最多等待 60 秒，不会自动重试。</p>}
        {diagnosis && diagnosisPayload === outbound.serialized && <section aria-labelledby="diagnosis-result-title">
          <h3 id="diagnosis-result-title">诊断结果</h3>
          <pre class="diagnosis-result" tabIndex={0}>{diagnosis}</pre>
        </section>}
      </section>

      {(diagnosis || inFollowUp) && <section aria-labelledby="follow-up-title">
        <h2 id="follow-up-title">继续追问</h2>
        <p class="draft-help">追问会连同之前所有问答一起重新发送（无状态全量重发）。每轮都需在上方重新审阅完整 JSON 预览并重新勾选确认。对话历史只保留在当前页面内存，关闭草稿即清空。</p>
        {diagnosis && <button type="button" disabled={sending} onClick={commitAnswerToHistory}>保留这轮回答，准备追问</button>}
        <label for="follow-up-input">本轮追问</label>
        <textarea id="follow-up-input" value={followUp} maxLength={10000} rows={2} placeholder="例如：请只给一个最小提示，不要展开完整题解" onInput={event => { setFollowUp(event.currentTarget.value); invalidateConfirmation(); setSendError(""); }} />
        <button type="button" disabled={sending} onClick={startNewDiagnosis}>开始新诊断（清空对话）</button>
        <details>
          <summary>对话历史（{conversation.length} 条已固化消息）</summary>
          {conversation.length === 0
            ? <p class="draft-help">先点「保留这轮回答，准备追问」把首轮问答固化到历史。</p>
            : <ol>{conversation.map((turn, index) => (
              <li key={index}>
                <strong>{turn.role === "user" ? "我" : "诊断"}：</strong>
                <pre class="draft-turn" tabIndex={0}>{turn.content}</pre>
              </li>
            ))}</ol>}
        </details>
      </section>}
    </main>
  );
}

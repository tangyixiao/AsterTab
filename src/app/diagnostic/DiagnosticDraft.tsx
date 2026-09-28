import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { browser } from "wxt/browser";
import { buildContextPreview, type DiagnosticSource } from "../../core/diagnostic/context-preview";
import { parseGitHubFileUrl, parseLuoguProblemUrl, readGitHubFile, readLuoguProblem } from "../../core/diagnostic/public-sources";
import "./diagnostic-draft.css";

export type DiagnosticDraftProps = {
  request: string;
  onClose: () => void;
};

const LUOGU_ORIGIN = "https://www.luogu.com.cn/*";
const GITHUB_API_ORIGIN = "https://api.github.com/*";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "读取失败，请粘贴内容。";
}

export function DiagnosticDraft({ request, onClose }: DiagnosticDraftProps): JSX.Element {
  const [requestText, setRequestText] = useState(request);
  const [problemInputUrl, setProblemInputUrl] = useState("");
  const [problemLabel, setProblemLabel] = useState("洛谷题目");
  const [problemText, setProblemText] = useState("");
  const [problemSourceUrl, setProblemSourceUrl] = useState<string>();
  const [problemIncluded, setProblemIncluded] = useState(true);
  const [problemError, setProblemError] = useState("");
  const [problemLoading, setProblemLoading] = useState(false);
  const [submissionLabel, setSubmissionLabel] = useState("选定提交与评测反馈");
  const [submissionText, setSubmissionText] = useState("");
  const [submissionIncluded, setSubmissionIncluded] = useState(true);
  const [codeInputUrl, setCodeInputUrl] = useState("");
  const [codeLabel, setCodeLabel] = useState("相关代码");
  const [codeText, setCodeText] = useState("");
  const [codeSourceUrl, setCodeSourceUrl] = useState<string>();
  const [codeIncluded, setCodeIncluded] = useState(true);
  const [codeError, setCodeError] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const readVersion = useRef({ problem: 0, code: 0 });

  useEffect(() => () => {
    readVersion.current.problem++;
    readVersion.current.code++;
  }, []);

  const selectedSources: DiagnosticSource[] = [];
  if (problemIncluded && problemText.trim()) selectedSources.push({ id: "problem", kind: "problem", label: problemLabel, text: problemText, ...(problemSourceUrl ? { url: problemSourceUrl } : {}) });
  if (submissionIncluded && submissionText.trim()) selectedSources.push({ id: "submission", kind: "submission", label: submissionLabel, text: submissionText });
  if (codeIncluded && codeText.trim()) selectedSources.push({ id: "code", kind: "code", label: codeLabel, text: codeText, ...(codeSourceUrl ? { url: codeSourceUrl } : {}) });
  const preview = buildContextPreview(requestText, selectedSources);

  async function readProblem(): Promise<void> {
    let url: string;
    try {
      url = parseLuoguProblemUrl(problemInputUrl).url;
    } catch (error) {
      setProblemError(errorMessage(error));
      return;
    }
    const version = ++readVersion.current.problem;
    setProblemLoading(true);
    setProblemError("");
    try {
      if (!await browser.permissions.request({ origins: [LUOGU_ORIGIN] })) throw new Error("未获得洛谷读取权限，可直接粘贴题面。");
      if (version !== readVersion.current.problem) return;
      const source = await readLuoguProblem(url, fetch);
      if (version !== readVersion.current.problem) return;
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

  async function readCode(): Promise<void> {
    let url: string;
    try {
      url = parseGitHubFileUrl(codeInputUrl).url;
    } catch (error) {
      setCodeError(errorMessage(error));
      return;
    }
    const version = ++readVersion.current.code;
    setCodeLoading(true);
    setCodeError("");
    try {
      if (!await browser.permissions.request({ origins: [GITHUB_API_ORIGIN] })) throw new Error("未获得 GitHub 读取权限，可直接粘贴代码。");
      if (version !== readVersion.current.code) return;
      const source = await readGitHubFile(url, fetch);
      if (version !== readVersion.current.code) return;
      setCodeLabel(source.label);
      setCodeText(source.text);
      setCodeSourceUrl(source.url);
      setCodeIncluded(true);
    } catch (error) {
      if (version === readVersion.current.code) setCodeError(`${errorMessage(error)} 可直接粘贴代码。`);
    } finally {
      if (version === readVersion.current.code) setCodeLoading(false);
    }
  }

  return (
    <main class="diagnostic-draft">
      <div class="draft-heading">
        <div>
          <h1>学习诊断资料</h1>
          <p>只使用你选中的内容。预览仅在本页显示，当前不会发送给 AI。</p>
        </div>
        <button type="button" onClick={() => { readVersion.current.problem++; readVersion.current.code++; onClose(); }}>关闭并清空</button>
      </div>

      <label for="diagnostic-request">诊断请求</label>
      <textarea id="diagnostic-request" value={requestText} maxLength={10000} rows={3} onInput={event => setRequestText(event.currentTarget.value)} />

      <fieldset>
        <legend>洛谷题目</legend>
        <label for="problem-url">题目 URL</label>
        <div class="draft-read-row">
          <input id="problem-url" type="url" value={problemInputUrl} placeholder="https://www.luogu.com.cn/problem/P1001" onInput={event => {
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
        <input id="problem-label" value={problemLabel} maxLength={200} onInput={event => setProblemLabel(event.currentTarget.value)} />
        <label for="problem-text">题面内容</label>
        <textarea id="problem-text" value={problemText} maxLength={200000} rows={7} onInput={event => {
          readVersion.current.problem++;
          setProblemText(event.currentTarget.value);
          setProblemSourceUrl(undefined);
          setProblemLoading(false);
        }} />
        <label class="draft-check"><input type="checkbox" checked={problemIncluded} onChange={event => { if (!event.currentTarget.checked) { readVersion.current.problem++; setProblemLoading(false); } setProblemIncluded(event.currentTarget.checked); }} /> 包含在预览中</label>
        <button type="button" onClick={() => {
          readVersion.current.problem++;
          setProblemInputUrl(""); setProblemText(""); setProblemSourceUrl(undefined); setProblemLabel("洛谷题目"); setProblemError(""); setProblemLoading(false);
        }}>移除题目</button>
        {problemError && <p role="alert">{problemError}</p>}
      </fieldset>

      <fieldset>
        <legend>近期提交</legend>
        <p class="draft-help">粘贴你选定的提交代码、Verdict 和反馈；不会读取账户历史。</p>
        <label for="submission-label">显示名称</label>
        <input id="submission-label" value={submissionLabel} maxLength={200} onInput={event => setSubmissionLabel(event.currentTarget.value)} />
        <label for="submission-text">选定提交内容</label>
        <textarea id="submission-text" value={submissionText} maxLength={200000} rows={7} onInput={event => setSubmissionText(event.currentTarget.value)} />
        <label class="draft-check"><input type="checkbox" checked={submissionIncluded} onChange={event => setSubmissionIncluded(event.currentTarget.checked)} /> 包含在预览中</label>
        <button type="button" onClick={() => { setSubmissionText(""); setSubmissionLabel("选定提交与评测反馈"); }}>移除提交</button>
      </fieldset>

      <fieldset>
        <legend>GitHub 代码</legend>
        <label for="code-url">公开文件 URL</label>
        <div class="draft-read-row">
          <input id="code-url" type="url" value={codeInputUrl} placeholder="https://github.com/owner/repo/blob/main/file.cpp" onInput={event => {
            readVersion.current.code++;
            setCodeInputUrl(event.currentTarget.value);
            if (codeSourceUrl) { setCodeText(""); setCodeSourceUrl(undefined); }
            setCodeLoading(false);
            setCodeError("");
          }} />
          <button type="button" disabled={codeLoading} onClick={() => { void readCode(); }}>{codeLoading ? "读取中…" : "读取此文件"}</button>
        </div>
        <p class="draft-help">只读取这个公开文件。带斜杠的分支名请使用文件永久链接，或粘贴代码。站点访问权限可在浏览器扩展设置中撤销。</p>
        <label for="code-label">显示名称</label>
        <input id="code-label" value={codeLabel} maxLength={200} onInput={event => setCodeLabel(event.currentTarget.value)} />
        <label for="code-text">代码内容</label>
        <textarea id="code-text" value={codeText} maxLength={200000} rows={7} onInput={event => {
          readVersion.current.code++;
          setCodeText(event.currentTarget.value);
          setCodeSourceUrl(undefined);
          setCodeLoading(false);
        }} />
        <label class="draft-check"><input type="checkbox" checked={codeIncluded} onChange={event => { if (!event.currentTarget.checked) { readVersion.current.code++; setCodeLoading(false); } setCodeIncluded(event.currentTarget.checked); }} /> 包含在预览中</label>
        <button type="button" onClick={() => {
          readVersion.current.code++;
          setCodeInputUrl(""); setCodeText(""); setCodeSourceUrl(undefined); setCodeLabel("相关代码"); setCodeError(""); setCodeLoading(false);
        }}>移除代码</button>
        {codeError && <p role="alert">{codeError}</p>}
      </fieldset>

      <section aria-labelledby="preview-title">
        <h2 id="preview-title">将来外发的完整内容预览</h2>
        <p>尚未发送。关闭后清空本页资料。</p>
        <pre id="diagnostic-preview" tabIndex={0}>{preview}</pre>
      </section>
    </main>
  );
}

import type { DiagnosticSource } from "./context-preview";

const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_FILE_BYTES = 200_000;

function parseUrl(input: string, host: string): URL {
  if (/%2e|%2f|%5c|\/\.\.?\/|\\/i.test(input)) throw new Error("来源 URL 包含不允许的路径。");
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("来源 URL 无效。");
  }
  if (url.protocol !== "https:" || url.hostname !== host || url.username || url.password || url.port || url.search || url.hash) {
    throw new Error("只支持指定服务的 HTTPS 页面 URL，且不能带参数或片段。");
  }
  return url;
}

export function parseLuoguProblemUrl(input: string): { pid: string; url: string } {
  const url = parseUrl(input, "www.luogu.com.cn");
  const match = /^\/problem\/([A-Z][A-Za-z0-9_-]*)$/.exec(url.pathname);
  if (!match) throw new Error("请输入单个洛谷题目页 URL。");
  return { pid: match[1]!, url: url.href };
}

export function parseGitHubFileUrl(input: string): { owner: string; repo: string; ref: string; path: string; url: string; apiUrl: string } {
  const url = parseUrl(input, "github.com");
  const segments = url.pathname.split("/").slice(1).map(segment => decodeURIComponent(segment));
  if (segments.length < 5 || segments[2] !== "blob") throw new Error("请输入 GitHub 单个文件的 blob URL。");
  const [owner, repo, , ref, ...filePath] = segments;
  if (!owner || !repo || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("GitHub 仓库无效。");
  if (!ref || !/^[0-9a-f]{40}$/i.test(ref)) throw new Error("请使用包含 40 位提交 SHA 的 GitHub 文件永久链接。");
  if (filePath.some(segment => !segment || segment === "." || segment === ".." || /[\\/\x00-\x1f]/.test(segment)) || filePath.join("/").length > 500) {
    throw new Error("GitHub 文件路径无效。");
  }
  const path = filePath.join("/");
  const apiUrl = new URL(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath.map(encodeURIComponent).join("/")}`);
  apiUrl.searchParams.set("ref", ref);
  return { owner, repo, ref, path, url: url.href, apiUrl: apiUrl.href };
}

async function readBoundedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("Content-Length"));
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error("来源内容过大。");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("来源内容过大。");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function fetchSelected(url: string, fetcher: typeof fetch, headers?: HeadersInit): Promise<string> {
  const response = await fetcher(url, { credentials: "omit", redirect: "error", ...(headers ? { headers } : {}) });
  if (response.redirected || (response.url && response.url !== url)) throw new Error("来源发生跳转，已停止读取。");
  if (response.status === 403 && url.startsWith("https://api.github.com/")) throw new Error("GitHub 公共 API 返回 HTTP 403，权限或请求次数受限。");
  if (!response.ok) throw new Error(`来源读取失败（HTTP ${response.status}）。`);
  return readBoundedText(response);
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("来源数据格式不符合预期。");
  return value as Record<string, unknown>;
}

function section(label: string, value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? `${label}\n${value.trim()}` : undefined;
}

export async function readLuoguProblem(inputUrl: string, fetcher: typeof fetch): Promise<DiagnosticSource> {
  const { pid, url } = parseLuoguProblemUrl(inputUrl);
  const html = await fetchSelected(url, fetcher);
  const script = /<script\b[^>]*\bid=["']lentille-context["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!script) throw new Error("洛谷题面格式已变化，请粘贴题面。");
  const page = record(JSON.parse(script[1]!));
  const data = record(page.data);
  const problem = record(data.problem);
  const content = record(problem.content);
  if (page.template !== "problem.show" || problem.pid !== pid || typeof problem.name !== "string" || typeof content.description !== "string") {
    throw new Error("洛谷题面格式已变化，请粘贴题面。");
  }
  const parts = [
    section("题目背景", content.background),
    section("题目描述", content.description),
    section("输入格式", content.formatI),
    section("输出格式", content.formatO),
  ];
  if (Array.isArray(problem.samples)) {
    problem.samples.forEach((sample, index) => {
      if (Array.isArray(sample) && sample.length === 2) {
        parts.push(section(`样例输入 ${index + 1}`, sample[0]), section(`样例输出 ${index + 1}`, sample[1]));
      }
    });
  }
  parts.push(section("说明与提示", content.hint));
  const text = parts.filter((part): part is string => Boolean(part)).join("\n\n");
  if (text.length > MAX_FILE_BYTES) throw new Error("题面过长，请粘贴需要的片段。");
  return { id: `luogu:${pid}`, kind: "problem", label: `${pid} ${problem.name}`, url, text };
}

export async function readGitHubFile(inputUrl: string, fetcher: typeof fetch, pat?: string): Promise<DiagnosticSource> {
  const target = parseGitHubFileUrl(inputUrl);
  const token = pat?.trim();
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const body = await fetchSelected(target.apiUrl, fetcher, headers);
  const file = record(JSON.parse(body));
  if (file.type !== "file" || file.encoding !== "base64" || typeof file.content !== "string" || typeof file.size !== "number" || file.size > MAX_FILE_BYTES) {
    throw new Error("GitHub 返回的不是可读取的文本文件，请粘贴代码。");
  }
  const encoded = file.content.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error("GitHub 文件编码无效。");
  const binary = atob(encoded);
  if (binary.length > MAX_FILE_BYTES) throw new Error("GitHub 文件过大，请粘贴片段。");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
  if (text.includes("\0")) throw new Error("GitHub 文件不是文本，请粘贴代码。");
  return { id: `github:${target.owner}/${target.repo}/${target.ref}/${target.path}`, kind: "code", label: `${target.owner}/${target.repo}:${target.path}`, url: target.url, text };
}

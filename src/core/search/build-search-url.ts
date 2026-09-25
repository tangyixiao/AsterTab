import type { SearchCommand } from "../commands/parse-command";

export function buildSearchUrl(command: SearchCommand): URL {
  if (!command.query.trim()) throw new RangeError("Search query is empty");
  let url: URL;
  switch (command.target) {
    case "default":
      url = new URL("https://www.bing.com/search");
      url.searchParams.set("q", command.query);
      return url;
    case "google":
      url = new URL("https://www.google.com/search");
      url.searchParams.set("q", command.query);
      return url;
    case "github":
      url = new URL("https://github.com/search");
      url.searchParams.set("q", command.query);
      url.searchParams.set("type", "repositories");
      return url;
    case "luogu":
      url = new URL("https://www.luogu.com.cn/problem/list");
      url.searchParams.set("keyword", command.query);
      url.searchParams.set("page", "1");
      return url;
  }
}

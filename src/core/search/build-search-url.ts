import type { SearchCommand } from "../commands/parse-command";
import { parseCodeforcesQuery } from "./codeforces-query";
import { parseLuoguQuery } from "./luogu-query";

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
    case "luogu": {
      const lg = parseLuoguQuery(command.query);
      if (lg.kind === "problem") {
        url = new URL(`https://www.luogu.com.cn/problem/${lg.pid}`);
        return url;
      }
      url = new URL("https://www.luogu.com.cn/problem/list");
      url.searchParams.set("keyword", lg.keyword);
      url.searchParams.set("page", "1");
      return url;
    }
    case "codeforces": {
      const cf = parseCodeforcesQuery(command.query);
      url = cf.kind === "problem"
        ? new URL(`https://codeforces.com/problemset/problem/${cf.contest}/${cf.index}`)
        : new URL(`https://codeforces.com/profile/${encodeURIComponent(cf.handle)}`);
      return url;
    }
  }
}

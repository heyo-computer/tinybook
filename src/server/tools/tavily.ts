export type TavilyResult = {
  title: string;
  url: string;
  content: string;
};

export async function tavilySearch(opts: {
  apiKey: string;
  query: string;
  maxResults?: number;
}): Promise<{ results: TavilyResult[]; answer?: string }> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: opts.apiKey,
      query: opts.query,
      max_results: Math.max(1, Math.min(opts.maxResults ?? 5, 10)),
      search_depth: "basic",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`tavily ${res.status}: ${text}`);
  }
  const data: any = await res.json();
  const results: TavilyResult[] = Array.isArray(data.results)
    ? data.results.map((r: any) => ({
        title: String(r.title ?? ""),
        url: String(r.url ?? ""),
        content: String(r.content ?? ""),
      }))
    : [];
  return { results, answer: data.answer };
}

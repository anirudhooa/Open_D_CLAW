// ─────────────────────────────────────────────────────────
// tools/web-search.ts — DuckDuckGo web search (free)
// ─────────────────────────────────────────────────────────
import { registerTool } from "./registry.js";

interface SearchResult {
    title: string;
    url: string;
    snippet: string;
}

async function duckDuckGoSearch(query: string, numResults = 5): Promise<SearchResult[]> {
    // Use DuckDuckGo's HTML search endpoint
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
    });

    const html = await response.text();
    const results: SearchResult[] = [];

    // Parse results from DDG HTML response
    const resultBlocks = html.split('class="result__body"');
    for (let i = 1; i < resultBlocks.length && results.length < numResults; i++) {
        const block = resultBlocks[i];

        // Extract URL
        const urlMatch = block.match(/href="([^"]+)"/);
        const rawUrl = urlMatch?.[1] || "";
        // DDG wraps URLs in redirects, extract the actual URL
        const actualUrl = decodeURIComponent(
            rawUrl.replace(/.*uddg=/, "").replace(/&.*/, "")
        ) || rawUrl;

        // Extract title
        const titleMatch = block.match(/class="result__a"[^>]*>([^<]+)</);
        const title = titleMatch?.[1]?.trim() || "Untitled";

        // Extract snippet
        const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
        let snippet = snippetMatch?.[1] || "";
        snippet = snippet.replace(/<[^>]+>/g, "").trim();

        if (actualUrl && !actualUrl.startsWith("/")) {
            results.push({ title, url: actualUrl, snippet });
        }
    }

    return results;
}

registerTool({
    schema: {
        type: "function",
        function: {
            name: "web_search",
            description:
                "Search the web using DuckDuckGo. Returns top results with titles, snippets, and URLs. Use this to find current information, look up facts, or research topics.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search query.",
                    },
                    num_results: {
                        type: "number",
                        description: "Number of results to return (default: 5, max: 10).",
                    },
                },
                required: ["query"],
            },
        },
    },
    async execute(input) {
        const query = input.query as string;
        const numResults = Math.min((input.num_results as number) || 5, 10);

        try {
            const results = await duckDuckGoSearch(query, numResults);
            if (results.length === 0) {
                return "No search results found.";
            }
            return results
                .map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`)
                .join("\n\n");
        } catch (err) {
            return `Search error: ${err instanceof Error ? err.message : String(err)}`;
        }
    },
});

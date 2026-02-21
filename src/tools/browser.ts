// ─────────────────────────────────────────────────────────
// tools/browser.ts — Browser automation via headless fetch
// ─────────────────────────────────────────────────────────
// NOTE: Using lightweight fetch-based approach instead of Playwright
// to avoid the ~200MB dependency. For full browser automation,
// Playwright can be added later.
import { registerTool } from "./registry.js";

const MAX_OUTPUT = 4000;

// ── browse_url ───────────────────────────────────────────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "browse_url",
            description:
                "Fetch a web page and extract its text content. Useful for reading articles, documentation, or any web page.",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "The URL to fetch." },
                },
                required: ["url"],
            },
        },
    },
    async execute(input) {
        const url = input.url as string;
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
                signal: AbortSignal.timeout(15000),
            });

            if (!response.ok) {
                return `HTTP Error ${response.status}: ${response.statusText}`;
            }

            const html = await response.text();

            // Simple HTML to text conversion
            let text = html
                // Remove scripts and styles
                .replace(/<script[\s\S]*?<\/script>/gi, "")
                .replace(/<style[\s\S]*?<\/style>/gi, "")
                // Convert block elements to newlines
                .replace(/<\/?(p|div|br|h[1-6]|li|tr)[^>]*>/gi, "\n")
                // Remove remaining tags
                .replace(/<[^>]+>/g, "")
                // Decode entities
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, " ")
                // Clean whitespace
                .replace(/\n{3,}/g, "\n\n")
                .trim();

            if (text.length > MAX_OUTPUT) {
                text = text.slice(0, MAX_OUTPUT) + "\n...(truncated)";
            }

            return text || "(page has no text content)";
        } catch (err) {
            return `Error fetching ${url}: ${err instanceof Error ? err.message : String(err)}`;
        }
    },
});

// ── screenshot_page (returns page metadata instead) ──────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "get_page_info",
            description:
                "Get metadata about a web page: title, links, headings, and word count.",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "The URL to analyze." },
                },
                required: ["url"],
            },
        },
    },
    async execute(input) {
        const url = input.url as string;
        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                },
                signal: AbortSignal.timeout(15000),
            });

            const html = await response.text();

            // Extract title
            const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            const title = titleMatch?.[1]?.trim() || "(no title)";

            // Extract headings
            const headings: string[] = [];
            const headingRegex = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
            let match;
            while ((match = headingRegex.exec(html)) !== null && headings.length < 15) {
                headings.push(`H${match[1]}: ${match[2].replace(/<[^>]+>/g, "").trim()}`);
            }

            // Count links
            const linkCount = (html.match(/<a /gi) || []).length;

            // Word count
            const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
            const wordCount = text.split(" ").filter((w) => w.length > 0).length;

            return [
                `Title: ${title}`,
                `URL: ${url}`,
                `Words: ~${wordCount}`,
                `Links: ${linkCount}`,
                headings.length > 0 ? `\nHeadings:\n${headings.join("\n")}` : "",
            ].join("\n");
        } catch (err) {
            return `Error: ${err instanceof Error ? err.message : String(err)}`;
        }
    },
});

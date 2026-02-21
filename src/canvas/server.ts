// ─────────────────────────────────────────────────────────
// canvas/server.ts — Live Canvas (localhost-only WebSocket)
// ─────────────────────────────────────────────────────────
import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { registerTool } from "../tools/registry.js";

const CANVAS_PORT = 3100;

interface CanvasWidget {
    id: string;
    type: string;
    html: string;
    timestamp: number;
}

const widgets: CanvasWidget[] = [];
const clients = new Set<ServerResponse>();

/** Push a widget to all connected clients */
function pushWidget(widget: CanvasWidget): void {
    widgets.push(widget);
    const data = `data: ${JSON.stringify(widget)}\n\n`;
    for (const client of clients) {
        try {
            client.write(data);
        } catch {
            clients.delete(client);
        }
    }
}

/** Start the localhost-only canvas server */
export function startCanvasServer(): void {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        // CORS for localhost only
        res.setHeader("Access-Control-Allow-Origin", "http://localhost:3100");

        if (req.url === "/events") {
            // SSE endpoint for live updates
            res.writeHead(200, {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                Connection: "keep-alive",
            });
            clients.add(res);
            req.on("close", () => clients.delete(res));

            // Send existing widgets
            for (const w of widgets) {
                res.write(`data: ${JSON.stringify(w)}\n\n`);
            }
            return;
        }

        if (req.url === "/" || req.url === "/canvas") {
            // Serve the canvas HTML page
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(CANVAS_HTML);
            return;
        }

        res.writeHead(404);
        res.end("Not found");
    });

    // CRITICAL: bind to localhost only — no external exposure
    server.listen(CANVAS_PORT, "127.0.0.1", () => {
        console.log(`  🎨 Live Canvas: http://localhost:${CANVAS_PORT}/canvas`);
    });
}

// ── Register canvas tool ────────────────────────────────
registerTool({
    schema: {
        type: "function",
        function: {
            name: "push_canvas",
            description:
                "Push an interactive HTML widget to the Live Canvas. The canvas is a local web page where you can display charts, tables, forms, or any interactive HTML content.",
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string", description: "Widget title." },
                    html: {
                        type: "string",
                        description:
                            "HTML content to display. Can include inline CSS and JavaScript.",
                    },
                },
                required: ["title", "html"],
            },
        },
    },
    async execute(input) {
        const widget: CanvasWidget = {
            id: `w-${Date.now()}`,
            type: "html",
            html: input.html as string,
            timestamp: Date.now(),
        };
        pushWidget(widget);
        return `✅ Widget pushed to canvas. View at http://localhost:${CANVAS_PORT}/canvas`;
    },
});

// ── Canvas HTML template ─────────────────────────────────
const CANVAS_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>🪐 Gravity Claw Canvas</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #0a0a0f;
      color: #e4e4e7;
      min-height: 100vh;
    }
    header {
      padding: 20px 30px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-bottom: 1px solid #2a2a4a;
    }
    header h1 {
      font-size: 1.5rem;
      background: linear-gradient(90deg, #a78bfa, #818cf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    header p { color: #71717a; font-size: 0.85rem; margin-top: 4px; }
    #widgets {
      padding: 20px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 16px;
    }
    .widget {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 12px;
      padding: 16px;
      animation: fadeIn 0.3s ease;
    }
    .widget-time {
      font-size: 0.75rem;
      color: #52525b;
      margin-top: 8px;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .empty {
      text-align: center;
      padding: 60px;
      color: #52525b;
    }
  </style>
</head>
<body>
  <header>
    <h1>🪐 Gravity Claw Canvas</h1>
    <p>Live interactive widgets from your AI agent</p>
  </header>
  <div id="widgets">
    <div class="empty" id="empty">Waiting for widgets... Ask Gravity Claw to push something!</div>
  </div>
  <script>
    const container = document.getElementById('widgets');
    const empty = document.getElementById('empty');
    const source = new EventSource('/events');
    source.onmessage = (event) => {
      empty?.remove();
      const widget = JSON.parse(event.data);
      const div = document.createElement('div');
      div.className = 'widget';
      div.innerHTML = widget.html + '<div class="widget-time">' +
        new Date(widget.timestamp).toLocaleString() + '</div>';
      container.prepend(div);
      // Execute any scripts in the widget
      div.querySelectorAll('script').forEach(s => {
        const ns = document.createElement('script');
        ns.textContent = s.textContent;
        document.body.appendChild(ns);
      });
    };
  </script>
</body>
</html>`;

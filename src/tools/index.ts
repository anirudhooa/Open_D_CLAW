// ─────────────────────────────────────────────────────────
// tools/index.ts — Load all tools into the registry
// ─────────────────────────────────────────────────────────

// Each import triggers side-effect registerTool() calls.

// Level 1  — basics
import "./get-current-time.js";

// Level 2  — memory
import "./memory-tools.js";

// Level 4  — tools
import "./shell.js";
import "./files.js";
import "./web-search.js";
import "./browser.js";
import "./scheduler-tools.js";

// Level 4  — knowledge graph (self-registers)
import "../memory/knowledge-graph.js";

// Level 5  — canvas (self-registers)
import "../canvas/server.js";

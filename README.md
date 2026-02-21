# 🪐 Gravity Claw

A lean, secure, fully-understood personal AI agent — built from scratch.

Telegram bot + Claude agentic loop, running locally on your machine.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure secrets
cp .env.example .env
# Edit .env with your real values:
#   TELEGRAM_BOT_TOKEN   — from @BotFather
#   TELEGRAM_ALLOWED_USERS — your Telegram user ID (find via @userinfobot)
#   ANTHROPIC_API_KEY     — from console.anthropic.com

# 3. Run
npm run dev
```

## Project Structure

```
gravity-claw/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Env var loading + validation
│   ├── agent/
│   │   └── loop.ts           # Claude agentic tool-use loop
│   ├── bot/
│   │   └── telegram.ts       # Grammy bot + whitelist middleware
│   └── tools/
│       ├── index.ts           # Barrel — registers all tools
│       ├── registry.ts        # Generic tool registry
│       └── get-current-time.ts
├── .env.example
├── .gitignore
├── package.json
└── tsconfig.json
```

## Security

- **User ID whitelist** — unauthorized messages are silently dropped
- **No web server** — Telegram long-polling only, no exposed ports
- **Secrets in `.env` only** — validated at startup, never logged
- **Max iteration limit** — prevents runaway tool loops

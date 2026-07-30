# 砚灵 InkSpirit

A living AI desktop companion with body, brain, and soul.

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Electron 28 + electron-vite |
| Renderer | React 18 + TypeScript |
| Avatar | PixiJS 8 (future: Live2D / Spine) |
| State | Zustand |
| Database | better-sqlite3 |
| AI Provider | OpenAI (future: Anthropic / DeepSeek / Ollama) |
| Package Manager | pnpm |

## Quick Start

```bash
pnpm install
pnpm dev
```

## Project Structure

```
src/
├── core/           # Shared business logic
│   ├── agent.ts        # Central agent: chat, personality, memory
│   ├── config.ts       # Key-value config persisted in SQLite
│   ├── database.ts     # SQLite schema & singleton
│   ├── utils.ts        # UUID, sleep, clamp
│   └── ai/
│       ├── provider.ts        # AI provider interfaces
│       ├── openaiProvider.ts  # OpenAI streaming client
│       └── promptBuilder.ts   # System prompt from personality/emotion/memory
├── main/           # Electron main process
│   ├── index.ts         # App lifecycle & bootstrap
│   ├── ipcHandlers.ts   # IPC bridge: chat, config, window controls
│   ├── windowManager.ts # Frameless transparent always-on-top window
│   └── trayManager.ts   # System tray & context menu
├── preload/        # Context bridge
│   └── index.ts         # window.inkAPI typed API
└── renderer/       # React frontend
    ├── App.tsx           # Views: avatar / chat / settings
    ├── components/
    │   ├── Avatar.tsx         # PixiJS animated character
    │   ├── ChatBubble.tsx     # Streaming message bubble
    │   └── ChatInput.tsx      # Chat input bar
    └── stores/
        ├── chatStore.ts       # Message list & streaming state
        └── avatarStore.ts     # Current expression
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Build for production |
| `pnpm package` | Build + package installer |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript type check |
| `pnpm test` | Vitest |

## License

Proprietary — all rights reserved.

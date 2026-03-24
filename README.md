# Jimmy TUI

A terminal-based chat interface for Google's Gemini AI, built with [React](https://react.dev/) and [Ink](https://github.com/vadimdemedes/ink). Chat with Gemini directly in your terminal — streaming responses, markdown rendering, and a clean chat-style layout.

```
                                    You:
                                    What's the difference between TCP and UDP?

 Jimmy:
 TCP is connection-oriented, guarantees delivery, and is slower.
 UDP is connectionless, no delivery guarantee, and is faster.

 Use TCP for: web, email, file transfer.
 Use UDP for: video streaming, gaming, DNS.
```

## Features

- **Streaming responses** — text appears in real-time as Gemini generates it
- **Markdown rendering** — headers, lists, tables, code blocks, bold, italic, inline code
- **Chat-style layout** — your messages on the right, AI responses on the left
- **Command history** — arrow keys to navigate previous messages
- **YAML config** — auto-created at `~/.config/jimmy.config.yml` on first run
- **Error handling** — colored error messages for rate limits, timeouts, and network issues
- **API timeout** — 30-second timeout prevents infinite freezes
- **Cross-runtime** — works with both Node.js and Bun

## Quick Start

```bash
# Clone
git clone https://github.com/ZeroNeroIV/Gemini-Simple-TUI.git
cd Gemini-Simple-TUI

# Install + build (npm)
npm install && npm run build

# Or with Bun
bun install && bun run build

# Run
node dist/app.js
# or
bun dist/app.js
```

On first launch, Jimmy creates `~/.config/jimmy.config.yml` and exits:

```
Config created at: /home/you/.config/jimmy.config.yml
Edit it to add your Gemini API key before first use.
```

Edit the config, add your API key, then run again.

## Configuration

Config file: `~/.config/jimmy.config.yml`

```yaml
apiKey: YOUR_GEMINI_API_KEY_HERE
username: You
aiNickname: Jimmy
model: gemini-2.5-flash
systemPrompt: >-
  You are a direct, no-nonsense assistant. Answer immediately — no preamble,
  no filler, no "Sure! Let me help with that." Just give the answer.
  Be concise. Use code blocks when relevant. Skip the pleasantries.
```

| Field | Default | Description |
|-------|---------|-------------|
| `apiKey` | `YOUR_GEMINI_API_KEY_HERE` | Your Google Gemini API key ([get one here](https://aistudio.google.com/apikey)) |
| `username` | `You` | Your display name in the chat |
| `aiNickname` | `Jimmy` | The AI's display name |
| `model` | `gemini-2.5-flash` | Gemini model to use (e.g., `gemini-2.5-flash`, `gemini-2.5-pro`) |
| `systemPrompt` | (direct, no-fluff) | System prompt that controls AI behavior |

All fields are optional — missing fields fall back to defaults.

## Usage

### Global install

```bash
npm link
jimmy
```

### Direct run

```bash
# Node
node dist/app.js

# Bun
bun dist/app.js
```

### Development mode (watch + auto-rebuild)

```bash
npm run dev
# or
bun run dev
```

## Slash Commands

| Command | Aliases | Action |
|---------|---------|--------|
| `/clear` | `/clean`, `/cls` | Clear conversation history |
| `/exit` | `/quit` | Exit the application |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↑` | Previous message in history |
| `↓` | Next message in history |
| `Enter` | Send message |

## Markdown Support

Jimmy renders Gemini's markdown output directly in the terminal:

| Element | Rendered As |
|---------|-------------|
| `# Header` | **Bold colored header** |
| `**bold**` | **Bold text** |
| `*italic*` | *Italic text* |
| `` `code` `` | Cyan inline code |
| ` ```code block``` ` | Bordered code block |
| `- list item` | Bulleted list |
| `1. ordered item` | Numbered list |
| `\| table \|` | Boxed table with auto-sized columns |
| `> blockquote` | Rounded quote block |
| `---` | Horizontal rule |

Tables auto-scale to fit your terminal width. Inline markdown (bold, italic, code) is rendered inside table cells.

## Error Handling

Jimmy detects common failure modes and shows clear error messages in red:

| Error | Message |
|-------|---------|
| Rate limit (429) | `Rate limited — wait a moment and try again.` |
| Timeout (>30s) | `Request timed out after 30s. Check your connection.` |
| Network error | `Network error — check your internet connection.` |
| Other | `Error: <details>` |

## Project Structure

```
.
├── app.tsx          # Main app — UI, chat logic, markdown renderer
├── config.ts        # Config loader — reads/writes ~/.config/jimmy.config.yml
├── tsup.config.ts   # Build config
├── tsconfig.json    # TypeScript config
├── package.json     # Dependencies and scripts
└── dist/
    └── app.js       # Built output (CLI entry point)
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js or Bun |
| UI Framework | [Ink](https://github.com/vadimdemedes/ink) + React 19 |
| AI SDK | [@google/generative-ai](https://github.com/google/generative-ai-js) |
| Config | YAML via [js-yaml](https://github.com/nodeca/js-yaml) |
| Bundler | [tsup](https://github.com/egoist/tsup) |
| Language | TypeScript 5.9 |

## Requirements

- **Node.js** (v18+) or **Bun** (v1.0+)
- **Google Gemini API key** — get one free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

## License

MIT

# Jimmy TUI

A terminal-based chat interface with Google's Gemini AI, built with React and Ink.

## Features

- Chat with Gemini AI directly in your terminal
- Streaming responses with markdown rendering (GFM + syntax highlighting)
- Command history with arrow key navigation
- YAML config file at `~/.config/jimmy.config.yml`
- Simple commands: `/clear`, `/exit`

## Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   # with npm
   npm install

   # or with bun
   bun install
   ```

3. Build:

   ```bash
   # with npm
   npm run build

   # or with bun
   bun run build
   ```

4. On first run, Jimmy auto-creates a config file at `~/.config/jimmy.config.yml`. Edit it to add your Gemini API key:

   ```yaml
   apiKey: your_gemini_api_key_here
   username: You
   aiNickname: Jimmy
   model: gemini-2.5-flash
   systemPrompt: >-
     You are a direct, no-nonsense assistant. Answer immediately.
     No preamble, no filler. Just give the answer.
   ```

## Usage

### As a terminal command

After building, you can run `jimmy` from anywhere:

```bash
npm link
jimmy
```

### Development mode

```bash
# with npm
npm run dev

# or with bun
bun run dev
```

### Direct run

```bash
# with node
node dist/app.js

# or with bun
bun dist/app.js
```

## Commands

- `/clear` (or `/clean`, `/cls`) - Clear the conversation history
- `/exit` (or `/quit`) - Exit the application
- Use arrow keys to navigate command history

## Requirements

- Node.js **or** Bun
- Google Gemini API key

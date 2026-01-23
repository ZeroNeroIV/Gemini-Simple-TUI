# Jimmy TUI

A terminal-based chat interface with Google's Gemini AI, built with React and Ink.

## Features

- Chat with Gemini AI directly in your terminal
- Streaming responses for real-time interaction
- Command history with arrow key navigation
- Simple commands: `/clear`, `/exit`

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with your Gemini API key:
   ```
   GEMINI_KEY=your_api_key_here
   ```

4. Build the project:
   ```bash
   npm run build
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
npm run dev
```

## Commands

- `/clear` - Clear the conversation history
- `/exit` - Exit the application
- Use arrow keys to navigate command history

## Requirements

- Node.js
- Google Gemini API key
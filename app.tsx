#!/usr/bin/env node
import React, { useState, useEffect, useRef } from 'react';
import { render, Box, Text, Static, useInput, useApp } from 'ink';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadConfig } from './config.js';

const config = loadConfig();

const debugLog = (...args: unknown[]) => {
	if (config.debugLogs) {
		console.log(...args);
	}
};

if (config.apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
	console.error('Error: No API key set. Edit ~/.config/jimmy.config.yml and add your Gemini API key.');
	process.exit(1);
}

if (config.debugLogs) {
	console.log(`Jimmy | model=${config.model} user=${config.username} ai=${config.aiNickname}`);
}
const genAI = new GoogleGenerativeAI(config.apiKey);
const model = genAI.getGenerativeModel({ model: config.model });

// ─── Inline markdown parser ──────────────────────────────────────────
// Handles: **bold**, *italic*, `code`
// Returns an array of React <Text> elements (no bare strings).
function renderInline(text: string): React.ReactNode[] {
	const parts: React.ReactNode[] = [];
	let remaining = text;
	let key = 0;

	while (remaining.length > 0) {
		// Bold: **text**
		const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
		// Italic: *text*
		const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
		// Inline code: `text`
		const codeMatch = remaining.match(/`([^`]+)`/);

		// Find the earliest match
		const matches = [
			boldMatch && { type: 'bold' as const, match: boldMatch, index: boldMatch.index! },
			italicMatch && { type: 'italic' as const, match: italicMatch, index: italicMatch.index! },
			codeMatch && { type: 'code' as const, match: codeMatch, index: codeMatch.index! },
		].filter(Boolean) as { type: string; match: RegExpMatchArray; index: number }[];

		if (matches.length === 0) {
			parts.push(<Text key={key++}>{remaining}</Text>);
			break;
		}

		matches.sort((a, b) => a.index - b.index);
		const first = matches[0];

		// Text before the match
		if (first.index > 0) {
			parts.push(<Text key={key++}>{remaining.slice(0, first.index)}</Text>);
		}

		// The matched inline element
		const inner = first.match[1];
		if (first.type === 'bold') {
			parts.push(<Text key={key++} bold>{inner}</Text>);
		} else if (first.type === 'italic') {
			parts.push(<Text key={key++} italic>{inner}</Text>);
		} else {
			parts.push(<Text key={key++} color="cyan">{inner}</Text>);
		}

		remaining = remaining.slice(first.index + first.match[0].length);
	}

	return parts;
}

// ─── Block markdown renderer ─────────────────────────────────────────
// Parses markdown text into blocks and renders each as Ink components.
// Handles: tables, code blocks, headers, lists, blockquotes, horizontal rules, paragraphs.
function renderMd(source: string, maxWidth?: number): React.ReactNode {
	const lines = source.split('\n');
	const blocks: React.ReactNode[] = [];
	let i = 0;
	let key = 0;
	const COLS = maxWidth ?? Math.min((process.stdout.columns || 80) - 4, 60);

	while (i < lines.length) {
		const line = lines[i];

		// Code block: ``` or ```lang
		const codeStart = line.match(/^```/);
		if (codeStart) {
			const langMatch = line.match(/^```\s*(\w+)/);
			const lang = langMatch?.[1]?.trim() || '';
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i].match(/^```/)) {
				codeLines.push(lines[i]);
				i++;
			}
			if (i < lines.length) i++; // skip closing ```
			const maxCodeLen = Math.max(lang.length, ...codeLines.map(l => l.length));
			const codeWidth = Math.min(maxCodeLen + 2, COLS);
			const border = '─'.repeat(codeWidth);
			blocks.push(
				<Box key={key++} flexDirection="column" marginY={1}>
					<Text color="gray">┌{border}┐</Text>
					{lang && (
						<Box flexDirection="row">
							<Text color="gray">│</Text>
							<Text color="gray" dimColor> {lang}{' '.repeat(Math.max(0, codeWidth - lang.length - 1))}</Text>
							<Text color="gray">│</Text>
						</Box>
					)}
					{codeLines.map((cl, ci) => (
						<Box key={ci} flexDirection="row">
							<Text color="gray">│</Text>
							<Text color="cyan"> {cl}{' '.repeat(Math.max(0, codeWidth - cl.length - 1))}</Text>
							<Text color="gray">│</Text>
						</Box>
					))}
					<Text color="gray">└{border}┘</Text>
				</Box>
			);
			continue;
		}

		// Header: # ... ######
		const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
		if (headerMatch) {
			const level = headerMatch[1].length;
			const color = level === 1 ? 'yellow' : level === 2 ? 'green' : undefined;
			blocks.push(
				<Text key={key++} bold color={color}>
					{renderInline(headerMatch[2])}
				</Text>
			);
			i++;
			continue;
		}

		// Horizontal rule: --- or *** or ___
		if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
			blocks.push(<Text key={key++} color="gray">{'─'.repeat(Math.min(40, COLS))}</Text>);
			i++;
			continue;
		}

		// Blockquote: > text
		if (line.startsWith('> ')) {
			const quoteLines: string[] = [];
			while (i < lines.length && lines[i].startsWith('> ')) {
				quoteLines.push(lines[i].slice(2));
				i++;
			}
			blocks.push(
				<Box key={key++} flexDirection="column" borderStyle="round" borderColor="gray" paddingLeft={1}>
					{quoteLines.map((ql, qi) => (
						<Text key={qi} color="gray" italic>{renderInline(ql)}</Text>
					))}
				</Box>
			);
			continue;
		}

		// Unordered list: - item or * item
		if (line.match(/^[-*]\s+/)) {
			const items: string[] = [];
			while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
				items.push(lines[i].replace(/^[-*]\s+/, ''));
				i++;
			}
			blocks.push(
				<Box key={key++} flexDirection="column">
					{items.map((item, li) => (
						<Text key={li}>  • {renderInline(item)}</Text>
					))}
				</Box>
			);
			continue;
		}

		// Ordered list: 1. item
		if (line.match(/^\d+\.\s+/)) {
			const items: string[] = [];
			const nums: number[] = [];
			while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
				const numMatch = lines[i].match(/^(\d+)\.\s+/);
				nums.push(parseInt(numMatch![1]));
				items.push(lines[i].replace(/^\d+\.\s+/, ''));
				i++;
			}
			blocks.push(
				<Box key={key++} flexDirection="column">
					{items.map((item, li) => {
						const prefix = `${nums[li]}. `;
						return (
							<Text key={li}>  {prefix}{renderInline(item)}</Text>
						);
					})}
				</Box>
			);
			continue;
		}

		// Table: | col1 | col2 |
		if (line.match(/^\|/)) {
			const tableLines: string[] = [];
			while (i < lines.length && lines[i].match(/^\|/)) {
				tableLines.push(lines[i]);
				i++;
			}

			const parseRow = (row: string) =>
				row.split('|').slice(1, -1).map(cell => cell.trim());

			const isSep = (row: string) =>
				row.replace(/[|\-:\s]/g, '') === '';

			const headerRow = parseRow(tableLines[0]);
			const dataRows = tableLines
				.slice(1)
				.filter(r => !isSep(r))
				.map(parseRow);

			const numCols = headerRow.length;

			// Calculate ideal column widths from content
			const idealWidths = headerRow.map(h => h.length);
			for (const row of dataRows) {
				for (let c = 0; c < numCols; c++) {
					idealWidths[c] = Math.max(idealWidths[c], (row[c] || '').length);
				}
			}

			// Cap to fit terminal width: borders + separators + padding
			const overhead = (numCols - 1) * 3 + 4; // " │ " between cols + "│ " start + " │" end
			let totalWidth = idealWidths.reduce((a, b) => a + b, 0) + overhead;
			const colWidths = [...idealWidths];
			if (totalWidth > COLS) {
				const available = COLS - overhead;
				const totalIdeal = idealWidths.reduce((a, b) => a + b, 0);
				for (let c = 0; c < numCols; c++) {
					colWidths[c] = Math.max(6, Math.floor(idealWidths[c] * available / totalIdeal));
				}
				totalWidth = colWidths.reduce((a, b) => a + b, 0) + overhead;
			}

			const pad = (s: string, w: number) => s.length > w ? s.slice(0, w - 1) + '…' : s + ' '.repeat(w - s.length);
			const border = '─'.repeat(totalWidth);

			const renderRow = (cells: string[], isHeader: boolean) => (
				<Box key={key++} flexDirection="row">
					<Text color="gray">│ </Text>
					{cells.map((cell, ci) => (
						<React.Fragment key={ci}>
							{ci > 0 && <Text color="gray"> │ </Text>}
							{isHeader
								? <Text bold>{renderInline(pad(cell, colWidths[ci]))}</Text>
								: <Text>{renderInline(pad(cell, colWidths[ci]))}</Text>
							}
						</React.Fragment>
					))}
					<Text color="gray"> │</Text>
				</Box>
			);

			blocks.push(
				<Box key={key++} flexDirection="column" marginY={1}>
					<Text color="gray">┌{border}┐</Text>
					{renderRow(headerRow, true)}
					<Text color="gray">├{border}┤</Text>
					{dataRows.map((row, ri) => renderRow(row, false))}
					<Text color="gray">└{border}┘</Text>
				</Box>
			);
			continue;
		}

		// Empty line → blank spacer
		if (line.trim() === '') {
			i++;
			continue;
		}

		// Regular paragraph: collect consecutive non-empty, non-special lines
		const paraLines: string[] = [];
		while (
			i < lines.length &&
			lines[i].trim() !== '' &&
			!lines[i].match(/^```/) &&
			!lines[i].match(/^#{1,6}\s/) &&
			!lines[i].match(/^(-{3,}|\*{3,}|_{3,})$/) &&
			!lines[i].startsWith('> ') &&
			!lines[i].match(/^[-*]\s+/) &&
			!lines[i].match(/^\d+\.\s+/) &&
			!lines[i].match(/^\|/)
		) {
			paraLines.push(lines[i]);
			i++;
		}
		if (paraLines.length > 0) {
			blocks.push(
				<Text key={key++}>{renderInline(paraLines.join(' '))}</Text>
			);
		}
	}

	return <Box flexDirection="column">{blocks}</Box>;
}

// ─── Spinner frames ──────────────────────────────────────────────────
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// ─── Available commands ──────────────────────────────────────────────
const COMMANDS = [
	{ cmd: '/clear', desc: 'Clear chat history' },
	{ cmd: '/clean', desc: 'Clear chat history' },
	{ cmd: '/cls', desc: 'Clear chat history' },
	{ cmd: '/exit', desc: 'Exit Jimmy' },
	{ cmd: '/quit', desc: 'Exit Jimmy' },
];

// ─── Types ───────────────────────────────────────────────────────────
type Message = {
	id: string;
	role: 'user' | 'model';
	text: string;
	isError?: boolean;
};

// ─── Command Menu Component ──────────────────────────────────────────
function CommandMenu({
	filter,
	selectedIndex,
}: {
	filter: string;
	selectedIndex: number;
}) {
	const filtered = COMMANDS.filter(c => c.cmd.startsWith(filter));
	if (filtered.length === 0) return null;

	return (
		<Box flexDirection="column" borderStyle="round" borderColor="cyan" marginTop={0}>
			{filtered.map((item, i) => (
				<Box key={item.cmd} flexDirection="row">
					<Text color={i === selectedIndex ? 'black' : 'cyan'}
						backgroundColor={i === selectedIndex ? 'cyan' : undefined}
						bold={i === selectedIndex}
					>
						{' '}{item.cmd.padEnd(8)}{' '}
					</Text>
					<Text color={i === selectedIndex ? 'white' : 'gray'}
						backgroundColor={i === selectedIndex ? 'cyan' : undefined}
					>
						{item.desc}
					</Text>
				</Box>
			))}
		</Box>
	);
}

// ─── Custom Input Component ──────────────────────────────────────────
function ChatInput({
	value,
	onChange,
	onSubmit,
	isLoading,
	onCommandMenuChange,
}: {
	value: string;
	onChange: (val: string) => void;
	onSubmit: (val: string) => void;
	isLoading: boolean;
	onCommandMenuChange: (open: boolean) => void;
}) {
	const [cursorPos, setCursorPos] = useState(value.length);
	const [showCursor, setShowCursor] = useState(true);
	const [commandMenuOpen, setCommandMenuOpen] = useState(false);
	const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
	const prevValue = useRef(value);
	const userEdited = useRef(false);

	// Keep cursor in sync when value changes EXTERNALLY (e.g. arrow key history).
	// Skip sync when the change came from user input (typing, backspace, delete, etc).
	if (value !== prevValue.current) {
		const wasUserEdit = userEdited.current;
		userEdited.current = false;
		prevValue.current = value;

		if (!wasUserEdit) {
			// External change → snap cursor to end
			if (cursorPos !== value.length) {
				setCursorPos(value.length);
			}
		}

		// Update command menu state based on new value
		const isCommand = value.startsWith('/');
		if (isCommand !== commandMenuOpen) {
			setCommandMenuOpen(isCommand);
			setSelectedCommandIndex(0);
			onCommandMenuChange(isCommand);
		}
	}

	// Blinking cursor
	useEffect(() => {
		const timer = setInterval(() => setShowCursor(v => !v), 530);
		return () => clearInterval(timer);
	}, []);

	// Reset blink on input
	useEffect(() => {
		setShowCursor(true);
	}, [value, cursorPos]);

	// Filtered commands for current input
	const filteredCommands = COMMANDS.filter(c => c.cmd.startsWith(value));

	useInput((input, key) => {
		if (isLoading) return;

		// ── Command menu navigation ──
		if (commandMenuOpen && filteredCommands.length > 0) {
			if (key.upArrow) {
				setSelectedCommandIndex(i =>
					(i - 1 + filteredCommands.length) % filteredCommands.length
				);
				return;
			}
			if (key.downArrow) {
				setSelectedCommandIndex(i =>
					(i + 1) % filteredCommands.length
				);
				return;
			}
			if (key.return) {
				const cmd = filteredCommands[selectedCommandIndex]?.cmd;
				if (cmd) {
					userEdited.current = true;
					onChange(cmd);
					setCommandMenuOpen(false);
					setSelectedCommandIndex(0);
					onCommandMenuChange(false);
					onSubmit(cmd);
				}
				return;
			}
			if (key.escape) {
				setCommandMenuOpen(false);
				setSelectedCommandIndex(0);
				onCommandMenuChange(false);
				return;
			}
		}

		// ── Submit ──
		if (key.return) {
			onSubmit(value);
			return;
		}

		// ── Ctrl+C → quit ──
		if (key.ctrl && input === 'c') {
			process.exit(0);
		}

		// ── Ctrl+Shift+C → copy ──
		if (key.ctrl && key.shift && input === 'C') {
			if (value) {
				import('clipboardy').then(m => m.default.writeSync(value)).catch(() => {});
			}
			return;
		}

		// ── Ctrl+Shift+V / Ctrl+V → paste ──
		if (key.ctrl && (key.shift && input === 'V' || input === 'v' && !key.shift)) {
			import('clipboardy').then(m => {
				try {
					const text = m.default.readSync();
					if (text) {
						userEdited.current = true;
						const newValue = value.slice(0, cursorPos) + text + value.slice(cursorPos);
						onChange(newValue);
						setCursorPos(cursorPos + text.length);
					}
				} catch {}
			}).catch(() => {});
			return;
		}

		// ── Ctrl+A → move cursor to start ──
		if (key.ctrl && input === 'a') {
			setCursorPos(0);
			return;
		}

		// ── Ctrl+E → move cursor to end ──
		if (key.ctrl && input === 'e') {
			setCursorPos(value.length);
			return;
		}

		// ── Ctrl+U → clear everything left of cursor ──
		if (key.ctrl && input === 'u') {
			userEdited.current = true;
			const newValue = value.slice(cursorPos);
			onChange(newValue);
			setCursorPos(0);
			return;
		}

		// ── Ctrl+K → clear everything right of cursor ──
		if (key.ctrl && input === 'k') {
			userEdited.current = true;
			const newValue = value.slice(0, cursorPos);
			onChange(newValue);
			return;
		}

		// ── Ctrl+W → delete word left ──
		if (key.ctrl && input === 'w') {
			const before = value.slice(0, cursorPos);
			const trimmed = before.trimEnd();
			const lastSpace = trimmed.lastIndexOf(' ');
			const newBefore = lastSpace >= 0 ? before.slice(0, lastSpace + 1) : '';
			userEdited.current = true;
			const newValue = newBefore + value.slice(cursorPos);
			onChange(newValue);
			setCursorPos(newBefore.length);
			return;
		}

		// ── Ctrl+Left → jump word left ──
		if (key.ctrl && key.leftArrow) {
			let pos = cursorPos;
			while (pos > 0 && value[pos - 1] === ' ') pos--;
			while (pos > 0 && value[pos - 1] !== ' ') pos--;
			setCursorPos(pos);
			return;
		}

		// ── Ctrl+Right → jump word right ──
		if (key.ctrl && key.rightArrow) {
			let pos = cursorPos;
			while (pos < value.length && value[pos] !== ' ') pos++;
			while (pos < value.length && value[pos] === ' ') pos++;
			setCursorPos(pos);
			return;
		}

		// ── Alt+h / Alt+j / Alt+k / Alt+l (vim-style movement) ──
		if (key.meta && input === 'h') {
			setCursorPos(Math.max(0, cursorPos - 1));
			return;
		}
		if (key.meta && input === 'l') {
			setCursorPos(Math.min(value.length, cursorPos + 1));
			return;
		}
		if (key.meta && input === 'j') {
			// Alt+j → history down (same as Down arrow)
			return; // let parent handle
		}
		if (key.meta && input === 'k') {
			// Alt+k → history up (same as Up arrow)
			return; // let parent handle
		}

		// ── Arrow keys (plain, no modifier) ──
		if (key.leftArrow && !key.ctrl && !key.meta) {
			setCursorPos(Math.max(0, cursorPos - 1));
			return;
		}
		if (key.rightArrow && !key.ctrl && !key.meta) {
			setCursorPos(Math.min(value.length, cursorPos + 1));
			return;
		}

		// ── Home / End ──
		if (key.home) {
			setCursorPos(0);
			return;
		}
		if (key.end) {
			setCursorPos(value.length);
			return;
		}

		// ── Backspace / Delete ──
		const pressedBackspace = key.backspace || input === '\x7f' || input === '\x08';
		const pressedDelete = input === '\x1b[3~' || (key as any).delete || (key.ctrl && input === 'd');

		if (pressedBackspace && !pressedDelete) {
			if (cursorPos > 0) {
				userEdited.current = true;
				const newValue = value.slice(0, cursorPos - 1) + value.slice(cursorPos);
				onChange(newValue);
				setCursorPos(cursorPos - 1);
			}
			return;
		}

		if (pressedDelete && !pressedBackspace) {
			if (cursorPos < value.length) {
				userEdited.current = true;
				const newValue = value.slice(0, cursorPos) + value.slice(cursorPos + 1);
				onChange(newValue);
			}
			return;
		}

		// ── Regular character input ──
		if (input && !key.ctrl && !key.meta && input.length === 1 && input >= ' ') {
			userEdited.current = true;
			const newValue = value.slice(0, cursorPos) + input + value.slice(cursorPos);
			onChange(newValue);
			setCursorPos(cursorPos + 1);

			// Update command menu
			const newIsCommand = newValue.startsWith('/');
			if (newIsCommand !== commandMenuOpen) {
				setCommandMenuOpen(newIsCommand);
				setSelectedCommandIndex(0);
				onCommandMenuChange(newIsCommand);
			}
		}
	});

	const before = value.slice(0, cursorPos);
	const atCursor = value[cursorPos] ?? ' ';
	const after = value.slice(cursorPos + 1);

	return (
		<Box flexDirection="column">
			{commandMenuOpen && filteredCommands.length > 0 && (
				<CommandMenu
					filter={value}
					selectedIndex={selectedCommandIndex}
				/>
			)}
			<Box flexDirection="row">
				{before.length > 0 && <Text>{before}</Text>}
				{showCursor ? (
					<Text inverse>{atCursor}</Text>
				) : (
					<Text>{atCursor}</Text>
				)}
				{after.length > 0 && <Text>{after}</Text>}
			</Box>
			{isLoading && (
				<Text color="yellow" dimColor>  Processing...</Text>
			)}
		</Box>
	);
}

// ─── App ─────────────────────────────────────────────────────────────
const App = () => {
	const { exit } = useApp();
	const [history, setHistory] = useState<Message[]>([]);
	const [currentResponse, setCurrentResponse] = useState('');
	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [chatSession, setChatSession] = useState<any>(null);
	const [historyIndex, setHistoryIndex] = useState(0);
	const [displayHistory, setDisplayHistory] = useState<Message[]>([]);
	const [clearKey, setClearKey] = useState(0);
	const [spinnerFrame, setSpinnerFrame] = useState(0);
	const [commandMenuOpen, setCommandMenuOpen] = useState(false);

	// Message box is width="75%" with padding={1} on the outer box
	const msgWidth = Math.floor((process.stdout.columns || 80) * 0.75) - 2;

	// Spinner animation
	useEffect(() => {
		if (!isLoading) return;
		const timer = setInterval(() => {
			setSpinnerFrame(f => (f + 1) % SPINNER_FRAMES.length);
		}, 80);
		return () => clearInterval(timer);
	}, [isLoading]);

	useEffect(() => {
		const initChat = model.startChat({
			history: [{
				role: 'user',
				parts: [{ text: config.systemPrompt }]
			}, {
				role: 'model',
				parts: [{ text: 'Got it. Direct answers only.' }]
			}]
		});
		setChatSession(initChat);
	}, []);

	const userHistory = displayHistory.filter(h => h.role === 'user').map(h => h.text);

	useInput((input, key) => {
		// Don't handle arrows if command menu is open (ChatInput handles them)
		if (commandMenuOpen) return;

		if (key.upArrow) {
			const newIndex = Math.max(0, historyIndex - 1);
			setHistoryIndex(newIndex);
			setInput(userHistory[newIndex] || '');
		}

		if (key.downArrow) {
			const newIndex = Math.min(userHistory.length, historyIndex + 1);
			setHistoryIndex(newIndex);
			if (newIndex === userHistory.length) {
				setInput('');
			} else {
				setInput(userHistory[newIndex] || '');
			}
		}
	});

	const API_TIMEOUT = 30_000; // 30 seconds

	const send = async (val: string) => {
		if (!val.trim() || isLoading || !chatSession) return;

		// Handle clear commands
		if (val.trim() === '/clear' || val.trim() === '/clean' || val.trim() === '/cls') {
			console.clear();
			setDisplayHistory([]);
			setCurrentResponse('');
			setInput('');
			setClearKey(prev => prev + 1);
			return;
		}

		// Handle exit commands
		if (val.trim() === '/exit' || val.trim() === '/quit') {
			exit();
			return;
		}

		const userMsg: Message = {
			id: Date.now().toString(),
			role: 'user',
			text: val
		};
		const newHistory = [...history, userMsg];
		setHistory(newHistory);
		setDisplayHistory(newHistory);
		setInput('');
		setIsLoading(true);
		setHistoryIndex(newHistory.filter(h => h.role === 'user').length);

		try {
			debugLog('[DEBUG] Sending message...');
			const timeout = new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Request timed out after 30s')), API_TIMEOUT)
			);
			debugLog('[DEBUG] Calling chatSession.sendMessageStream...');
			const result = await Promise.race([
				chatSession.sendMessageStream(val),
				timeout,
			]);
			debugLog('[DEBUG] Got response stream:', typeof result);
			let fullText = '';

			for await (const chunk of result.stream) {
				const chunkText = chunk.text();
				debugLog('[DEBUG] Chunk received:', chunkText?.slice(0, 50) || '(empty)');
				fullText += chunkText;
				setCurrentResponse(fullText);
			}
			debugLog('[DEBUG] Stream complete. Full text length:', fullText.length);

			const updatedHistory = [
				...history,
				userMsg,
				{ id: (Date.now() + 1).toString(), role: 'model' as const, text: fullText }
			];
			setHistory(updatedHistory);
			setDisplayHistory(updatedHistory);
			setCurrentResponse('');
		} catch (e: any) {
			debugLog('[ERROR]', e);
			const msg = e?.message || String(e) || 'Unknown error';
			const isRateLimit = /429|rate.?limit|quota|RESOURCE_EXHAUSTED/i.test(msg);
			const isTimeout = /timed?\s*out/i.test(msg);
			const isNetwork = /network|ECONNREFUSED|ENOTFOUND|fetch failed/i.test(msg);
			const isBlocked = /blocked|forbidden|403|401/i.test(msg);
			const isBadResponse = /bad.?response|invalid.?response|400/i.test(msg);

			let errorText: string;
			if (isRateLimit) {
				errorText = '⚠ Rate limited — wait a moment and try again.';
			} else if (isTimeout) {
				errorText = '⚠ Request timed out after 30s. Check your connection.';
			} else if (isNetwork) {
				errorText = '⚠ Network error — check your internet connection.';
			} else if (isBlocked) {
				errorText = `⚠ Access blocked: ${msg}`;
			} else if (isBadResponse) {
				errorText = `⚠ Bad response: ${msg}`;
			} else {
				errorText = `⚠ Error: ${msg}`;
			}

			const errorHistory = [
				...history,
				{
					id: Date.now().toString(),
					role: 'model' as const,
					text: errorText,
					isError: true,
				}
			];
			setHistory(errorHistory);
			setDisplayHistory(errorHistory);
		}
		setIsLoading(false);
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Static key={clearKey} items={displayHistory}>
				{(msg, index) => (
					<Box
						key={msg.id}
						flexDirection="row"
						justifyContent={msg.role === 'user' ? 'flex-end' : 'flex-start'}
						marginBottom={1}
					>
						<Box flexDirection="column" width="75%">
							<Text
								color={msg.isError ? 'red' : msg.role === 'user' ? 'magenta' : 'green'}
								bold
							>
								{msg.isError ? '⚠ Error' : msg.role === 'user' ? config.username : config.aiNickname}:
							</Text>
							{msg.isError ? (
								<Text color="red">{msg.text}</Text>
							) : msg.role === 'model' ? (
								renderMd(msg.text, msgWidth)
							) : (
								<Text>{msg.text}</Text>
							)}
						</Box>
					</Box>
				)}
			</Static>

			{isLoading && (
				<Box
					flexDirection="row"
					justifyContent="flex-start"
					marginBottom={1}
				>
					<Box flexDirection="column" width="75%">
						<Text color="green" bold>{config.aiNickname}:</Text>
						{currentResponse ? (
							renderMd(currentResponse, msgWidth)
						) : (
							<Text color="yellow">
								{SPINNER_FRAMES[spinnerFrame]} Thinking...
							</Text>
						)}
					</Box>
				</Box>
			)}

			<Box borderStyle="round" borderColor={isLoading ? 'yellow' : commandMenuOpen ? 'cyan' : 'gray'}>
				<Box marginRight={1}>
					<Text color="blue">{'>'}</Text>
				</Box>
				<ChatInput
					value={input}
					onChange={setInput}
					onSubmit={send}
					isLoading={isLoading}
					onCommandMenuChange={setCommandMenuOpen}
				/>
			</Box>
		</Box>
	);
};

render(<App />);

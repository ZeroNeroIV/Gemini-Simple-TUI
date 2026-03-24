#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text, Static, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { loadConfig } from './config.js';

const config = loadConfig();

if (config.apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
	console.error('Error: No API key set. Edit ~/.config/jimmy.config.yml and add your Gemini API key.');
	process.exit(1);
}

console.log(`Jimmy | model=${config.model} user=${config.username} ai=${config.aiNickname}`);
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
		const codeStart = line.match(/^```\s*(.*)?$/);
		if (codeStart) {
			const lang = codeStart[1]?.trim() || '';
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i].match(/^```\s*$/)) {
				codeLines.push(lines[i]);
				i++;
			}
			i++; // skip closing ```
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

// ─── Types ───────────────────────────────────────────────────────────
type Message = {
	id: string;
	role: 'user' | 'model';
	text: string;
};

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

	// Message box is width="75%" with padding={1} on the outer box
	const msgWidth = Math.floor((process.stdout.columns || 80) * 0.75) - 2;

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
			const timeout = new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Request timed out after 30s')), API_TIMEOUT)
			);
			const result = await Promise.race([
				chatSession.sendMessageStream(val),
				timeout,
			]);
			let fullText = '';

			for await (const chunk of result.stream) {
				const chunkText = chunk.text();
				fullText += chunkText;
				setCurrentResponse(fullText);
			}

			const updatedHistory = [
				...history,
				userMsg,
				{ id: (Date.now() + 1).toString(), role: 'model' as const, text: fullText }
			];
			setHistory(updatedHistory);
			setDisplayHistory(updatedHistory);
			setCurrentResponse('');
		} catch (e: any) {
			const errorHistory = [
				...history,
				{
					id: Date.now().toString(),
					role: 'model' as const,
					text: `Error: ${e.message || 'Unknown error'}`
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
								color={msg.role === 'user' ? 'magenta' : 'green'}
								bold
							>
								{msg.role === 'user' ? config.username : config.aiNickname}:
							</Text>
							{msg.role === 'model' ? (
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
						{renderMd(currentResponse, msgWidth)}
					</Box>
				</Box>
			)}

			<Box borderStyle="round" borderColor={isLoading ? 'yellow' : 'gray'}>
				<Box marginRight={1}>
					<Text color="blue">{'>'}</Text>
				</Box>
				<TextInput
					value={input}
					onChange={setInput}
					onSubmit={send}
				/>
			</Box>
		</Box>
	);
};

render(<App />);

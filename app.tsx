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
// Handles: code blocks, headers, lists, blockquotes, horizontal rules, paragraphs.
function renderMd(source: string): React.ReactNode {
	const lines = source.split('\n');
	const blocks: React.ReactNode[] = [];
	let i = 0;
	let key = 0;

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
			blocks.push(
				<Box key={key++} flexDirection="column" marginY={1} borderStyle="single" borderColor="gray" paddingLeft={1} paddingRight={1}>
					{lang && <Text color="gray" dimColor>{lang}</Text>}
					{codeLines.map((cl, ci) => (
						<Text key={ci} color="cyan">{cl}</Text>
					))}
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
					{headerMatch[2]}
				</Text>
			);
			i++;
			continue;
		}

		// Horizontal rule: --- or *** or ___
		if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
			blocks.push(<Text key={key++} color="gray">{'─'.repeat(40)}</Text>);
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
					{items.map((item, li) => (
						<Text key={li}>  {nums[li]}. {renderInline(item)}</Text>
					))}
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
			!lines[i].match(/^\d+\.\s+/)
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
			const result = await chatSession.sendMessageStream(val);
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
								renderMd(msg.text)
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
						{renderMd(currentResponse)}
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

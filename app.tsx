#!/usr/bin/env node
import React, { useState, useEffect } from 'react';
import { render, Box, Text, Static, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { loadConfig } from './config.js';

const config = loadConfig();

if (config.apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
	console.error('Error: No API key set. Edit ~/.config/jimmy.config.yml and add your Gemini API key.');
	process.exit(1);
}

console.log(`Jimmy | model=${config.model} user=${config.username} ai=${config.aiNickname}`);
const genAI = new GoogleGenerativeAI(config.apiKey);
const model = genAI.getGenerativeModel({ model: config.model });

// Map markdown elements to Ink components — ReactMarkdown renders HTML tags
// but Ink only understands <Text> and <Box>. Without this, raw text nodes
// crash with "Text string must be rendered inside <Text> component".
const md = {
	p: ({ children }: any) => <Text>{children}</Text>,
	h1: ({ children }: any) => <Text bold>{children}</Text>,
	h2: ({ children }: any) => <Text bold>{children}</Text>,
	h3: ({ children }: any) => <Text bold>{children}</Text>,
	h4: ({ children }: any) => <Text bold>{children}</Text>,
	h5: ({ children }: any) => <Text bold>{children}</Text>,
	h6: ({ children }: any) => <Text bold>{children}</Text>,
	li: ({ children }: any) => <Text>{children}</Text>,
	span: ({ children }: any) => <Text>{children}</Text>,
	strong: ({ children }: any) => <Text bold>{children}</Text>,
	em: ({ children }: any) => <Text italic>{children}</Text>,
	code: ({ children }: any) => <Text color="cyan">{children}</Text>,
	pre: ({ children }: any) => <Box flexDirection="column">{children}</Box>,
	blockquote: ({ children }: any) => <Text color="gray">{children}</Text>,
	a: ({ children }: any) => <Text color="blue" underline>{children}</Text>,
	ul: ({ children }: any) => <Box flexDirection="column">{children}</Box>,
	ol: ({ children }: any) => <Box flexDirection="column">{children}</Box>,
	table: ({ children }: any) => <Box flexDirection="column">{children}</Box>,
	thead: ({ children }: any) => <Box flexDirection="column">{children}</Box>,
	tbody: ({ children }: any) => <Box flexDirection="column">{children}</Box>,
	tr: ({ children }: any) => <Text>{children}</Text>,
	th: ({ children }: any) => <Text bold>{children}</Text>,
	td: ({ children }: any) => <Text>{children}</Text>,
	img: ({ alt }: any) => <Text color="gray">[Image: {alt || 'no alt'}]</Text>,
	hr: () => <Text color="gray">{'─'.repeat(40)}</Text>,
};

type Message = {
	id: string;
	role: 'user' | 'model';
	text: string;
};

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
		console.log('send called with:', JSON.stringify(val));
		if (!val.trim() || isLoading || !chatSession) return;

		// Handle clear commands
		if (val.trim() === '/clear' || val.trim() === '/clean' || val.trim() === '/cls') {
			console.log('Clear command detected!');
			console.clear(); // Clear the terminal
			setDisplayHistory([]);
			setCurrentResponse('');
			setInput('');
			setClearKey(prev => prev + 1);
			return;
		}

		// Handle exit commands
		if (val.trim() === '/exit' || val.trim() === '/quit') {
			console.log('Goodbye!');
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
    			// This will print the full error details to your terminal window where you ran the command
    			console.error("DEBUG ERROR:", JSON.stringify(e, null, 2));

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
						flexDirection="column"
						marginBottom={1}
						alignSelf={msg.role === 'user' ? 'flex-end' : 'flex-start'}
						width="75%"
					>
						<Text
							color={msg.role === 'user' ? 'magenta' : 'green'}
							bold
						>
							{msg.role === 'user' ? config.username : config.aiNickname}:
						</Text>
						{msg.role === 'model' ? (
							<ReactMarkdown components={md} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
								{msg.text}
							</ReactMarkdown>
						) : (
							<Text>{msg.text}</Text>
						)}
					</Box>
				)}
			</Static>

			{isLoading && (
				<Box
					flexDirection="column"
					marginBottom={1}
					alignSelf="flex-start"
					width="75%"
				>
					<Text color="green" bold>{config.aiNickname}:</Text>
					<ReactMarkdown components={md} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
						{currentResponse}
					</ReactMarkdown>
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

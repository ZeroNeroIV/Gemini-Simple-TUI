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

// Recursively walk React children and wrap any bare strings in <Text>.
// ReactMarkdown produces raw string nodes that crash Ink's reconciler.
function wrapText(children: React.ReactNode): React.ReactNode {
	return React.Children.map(children, (child) => {
		if (typeof child === 'string' || typeof child === 'number') {
			const s = String(child);
			// Drop whitespace-only nodes (newlines + indentation between blocks)
			if (!s.trim()) return null;
			return <Text>{s}</Text>;
		}
		if (React.isValidElement(child) && (child.props as any)?.children) {
			return React.cloneElement(child as React.ReactElement<any>, {
				children: wrapText((child.props as any).children),
			});
		}
		return child;
	});
}

// Component wrappers for ReactMarkdown — each wraps its children through
// wrapText so that every bare string ends up inside an Ink <Text>.
const md = {
	p: ({ children }: any) => <Text>{wrapText(children)}</Text>,
	h1: ({ children }: any) => <Text bold>{wrapText(children)}</Text>,
	h2: ({ children }: any) => <Text bold>{wrapText(children)}</Text>,
	h3: ({ children }: any) => <Text bold>{wrapText(children)}</Text>,
	h4: ({ children }: any) => <Text bold>{wrapText(children)}</Text>,
	h5: ({ children }: any) => <Text bold>{wrapText(children)}</Text>,
	h6: ({ children }: any) => <Text bold>{wrapText(children)}</Text>,
	li: ({ children }: any) => <Text>{wrapText(children)}</Text>,
	span: ({ children }: any) => <Text>{wrapText(children)}</Text>,
	strong: ({ children }: any) => <Text bold>{wrapText(children)}</Text>,
	em: ({ children }: any) => <Text italic>{wrapText(children)}</Text>,
	code: ({ children }: any) => <Text color="cyan">{wrapText(children)}</Text>,
	pre: ({ children }: any) => <Box flexDirection="column">{wrapText(children)}</Box>,
	blockquote: ({ children }: any) => <Text color="gray">{wrapText(children)}</Text>,
	a: ({ children }: any) => <Text color="blue" underline>{wrapText(children)}</Text>,
	ul: ({ children }: any) => <Box flexDirection="column">{wrapText(children)}</Box>,
	ol: ({ children }: any) => <Box flexDirection="column">{wrapText(children)}</Box>,
	table: ({ children }: any) => <Box flexDirection="column">{wrapText(children)}</Box>,
	thead: ({ children }: any) => <Box flexDirection="column">{wrapText(children)}</Box>,
	tbody: ({ children }: any) => <Box flexDirection="column">{wrapText(children)}</Box>,
	tr: ({ children }: any) => <Text>{wrapText(children)}</Text>,
	th: ({ children }: any) => <Text bold>{wrapText(children)}</Text>,
	td: ({ children }: any) => <Text>{wrapText(children)}</Text>,
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
								<ReactMarkdown components={md} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
									{msg.text}
								</ReactMarkdown>
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
						<ReactMarkdown components={md} remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
							{currentResponse}
						</ReactMarkdown>
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

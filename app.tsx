#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import dotenv from 'dotenv';

// Get the directory of the current file (dist/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tell dotenv to look one folder up (in the root)
dotenv.config({ path: resolve(__dirname, './.env') });
console.log('Current Dir:', process.cwd());
console.log('Key Status:', process.env.GEMINI_KEY ? 'Loaded ✅' : 'Missing ❌');
import React, { useState, useEffect } from 'react';
import { render, Box, Text, Static, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { GoogleGenerativeAI } from '@google/generative-ai';


const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

const USERNAME = 'ZeroNeroIV';
const AI_NICKNAME = 'Jimmy';

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
		const systemPrompt = "You are a helpful AI assistant. Always provide short, concise, and accurate answers. Be direct and to the point. Avoid unnecessary elaboration unless specifically asked for more detail.";
		const initChat = model.startChat({ 
			history: [{
				role: 'user',
				parts: [{ text: systemPrompt }]
			}, {
				role: 'model', 
				parts: [{ text: 'Understood. I will provide short, concise, and accurate answers.' }]
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
					<Box key={msg.id} flexDirection="column" marginBottom={1}>
						<Text color={msg.role === 'user' ? 'magenta' : 'green'} bold>
							{msg.role === 'user' ? USERNAME : AI_NICKNAME}:
						</Text>
						<Text>{msg.text}</Text>
					</Box>
				)}
			</Static>

			{isLoading && (
				<Box flexDirection="column" marginBottom={1}>
					<Text color="green" bold>{AI_NICKNAME}:</Text>
					<Text>{currentResponse}</Text>
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

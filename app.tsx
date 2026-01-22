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
import { render, Box, Text, Static } from 'ink';
import TextInput from 'ink-text-input';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const USERNAME = 'ZeroNeroIV';
const AI_NICKNAME = 'Jimmy';

type Message = {
	id: string;
	role: 'user' | 'model';
	text: string;
};

const App = () => {
	const [history, setHistory] = useState<Message[]>([]);
	const [currentResponse, setCurrentResponse] = useState('');
	const [input, setInput] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [chatSession, setChatSession] = useState<any>(null);

	useEffect(() => {
		const initChat = model.startChat({ history: [] });
		setChatSession(initChat);
	}, []);

	const send = async (val: string) => {
		if (!val.trim() || isLoading || !chatSession) return;

		const userMsg: Message = {
			id: Date.now().toString(),
			role: 'user',
			text: val
		};
		setHistory(prev => [...prev, userMsg]);
		setInput('');
		setIsLoading(true);

		try {
			const result = await chatSession.sendMessageStream(val);
			let fullText = '';

			for await (const chunk of result.stream) {
				const chunkText = chunk.text();
				fullText += chunkText;
				setCurrentResponse(fullText);
			}

			setHistory(prev => [
				...prev,
				{ id: (Date.now() + 1).toString(), role: 'model', text: fullText }
			]);
			setCurrentResponse('');
		} catch (e: any) {
    			// This will print the full error details to your terminal window where you ran the command
    			console.error("DEBUG ERROR:", JSON.stringify(e, null, 2));

    			setHistory(prev => [
        		...prev,
        		{ 
            			id: Date.now().toString(), 
            			role: 'model', 
            			// Show the actual error message in the chat UI
            			text: `Error: ${e.message || 'Unknown error'}` 
			}
                	]);
                }
		setIsLoading(false);
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Static items={history}>
				{(msg, index) => (
					<Box key={index} flexDirection="column" marginBottom={1}>
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

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { homedir } from 'os';
import yaml from 'js-yaml';

export interface JimmyConfig {
	apiKey: string;
	username: string;
	aiNickname: string;
	model: string;
	systemPrompt: string;
}

const DEFAULT_CONFIG: JimmyConfig = {
	apiKey: 'YOUR_GEMINI_API_KEY_HERE',
	username: 'You',
	aiNickname: 'Jimmy',
	model: 'gemini-2.5-flash',
	systemPrompt:
		'You are a direct, no-nonsense assistant. Answer immediately — no preamble, no filler, no "Sure! Let me help with that." Just give the answer. Be concise. Use code blocks when relevant. Skip the pleasantries.',
};

const CONFIG_DIR = resolve(homedir(), '.config');
const CONFIG_PATH = resolve(CONFIG_DIR, 'jimmy.config.yml');

function writeDefaultConfig(): void {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, { recursive: true });
	}

	const yamlStr = yaml.dump(DEFAULT_CONFIG, {
		lineWidth: -1,
		noRefs: true,
		sortKeys: false,
	});
	writeFileSync(CONFIG_PATH, yamlStr, 'utf-8');
}

export function loadConfig(): JimmyConfig {
	if (!existsSync(CONFIG_PATH)) {
		writeDefaultConfig();
		console.log(`Config created at: ${CONFIG_PATH}`);
		console.log('Edit it to add your Gemini API key before first use.\n');
		return DEFAULT_CONFIG;
	}

	try {
		const raw = readFileSync(CONFIG_PATH, 'utf-8');
		const parsed = yaml.load(raw) as Partial<JimmyConfig> | null;

		if (!parsed || typeof parsed !== 'object') {
			console.warn('Warning: config file is empty or invalid, using defaults.');
			return DEFAULT_CONFIG;
		}

		return {
			apiKey: parsed.apiKey ?? DEFAULT_CONFIG.apiKey,
			username: parsed.username ?? DEFAULT_CONFIG.username,
			aiNickname: parsed.aiNickname ?? DEFAULT_CONFIG.aiNickname,
			model: parsed.model ?? DEFAULT_CONFIG.model,
			systemPrompt: parsed.systemPrompt ?? DEFAULT_CONFIG.systemPrompt,
		};
	} catch (err: any) {
		console.warn(`Warning: failed to parse config file: ${err.message}. Using defaults.`);
		return DEFAULT_CONFIG;
	}
}

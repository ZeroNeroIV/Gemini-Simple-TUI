import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';
import yaml from 'js-yaml';

export interface JimmyConfig {
	username: string;
	aiNickname: string;
	model: string;
	systemPrompt: string;
}

const DEFAULT_CONFIG: JimmyConfig = {
	username: 'You',
	aiNickname: 'Jimmy',
	model: 'gemini-2.5-flash-lite',
	systemPrompt:
		'You are a helpful AI assistant. Always provide short, concise, and accurate answers. Be direct and to the point. Avoid unnecessary elaboration unless specifically asked for more detail.',
};

const CONFIG_PATH = resolve(homedir(), '.config', 'jimmy.config.yml');

export function loadConfig(): JimmyConfig {
	if (!existsSync(CONFIG_PATH)) {
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

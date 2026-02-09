/** Cost breakdown for a single LLM request (USD) */
export interface CostBreakdown {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	total: number;
}

/** Token usage for a single LLM request */
export interface Usage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	cost: CostBreakdown;
}

/** A pi session log line with type "message" and role "assistant" */
export interface AssistantMessage {
	type: "message";
	id: string;
	parentId: string | null;
	timestamp: string;
	message: {
		role: "assistant";
		content: unknown[];
		api: string;
		provider: string;
		model: string;
		usage: Usage;
	};
}

/** A pi session log line with type "session" */
export interface SessionHeader {
	type: "session";
	version: number;
	id: string;
	timestamp: string;
	cwd: string;
}

/** Any log line we care about */
export type LogLine = AssistantMessage | SessionHeader | { type: string };

/** Aggregated stats for a group of requests */
export interface Stats {
	totalCost: number;
	costInput: number;
	costOutput: number;
	costCacheRead: number;
	costCacheWrite: number;
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	requests: number;
	/** model -> { requests, cost } */
	models: Map<string, { requests: number; cost: number }>;
}

/** CLI options */
export interface Options {
	days: number;
	projectFilter: string;
	showSessions: boolean;
	showDaily: boolean;
	sessionsDir: string;
}

/** A parsed session with its metadata */
export interface SessionInfo {
	filepath: string;
	project: string;
	timestamp: Date;
}

/** A row in the sessions table */
export interface SessionRow {
	time: string;
	project: string;
	requests: number;
	cost: number;
	inputTokens: number;
	outputTokens: number;
	models: string;
}

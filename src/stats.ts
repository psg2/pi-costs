import type { Stats, Usage } from "./types";

export function createStats(): Stats {
	return {
		totalCost: 0,
		costInput: 0,
		costOutput: 0,
		costCacheRead: 0,
		costCacheWrite: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		requests: 0,
		models: new Map(),
	};
}

export function addUsage(stats: Stats, usage: Usage, model: string): void {
	const cost = usage.cost ?? {};
	const total = cost.total ?? 0;

	stats.totalCost += total;
	stats.costInput += cost.input ?? 0;
	stats.costOutput += cost.output ?? 0;
	stats.costCacheRead += cost.cacheRead ?? 0;
	stats.costCacheWrite += cost.cacheWrite ?? 0;
	stats.inputTokens += usage.input ?? 0;
	stats.outputTokens += usage.output ?? 0;
	stats.cacheReadTokens += usage.cacheRead ?? 0;
	stats.cacheWriteTokens += usage.cacheWrite ?? 0;
	stats.requests += 1;

	const entry = stats.models.get(model) ?? { requests: 0, cost: 0 };
	entry.requests += 1;
	entry.cost += total;
	stats.models.set(model, entry);
}

export function mergeStats(target: Stats, source: Stats): void {
	target.totalCost += source.totalCost;
	target.costInput += source.costInput;
	target.costOutput += source.costOutput;
	target.costCacheRead += source.costCacheRead;
	target.costCacheWrite += source.costCacheWrite;
	target.inputTokens += source.inputTokens;
	target.outputTokens += source.outputTokens;
	target.cacheReadTokens += source.cacheReadTokens;
	target.cacheWriteTokens += source.cacheWriteTokens;
	target.requests += source.requests;

	for (const [model, { requests, cost }] of source.models) {
		const entry = target.models.get(model) ?? { requests: 0, cost: 0 };
		entry.requests += requests;
		entry.cost += cost;
		target.models.set(model, entry);
	}
}

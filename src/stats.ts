import { computeCost, lookupPricing } from "./pricing";
import type { PricingTable } from "./pricing";
import type { ModelEntry, Stats, Usage } from "./types";

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

export function addUsage(
	stats: Stats,
	usage: Usage,
	model: string,
	pricing?: PricingTable,
): void {
	let cost = usage.cost ?? {};
	let total = cost.total ?? 0;

	// When API response has no cost (e.g. GitHub Copilot provider), compute from pricing table
	if (total === 0 && pricing) {
		const p = lookupPricing(model, pricing);
		if (p) {
			const computed = computeCost(
				usage.input ?? 0,
				usage.output ?? 0,
				usage.cacheRead ?? 0,
				usage.cacheWrite ?? 0,
				p,
			);
			cost = computed;
			total = computed.total;
		}
	}

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

	const entry = stats.models.get(model) ?? {
		requests: 0,
		cost: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
	};
	entry.requests += 1;
	entry.cost += total;
	entry.inputTokens += usage.input ?? 0;
	entry.outputTokens += usage.output ?? 0;
	entry.cacheReadTokens += usage.cacheRead ?? 0;
	entry.cacheWriteTokens += usage.cacheWrite ?? 0;
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

	for (const [model, src] of source.models) {
		const entry = target.models.get(model) ?? {
			requests: 0,
			cost: 0,
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
		};
		entry.requests += src.requests;
		entry.cost += src.cost;
		entry.inputTokens += src.inputTokens;
		entry.outputTokens += src.outputTokens;
		entry.cacheReadTokens += src.cacheReadTokens;
		entry.cacheWriteTokens += src.cacheWriteTokens;
		target.models.set(model, entry);
	}
}

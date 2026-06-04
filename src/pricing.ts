import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Per-million-token prices for a model (USD) */
export interface ModelPricing {
	/** Input tokens per 1M */
	input: number;
	/** Cached input tokens per 1M */
	cachedInput: number;
	/** Cache write tokens per 1M (Anthropic only; 0 for others) */
	cacheWrite: number;
	/** Output tokens per 1M */
	output: number;
}

/** Map of model name → pricing. Keys are lowercased for matching. */
export type PricingTable = Record<string, ModelPricing>;

/**
 * GitHub Copilot pricing as of 2026-06 (per 1M tokens, USD).
 * Source: https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing#pricing-tables
 */
export const GITHUB_COPILOT_PRICING: PricingTable = {
	// Anthropic
	"claude-haiku-4.5": { input: 1.0, cachedInput: 0.1, cacheWrite: 1.25, output: 5.0 },
	"claude-sonnet-4": { input: 3.0, cachedInput: 0.3, cacheWrite: 3.75, output: 15.0 },
	"claude-sonnet-4.5": { input: 3.0, cachedInput: 0.3, cacheWrite: 3.75, output: 15.0 },
	"claude-sonnet-4.6": { input: 3.0, cachedInput: 0.3, cacheWrite: 3.75, output: 15.0 },
	"claude-opus-4.5": { input: 5.0, cachedInput: 0.5, cacheWrite: 6.25, output: 25.0 },
	"claude-opus-4.6": { input: 5.0, cachedInput: 0.5, cacheWrite: 6.25, output: 25.0 },
	"claude-opus-4.7": { input: 5.0, cachedInput: 0.5, cacheWrite: 6.25, output: 25.0 },
	"claude-opus-4.8": { input: 5.0, cachedInput: 0.5, cacheWrite: 6.25, output: 25.0 },
	// OpenAI
	"gpt-4.1": { input: 2.0, cachedInput: 0.5, cacheWrite: 0, output: 8.0 },
	"gpt-5-mini": { input: 0.25, cachedInput: 0.025, cacheWrite: 0, output: 2.0 },
	"gpt-5.2": { input: 1.75, cachedInput: 0.175, cacheWrite: 0, output: 14.0 },
	"gpt-5.2-codex": { input: 1.75, cachedInput: 0.175, cacheWrite: 0, output: 14.0 },
	"gpt-5.3-codex": { input: 1.75, cachedInput: 0.175, cacheWrite: 0, output: 14.0 },
	"gpt-5.4": { input: 2.5, cachedInput: 0.25, cacheWrite: 0, output: 15.0 },
	"gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, cacheWrite: 0, output: 4.5 },
	"gpt-5.4-nano": { input: 0.2, cachedInput: 0.02, cacheWrite: 0, output: 1.25 },
	"gpt-5.5": { input: 5.0, cachedInput: 0.5, cacheWrite: 0, output: 30.0 },
	// Google
	"gemini-2.5-pro": { input: 1.25, cachedInput: 0.125, cacheWrite: 0, output: 10.0 },
	"gemini-3-flash": { input: 0.5, cachedInput: 0.05, cacheWrite: 0, output: 3.0 },
	"gemini-3.1-pro": { input: 2.0, cachedInput: 0.2, cacheWrite: 0, output: 12.0 },
	"gemini-3.5-flash": { input: 1.5, cachedInput: 0.15, cacheWrite: 0, output: 9.0 },
	// Fine-tuned (GitHub)
	"raptor-mini": { input: 0.25, cachedInput: 0.025, cacheWrite: 0, output: 2.0 },
};

const DEFAULT_PRICING_PATH = join(homedir(), ".pi", "pi-costs-pricing.json");

/**
 * Load pricing: start with GitHub Copilot defaults, then merge any overrides
 * from the given path (or ~/.pi/pi-costs-pricing.json if none specified).
 *
 * Override JSON format: Record<modelName, ModelPricing>
 * Example:
 * {
 *   "my-custom-model": { "input": 1.0, "cachedInput": 0.1, "cacheWrite": 0, "output": 5.0 }
 * }
 */
export function loadPricing(overridePath?: string): PricingTable {
	const table: PricingTable = { ...GITHUB_COPILOT_PRICING };

	const path = overridePath ?? (existsSync(DEFAULT_PRICING_PATH) ? DEFAULT_PRICING_PATH : null);
	if (!path) return table;

	try {
		const raw = readFileSync(path, "utf-8");
		const overrides = JSON.parse(raw) as PricingTable;
		for (const [model, pricing] of Object.entries(overrides)) {
			table[model.toLowerCase()] = pricing;
		}
	} catch (err) {
		console.error(`Warning: could not load pricing file '${path}': ${(err as Error).message}`);
	}

	return table;
}

/**
 * Look up pricing for a model. Tries exact match then prefix match
 * (e.g. "claude-sonnet-4.6-20250514" → "claude-sonnet-4.6").
 */
export function lookupPricing(model: string, table: PricingTable): ModelPricing | null {
	const key = model.toLowerCase();
	if (table[key]) return table[key];

	// Try progressively shorter prefixes by stripping trailing segments
	const parts = key.split(/[-./]/);
	for (let len = parts.length - 1; len >= 2; len--) {
		// Try joining with both - and .
		const dash = parts.slice(0, len).join("-");
		const dot = parts.slice(0, len).join(".");
		if (table[dash]) return table[dash];
		if (table[dot]) return table[dot];
	}

	return null;
}

/** Compute cost breakdown from token counts and pricing (returns USD amounts) */
export function computeCost(
	inputTokens: number,
	outputTokens: number,
	cacheReadTokens: number,
	cacheWriteTokens: number,
	pricing: ModelPricing,
): { input: number; output: number; cacheRead: number; cacheWrite: number; total: number } {
	const M = 1_000_000;
	const input = (inputTokens / M) * pricing.input;
	const output = (outputTokens / M) * pricing.output;
	const cacheRead = (cacheReadTokens / M) * pricing.cachedInput;
	const cacheWrite = (cacheWriteTokens / M) * pricing.cacheWrite;
	return { input, output, cacheRead, cacheWrite, total: input + output + cacheRead + cacheWrite };
}

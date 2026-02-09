import { describe, expect, test } from "bun:test";
import { addUsage, createStats, mergeStats } from "../stats";
import type { Usage } from "../types";

function makeUsage(overrides: Partial<Usage> = {}): Usage {
	return {
		input: 100,
		output: 50,
		cacheRead: 200,
		cacheWrite: 300,
		totalTokens: 650,
		cost: {
			input: 0.001,
			output: 0.002,
			cacheRead: 0.003,
			cacheWrite: 0.004,
			total: 0.01,
		},
		...overrides,
	};
}

describe("createStats", () => {
	test("returns zeroed stats", () => {
		const stats = createStats();
		expect(stats.totalCost).toBe(0);
		expect(stats.requests).toBe(0);
		expect(stats.models.size).toBe(0);
	});
});

describe("addUsage", () => {
	test("accumulates token counts and costs", () => {
		const stats = createStats();
		addUsage(stats, makeUsage(), "claude-opus-4-5");
		addUsage(stats, makeUsage(), "claude-opus-4-5");

		expect(stats.requests).toBe(2);
		expect(stats.totalCost).toBeCloseTo(0.02);
		expect(stats.inputTokens).toBe(200);
		expect(stats.outputTokens).toBe(100);
		expect(stats.cacheReadTokens).toBe(400);
		expect(stats.cacheWriteTokens).toBe(600);
		expect(stats.costInput).toBeCloseTo(0.002);
		expect(stats.costOutput).toBeCloseTo(0.004);
	});

	test("tracks per-model cost and requests", () => {
		const stats = createStats();
		addUsage(stats, makeUsage({ cost: { ...makeUsage().cost, total: 0.05 } }), "opus");
		addUsage(stats, makeUsage({ cost: { ...makeUsage().cost, total: 0.01 } }), "sonnet");
		addUsage(stats, makeUsage({ cost: { ...makeUsage().cost, total: 0.03 } }), "opus");

		expect(stats.models.get("opus")).toEqual({ requests: 2, cost: 0.08 });
		expect(stats.models.get("sonnet")).toEqual({ requests: 1, cost: 0.01 });
	});
});

describe("mergeStats", () => {
	test("combines two stats objects", () => {
		const a = createStats();
		addUsage(a, makeUsage(), "opus");

		const b = createStats();
		addUsage(b, makeUsage(), "opus");
		addUsage(b, makeUsage(), "sonnet");

		mergeStats(a, b);

		expect(a.requests).toBe(3);
		expect(a.totalCost).toBeCloseTo(0.03);
		expect(a.models.get("opus")?.requests).toBe(2);
		expect(a.models.get("sonnet")?.requests).toBe(1);
	});
});

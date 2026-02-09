import { describe, expect, test } from "bun:test";
import { fmtCost, fmtTokens, renderReport } from "../format";
import { createStats } from "../stats";

describe("fmtCost", () => {
	test.each([
		[0, "$0.0000"],
		[0.0055, "$0.0055"],
		[1.5, "$1.5000"],
		[123.456789, "$123.4568"],
	])("formats %f as %s", (input, expected) => {
		expect(fmtCost(input)).toBe(expected);
	});
});

describe("fmtTokens", () => {
	test.each([
		[0, "0"],
		[500, "500"],
		[1000, "1.0K"],
		[1500, "1.5K"],
		[999999, "1000.0K"],
		[1000000, "1.0M"],
		[2500000, "2.5M"],
	])("formats %d as %s", (input, expected) => {
		expect(fmtTokens(input)).toBe(expected);
	});
});

describe("renderReport", () => {
	test("includes header and summary", () => {
		const totals = createStats();
		totals.totalCost = 5.5;
		totals.requests = 100;
		totals.inputTokens = 50000;
		totals.outputTokens = 25000;
		totals.cacheReadTokens = 1000000;
		totals.cacheWriteTokens = 200000;

		const report = renderReport({
			period: "last 7 days",
			projectFilter: "",
			totals,
			sessionCount: 10,
			perModel: new Map(),
			perProject: new Map(),
			perDay: new Map(),
			showDaily: false,
			sessionRows: [],
			showSessions: false,
		});

		expect(report).toContain("Pi Session Costs — last 7 days");
		expect(report).toContain("Total cost:       $5.5000");
		expect(report).toContain("Sessions:         10");
		expect(report).toContain("LLM requests:     100");
	});

	test("shows model breakdown sorted by cost", () => {
		const totals = createStats();
		const perModel = new Map([
			["opus", { requests: 50, cost: 3.0 }],
			["sonnet", { requests: 100, cost: 1.0 }],
		]);

		const report = renderReport({
			period: "all time",
			projectFilter: "",
			totals,
			sessionCount: 5,
			perModel,
			perProject: new Map(),
			perDay: new Map(),
			showDaily: false,
			sessionRows: [],
			showSessions: false,
		});

		expect(report).toContain("By Model:");
		// opus should come first (higher cost)
		const opusIdx = report.indexOf("opus");
		const sonnetIdx = report.indexOf("sonnet");
		expect(opusIdx).toBeLessThan(sonnetIdx);
		expect(report).toContain("$3.0000");
		expect(report).toContain("$1.0000");
	});

	test("shows project filter in header", () => {
		const report = renderReport({
			period: "last 30 days",
			projectFilter: "finances",
			totals: createStats(),
			sessionCount: 0,
			perModel: new Map(),
			perProject: new Map(),
			perDay: new Map(),
			showDaily: false,
			sessionRows: [],
			showSessions: false,
		});

		expect(report).toContain("Filter: 'finances'");
	});
});

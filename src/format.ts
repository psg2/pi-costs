import type { Stats } from "./types";

export function fmtCost(v: number): string {
	return `$${v.toFixed(4)}`;
}

export function fmtTokens(v: number): string {
	if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
	if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
	return String(v);
}

function pad(s: string, width: number, align: "left" | "right" = "left"): string {
	if (align === "right") return s.padStart(width);
	return s.padEnd(width);
}

const W = 70;
const SEP = "─".repeat(W - 4);

export function renderReport(opts: {
	period: string;
	projectFilter: string;
	totals: Stats;
	sessionCount: number;
	perModel: Map<string, { requests: number; cost: number }>;
	perProject: Map<string, Stats>;
	perDay: Map<string, Stats>;
	showDaily: boolean;
	sessionRows: Array<{
		time: string;
		project: string;
		requests: number;
		cost: number;
		inputTokens: number;
		outputTokens: number;
		models: string;
	}>;
	showSessions: boolean;
}): string {
	const lines: string[] = [];
	const ln = (s = ""): void => {
		lines.push(s);
	};

	const { totals, perModel, perProject, perDay, sessionRows } = opts;

	// Header
	ln();
	ln("=".repeat(W));
	ln(`  Pi Session Costs — ${opts.period}`);
	if (opts.projectFilter) ln(`  Filter: '${opts.projectFilter}'`);
	ln("=".repeat(W));

	// Summary
	ln();
	ln(`  Total cost:       ${fmtCost(totals.totalCost)}`);
	ln(`  Sessions:         ${opts.sessionCount}`);
	ln(`  LLM requests:     ${totals.requests}`);
	ln(`  Input tokens:     ${fmtTokens(totals.inputTokens)} ($${totals.costInput.toFixed(4)})`);
	ln(`  Output tokens:    ${fmtTokens(totals.outputTokens)} ($${totals.costOutput.toFixed(4)})`);
	ln(
		`  Cache read:       ${fmtTokens(totals.cacheReadTokens)} ($${totals.costCacheRead.toFixed(4)})`,
	);
	ln(
		`  Cache write:      ${fmtTokens(totals.cacheWriteTokens)} ($${totals.costCacheWrite.toFixed(4)})`,
	);

	// By Model
	if (perModel.size > 0) {
		ln();
		ln(`  ${SEP}`);
		ln("  By Model:");
		ln(`  ${pad("Model", 45)}${pad("Cost", 10, "right")}${pad("Requests", 10, "right")}`);
		ln(`  ${SEP}`);

		const sorted = [...perModel.entries()].sort((a, b) => b[1].cost - a[1].cost);
		for (const [model, { requests, cost }] of sorted) {
			ln(
				`  ${pad(model, 45)}${pad(fmtCost(cost), 10, "right")}${pad(String(requests), 10, "right")}`,
			);
		}
	}

	// By Project
	if (perProject.size > 1) {
		ln();
		ln(`  ${SEP}`);
		ln("  By Project:");
		ln(`  ${pad("Project", 45)}${pad("Cost", 10, "right")}${pad("Requests", 10, "right")}`);
		ln(`  ${SEP}`);

		const sorted = [...perProject.entries()].sort((a, b) => b[1].totalCost - a[1].totalCost);
		for (const [proj, stats] of sorted) {
			let short = proj.split("/").filter(Boolean).pop() ?? proj;
			if (short.length > 43) short = `…${short.slice(-42)}`;
			ln(
				`  ${pad(short, 45)}${pad(fmtCost(stats.totalCost), 10, "right")}${pad(String(stats.requests), 10, "right")}`,
			);
		}
	}

	// By Day
	if (opts.showDaily && perDay.size > 0) {
		ln();
		ln(`  ${SEP}`);
		ln("  By Day:");
		ln(
			`  ${pad("Date", 15)}${pad("Cost", 10, "right")}${pad("Requests", 10, "right")}${pad("Input", 10, "right")}${pad("Output", 10, "right")}`,
		);
		ln(`  ${SEP}`);

		const sorted = [...perDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
		for (const [day, stats] of sorted) {
			const totalIn = stats.inputTokens + stats.cacheReadTokens + stats.cacheWriteTokens;
			ln(
				`  ${pad(day, 15)}${pad(fmtCost(stats.totalCost), 10, "right")}${pad(String(stats.requests), 10, "right")}${pad(fmtTokens(totalIn), 10, "right")}${pad(fmtTokens(stats.outputTokens), 10, "right")}`,
			);
		}
	}

	// Per Session
	if (opts.showSessions && sessionRows.length > 0) {
		const SW = 90;
		const sSep = "─".repeat(SW);
		ln();
		ln(`  ${sSep}`);
		ln("  Sessions:");
		ln(
			`  ${pad("Time", 18)}${pad("Project", 20)}${pad("Reqs", 6, "right")}${pad("Cost", 10, "right")}${pad("In Tok", 10, "right")}${pad("Out Tok", 10, "right")}  Model`,
		);
		ln(`  ${sSep}`);

		for (const row of sessionRows) {
			let proj = row.project;
			if (proj.length > 18) proj = `…${proj.slice(-17)}`;
			ln(
				`  ${pad(row.time, 18)}${pad(proj, 20)}${pad(String(row.requests), 6, "right")}${pad(fmtCost(row.cost), 10, "right")}${pad(fmtTokens(row.inputTokens), 10, "right")}${pad(fmtTokens(row.outputTokens), 10, "right")}  ${row.models}`,
			);
		}
	}

	ln();
	ln("=".repeat(W));
	ln();

	return lines.join("\n");
}

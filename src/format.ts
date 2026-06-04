import type { ModelEntry, Stats } from "./types";

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
	perModel: Map<string, ModelEntry>;
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
		cacheReadTokens: number;
		cacheWriteTokens: number;
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
		const termWidth = process.stdout.columns ?? (process.env.COLUMNS ? Number(process.env.COLUMNS) : 120);
		// Cols: 2(indent) + name(var) + Cost(10) + Reqs(8) + In(10) + Out(10) + CR(10) + CW(10) = 58 fixed
		const modelNames = [...perModel.keys()];
		const maxName = Math.max(...modelNames.map((m) => m.length));
		const nameCol = Math.min(maxName, Math.max(25, termWidth - 2 - 58));
		const mSep = "─".repeat(nameCol + 58);
		ln();
		ln(`  ${mSep}`);
		ln("  By Model:");
		ln(
			`  ${pad("Model", nameCol)}${pad("Cost", 10, "right")}${pad("Reqs", 8, "right")}${pad("In", 10, "right")}${pad("Out", 10, "right")}${pad("CR", 10, "right")}${pad("CW", 10, "right")}`,
		);
		ln(`  ${mSep}`);

		const sorted = [...perModel.entries()].sort((a, b) => b[1].cost - a[1].cost);
		for (const [model, e] of sorted) {
			const name = model.length > nameCol ? `…${model.slice(-(nameCol - 1))}` : model;
			ln(
				`  ${pad(name, nameCol)}${pad(fmtCost(e.cost), 10, "right")}${pad(String(e.requests), 8, "right")}${pad(fmtTokens(e.inputTokens), 10, "right")}${pad(fmtTokens(e.outputTokens), 10, "right")}${pad(fmtTokens(e.cacheReadTokens), 10, "right")}${pad(fmtTokens(e.cacheWriteTokens), 10, "right")}`,
			);
		}
	}

	// By Project
	if (perProject.size > 1) {
		const termWidth = process.stdout.columns ?? (process.env.COLUMNS ? Number(process.env.COLUMNS) : 120);
		const projNames = [...perProject.keys()].map((p) => p.split("/").filter(Boolean).pop() ?? p);
		const maxName = Math.max(...projNames.map((n) => n.length));
		const nameCol = Math.min(maxName, Math.max(25, termWidth - 2 - 58));
		const pSep = "─".repeat(nameCol + 58);
		ln();
		ln(`  ${pSep}`);
		ln("  By Project:");
		ln(
			`  ${pad("Project", nameCol)}${pad("Cost", 10, "right")}${pad("Reqs", 8, "right")}${pad("In", 10, "right")}${pad("Out", 10, "right")}${pad("CR", 10, "right")}${pad("CW", 10, "right")}`,
		);
		ln(`  ${pSep}`);

		const sorted = [...perProject.entries()].sort((a, b) => b[1].totalCost - a[1].totalCost);
		for (const [proj, stats] of sorted) {
			const raw = proj.split("/").filter(Boolean).pop() ?? proj;
			const name = raw.length > nameCol ? `…${raw.slice(-(nameCol - 1))}` : raw;
			ln(
				`  ${pad(name, nameCol)}${pad(fmtCost(stats.totalCost), 10, "right")}${pad(String(stats.requests), 8, "right")}${pad(fmtTokens(stats.inputTokens), 10, "right")}${pad(fmtTokens(stats.outputTokens), 10, "right")}${pad(fmtTokens(stats.cacheReadTokens), 10, "right")}${pad(fmtTokens(stats.cacheWriteTokens), 10, "right")}`,
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
		// Fixed cols: 2(indent) + 18(time) + 6(reqs) + 10(cost) + 9(in) + 9(out) + 9(cr) + 9(cw) + 2(model gap) = 74
		const termWidth = process.stdout.columns ?? (process.env.COLUMNS ? Number(process.env.COLUMNS) : 120);
		const maxProjName = Math.max(...sessionRows.map((r) => r.project.length));
		const projColWidth = Math.min(maxProjName, Math.max(18, termWidth - 74 - 18));
		const SW = 2 + 18 + projColWidth + 6 + 10 + 9 + 9 + 9 + 9 + 2 + 5;
		const sSep = "─".repeat(SW);
		ln();
		ln(`  ${sSep}`);
		ln("  Sessions:");
		ln(
			`  ${pad("Time", 18)}${pad("Project", projColWidth + 2)}${pad("Reqs", 6, "right")}${pad("Cost", 10, "right")}${pad("In", 9, "right")}${pad("Out", 9, "right")}${pad("CR", 9, "right")}${pad("CW", 9, "right")}  Model`,
		);
		ln(`  ${sSep}`);

		for (const row of sessionRows) {
			let proj = row.project;
			if (proj.length > projColWidth) proj = `…${proj.slice(-(projColWidth - 1))}`;
			ln(
				`  ${pad(row.time, 18)}${pad(proj, projColWidth + 2)}${pad(String(row.requests), 6, "right")}${pad(fmtCost(row.cost), 10, "right")}${pad(fmtTokens(row.inputTokens), 9, "right")}${pad(fmtTokens(row.outputTokens), 9, "right")}${pad(fmtTokens(row.cacheReadTokens), 9, "right")}${pad(fmtTokens(row.cacheWriteTokens), 9, "right")}  ${row.models}`,
			);
		}
	}

	ln();
	ln("=".repeat(W));
	ln();

	return lines.join("\n");
}

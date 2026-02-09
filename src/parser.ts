import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { addUsage, createStats, mergeStats } from "./stats";
import type { Options, SessionInfo, SessionRow, Stats } from "./types";

/** Parse timestamp from pi session filename like "2026-02-02T00-00-37-064Z_uuid.jsonl" */
function parseSessionTimestamp(filename: string): Date | null {
	const tsRaw = filename.split("_")[0];
	if (!tsRaw) return null;

	const parts = tsRaw.replace("Z", "").split("T");
	if (parts.length !== 2) return null;

	const [datePart, timeRaw] = parts;
	const timePieces = timeRaw?.split("-");
	if (timePieces.length < 3) return null;

	const timeStr = `${timePieces[0]}:${timePieces[1]}:${timePieces[2]}`;
	const date = new Date(`${datePart}T${timeStr}Z`);
	return Number.isNaN(date.getTime()) ? null : date;
}

/** Decode project name from directory name (-- becomes /) */
function decodeProjectName(dirname: string): string {
	return dirname.replace(/--/g, "/").replace(/^\/|\/$/g, "");
}

/** Get short project name (last path segment) */
function shortProjectName(project: string, maxLen = 43): string {
	const segments = project.split("/").filter(Boolean);
	let short = segments[segments.length - 1] ?? project;
	if (short.length > maxLen) {
		short = `…${short.slice(-(maxLen - 1))}`;
	}
	return short;
}

/** Discover all session files matching the filter criteria */
export async function discoverSessions(opts: Options): Promise<SessionInfo[]> {
	const sessions: SessionInfo[] = [];
	const cutoff = opts.days > 0 ? new Date(Date.now() - opts.days * 86400_000) : new Date(0);

	let projectDirs: string[];
	try {
		projectDirs = await readdir(opts.sessionsDir);
	} catch {
		return [];
	}

	for (const dir of projectDirs.sort()) {
		const projectPath = join(opts.sessionsDir, dir);
		const project = decodeProjectName(dir);

		if (opts.projectFilter && !project.toLowerCase().includes(opts.projectFilter.toLowerCase())) {
			continue;
		}

		let files: string[];
		try {
			files = await readdir(projectPath);
		} catch {
			continue;
		}

		for (const file of files.sort()) {
			if (!file.endsWith(".jsonl")) continue;

			const ts = parseSessionTimestamp(file);
			if (!ts || ts < cutoff) continue;

			sessions.push({
				filepath: join(projectPath, file),
				project,
				timestamp: ts,
			});
		}
	}

	return sessions;
}

/** Parse a single session file and return its aggregated stats */
async function parseSession(filepath: string): Promise<Stats> {
	const stats = createStats();
	const text = await readFile(filepath, "utf-8");

	for (const line of text.split("\n")) {
		if (!line.trim()) continue;

		let obj: Record<string, unknown>;
		try {
			obj = JSON.parse(line);
		} catch {
			continue;
		}

		if (obj.type !== "message") continue;
		const msg = obj.message as Record<string, unknown> | undefined;
		if (!msg || msg.role !== "assistant") continue;

		const usage = msg.usage as Record<string, unknown> | undefined;
		if (!usage) continue;

		const model = (msg.model as string) ?? "unknown";
		addUsage(stats, usage as never, model);
	}

	return stats;
}

export interface AnalysisResult {
	totals: Stats;
	perProject: Map<string, Stats>;
	perDay: Map<string, Stats>;
	perModel: Map<string, { requests: number; cost: number }>;
	sessionRows: SessionRow[];
	sessionCount: number;
}

/** Analyze all sessions and produce aggregated results */
export async function analyzeSessions(
	sessions: SessionInfo[],
	showSessions: boolean,
): Promise<AnalysisResult> {
	const totals = createStats();
	const perProject = new Map<string, Stats>();
	const perDay = new Map<string, Stats>();
	const sessionRows: SessionRow[] = [];
	let sessionCount = 0;

	for (const { filepath, project, timestamp } of sessions) {
		const sessionStats = await parseSession(filepath);
		if (sessionStats.requests === 0) continue;

		sessionCount++;
		mergeStats(totals, sessionStats);

		// Per project
		const projectStats = perProject.get(project) ?? createStats();
		mergeStats(projectStats, sessionStats);
		perProject.set(project, projectStats);

		// Per day
		const dayKey = timestamp.toISOString().slice(0, 10);
		const dayStats = perDay.get(dayKey) ?? createStats();
		mergeStats(dayStats, sessionStats);
		perDay.set(dayKey, dayStats);

		if (showSessions) {
			const short = shortProjectName(project, 18);
			const modelsStr = [...sessionStats.models.entries()]
				.sort((a, b) => b[1].requests - a[1].requests)
				.map(([m]) => m)
				.join(", ");

			sessionRows.push({
				time: formatTimestamp(timestamp),
				project: short,
				requests: sessionStats.requests,
				cost: sessionStats.totalCost,
				inputTokens:
					sessionStats.inputTokens + sessionStats.cacheReadTokens + sessionStats.cacheWriteTokens,
				outputTokens: sessionStats.outputTokens,
				models: modelsStr,
			});
		}
	}

	return { totals, perProject, perDay, perModel: totals.models, sessionRows, sessionCount };
}

function formatTimestamp(date: Date): string {
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	const d = String(date.getUTCDate()).padStart(2, "0");
	const h = String(date.getUTCHours()).padStart(2, "0");
	const min = String(date.getUTCMinutes()).padStart(2, "0");
	return `${y}-${m}-${d} ${h}:${min}`;
}

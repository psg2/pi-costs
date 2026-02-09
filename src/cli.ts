#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { renderReport } from "./format";
import { analyzeSessions, discoverSessions } from "./parser";
import type { Options } from "./types";

const HELP = `pi-costs — Analyze cost and token usage from pi coding agent sessions

Usage:
  pi-costs                        All projects, last 7 days
  pi-costs --days 30              Last 30 days
  pi-costs --days 0               All time
  pi-costs --project finances     Filter by project (substring match)
  pi-costs --sessions             Show per-session breakdown
  pi-costs --daily                Show per-day breakdown

Options:
  --days <n>        Time window in days (default: 7, use 0 for all time)
  --project <name>  Filter projects by substring (case-insensitive)
  --sessions        Show individual session breakdown
  --daily           Show per-day breakdown
  --dir <path>      Custom sessions directory (default: ~/.pi/agent/sessions)
  -h, --help        Show this help
  -v, --version     Show version
`;

function parseArgs(args: string[]): Options {
	const opts: Options = {
		days: 7,
		projectFilter: "",
		showSessions: false,
		showDaily: false,
		sessionsDir: join(homedir(), ".pi", "agent", "sessions"),
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case "--days":
				opts.days = Number.parseInt(args[++i] ?? "7", 10);
				break;
			case "--project":
				opts.projectFilter = args[++i] ?? "";
				break;
			case "--sessions":
				opts.showSessions = true;
				break;
			case "--daily":
				opts.showDaily = true;
				break;
			case "--dir":
				opts.sessionsDir = args[++i] ?? opts.sessionsDir;
				break;
			case "-h":
			case "--help":
				console.log(HELP);
				process.exit(0);
				break;
			case "-v":
			case "--version": {
				const pkgPath = resolve(import.meta.dirname ?? ".", "..", "package.json");
				const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
				console.log(`pi-costs v${pkg.version}`);
				process.exit(0);
				break;
			}
			default:
				console.error(`Unknown option: ${arg}\nRun 'pi-costs --help' for usage.`);
				process.exit(1);
		}
	}

	return opts;
}

async function main(): Promise<void> {
	const opts = parseArgs(process.argv.slice(2));

	const sessions = await discoverSessions(opts);
	if (sessions.length === 0) {
		const period = opts.days > 0 ? `last ${opts.days} days` : "all time";
		const filter = opts.projectFilter ? ` matching '${opts.projectFilter}'` : "";
		console.log(`No sessions found for ${period}${filter}`);
		console.log(`\nSearched: ${opts.sessionsDir}`);
		process.exit(0);
	}

	const result = await analyzeSessions(sessions, opts.showSessions);

	const period = opts.days > 0 ? `last ${opts.days} days` : "all time";
	const report = renderReport({
		period,
		projectFilter: opts.projectFilter,
		totals: result.totals,
		sessionCount: result.sessionCount,
		perModel: result.perModel,
		perProject: result.perProject,
		perDay: result.perDay,
		showDaily: opts.showDaily,
		sessionRows: result.sessionRows,
		showSessions: opts.showSessions,
	});

	console.log(report);
}

main().catch((err) => {
	console.error("Error:", err.message);
	process.exit(1);
});

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { analyzeSessions, discoverSessions } from "../parser";

let tempDir: string;

function makeSessionFile(
	messages: Array<{
		model?: string;
		provider?: string;
		cost?: number;
		input?: number;
		output?: number;
	}>,
): string {
	const lines: string[] = [
		JSON.stringify({
			type: "session",
			version: 3,
			id: "test-session",
			timestamp: "2026-02-09T12:00:00.000Z",
			cwd: "/test",
		}),
	];

	for (const msg of messages) {
		// User message
		lines.push(
			JSON.stringify({
				type: "message",
				id: "user-1",
				timestamp: "2026-02-09T12:00:01.000Z",
				message: { role: "user", content: [{ type: "text", text: "hello" }] },
			}),
		);

		// Assistant message with usage
		lines.push(
			JSON.stringify({
				type: "message",
				id: "asst-1",
				timestamp: "2026-02-09T12:00:02.000Z",
				message: {
					role: "assistant",
					content: [{ type: "text", text: "response" }],
					api: "anthropic-messages",
					provider: msg.provider ?? "anthropic",
					model: msg.model ?? "claude-opus-4-5",
					usage: {
						input: msg.input ?? 100,
						output: msg.output ?? 50,
						cacheRead: 500,
						cacheWrite: 200,
						totalTokens: 850,
						cost: {
							input: 0.0005,
							output: 0.00125,
							cacheRead: 0.0025,
							cacheWrite: 0.00125,
							total: msg.cost ?? 0.0055,
						},
					},
				},
			}),
		);
	}

	return lines.join("\n");
}

beforeAll(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "pi-costs-test-"));

	// Create project dirs with sessions
	const proj1 = join(tempDir, "--Users-test-workspace-my-project--");
	const proj2 = join(tempDir, "--Users-test-workspace-other-project--");
	await mkdir(proj1, { recursive: true });
	await mkdir(proj2, { recursive: true });

	// Recent session
	await writeFile(
		join(proj1, "2026-02-09T12-00-00-000Z_aaaaaaaa-1111-2222-3333-444444444444.jsonl"),
		makeSessionFile([
			{ model: "claude-opus-4-5", cost: 0.05 },
			{ model: "claude-opus-4-5", cost: 0.03 },
			{ model: "claude-sonnet-4-5", cost: 0.01 },
		]),
	);

	// Older session (same project, different day)
	await writeFile(
		join(proj1, "2026-02-08T10-00-00-000Z_bbbbbbbb-1111-2222-3333-444444444444.jsonl"),
		makeSessionFile([{ model: "claude-opus-4-5", cost: 0.02 }]),
	);

	// Different project
	await writeFile(
		join(proj2, "2026-02-09T14-00-00-000Z_cccccccc-1111-2222-3333-444444444444.jsonl"),
		makeSessionFile([{ model: "claude-opus-4-6", cost: 0.04 }]),
	);

	// Very old session (should be excluded by default 7-day filter)
	await writeFile(
		join(proj1, "2025-01-01T00-00-00-000Z_dddddddd-1111-2222-3333-444444444444.jsonl"),
		makeSessionFile([{ cost: 1.0 }]),
	);
});

afterAll(async () => {
	await rm(tempDir, { recursive: true });
});

describe("discoverSessions", () => {
	test("finds sessions within time window", async () => {
		const sessions = await discoverSessions({
			days: 7,
			projectFilter: "",
			showSessions: false,
			showDaily: false,
			sessionsDir: tempDir,
		});

		expect(sessions).toHaveLength(3);
	});

	test("days=0 returns all sessions", async () => {
		const sessions = await discoverSessions({
			days: 0,
			projectFilter: "",
			showSessions: false,
			showDaily: false,
			sessionsDir: tempDir,
		});

		expect(sessions).toHaveLength(4);
	});

	test("filters by project name", async () => {
		const sessions = await discoverSessions({
			days: 0,
			projectFilter: "my-project",
			showSessions: false,
			showDaily: false,
			sessionsDir: tempDir,
		});

		expect(sessions).toHaveLength(3);
		for (const s of sessions) {
			expect(s.project).toContain("my-project");
		}
	});

	test("returns empty for non-existent directory", async () => {
		const sessions = await discoverSessions({
			days: 7,
			projectFilter: "",
			showSessions: false,
			showDaily: false,
			sessionsDir: "/nonexistent/path",
		});

		expect(sessions).toHaveLength(0);
	});
});

describe("analyzeSessions", () => {
	test("aggregates costs across sessions", async () => {
		const sessions = await discoverSessions({
			days: 7,
			projectFilter: "",
			showSessions: false,
			showDaily: false,
			sessionsDir: tempDir,
		});
		const result = await analyzeSessions(sessions, false);

		// 3 recent sessions: 0.05+0.03+0.01 + 0.02 + 0.04 = 0.15
		expect(result.totals.totalCost).toBeCloseTo(0.15);
		expect(result.totals.requests).toBe(5);
		expect(result.sessionCount).toBe(3);
	});

	test("groups by model with cost", async () => {
		const sessions = await discoverSessions({
			days: 7,
			projectFilter: "",
			showSessions: false,
			showDaily: false,
			sessionsDir: tempDir,
		});
		const result = await analyzeSessions(sessions, false);

		const opus45 = result.perModel.get("claude-opus-4-5");
		expect(opus45).toBeDefined();
		expect(opus45?.requests).toBe(3);
		expect(opus45?.cost).toBeCloseTo(0.1); // 0.05+0.03+0.02

		const sonnet = result.perModel.get("claude-sonnet-4-5");
		expect(sonnet).toBeDefined();
		expect(sonnet?.requests).toBe(1);
		expect(sonnet?.cost).toBeCloseTo(0.01);

		const opus46 = result.perModel.get("claude-opus-4-6");
		expect(opus46).toBeDefined();
		expect(opus46?.requests).toBe(1);
		expect(opus46?.cost).toBeCloseTo(0.04);
	});

	test("groups by project", async () => {
		const sessions = await discoverSessions({
			days: 7,
			projectFilter: "",
			showSessions: false,
			showDaily: false,
			sessionsDir: tempDir,
		});
		const result = await analyzeSessions(sessions, false);

		expect(result.perProject.size).toBe(2);

		const myProj = result.perProject.get("Users-test-workspace-my-project");
		expect(myProj).toBeDefined();
		expect(myProj?.totalCost).toBeCloseTo(0.11); // 0.05+0.03+0.01+0.02

		const otherProj = result.perProject.get("Users-test-workspace-other-project");
		expect(otherProj).toBeDefined();
		expect(otherProj?.totalCost).toBeCloseTo(0.04);
	});

	test("groups by day", async () => {
		const sessions = await discoverSessions({
			days: 7,
			projectFilter: "",
			showSessions: false,
			showDaily: false,
			sessionsDir: tempDir,
		});
		const result = await analyzeSessions(sessions, false);

		expect(result.perDay.size).toBe(2);

		const feb9 = result.perDay.get("2026-02-09");
		expect(feb9).toBeDefined();
		expect(feb9?.totalCost).toBeCloseTo(0.13); // 0.05+0.03+0.01+0.04

		const feb8 = result.perDay.get("2026-02-08");
		expect(feb8).toBeDefined();
		expect(feb8?.totalCost).toBeCloseTo(0.02);
	});

	test("produces session rows when requested", async () => {
		const sessions = await discoverSessions({
			days: 7,
			projectFilter: "",
			showSessions: true,
			showDaily: false,
			sessionsDir: tempDir,
		});
		const result = await analyzeSessions(sessions, true);

		expect(result.sessionRows).toHaveLength(3);
		// Sorted by session file order (chronological)
		expect(result.sessionRows[0]?.cost).toBeCloseTo(0.02);
		expect(result.sessionRows[1]?.cost).toBeCloseTo(0.09);
		expect(result.sessionRows[2]?.cost).toBeCloseTo(0.04);
	});
});

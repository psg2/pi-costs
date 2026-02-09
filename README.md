# pi-costs

Analyze cost and token usage from [pi coding agent](https://github.com/badlogic/pi-mono) sessions.

Reads the JSONL session logs stored in `~/.pi/agent/sessions/` and produces a summary of costs, token usage, and breakdowns by model, project, day, or individual session.

## Usage

Run directly with `bunx` (no install needed):

```bash
bunx @psg2/pi-costs
```

Or install globally:

```bash
bun install -g @psg2/pi-costs
pi-costs
```

## Options

```
pi-costs                        All projects, last 7 days
pi-costs --days 30              Last 30 days
pi-costs --days 0               All time
pi-costs --project my-app       Filter by project (substring match)
pi-costs --sessions             Show per-session breakdown
pi-costs --daily                Show per-day breakdown
pi-costs --dir <path>           Custom sessions directory
```

## Example output

```
======================================================================
  Pi Session Costs — last 7 days
======================================================================

  Total cost:       $42.5100
  Sessions:         18
  LLM requests:     320
  Input tokens:     50.2K ($0.2510)
  Output tokens:    1.2M ($30.0000)
  Cache read:       15.0M ($9.0000)
  Cache write:      800.0K ($3.2590)

  ──────────────────────────────────────────────────────────────────
  By Model:
  Model                                              Cost  Requests
  ──────────────────────────────────────────────────────────────────
  claude-opus-4-5                                $30.1200       210
  claude-sonnet-4-5                              $12.3900       110

  ──────────────────────────────────────────────────────────────────
  By Project:
  Project                                            Cost  Requests
  ──────────────────────────────────────────────────────────────────
  my-web-app                                     $28.4500       200
  my-api-server                                  $14.0600       120

======================================================================
```

## How it works

Pi stores session logs as JSONL files in `~/.pi/agent/sessions/<project>/`. Each assistant message includes a `usage` field with token counts and pre-calculated costs in USD:

```json
{
  "type": "message",
  "message": {
    "role": "assistant",
    "model": "claude-opus-4-5",
    "usage": {
      "input": 3183,
      "output": 104,
      "cacheRead": 50000,
      "cacheWrite": 4000,
      "cost": {
        "input": 0.0159,
        "output": 0.0026,
        "cacheRead": 0.025,
        "cacheWrite": 0.025,
        "total": 0.0685
      }
    }
  }
}
```

See the [pi session format docs](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/session.md) for full details.

## Development

```bash
bun install
bun test          # Run tests
bun run dev       # Run from source
bun run build     # Build for distribution
bun run lint      # Lint
```

## License

MIT

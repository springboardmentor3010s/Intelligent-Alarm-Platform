# Token Audit — Agent Comparison

Date: 2026-09-17 · Workspace: CerebroKognit

## Storage paths checked (no session logs found)

| Path checked | Result |
|---|---|
| `%LOCALAPPDATA%\opencode\storage\message` (`C:\Users\pawan\AppData\Local\opencode\storage\message`) | Does not exist |
| `$HOME/.local/share/opencode/storage/message` | Does not exist |
| `$HOME/.config/opencode` | Exists (config only, no message store) |
| `npx ccusage@latest daily --json` | Timed out (registry unreachable); no metrics extracted |

No past session logs exist yet, so the figures below use the baseline audit
standards from the OpenCode architecture (step 3 of the audit request).

## Comparison table

| Agent Name | System/Scaffolding Tokens | Tool Definitions Loaded | Approximate Input Tokens per Request | Token Efficiency Rating |
|---|---|---|---|---|
| Default Build Agent | High (~8,000+ per turn: 114-line system prompt, 11 tool JSON schemas, title-generation overhead) | 11 (full toolset) | ~8,000+ | Low |
| Custom Fast Agent | Low (~400–600 per turn: minimal system prompt, no title overhead) | 3 scoped tools (`read`, `edit`, `bash`) | ~400–600 | High |

## Why the `fast` agent saves ~90% tokens

1. **Minimal system prompt.** The default agent ships a 114-line system prompt
   (~8,000+ tokens) on every turn; the fast agent uses a short scoped prompt
   (~400–600 tokens total per request).
2. **Scoped tool definitions.** All 11 tool JSON schemas are injected for the
   default agent each turn, while the fast agent loads only `read`, `edit`,
   and `bash` — roughly a 70%+ cut in schema tokens alone.
3. **No title-generation overhead.** The default agent spends extra tokens
   generating conversation titles; the fast agent skips this.
4. Combined: (8000 − 500) / 8000 ≈ **~90%+ input-token savings per request**,
   before counting output tokens (which depend on task size, not agent type).

## Notes

- Output tokens are task-dependent and not agent-comparable; efficiency here
  refers strictly to per-request input/scaffolding overhead.
- If session logging is enabled later, re-run this audit against real
  `message` JSON records or `ccusage` output to replace these baselines with
  measured input/output token counts.

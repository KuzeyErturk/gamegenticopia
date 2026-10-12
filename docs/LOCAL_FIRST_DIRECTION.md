# Local-first product direction

Status: accepted product direction

Vibe Control District should become a local-first application. The hosted site remains useful as a visual prototype and shareable demo, but it is not the intended architecture of the finished product.

## Core decision

Each user runs Vibe Control District on their own computer. The game opens on a localhost address, watches only repositories explicitly selected by the user, and does not require ChatGPT login or cloud hosting.

The intended launch experience is:

```bash
vibe-control-district --repo /path/to/project
```

This starts the local companion, local game server, repository watcher, and village interface together.

## Local architecture

```text
Codex / Claude / terminal
          ↓
local repository watcher
          ↓
git diff + optional agent adapter
          ↓
local question generator
          ↓
Vibe Control District on localhost
          ↓
local SQLite database
```

## Required behavior

- A generic file and Git watcher is the baseline integration. The game must work even when it does not recognize the agent that produced a change.
- Optional Codex, Claude Code, and shell adapters provide better task names, working status, and completion signals.
- The watcher reads only user-selected repositories.
- It ignores `.git`, `node_modules`, build output, secrets, `.env` files, and user-configured paths.
- Questions are created from the relevant Git diff and minimal surrounding context, not the entire repository.
- A question appears after the agent stops, finishes, or the changed files remain idle for a short period.
- Large changes are grouped by logical responsibility rather than raw file count. Each logical group becomes a construction stage.
- The player’s knowledge level and previous answers control question depth.
- Local SQLite stores villages, layouts, inventory, currency, agent work orders, questions, and learning progress.
- Code must not leave the computer unless the user explicitly enables and configures a remote model provider.

## Suggested local storage

```text
~/.vibe-control-district/vcd.db
```

The database should support multiple repositories, with one village per project by default and an option to share one village across several repositories later.

## Product principle

Agent work supplies the labor. Code changes determine the construction stages. The developer’s understanding completes the build.

## Current local MVP

The repository now includes `npm run watch:agents`. It polls a user-selected Git repository, waits for the diff to settle, filters common secret and build paths, sends the real highlighted diff to the localhost game, and creates a new unassigned work order. Local fallback questions are the default. Semantic questions through an authenticated Claude Code installation require the explicit `--claude-questions` option.

The current MVP still uses the app's existing D1-compatible village snapshot and HTTP polling. Claude Code now has exact per-prompt boundaries through `UserPromptSubmit` and `Stop` hooks; Codex and generic terminal tools still use diff polling until equivalent lifecycle adapters are added. The server and connectors are not yet packaged into one command.

## Next implementation milestone

1. Replace the Cloudflare-specific runtime with a local Node application or add a local runtime alongside it.
2. Add SQLite storage and migrate the current village-state model.
3. Add Codex and shell lifecycle adapters, then replace browser polling with a local WebSocket.
4. Improve diff grouping when several edits are made to one uncommitted file.
5. Package the app as a simple CLI first; consider Tauri for a desktop release after the workflow is stable.

# Patchwork Valley

![Patchwork Valley](public/og.png)

Patchwork Valley turns “the agent changed some files” into something you can actually explain.

Each coding agent owns a small worksite in the village. When that agent changes code, its worksite produces a three-choice checkpoint. Answer correctly and the building improves. Clear every active worksite and the Launch Tower opens for one final question about the release as a whole.

The point is not to test syntax trivia. It is to make sure you still understand the product you are shipping while Codex, Claude, or a terminal-based agent is moving quickly.

## What is playable today

The current build is a complete interactive demo of the game loop:

- three worksites representing Codex, Claude Code, and a macOS terminal
- Beginner, Builder, and Expert question levels
- three answer choices for every checkpoint
- explanations after correct and incorrect answers
- building upgrades, XP, coins, and streaks
- a final deployment checkpoint after all worksites are cleared
- progress saved in the browser on the current device
- responsive layouts for desktop and mobile

The **Simulate file change** button currently supplies the events. Live filesystem and agent connections are the next layer; the browser cannot watch files on your Mac by itself.

## How to play

1. Choose your coding knowledge level from the top-right menu.
2. Select a worksite on the village map. Each one shows which agent is working, what it is changing, and the affected file.
3. Read the short description of the change and choose one of three answers.
4. A correct answer clears that checkpoint, upgrades the building, and awards XP and coins.
5. A wrong answer does not approve the change. The game gives you a hint and lets you try again.
6. Clear all three worksites to unlock the Launch Tower.
7. Answer the final question about the complete release to ship it.

You can change the knowledge level at any time:

- **Beginner** focuses on what a change lets the user do.
- **Builder** asks why an implementation choice was made.
- **Expert** asks about security, data integrity, race conditions, and trade-offs.

Progress is stored in `localStorage`, so refreshing the page does not reset the village. Use **Reset demo** when you want to start another run.

## How questions are created

In this first version, the sample questions are written directly in [`app/page.tsx`](app/page.tsx). Each simulated agent task has three versions of the same idea—Beginner, Builder, and Expert—plus:

- a short, plain-language description of the code change
- exactly three possible answers
- one unambiguous correct answer
- an explanation of why that answer is correct

The planned live question pipeline is:

1. A local companion process notices a saved file or completed agent action.
2. It reads the relevant `git diff`, file path, and a small amount of surrounding code.
3. A model summarizes the user-visible effect and selects a question depth based on the player’s knowledge level and answer history.
4. It returns structured data containing one question, three choices, one correct answer, and one explanation.
5. The game validates that structure before displaying the checkpoint.
6. Only the developer’s answer changes game progress; the agent does not decide that the developer understood the code.

A useful rule for generated questions is: ask about **behavior and consequences before implementation vocabulary**. “What changes for the user?” is usually more valuable than “Which hook appears in this file?”

## Terminal integration

Terminal integration is not active in the current demo. It needs a small local companion because the hosted game cannot directly read your filesystem or terminal session.

The intended setup looks like this:

```text
Codex / Claude / terminal command
              ↓
        files are changed
              ↓
local watcher collects the git diff
              ↓
question generator creates a checkpoint
              ↓
Patchwork Valley receives the event
```

The companion should:

1. run on your Mac inside the repository you want to watch
2. listen for file changes with Node’s `fs.watch` or a library such as `chokidar`
3. ignore `.git`, `node_modules`, build output, secrets, and environment files
4. use `git diff` to send only the relevant change instead of the entire repository
5. identify the source as Codex, Claude, or terminal when that information is available
6. send the generated checkpoint to the game over a local WebSocket or HTTP endpoint
7. require explicit approval before transmitting code to any remote question-generation service

Once that companion is implemented, the expected workflow will be:

```bash
# Terminal 1: run the game
npm run dev

# Terminal 2: run the future local watcher in the project being edited
npm run watch:agents
```

`watch:agents` is documented here as the target interface—it has not been added yet. Until then, use **Simulate file change** to play through the full experience.

## Run it locally

Requirements:

- Node.js 22.13 or newer
- npm

```bash
git clone https://github.com/KuzeyErturk/gamegenticopia.git
cd gamegenticopia
npm install
npm run dev
```

Open the local address printed in the terminal, normally `http://localhost:3000`.

Create a production build with:

```bash
npm run build
```

## Project map

```text
app/page.tsx       game state, questions, rewards, and interactions
app/globals.css    village map, buildings, panels, and responsive layout
app/layout.tsx     page metadata and social sharing settings
public/og.png      Patchwork Valley share image
worker/            Cloudflare-compatible server entry
```

## What comes next

- a local file watcher and terminal companion
- real Codex and Claude session adapters
- questions generated from actual diffs
- per-project villages and longer upgrade paths
- a review screen showing what the player understood before deployment
- optional team mode, where different developers clear different worksites

Patchwork Valley should slow an agent down only when understanding is missing—not when the developer already knows exactly what changed.

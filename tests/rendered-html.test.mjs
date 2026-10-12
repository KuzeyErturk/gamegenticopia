import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("ships the Vibe Control District game instead of the starter preview", async () => {
  const [page, layout, gameData, css] = await Promise.all([
    read("app/page.tsx"),
    read("app/layout.tsx"),
    read("app/game-data.ts"),
    read("app/globals.css"),
  ]);

  assert.match(page, /Vibe Control District/);
  assert.match(layout, /Vibe Control District — Understand every change/);
  assert.match(gameData, /villageName: "Vibe Control District"/);
  assert.match(css, /CODEBLOCK THEME/);
  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
});

test("shows question-specific changed code before answer choices", async () => {
  const [page, gameData, css] = await Promise.all([
    read("app/page.tsx"),
    read("app/game-data.ts"),
    read("app/globals.css"),
  ]);

  assert.match(gameData, /type ChangeEvidence/);
  assert.match(gameData, /evidenceByStage/);
  assert.match(page, /LOOK HERE TO ANSWER/);
  assert.match(page, /diff-line/);
  assert.ok(page.indexOf("review-evidence") < page.indexOf("answer-list"));
  assert.match(css, /\.diff-line\.add/);
  assert.match(css, /\.diff-line\.remove/);
});

test("includes a localhost-only Git watcher connector", async () => {
  const [packageJson, watcher, route, hook, installer] = await Promise.all([
    read("package.json"),
    read("scripts/watch-agents.mjs"),
    read("app/api/local-events/route.ts"),
    read("scripts/claude-hook.mjs"),
    read("scripts/install-claude-hooks.mjs"),
  ]);

  assert.match(packageJson, /"watch:agents": "node scripts\/watch-agents\.mjs"/);
  assert.match(watcher, /git diff/);
  assert.match(watcher, /--claude-questions/);
  assert.match(watcher, /--permission-mode", "plan"/);
  assert.match(watcher, /base\.startsWith\("\.env\."\)/);
  assert.match(route, /hostname === "localhost"/);
  assert.match(route, /Local connector is disabled on hosted deployments/);
  assert.match(route, /status: "unassigned"/);
  assert.match(packageJson, /"install:claude-hooks": "node scripts\/install-claude-hooks\.mjs"/);
  assert.match(hook, /input\.prompt_id/);
  assert.match(hook, /phase: "canceled"/);
  assert.match(hook, /baselineHashes/);
  assert.match(installer, /UserPromptSubmit/);
  assert.match(installer, /Stop:/);
  assert.match(installer, /settings\.local\.json/);
  assert.match(route, /phase === "canceled"/);
});

test("lets players choose named agents, follow roads, and clear task history", async () => {
  const [page, gameData, css, route, watcher] = await Promise.all([
    read("app/page.tsx"),
    read("app/game-data.ts"),
    read("app/globals.css"),
    read("app/api/local-events/route.ts"),
    read("scripts/watch-agents.mjs"),
  ]);

  for (const name of ["James", "Ben", "Ollie", "Luc", "Miguel"]) assert.match(gameData, new RegExp(`name: "${name}"`));
  assert.match(page, /function roadRoute/);
  assert.match(page, /pointAlongRoute/);
  assert.match(page, /Choose your builder/);
  assert.match(page, /Clear finished/);
  assert.match(page, /Clear demo/);
  assert.match(page, /Remove task/);
  assert.match(page, /dismissedOrderIds/);
  assert.match(page, /role="alertdialog"/);
  assert.doesNotMatch(page, /window\.confirm/);
  assert.match(css, /@keyframes roadWalk/);
  assert.match(css, /\.confirm-scrim/);
  assert.match(gameData, /"returning"/);
  assert.match(gameData, /worksiteEnteredAt/);
  assert.match(gameData, /dismissedOrderIds: string\[\]/);
  assert.match(route, /agentName: ""/);
  assert.match(route, /phase === "started"/);
  assert.match(watcher, /phase: "started"/);
  assert.match(watcher, /phase: "ready"/);
  assert.match(page, /now - order\.worksiteEnteredAt >= 3500/);
});

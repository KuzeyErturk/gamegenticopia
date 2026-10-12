#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  claudeTemplate,
  collectDiff,
  fallbackTemplate,
  git,
  hash,
  postEvent,
  splitDiff,
} from "./watch-agents.mjs";

const execFile = promisify(execFileCallback);
const STATE_DIR = path.join(os.tmpdir(), "vibe-control-district", "claude-hooks");

function parseArgs(argv) {
  const options = {
    action: argv[0] === "stop" ? "stop" : "start",
    endpoint: "http://localhost:3000/api/local-events",
    useClaude: false,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--endpoint") options.endpoint = argv[++index] ?? options.endpoint;
    else if (value === "--claude-questions") options.useClaude = true;
    else if (value === "--no-ai") options.useClaude = false;
  }
  return options;
}

async function readStdin() {
  let text = "";
  for await (const chunk of process.stdin) text += chunk;
  return text ? JSON.parse(text) : {};
}

function statePath(input) {
  const sessionId = String(input.session_id ?? "unknown-session");
  const promptId = String(input.prompt_id ?? "active-prompt");
  return path.join(STATE_DIR, `${hash(`${sessionId}:${promptId}`).slice(0, 32)}.json`);
}

async function readState(file) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch {
      if (attempt === 7) return null;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  return null;
}

async function currentHead(root) {
  try {
    return (await git(root, ["rev-parse", "HEAD"])).trim();
  } catch {
    return "";
  }
}

function sectionHashes(sections) {
  return Object.fromEntries(sections.map((section) => [section.file, hash(section.text)]));
}

async function start(input, options, file) {
  const requested = path.resolve(String(input.cwd ?? process.cwd()));
  const root = (await git(requested, ["rev-parse", "--show-toplevel"])).trim();
  const baseline = await collectDiff(root);
  const promptId = String(input.prompt_id ?? `${Date.now()}`);
  const eventId = hash(`${input.session_id ?? "session"}:${promptId}`).slice(0, 24);
  const state = {
    eventId,
    root,
    projectName: path.basename(root),
    endpoint: options.endpoint,
    useClaude: options.useClaude,
    baselineHead: await currentHead(root),
    baselineHashes: sectionHashes(baseline),
    createdAt: Date.now(),
  };

  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(state), "utf8");
  const prompt = String(input.prompt ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
  await postEvent(options.endpoint, {
    eventId,
    phase: "started",
    projectName: state.projectName,
    taskSummary: prompt,
    source: "Claude",
    color: "#7f72b7",
  });
}

async function committedSections(root, baselineHead, finalHead) {
  if (!baselineHead || !finalHead || baselineHead === finalHead) return [];
  try {
    const diff = await git(root, ["diff", baselineHead, finalHead, "--no-ext-diff", "--unified=4", "--"]);
    return splitDiff(diff);
  } catch {
    return [];
  }
}

async function stop(state, file) {
  const current = await collectDiff(state.root);
  const changedWorkingTree = current.filter((section) => state.baselineHashes?.[section.file] !== hash(section.text));
  const committed = await committedSections(state.root, state.baselineHead, await currentHead(state.root));
  const sectionsByFile = new Map();
  for (const section of [...committed, ...changedWorkingTree]) {
    const existing = sectionsByFile.get(section.file);
    sectionsByFile.set(section.file, existing ? { ...section, text: `${existing.text}\n${section.text}` } : section);
  }
  const sections = [...sectionsByFile.values()];

  if (!sections.length) {
    await postEvent(state.endpoint, { eventId: state.eventId, phase: "canceled" });
    await unlink(file).catch(() => undefined);
    return;
  }

  let template = fallbackTemplate(state.projectName, sections);
  if (state.useClaude) {
    try {
      await execFile("claude", ["--version"], { timeout: 10_000 });
      template = await claudeTemplate(state.projectName, state.root, sections);
    } catch (error) {
      console.error(`Vibe Control District used local questions because Claude question generation failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  await postEvent(state.endpoint, {
    eventId: state.eventId,
    phase: "ready",
    projectName: state.projectName,
    source: "Claude",
    color: "#7f72b7",
    template,
  });
  await unlink(file).catch(() => undefined);
}

async function main() {
  if (process.env.VCD_HOOK_INTERNAL === "1") return;
  const options = parseArgs(process.argv.slice(2));
  const input = await readStdin();
  const file = statePath(input);
  if (options.action === "start") {
    await start(input, options, file);
    return;
  }
  const state = await readState(file);
  if (state) await stop(state, file);
}

main().catch((error) => {
  // Hooks must never block Claude Code. Errors remain visible in Claude's debug log.
  console.error(`Vibe Control District hook: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 0;
});

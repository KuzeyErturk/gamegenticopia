#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

function parseArgs(argv) {
  const options = { project: "", endpoint: "http://localhost:3000/api/local-events", useClaude: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--project") options.project = argv[++index] ?? "";
    else if (value === "--endpoint") options.endpoint = argv[++index] ?? options.endpoint;
    else if (value === "--claude-questions") options.useClaude = true;
    else if (value === "--no-ai") options.useClaude = false;
    else if (value === "--help" || value === "-h") options.help = true;
  }
  return options;
}

function usage() {
  console.log(`
Install Vibe Control District lifecycle hooks into a local Claude Code project.

Usage:
  npm run install:claude-hooks -- --project /absolute/path/to/project --claude-questions

Options:
  --project <path>       Target Git repository (required)
  --endpoint <url>       Local game endpoint
  --claude-questions     Use Claude Code to create semantic questions
  --no-ai                Keep question generation local (default)
`);
}

function withoutOldVcdHooks(groups) {
  if (!Array.isArray(groups)) return [];
  return groups.flatMap((group) => {
    if (!group || typeof group !== "object") return [];
    const hooks = Array.isArray(group.hooks)
      ? group.hooks.filter((hook) => !Array.isArray(hook?.args) || !hook.args.some((value) => String(value).includes("claude-hook.mjs")))
      : [];
    return hooks.length ? [{ ...group, hooks }] : [];
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help || !options.project) {
    usage();
    process.exitCode = options.help ? 0 : 1;
    return;
  }

  const requested = path.resolve(options.project);
  const { stdout } = await execFile("git", ["-C", requested, "rev-parse", "--show-toplevel"]);
  const root = stdout.trim();
  const settingsPath = path.join(root, ".claude", "settings.local.json");
  let settings = {};
  try {
    settings = JSON.parse(await readFile(settingsPath, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw new Error(`${settingsPath} is not valid JSON.`);
  }

  const hookScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "claude-hook.mjs");
  const mode = options.useClaude ? "--claude-questions" : "--no-ai";
  const handler = (action) => ({
    type: "command",
    command: "node",
    args: [hookScript, action, "--endpoint", options.endpoint, mode],
    timeout: action === "start" ? 15 : 180,
    ...(action === "stop" ? { async: true } : {}),
  });
  const hooks = settings.hooks && typeof settings.hooks === "object" ? settings.hooks : {};
  settings.hooks = {
    ...hooks,
    UserPromptSubmit: [...withoutOldVcdHooks(hooks.UserPromptSubmit), { matcher: "", hooks: [handler("start")] }],
    Stop: [...withoutOldVcdHooks(hooks.Stop), { matcher: "", hooks: [handler("stop")] }],
  };

  await mkdir(path.dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  const { stdout: excludeOutput } = await execFile("git", ["-C", root, "rev-parse", "--git-path", "info/exclude"]);
  const excludePath = path.isAbsolute(excludeOutput.trim()) ? excludeOutput.trim() : path.join(root, excludeOutput.trim());
  let exclude = "";
  try { exclude = await readFile(excludePath, "utf8"); } catch { /* Git creates it lazily. */ }
  if (!exclude.split(/\r?\n/).includes(".claude/settings.local.json")) {
    await mkdir(path.dirname(excludePath), { recursive: true });
    await writeFile(excludePath, `${exclude}${exclude && !exclude.endsWith("\n") ? "\n" : ""}.claude/settings.local.json\n`, "utf8");
  }
  console.log(`Installed local Claude Code hooks in ${settingsPath}`);
  console.log(options.useClaude
    ? "Questions will be generated through your authenticated Claude Code CLI."
    : "Questions will use the local fallback; no diff is sent to an AI service.");
  console.log("Restart Claude Code in that project, or open /hooks to verify the two hooks.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

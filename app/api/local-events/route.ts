import { createInitialGameState, type ChangeEvidence, type Difficulty, type GameState, type OrderTemplate, type Question, type Stage, type WorkOrder } from "../../game-data";
import { readVillageState, writeVillageState } from "../../../db/village-state";

export const dynamic = "force-dynamic";

const LOCAL_OWNER = "local-demo-owner";
const difficulties: Difficulty[] = ["Beginner", "Builder", "Expert"];

function isLocalRequest(request: Request) {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function readQuestion(value: unknown): Question | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const answers = Array.isArray(raw.answers) ? raw.answers.map((answer) => cleanText(answer, 240)) : [];
  const correct = typeof raw.correct === "number" ? raw.correct : -1;
  if (!cleanText(raw.prompt, 360) || !cleanText(raw.context, 600) || answers.length !== 3 || answers.some((answer) => !answer) || !Number.isInteger(correct) || correct < 0 || correct > 2) return null;
  return {
    prompt: cleanText(raw.prompt, 360),
    context: cleanText(raw.context, 600),
    answers: answers as [string, string, string],
    correct,
    explanation: cleanText(raw.explanation, 600) || "The highlighted change supports this answer.",
  };
}

function readEvidence(value: unknown): ChangeEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    const file = cleanText(raw.file, 240);
    if (!file || !Array.isArray(raw.lines)) return [];
    const lines = raw.lines.slice(0, 18).flatMap((line) => {
      if (!line || typeof line !== "object") return [];
      const item = line as Record<string, unknown>;
      const kind = item.kind === "add" || item.kind === "remove" ? item.kind : "context";
      const code = cleanText(item.code, 500);
      return code ? [{ kind, code }] : [];
    });
    return lines.length ? [{ file, note: cleanText(raw.note, 500) || "Inspect these changed lines before answering.", lines }] : [];
  });
}

function readTemplate(value: unknown, templateId: string): OrderTemplate | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const files = Array.isArray(raw.files) ? raw.files.map((file) => cleanText(file, 240)).filter(Boolean).slice(0, 30) : [];
  const rawStages = Array.isArray(raw.stages) ? raw.stages.slice(0, 4) : [];
  const stages: Stage[] = [];
  for (const stageValue of rawStages) {
    if (!stageValue || typeof stageValue !== "object") return null;
    const stageRaw = stageValue as Record<string, unknown>;
    const rawQuestions = stageRaw.questions && typeof stageRaw.questions === "object" ? stageRaw.questions as Record<string, unknown> : {};
    const questions = {} as Record<Difficulty, Question>;
    for (const difficulty of difficulties) {
      const question = readQuestion(rawQuestions[difficulty]);
      if (!question) return null;
      questions[difficulty] = question;
    }
    stages.push({
      name: cleanText(stageRaw.name, 100) || `Review stage ${stages.length + 1}`,
      questions,
      evidence: readEvidence(stageRaw.evidence),
    });
  }
  if (!files.length || !stages.length) return null;
  const complexity = raw.complexity === "Small" || raw.complexity === "Large" ? raw.complexity : "Medium";
  return {
    id: templateId,
    title: cleanText(raw.title, 160) || "Review local code changes",
    summary: cleanText(raw.summary, 600) || "A local coding agent changed files in the watched repository.",
    fileCount: files.length,
    files,
    complexity,
    stages,
  };
}

function pendingTemplate(templateId: string, projectName: string, taskSummary: string): OrderTemplate {
  const pendingQuestion: Question = {
    prompt: "What changed in this work session?",
    context: "The agent is still writing. The real question will replace this placeholder when the Git diff settles.",
    answers: ["Wait for the completed diff", "Guess from the filename", "Skip the review"],
    correct: 0,
    explanation: "The finished diff is required before the understanding check can be created.",
  };
  return {
    id: templateId,
    title: taskSummary ? `Claude is working: ${taskSummary}` : `Agent working in ${projectName || "local project"}`,
    summary: "The real coding turn has started. Choose a district agent and a village project while Claude is still working.",
    fileCount: 0,
    files: [],
    complexity: "Medium",
    stages: [{ name: "Waiting for code", questions: { Beginner: pendingQuestion, Builder: pendingQuestion, Expert: pendingQuestion }, evidence: [] }],
  };
}

export async function GET(request: Request) {
  if (!isLocalRequest(request)) return Response.json({ error: "Local connector is disabled on hosted deployments" }, { status: 403 });
  return Response.json({ ok: true, connector: "vibe-control-district" });
}

export async function POST(request: Request) {
  if (!isLocalRequest(request)) return Response.json({ error: "Local connector is disabled on hosted deployments" }, { status: 403 });
  try {
    const payload = await request.json() as Record<string, unknown>;
    if (JSON.stringify(payload).length > 100_000) return Response.json({ error: "Agent event is too large" }, { status: 413 });
    const eventToken = cleanText(payload.eventId, 80).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    if (!eventToken) return Response.json({ error: "Missing eventId" }, { status: 400 });
    const templateId = `live-template-${eventToken}`;
    const orderId = `live-${eventToken}`;

    const saved = await readVillageState(LOCAL_OWNER);
    const fallback = createInitialGameState();
    const current = saved?.state && (saved.state as { version?: unknown }).version === 2
      ? { ...fallback, ...(saved.state as GameState), liveTemplates: (saved.state as GameState).liveTemplates ?? {}, dismissedOrderIds: (saved.state as GameState).dismissedOrderIds ?? [], roads: (saved.state as GameState).roads ?? fallback.roads }
      : fallback;
    if (current.dismissedOrderIds.includes(orderId)) return Response.json({ ok: true, dismissed: true, orderId });

    const source = payload.source === "Codex" || payload.source === "Terminal" || payload.source === "New agent" ? payload.source : "Claude";
    const phase = payload.phase === "started" || payload.phase === "canceled" ? payload.phase : "ready";
    const existing = current.orders.find((order) => order.id === orderId);

    if (phase === "canceled") {
      const remainingTemplates = { ...current.liveTemplates };
      delete remainingTemplates[templateId];
      const next: GameState = {
        ...current,
        orders: current.orders.filter((order) => order.id !== orderId),
        liveTemplates: remainingTemplates,
      };
      await writeVillageState(LOCAL_OWNER, next);
      return Response.json({ ok: true, phase, orderId, removed: Boolean(existing) });
    }

    if (phase === "started") {
      if (existing) return Response.json({ ok: true, duplicate: true, phase, orderId });
      const template = pendingTemplate(templateId, cleanText(payload.projectName, 100), cleanText(payload.taskSummary, 180));
      const order: WorkOrder = {
        id: orderId,
        templateId,
        agentName: "",
        source,
        color: cleanText(payload.color, 20) || "#849087",
        status: "unassigned",
        targetId: null,
        stageIndex: 0,
        readyAt: null,
        startedAt: null,
        walking: false,
        travelEndsAt: null,
        returnStartedAt: null,
        returnEndsAt: null,
        external: true,
        questionsReady: false,
      };
      const next: GameState = { ...current, orders: [...current.orders, order], liveTemplates: { ...current.liveTemplates, [templateId]: template } };
      await writeVillageState(LOCAL_OWNER, next);
      return Response.json({ ok: true, duplicate: false, phase, orderId });
    }

    const template = readTemplate(payload.template, templateId);
    if (!template) return Response.json({ error: "Invalid question template" }, { status: 400 });
    const order: WorkOrder = {
      id: orderId,
      templateId,
      agentName: "",
      source,
      color: cleanText(payload.color, 20) || "#849087",
      status: "unassigned",
      targetId: null,
      stageIndex: 0,
      readyAt: null,
      startedAt: null,
      walking: false,
      travelEndsAt: null,
      returnStartedAt: null,
      returnEndsAt: null,
      external: true,
      questionsReady: true,
    };
    const next: GameState = {
      ...current,
      orders: existing
        ? current.orders.map((item) => item.id === orderId ? { ...item, external: true, questionsReady: true } : item)
        : [...current.orders, order],
      liveTemplates: { ...current.liveTemplates, [templateId]: template },
    };
    await writeVillageState(LOCAL_OWNER, next);
    return Response.json({ ok: true, duplicate: false, phase, orderId, stages: template.stages.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not accept local agent event" }, { status: 500 });
  }
}

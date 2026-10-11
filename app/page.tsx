"use client";

import {
  Activity,
  Armchair,
  ArrowLeft,
  Check,
  ChevronDown,
  CircleHelp,
  CircleUserRound,
  Coins,
  Construction,
  FileCode2,
  Grid3X3,
  Hammer,
  House,
  Info,
  Lamp,
  LibraryBig,
  ListTodo,
  LocateFixed,
  LockKeyhole,
  Minus,
  Move,
  Package,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Timer,
  Trash2,
  Trees,
  Trophy,
  UsersRound,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  agentRoster,
  createInitialGameState,
  orderTemplates,
  releaseEvidence,
  shopItems,
  villageLevel,
  type Difficulty,
  type GameState,
  type PanelMode,
  type Question,
  type RoadSegment,
  type VillageObject,
  type WorkOrder,
} from "./game-data";

type AnswerState = "idle" | "correct" | "wrong";
type Point = { x: number; y: number };
type Confirmation = { title: string; message: string; confirmLabel: string; onConfirm: () => void };

const demoOrderIds = new Set(["order-reset", "order-search", "order-schema"]);
const legacyAgentNames: Record<string, string> = { Milo: "James", Ivy: "Ben", Pip: "Ollie" };

function agentClass(name: string) {
  return name ? `avatar-${name.toLowerCase()}` : "avatar-unassigned";
}

function normalizeOrders(orders: WorkOrder[]) {
  return orders.map((order, index) => {
    const migratedName = legacyAgentNames[order.agentName] ?? order.agentName;
    const knownAgent = agentRoster.find((agent) => agent.name === migratedName);
    const fallbackAgent = agentRoster[index % agentRoster.length];
    const agent = knownAgent ?? (order.status === "unassigned" ? null : fallbackAgent);
    return {
      ...order,
      agentName: agent?.name ?? "",
      color: agent?.color ?? order.color ?? "#849087",
      startedAt: order.startedAt ?? null,
      walking: order.walking ?? false,
      travelEndsAt: order.travelEndsAt ?? null,
      returnStartedAt: order.returnStartedAt ?? null,
      returnEndsAt: order.returnEndsAt ?? null,
      external: order.external ?? order.id.startsWith("live-"),
      questionsReady: order.questionsReady ?? true,
    };
  });
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointKey(point: Point) {
  return `${Math.round(point.x * 10) / 10}:${Math.round(point.y * 10) / 10}`;
}

function roadLine(road: RoadSegment) {
  return road.orientation === "horizontal"
    ? { id: road.id, orientation: road.orientation, x1: road.x, y1: road.y + 26, x2: road.x + road.length, y2: road.y + 26 }
    : { id: road.id, orientation: road.orientation, x1: road.x + 26, y1: road.y, x2: road.x + 26, y2: road.y + road.length };
}

function projectToRoad(point: Point, line: ReturnType<typeof roadLine>): Point {
  return line.orientation === "horizontal"
    ? { x: Math.max(line.x1, Math.min(line.x2, point.x)), y: line.y1 }
    : { x: line.x1, y: Math.max(line.y1, Math.min(line.y2, point.y)) };
}

function roadRoute(start: Point, end: Point, roads: RoadSegment[]) {
  if (!roads.length) return [start, end];
  const lines = roads.map(roadLine);
  const nearest = (point: Point) => lines.reduce((best, line) => {
    const projected = projectToRoad(point, line);
    const gap = distance(point, projected);
    return gap < best.gap ? { line, projected, gap } : best;
  }, { line: lines[0], projected: projectToRoad(point, lines[0]), gap: Number.POSITIVE_INFINITY });
  const startRoad = nearest(start);
  const endRoad = nearest(end);
  const pointsByRoad = new Map(lines.map((line) => [line.id, [{ x: line.x1, y: line.y1 }, { x: line.x2, y: line.y2 }]]));

  for (let firstIndex = 0; firstIndex < lines.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < lines.length; secondIndex += 1) {
      const first = lines[firstIndex];
      const second = lines[secondIndex];
      if (first.orientation === second.orientation) continue;
      const horizontal = first.orientation === "horizontal" ? first : second;
      const vertical = first.orientation === "vertical" ? first : second;
      if (vertical.x1 >= horizontal.x1 && vertical.x1 <= horizontal.x2 && horizontal.y1 >= vertical.y1 && horizontal.y1 <= vertical.y2) {
        const intersection = { x: vertical.x1, y: horizontal.y1 };
        pointsByRoad.get(first.id)?.push(intersection);
        pointsByRoad.get(second.id)?.push(intersection);
      }
    }
  }
  pointsByRoad.get(startRoad.line.id)?.push(startRoad.projected);
  pointsByRoad.get(endRoad.line.id)?.push(endRoad.projected);

  const graph = new Map<string, { key: string; cost: number }[]>();
  const points = new Map<string, Point>();
  const connect = (a: Point, b: Point) => {
    const aKey = pointKey(a);
    const bKey = pointKey(b);
    points.set(aKey, a);
    points.set(bKey, b);
    graph.set(aKey, [...(graph.get(aKey) ?? []), { key: bKey, cost: distance(a, b) }]);
    graph.set(bKey, [...(graph.get(bKey) ?? []), { key: aKey, cost: distance(a, b) }]);
  };
  for (const line of lines) {
    const ordered = [...new Map((pointsByRoad.get(line.id) ?? []).map((point) => [pointKey(point), point])).values()]
      .sort((a, b) => line.orientation === "horizontal" ? a.x - b.x : a.y - b.y);
    for (let index = 1; index < ordered.length; index += 1) connect(ordered[index - 1], ordered[index]);
  }

  const source = pointKey(startRoad.projected);
  const destination = pointKey(endRoad.projected);
  const costs = new Map<string, number>([[source, 0]]);
  const previous = new Map<string, string>();
  const pending = new Set(graph.keys());
  while (pending.size) {
    let current = "";
    let currentCost = Number.POSITIVE_INFINITY;
    for (const key of pending) {
      const cost = costs.get(key) ?? Number.POSITIVE_INFINITY;
      if (cost < currentCost) { current = key; currentCost = cost; }
    }
    if (!current || current === destination) break;
    pending.delete(current);
    for (const edge of graph.get(current) ?? []) {
      const nextCost = currentCost + edge.cost;
      if (nextCost < (costs.get(edge.key) ?? Number.POSITIVE_INFINITY)) {
        costs.set(edge.key, nextCost);
        previous.set(edge.key, current);
      }
    }
  }

  if (!costs.has(destination)) return [start, startRoad.projected, endRoad.projected, end];
  const roadPoints: Point[] = [];
  let cursor: string | undefined = destination;
  while (cursor) {
    const point = points.get(cursor);
    if (point) roadPoints.unshift(point);
    if (cursor === source) break;
    cursor = previous.get(cursor);
  }
  return [start, ...roadPoints, end].filter((point, index, route) => index === 0 || pointKey(point) !== pointKey(route[index - 1]));
}

function pointAlongRoute(route: Point[], progress: number) {
  if (route.length < 2) return route[0] ?? { x: 0, y: 0 };
  const lengths = route.slice(1).map((point, index) => distance(route[index], point));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  let remaining = Math.max(0, Math.min(1, progress)) * total;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index]) {
      const ratio = lengths[index] ? remaining / lengths[index] : 0;
      return {
        x: route[index].x + (route[index + 1].x - route[index].x) * ratio,
        y: route[index].y + (route[index + 1].y - route[index].y) * ratio,
      };
    }
    remaining -= lengths[index];
  }
  return route[route.length - 1];
}

const futureLots = [
  { id: "future-1", x: 110, y: 300 },
  { id: "future-2", x: 575, y: 105 },
  { id: "future-3", x: 910, y: 175 },
  { id: "future-4", x: 1160, y: 350 },
  { id: "future-5", x: 660, y: 710 },
  { id: "future-6", x: 1450, y: 520 },
];

const releaseQuestion: Record<Difficulty, Question> = {
  Beginner: {
    prompt: "What did this release improve overall?",
    context: "The agents added password recovery, rebuilt search, and recorded deployment history.",
    answers: ["Account recovery, product finding, and project visibility", "Only the village colors", "A train timetable"],
    correct: 0,
    explanation: "The release improves three real user journeys across account, search, and project status.",
  },
  Builder: {
    prompt: "Why should these changes be reviewed together before deployment?",
    context: "Authentication, search state, and database history cross different parts of the product.",
    answers: ["Their integration can fail even when each part works alone", "They use the same CSS color", "It makes the commit shorter"],
    correct: 0,
    explanation: "A release-level check catches assumptions and interactions that isolated checks miss.",
  },
  Expert: {
    prompt: "What is the shared release risk across these changes?",
    context: "They alter user identity, asynchronous results, and persisted data.",
    answers: ["Incorrect state crossing a trust or timing boundary", "The browser choosing a serif font", "Images becoming square"],
    correct: 0,
    explanation: "Each change crosses a boundary where stale, false, or unauthorized state would matter.",
  },
};

function ObjectGlyph({ kind, size = 22 }: { kind: string; size?: number }) {
  if (kind === "tree") return <Trees size={size} />;
  if (kind === "bench") return <Armchair size={size} />;
  if (kind === "lamp") return <Lamp size={size} />;
  if (kind === "fountain") return <Sparkles size={size} />;
  if (kind === "library") return <LibraryBig size={size} />;
  if (kind === "bakery") return <Store size={size} />;
  if (kind === "guild") return <Warehouse size={size} />;
  if (kind === "tower") return <Trophy size={size} />;
  if (kind === "forge") return <Hammer size={size} />;
  return <House size={size} />;
}

function CodeBlockMark() {
  return <span className="code-block-mark" aria-hidden="true">{Array.from({ length: 13 }, (_, index) => <i key={index} />)}</span>;
}

function statusCopy(order: WorkOrder) {
  if (order.status === "review") return "Question ready";
  if (order.status === "returning") return "Returning to Guild";
  if (order.status === "working") return order.external ? order.questionsReady ? "Questions loaded" : "Agent live" : "Building";
  if (order.status === "complete") return "Understood";
  return order.agentName ? "Needs a project" : "Needs an agent";
}

export default function Home() {
  const [game, setGame] = useState<GameState>(() => createInitialGameState());
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"loading" | "saving" | "saved" | "offline">("loading");
  const [panelMode, setPanelMode] = useState<PanelMode>("orders");
  const [selectedOrderId, setSelectedOrderId] = useState("order-reset");
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [placementItemId, setPlacementItemId] = useState<string | null>(null);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [chosen, setChosen] = useState<number | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [zoom, setZoom] = useState(0.72);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingRoadId, setDraggingRoadId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [panDrag, setPanDrag] = useState<{ start: Point; origin: Point } | null>(null);
  const [toast, setToast] = useState("James finished a code stage. One question is waiting.");
  const [clock, setClock] = useState(() => Date.now());
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const readyQuestionIdsRef = useRef<Set<string>>(new Set());
  const dismissedOrderIdsRef = useRef<Set<string>>(new Set());
  knownOrderIdsRef.current = new Set(game.orders.map((order) => order.id));
  readyQuestionIdsRef.current = new Set(game.orders.filter((order) => order.questionsReady).map((order) => order.id));
  dismissedOrderIdsRef.current = new Set(game.dismissedOrderIds);

  const allTemplates = useMemo(() => ({ ...orderTemplates, ...game.liveTemplates }), [game.liveTemplates]);
  const selectedOrder = game.orders.find((order) => order.id === selectedOrderId) ?? null;
  const selectedTemplate = selectedOrder ? allTemplates[selectedOrder.templateId] : null;
  const selectedStage = selectedOrder && selectedTemplate ? selectedTemplate.stages[selectedOrder.stageIndex] : null;
  const selectedQuestion = releaseOpen ? releaseQuestion[game.difficulty] : selectedStage?.questions[game.difficulty] ?? null;
  const demoOrders = game.orders.filter((order) => demoOrderIds.has(order.id));
  const releaseReady = demoOrders.length === demoOrderIds.size && demoOrders.every((order) => order.status === "complete");
  const activeOrders = game.orders.filter((order) => order.status === "working" || order.status === "returning");
  const completedOrders = game.orders.filter((order) => order.status === "complete");
  const busyAgentNames = useMemo(() => new Set(game.orders.filter((order) => order.status === "working" || order.status === "returning").map((order) => order.agentName).filter(Boolean)), [game.orders]);
  const inventoryCount = game.inventory.reduce((total, item) => total + item.quantity, 0);
  const level = villageLevel(game.xp);

  useEffect(() => {
    let active = true;
    fetch("/api/village")
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        if (payload.state?.version === 2) {
          const fallback = createInitialGameState();
          setGame({
            ...fallback,
            ...payload.state,
            roads: Array.isArray(payload.state.roads) ? payload.state.roads : fallback.roads,
            orders: Array.isArray(payload.state.orders) ? normalizeOrders(payload.state.orders as WorkOrder[]) : fallback.orders,
            liveTemplates: payload.state.liveTemplates && typeof payload.state.liveTemplates === "object" ? payload.state.liveTemplates : {},
            dismissedOrderIds: Array.isArray(payload.state.dismissedOrderIds) ? payload.state.dismissedOrderIds : [],
          });
        }
        setHydrated(true);
        setSaveStatus("saved");
      })
      .catch(() => {
        if (!active) return;
        setHydrated(true);
        setSaveStatus("offline");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    const checkForLocalAgentWork = () => {
      fetch("/api/village")
        .then((response) => response.json())
        .then((payload) => {
          if (!active || payload.state?.version !== 2) return;
          const remoteOrders = Array.isArray(payload.state.orders) ? payload.state.orders as WorkOrder[] : [];
          const remoteTemplates = payload.state.liveTemplates && typeof payload.state.liveTemplates === "object" ? payload.state.liveTemplates : {};
          const visibleRemoteOrders = normalizeOrders(remoteOrders.filter((order) => order.id.startsWith("live-") && !dismissedOrderIdsRef.current.has(order.id)));
          const incoming = visibleRemoteOrders.filter((order) => !knownOrderIdsRef.current.has(order.id));
          const readyUpdates = visibleRemoteOrders.filter((order) => order.questionsReady && !readyQuestionIdsRef.current.has(order.id));
          if (!incoming.length && !readyUpdates.length) return;
          incoming.forEach((order) => knownOrderIdsRef.current.add(order.id));
          readyUpdates.forEach((order) => readyQuestionIdsRef.current.add(order.id));
          const readyIds = new Set(readyUpdates.map((order) => order.id));
          setGame((current) => ({
            ...current,
            orders: [...current.orders.map((order) => readyIds.has(order.id) ? { ...order, questionsReady: true } : order), ...incoming],
            liveTemplates: { ...current.liveTemplates, ...remoteTemplates },
          }));
          if (incoming.length) setToast(`${incoming.length} coding session ${incoming.length === 1 ? "has" : "have"} started. Choose an agent and worksite.`);
          else if (readyUpdates.length) setToast("File writing stopped. Questions are ready; an assigned worker will return to the Guild.");
        })
        .catch(() => undefined);
    };
    const timer = window.setInterval(checkForLocalAgentWork, 2200);
    return () => { active = false; window.clearInterval(timer); };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      fetch("/api/village", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: game }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("save failed");
          setSaveStatus("saved");
        })
        .catch(() => setSaveStatus("offline"));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [game, hydrated]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setClock(now);
      setGame((current) => {
        let changed = false;
        const orders = current.orders.map((order) => {
          if (order.status === "working" && order.external) {
            if (order.walking && order.travelEndsAt && order.travelEndsAt <= now) {
              changed = true;
              return order.questionsReady
                ? { ...order, status: "returning" as const, walking: false, startedAt: null, travelEndsAt: null, returnStartedAt: now, returnEndsAt: now + 6000 }
                : { ...order, walking: false, startedAt: null, travelEndsAt: null };
            }
            if (!order.walking && order.questionsReady) {
              changed = true;
              return { ...order, status: "returning" as const, returnStartedAt: now, returnEndsAt: now + 6000 };
            }
          }
          if (order.status === "returning" && order.returnEndsAt && order.returnEndsAt <= now) {
            changed = true;
            return { ...order, status: "review" as const, returnStartedAt: null, returnEndsAt: null };
          }
          if (order.status === "working" && order.readyAt && order.readyAt <= now) {
            changed = true;
            return { ...order, status: "review" as const, readyAt: null, startedAt: null, walking: false, travelEndsAt: null };
          }
          return order;
        });
        return changed ? { ...current, orders } : current;
      });
    }, 120);
    return () => window.clearInterval(timer);
  }, []);

  const clientToStage = useCallback((clientX: number, clientY: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [pan, zoom]);

  useEffect(() => {
    if (!draggingId && !draggingRoadId && !panDrag) return;
    const move = (event: PointerEvent) => {
      if (draggingId || draggingRoadId) {
        const point = clientToStage(event.clientX, event.clientY);
        const x = Math.max(40, Math.min(1480, Math.round((point.x - dragOffset.x) / 20) * 20));
        const y = Math.max(40, Math.min(820, Math.round((point.y - dragOffset.y) / 20) * 20));
        setGame((current) => draggingId
          ? { ...current, objects: current.objects.map((object) => object.id === draggingId ? { ...object, x, y } : object) }
          : { ...current, roads: current.roads.map((road) => road.id === draggingRoadId ? { ...road, x, y } : road) });
      } else if (panDrag) {
        setPan({ x: panDrag.origin.x + event.clientX - panDrag.start.x, y: panDrag.origin.y + event.clientY - panDrag.start.y });
      }
    };
    const up = () => { setDraggingId(null); setDraggingRoadId(null); setPanDrag(null); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [clientToStage, dragOffset, draggingId, draggingRoadId, panDrag]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const busyTargetIds = useMemo(() => new Set(game.orders.filter((order) => order.status !== "complete" && order.targetId).map((order) => order.targetId)), [game.orders]);

  function openOrder(orderId: string) {
    setSelectedOrderId(orderId);
    setPanelMode("order");
    setReleaseOpen(false);
    setAnswerState("idle");
    setChosen(null);
  }

  function beginAssignment(orderId: string) {
    const order = game.orders.find((item) => item.id === orderId);
    if (!order?.agentName) {
      setToast("Choose a free agent before selecting a village project.");
      return;
    }
    if (busyAgentNames.has(order.agentName)) {
      setToast(`${order.agentName} is already working. Choose another agent.`);
      return;
    }
    setAssigningOrderId(orderId);
    setPlacementItemId(null);
    setArrangeMode(false);
    setToast("Choose any free building or construction site on the map.");
  }

  function assignOrder(orderId: string, objectId: string) {
    if (busyTargetIds.has(objectId)) {
      setToast("That place already has a worker. Choose another project.");
      return;
    }
    const startedAt = Date.now();
    setGame((current) => ({
      ...current,
      orders: current.orders.map((order) => order.id === orderId ? {
        ...order,
        targetId: objectId,
        status: "working",
        startedAt,
        travelEndsAt: startedAt + 7000,
        readyAt: order.external ? null : startedAt + 11000,
        walking: true,
      } : order),
    }));
    const order = game.orders.find((item) => item.id === orderId);
    const object = game.objects.find((item) => item.id === objectId);
    setAssigningOrderId(null);
    setToast(`${order?.agentName ?? "Your agent"} is walking to ${object?.name ?? "the worksite"}.`);
    openOrder(orderId);
  }

  function finishSimulatedWork(orderId: string) {
    setGame((current) => ({ ...current, orders: current.orders.map((order) => order.id === orderId ? { ...order, status: "review", readyAt: null, startedAt: null, walking: false } : order) }));
    setAnswerState("idle");
    setChosen(null);
    setToast("The agent stopped. Explain the change to continue construction.");
  }

  function answer(index: number) {
    if (!selectedQuestion || answerState === "correct") return;
    setChosen(index);
    if (index !== selectedQuestion.correct) {
      setAnswerState("wrong");
      setGame((current) => ({ ...current, streak: 0 }));
      return;
    }
    setAnswerState("correct");
    if (releaseOpen) {
      setGame((current) => ({ ...current, releaseApproved: true, coins: current.coins + 80, xp: current.xp + 120, streak: current.streak + 1 }));
      setToast("Release approved. The Launch Tower is live!");
      return;
    }
    if (!selectedOrder || !selectedTemplate) return;
    const finalStage = selectedOrder.stageIndex >= selectedTemplate.stages.length - 1;
    const resumedAt = Date.now();
    setGame((current) => ({
      ...current,
      coins: current.coins + (finalStage ? 30 : 12),
      xp: current.xp + (finalStage ? 55 : 25),
      streak: current.streak + 1,
      orders: current.orders.map((order) => order.id === selectedOrder.id ? {
        ...order,
        stageIndex: finalStage ? order.stageIndex : order.stageIndex + 1,
        status: finalStage ? "complete" : order.external ? "review" : "working",
        readyAt: finalStage || order.external ? null : resumedAt + 7000,
        startedAt: finalStage || order.external ? null : resumedAt,
        walking: false,
      } : order),
      objects: finalStage ? current.objects.map((object) => object.id === selectedOrder.targetId ? { ...object, built: true, level: Math.max(1, object.level + 1) } : object) : current.objects,
    }));
    window.setTimeout(() => { setAnswerState("idle"); setChosen(null); }, 900);
    setToast(finalStage ? "Upgrade complete. Your worker is back at the Guild." : selectedOrder.external ? "Stage cleared. The next question is ready." : "Stage cleared. The worker has resumed construction.");
  }

  function chooseAgent(orderId: string, agentName: string) {
    const agent = agentRoster.find((entry) => entry.name === agentName);
    if (!agent || busyAgentNames.has(agent.name)) return;
    setGame((current) => ({
      ...current,
      orders: current.orders.map((order) => order.id === orderId ? { ...order, agentName: agent.name, color: agent.color } : order),
    }));
    setToast(`${agent.name} is ready. Now choose what to build or upgrade.`);
  }

  function removeOrders(orderIds: string[], message: string) {
    const ids = new Set(orderIds);
    if (!ids.size) return;
    setGame((current) => {
      const removedTemplateIds = new Set(current.orders.filter((order) => ids.has(order.id)).map((order) => order.templateId));
      const liveTemplates = { ...current.liveTemplates };
      removedTemplateIds.forEach((templateId) => { delete liveTemplates[templateId]; });
      return {
        ...current,
        orders: current.orders.filter((order) => !ids.has(order.id)),
        liveTemplates,
        dismissedOrderIds: [...new Set([...current.dismissedOrderIds, ...orderIds])],
      };
    });
    if (ids.has(selectedOrderId)) {
      setSelectedOrderId("");
      setPanelMode("orders");
      setReleaseOpen(false);
    }
    setAssigningOrderId(null);
    setToast(message);
  }

  function clearCompletedOrders() {
    if (!completedOrders.length) return;
    setConfirmation({
      title: "Clear finished tasks?",
      message: `${completedOrders.length} completed ${completedOrders.length === 1 ? "task" : "tasks"} will leave the list. Village upgrades, XP, and coins will stay.`,
      confirmLabel: "Clear finished",
      onConfirm: () => removeOrders(completedOrders.map((order) => order.id), "Completed task history cleared. Village progress was kept."),
    });
  }

  function clearDemoTasks() {
    const ids = game.orders.filter((order) => demoOrderIds.has(order.id)).map((order) => order.id);
    if (!ids.length) return;
    setConfirmation({
      title: "Clear simulator tasks?",
      message: "The three built-in tasks will be removed. Your village layout and live local tasks will stay.",
      confirmLabel: "Clear demo",
      onConfirm: () => removeOrders(ids, "Simulator tasks cleared. The district is ready for your real project."),
    });
  }

  function removeOrder(orderId: string) {
    const order = game.orders.find((item) => item.id === orderId);
    if (!order || (order.status !== "unassigned" && order.status !== "complete")) return;
    setConfirmation({
      title: "Remove this task?",
      message: order.status === "complete" ? "The task card will be removed, but its village upgrade and rewards will stay." : "This unassigned task and its generated questions will be removed.",
      confirmLabel: "Remove task",
      onConfirm: () => removeOrders([orderId], "Task removed from the district."),
    });
  }

  function buyItem(itemId: string) {
    const item = shopItems.find((entry) => entry.id === itemId);
    if (!item) return;
    if (game.coins < item.price) {
      setToast("You need a few more coins for that blueprint.");
      return;
    }
    setGame((current) => {
      const existing = current.inventory.find((entry) => entry.itemId === itemId);
      return {
        ...current,
        coins: current.coins - item.price,
        inventory: existing
          ? current.inventory.map((entry) => entry.itemId === itemId ? { ...entry, quantity: entry.quantity + 1 } : entry)
          : [...current.inventory, { itemId, quantity: 1 }],
      };
    });
    setToast(`${item.name} added to your blueprint inventory.`);
  }

  function beginPlacement(itemId: string) {
    setPlacementItemId(itemId);
    setAssigningOrderId(null);
    setArrangeMode(false);
    setToast("Click an open patch of land to place the blueprint.");
  }

  function placeBlueprint(clientX: number, clientY: number) {
    if (!placementItemId) return;
    const item = shopItems.find((entry) => entry.id === placementItemId);
    if (!item) return;
    const point = clientToStage(clientX, clientY);
    const id = `${item.id}-${Date.now()}`;
    const object: VillageObject = {
      id,
      kind: item.id,
      name: item.name,
      category: item.category,
      x: Math.max(50, Math.min(1470, Math.round((point.x - 65) / 20) * 20)),
      y: Math.max(50, Math.min(820, Math.round((point.y - 70) / 20) * 20)),
      level: 0,
      built: false,
    };
    setGame((current) => ({
      ...current,
      objects: [...current.objects, object],
      inventory: current.inventory.map((entry) => entry.itemId === placementItemId ? { ...entry, quantity: entry.quantity - 1 } : entry).filter((entry) => entry.quantity > 0),
    }));
    setPlacementItemId(null);
    setPanelMode("orders");
    setToast("Blueprint placed. Assign an unassigned agent task to build it.");
  }

  function startObjectDrag(event: React.PointerEvent, object: VillageObject) {
    if (!arrangeMode || object.fixed || !object.built) return;
    event.preventDefault();
    event.stopPropagation();
    const point = clientToStage(event.clientX, event.clientY);
    setDraggingId(object.id);
    setDragOffset({ x: point.x - object.x, y: point.y - object.y });
  }

  function startRoadDrag(event: React.PointerEvent, road: RoadSegment) {
    if (!arrangeMode) return;
    event.preventDefault();
    event.stopPropagation();
    const point = clientToStage(event.clientX, event.clientY);
    setDraggingRoadId(road.id);
    setDragOffset({ x: point.x - road.x, y: point.y - road.y });
  }

  function rotateRoad(event: React.MouseEvent | React.KeyboardEvent, roadId: string) {
    if (!arrangeMode) return;
    event.preventDefault();
    event.stopPropagation();
    setGame((current) => ({
      ...current,
      roads: current.roads.map((road) => road.id === roadId
        ? { ...road, orientation: road.orientation === "horizontal" ? "vertical" : "horizontal" }
        : road),
    }));
    setToast("Road rotated. Drag it to reconnect the district.");
  }

  function resetVillage() {
    setGame(createInitialGameState());
    setPanelMode("orders");
    setSelectedOrderId("order-reset");
    setReleaseOpen(false);
    setAssigningOrderId(null);
    setPlacementItemId(null);
    setArrangeMode(false);
    setToast("Fresh district loaded.");
  }

  function openLaunchTower() {
    if (!releaseReady) {
      setToast(`${demoOrders.filter((order) => order.status !== "complete").length} demo projects still need understanding checks.`);
      return;
    }
    setReleaseOpen(true);
    setPanelMode("order");
    setSelectedOrderId("");
    setAnswerState("idle");
    setChosen(null);
  }

  function objectClick(object: VillageObject) {
    if (assigningOrderId) {
      assignOrder(assigningOrderId, object.id);
      return;
    }
    if (object.id === "launch") openLaunchTower();
  }

  function renderOrderPanel() {
    if (releaseOpen) {
      return (
        <div className="panel-scroll">
          <div className={`release-card ${game.releaseApproved ? "approved" : ""}`}>
            <div className="release-seal">{game.releaseApproved ? <Trophy size={34} /> : <ShieldCheck size={34} />}</div>
            <p className="eyebrow">RELEASE INSPECTION</p>
            <h3>{game.releaseApproved ? "The district is shipping" : "One final understanding check"}</h3>
            <p>{game.releaseApproved ? "Every core work order has been understood and the release is approved." : "Explain how the completed agent work fits together before opening the tower."}</p>
          </div>
          {!game.releaseApproved && selectedQuestion && renderQuiz(selectedQuestion, "Final question")}
        </div>
      );
    }
    if (!selectedOrder || !selectedTemplate) return null;
    const target = game.objects.find((object) => object.id === selectedOrder.targetId);
    const seconds = selectedOrder.readyAt ? Math.max(0, Math.ceil((selectedOrder.readyAt - clock) / 1000)) : 0;
    const returnSeconds = selectedOrder.returnEndsAt ? Math.max(0, Math.ceil((selectedOrder.returnEndsAt - clock) / 1000)) : 0;
    const progress = selectedOrder.status === "complete" ? 100 : Math.round((selectedOrder.stageIndex / selectedTemplate.stages.length) * 100);
    return (
      <div className="panel-scroll">
        <button className="back-button" onClick={() => { setPanelMode("orders"); setAssigningOrderId(null); }}><ArrowLeft size={15} /> All work orders</button>
        <div className="agent-hero" style={{ "--agent": selectedOrder.color } as React.CSSProperties}>
          <div className="portrait">{selectedOrder.agentName ? <span className={`pixel-avatar ${agentClass(selectedOrder.agentName)}`}><i /><i /><i /></span> : <UsersRound size={25} />}</div>
          <div><span>{selectedOrder.source} task</span><strong>{selectedOrder.agentName || "Choose an agent"}</strong></div>
          <b className={`status-tag ${selectedOrder.status}`}>{statusCopy(selectedOrder)}</b>
        </div>
        <div className="order-title-row">
          <div><p className="eyebrow">{selectedTemplate.complexity.toUpperCase()} · {selectedTemplate.fileCount} FILES</p><h3>{selectedTemplate.title}</h3></div>
          <div className="stage-ring" style={{ "--progress": `${progress * 3.6}deg` } as React.CSSProperties}><span>{selectedOrder.stageIndex}/{selectedTemplate.stages.length}</span></div>
        </div>
        <p className="order-summary">{selectedTemplate.summary}</p>
        <div className="file-stack">
          {selectedTemplate.files.slice(0, 3).map((file) => <code key={file}><FileCode2 size={13} />{file}</code>)}
          {selectedTemplate.files.length > 3 && <span>+{selectedTemplate.files.length - 3} more files grouped into later stages</span>}
        </div>
        {selectedOrder.status === "unassigned" && (
          <div className="order-action-card">
            <UsersRound size={28} />
            <h4>Choose your builder</h4>
            <p>The coding tool created the task. You decide which district agent carries it to the worksite.</p>
            <div className="agent-picker" aria-label="Choose an available agent">
              {agentRoster.map((agent) => {
                const busy = busyAgentNames.has(agent.name);
                const selected = selectedOrder.agentName === agent.name;
                return <button key={agent.name} className={selected ? "selected" : ""} disabled={busy} onClick={() => chooseAgent(selectedOrder.id, agent.name)} style={{ "--agent": agent.color } as React.CSSProperties}><span className={`pixel-avatar ${agentClass(agent.name)}`}><i /><i /><i /></span><strong>{agent.name}</strong><small>{busy ? "busy" : selected ? "selected" : "free"}</small></button>;
              })}
            </div>
            <h4>Choose what to improve</h4>
            <p>{selectedOrder.agentName ? `${selectedOrder.agentName} will walk from the Guild to any free building or unfinished blueprint.` : "Select a free agent first, then choose a village project."}</p>
            <button className={`primary-button ${assigningOrderId ? "active" : ""}`} disabled={!selectedOrder.agentName} onClick={() => beginAssignment(selectedOrder.id)}><LocateFixed size={17} /> {assigningOrderId ? "Choose on the map…" : "Choose village project"}</button>
            <button className="danger-button" onClick={() => removeOrder(selectedOrder.id)}><Trash2 size={14} /> Remove task</button>
          </div>
        )}
        {selectedOrder.status === "working" && (
          <div className="working-card">
            <div className="worker-clock">{selectedOrder.external ? <Activity size={24} /> : <Timer size={24} />}<strong>{selectedOrder.external ? selectedOrder.walking ? "GO" : "LIVE" : `${seconds}s`}</strong></div>
            <div><p className="eyebrow">{selectedOrder.walking ? "WALKING TO WORKSITE" : "AGENT IS WRITING"}</p><h4>{selectedOrder.questionsReady ? "Questions generated" : selectedStage?.name}</h4><span>{selectedOrder.walking ? `${selectedOrder.agentName} is following the roads to ${target?.name ?? "the worksite"}.` : selectedOrder.external ? "The game is waiting for the real Git diff to stop changing. There is no fake countdown." : `${selectedOrder.agentName} is building at ${target?.name ?? "the worksite"}. The next question appears when the agent stops.`}</span></div>
            <div className={`work-progress ${selectedOrder.external && !selectedOrder.questionsReady ? "indeterminate" : ""}`}><i style={{ width: selectedOrder.external ? "48%" : `${Math.max(8, 100 - seconds * 10)}%` }} /></div>
            {!selectedOrder.external && <button className="secondary-button" onClick={() => finishSimulatedWork(selectedOrder.id)}>Finish simulated agent run</button>}
          </div>
        )}
        {selectedOrder.status === "returning" && (
          <div className="returning-card"><div className="worker-clock"><ArrowLeft size={24} /><strong>{returnSeconds}s</strong></div><div><p className="eyebrow">QUESTIONS READY</p><h4>Returning to the Guild</h4><span>The file changes stopped and the review was generated. {selectedOrder.agentName} is walking back along the roads; the question opens on arrival.</span></div></div>
        )}
        {selectedOrder.status === "review" && selectedOrder.questionsReady && selectedQuestion && renderQuiz(selectedQuestion, `Stage ${selectedOrder.stageIndex + 1} of ${selectedTemplate.stages.length} · ${selectedStage?.name}`)}
        {selectedOrder.status === "complete" && (
          <div className="complete-card"><span><Check size={26} /></span><p className="eyebrow">PROJECT COMPLETE</p><h3>{target?.name} reached level {target?.level}</h3><p>{selectedOrder.agentName} has returned to the Builders’ Guild. This change is understood and ready for the release.</p><button className="danger-button" onClick={() => removeOrder(selectedOrder.id)}><Trash2 size={14} /> Clear this task</button></div>
        )}
      </div>
    );
  }

  function renderQuiz(question: Question, label: string) {
    const evidence = releaseOpen ? releaseEvidence : selectedStage?.evidence ?? [];
    return (
      <div className="quiz-block">
        <div className="question-meta"><CircleHelp size={15} /><span>{label}</span><b>{game.difficulty}</b></div>
        <h3>{question.prompt}</h3>
        <p>{question.context}</p>
        {evidence.length > 0 && (
          <section className="review-evidence" aria-label="Code changes related to this question">
            <div className="review-evidence-heading"><div><span>LOOK HERE TO ANSWER</span><strong>Relevant changes</strong></div><small>{evidence.length} {evidence.length === 1 ? "file" : "files"}</small></div>
            <div className="evidence-files">
              {evidence.map((item) => (
                <article className="evidence-file" key={`${item.file}-${item.note}`}>
                  <header><FileCode2 size={13} /><code>{item.file}</code></header>
                  <p>{item.note}</p>
                  <div className="diff-lines" role="region" aria-label={`Relevant diff from ${item.file}`}>
                    {item.lines.map((line, index) => (
                      <div className={`diff-line ${line.kind}`} key={`${line.code}-${index}`}><span>{line.kind === "add" ? "+" : line.kind === "remove" ? "−" : " "}</span><code>{line.code}</code></div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        <div className="answer-list" role="radiogroup" aria-label="Answer choices">
          {question.answers.map((choice, index) => {
            const correct = index === question.correct;
            const className = chosen === index ? (correct ? "correct" : "wrong") : answerState !== "idle" && correct ? "reveal" : "";
            return <button key={choice} className={className} onClick={() => answer(index)} disabled={answerState === "correct"}><span>{String.fromCharCode(65 + index)}</span><strong>{choice}</strong>{className === "correct" && <Check size={18} />}{className === "wrong" && <X size={18} />}</button>;
          })}
        </div>
        {answerState !== "idle" && <div className={`answer-feedback ${answerState}`}><span>{answerState === "correct" ? <Check size={17} /> : <CircleHelp size={17} />}</span><p><strong>{answerState === "correct" ? "Stage cleared." : "Not yet."}</strong>{answerState === "correct" ? question.explanation : "Trace what changes for the user or the system, then try again."}</p></div>}
        {answerState === "wrong" && <button className="secondary-button retry" onClick={() => { setAnswerState("idle"); setChosen(null); }}><RotateCcw size={15} /> Try again</button>}
      </div>
    );
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand-block"><div className="brand-mark"><CodeBlockMark /></div><div><p className="eyebrow">LOCALHOST / HUMAN IN CONTROL</p><h1>Vibe Control District</h1></div></div>
        <div className="header-metrics">
          <div className="metric coins"><Coins size={17} /><strong>{game.coins}</strong><span>coins</span></div>
          <div className="metric"><Zap size={17} /><strong>{game.xp}</strong><span>XP</span></div>
          <div className="metric"><Activity size={17} /><strong>{game.streak}</strong><span>streak</span></div>
          <div className="level-meter"><div><span>Village level {level}</span><strong>{game.xp % 100}/100</strong></div><i><b style={{ width: `${game.xp % 100}%` }} /></i></div>
        </div>
        <div className="header-actions">
          <span className={`save-pill ${saveStatus}`}><i />{saveStatus === "loading" ? "Opening village" : saveStatus === "saving" ? "Saving" : saveStatus === "offline" ? "Offline" : "Village saved"}</span>
          <label className="difficulty-select"><span>Knowledge</span><select value={game.difficulty} onChange={(event) => setGame((current) => ({ ...current, difficulty: event.target.value as Difficulty }))}><option>Beginner</option><option>Builder</option><option>Expert</option></select><ChevronDown size={14} /></label>
          <button className="icon-button" onClick={() => setShowGuide((value) => !value)} aria-label="How to play" title="How to play"><Info size={19} /></button>
        </div>
      </header>

      <section className="workspace">
        <section className="world-card">
          <div className="world-toolbar">
            <div className="live-cluster"><span className="live-dot" /><strong>{activeOrders.length} agents in the village</strong><span>·</span><span>{game.objects.length} placed items</span></div>
            <div className="world-actions">
              <button className={panelMode === "orders" ? "selected" : ""} onClick={() => { setPanelMode("orders"); setReleaseOpen(false); }}><ListTodo size={15} /> Work orders <b>{game.orders.filter((order) => order.status === "review").length}</b></button>
              <button className={panelMode === "shop" ? "selected" : ""} onClick={() => setPanelMode("shop")}><ShoppingBag size={15} /> Shop</button>
              <button className={panelMode === "inventory" ? "selected" : ""} onClick={() => setPanelMode("inventory")}><Package size={15} /> Inventory <b>{inventoryCount}</b></button>
              <button className={arrangeMode ? "selected" : ""} onClick={() => { setArrangeMode((value) => !value); setAssigningOrderId(null); setPlacementItemId(null); }}><Move size={15} /> Arrange</button>
            </div>
          </div>

          <div
            ref={viewportRef}
            className={`map-viewport ${arrangeMode ? "arranging" : ""} ${placementItemId ? "placing" : ""}`}
            onWheel={(event) => { event.preventDefault(); setZoom((value) => Math.max(.48, Math.min(1.15, value - event.deltaY * .001))); }}
          >
            <div
              className="map-stage"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
              onPointerDown={(event) => {
                const element = event.target as HTMLElement;
                if (element.closest("button") || placementItemId || arrangeMode) return;
                setPanDrag({ start: { x: event.clientX, y: event.clientY }, origin: pan });
              }}
              onClick={(event) => { if (placementItemId) placeBlueprint(event.clientX, event.clientY); }}
            >
              <div className="terrain-grid" />
              <div className="river"><i /><i /><i /></div>
              {game.roads.map((road) => (
                <div
                  key={road.id}
                  className={`road-segment ${road.orientation} ${road.kind} ${draggingRoadId === road.id ? "dragging" : ""}`}
                  style={{ left: road.x, top: road.y, "--road-length": `${road.length}px` } as React.CSSProperties}
                  onPointerDown={(event) => startRoadDrag(event, road)}
                  onDoubleClick={(event) => rotateRoad(event, road.id)}
                  aria-label={`${road.kind === "main" ? "Main road" : "Road"}, ${road.orientation}. ${arrangeMode ? "Drag to move, double click to rotate." : ""}`}
                ><span /><button className="road-rotate" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => rotateRoad(event, road.id)} aria-label="Rotate road"><RotateCcw size={13} /></button></div>
              ))}
              {futureLots.map((lot) => <div key={lot.id} className="future-lot" style={{ left: lot.x, top: lot.y }}><span>+</span><small>FUTURE PLOT</small></div>)}
              <div className="field-large"><i /><i /><i /><i /><i /><i /></div>
              <div className="map-sign"><strong>VIBE CONTROL DISTRICT</strong><span>build fast · understand everything</span></div>
              {game.objects.map((object) => {
                const order = game.orders.find((item) => item.targetId === object.id && item.status !== "complete");
                const assignable = assigningOrderId && !busyTargetIds.has(object.id);
                const launchState = object.id === "launch" ? (game.releaseApproved ? "released" : releaseReady ? "ready" : "locked") : "";
                return (
                  <button
                    key={object.id}
                    className={`village-object ${object.category} kind-${object.kind} ${object.built ? "built" : "blueprint"} ${order ? "busy" : ""} ${assignable ? "assignable" : ""} ${launchState}`}
                    style={{ left: object.x, top: object.y } as React.CSSProperties}
                    onPointerDown={(event) => startObjectDrag(event, object)}
                    onClick={(event) => { event.stopPropagation(); objectClick(object); }}
                    aria-label={`${object.name}, level ${object.level}`}
                  >
                    <span className="object-shadow" />
                    <span className="object-art"><ObjectGlyph kind={object.kind} size={object.category === "decoration" ? 27 : 23} /><i /><i /></span>
                    {!object.built && <span className="scaffold"><Construction size={22} /></span>}
                    {order && <span className={`build-badge ${order.status}`}>{order.status === "review" ? "?" : <Hammer size={12} />}</span>}
                    <span className="object-label"><strong>{object.name}</strong><small>{object.built ? `LEVEL ${object.level}` : "BLUEPRINT"}</small></span>
                  </button>
                );
              })}
              {agentRoster.map((agent, index) => {
                const guild = game.objects.find((object) => object.id === "guild")!;
                const agentOrders = game.orders.filter((item) => item.agentName === agent.name && item.status !== "complete");
                const order = agentOrders.find((item) => item.status === "working" || item.status === "returning" || item.status === "unassigned") ?? agentOrders[0];
                const target = order ? game.objects.find((object) => object.id === order.targetId) : null;
                const idlePoint = { x: guild.x + 24 + index * 30, y: guild.y + 119 };
                const targetPoint = target ? { x: target.x + 74, y: target.y + 82 } : idlePoint;
                const guildExit = { x: guild.x + 88, y: guild.y + 119 };
                let position = target && order && (order.status === "working" || (order.status === "review" && !order.external)) ? targetPoint : idlePoint;
                let isTraveling = false;
                if (target && order?.status === "working" && order.walking && order.startedAt && order.travelEndsAt) {
                  const elapsed = Math.max(0, clock - order.startedAt);
                  const duration = Math.max(1, order.travelEndsAt - order.startedAt);
                  const walkingProgress = Math.min(1, elapsed / duration);
                  isTraveling = walkingProgress < 1;
                  position = pointAlongRoute(roadRoute(guildExit, targetPoint, game.roads), walkingProgress);
                } else if (target && order?.status === "returning" && order.returnStartedAt && order.returnEndsAt) {
                  const elapsed = Math.max(0, clock - order.returnStartedAt);
                  const duration = Math.max(1, order.returnEndsAt - order.returnStartedAt);
                  const returningProgress = Math.min(1, elapsed / duration);
                  isTraveling = returningProgress < 1;
                  position = pointAlongRoute(roadRoute(targetPoint, guildExit, game.roads), returningProgress);
                }
                return (
                  <button key={agent.name} className={`worker ${order?.status ?? "idle"} ${isTraveling ? "walking" : ""}`} style={{ left: position.x, top: position.y, "--agent": agent.color } as React.CSSProperties} onClick={(event) => { event.stopPropagation(); order ? openOrder(order.id) : setToast(`${agent.name} is free and waiting at the Guild.`); }} aria-label={`${agent.name}, ${order ? statusCopy(order) : "available"}`}>
                    <span className={`pixel-avatar ${agentClass(agent.name)}`}><i /><i /><i /></span>
                    {order && (order.status === "review" || order.status === "unassigned") && <em>{order.status === "review" ? "Question!" : "Ready"}</em>}
                  </button>
                );
              })}
            </div>

            <div className="map-controls">
              <button onClick={() => setZoom((value) => Math.min(1.15, value + .1))} aria-label="Zoom in"><Plus size={16} /></button>
              <button onClick={() => setZoom((value) => Math.max(.48, value - .1))} aria-label="Zoom out"><Minus size={16} /></button>
              <button onClick={() => { setZoom(.72); setPan({ x: 0, y: 0 }); }} aria-label="Center map"><Grid3X3 size={16} /></button>
            </div>
            {(assigningOrderId || placementItemId || arrangeMode) && <div className="mode-banner">{assigningOrderId ? "Choose a highlighted village project" : placementItemId ? "Place this blueprint on open land" : "Drag buildings or roads · double-click a road to rotate"}<button onClick={() => { setAssigningOrderId(null); setPlacementItemId(null); setArrangeMode(false); }}><X size={14} /> Done</button></div>}
          </div>

          <div className="activity-strip"><div className="activity-icon"><Activity size={18} /></div><div><span>VILLAGE ACTIVITY</span><strong>{toast || "Agents turn code into progress. Your understanding finishes the work."}</strong></div><div className="agent-dots">{agentRoster.map((agent) => { const orders = game.orders.filter((item) => item.agentName === agent.name && item.status !== "complete"); const order = orders.find((item) => item.status === "working" || item.status === "returning" || item.status === "unassigned") ?? orders[0]; return <button key={agent.name} style={{ "--agent": agent.color } as React.CSSProperties} onClick={() => order ? openOrder(order.id) : setToast(`${agent.name} is available for a new task.`)}><CircleUserRound size={15} />{agent.name}</button>; })}</div></div>
        </section>

        <aside className="side-panel">
          <div className="panel-heading"><div><p className="eyebrow">{panelMode === "shop" ? "VILLAGE MARKET" : panelMode === "inventory" ? "YOUR BLUEPRINTS" : panelMode === "order" ? releaseOpen ? "LAUNCH TOWER" : "AGENT PROJECT" : "ACTIVE DEVELOPMENT"}</p><h2>{panelMode === "shop" ? "Build something lovely" : panelMode === "inventory" ? "Ready to place" : panelMode === "order" ? releaseOpen ? "Release inspection" : "Worksite details" : "Work orders"}</h2></div><span className="panel-count">{panelMode === "shop" ? `${shopItems.length} items` : panelMode === "inventory" ? `${inventoryCount} owned` : `${game.orders.length} tasks`}</span></div>

          {showGuide && <div className="guide-card"><ShieldCheck size={22} /><p><strong>How the live loop works</strong><br />The first Git change opens a task so you can choose a worker and project. When writing stops, questions load and the worker follows the roads back to the Guild. Use Arrange to drag buildings and roads.</p><button onClick={() => setShowGuide(false)}><X size={15} /></button></div>}

          {panelMode === "orders" && (
            <div className="panel-scroll order-list">
              {demoOrders.length > 0 && <div className="release-progress"><div><span>Demo release</span><strong>{demoOrders.filter((order) => order.status === "complete").length} / {demoOrderIds.size} projects</strong></div><i><b style={{ width: `${demoOrders.filter((order) => order.status === "complete").length / demoOrderIds.size * 100}%` }} /></i><button onClick={openLaunchTower} disabled={!releaseReady && !game.releaseApproved}>{game.releaseApproved ? "Released" : releaseReady ? "Inspect release" : "Tower locked"}{game.releaseApproved ? <Check size={15} /> : <LockKeyhole size={15} />}</button></div>}
              <div className="task-cleanup-bar"><span><Trash2 size={13} /> Task history</span><div><button onClick={clearCompletedOrders} disabled={!completedOrders.length}>Clear finished</button><button onClick={clearDemoTasks} disabled={!demoOrders.length}>Clear demo</button></div></div>
              {game.orders.map((order) => {
                const template = allTemplates[order.templateId];
                if (!template) return null;
                const target = game.objects.find((object) => object.id === order.targetId);
                return <button key={order.id} className={`order-card ${order.status}`} onClick={() => openOrder(order.id)} style={{ "--agent": order.color } as React.CSSProperties}><span className="mini-worker">{order.agentName ? <span className={`pixel-avatar ${agentClass(order.agentName)}`}><i /><i /><i /></span> : <UsersRound size={20} />}</span><div><p>{order.agentName || "Choose agent"} · {order.source}</p><strong>{template.title}</strong><small>{target ? `${target.name} · ` : ""}{statusCopy(order)}</small></div><span className="file-count">{template.fileCount}<small>files</small></span></button>;
              })}
              <button className="incoming-card" onClick={() => setToast("Local connector ready. Run npm run watch:agents with the Git project you want to follow.")}><Plus size={18} /><span><strong>Local agent connector</strong><small>Watching localhost for real Git changes</small></span></button>
            </div>
          )}

          {panelMode === "order" && renderOrderPanel()}

          {panelMode === "shop" && (
            <div className="panel-scroll shop-grid">
              <div className="shop-intro"><ShoppingBag size={20} /><p>Buy a blueprint, place it on the map, then assign any available agent task to build it.</p></div>
              {shopItems.map((item) => <article key={item.id} className={level < item.minLevel ? "locked-item" : ""}><div className={`shop-art ${item.category}`}><ObjectGlyph kind={item.id} size={32} /></div><div><p>{item.category}</p><h3>{item.name}</h3><span>{item.description}</span></div><button onClick={() => buyItem(item.id)} disabled={level < item.minLevel || game.coins < item.price}><Coins size={14} /> {item.price}</button>{level < item.minLevel && <em>Level {item.minLevel}</em>}</article>)}
            </div>
          )}

          {panelMode === "inventory" && (
            <div className="panel-scroll inventory-list">
              {game.inventory.length === 0 ? <div className="empty-state"><Package size={42} /><h3>Your blueprint shelf is empty</h3><p>Visit the shop for buildings, trees, lamps, benches, and village landmarks.</p><button className="primary-button" onClick={() => setPanelMode("shop")}><ShoppingBag size={16} /> Open the shop</button></div> : game.inventory.map((entry) => { const item = shopItems.find((candidate) => candidate.id === entry.itemId)!; return <article key={entry.itemId}><div className="inventory-art"><ObjectGlyph kind={item.id} size={28} /></div><div><strong>{item.name}</strong><span>{entry.quantity} blueprint{entry.quantity > 1 ? "s" : ""}</span></div><button onClick={() => beginPlacement(item.id)}>Place <LocateFixed size={14} /></button></article>; })}
            </div>
          )}

          <div className="panel-footer"><span><Hammer size={14} /> Database-backed village</span><button onClick={resetVillage}>Reset demo</button></div>
        </aside>
      </section>
      {confirmation && (
        <div className="confirm-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmation(null); }}>
          <section className="game-confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
            <div className="confirm-icon"><Trash2 size={22} /></div>
            <p className="eyebrow">DISTRICT CONTROL</p>
            <h2 id="confirm-title">{confirmation.title}</h2>
            <p id="confirm-message">{confirmation.message}</p>
            <div><button className="secondary-button" onClick={() => setConfirmation(null)}>Cancel</button><button className="confirm-remove" onClick={() => { const action = confirmation.onConfirm; setConfirmation(null); action(); }}>{confirmation.confirmLabel}</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

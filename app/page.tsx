"use client";

import {
  Activity,
  Armchair,
  ArrowLeft,
  Bot,
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
  Terminal,
  Timer,
  Trees,
  Trophy,
  Warehouse,
  Wheat,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialGameState,
  orderTemplates,
  shopItems,
  villageLevel,
  type Difficulty,
  type GameState,
  type PanelMode,
  type Question,
  type VillageObject,
  type WorkOrder,
} from "./game-data";

type AnswerState = "idle" | "correct" | "wrong";
type Point = { x: number; y: number };

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

function sourceIcon(source: WorkOrder["source"]) {
  if (source === "Terminal") return <Terminal size={14} />;
  if (source === "Claude") return <Sparkles size={14} />;
  return <Bot size={14} />;
}

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

function statusCopy(order: WorkOrder) {
  if (order.status === "review") return "Question ready";
  if (order.status === "working") return "Building";
  if (order.status === "complete") return "Understood";
  return "Needs a project";
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
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [panDrag, setPanDrag] = useState<{ start: Point; origin: Point } | null>(null);
  const [toast, setToast] = useState("Milo finished a code stage. One question is waiting.");
  const [clock, setClock] = useState(() => Date.now());
  const viewportRef = useRef<HTMLDivElement>(null);

  const selectedOrder = game.orders.find((order) => order.id === selectedOrderId) ?? null;
  const selectedTemplate = selectedOrder ? orderTemplates[selectedOrder.templateId] : null;
  const selectedStage = selectedOrder && selectedTemplate ? selectedTemplate.stages[selectedOrder.stageIndex] : null;
  const selectedQuestion = releaseOpen ? releaseQuestion[game.difficulty] : selectedStage?.questions[game.difficulty] ?? null;
  const initialOrders = game.orders.filter((order) => !order.id.startsWith("construction-"));
  const releaseReady = initialOrders.length >= 3 && initialOrders.every((order) => order.status === "complete");
  const activeOrders = game.orders.filter((order) => order.status === "working" || order.status === "review");
  const inventoryCount = game.inventory.reduce((total, item) => total + item.quantity, 0);
  const level = villageLevel(game.xp);

  useEffect(() => {
    let active = true;
    fetch("/api/village")
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        if (payload.state?.version === 2) setGame(payload.state);
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
          if (order.status === "working" && order.readyAt && order.readyAt <= now) {
            changed = true;
            return { ...order, status: "review" as const, readyAt: null };
          }
          return order;
        });
        return changed ? { ...current, orders } : current;
      });
    }, 1000);
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
    if (!draggingId && !panDrag) return;
    const move = (event: PointerEvent) => {
      if (draggingId) {
        const point = clientToStage(event.clientX, event.clientY);
        const x = Math.max(40, Math.min(1480, Math.round((point.x - dragOffset.x) / 20) * 20));
        const y = Math.max(40, Math.min(820, Math.round((point.y - dragOffset.y) / 20) * 20));
        setGame((current) => ({ ...current, objects: current.objects.map((object) => object.id === draggingId ? { ...object, x, y } : object) }));
      } else if (panDrag) {
        setPan({ x: panDrag.origin.x + event.clientX - panDrag.start.x, y: panDrag.origin.y + event.clientY - panDrag.start.y });
      }
    };
    const up = () => { setDraggingId(null); setPanDrag(null); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [clientToStage, dragOffset, draggingId, panDrag]);

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
    setGame((current) => ({
      ...current,
      orders: current.orders.map((order) => order.id === orderId ? { ...order, targetId: objectId, status: "working", readyAt: Date.now() + 9000 } : order),
    }));
    const order = game.orders.find((item) => item.id === orderId);
    const object = game.objects.find((item) => item.id === objectId);
    setAssigningOrderId(null);
    setToast(`${order?.agentName ?? "Your agent"} is walking to ${object?.name ?? "the worksite"}.`);
    openOrder(orderId);
  }

  function finishSimulatedWork(orderId: string) {
    setGame((current) => ({ ...current, orders: current.orders.map((order) => order.id === orderId ? { ...order, status: "review", readyAt: null } : order) }));
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
    setGame((current) => ({
      ...current,
      coins: current.coins + (finalStage ? 30 : 12),
      xp: current.xp + (finalStage ? 55 : 25),
      streak: current.streak + 1,
      orders: current.orders.map((order) => order.id === selectedOrder.id ? {
        ...order,
        stageIndex: finalStage ? order.stageIndex : order.stageIndex + 1,
        status: finalStage ? "complete" : "working",
        readyAt: finalStage ? null : Date.now() + 7000,
      } : order),
      objects: finalStage ? current.objects.map((object) => object.id === selectedOrder.targetId ? { ...object, built: true, level: Math.max(1, object.level + 1) } : object) : current.objects,
    }));
    window.setTimeout(() => { setAnswerState("idle"); setChosen(null); }, 900);
    setToast(finalStage ? "Upgrade complete. Your worker is returning to the Guild." : "Stage cleared. The worker has resumed construction.");
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

  function resetVillage() {
    setGame(createInitialGameState());
    setPanelMode("orders");
    setSelectedOrderId("order-reset");
    setReleaseOpen(false);
    setAssigningOrderId(null);
    setPlacementItemId(null);
    setArrangeMode(false);
    setToast("Fresh valley loaded.");
  }

  function openLaunchTower() {
    if (!releaseReady) {
      setToast(`${initialOrders.filter((order) => order.status !== "complete").length} agent projects still need understanding checks.`);
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
            <h3>{game.releaseApproved ? "The valley is shipping" : "One final understanding check"}</h3>
            <p>{game.releaseApproved ? "Every core work order has been understood and the release is approved." : "Explain how the completed agent work fits together before opening the tower."}</p>
          </div>
          {!game.releaseApproved && selectedQuestion && renderQuiz(selectedQuestion, "Final question")}
        </div>
      );
    }
    if (!selectedOrder || !selectedTemplate) return null;
    const target = game.objects.find((object) => object.id === selectedOrder.targetId);
    const seconds = selectedOrder.readyAt ? Math.max(0, Math.ceil((selectedOrder.readyAt - clock) / 1000)) : 0;
    const progress = selectedOrder.status === "complete" ? 100 : Math.round((selectedOrder.stageIndex / selectedTemplate.stages.length) * 100);
    return (
      <div className="panel-scroll">
        <button className="back-button" onClick={() => { setPanelMode("orders"); setAssigningOrderId(null); }}><ArrowLeft size={15} /> All work orders</button>
        <div className="agent-hero" style={{ "--agent": selectedOrder.color } as React.CSSProperties}>
          <div className="portrait"><CircleUserRound size={27} /></div>
          <div><span>{selectedOrder.source} worker</span><strong>{selectedOrder.agentName}</strong></div>
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
            <Construction size={28} />
            <h4>Choose what this work improves</h4>
            <p>Assign {selectedOrder.agentName} to any free building or unfinished blueprint. The code task will become its upgrade.</p>
            <button className={`primary-button ${assigningOrderId ? "active" : ""}`} onClick={() => beginAssignment(selectedOrder.id)}><LocateFixed size={17} /> {assigningOrderId ? "Choose on the map…" : "Choose village project"}</button>
          </div>
        )}
        {selectedOrder.status === "working" && (
          <div className="working-card">
            <div className="worker-clock"><Timer size={24} /><strong>{seconds}s</strong></div>
            <div><p className="eyebrow">AGENT IS WORKING</p><h4>{selectedStage?.name}</h4><span>{selectedOrder.agentName} is building at {target?.name ?? "the worksite"}. The next question appears when the agent stops.</span></div>
            <div className="work-progress"><i style={{ width: `${Math.max(8, 100 - seconds * 10)}%` }} /></div>
            <button className="secondary-button" onClick={() => finishSimulatedWork(selectedOrder.id)}>Finish simulated agent run</button>
          </div>
        )}
        {selectedOrder.status === "review" && selectedQuestion && renderQuiz(selectedQuestion, `Stage ${selectedOrder.stageIndex + 1} of ${selectedTemplate.stages.length} · ${selectedStage?.name}`)}
        {selectedOrder.status === "complete" && (
          <div className="complete-card"><span><Check size={26} /></span><p className="eyebrow">PROJECT COMPLETE</p><h3>{target?.name} reached level {target?.level}</h3><p>{selectedOrder.agentName} has returned to the Builders’ Guild. This change is understood and ready for the release.</p></div>
        )}
      </div>
    );
  }

  function renderQuiz(question: Question, label: string) {
    return (
      <div className="quiz-block">
        <div className="question-meta"><CircleHelp size={15} /><span>{label}</span><b>{game.difficulty}</b></div>
        <h3>{question.prompt}</h3>
        <p>{question.context}</p>
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
        <div className="brand-block"><div className="brand-mark"><Wheat size={23} /></div><div><p className="eyebrow">YOUR LIVING CODEBASE</p><h1>Patchwork Valley</h1></div></div>
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
              <div className="road road-one" /><div className="road road-two" /><div className="road road-three" />
              <div className="field-large"><i /><i /><i /><i /><i /><i /></div>
              <div className="map-sign"><strong>PATCHWORK VALLEY</strong><span>knowledge makes the village grow</span></div>
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
              {game.orders.map((order, index) => {
                const guild = game.objects.find((object) => object.id === "guild")!;
                const target = game.objects.find((object) => object.id === order.targetId);
                const atSite = order.status === "working" || order.status === "review";
                const left = atSite && target ? target.x + 80 : guild.x + 30 + index * 30;
                const top = atSite && target ? target.y + 72 : guild.y + 112;
                return (
                  <button key={order.id} className={`worker ${order.status}`} style={{ left, top, "--agent": order.color } as React.CSSProperties} onClick={(event) => { event.stopPropagation(); openOrder(order.id); }} aria-label={`${order.agentName}, ${statusCopy(order)}`}>
                    <span className="worker-head" /><span className="worker-body"><CircleUserRound size={18} /></span><b>{sourceIcon(order.source)}</b>
                    {(order.status === "review" || order.status === "unassigned") && <em>{order.status === "review" ? "Question!" : "Assign me"}</em>}
                  </button>
                );
              })}
            </div>

            <div className="map-controls">
              <button onClick={() => setZoom((value) => Math.min(1.15, value + .1))} aria-label="Zoom in"><Plus size={16} /></button>
              <button onClick={() => setZoom((value) => Math.max(.48, value - .1))} aria-label="Zoom out"><Minus size={16} /></button>
              <button onClick={() => { setZoom(.72); setPan({ x: 0, y: 0 }); }} aria-label="Center map"><Grid3X3 size={16} /></button>
            </div>
            {(assigningOrderId || placementItemId || arrangeMode) && <div className="mode-banner">{assigningOrderId ? "Choose a highlighted village project" : placementItemId ? "Place this blueprint on open land" : "Drag completed buildings and decorations"}<button onClick={() => { setAssigningOrderId(null); setPlacementItemId(null); setArrangeMode(false); }}><X size={14} /> Done</button></div>}
          </div>

          <div className="activity-strip"><div className="activity-icon"><Activity size={18} /></div><div><span>VILLAGE ACTIVITY</span><strong>{toast || "Agents turn code into progress. Your understanding finishes the work."}</strong></div><div className="agent-dots">{game.orders.slice(0, 4).map((order) => <button key={order.id} style={{ "--agent": order.color } as React.CSSProperties} onClick={() => openOrder(order.id)}><CircleUserRound size={15} />{order.agentName}</button>)}</div></div>
        </section>

        <aside className="side-panel">
          <div className="panel-heading"><div><p className="eyebrow">{panelMode === "shop" ? "VILLAGE MARKET" : panelMode === "inventory" ? "YOUR BLUEPRINTS" : panelMode === "order" ? releaseOpen ? "LAUNCH TOWER" : "AGENT PROJECT" : "ACTIVE DEVELOPMENT"}</p><h2>{panelMode === "shop" ? "Build something lovely" : panelMode === "inventory" ? "Ready to place" : panelMode === "order" ? releaseOpen ? "Release inspection" : "Worksite details" : "Work orders"}</h2></div><span className="panel-count">{panelMode === "shop" ? `${shopItems.length} items` : panelMode === "inventory" ? `${inventoryCount} owned` : `${game.orders.length} tasks`}</span></div>

          {showGuide && <div className="guide-card"><ShieldCheck size={22} /><p><strong>How the new loop works</strong><br />An agent takes a code task to any village project. When the agent stops, a question unlocks the next construction stage. Large changes have several stages.</p><button onClick={() => setShowGuide(false)}><X size={15} /></button></div>}

          {panelMode === "orders" && (
            <div className="panel-scroll order-list">
              <div className="release-progress"><div><span>Release 0.5</span><strong>{initialOrders.filter((order) => order.status === "complete").length} / {initialOrders.length} core projects</strong></div><i><b style={{ width: `${initialOrders.length ? initialOrders.filter((order) => order.status === "complete").length / initialOrders.length * 100 : 0}%` }} /></i><button onClick={openLaunchTower} disabled={!releaseReady && !game.releaseApproved}>{game.releaseApproved ? "Released" : releaseReady ? "Inspect release" : "Tower locked"}{game.releaseApproved ? <Check size={15} /> : <LockKeyhole size={15} />}</button></div>
              {game.orders.map((order) => {
                const template = orderTemplates[order.templateId];
                const target = game.objects.find((object) => object.id === order.targetId);
                return <button key={order.id} className={`order-card ${order.status}`} onClick={() => openOrder(order.id)} style={{ "--agent": order.color } as React.CSSProperties}><span className="mini-worker"><CircleUserRound size={22} /></span><div><p>{order.agentName} · {order.source}</p><strong>{template.title}</strong><small>{target ? `${target.name} · ` : ""}{statusCopy(order)}</small></div><span className="file-count">{template.fileCount}<small>files</small></span></button>;
              })}
              <button className="incoming-card" onClick={() => setToast("The live terminal connector is the next integration. This demo already supports the work orders it will create.")}><Plus size={18} /><span><strong>Incoming agent slot</strong><small>Ready for the future local connector</small></span></button>
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
    </main>
  );
}

"use client";

import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  Coins,
  GitBranch,
  Hammer,
  Info,
  LockKeyhole,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trophy,
  Wheat,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Difficulty = "Beginner" | "Builder" | "Expert";
type AgentId = "codex" | "claude" | "terminal";
type AnswerState = "idle" | "correct" | "wrong";

type Agent = {
  id: AgentId;
  name: string;
  source: string;
  task: string;
  file: string;
  change: string;
  color: string;
  pale: string;
  building: string;
  position: string;
  icon: "bot" | "spark" | "terminal";
};

type Question = {
  prompt: string;
  context: string;
  answers: string[];
  correct: number;
  explanation: string;
};

const agents: Agent[] = [
  {
    id: "codex",
    name: "Codex",
    source: "Codex app",
    task: "Adding password reset",
    file: "auth/reset-password.ts",
    change: "+38  −4",
    color: "#ef6c4d",
    pale: "#ffe0cf",
    building: "The Forge",
    position: "plot-forge",
    icon: "bot",
  },
  {
    id: "claude",
    name: "Claude",
    source: "Claude Code",
    task: "Refining search filters",
    file: "components/SearchBar.tsx",
    change: "+22  −11",
    color: "#7f72b7",
    pale: "#e7e0ff",
    building: "Query Orchard",
    position: "plot-orchard",
    icon: "spark",
  },
  {
    id: "terminal",
    name: "Terminal",
    source: "macOS · zsh",
    task: "Updating database schema",
    file: "db/schema.ts",
    change: "+12  −2",
    color: "#2f8e7f",
    pale: "#d2f2e8",
    building: "Data Mill",
    position: "plot-mill",
    icon: "terminal",
  },
];

const questions: Record<AgentId, Record<Difficulty, Question>> = {
  codex: {
    Beginner: {
      prompt: "What will this change let a user do?",
      context: "A new reset token is created, emailed, and checked before the password is replaced.",
      answers: ["Recover a forgotten password", "Skip signing in forever", "Delete another user"],
      correct: 0,
      explanation: "Exactly — the token proves the reset request is legitimate before changing the password.",
    },
    Builder: {
      prompt: "Why does the reset token expire after 15 minutes?",
      context: "The token is random, stored as a hash, and rejected when its expiresAt time has passed.",
      answers: ["To make email faster", "To limit the window for token misuse", "To save CSS"],
      correct: 1,
      explanation: "Right. A short expiry reduces the damage if a reset link is exposed.",
    },
    Expert: {
      prompt: "Why store a hash of the reset token instead of the token itself?",
      context: "The raw token is sent by email; only its SHA-256 digest is persisted.",
      answers: ["It sorts tokens alphabetically", "A database leak cannot directly reveal usable tokens", "It makes tokens expire"],
      correct: 1,
      explanation: "Correct. The presented token can be hashed and compared without retaining the usable secret.",
    },
  },
  claude: {
    Beginner: {
      prompt: "What happens when someone picks a category?",
      context: "The selected category is added to the search request and the results are fetched again.",
      answers: ["Results narrow to that category", "The account logs out", "The database is deleted"],
      correct: 0,
      explanation: "Yes — changing a filter refreshes the results with a narrower search.",
    },
    Builder: {
      prompt: "Why is the search delayed by 300ms after typing?",
      context: "A timeout is reset on every keystroke before fetchResults() runs.",
      answers: ["To animate the input", "To avoid a request for every keystroke", "To encrypt the query"],
      correct: 1,
      explanation: "That is a debounce: it reduces unnecessary network requests while the user is still typing.",
    },
    Expert: {
      prompt: "What race condition does the AbortController prevent?",
      context: "The previous search request is aborted whenever a newer query starts.",
      answers: ["An older response overwriting newer results", "Two users choosing the same filter", "The CSS loading twice"],
      correct: 0,
      explanation: "Exactly. Slow, stale requests cannot arrive late and replace the newest result set.",
    },
  },
  terminal: {
    Beginner: {
      prompt: "What new information can each project remember?",
      context: "The migration adds a nullable lastDeployedAt timestamp to the projects table.",
      answers: ["When it was last deployed", "The user’s password", "The screen size"],
      correct: 0,
      explanation: "Correct — the new column records the most recent successful deployment time.",
    },
    Builder: {
      prompt: "Why is the new database column nullable?",
      context: "Existing projects have never recorded a deployment timestamp.",
      answers: ["To support projects with no deployment yet", "To make dates faster", "To hide failed tests"],
      correct: 0,
      explanation: "Right. Existing and not-yet-deployed projects need a valid empty state.",
    },
    Expert: {
      prompt: "Why should this migration avoid a non-null default of now()?",
      context: "Historical rows did not actually deploy at migration time.",
      answers: ["It would invent misleading deployment history", "Postgres cannot store dates", "It prevents indexing"],
      correct: 0,
      explanation: "Correct. Backfilling with now() would turn unknown history into false data.",
    },
  },
};

const deploymentQuestion: Question = {
  prompt: "What did this expedition build overall?",
  context: "The Forge, Orchard, and Mill are ready. Show that you understand how their work fits together.",
  answers: [
    "A safer account flow, clearer search, and deployment history",
    "A new operating system for trains",
    "Only a color change to the homepage",
  ],
  correct: 0,
  explanation: "Launch approved. You understood the product, interface, and data changes as one release.",
};

function AgentGlyph({ type }: { type: Agent["icon"] }) {
  if (type === "terminal") return <Terminal size={18} strokeWidth={2.4} />;
  if (type === "spark") return <Sparkles size={18} strokeWidth={2.4} />;
  return <Bot size={18} strokeWidth={2.4} />;
}

export default function Home() {
  const [difficulty, setDifficulty] = useState<Difficulty>("Beginner");
  const [selected, setSelected] = useState<AgentId>("codex");
  const [cleared, setCleared] = useState<AgentId[]>([]);
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [chosen, setChosen] = useState<number | null>(null);
  const [xp, setXp] = useState(240);
  const [coins, setCoins] = useState(86);
  const [streak, setStreak] = useState(3);
  const [sound, setSound] = useState(true);
  const [showBrief, setShowBrief] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [eventPulse, setEventPulse] = useState(0);

  useEffect(() => {
    const saved = window.localStorage.getItem("patchwork-valley-progress");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setCleared(parsed.cleared ?? []);
      setXp(parsed.xp ?? 240);
      setCoins(parsed.coins ?? 86);
      setDifficulty(parsed.difficulty ?? "Beginner");
      setDeployed(parsed.deployed ?? false);
    } catch {
      // A corrupt local save should never stop the village from loading.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "patchwork-valley-progress",
      JSON.stringify({ cleared, xp, coins, difficulty, deployed }),
    );
  }, [cleared, xp, coins, difficulty, deployed]);

  const allCleared = cleared.length === agents.length;
  const isDeployment = allCleared && !deployed;
  const currentAgent = agents.find((agent) => agent.id === selected) ?? agents[0];
  const currentQuestion = isDeployment ? deploymentQuestion : questions[selected][difficulty];
  const selectedCleared = cleared.includes(selected) && !isDeployment;

  useEffect(() => {
    if (!isDeployment) return;
    setAnswerState("idle");
    setChosen(null);
  }, [isDeployment]);

  const activityLine = useMemo(() => {
    if (deployed) return "Release shipped — every builder made it home with the map intact.";
    if (isDeployment) return "All three worksites are ready. The Launch Tower needs your final sign-off.";
    if (eventPulse > 0) return `${currentAgent.file} changed — a fresh checkpoint is ready.`;
    return `${currentAgent.name} is ${currentAgent.task.toLowerCase()}. Review the change before it travels onward.`;
  }, [currentAgent, deployed, eventPulse, isDeployment]);

  function selectAgent(id: AgentId) {
    setSelected(id);
    setAnswerState("idle");
    setChosen(null);
    setEventPulse(0);
  }

  function chooseAnswer(index: number) {
    if (answerState === "correct" || selectedCleared) return;
    setChosen(index);
    if (index === currentQuestion.correct) {
      setAnswerState("correct");
      setStreak((value) => value + 1);
      setXp((value) => value + (isDeployment ? 100 : 40));
      setCoins((value) => value + (isDeployment ? 50 : 20));
      if (isDeployment) {
        window.setTimeout(() => setDeployed(true), 650);
      } else if (!cleared.includes(selected)) {
        setCleared((value) => [...value, selected]);
      }
    } else {
      setAnswerState("wrong");
      setStreak(0);
    }
  }

  function nextWorksite() {
    const pending = agents.find((agent) => !cleared.includes(agent.id));
    if (pending) selectAgent(pending.id);
  }

  function resetVillage() {
    setCleared([]);
    setXp(240);
    setCoins(86);
    setStreak(3);
    setSelected("codex");
    setAnswerState("idle");
    setChosen(null);
    setDeployed(false);
    setEventPulse(0);
  }

  function simulateChange() {
    const index = agents.findIndex((agent) => agent.id === selected);
    const next = agents[(index + 1) % agents.length];
    selectAgent(next.id);
    setEventPulse((value) => value + 1);
  }

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true"><Wheat size={24} /></div>
          <div>
            <p className="eyebrow">YOUR LIVING CODEBASE</p>
            <h1>Patchwork Valley</h1>
          </div>
        </div>

        <div className="header-metrics" aria-label="Player progress">
          <div className="metric coin"><Coins size={17} /><strong>{coins}</strong><span>coins</span></div>
          <div className="metric"><Zap size={17} /><strong>{xp}</strong><span>XP</span></div>
          <div className="metric"><span className="flame">●</span><strong>{streak}</strong><span>streak</span></div>
          <div className="level-meter" aria-label={`${xp % 100}% to next level`}>
            <div className="level-copy"><span>Village level 4</span><strong>{xp % 100}/100</strong></div>
            <div className="level-track"><span style={{ width: `${xp % 100}%` }} /></div>
          </div>
        </div>

        <div className="header-actions">
          <label className="difficulty-select">
            <span>Knowledge</span>
            <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty)}>
              <option>Beginner</option>
              <option>Builder</option>
              <option>Expert</option>
            </select>
            <ChevronDown size={15} />
          </label>
          <button className="icon-button" onClick={() => setSound((value) => !value)} aria-label={sound ? "Mute sound" : "Enable sound"} title={sound ? "Mute sound" : "Enable sound"}>
            {sound ? <Activity size={19} /> : <X size={19} />}
          </button>
          <button className="icon-button" aria-label="Open settings" title="Settings"><Settings2 size={19} /></button>
        </div>
      </header>

      <section className="workspace">
        <section className="world-card" aria-label="Patchwork Valley map">
          <div className="world-toolbar">
            <div className="live-cluster"><span className="live-dot" /> <strong>3 agents working</strong><span>·</span><span>{cleared.length} changes understood</span></div>
            <button className="change-button" onClick={simulateChange}><GitBranch size={16} /> Simulate file change</button>
          </div>

          <div className="world">
            <div className="cloud cloud-one" /><div className="cloud cloud-two" />
            <div className="path path-a" /><div className="path path-b" /><div className="path path-c" />
            <div className="pond"><i /><i /><i /></div>
            <div className="tree tree-1" /><div className="tree tree-2" /><div className="tree tree-3" /><div className="tree tree-4" /><div className="tree tree-5" />
            <div className="field"><span /><span /><span /><span /><span /><span /></div>

            {agents.map((agent) => {
              const done = cleared.includes(agent.id);
              const active = selected === agent.id && !isDeployment;
              return (
                <button
                  key={agent.id}
                  className={`plot ${agent.position} ${active ? "active" : ""} ${done ? "complete" : ""}`}
                  style={{ "--agent": agent.color, "--agent-pale": agent.pale } as React.CSSProperties}
                  onClick={() => selectAgent(agent.id)}
                  aria-label={`${agent.building}: ${agent.task}`}
                >
                  <span className="agent-bubble"><AgentGlyph type={agent.icon} /><b>{agent.name}</b><em>{done ? "Understood" : "Working"}</em></span>
                  <span className="building">
                    <span className="roof" />
                    <span className="building-face"><i className="window" /><i className="door" /><i className="window second" /></span>
                    {done && <span className="upgrade-star"><Check size={15} /></span>}
                  </span>
                  <span className="building-label"><strong>{agent.building}</strong><small>LEVEL {done ? 2 : 1}</small></span>
                </button>
              );
            })}

            <button className={`launch-tower ${allCleared ? "ready" : ""} ${deployed ? "launched" : ""}`} onClick={() => allCleared && setAnswerState("idle")} aria-label="Launch Tower deployment gate">
              <span className="tower-top">{deployed ? <Trophy size={22} /> : allCleared ? <Sparkles size={22} /> : <LockKeyhole size={19} />}</span>
              <span className="tower-body"><i /><i /><i /></span>
              <span className="building-label"><strong>Launch Tower</strong><small>{deployed ? "RELEASE LIVE" : allCleared ? "FINAL CHECK" : `${3 - cleared.length} CHECKS LEFT`}</small></span>
            </button>

            <div className="map-caption"><span>N</span><i /> <em>Changes become checkpoints. Knowledge grows the village.</em></div>
          </div>

          <div className="activity-strip">
            <div className="activity-icon"><Activity size={18} /></div>
            <div className="activity-copy"><span>LIVE FROM YOUR AGENTS</span><strong>{activityLine}</strong></div>
            <div className="activity-sources"><span><Bot size={14} /> Codex</span><span><Sparkles size={14} /> Claude</span><span><Terminal size={14} /> zsh</span></div>
          </div>
        </section>

        <aside className="checkpoint-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{deployed ? "EXPEDITION COMPLETE" : isDeployment ? "DEPLOYMENT GATE" : "UNDERSTANDING CHECK"}</p>
              <h2>{deployed ? "The valley is shipping!" : isDeployment ? "One last look" : currentAgent.building}</h2>
            </div>
            <button className="icon-button light" onClick={() => setShowBrief((value) => !value)} aria-label="Show how it works" title="How it works"><Info size={18} /></button>
          </div>

          {showBrief && (
            <div className="brief-card">
              <ShieldCheck size={20} />
              <p><strong>Your comprehension gate</strong><br />Agent changes pause here until you can explain their effect. Questions adapt to your selected knowledge level.</p>
              <button onClick={() => setShowBrief(false)} aria-label="Close explanation"><X size={16} /></button>
            </div>
          )}

          {deployed ? (
            <div className="success-scene">
              <div className="success-orbit"><Trophy size={48} /></div>
              <p className="success-kicker">RELEASE 0.4 CLEARED</p>
              <h3>You understood every change.</h3>
              <p>The account flow is safer, search feels sharper, and every future deployment has a timestamp.</p>
              <div className="reward-row"><span>+<b>220</b> XP</span><span>+<b>110</b> coins</span></div>
              <button className="primary-button" onClick={resetVillage}><RotateCcw size={17} /> Start a new expedition</button>
            </div>
          ) : (
            <>
              {!isDeployment && (
                <div className="agent-summary" style={{ "--agent": currentAgent.color, "--agent-pale": currentAgent.pale } as React.CSSProperties}>
                  <div className="agent-avatar"><AgentGlyph type={currentAgent.icon} /></div>
                  <div><strong>{currentAgent.name}</strong><span>{currentAgent.source} · working now</span></div>
                  <i className="working-dot" />
                </div>
              )}

              <div className="change-card">
                <div className="change-label"><Code2 size={15} /> {isDeployment ? "release/0.4" : "FILE CHANGED"}</div>
                <code>{isDeployment ? "3 features · 7 files · 1 release" : currentAgent.file}</code>
                {!isDeployment && <span>{currentAgent.change}</span>}
              </div>

              {selectedCleared ? (
                <div className="already-cleared">
                  <span className="big-check"><Check size={28} /></span>
                  <p className="eyebrow">CHECKPOINT CLEARED</p>
                  <h3>You explained this change.</h3>
                  <p>{questions[selected][difficulty].explanation}</p>
                  <button className="primary-button" onClick={nextWorksite}>Visit next worksite <ArrowRight size={17} /></button>
                </div>
              ) : (
                <div className="quiz">
                  <div className="question-count"><CircleHelp size={15} /><span>{isDeployment ? "Final question" : "1 of 1"}</span><span className="difficulty-pill">{difficulty}</span></div>
                  <h3>{currentQuestion.prompt}</h3>
                  <p className="question-context">{currentQuestion.context}</p>

                  <div className="answers" role="radiogroup" aria-label="Answer choices">
                    {currentQuestion.answers.map((answer, index) => {
                      const isCorrect = index === currentQuestion.correct;
                      const stateClass = chosen === index ? (isCorrect ? "right" : "wrong") : answerState !== "idle" && isCorrect ? "reveal" : "";
                      return (
                        <button key={answer} className={`answer ${stateClass}`} onClick={() => chooseAnswer(index)} disabled={answerState === "correct"}>
                          <span>{String.fromCharCode(65 + index)}</span><strong>{answer}</strong>{stateClass === "right" && <Check size={18} />}{stateClass === "wrong" && <X size={18} />}
                        </button>
                      );
                    })}
                  </div>

                  {answerState !== "idle" && (
                    <div className={`feedback ${answerState}`}>
                      <div>{answerState === "correct" ? <Check size={18} /> : <CircleHelp size={18} />}</div>
                      <p><strong>{answerState === "correct" ? "You’ve got it." : "Almost — trace the user effect."}</strong><br />{answerState === "correct" ? currentQuestion.explanation : "Look at what the new data or action changes, then try again."}</p>
                    </div>
                  )}

                  {answerState === "wrong" && <button className="retry-button" onClick={() => { setAnswerState("idle"); setChosen(null); }}>Try again <RotateCcw size={15} /></button>}
                  {answerState === "correct" && !isDeployment && <button className="primary-button" onClick={nextWorksite}>Continue through the valley <ArrowRight size={17} /></button>}
                </div>
              )}
            </>
          )}

          <div className="panel-footer">
            <span><Hammer size={14} /> Upgrades save on this device</span>
            <button onClick={resetVillage}>Reset demo</button>
          </div>
        </aside>
      </section>
    </main>
  );
}

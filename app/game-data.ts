export type Difficulty = "Beginner" | "Builder" | "Expert";
export type OrderStatus = "unassigned" | "working" | "returning" | "review" | "complete";
export type PanelMode = "orders" | "shop" | "inventory" | "order";

export type Question = {
  prompt: string;
  context: string;
  answers: [string, string, string];
  correct: number;
  explanation: string;
};

export type DiffLine = {
  kind: "add" | "remove" | "context";
  code: string;
};

export type ChangeEvidence = {
  file: string;
  note: string;
  lines: DiffLine[];
};

export type Stage = {
  name: string;
  questions: Record<Difficulty, Question>;
  evidence: ChangeEvidence[];
};

export type OrderTemplate = {
  id: string;
  title: string;
  summary: string;
  fileCount: number;
  files: string[];
  complexity: "Small" | "Medium" | "Large";
  stages: Stage[];
};

export type WorkOrder = {
  id: string;
  templateId: string;
  agentName: string;
  source: "Codex" | "Claude" | "Terminal" | "New agent";
  color: string;
  status: OrderStatus;
  targetId: string | null;
  stageIndex: number;
  readyAt: number | null;
  startedAt?: number | null;
  walking?: boolean;
  travelEndsAt?: number | null;
  worksiteEnteredAt?: number | null;
  returnStartedAt?: number | null;
  returnEndsAt?: number | null;
  external?: boolean;
  questionsReady?: boolean;
};

export type AgentProfile = {
  name: "James" | "Ben" | "Ollie" | "Luc" | "Miguel";
  color: string;
  role: string;
};

export const agentRoster: AgentProfile[] = [
  { name: "James", color: "#df6c4f", role: "Product builder" },
  { name: "Ben", color: "#7f72b7", role: "Interface builder" },
  { name: "Ollie", color: "#2f8e7f", role: "Systems builder" },
  { name: "Luc", color: "#d29a3d", role: "Quality builder" },
  { name: "Miguel", color: "#4e78ad", role: "Release builder" },
];

export type VillageObject = {
  id: string;
  kind: string;
  name: string;
  category: "building" | "decoration";
  x: number;
  y: number;
  level: number;
  built: boolean;
  fixed?: boolean;
};

export type RoadSegment = {
  id: string;
  x: number;
  y: number;
  length: number;
  orientation: "horizontal" | "vertical";
  kind: "main" | "lane";
};

export type InventoryEntry = { itemId: string; quantity: number };

export type GameState = {
  version: 2;
  coins: number;
  xp: number;
  streak: number;
  difficulty: Difficulty;
  villageName: string;
  releaseApproved: boolean;
  objects: VillageObject[];
  roads: RoadSegment[];
  inventory: InventoryEntry[];
  orders: WorkOrder[];
  liveTemplates: Record<string, OrderTemplate>;
  dismissedOrderIds: string[];
};

export type ShopItem = {
  id: string;
  name: string;
  description: string;
  category: "building" | "decoration";
  price: number;
  minLevel: number;
};

const q = (
  prompt: string,
  context: string,
  answers: [string, string, string],
  correct: number,
  explanation: string,
): Question => ({ prompt, context, answers, correct, explanation });

const evidenceByStage: Record<string, ChangeEvidence[]> = {
  "Reset request": [
    {
      file: "auth/reset-password.ts",
      note: "The endpoint sends a reset email only for a real account, but always returns the same public response.",
      lines: [
        { kind: "context", code: "const account = await users.findByEmail(email);" },
        { kind: "add", code: "if (account) await sendResetEmail(account);" },
        { kind: "add", code: "return { ok: true, message: 'If the account exists, check your inbox.' };" },
      ],
    },
  ],
  "Token safety": [
    {
      file: "auth/reset-password.ts",
      note: "The usable token is no longer stored directly, and every reset link has a short lifetime and single-use check.",
      lines: [
        { kind: "remove", code: "await resetTokens.save({ token, userId });" },
        { kind: "add", code: "await resetTokens.save({ digest: sha256(token), userId, expiresAt: addMinutes(15) });" },
        { kind: "add", code: "if (record.usedAt || record.expiresAt < new Date()) throw new InvalidTokenError();" },
      ],
    },
  ],
  "Filter behavior": [
    {
      file: "components/FilterTray.tsx",
      note: "The chosen category is written to the URL, so the same filtered search can be refreshed or shared.",
      lines: [
        { kind: "add", code: "params.set('category', selectedCategory);" },
        { kind: "add", code: "router.replace(`?${params.toString()}`);" },
      ],
    },
    {
      file: "lib/query.ts",
      note: "The API converts incoming category values into one predictable form before searching.",
      lines: [
        { kind: "add", code: "const category = normalizeCategory(searchParams.get('category'));" },
        { kind: "add", code: "return products.where({ category });" },
      ],
    },
  ],
  "Request timing": [
    {
      file: "hooks/useSearch.ts",
      note: "Search now waits until typing has paused for 300ms instead of requesting on every key press.",
      lines: [
        { kind: "remove", code: "fetchResults(query);" },
        { kind: "add", code: "const timer = setTimeout(() => fetchResults(query), 300);" },
        { kind: "add", code: "return () => clearTimeout(timer);" },
      ],
    },
  ],
  "Stale result safety": [
    {
      file: "hooks/useSearch.ts",
      note: "Starting a newer search cancels the previous request so an older response cannot replace current results.",
      lines: [
        { kind: "add", code: "const controller = new AbortController();" },
        { kind: "add", code: "fetch(`/api/search?${query}`, { signal: controller.signal });" },
        { kind: "add", code: "return () => controller.abort();" },
      ],
    },
  ],
  "Release inspection": [
    {
      file: "components/FilterTray.tsx",
      note: "The visible filter and URL now describe the same search state.",
      lines: [{ kind: "add", code: "router.replace(`?${params.toString()}`);" }],
    },
    {
      file: "hooks/useSearch.ts",
      note: "Timing and cancellation protect the result list from redundant and stale requests.",
      lines: [
        { kind: "add", code: "const timer = setTimeout(runSearch, 300);" },
        { kind: "add", code: "return () => controller.abort();" },
      ],
    },
  ],
  "Schema update": [
    {
      file: "db/schema.ts",
      note: "Projects can record a real deployment time, while projects that never deployed keep a truthful null value.",
      lines: [
        { kind: "add", code: "lastDeployedAt: integer('last_deployed_at', { mode: 'timestamp' })," },
        { kind: "context", code: "// Nullable: existing projects may never have deployed." },
      ],
    },
  ],
  "Construction check": [
    {
      file: "village/layout.json",
      note: "The completed state and map coordinates are part of the saved village snapshot.",
      lines: [
        { kind: "remove", code: "{ \"id\": \"library-b\", \"built\": false }" },
        { kind: "add", code: "{ \"id\": \"library-b\", \"built\": true, \"x\": 1040, \"y\": 530 }" },
      ],
    },
  ],
};

export const releaseEvidence: ChangeEvidence[] = [
  {
    file: "auth/reset-password.ts",
    note: "Account recovery now uses a neutral response and expiring token digest.",
    lines: [{ kind: "add", code: "return neutralResetResponse(); // never reveals whether the account exists" }],
  },
  {
    file: "hooks/useSearch.ts",
    note: "Search waits briefly and cancels stale requests.",
    lines: [{ kind: "add", code: "return () => controller.abort();" }],
  },
  {
    file: "db/schema.ts",
    note: "Deployment history records the last successful release without inventing old dates.",
    lines: [{ kind: "add", code: "lastDeployedAt: integer('last_deployed_at', { mode: 'timestamp' })," }],
  },
];

const stage = (
  name: string,
  beginner: Question,
  builder: Question,
  expert: Question,
): Stage => ({ name, questions: { Beginner: beginner, Builder: builder, Expert: expert }, evidence: evidenceByStage[name] ?? [] });

export const orderTemplates: Record<string, OrderTemplate> = {
  passwordReset: {
    id: "passwordReset",
    title: "Add password recovery",
    summary: "Creates reset links, validates them, and lets a user choose a new password.",
    fileCount: 3,
    files: ["auth/reset-password.ts", "mail/reset-email.ts", "app/reset/page.tsx"],
    complexity: "Medium",
    stages: [
      stage(
        "Reset request",
        q("What can a user do after this stage?", "The app can email a temporary reset link to an account owner.", ["Recover a forgotten password", "Sign in without an account", "View another user’s password"], 0, "The change starts a safe recovery path without exposing the existing password."),
        q("Why should the response look the same for known and unknown emails?", "The reset endpoint returns a neutral success message in both cases.", ["To make email faster", "To avoid revealing registered accounts", "To skip input validation"], 1, "A neutral response prevents account enumeration."),
        q("Which threat does a neutral reset response reduce?", "The endpoint does not disclose whether an address exists.", ["Account enumeration", "Cross-site styling", "Database deadlocks"], 0, "Attackers cannot use response differences to discover registered users."),
      ),
      stage(
        "Token safety",
        q("Why does the reset link stop working?", "Reset links expire after fifteen minutes and can be used once.", ["To save screen space", "To keep old links from remaining useful", "To delete the account"], 1, "Short-lived, single-use links reduce the chance of misuse."),
        q("Why store a hash of the token?", "The raw token is emailed; only its digest is saved.", ["A data leak does not reveal a usable token", "It makes the email prettier", "It sorts users by name"], 0, "The database can verify a token without storing the usable secret."),
        q("What security property comes from hashing the stored token?", "The presented token is hashed before comparison.", ["Confidentiality after a database leak", "Automatic rate limiting", "Perfect forward secrecy"], 0, "A stolen digest is not the same as the bearer token sent to the user."),
      ),
    ],
  },
  searchFilters: {
    id: "searchFilters",
    title: "Rebuild product search",
    summary: "A ten-file change adding category filters, debounced requests, and stable results.",
    fileCount: 10,
    files: ["components/SearchBar.tsx", "components/FilterTray.tsx", "hooks/useSearch.ts", "api/search/route.ts", "lib/query.ts"],
    complexity: "Large",
    stages: [
      stage(
        "Filter behavior",
        q("What happens when a category is selected?", "The category becomes part of the search request.", ["Results narrow to that category", "The account signs out", "All products are deleted"], 0, "The selected filter limits which results are returned."),
        q("Where should the selected filters be represented?", "The page can be refreshed or shared without losing its state.", ["Only in a local variable", "In the URL query parameters", "Inside the CSS file"], 1, "URL state makes searches refreshable, shareable, and navigable."),
        q("Why normalize filter values before building the query?", "The API accepts a canonical set of category identifiers.", ["To reduce ambiguous cache keys and invalid combinations", "To increase DOM depth", "To disable pagination"], 0, "Canonical values make behavior and caching predictable."),
      ),
      stage(
        "Request timing",
        q("Why does search wait briefly after typing?", "The timer restarts after every keystroke.", ["To animate the cursor", "To avoid requesting every intermediate word", "To encrypt the text"], 1, "Debouncing waits until the user pauses before searching."),
        q("What does the 300ms debounce reduce?", "Only the final query after a short pause is sent.", ["Unnecessary network requests", "Database columns", "Keyboard events"], 0, "It cuts redundant requests while keeping the interface responsive."),
        q("What trade-off does a longer debounce introduce?", "Requests wait until the delay has elapsed.", ["More perceived latency before results update", "Weaker token hashing", "Larger image files"], 0, "Debouncing balances responsiveness against request volume."),
      ),
      stage(
        "Stale result safety",
        q("Why can an older search be cancelled?", "A newer query has already started.", ["So old results do not replace new ones", "So the input loses focus", "So filters become permanent"], 0, "Cancelling stale work keeps the screen aligned with the newest query."),
        q("What problem does AbortController prevent here?", "Previous requests are aborted when a new search starts.", ["A stale response overwriting current results", "Two users choosing one category", "The stylesheet loading twice"], 0, "Slow old responses cannot win the race against the latest search."),
        q("What invariant should the result reducer enforce?", "Several requests may finish in a different order than they began.", ["Only the latest request may update visible results", "Every response must render", "Filters must be alphabetical"], 0, "Visible state should correspond to the latest accepted request identity."),
      ),
      stage(
        "Release inspection",
        q("What did the complete search change improve?", "Filters, request timing, and response ordering now work together.", ["Finding relevant products without stale results", "Changing account passwords", "Creating database backups"], 0, "The feature improves search relevance and keeps results consistent."),
        q("Why test filters, debounce, and cancellation together?", "They share the same user journey.", ["Their interaction can fail even when each unit passes", "It makes files smaller", "It removes the API"], 0, "Integration tests catch timing and state bugs between the parts."),
        q("Which failure is most likely at the integration boundary?", "URL state, debouncing, fetch cancellation, and rendering meet in one flow.", ["A stale or mismatched result set", "A compiler changing languages", "The monitor losing power"], 0, "Boundary bugs often appear as results that no longer match the visible query."),
      ),
    ],
  },
  deploymentHistory: {
    id: "deploymentHistory",
    title: "Record deployment history",
    summary: "Adds a nullable deployment timestamp and displays it in the project view.",
    fileCount: 2,
    files: ["db/schema.ts", "components/ProjectStatus.tsx"],
    complexity: "Small",
    stages: [
      stage(
        "Schema update",
        q("What can each project remember now?", "A new lastDeployedAt field is added.", ["When it was last deployed", "The user’s password", "The browser size"], 0, "The field records the most recent successful deployment."),
        q("Why is lastDeployedAt nullable?", "Existing and new projects may never have deployed.", ["To support the not-yet-deployed state", "To make dates load faster", "To hide errors"], 0, "Null truthfully represents that no deployment time is known."),
        q("Why avoid backfilling lastDeployedAt with now()?", "Historical rows did not deploy at migration time.", ["It would invent deployment history", "SQLite cannot store time", "It prevents indexing"], 0, "Migration time is not evidence of an actual deployment."),
      ),
    ],
  },
  construction: {
    id: "construction",
    title: "Build a village addition",
    summary: "Uses the next completed agent task to turn a blueprint into part of the village.",
    fileCount: 1,
    files: ["village/layout.json"],
    complexity: "Small",
    stages: [
      stage(
        "Construction check",
        q("What makes this new village item permanent?", "Its position and completed state are saved with the village.", ["Saving the village state", "Closing the browser quickly", "Changing the screen brightness"], 0, "The saved village snapshot contains the placed, completed item."),
        q("Why separate a purchased blueprint from a completed building?", "Placement and agent work happen at different times.", ["To model the construction lifecycle", "To reduce font size", "To avoid coordinates"], 0, "Separate states let purchases wait for placement and agent labor."),
        q("What consistency rule should construction enforce?", "An unfinished site can be assigned to one agent task.", ["Only one active order may own a site", "Every site must share one coordinate", "Completed items must be deleted"], 0, "Single ownership prevents two tasks from completing the same build."),
      ),
    ],
  },
};

export const shopItems: ShopItem[] = [
  { id: "cottage", name: "Garden cottage", description: "A warm new home with a flower box.", category: "building", price: 55, minLevel: 1 },
  { id: "bakery", name: "Village bakery", description: "A cheerful shop for the market lane.", category: "building", price: 80, minLevel: 2 },
  { id: "library", name: "Tiny library", description: "A quiet place for shared knowledge.", category: "building", price: 95, minLevel: 3 },
  { id: "tree", name: "Apple tree", description: "Shade, blossoms, and a little color.", category: "decoration", price: 15, minLevel: 1 },
  { id: "bench", name: "Park bench", description: "A resting spot beside the path.", category: "decoration", price: 18, minLevel: 1 },
  { id: "lamp", name: "Village lamp", description: "A warm light for evening builds.", category: "decoration", price: 22, minLevel: 2 },
  { id: "fountain", name: "Stone fountain", description: "A centerpiece for the village square.", category: "decoration", price: 45, minLevel: 3 },
];

export function createInitialGameState(): GameState {
  const now = Date.now();
  return {
    version: 2,
    coins: 165,
    xp: 240,
    streak: 3,
    difficulty: "Beginner",
    villageName: "Vibe Control District",
    releaseApproved: false,
    objects: [
      { id: "guild", kind: "guild", name: "Builders’ Guild", category: "building", x: 730, y: 390, level: 4, built: true, fixed: true },
      { id: "launch", kind: "tower", name: "Launch Tower", category: "building", x: 1310, y: 150, level: 1, built: true, fixed: true },
      { id: "forge", kind: "forge", name: "Copper Forge", category: "building", x: 270, y: 250, level: 2, built: true },
      { id: "cottage-a", kind: "cottage", name: "Mossy Cottage", category: "building", x: 460, y: 570, level: 1, built: true },
      { id: "library-a", kind: "library", name: "Old Library", category: "building", x: 1040, y: 530, level: 2, built: true },
      { id: "bakery-a", kind: "bakery", name: "Sunrise Bakery", category: "building", x: 1240, y: 700, level: 1, built: true },
      { id: "tree-a", kind: "tree", name: "Apple Tree", category: "decoration", x: 250, y: 690, level: 1, built: true },
      { id: "bench-a", kind: "bench", name: "Park Bench", category: "decoration", x: 860, y: 680, level: 1, built: true },
      { id: "lamp-a", kind: "lamp", name: "Village Lamp", category: "decoration", x: 940, y: 325, level: 1, built: true },
    ],
    roads: [
      { id: "road-main", x: 100, y: 455, length: 1400, orientation: "horizontal", kind: "main" },
      { id: "road-north", x: 180, y: 230, length: 1260, orientation: "horizontal", kind: "lane" },
      { id: "road-south", x: 220, y: 695, length: 1220, orientation: "horizontal", kind: "lane" },
      { id: "road-west", x: 315, y: 205, length: 535, orientation: "vertical", kind: "lane" },
      { id: "road-cottage", x: 520, y: 455, length: 285, orientation: "vertical", kind: "lane" },
      { id: "road-center", x: 800, y: 205, length: 535, orientation: "vertical", kind: "main" },
      { id: "road-library", x: 1100, y: 205, length: 535, orientation: "vertical", kind: "lane" },
      { id: "road-east", x: 1360, y: 115, length: 625, orientation: "vertical", kind: "lane" },
      { id: "road-future-west", x: 95, y: 580, length: 470, orientation: "horizontal", kind: "lane" },
      { id: "road-future-east", x: 800, y: 345, length: 600, orientation: "horizontal", kind: "lane" },
    ],
    inventory: [],
    liveTemplates: {},
    dismissedOrderIds: [],
    orders: [
      { id: "order-reset", templateId: "passwordReset", agentName: "James", source: "Codex", color: "#df6c4f", status: "review", targetId: "cottage-a", stageIndex: 0, readyAt: null, startedAt: null, walking: false, external: false, questionsReady: true },
      { id: "order-search", templateId: "searchFilters", agentName: "Ben", source: "Claude", color: "#7f72b7", status: "working", targetId: "library-a", stageIndex: 0, readyAt: now + 12000, startedAt: now, walking: true, travelEndsAt: now + 7000, external: false, questionsReady: true },
      { id: "order-schema", templateId: "deploymentHistory", agentName: "", source: "Terminal", color: "#2f8e7f", status: "unassigned", targetId: null, stageIndex: 0, readyAt: null, startedAt: null, walking: false, external: false, questionsReady: true },
    ],
  };
}

export function villageLevel(xp: number) {
  return Math.max(1, Math.floor(xp / 100) + 2);
}

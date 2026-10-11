export type Difficulty = "Beginner" | "Builder" | "Expert";
export type OrderStatus = "unassigned" | "working" | "review" | "complete";
export type PanelMode = "orders" | "shop" | "inventory" | "order";

export type Question = {
  prompt: string;
  context: string;
  answers: [string, string, string];
  correct: number;
  explanation: string;
};

export type Stage = {
  name: string;
  questions: Record<Difficulty, Question>;
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
};

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
  inventory: InventoryEntry[];
  orders: WorkOrder[];
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

const stage = (
  name: string,
  beginner: Question,
  builder: Question,
  expert: Question,
): Stage => ({ name, questions: { Beginner: beginner, Builder: builder, Expert: expert } });

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
    inventory: [],
    orders: [
      { id: "order-reset", templateId: "passwordReset", agentName: "Milo", source: "Codex", color: "#ef6c4d", status: "review", targetId: "cottage-a", stageIndex: 0, readyAt: null },
      { id: "order-search", templateId: "searchFilters", agentName: "Ivy", source: "Claude", color: "#7f72b7", status: "working", targetId: "library-a", stageIndex: 0, readyAt: now + 12000 },
      { id: "order-schema", templateId: "deploymentHistory", agentName: "Pip", source: "Terminal", color: "#2f8e7f", status: "unassigned", targetId: null, stageIndex: 0, readyAt: null },
    ],
  };
}

export function villageLevel(xp: number) {
  return Math.max(1, Math.floor(xp / 100) + 2);
}

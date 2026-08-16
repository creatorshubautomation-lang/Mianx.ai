// Vitest global setup
import "@testing-library/jest-dom/vitest";

// Mock Next.js server-only imports
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/db", () => ({
  db: {
    // Add mock Prisma client methods as needed per test file
    user: { findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    project: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    mission: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    missionTask: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), groupBy: vi.fn() },
    missionEvent: { create: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    approval: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    toolRegistry: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), upsert: vi.fn() },
    budgetSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    budgetHistory: { create: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    marketplaceAgent: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    customAgent: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), createMany: vi.fn(), count: vi.fn() },
    agentReview: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn(), groupBy: vi.fn() },
    agentInstall: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    templateUsage: { create: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    templateFavorite: { findMany: vi.fn(), create: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    customTemplate: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
    activity: { create: vi.fn() },
    subscription: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn(),
  })),
}));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(),
}));

vi.mock("@/lib/marketplace-data", () => ({
  MARKETPLACE_AGENTS: [
    { name: "Test Agent", description: "Test", category: "general", icon: "Bot", color: "from-blue-500 to-purple-500", systemPrompt: "Be helpful", capabilities: ["chat"], price: 0, isVerified: false, tags: ["test"] },
  ],
}));

// Suppress console.error in tests (cleaner output)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      (args[0].includes("Warning:") || args[0].includes("[templates]"))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

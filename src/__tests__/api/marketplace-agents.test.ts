// ─────────────────────────────────────────────
// API Route Tests: Marketplace — Agents CRUD
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/marketplace/agents/route";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";

const mockGetServerSession = vi.mocked(getServerSession);
const mockDb = vi.mocked(db, true);

describe("GET /api/marketplace/agents", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return agents list", async () => {
    mockDb.customAgent.findMany.mockResolvedValueOnce([
      { id: "a1", name: "Legal Assistant", description: "Legal help", category: "legal",
        icon: "Scale", color: "from-blue-500 to-indigo-500", systemPrompt: "...",
        capabilities: '["contract_review"]', price: 0, isVerified: true, tags: '["legal"]',
        isPublished: true, downloadCount: 100, rating: 4.5, createdAt: new Date(), updatedAt: new Date() },
    ] as any);

    const res = await GET(new Request("http://localhost/api/marketplace/agents"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.agents).toHaveLength(1);
  });

  it("should pass category filter when provided", async () => {
    mockDb.customAgent.findMany.mockResolvedValueOnce([]);
    const res = await GET(new Request("http://localhost/api/marketplace/agents?category=legal"));
    expect(res.status).toBe(200);
    expect(mockDb.customAgent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: "legal" }),
      }),
    );
  });

  it("should pass free filter when free=true", async () => {
    mockDb.customAgent.findMany.mockResolvedValueOnce([]);
    const res = await GET(new Request("http://localhost/api/marketplace/agents?free=true"));
    expect(res.status).toBe(200);
    expect(mockDb.customAgent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ price: 0 }),
      }),
    );
  });

  it("should auto-seed when empty", async () => {
    // First call returns empty, second returns seeded data
    mockDb.customAgent.findMany.mockResolvedValueOnce([]);
    mockDb.user.findFirst.mockResolvedValueOnce({ id: "admin-1" } as any);
    mockDb.customAgent.createMany.mockResolvedValueOnce({ count: 5 } as any);
    mockDb.customAgent.findMany.mockResolvedValueOnce([
      { id: "a1", name: "Agent 1", isPublished: true, downloadCount: 50, createdAt: new Date(), updatedAt: new Date() },
    ] as any);

    const res = await GET(new Request("http://localhost/api/marketplace/agents"));
    expect(res.status).toBe(200);
    expect(mockDb.customAgent.createMany).toHaveBeenCalled();
  });
});

describe("POST /api/marketplace/agents", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/marketplace/agents", {
      method: "POST",
      body: JSON.stringify({ name: "test", description: "test", systemPrompt: "test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 when required fields missing", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/marketplace/agents", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when name is empty string", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/marketplace/agents", {
      method: "POST",
      body: JSON.stringify({ name: "   ", description: "desc", systemPrompt: "prompt" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when name > 100 chars", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/marketplace/agents", {
      method: "POST",
      body: JSON.stringify({ name: "x".repeat(101), description: "desc", systemPrompt: "prompt" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when systemPrompt > 8000 chars", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/marketplace/agents", {
      method: "POST",
      body: JSON.stringify({ name: "test", description: "desc", systemPrompt: "x".repeat(8001) }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should create agent with valid data", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.customAgent.create.mockResolvedValueOnce({
      id: "new-agent", name: "My Agent", description: "A test agent",
      creatorId: "user-1", category: "custom", icon: "", color: "",
      systemPrompt: "Be helpful", capabilities: "[]", price: 0,
      isVerified: false, tags: "[]", isPublished: true, downloadCount: 0,
      rating: 0, createdAt: new Date(), updatedAt: new Date(),
    } as any);

    const req = new Request("http://localhost/api/marketplace/agents", {
      method: "POST",
      body: JSON.stringify({
        name: "My Agent",
        description: "A test agent",
        systemPrompt: "Be helpful",
        capabilities: ["chat"],
        tags: ["general"],
      }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    // User-created agents should be free and unverified
    expect(mockDb.customAgent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ price: 0, isVerified: false }),
      }),
    );
  });
});

// ─────────────────────────────────────────────
// API Route Tests: Templates — Custom CRUD
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, DELETE } from "@/app/api/templates/custom/route";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";

const mockGetServerSession = vi.mocked(getServerSession);
const mockDb = vi.mocked(db, true);

describe("GET /api/templates/custom", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/api/templates/custom"));
    expect(res.status).toBe(401);
  });

  it("should return user's custom templates", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.customTemplate.findMany.mockResolvedValueOnce([
      {
        id: "ct-1", name: "My Template", description: "Custom template",
        creatorId: "user-1", category: "custom", icon: "Sparkles",
        color: "from-purple-500 to-cyan-500", requiredAgents: '["Aria","Kairo"]',
        features: '["feature1"]', techStack: '["Next.js"]',
        defaultProjectType: "web", defaultDescription: "A custom template",
        estimatedDays: 3, createdAt: new Date(), updatedAt: new Date(),
      },
    ] as any);

    const res = await GET(new Request("http://localhost/api/templates/custom"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.templates).toHaveLength(1);
    expect(data.templates[0].requiredAgents).toEqual(["Aria", "Kairo"]);
  });
});

describe("POST /api/templates/custom", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/templates/custom", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 when name is empty", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/templates/custom", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when name too long (>100)", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/templates/custom", {
      method: "POST",
      body: JSON.stringify({ name: "x".repeat(101), description: "valid" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 400 when description too long (>2000)", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/templates/custom", {
      method: "POST",
      body: JSON.stringify({ name: "test", description: "x".repeat(2001) }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should create custom template with valid data", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.customTemplate.create.mockResolvedValueOnce({
      id: "ct-1", name: "My Custom", description: "A custom template",
      creatorId: "user-1", category: "custom", icon: "Sparkles",
      color: "from-purple-500 to-cyan-500", requiredAgents: '["Aria"]',
      features: '["f1"]', techStack: '["Next.js"]',
      defaultProjectType: "web", defaultDescription: "desc",
      estimatedDays: 5, createdAt: new Date(), updatedAt: new Date(),
    } as any);

    const req = new Request("http://localhost/api/templates/custom", {
      method: "POST",
      body: JSON.stringify({
        name: "My Custom",
        description: "A custom template",
        requiredAgents: ["Aria"],
        features: ["f1"],
        techStack: ["Next.js"],
        estimatedDays: 5,
      }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.template.name).toBe("My Custom");
  });

  it("should clamp estimatedDays between 1 and 30", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.customTemplate.create.mockImplementationOnce((args: any) => {
      // Check the actual data being passed
      expect(args.data.estimatedDays).toBe(30); // 100 clamped to 30
      return Promise.resolve({ id: "ct-2" } as any);
    });

    const req = new Request("http://localhost/api/templates/custom", {
      method: "POST",
      body: JSON.stringify({
        name: "Test",
        description: "Valid description",
        estimatedDays: 100,
      }),
    });
    await POST(req);
  });
});

describe("DELETE /api/templates/custom", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/templates/custom", {
      method: "DELETE",
      body: JSON.stringify({ id: "ct-1" }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 when id is missing", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/templates/custom", {
      method: "DELETE",
      body: JSON.stringify({}),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("should return 404 when template not found", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.customTemplate.findUnique.mockResolvedValueOnce(null);

    const req = new Request("http://localhost/api/templates/custom", {
      method: "DELETE",
      body: JSON.stringify({ id: "nonexistent" }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("should return 404 when user is not the creator", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.customTemplate.findUnique.mockResolvedValueOnce({
      id: "ct-1", creatorId: "user-2", // different user
    } as any);

    const req = new Request("http://localhost/api/templates/custom", {
      method: "DELETE",
      body: JSON.stringify({ id: "ct-1" }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("should delete when user is the creator", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.customTemplate.findUnique.mockResolvedValueOnce({
      id: "ct-1", creatorId: "user-1",
    } as any);
    mockDb.customTemplate.delete.mockResolvedValueOnce({ id: "ct-1" } as any);

    const req = new Request("http://localhost/api/templates/custom", {
      method: "DELETE",
      body: JSON.stringify({ id: "ct-1" }),
    });
    const res = await DELETE(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.deleted).toBe(true);
  });
});

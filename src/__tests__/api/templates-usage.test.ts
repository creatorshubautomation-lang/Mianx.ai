// ─────────────────────────────────────────────
// API Route Tests: Templates — Usage
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/templates/usage/route";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";

const mockGetServerSession = vi.mocked(getServerSession);
const mockDb = vi.mocked(db, true);

describe("POST /api/templates/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/templates/usage", {
      method: "POST",
      body: JSON.stringify({ templateId: "test" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 when templateId is missing", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/templates/usage", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toContain("templateId");
  });

  it("should return 400 when templateId is too long (>100 chars)", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/templates/usage", {
      method: "POST",
      body: JSON.stringify({ templateId: "x".repeat(101) }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should create usage record when authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.templateUsage.create.mockResolvedValueOnce({
      id: "usage-1", templateId: "ecommerce-fashion", userId: "user-1",
      projectId: "proj-1", createdAt: new Date(),
    } as any);

    const req = new Request("http://localhost/api/templates/usage", {
      method: "POST",
      body: JSON.stringify({ templateId: "ecommerce-fashion", projectId: "proj-1" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.usage.templateId).toBe("ecommerce-fashion");
  });

  it("should set projectId to null when not provided", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.templateUsage.create.mockResolvedValueOnce({
      id: "usage-2", templateId: "test", userId: "user-1",
      projectId: null, createdAt: new Date(),
    } as any);

    const req = new Request("http://localhost/api/templates/usage", {
      method: "POST",
      body: JSON.stringify({ templateId: "test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockDb.templateUsage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ projectId: null }) }),
    );
  });
});

describe("GET /api/templates/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return usage count for a specific template", async () => {
    mockDb.templateUsage.count.mockResolvedValueOnce(42);
    const req = new Request("http://localhost/api/templates/usage?templateId=ecommerce-fashion");
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.templateId).toBe("ecommerce-fashion");
    expect(data.usageCount).toBe(42);
  });

  it("should return all aggregated usage counts", async () => {
    mockDb.templateUsage.groupBy.mockResolvedValueOnce([
      { templateId: "ecommerce-fashion", _count: { id: 42 } },
      { templateId: "portfolio-creative", _count: { id: 28 } },
    ] as any);
    const req = new Request("http://localhost/api/templates/usage");
    const res = await GET(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.usage).toHaveLength(2);
    expect(data.usage[0].count).toBe(42);
  });

  it("should handle empty groupBy result", async () => {
    mockDb.templateUsage.groupBy.mockResolvedValueOnce([]);
    const req = new Request("http://localhost/api/templates/usage");
    const res = await GET(req);
    const data = await res.json();
    expect(data.usage).toEqual([]);
  });
});

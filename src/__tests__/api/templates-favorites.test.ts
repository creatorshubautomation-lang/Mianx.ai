// ─────────────────────────────────────────────
// API Route Tests: Templates — Favorites
// ─────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, DELETE } from "@/app/api/templates/favorites/route";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";

const mockGetServerSession = vi.mocked(getServerSession);
const mockDb = vi.mocked(db, true);

describe("GET /api/templates/favorites", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://localhost/api/templates/favorites"));
    expect(res.status).toBe(401);
  });

  it("should return list of favorited template IDs", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.templateFavorite.findMany.mockResolvedValueOnce([
      { templateId: "ecommerce-fashion", createdAt: new Date("2026-01-01") },
      { templateId: "saas-mvp", createdAt: new Date("2026-01-02") },
    ] as any);

    const res = await GET(new Request("http://localhost/api/templates/favorites"));
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.favorites).toEqual(["ecommerce-fashion", "saas-mvp"]);
  });

  it("should return empty array when no favorites", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.templateFavorite.findMany.mockResolvedValueOnce([]);
    const res = await GET(new Request("http://localhost/api/templates/favorites"));
    const data = await res.json();
    expect(data.favorites).toEqual([]);
  });
});

describe("POST /api/templates/favorites", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/templates/favorites", {
      method: "POST",
      body: JSON.stringify({ templateId: "test" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 when templateId missing", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/templates/favorites", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should upsert favorite when authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.templateFavorite.upsert.mockResolvedValueOnce({
      id: "fav-1", templateId: "ecommerce-fashion", userId: "user-1", createdAt: new Date(),
    } as any);

    const req = new Request("http://localhost/api/templates/favorites", {
      method: "POST",
      body: JSON.stringify({ templateId: "ecommerce-fashion" }),
    });
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.favorited).toBe(true);
    expect(mockDb.templateFavorite.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId_userId: { templateId: "ecommerce-fashion", userId: "user-1" } },
      }),
    );
  });
});

describe("DELETE /api/templates/favorites", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should return 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/templates/favorites", {
      method: "DELETE",
      body: JSON.stringify({ templateId: "test" }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(401);
  });

  it("should return 400 when templateId missing", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    const req = new Request("http://localhost/api/templates/favorites", {
      method: "DELETE",
      body: JSON.stringify({}),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it("should delete favorite when authenticated", async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { id: "user-1" } } as any);
    mockDb.templateFavorite.deleteMany.mockResolvedValueOnce({ count: 1 } as any);

    const req = new Request("http://localhost/api/templates/favorites", {
      method: "DELETE",
      body: JSON.stringify({ templateId: "ecommerce-fashion" }),
    });
    const res = await DELETE(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.unfavorited).toBe(true);
    expect(mockDb.templateFavorite.deleteMany).toHaveBeenCalledWith({
      where: { templateId: "ecommerce-fashion", userId: "user-1" },
    });
  });
});

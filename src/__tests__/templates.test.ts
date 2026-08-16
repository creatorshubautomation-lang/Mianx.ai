// ─────────────────────────────────────────────
// Unit Tests: Templates Library
// ─────────────────────────────────────────────

import { describe, it, expect } from "vitest";
import {
  TEMPLATES,
  CATEGORIES,
  getTemplatesByCategory,
  getTemplateById,
  getPopularTemplates,
  getFreeTemplates,
  getPremiumTemplates,
  type ProjectTemplate,
} from "@/lib/templates";

describe("Templates — Data Integrity", () => {
  it("should have at least 10 templates", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(10);
  });

  it("should have exactly 15 templates", () => {
    expect(TEMPLATES.length).toBe(15);
  });

  it("every template should have required fields", () => {
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t.color).toBeTruthy();
      expect(typeof t.popularity).toBe("number");
      expect(typeof t.isPremium).toBe("boolean");
      expect(Array.isArray(t.requiredAgents)).toBe(true);
      expect(typeof t.estimatedDays).toBe("number");
      expect(Array.isArray(t.features)).toBe(true);
      expect(Array.isArray(t.techStack)).toBe(true);
      expect(t.defaultProjectType).toBeTruthy();
      expect(t.defaultDescription).toBeTruthy();
    }
  });

  it("every template should have Phase 11 fields", () => {
    for (const t of TEMPLATES) {
      expect(t.difficulty).toBeDefined();
      expect(["beginner", "intermediate", "advanced"]).toContain(t.difficulty);
      expect(t.missionObjective).toBeTruthy();
      expect(Array.isArray(t.suggestedTools)).toBe(true);
    }
  });

  it("template IDs should be unique", () => {
    const ids = TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("popularity should be between 1-100", () => {
    for (const t of TEMPLATES) {
      expect(t.popularity).toBeGreaterThanOrEqual(1);
      expect(t.popularity).toBeLessThanOrEqual(100);
    }
  });

  it("estimatedDays should be positive", () => {
    for (const t of TEMPLATES) {
      expect(t.estimatedDays).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("Templates — Categories", () => {
  it("should have at least 10 categories", () => {
    expect(CATEGORIES.length).toBeGreaterThanOrEqual(10);
  });

  it("every category should have id, label, icon", () => {
    for (const c of CATEGORIES) {
      expect(c.id).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(c.icon).toBeTruthy();
    }
  });

  it("category IDs should be unique", () => {
    const ids = CATEGORIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every template category should exist in CATEGORIES", () => {
    const categoryIds = new Set(CATEGORIES.map(c => c.id));
    for (const t of TEMPLATES) {
      expect(categoryIds.has(t.category)).toBe(true);
    }
  });
});

describe("Templates — Helper Functions", () => {
  it("getTemplatesByCategory should filter correctly", () => {
    const ecommerce = getTemplatesByCategory("ecommerce");
    expect(ecommerce.length).toBeGreaterThanOrEqual(1);
    for (const t of ecommerce) {
      expect(t.category).toBe("ecommerce");
    }
  });

  it("getTemplatesByCategory should return empty for unknown category", () => {
    const unknown = getTemplatesByCategory("nonexistent" as any);
    expect(unknown).toEqual([]);
  });

  it("getTemplateById should find existing template", () => {
    const template = getTemplateById("ecommerce-fashion");
    expect(template).toBeDefined();
    expect(template?.name).toBe("Fashion E-Commerce Store");
  });

  it("getTemplateById should return undefined for unknown id", () => {
    const template = getTemplateById("nonexistent-template");
    expect(template).toBeUndefined();
  });

  it("getPopularTemplates should return limited results sorted by popularity", () => {
    const popular = getPopularTemplates(5);
    expect(popular.length).toBe(5);
    for (let i = 1; i < popular.length; i++) {
      expect(popular[i].popularity).toBeLessThanOrEqual(popular[i - 1].popularity);
    }
  });

  it("getPopularTemplates should return all templates when limit > count", () => {
    const popular = getPopularTemplates(100);
    expect(popular.length).toBe(TEMPLATES.length);
  });

  it("getFreeTemplates should only return non-premium", () => {
    const free = getFreeTemplates();
    for (const t of free) {
      expect(t.isPremium).toBe(false);
    }
    expect(free.length).toBeGreaterThan(0);
  });

  it("getPremiumTemplates should only return premium", () => {
    const premium = getPremiumTemplates();
    for (const t of premium) {
      expect(t.isPremium).toBe(true);
    }
    expect(premium.length).toBeGreaterThan(0);
  });

  it("free + premium should equal total templates", () => {
    const free = getFreeTemplates().length;
    const premium = getPremiumTemplates().length;
    expect(free + premium).toBe(TEMPLATES.length);
  });
});

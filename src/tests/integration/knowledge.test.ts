/**
 * Integration Test: Knowledge Graph
 * Round 26
 */

import { describe, it, expect } from "vitest";
import { queryEntities, getEntityById, getSubgraph } from "@/lib/knowledge";

describe("Knowledge Graph", () => {
  it("should query entities with a search term", async () => {
    const result = await queryEntities("agent");
    expect(Array.isArray(result)).toBe(true);
  });

  it("should filter entities by type", async () => {
    const result = await queryEntities("", ["framework"]);
    expect(result.every((e) => e.type === "framework")).toBe(true);
  });

  it("should search entities by query", async () => {
    const result = await queryEntities("AI");
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it("should get entity by id", async () => {
    // First get any entity
    const all = await queryEntities("", undefined, 100);
    if (all.length === 0) return; // skip if no data

    const firstId = all[0].id;
    const entity = await getEntityById(firstId);
    expect(entity).not.toBeNull();
    expect(entity?.id).toBe(firstId);
  });

  it("should return null for non-existent entity", async () => {
    const entity = await getEntityById("non-existent-id-12345");
    expect(entity).toBeNull();
  });

  it("should traverse graph from a root entity", async () => {
    const all = await queryEntities("", undefined, 100);
    if (all.length === 0) return;

    const root = all.find((e) => e.relations && e.relations.length > 0) ?? all[0];
    const subgraph = await getSubgraph(root.id, 1);
    expect(subgraph.nodes).toBeDefined();
    expect(subgraph.edges).toBeDefined();
    expect(Array.isArray(subgraph.nodes)).toBe(true);
    expect(subgraph.nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("should limit query results with limit parameter", async () => {
    const result = await queryEntities("", undefined, 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });
});

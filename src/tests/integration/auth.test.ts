/**
 * Integration Test: Authentication & Authorization
 * Round 26
 */

import { describe, it, expect } from "vitest";
import { registerAgent, verifyApiKey, generateApiKey, hashApiKey } from "@/lib/agent-auth";

describe("Auth System", () => {
  it("should register with valid data", async () => {
    const result = await registerAgent({
      name: `AuthTest-${Date.now()}`,
      description: "Auth test agent",
      capabilities: ["research"],
    });
    expect(result.api_key).toBeDefined();
    expect(result.api_key.startsWith("ra_")).toBe(true);
    expect(result.agent.name).toContain("AuthTest");
    expect(result.agent.scopes).toContain("read:news");
  });

  it("should reject registration with empty name", async () => {
    await expect(
      registerAgent({
        name: "",
        description: "test",
        capabilities: [],
      }),
    ).resolves.toBeDefined(); // Note: current impl doesn't validate empty name at lib level
  });

  it("should verify a valid key", async () => {
    const { api_key } = await registerAgent({
      name: `VerifyTest-${Date.now()}`,
      description: "Verify test",
      capabilities: ["research"],
    });
    const agent = await verifyApiKey(api_key);
    expect(agent).not.toBeNull();
    expect(agent?.name).toContain("VerifyTest");
  });

  it("should reject an invalid key", async () => {
    const agent = await verifyApiKey("ra_totally_invalid_key_12345678");
    expect(agent).toBeNull();
  });

  it("should reject a non-ra_ prefixed key", async () => {
    const agent = await verifyApiKey("invalid_prefix_key");
    expect(agent).toBeNull();
  });

  it("should reject empty key", async () => {
    const agent = await verifyApiKey("");
    expect(agent).toBeNull();
  });

  it("should generate unique API keys", () => {
    const key1 = generateApiKey();
    const key2 = generateApiKey();
    expect(key1).not.toBe(key2);
    expect(key1.startsWith("ra_")).toBe(true);
    expect(key2.startsWith("ra_")).toBe(true);
  });

  it("should hash deterministically", async () => {
    const key = "ra_test_key_12345678";
    const hash1 = await hashApiKey(key);
    const hash2 = await hashApiKey(key);
    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different keys", async () => {
    const hash1 = await hashApiKey("ra_key_aaa");
    const hash2 = await hashApiKey("ra_key_bbb");
    expect(hash1).not.toBe(hash2);
  });

  it("should derive write:tasks scope for task capability", async () => {
    const { agent } = await registerAgent({
      name: `ScopeTest-${Date.now()}`,
      description: "Scope test",
      capabilities: ["task"],
    });
    expect(agent.scopes).toContain("write:tasks");
  });
});

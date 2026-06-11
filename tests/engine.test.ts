import { describe, it, expect } from "vitest";
import { z } from "zod";
import { MakeObjectTypeSafeEngine } from "../src/core/engine.js";

describe("MakeObjectTypeSafeEngine", () => {
  const schema = z.object({
    name: z.string().min(2),
    age: z.number().int().positive(),
  });

  it("returns success with branded data on valid input", () => {
    const result = MakeObjectTypeSafeEngine(schema, { name: "John", age: 25 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("John");
      expect(result.data.age).toBe(25);
      expect(result.error).toBeNull();
    }
  });


  it("returns failure with ZodValidationError on invalid input", () => {
    const result = MakeObjectTypeSafeEngine(schema, { name: "J", age: -5 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain("Validation");
    }
  });

  it("returns failure on missing fields", () => {
    const result = MakeObjectTypeSafeEngine(schema, {});
    expect(result.success).toBe(false);
  });

  it("returns failure on wrong types", () => {
    const result = MakeObjectTypeSafeEngine(schema, { name: 123, age: "hello" });
    expect(result.success).toBe(false);
  });

  it("returns success with optional fields", () => {
    const optionalSchema = z.object({
      title: z.string(),
      tags: z.array(z.string()).optional(),
    });
    const result = MakeObjectTypeSafeEngine(optionalSchema, { title: "Hello" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).title).toBe("Hello");
      expect((result.data as any).tags).toBeUndefined();
    }
  });

  it("returns success with default values", () => {
    const defaultSchema = z.object({
      page: z.number().default(1),
      limit: z.number().default(20),
    });
    const result = MakeObjectTypeSafeEngine(defaultSchema, {});
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).page).toBe(1);
      expect((result.data as any).limit).toBe(20);
    }
  });

  it("handles null input gracefully", () => {
    const result = MakeObjectTypeSafeEngine(schema, null);
    expect(result.success).toBe(false);
  });

  it("handles undefined input gracefully", () => {
    const result = MakeObjectTypeSafeEngine(schema, undefined);
    expect(result.success).toBe(false);
  });
});

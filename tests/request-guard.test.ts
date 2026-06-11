import { describe, it, expect } from "vitest";
import { z } from "zod";
import { RequestGuardMiddleware } from "../src/core/engine.js";
import { ValidationError } from "../src/error/strategy/error.strategy.js";

const AuthContextSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});

const CreatePostArgsSchema = z.object({
  title: z.string().min(3).max(100),
  body: z.string().min(10),
});

const mockInfo = { fieldName: "testField" };

describe("RequestGuardMiddleware", () => {
  describe("with args and context schemas", () => {
    const guard = RequestGuardMiddleware({
      context: AuthContextSchema,
      args: CreatePostArgsSchema,
    });

    it("validates valid args and context", async () => {
      const context = { id: "user_1", email: "test@test.com", req: {} } as any;
      const args = { title: "Hello World", body: "This is a long enough body" };

      const result = await guard(null, args, context, mockInfo);
      expect(result.validatedArgs).toBeDefined();
      expect(result.validatedArgs).not.toBeNull();
    });

    it("throws ValidationError on invalid args", async () => {
      const context = { id: "user_1", email: "test@test.com", req: {} } as any;
      const args = { title: "Hi", body: "short" }; // both too short

      await expect(guard(null, args, context, mockInfo)).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError on invalid context", async () => {
      const context = { id: "", email: "not-an-email", req: {} } as any;
      const args = { title: "Valid Title", body: "This is a valid body text" };

      await expect(guard(null, args, context, mockInfo)).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError on missing context fields", async () => {
      const context = { req: {} } as any;
      const args = { title: "Valid Title", body: "This is a valid body text" };

      await expect(guard(null, args, context, mockInfo)).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError on missing args fields", async () => {
      const context = { id: "user_1", email: "test@test.com", req: {} } as any;
      const args = {};

      await expect(guard(null, args, context, mockInfo)).rejects.toThrow(ValidationError);
    });

    it("injects validatedContext onto context object", async () => {
      const context = { id: "user_1", email: "test@test.com", req: {} } as any;
      const args = { title: "Hello World", body: "This is a long enough body" };

      await guard(null, args, context, mockInfo);
      expect(context.validatedContext).toBeDefined();
    });
  });

  describe("without args schema", () => {
    const contextOnlyGuard = RequestGuardMiddleware({
      context: AuthContextSchema,
      args: undefined as any,
    });

    it("returns null validatedArgs when no args schema", async () => {
      const context = { id: "user_1", email: "test@test.com", req: {} } as any;

      const result = await contextOnlyGuard(null, undefined, context, mockInfo);
      expect(result.validatedArgs).toBeNull();
    });

    it("still validates context", async () => {
      const context = { req: {} } as any; // missing id and email

      await expect(contextOnlyGuard(null, undefined, context, mockInfo)).rejects.toThrow(ValidationError);
    });
  });

  describe("with null/undefined inputs", () => {
    const guard = RequestGuardMiddleware({
      context: AuthContextSchema,
      args: CreatePostArgsSchema,
    });

    it("handles null args gracefully", async () => {
      const context = { id: "user_1", email: "test@test.com", req: {} } as any;
      await expect(guard(null, null, context, mockInfo)).rejects.toThrow(ValidationError);
    });

    it("handles undefined context gracefully", async () => {
      const args = { title: "Valid Title", body: "This is a valid body text" };
      await expect(guard(null, args, undefined, mockInfo)).rejects.toThrow(ValidationError);
    });
  });
});

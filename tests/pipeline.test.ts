import { describe, it, expect } from "vitest";
import { z } from "zod";
import { MiddlewareChainPipeline } from "../src/core/chain.middleware.js";
import { RequestGuardMiddleware } from "../src/core/engine.js";
import { catchGqlAsync } from "../src/error/error.util.js";
import { BadRequestError } from "../src/error/strategy/error.strategy.js";
import type { VerifiedArgs } from "../src/types/graphql/resolver.types.js";
import { ValidDataBrand } from "../src/types/brand.helper.js";

const AuthContextSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});
const PostArgsSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(10),
});
const mockInfo = { fieldName: "testField" };

describe("MiddlewareChainPipeline", () => {
  describe("pipe + execute", () => {
    it("runs RequestGuardMiddleware and accumulates args", async () => {
      const guard = RequestGuardMiddleware({
        context: AuthContextSchema,
        args: PostArgsSchema,
      });

      const resolver = new MiddlewareChainPipeline()
        .pipe(guard)
        .execute(async (_parent, args, _context, _info) => {
          return { received: true, hasArgs: args.validatedArgs !== null };
        });

      const context = { id: "u1", email: "a@b.com", req: {} } as any;
      const result = await resolver(
        null,
        { title: "Hey There", body: "Long enough body here" },
        context,
        mockInfo,
      );
      expect(result.received).toBe(true);
      expect(result.hasArgs).toBe(true);
    });

    it("runs guards without changing accumulated args", async () => {
      const guard = RequestGuardMiddleware({
        context: AuthContextSchema,
        args: PostArgsSchema,
      });

      let guardRan = false;
      const myGuard = catchGqlAsync(
        async (_p: any, _a: any, _c: any, _i: any) => {
          guardRan = true;
        },
      );

      const resolver = new MiddlewareChainPipeline()
        .pipe(guard)
        .pipe(myGuard)
        .execute(async (_parent, args, _context, _info) => {
          return { guardRan, hasArgs: args.validatedArgs !== null };
        });

      const context = { id: "u1", email: "a@b.com", req: {} } as any;
      const result = await resolver(
        null,
        { title: "Hey There", body: "Long enough body here" },
        context,
        mockInfo,
      );
      expect(result.guardRan).toBe(true);
      expect(result.hasArgs).toBe(true);
    });

    it("stops pipeline when guard throws", async () => {
      const guard = RequestGuardMiddleware({
        context: AuthContextSchema,
        args: PostArgsSchema,
      });

      const blockingGuard = catchGqlAsync(async () => {
        throw new BadRequestError("Blocked!");
      });

      let resolverRan = false;
      const resolver = new MiddlewareChainPipeline()
        .pipe(guard)
        .pipe(blockingGuard)
        .execute(async () => {
          resolverRan = true;
          return {};
        });

      const context = { id: "u1", email: "a@b.com", req: {} } as any;
      await expect(
        resolver(
          null,
          { title: "Hey There", body: "Long enough body here" },
          context,
          mockInfo,
        ),
      ).rejects.toThrow(BadRequestError);
      expect(resolverRan).toBe(false);
    });

    it("accumulates enricher results", async () => {
      const guard = RequestGuardMiddleware({
        context: AuthContextSchema,
        args: PostArgsSchema,
      });

      const addSlug = catchGqlAsync(
        async (_p: any, args: any, _c: any, _i: any) => {
          return { validatedArgs: { slug: "test-slug" } } as {
            validatedArgs: ValidDataBrand<{ slug: string }>;
          };
        },
      );

      const addTimestamp = catchGqlAsync(
        async (_p: any, _a: any, _c: any, _i: any) => {
          return { validatedArgs: { createdAt: "2024-01-01" } } as {
            validatedArgs: ValidDataBrand<{ createdAt: string }>;
          };
        },
      );

      const resolver = new MiddlewareChainPipeline()
        .pipe(guard)
        .pipe(addSlug)
        .pipe(addTimestamp)
        .execute(async (_parent, args, _context, _info) => {
          return args;
        });

      const context = { id: "u1", email: "a@b.com", req: {} } as any;
      const result = await resolver(
        null,
        { title: "Hey There", body: "Long enough body here" },
        context,
        mockInfo,
      );
      expect(result.validatedArgs.slug).toBe("test-slug");
      expect(result.validatedArgs.createdAt).toBe("2024-01-01");
    });

    it("runs middlewares in order", async () => {
      const order: number[] = [];

      const mw1 = catchGqlAsync(async () => {
        order.push(1);
      });
      const mw2 = catchGqlAsync(async () => {
        order.push(2);
      });
      const mw3 = catchGqlAsync(async () => {
        order.push(3);
      });

      const resolver = new MiddlewareChainPipeline()
        .pipe(mw1)
        .pipe(mw2)
        .pipe(mw3)
        .execute(async () => {
          order.push(4);
          return { order };
        });

      const result = await resolver(null, null, {} as any, mockInfo);
      expect(result.order).toEqual([1, 2, 3, 4]);
    });

    it("works with empty pipeline", async () => {
      const resolver = new MiddlewareChainPipeline().execute(
        async (_parent, args, _context, _info) => {
          return { empty: true };
        },
      );

      const result = await resolver(null, null, {} as any, mockInfo);
      expect(result.empty).toBe(true);
    });
  });

  describe("interleaved guards and enrichers", () => {
    it("guard between enrichers doesn't affect accumulation", async () => {
      const enricher1 = catchGqlAsync(
        async () =>
          ({ validatedArgs: { a: 1 } }) as {
            validatedArgs: ValidDataBrand<{ a: number }>;
          },
      );
      const guard = catchGqlAsync(async () => {
        /* pass */
      });
      const enricher2 = catchGqlAsync(
        async () =>
          ({ validatedArgs: { b: 2 } }) as {
            validatedArgs: ValidDataBrand<{ b: number }>;
          },
      );

      const resolver = new MiddlewareChainPipeline()
        .pipe(enricher1)
        .pipe(guard)
        .pipe(enricher2)
        .execute(async (_p, args) => args);

      const result = await resolver(null, null, {} as any, mockInfo);
      expect(result.validatedArgs.a).toBe(1);
      expect(result.validatedArgs.b).toBe(2);
    });

    it("guard at end doesn't affect final args", async () => {
      const enricher = catchGqlAsync(
        async () =>
          ({ validatedArgs: { data: "yes" } }) as {
            validatedArgs: ValidDataBrand<{ data: string }>;
          },
      );
      const guard = catchGqlAsync(async () => {
        /* pass */
      });

      const resolver = new MiddlewareChainPipeline()
        .pipe(enricher)
        .pipe(guard)
        .execute(async (_p, args) => args);

      const result = await resolver(null, null, {} as any, mockInfo);
      expect(result.validatedArgs.data).toBe("yes");
    });
  });

  describe("context mutation", () => {
    it("RequestGuardMiddleware injects validatedContext", async () => {
      const guard = RequestGuardMiddleware({
        context: AuthContextSchema,
        args: PostArgsSchema,
      });

      let capturedContext: any;
      const resolver = new MiddlewareChainPipeline()
        .pipe(guard)
        .execute(async (_p, _a, context) => {
          capturedContext = context;
          return {};
        });

      const context = { id: "u1", email: "a@b.com", req: {} } as any;
      await resolver(
        null,
        { title: "Hey There", body: "Long enough body here" },
        context,
        mockInfo,
      );
      expect(capturedContext.validatedContext).toBeDefined();
    });
  });
});

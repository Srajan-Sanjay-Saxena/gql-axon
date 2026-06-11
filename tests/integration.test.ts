import { describe, it, expect } from "vitest";
import { z } from "zod";
import { RequestGuardMiddleware } from "../src/core/engine.js";
import {
  MiddlewareChainPipeline,
  withChainedMiddleware,
} from "../src/core/chain.middleware.js";
import { catchGqlAsync } from "../src/error/error.util.js";
import {
  BadRequestError,
  ValidationError,
} from "../src/error/strategy/error.strategy.js";
import { ValidDataBrand } from "../src/types/brand.helper.js";

const AuthContextSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});
const CreatePostSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(10),
});
const PaginationSchema = z.object({
  page: z.number().positive().default(1),
  limit: z.number().max(100).default(20),
});
const mockInfo = { fieldName: "createPost" };

describe("Integration: Full Pipeline Flow", () => {
  describe("create post flow", () => {
    const requestGuard = RequestGuardMiddleware({
      context: AuthContextSchema,
      args: CreatePostSchema,
    });

    const isNotBlocked = catchGqlAsync(
      async (_p: any, _a: any, context: any, _i: any) => {
        if (context.blocked) throw new BadRequestError("User is blocked");
      },
    );

    const addSlug = catchGqlAsync(
      async (_p: any, _a: any, _c: any, _i: any) => {
        return { validatedArgs: { slug: "computed-slug" } } as {
          validatedArgs: ValidDataBrand<{ slug: string }>;
        };
      },
    );

    const addAuthorId = catchGqlAsync(
      async (_p: any, _a: any, context: any, _i: any) => {
        return { validatedArgs: { authorId: context.validatedContext.id } } as {
          validatedArgs: ValidDataBrand<{ authorId: string }>;
        };
      },
    );

    const pipeline = new MiddlewareChainPipeline()
      .pipe(requestGuard)
      .pipe(isNotBlocked)
      .pipe(addSlug)
      .pipe(addAuthorId);

    const createPostResolver = pipeline.execute(
      async (_parent, args, _context, _info) => {
        return {
          id: "post_123",
          slug: args.validatedArgs.slug,
          authorId: args.validatedArgs.authorId,
        };
      },
    );

    it("succeeds with valid input", async () => {
      const context = { id: "user_1", email: "test@test.com", req: {} } as any;
      const args = { title: "My Post", body: "This is a long enough body" };

      const result = await createPostResolver(null, args, context, mockInfo);
      expect(result.id).toBe("post_123");
      expect(result.slug).toBe("computed-slug");
      expect(result.authorId).toBe("user_1");
    });

    it("fails on invalid args (validation)", async () => {
      const context = { id: "user_1", email: "test@test.com", req: {} } as any;
      const args = { title: "Hi", body: "short" };

      await expect(
        createPostResolver(null, args, context, mockInfo),
      ).rejects.toThrow(ValidationError);
    });

    it("fails on invalid context (no id)", async () => {
      const context = { email: "test@test.com", req: {} } as any;
      const args = { title: "My Post", body: "This is a long enough body" };

      await expect(
        createPostResolver(null, args, context, mockInfo),
      ).rejects.toThrow(ValidationError);
    });

    it("fails when guard blocks (user is blocked)", async () => {
      const context = {
        id: "user_1",
        email: "test@test.com",
        req: {},
        blocked: true,
      } as any;
      const args = { title: "My Post", body: "This is a long enough body" };

      await expect(
        createPostResolver(null, args, context, mockInfo),
      ).rejects.toThrow(BadRequestError);
    });

    it("resolver never runs when guard throws", async () => {
      let resolverRan = false;
      const pipelineWithSpy = new MiddlewareChainPipeline()
        .pipe(requestGuard)
        .pipe(
          catchGqlAsync(async () => {
            throw new BadRequestError("nope");
          }),
        )
        .execute(async () => {
          resolverRan = true;
          return {};
        });

      const context = { id: "user_1", email: "test@test.com", req: {} } as any;
      const args = { title: "My Post", body: "This is a long enough body" };

      await expect(
        pipelineWithSpy(null, args, context, mockInfo),
      ).rejects.toThrow();
      expect(resolverRan).toBe(false);
    });
  });

  describe("pagination flow", () => {
    const paginationGuard = RequestGuardMiddleware({
      context: AuthContextSchema,
      args: PaginationSchema,
    });

    const rateLimitGuard = catchGqlAsync(
      async (_p: any, _a: any, context: any, _i: any) => {
        if (context.rateLimited) throw new BadRequestError("Rate limited");
      },
    );

    const listResolver = new MiddlewareChainPipeline()
      .pipe(paginationGuard)
      .pipe(rateLimitGuard)
      .execute(async (_parent, _args, _context, _info) => {
        return { posts: ["a", "b", "c"], total: 3 };
      });

    it("succeeds with defaults (no page/limit provided)", async () => {
      const context = { id: "u1", email: "a@b.com", req: {} } as any;
      const result = await listResolver(null, {}, context, mockInfo);
      expect(result.posts).toHaveLength(3);
    });

    it("succeeds with explicit pagination", async () => {
      const context = { id: "u1", email: "a@b.com", req: {} } as any;
      const result = await listResolver(
        null,
        { page: 2, limit: 10 },
        context,
        mockInfo,
      );
      expect(result.total).toBe(3);
    });

    it("fails when rate limited", async () => {
      const context = {
        id: "u1",
        email: "a@b.com",
        req: {},
        rateLimited: true,
      } as any;
      await expect(listResolver(null, {}, context, mockInfo)).rejects.toThrow(
        BadRequestError,
      );
    });
  });

  describe("withChainedMiddleware", () => {
    it("produces a resolver with standard GraphQL signature", async () => {
      const guard = RequestGuardMiddleware({
        context: AuthContextSchema,
        args: CreatePostSchema,
      });

      const resolver = withChainedMiddleware(
        new MiddlewareChainPipeline().pipe(guard),
        async (_parent, args, _context, _info) => {
          return { success: true };
        },
      );

      const context = { id: "u1", email: "a@b.com", req: {} } as any;
      const result = await resolver(
        null,
        { title: "Test", body: "Long enough body text" },
        context,
        mockInfo,
      );
      expect(result.success).toBe(true);
    });
  });

  describe("multiple guards stacking", () => {
    it("all guards must pass", async () => {
      const checks: string[] = [];

      const g1 = catchGqlAsync(async () => {
        checks.push("g1");
      });
      const g2 = catchGqlAsync(async () => {
        checks.push("g2");
      });
      const g3 = catchGqlAsync(async () => {
        checks.push("g3");
      });

      const resolver = new MiddlewareChainPipeline()
        .pipe(g1)
        .pipe(g2)
        .pipe(g3)
        .execute(async () => ({ checks }));

      const result = await resolver(null, null, {} as any, mockInfo);
      expect(result.checks).toEqual(["g1", "g2", "g3"]);
    });

    it("stops at first failing guard", async () => {
      const checks: string[] = [];

      const g1 = catchGqlAsync(async () => {
        checks.push("g1");
      });
      const g2 = catchGqlAsync(async () => {
        throw new BadRequestError("fail");
      });
      const g3 = catchGqlAsync(async () => {
        checks.push("g3");
      });

      const resolver = new MiddlewareChainPipeline()
        .pipe(g1)
        .pipe(g2)
        .pipe(g3)
        .execute(async () => ({ checks }));

      await expect(resolver(null, null, {} as any, mockInfo)).rejects.toThrow();
      expect(checks).toEqual(["g1"]); // g3 never ran
    });
  });

  describe("enricher accumulation", () => {
    it("later enrichers override earlier ones with same key", async () => {
      const e1 = catchGqlAsync(
        async () =>
          ({ validatedArgs: { slug: "first" } }) as {
            validatedArgs: ValidDataBrand<{ slug: string }>;
          },
      );
      const e2 = catchGqlAsync(
        async () =>
          ({ validatedArgs: { slug: "second" } }) as {
            validatedArgs: ValidDataBrand<{ slug: string }>;
          },
      );

      const resolver = new MiddlewareChainPipeline()
        .pipe(e1)
        .pipe(e2)
        .execute(async (_p, args) => args);

      const result = await resolver(null, null, {} as any, mockInfo);
      expect(result.validatedArgs.slug).toBe("second");
    });

    it("enrichers from different keys all accumulate", async () => {
      const e1 = catchGqlAsync(
        async () =>
          ({ validatedArgs: { a: 1 } }) as {
            validatedArgs: ValidDataBrand<{ a: number }>;
          },
      );
      const e2 = catchGqlAsync(
        async () =>
          ({ validatedArgs: { b: 2 } }) as {
            validatedArgs: ValidDataBrand<{ b: number }>;
          },
      );
      const e3 = catchGqlAsync(
        async () =>
          ({ validatedArgs: { c: 3 } }) as {
            validatedArgs: ValidDataBrand<{ c: number }>;
          },
      );

      const resolver = new MiddlewareChainPipeline()
        .pipe(e1)
        .pipe(e2)
        .pipe(e3)
        .execute(async (_p, args) => args);

      const result = await resolver(null, null, {} as any, mockInfo);
      expect(result.validatedArgs.a).toBe(1);
      expect(result.validatedArgs.b).toBe(2);
      expect(result.validatedArgs.c).toBe(3);
    });
  });
});

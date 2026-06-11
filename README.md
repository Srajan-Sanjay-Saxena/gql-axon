# gql-axon

Type-safe GraphQL middleware pipeline. Zod validation + branded types + builder pattern.

GraphQL has no middleware concept — a resolver is a single function. gql-axon creates a synthetic middleware pipeline inside that resolver slot, giving you type-safe validation, guards, and args enrichment.

## Install

```bash
pnpm add gql-axon zod zod-validation-error graphql
```

## How It Works

```
Client → Apollo/Yoga builds context → Calls your "resolver" (which is actually pipeline.execute())
                                              ↓
                              ┌─────────────────────────────────┐
                              │  RequestGuardMiddleware          │  validates raw unknown → branded
                              │  Guards (isBlocked, isAdmin)     │  check business logic, throw or pass
                              │  Enrichers (addSlug, addTime)    │  compute new fields, accumulate
                              │  Final Resolver                  │  receives fully typed args + context
                              └─────────────────────────────────┘
                                              ↓
                                    GraphQL response
```

## Quick Start: Full Apollo + Express Server

```typescript
import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { z } from "zod";
import { RequestGuardMiddleware, MiddlewareChainPipeline } from "gql-axon";
import { catchGqlAsync, BadRequestError } from "gql-axon/errors";
import type { VerifiedArgs } from "gql-axon/types";
import jwt from "jsonwebtoken";

// ─── 1. Define context type ─────────────────────────────────────────────────

type MyContext = {
  id?: string;
  email?: string;
  req: express.Request;
};

// ─── 2. Define schemas ──────────────────────────────────────────────────────

const AuthContextSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});
type AuthContext = z.infer<typeof AuthContextSchema>;

const CreatePostArgsSchema = z.object({
  title: z.string().min(3).max(100),
  body: z.string().min(10),
});
type CreatePostArgs = z.infer<typeof CreatePostArgsSchema>;

// ─── 3. Build middlewares ───────────────────────────────────────────────────

const createPostGuard = RequestGuardMiddleware<
  { context: AuthContext; args: CreatePostArgs },
  MyContext
>({ context: AuthContextSchema, args: CreatePostArgsSchema });

const isNotBlockedGuard = catchGqlAsync<CreatePostArgs, AuthContext, MyContext>(
  async (_parent, _args, context, _info) => {
    // const user = await db.user.findUnique({ where: { id: context.validatedContext.id } });
    // if (user.isBlocked) throw new BadRequestError("Blocked");
  },
);

const addSlug = catchGqlAsync<CreatePostArgs, AuthContext, MyContext, { slug: string }>(
  async (_parent, args, _context, _info) => {
    const slug = args.validatedArgs.title.toLowerCase().replace(/\s+/g, "-");
    return { validatedArgs: { slug } } as VerifiedArgs<{ slug: string }>;
  },
);

// ─── 4. Build pipeline and resolver ─────────────────────────────────────────

const createPost = new MiddlewareChainPipeline()
  .pipe(createPostGuard)
  .pipe(isNotBlockedGuard)
  .pipe(addSlug)
  .execute<AuthContext, MyContext, { id: string; slug: string }>(
    async (_parent, args, _context, _info) => {
      // const post = await db.post.create({ data: { ... } });
      return { id: "post_123", slug: args.validatedArgs.slug };
    },
  );

// ─── 5. GraphQL schema ──────────────────────────────────────────────────────

const typeDefs = `#graphql
  type Post {
    id: String!
    slug: String!
  }

  type Mutation {
    createPost(title: String!, body: String!): Post!
  }

  type Query {
    _health: Boolean!
  }
`;

const resolvers = {
  Query: {
    _health: () => true,
  },
  Mutation: {
    createPost,  // pipeline output IS the resolver
  },
};

// ─── 6. Wire up Apollo + Express ────────────────────────────────────────────

const app = express();
const server = new ApolloServer<MyContext>({ typeDefs, resolvers });

await server.start();

app.use(
  "/graphql",
  express.json(),
  expressMiddleware(server, {
    context: async ({ req }): Promise<MyContext> => {
      // Extract user from JWT — id/email may be undefined if not authenticated
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) return { req };

      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; email: string };
        return { id: payload.id, email: payload.email, req };
      } catch {
        return { req };
      }
    },
  }),
);

app.listen(4000, () => console.log("Server ready at http://localhost:4000/graphql"));
```

That's it. The pipeline is invisible to Apollo — it just sees a resolver function.

---

## Setup

### Define Your Context

```typescript
import type { Request } from "express";

type MyContext = {
  id?: string;
  email?: string;
  req: Request;
};
```

### Define Schemas

```typescript
import { z } from "zod";

const AuthContextSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});

const CreatePostArgsSchema = z.object({
  title: z.string().min(3).max(100),
  body: z.string().min(10),
  tags: z.array(z.string()).optional(),
});

const PaginationArgsSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
```

## Usage

### 1. RequestGuardMiddleware — Entry Point Validation

Validates raw `unknown` args and context. Always the first middleware in a pipeline.

```typescript
import { RequestGuardMiddleware } from "gql-axon";

const createPostGuard = RequestGuardMiddleware<
  { context: AuthContext; args: CreatePostArgs },
  MyContext
>({
  context: AuthContextSchema,
  args: CreatePostArgsSchema,
});

const paginationGuard = RequestGuardMiddleware<
  { context: AuthContext; args: PaginationArgs },
  MyContext
>({
  context: AuthContextSchema,
  args: PaginationArgsSchema,
});
```

### 2. Guards — Business Logic Checks

Guards receive **already-validated** context. They don't check "does userId exist?" — that's guaranteed. They check "is this user blocked?", "is this user an admin?".

```typescript
import { catchGqlAsync } from "gql-axon";
import { BadRequestError } from "gql-axon/errors";

// userId is GUARANTEED to exist — no need to check
const isNotBlockedGuard = catchGqlAsync<CreatePostArgs, AuthContext, MyContext>(
  async (_parent, _args, context, _info) => {
    const user = await db.user.findUnique({
      where: { id: context.validatedContext.id },
    });
    if (user.isBlocked) {
      throw new BadRequestError("Your account has been blocked");
    }
  },
);

const isAdminGuard = catchGqlAsync<CreatePostArgs, AuthContext, MyContext>(
  async (_parent, _args, context, _info) => {
    const user = await db.user.findUnique({
      where: { id: context.validatedContext.id },
    });
    if (user.role !== "admin") {
      throw new BadRequestError("Admin access required");
    }
  },
);

const rateLimitGuard = catchGqlAsync<PaginationArgs, AuthContext, MyContext>(
  async (_parent, _args, context, _info) => {
    const count = await redis.get(`ratelimit:${context.validatedContext.id}`);
    if (Number(count) > 100) {
      throw new BadRequestError("Rate limit exceeded");
    }
  },
);
```

### 3. Enrichers — Compute and Add Data

Enrichers receive validated args/context and produce new typed fields.

```typescript
import type { VerifiedArgs } from "gql-axon";

const addSlugMiddleware = catchGqlAsync<CreatePostArgs, AuthContext, MyContext, { slug: string }>(
  async (_parent, args, _context, _info) => {
    const slug = args.validatedArgs.title.toLowerCase().replace(/\s+/g, "-");
    return { validatedArgs: { slug } } as VerifiedArgs<{ slug: string }>;
  },
);

const addTimestampMiddleware = catchGqlAsync<CreatePostArgs, AuthContext, MyContext, { createdAt: string }>(
  async (_parent, _args, _context, _info) => {
    return { validatedArgs: { createdAt: new Date().toISOString() } } as VerifiedArgs<{ createdAt: string }>;
  },
);

const addAuthorIdMiddleware = catchGqlAsync<CreatePostArgs, AuthContext, MyContext, { authorId: string }>(
  async (_parent, _args, context, _info) => {
    return { validatedArgs: { authorId: context.validatedContext.id } } as VerifiedArgs<{ authorId: string }>;
  },
);
```

### 4. Build the Pipeline

```typescript
import { MiddlewareChainPipeline } from "gql-axon";

const createPostPipeline = new MiddlewareChainPipeline()
  .pipe(createPostGuard)       // validates raw → branded
  .pipe(isNotBlockedGuard)      // guard: void, no type change
  .pipe(isAdminGuard)           // guard: void, no type change
  .pipe(addSlugMiddleware)      // enricher: adds { slug }
  .pipe(addTimestampMiddleware) // enricher: adds { createdAt }
  .pipe(addAuthorIdMiddleware); // enricher: adds { authorId }
```

### 5. Execute with Final Resolver

```typescript
const createPostResolver = createPostPipeline.execute<AuthContext, MyContext, { id: string; slug: string }>(
  async (_parent, args, context, _info) => {
    // args.validatedArgs has: slug, createdAt, authorId — all fully typed
    // context.validatedContext has: id, email — branded and guaranteed

    const post = await db.post.create({
      data: {
        title: args.validatedArgs.title,
        slug: args.validatedArgs.slug,
        authorId: args.validatedArgs.authorId,
      },
    });

    return { id: post.id, slug: post.slug };
  },
);
```

### 6. Register with Apollo/Yoga

```typescript
const resolvers = {
  Mutation: {
    createPost: createPostResolver,  // that's it
  },
};
```

Apollo doesn't know about middlewares. It just calls a function. gql-axon is invisible to GraphQL.

## More Patterns

### Multiple Guards (Authorization Layering)

```typescript
const deletePostPipeline = new MiddlewareChainPipeline()
  .pipe(deletePostGuard)
  .pipe(isAuthenticatedGuard)
  .pipe(isNotSuspendedGuard)
  .pipe(isPostOwnerGuard)
  .pipe(withinDeleteWindowGuard);

const deletePostResolver = deletePostPipeline.execute<AuthContext, MyContext, { deleted: boolean }>(
  async (_parent, _args, _context, _info) => {
    // All 4 guards passed — safe to proceed
    return { deleted: true };
  },
);
```

### Interleaved Guards & Enrichers

```typescript
const transferPipeline = new MiddlewareChainPipeline()
  .pipe(transferRequestGuard)        // validate
  .pipe(hasSufficientBalanceGuard)    // guard
  .pipe(calculateFeeMiddleware)       // enricher: adds { fee, netAmount }
  .pipe(dailyLimitGuard)              // guard
  .pipe(generateTxIdMiddleware);      // enricher: adds { transactionId }
```

### Multiple Enrichers Stacking

```typescript
const richPostPipeline = new MiddlewareChainPipeline()
  .pipe(postRequestGuard)
  .pipe(addSlug)         // { slug }
  .pipe(addExcerpt)      // { excerpt }
  .pipe(addWordCount)    // { wordCount }
  .pipe(addPublishedAt)  // { publishedAt }
  .pipe(addAuthorInfo);  // { authorId, authorEmail }

// Final resolver sees ALL accumulated fields
```

### Reusable Pipelines

```typescript
// User-level
const userCreatePost = new MiddlewareChainPipeline()
  .pipe(postRequestGuard)
  .pipe(isNotBlocked)
  .pipe(addTimestamp);

// Admin-level (same + admin check)
const adminCreatePost = new MiddlewareChainPipeline()
  .pipe(postRequestGuard)
  .pipe(isNotBlocked)
  .pipe(isAdmin)
  .pipe(addTimestamp);
```

## Error Handling

Every middleware wrapped with `catchGqlAsync` gets automatic error normalization:

| Error Type | Code | Status | When |
|---|---|---|---|
| `ValidationError` | BAD_USER_INPUT | 400 | Zod validation fails |
| `BadRequestError` | BAD_REQUEST | 400 | Business logic rejection |
| `NotFoundError` | NOT_FOUND | 404 | Resource doesn't exist |
| `ConflictError` | CONFLICT | 409 | Duplicate resource (Prisma P2002) |
| `InternalServerError` | INTERNAL_SERVER_ERROR | 500 | Unknown failures |

```typescript
// AppError subclasses pass through as-is
throw new BadRequestError("Nope");

// ZodError-like → ValidationError
// Prisma P2002 → ConflictError
// Unknown → InternalServerError (hides message in production)
```

## How `catchGqlAsync` Works

Like Express's `catchAsync` — takes a function, returns the same function wrapped in try/catch. One job: error handling.

```typescript
// Express equivalent:
export function catchAsync(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// gql-axon:
export function catchGqlAsync(fn) {
  return async (...args) => {
    try { return await fn(...args); }
    catch (error) { /* normalize and throw AppError */ }
  };
}
```

The type annotation at the call site drives type safety — `catchGqlAsync` preserves whatever type you annotate.

## Type System

- `ValidDataBrand<T>` — branded type preventing unvalidated data from being used where validated data is expected
- `VerifiedArgs<T>` — `{ validatedArgs: ValidDataBrand<T> }` wrapper
- `VerifiedContext<TInjected, TBase>` — `{ validatedContext: ValidDataBrand<TInjected & TBase & { req }> }`
- `GqlGuardMiddleware` — `(parent, args, context, info) => Promise<void>`
- `GqlContextAndArgsMiddleware` — `(parent, args, context, info) => Promise<VerifiedArgs<TReturn>>`
- `GqlAsyncResolver` — generic resolver type used by `RequestGuardMiddleware`

## License

MIT

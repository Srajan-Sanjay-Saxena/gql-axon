import { z } from "zod";
import {
  fromError,
  type ValidationError as ZodValidationError,
} from "zod-validation-error";
import type { ValidDataBrand } from "../types/brand.helper.js";
import type {
  GqlAsyncResolver,
  GqlContextAndArgsMiddleware,
  GqlRequestConfig,
  SchemaConfig,
  VerifiedArgs,
} from "../types/graphql/resolver.types.js";
import type {
  GqlGlobalBaseContext,
  MagicInjectedContext,
  VerifiedContext,
} from "../types/graphql/context.types.js";
import { catchGqlAsync } from "../error/error.util.js";
import { ValidationError } from "../error/strategy/error.strategy.js";

export type TypeSafeObject<TObj> =
  | {
      success: true;
      data: ValidDataBrand<TObj>;
      error: null;
    }
  | {
      success: false;
      data: null;
      error: ZodValidationError;
    };

export function MakeObjectTypeSafeEngine<TObj>(
  schema: z.ZodType<TObj>,
  obj: unknown,
): TypeSafeObject<TObj> {
  const result = schema.safeParse(obj);
  if (!result.success) {
    return {
      success: false,
      data: null,
      error: fromError(result.error),
    };
  }
  return {
    success: true,
    data: result.data as ValidDataBrand<TObj>,
    error: null,
  };
}

// since the request guard middleware is used at the most outer side that means we can say args and context will be unknown and we will validate them inside the middleware and then inject the validated data into the context for other middlewares and resolver to use, so we can say the input context and args are unknown but the output of this middleware will be validated context and args based on the provided schemas, so we can use the same middleware for both cases when we have args schema or when we don't have args schema, if we don't have args schema then we can return undefined for args in the output
// Overload: with both args + context
export function RequestGuardMiddleware<
  TConfig extends GqlRequestConfig & { args: Record<string, unknown>; context: Record<string, unknown> },
  TBaseContext extends Record<string, unknown>,
>(
  schemas: SchemaConfig<TConfig>,
): GqlAsyncResolver<
  { validatedArgs: ValidDataBrand<TConfig["args"]> },
  any,
  unknown,
  unknown
>;

// Overload: with args only (no context) — no TBaseContext needed
export function RequestGuardMiddleware<
  TConfig extends GqlRequestConfig & { args: Record<string, unknown> },
>(
  schemas: SchemaConfig<TConfig>,
): GqlAsyncResolver<
  { validatedArgs: ValidDataBrand<TConfig["args"]> },
  any,
  unknown,
  unknown
>;

// Overload: with context only (no args) — TBaseContext needed
export function RequestGuardMiddleware<
  TConfig extends GqlRequestConfig & { context: Record<string, unknown> },
  TBaseContext extends Record<string, unknown>,
>(
  schemas: SchemaConfig<TConfig>,
): GqlAsyncResolver<{ validatedArgs: null }, any, unknown, unknown>;

export function RequestGuardMiddleware<
  TConfig extends GqlRequestConfig,
  TBaseContext extends Record<string, unknown>,
>(schemas: SchemaConfig<TConfig>) {
  const s = schemas as { context?: z.ZodType<any>; args?: z.ZodType<any> };
  return catchGqlAsync<
    { validatedArgs: ValidDataBrand<TConfig["args"]> | null },
    any,
    unknown,
    unknown
  >(async (parent, args, context, info) => {
    if (s.context) {
      const result = MakeObjectTypeSafeEngine(s.context, context ?? {});
      if (!result.success) {
        throw new ValidationError(result.error);
      }
      (
        context as VerifiedContext<TConfig["context"], TBaseContext>
      ).validatedContext = result.data as ValidDataBrand<
        MagicInjectedContext<TConfig["context"], TBaseContext>
      >;
    }

    if (s.args) {
      const result = MakeObjectTypeSafeEngine(s.args, args ?? {});
      if (!result.success) {
        throw new ValidationError(result.error);
      }
      return { validatedArgs: result.data };
    }

    return { validatedArgs: null };
  });
}
import type {
  GqlAsyncResolver,
  GqlContextAndArgsMiddleware,
  GqlGuardMiddleware,
} from "../types/graphql/resolver.types.js";
import { AppError } from "./app.error.base.js";
import {
  ConflictError,
  InternalServerError,
  ValidationError,
} from "./strategy/error.strategy.js";

export function catchGqlAsync<
  TArgs extends Record<string, unknown> | null,
  TInjected extends Record<string, unknown> | undefined,
  TBase extends Record<string, unknown>,
>(
  fn: GqlGuardMiddleware<TArgs, TInjected, TBase>,
): GqlGuardMiddleware<TArgs, TInjected, TBase>;

export function catchGqlAsync<
  TArgs extends Record<string, unknown> | null,
  TInjected extends Record<string, unknown> | undefined,
  TBase extends Record<string, unknown>,
  TReturn extends Record<string, unknown> | null,
>(
  fn: GqlContextAndArgsMiddleware<TArgs, TInjected, TBase, TReturn>,
): GqlContextAndArgsMiddleware<TArgs, TInjected, TBase, TReturn>;

export function catchGqlAsync<
  TReturn,
  TParent = any,
  TArgs = unknown,
  TContext = unknown,
>(
  fn: GqlAsyncResolver<TReturn,TParent, TArgs, TContext>,
): GqlAsyncResolver<TReturn,TParent, TArgs, TContext>;

export function catchGqlAsync(fn: (...args: any[]) => Promise<any>) {
  return async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      if (error.name === "ZodError") throw new ValidationError(error);
      if (error.code === "P2002")
        throw new ConflictError("Already exists.", error);
      throw new InternalServerError("Something went wrong.", error);
    }
  };
}

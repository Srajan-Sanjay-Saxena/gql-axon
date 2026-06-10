import { AppError } from "./app.error.base.js";
import {
  InternalServerError,
  ValidationError,
  ConflictError,
} from "./strategy/error.strategy.js";
import type {
  GqlAsyncResolver,
  GqlContextAndArgsMiddleware,
  GqlGuardMiddleware,
  GqlRequestConfig,
} from "../types/graphql/resolver.types.js";
import type { GqlGlobalBaseContext } from "../types/graphql/context.types.js";


export function catchGqlAsync<
  TParent,
  TArgs extends GqlRequestConfig["args"],
  TContext extends Record<string, unknown>,
>(
  resolverFn: (
    parent: TParent,
    args: TArgs,
    context: TContext,
    info: any,
  ) => Promise<void>,
): GqlGuardMiddleware<any, GqlGlobalBaseContext<TContext>, TArgs>;

export function catchGqlAsync<
  TParent,
  TArgs extends GqlRequestConfig["args"],
  TContext,
  TReturn extends Record<string, unknown>,
>(
  resolverFn: (
    parent: TParent,
    args: TArgs,
    context: TContext,
    info: any,
  ) => Promise<TReturn>,
): GqlContextAndArgsMiddleware<any, GqlGlobalBaseContext<TContext>, TArgs, TReturn>;

export function catchGqlAsync<TParent, TArgs, TContext, TReturn>(
  resolverFn: (
    parent: TParent,
    args: TArgs,
    context: TContext,
    info: any,
  ) => Promise<TReturn>,
): <TFinalContext extends GqlGlobalBaseContext<TContext>>(
  parent: TParent,
  args: TArgs,
  context: TFinalContext,
  info: any,
) => Promise<TReturn> {
  return async <TFinalContext extends GqlGlobalBaseContext<TContext>>(
    parent: TParent,
    args: TArgs,
    context: TFinalContext,
    info: any,
  ): Promise<TReturn> => {
    try {
      return await resolverFn(parent, args, context, info);
    } catch (error: any) {
      console.error(`[Resolver Error] ${info.fieldName}:`, error);

      if (error instanceof AppError) {
        throw error;
      }

      if (error.name === "ZodError") {
        throw new ValidationError(error);
      }

      if (error.code === "P2002") {
        throw new ConflictError(
          "This username or email is already taken.",
          error,
        );
      }

      throw new InternalServerError("Something went wrong.", error);
    }
  };
}

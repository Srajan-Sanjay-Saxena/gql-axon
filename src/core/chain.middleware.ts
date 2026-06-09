import type {
  GqlContextAndArgsMiddleware,
  GqlGuardMiddleware,
} from "../types/graphql/resolver.types.js";
import type {
  GqlGlobalBaseContext,
  MagicInjectedContext,
} from "../types/graphql/context.types.js";

type ChainableMiddleware =
  | GqlGuardMiddleware<any, any, any>
  | GqlContextAndArgsMiddleware<any, any, any>;

type ComposedChain = (
  context: MagicInjectedContext<any, any>,
  args: unknown,
) => Promise<Record<string, unknown>>;

export function CreateMiddlewareChain(...middlewares: ChainableMiddleware[]): ComposedChain {
  return async (
    context: MagicInjectedContext<any, any>,
    rawArgs: unknown,
  ): Promise<Record<string, unknown>> => {
    let accumulatedArgs: Record<string, unknown> = {};

    for (const middleware of middlewares) {
      const result = await (middleware as Function)(context, rawArgs, accumulatedArgs);
      if (result !== undefined) {
        accumulatedArgs = { ...accumulatedArgs, ...result };
      }
    }

    return accumulatedArgs;
  };
}

export function withChainedMiddleware<TReturn = unknown>(
  chain: ComposedChain,
  resolver: (
    parent: unknown,
    args: Record<string, unknown>,
    context: MagicInjectedContext<any, any>,
    info: any,
  ) => Promise<TReturn>,
) {
  return async (
    parent: unknown,
    args: unknown,
    context: GqlGlobalBaseContext<any>,
    info: any,
  ): Promise<TReturn> => {
    const validatedArgs = await chain(context as MagicInjectedContext<any, any>, args);
    return resolver(parent, validatedArgs, context as MagicInjectedContext<any, any>, info);
  };
}

import { z } from "zod";
import type { GqlGlobalBaseContext } from "./context.types.js";
import type { MagicInjectedContext, VerifiedContext } from "./context.types.js";

type GqlRequestConfig = {
  readonly context?: Record<string, unknown>;
  readonly args?: Record<string, unknown>;
};

type SchemaConfig<TConfig extends GqlRequestConfig> = {
  context: z.ZodType<TConfig["context"]>;
  args: z.ZodType<TConfig["args"]>;
};

type GqlAsyncResolver<Parent, Args, Context, Return> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: any,
) => Promise<Return>;

type GqlGuardMiddleware<
  TInjected extends Record<string, unknown>,
  TBaseContext extends Record<string, unknown>,
   TArgs extends GqlRequestConfig["args"],
> = (context: MagicInjectedContext<TInjected, TBaseContext> , args : TArgs) => Promise<void>;

type VerifiedArgs<TConfig extends GqlRequestConfig["args"]> =
  TConfig extends Record<string, any>
    ? { validatedArgs: z.infer<TConfig> }
    : never;

type GqlContextAndArgsMiddleware<
  TInjected extends Record<string, unknown>,
  TBaseContext extends Record<string, unknown>,
  TArgs extends GqlRequestConfig["args"],
> = (
  context: MagicInjectedContext<TInjected, TBaseContext>,
  args: VerifiedArgs<TArgs>,
) => Promise<TArgs>;

export type {
  GqlRequestConfig,
  SchemaConfig,
  GqlAsyncResolver,
  VerifiedArgs,
  GqlGuardMiddleware,
  GqlContextAndArgsMiddleware,
};

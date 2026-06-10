import { z } from "zod";
import type { GqlGlobalBaseContext } from "./context.types.js";
import type { MagicInjectedContext, VerifiedContext } from "./context.types.js";
import type { ValidDataBrand } from "../brand.helper.js";

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

// Since the first middleware that's gonna be running is our RequestGuardMiddleware which will be validating the args and context and then passing it to the next middleware so we can be sure that the context and args are always verified in the next middlewares and the resolver as well so we can directly use the VerifiedContext and VerifiedArgs types in the middlewares and resolvers without worrying about whether they are verified or not

type GqlGuardMiddleware<
  TInjected extends Record<string, unknown>,
  TBaseContext extends Record<string, unknown>,
  TArgs extends GqlRequestConfig["args"],
> = (
  parent: any,
  args: TArgs,
  context: VerifiedContext<TInjected, TBaseContext>,
  info: any,
) => Promise<void>;

type VerifiedArgs<TConfig extends GqlRequestConfig["args"]> =
  TConfig extends Record<string, any>
    ? { validatedArgs: ValidDataBrand<TConfig> }
    : never;

// The thing is that actually this TArgs would be the type from the previous middleware and the return type will be the modified args type i.e addition of some extra args that's why we have taken TReturn and TArgs differently

type GqlContextAndArgsMiddleware<
  TInjected extends Record<string, unknown>,
  TBaseContext extends Record<string, unknown>,
  TArgs extends GqlRequestConfig["args"],
  TReturn extends Record<string, unknown> | undefined,
> = (
  parent: any,
  args: VerifiedArgs<TArgs>,
  context: VerifiedContext<TInjected, TBaseContext>,
  info: any,
) => Promise<VerifiedArgs<TReturn>>;

export type {
  GqlRequestConfig,
  SchemaConfig,
  GqlAsyncResolver,
  VerifiedArgs,
  GqlGuardMiddleware,
  GqlContextAndArgsMiddleware,
};

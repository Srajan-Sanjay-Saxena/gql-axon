import type { ValidDataBrand } from "../types/brand.helper.js";
import type {
  GqlGlobalBaseContext,
  VerifiedContext,
} from "../types/graphql/context.types.js";
import type {
  GqlAsyncResolver,
  GqlContextAndArgsMiddleware,
  GqlGuardMiddleware,
  GqlRequestConfig,
  VerifiedArgs,
} from "../types/graphql/resolver.types.js";

type ChainableMiddleware =
  | GqlGuardMiddleware<any, any, any>
  | GqlContextAndArgsMiddleware<any, any, any, any>
  | GqlAsyncResolver<any, any, any, any>;

export class MiddlewareChainPipeline<
  TVerifiedArgs extends Record<string , any> = {},
> {
  private middlewares: ChainableMiddleware[] = [];
  public finalArgsList: TVerifiedArgs[] = [];

  public constructor(middlewares: ChainableMiddleware[] = []) {
    this.middlewares = middlewares;
  }

  public pipe<
    TReturn extends {
      validatedArgs: ValidDataBrand<Record<string, unknown>>;
    } | {},
  >(
    middleware: GqlAsyncResolver<TReturn, unknown, unknown, any>,
  ): MiddlewareChainPipeline<TVerifiedArgs & TReturn>;

  public pipe<TReturn extends Record<string, unknown>>(
    middleware: GqlContextAndArgsMiddleware<any, any, any, TReturn>,
  ): MiddlewareChainPipeline<TVerifiedArgs & VerifiedArgs<TReturn>>;

  public pipe(
    middleware: GqlGuardMiddleware<any, any, any>,
  ): MiddlewareChainPipeline<TVerifiedArgs>;

  public pipe(middleware: ChainableMiddleware) {
    this.middlewares.push(middleware);
    return this as MiddlewareChainPipeline<any>;
  }

  public execute<
    TInjected extends Record<string, unknown> | undefined,
    TBaseContext extends Record<string, unknown>,
    TReturn,
  >(
    resolver: (
      parent: any,
      args: TVerifiedArgs,
      context: VerifiedContext<TInjected, TBaseContext>,
      info: any,
    ) => Promise<TReturn>,
  ) {
    const middlewares = this.middlewares;

    // This is a killer move becasue this is what we have to return becuase of gql signature of resolver
    return async (
      parent: any,
      args: any,
      context: GqlGlobalBaseContext<any>,
      info: any,
    ): Promise<TReturn> => {
      let accumulated = {} as TVerifiedArgs;

      for (const mw of middlewares) {
        const result = await mw(parent, args, context, info);
        if (result !== undefined && result !== null) {
          if (result.validatedArgs) {
            accumulated = {
              ...accumulated,
              validatedArgs: { ...accumulated.validatedArgs, ...result.validatedArgs },
            } as TVerifiedArgs;
          } else {
            accumulated = { ...accumulated, ...result };
          }
        }
      }

      return resolver(
        parent,
        accumulated,
        context as VerifiedContext<TInjected, TBaseContext>,
        info,
      );
    };
  }
}

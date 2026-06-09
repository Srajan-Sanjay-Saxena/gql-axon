import { z } from "zod";
import {
  fromError,
  type ValidationError as ZodValidationError,
} from "zod-validation-error";
import type { ValidDataBrand } from "../types/brand.helper.js";
import type {
  GqlAsyncResolver,
  GqlRequestConfig,
  SchemaConfig,
} from "../types/graphql/resolver.types.js";
import type {
  GqlGlobalBaseContext,
  MagicInjectedContext,
} from "../types/graphql/context.types.js";
import { catchGqlAsync } from "../error/error.util.js";
import { ValidationError } from "../error/strategy/error.strategy.js";

export type TypeSafeObject<TSchema> =
  | {
      success: true;
      data: ValidDataBrand<z.infer<TSchema>>;
      error: null;
    }
  | {
      success: false;
      data: null;
      error: ZodValidationError;
    };

export function MakeObjectTypeSafeEngine<TSchema>(
  schema: z.ZodType<TSchema>,
  obj: unknown,
): TypeSafeObject<TSchema> {
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
    data: result.data as ValidDataBrand<z.infer<TSchema>>,
    error: null,
  };
}

export function RequestGuardMiddleware<
  TConfig extends GqlRequestConfig & { args: z.ZodTypeAny },
  TInjected extends Record<string, unknown>,
  TBaseContext extends GqlGlobalBaseContext<TInjected>,
>(
  schemas: SchemaConfig<TConfig>,
): GqlAsyncResolver<
  any,
  TBaseContext,
  unknown,
  { validatedArgs: z.infer<TConfig["args"]> }
>;

export function RequestGuardMiddleware<
  TConfig extends Exclude<GqlRequestConfig, { args: z.ZodTypeAny }>,
  TInjected extends Record<string, unknown>,
  TBaseContext extends GqlGlobalBaseContext<TInjected>,
>(
  schemas: SchemaConfig<TConfig>,
): GqlAsyncResolver<any, TBaseContext, unknown, undefined>;

export function RequestGuardMiddleware<
  TConfig extends GqlRequestConfig,
  TInjected extends Record<string, unknown>,
  TBaseContext extends GqlGlobalBaseContext<TInjected>,
>(schemas: SchemaConfig<TConfig>) {
  return catchGqlAsync(
    async (parent: any, args: unknown, context: TBaseContext, info: any) => {
      if (schemas.context) {
        const result = MakeObjectTypeSafeEngine(schemas.context, context ?? {});
        if (!result.success) {
          throw new ValidationError(result.error);
        }
        (
          context as MagicInjectedContext<
            z.infer<TConfig["context"]>,
            TBaseContext
          >
        ).validatedContext = result.data;
      }

      if (schemas.args) {
        const result = MakeObjectTypeSafeEngine(schemas.args, args ?? {});
        if (!result.success) {
          throw new ValidationError(result.error);
        }
        return { validatedArgs: result.data };
      }
    },
  );
}

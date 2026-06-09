import { AppError } from "./app.error.base.js";
import {
  InternalServerError,
  ValidationError,
  ConflictError,
} from "./strategy/error.strategy.js";
import type { GqlAsyncResolver } from "../types/graphql/resolver.types.js";
import type { GqlGlobalBaseContext } from "../types/graphql/context.types.js";

export const catchGqlAsync = <TParent, TArgs, TContext, TReturn>(
  resolverFn: GqlAsyncResolver<TParent, TArgs, TContext, TReturn>,
) => {
  return async (
    parent: TParent,
    args: TArgs,
    context: GqlGlobalBaseContext<TContext>,
    info: any,
  ): Promise<TReturn> => {
    try {
      return await resolverFn(parent, args, context, info);
    } catch (error: any) {
      console.error(`[Resolver Error] ${info.fieldName}:`, error);

      // Already an operational error — rethrow for global middleware
      if (error instanceof AppError) {
        throw error;
      }

      // Zod validation error
      if (error.name === "ZodError") {
        throw new ValidationError(error);
      }

      // Prisma unique constraint
      if (error.code === "P2002") {
        throw new ConflictError(
          "This username or email is already taken.",
          error,
        );
      }

      // Unknown error — hide details from client
      throw new InternalServerError("Something went wrong.", error);
    }
  };
};

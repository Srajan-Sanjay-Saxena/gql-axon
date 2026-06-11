import type { Request } from "express";
import type { ValidDataBrand } from "../brand.helper.js";
import type { GqlRequestConfig } from "./resolver.types.js";

type GqlGlobalBaseContext<TBaseContext> = TBaseContext & {
  req: Request;
};

type MagicInjectedContext<TInjected, TBaseContext> = TInjected &
  GqlGlobalBaseContext<TBaseContext>;

type VerifiedContext<
  TConfig extends GqlRequestConfig["context"],
  TBaseContext,
> =
  TConfig extends Record<string, unknown>
    ? {
        validatedContext: ValidDataBrand<
          MagicInjectedContext<TConfig, TBaseContext>
        >;
      }
    : { validatedContext: ValidDataBrand<GqlGlobalBaseContext<TBaseContext>> };


export type { GqlGlobalBaseContext, MagicInjectedContext, VerifiedContext };

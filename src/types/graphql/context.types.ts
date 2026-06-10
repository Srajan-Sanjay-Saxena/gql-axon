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
  TConfig extends Record<string, any>
    ? ValidDataBrand<MagicInjectedContext<TConfig["context"], TBaseContext>>
    : TBaseContext;

export type { GqlGlobalBaseContext, MagicInjectedContext, VerifiedContext };

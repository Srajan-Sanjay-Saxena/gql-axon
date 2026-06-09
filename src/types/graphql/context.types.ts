import type { Request } from "express";

type GqlGlobalBaseContext<TBaseContext> = TBaseContext & {
  req: Request;
};

type MagicInjectedContext<TInjected, TBaseContext> = TInjected &
  GqlGlobalBaseContext<TBaseContext>;

type VerifiedContext<TConfig extends { context?: Record<string, unknown> }, TBaseContext> =
  TConfig["context"] extends Record<string, any>
    ? MagicInjectedContext<TConfig["context"], TBaseContext>
    : TBaseContext;

export type { GqlGlobalBaseContext, MagicInjectedContext, VerifiedContext };

declare const brand: unique symbol;

type Brand<TVar, TBrand> = TVar & { [brand]: TBrand };
export type ValidDataBrand<TData> = Brand<TData, "ValidData">;
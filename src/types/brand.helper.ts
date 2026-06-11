declare const brand: unique symbol;

type Brand<TData, TBrand> = TData & { [brand]: TBrand };
export type ValidDataBrand<TData> = Brand<TData, "ValidData">;
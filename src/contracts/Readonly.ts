export type DeepReadonly<T> = T extends Date | ((...args: never[]) => unknown)
  ? T
  : T extends ReadonlyMap<infer TKey, infer TValue>
    ? ReadonlyMap<DeepReadonly<TKey>, DeepReadonly<TValue>>
    : T extends ReadonlySet<infer TItem>
      ? ReadonlySet<DeepReadonly<TItem>>
      : T extends readonly (infer TItem)[]
        ? readonly DeepReadonly<TItem>[]
        : T extends object
          ? { readonly [TKey in keyof T]: DeepReadonly<T[TKey]> }
          : T;

type D1Result = { meta?: { changes?: number } }
export type D1Statement = {
  bind: (...values: unknown[]) => D1Statement
  first: <T = Record<string, unknown>>() => Promise<T | null>
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>
  run: () => Promise<D1Result>
}
export type D1DatabaseLike = { prepare: (query: string) => D1Statement; batch: (statements: D1Statement[]) => Promise<D1Result[]> }

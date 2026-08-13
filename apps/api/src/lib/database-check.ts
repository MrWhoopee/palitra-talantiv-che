export interface QueryableClient {
  $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
}

export function createDatabaseCheck(client: QueryableClient): () => Promise<boolean> {
  return async () => {
    try {
      await client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  };
}

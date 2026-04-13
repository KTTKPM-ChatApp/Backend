export interface TransactionContext {
  manager: unknown;
}

export interface TransactionManager {
  runInTransaction<T>(
    operation: (context: TransactionContext) => Promise<T>,
  ): Promise<T>;
}


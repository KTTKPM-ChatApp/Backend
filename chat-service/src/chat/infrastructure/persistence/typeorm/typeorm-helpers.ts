import { EntityManager } from 'typeorm';
import { TransactionContext } from '../../../application/ports/transaction-manager';

export interface TypeOrmTransactionContext extends TransactionContext {
  manager: EntityManager;
}

export function getEntityManager(
  defaultManager: EntityManager,
  context?: TransactionContext,
): EntityManager {
  return (context as TypeOrmTransactionContext | undefined)?.manager ?? defaultManager;
}


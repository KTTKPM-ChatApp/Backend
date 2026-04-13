import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  TransactionContext,
  TransactionManager,
} from '../../../application/ports/transaction-manager';

@Injectable()
export class TypeOrmTransactionManager implements TransactionManager {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  runInTransaction<T>(
    operation: (context: TransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction((manager) =>
      operation({
        manager,
      }),
    );
  }
}

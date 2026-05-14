import 'reflect-metadata';
import { DataSource, Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { config } from './config';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ unique: true }) username!: string;
  @Column({ unique: true }) email!: string;
  @Column({ name: 'password_hash' }) passwordHash!: string;
  @Column({ name: 'display_name' }) displayName!: string;
  @Column({ name: 'avatar_url', nullable: true }) avatarUrl?: string;
  @Column({ nullable: true }) bio?: string;
  @Column({ nullable: true }) gender?: string;
  @Column({ type: 'date', nullable: true }) dateOfBirth?: Date;
  @Column({ nullable: true }) phone?: string;
  @Column({ name: 'is_active', default: true }) isActive!: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'user_id' }) userId!: string;
  @Column({ type: 'text' }) token!: string;
  @Column({ name: 'expires_at' }) expiresAt!: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
}

export const AppDataSource = new DataSource({
  type: 'mariadb',
  ...config.db,
  synchronize: process.env.NODE_ENV !== 'production',
  logging: false,
  entities: [User, RefreshToken],
  connectorPackage: 'mysql2',
  extra: {
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
  },
});

export async function initializeDataSource() {
  const maxRetries = 10;
  const retryDelay = 3000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        console.log('TypeORM connection established successfully');
      }
      return;
    } catch (error) {
      console.error(`TypeORM connection attempt ${attempt}/${maxRetries} failed:`, error);
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`Retrying in ${retryDelay}ms...`);
      await sleep(retryDelay);
    }
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function ensureDatabase() {
  const { createConnection } = await import('mysql2/promise');
  const maxRetries = 10;
  const retryDelay = 3000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await createConnection({
        host: config.db.host,
        port: config.db.port,
        user: config.db.username,
        password: config.db.password,
        connectTimeout: 10000,
      });
      await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await conn.end();
      console.log('Database connection established successfully');
      return;
    } catch (error) {
      console.error(`Database connection attempt ${attempt}/${maxRetries} failed:`, error);
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`Retrying in ${retryDelay}ms...`);
      await sleep(retryDelay);
    }
  }
}

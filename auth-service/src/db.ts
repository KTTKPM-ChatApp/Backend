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
});

export async function ensureDatabase() {
  const { createConnection } = await import('mysql2/promise');
  const conn = await createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.username,
    password: config.db.password,
  });
  await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.end();
}

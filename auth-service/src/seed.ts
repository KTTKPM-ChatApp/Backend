import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { AppDataSource, User } from './db';
import { ensureDatabase, initializeDataSource } from './db';

const SAMPLE_USERS = [
  { username: 'nguyenvana', email: 'nguyenvana@example.com', displayName: 'Nguyen Van A', gender: 'male', bio: 'Sinh viên IUH', password: 'password123' },
  { username: 'tranthingb', email: 'tranthingb@example.com', displayName: 'Tran Thị B', gender: 'female', bio: 'Yêu thích công nghệ', password: 'password123' },
  { username: 'ledinhc', email: 'ledinhc@example.com', displayName: 'Lê Đình C', gender: 'male', bio: 'Developer', password: 'password123' },
  { username: 'phamthid', email: 'phamthid@example.com', displayName: 'Phạm Thị D', gender: 'female', bio: 'Designer', password: 'password123' },
  { username: 'hoangvuonge', email: 'hoangvuonge@example.com', displayName: 'Hoàng Vượng E', gender: 'male', bio: 'Backend Developer', password: 'password123' },
];

async function seed() {
  try {
    await ensureDatabase();
    await initializeDataSource();

    const userRepo = AppDataSource.getRepository(User);

    for (const u of SAMPLE_USERS) {
      const existing = await userRepo.findOneBy({ email: u.email });
      if (existing) {
        console.log(`User ${u.email} already exists, skipping...`);
        continue;
      }

      const user = userRepo.create({
        username: u.username,
        email: u.email,
        displayName: u.displayName,
        gender: u.gender,
        bio: u.bio,
        passwordHash: await bcrypt.hash(u.password, 10),
        isActive: true,
      });

      await userRepo.save(user);
      console.log(`Created user: ${u.email}`);
    }

    console.log('Seed completed!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
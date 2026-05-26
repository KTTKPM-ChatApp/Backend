import 'reflect-metadata';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { AppDataSource, User, Friendship } from './db';
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
    const friendshipRepo = AppDataSource.getRepository(Friendship);

    const createdUsers: User[] = [];

    for (const u of SAMPLE_USERS) {
      const existing = await userRepo.findOneBy({ email: u.email });
      if (existing) {
        console.log(`User ${u.email} already exists, skipping...`);
        createdUsers.push(existing);
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

      const saved = await userRepo.save(user);
      console.log(`Created user: ${u.email}`);
      createdUsers.push(saved);
    }

    for (let i = 0; i < createdUsers.length; i++) {
      for (let j = i + 1; j < createdUsers.length; j++) {
        const existing = await friendshipRepo.findOne({
          where: [
            { userId: createdUsers[i].id, friendId: createdUsers[j].id },
            { userId: createdUsers[j].id, friendId: createdUsers[i].id },
          ],
        });
        if (!existing) {
          await friendshipRepo.save({ userId: createdUsers[i].id, friendId: createdUsers[j].id });
          await friendshipRepo.save({ userId: createdUsers[j].id, friendId: createdUsers[i].id });
          console.log(`Friendship: ${createdUsers[i].displayName} <-> ${createdUsers[j].displayName}`);
        }
      }
    }

    console.log('Auth seed completed!');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    return user ? this.mapToEntity(user) : null;
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    return user ? this.mapToEntity(user) : null;
  }

  async create(data: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash,
        active: true,
      },
    });

    return this.mapToEntity(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  private mapToEntity(user: any): User {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash,
      active: user.active,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}


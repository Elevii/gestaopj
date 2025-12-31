export class User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  active: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}


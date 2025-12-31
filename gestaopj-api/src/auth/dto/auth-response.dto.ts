export class UserResponseDto {
  id: string;
  email: string;
  name: string;
  active: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class AuthResponseDto {
  user: UserResponseDto;
  accessToken: string;
}


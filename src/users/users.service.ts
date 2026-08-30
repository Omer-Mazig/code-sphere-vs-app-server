import { Injectable, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { BusinessException } from '../common/errors/business.exception';
import { ErrorCode } from '../common/errors/error-codes.enum';
import { ProfileFieldUpdates } from './profile-updates';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async findUserOrFail(userId: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new BusinessException(
        ErrorCode.USER_NOT_FOUND,
        user
          ? `User with id "${userId}" is inactive`
          : `User with id "${userId}" not found`,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }

  async deactivateUser(userId: string): Promise<void> {
    const user = await this.findUserOrFail(userId);
    user.isActive = false;
    await this.usersRepository.save(user);
  }

  async updateUser(userId: string, data: ProfileFieldUpdates): Promise<User> {
    const user = await this.findUserOrFail(userId);

    Object.assign(user, data);
    return this.usersRepository.save(user);
  }
}

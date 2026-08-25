import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../users/entities/user.entity';

export enum NotificationType {
  POST_LIKED = 'POST_LIKED',
  POST_COMMENTED = 'POST_COMMENTED',
  COMMENT_REPLIED = 'COMMENT_REPLIED',
  NEW_FOLLOWER = 'NEW_FOLLOWER',
  USER_MENTIONED = 'USER_MENTIONED',
}

export enum NotificationTargetType {
  POST = 'POST',
  ARTICLE = 'ARTICLE',
  USER = 'USER',
}

@Entity('notifications')
@Index(['userId', 'isRead', 'createdAt'])
@Index(['userId', 'targetType', 'isRead', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'enum', enum: NotificationTargetType, nullable: true })
  targetType: NotificationTargetType | null;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}

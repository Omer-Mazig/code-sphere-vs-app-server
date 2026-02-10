import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum TargetType {
  POST = 'POST',
  ARTICLE = 'ARTICLE',
}

@Entity('likes')
@Unique(['userId', 'targetId', 'targetType'])
export class Like {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  targetId: string;

  @Column({ type: 'enum', enum: TargetType })
  targetType: TargetType;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}

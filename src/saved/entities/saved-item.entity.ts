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

export enum SavedTargetType {
  POST = 'POST',
  ARTICLE = 'ARTICLE',
  EVENT = 'EVENT',
}

@Entity('saved_items')
@Unique(['userId', 'targetId', 'targetType'])
export class SavedItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'uuid' })
  targetId: string;

  @Column({ type: 'enum', enum: SavedTargetType })
  targetType: SavedTargetType;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}

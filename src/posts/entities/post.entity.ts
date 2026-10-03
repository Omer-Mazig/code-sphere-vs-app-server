import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { PostImageLayout } from '../posts.constants';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  authorId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ default: true })
  isPublished: boolean;

  @Column({ type: 'uuid', nullable: true })
  sharedPostId: string | null;

  @Column({
    type: 'enum',
    enum: PostImageLayout,
    default: PostImageLayout.GALLERY,
  })
  imageLayout: PostImageLayout;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @ManyToOne(() => Post, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sharedPostId' })
  sharedPost: Post | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

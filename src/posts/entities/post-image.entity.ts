import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { MediaObject } from '../../media/entities/media-object.entity';
import { Post } from './post.entity';

@Entity('post_images')
@Unique(['postId', 'position'])
@Unique(['postId', 'mediaId'])
export class PostImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  postId: string;

  @Column()
  mediaId: string;

  @Column({ type: 'int' })
  position: number;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'postId' })
  post: Post;

  @ManyToOne(() => MediaObject, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mediaId' })
  media: MediaObject;

  @CreateDateColumn()
  createdAt: Date;
}

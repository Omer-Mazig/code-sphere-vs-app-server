import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('media_objects')
export class MediaObject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  storageKey: string;

  @Column()
  mimeType: string;

  @Column({ type: 'int' })
  byteSize: number;

  @Column()
  uploaderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploaderId' })
  uploader: User;

  @CreateDateColumn()
  createdAt: Date;
}

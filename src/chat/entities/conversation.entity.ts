import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { ConversationParticipant } from './conversation-participant.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('conversations')
@Unique(['userLowId', 'userHighId'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userLowId: string;

  @Column()
  userHighId: string;

  @OneToMany(() => ConversationParticipant, (row) => row.conversation)
  participants: ConversationParticipant[];

  @OneToMany(() => ChatMessage, (message) => message.conversation)
  messages: ChatMessage[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

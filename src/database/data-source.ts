import { config } from 'dotenv';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Follow } from '../users/entities/follow.entity';
import { Post } from '../posts/entities/post.entity';
import { Article } from '../articles/entities/article.entity';
import { Like } from '../interactions/entities/like.entity';
import { Comment } from '../interactions/entities/comment.entity';
import { Share } from '../interactions/entities/share.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { NotificationStreamToken } from '../notifications/entities/notification-stream-token.entity';
import { MediaObject } from '../media/entities/media-object.entity';
import { Topic } from '../topics/entities/topic.entity';
import { UserFollowedTopic } from '../topics/entities/user-followed-topic.entity';
import { PostTopic } from '../topics/entities/post-topic.entity';
import { ArticleTopic } from '../topics/entities/article-topic.entity';
import { PostImage } from '../posts/entities/post-image.entity';
import { Conversation } from '../chat/entities/conversation.entity';
import { ConversationParticipant } from '../chat/entities/conversation-participant.entity';
import { ChatMessage } from '../chat/entities/chat-message.entity';
import { UserBlock } from '../users/entities/user-block.entity';

config({ path: join(__dirname, '../../.env') });

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'code_sphere',
  entities: [
    User,
    Follow,
    Post,
    Article,
    Like,
    Comment,
    Share,
    RefreshToken,
    Notification,
    NotificationPreference,
    NotificationStreamToken,
    MediaObject,
    Topic,
    UserFollowedTopic,
    PostTopic,
    ArticleTopic,
    PostImage,
    Conversation,
    ConversationParticipant,
    ChatMessage,
    UserBlock,
  ],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
});

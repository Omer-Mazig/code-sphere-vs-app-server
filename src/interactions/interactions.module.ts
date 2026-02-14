import { Module } from '@nestjs/common';
import { LikesModule } from './likes';
import { CommentsModule } from './comments';
import { SharesModule } from './shares';

@Module({
  imports: [LikesModule, CommentsModule, SharesModule],
})
export class InteractionsModule {}

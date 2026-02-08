import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { Like } from './entities/like.entity';
import { Comment } from './entities/comment.entity';
import { Share } from './entities/share.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Like, Comment, Share])],
  controllers: [InteractionsController],
  providers: [InteractionsService],
  exports: [InteractionsService],
})
export class InteractionsModule {}

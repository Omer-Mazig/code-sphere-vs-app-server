import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { DevelopmentWaitMiddleware, RequestContextMiddleware } from './common';
import {
  databaseConfig,
  appConfig,
  throttlerConfig,
  authConfig,
  loggerConfig,
  envValidationSchema,
  buildPinoHttpParams,
} from './config';
import { AuthGuard } from './common/guards';
import {
  PaginatedResponseInterceptor,
  SuccessEnvelopeInterceptor,
} from './common/interceptors';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { ArticlesModule } from './articles/articles.module';
import { InteractionsModule } from './interactions/interactions.module';
import { SeedModule } from './seed/seed.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        appConfig,
        throttlerConfig,
        authConfig,
        loggerConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildPinoHttpParams({
          level: configService.get<string>('logger.level', 'info'),
          pretty: configService.get<boolean>('logger.pretty', true),
        }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('throttler.ttl', 60000),
            limit: configService.get<number>('throttler.limit', 30),
          },
        ],
      }),
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        autoLoadEntities: true,
        synchronize: configService.get<boolean>('database.synchronize', false),
      }),
    }),
    EventEmitterModule.forRoot(),
    AuthModule,
    UsersModule,
    PostsModule,
    ArticlesModule,
    InteractionsModule,
    NotificationsModule,
    SeedModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: SuccessEnvelopeInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PaginatedResponseInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestContextMiddleware, DevelopmentWaitMiddleware)
      .forRoutes('*');
  }
}

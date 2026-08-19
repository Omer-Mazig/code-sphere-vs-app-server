import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters';
import { SwaggerModule } from '@nestjs/swagger';
import { buildSwaggerConfig } from './config/swagger.config';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  const logger = app.get(Logger);
  const port = configService.get<number>('app.port', 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api');
  const isProduction = configService.get<boolean>('app.isProduction', false);

  app.setGlobalPrefix(apiPrefix);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: false,
    }),
  );

  if (!isProduction) {
    const swaggerConfig = buildSwaggerConfig();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, swaggerDocument);
  }

  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(port);

  logger.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  if (!isProduction) {
    logger.log(`Swagger documentation: http://localhost:${port}/docs`);
  }
}
void bootstrap();

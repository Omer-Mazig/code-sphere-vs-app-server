import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters';
import { SwaggerModule } from '@nestjs/swagger';
import { getSwaggerConfig } from './config/swagger.config';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api');

  app.setGlobalPrefix(apiPrefix);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      disableErrorMessages: false,
    }),
  );

  const document = getSwaggerConfig(app);
  SwaggerModule.setup('docs', app, document);

  const corsOrigins = configService.get<string[]>('app.corsOrigins', []);
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(port);

  console.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  console.log(`Swagger documentation: http://localhost:${port}/docs`);
}
bootstrap();

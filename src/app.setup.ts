import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ValidationError } from 'class-validator';
import {
  flattenValidationErrors,
  RequestValidationException,
} from './common/errors';
import { GlobalExceptionFilter } from './common/filters';
import { buildSwaggerConfig } from './config/swagger.config';

export function configureHttpApp(
  app: INestApplication,
  configService: ConfigService,
) {
  const apiPrefix = configService.get<string>('app.apiPrefix', 'api');
  const isProduction = configService.get<boolean>('app.isProduction', false);
  const nodeEnv = configService.get<string>('app.nodeEnv', 'development');

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
      exceptionFactory: (errors: ValidationError[]) =>
        new RequestValidationException(flattenValidationErrors(errors)),
    }),
  );

  if (!isProduction && nodeEnv !== 'test') {
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

  if (configService.get<boolean>('app.trustProxy', false)) {
    const httpAdapter = app.getHttpAdapter();
    httpAdapter.getInstance().set('trust proxy', 1);
  }
}

import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function getSwaggerConfig(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('CodeSphere API')
    .setDescription('CodeSphere - A social network for developers')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config);
}

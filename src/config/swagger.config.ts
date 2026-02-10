import { DocumentBuilder } from '@nestjs/swagger';

export function buildSwaggerDocument() {
  const config = new DocumentBuilder()
    .setTitle('CodeSphere API')
    .setDescription('CodeSphere - A social network for developers')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  return config;
}

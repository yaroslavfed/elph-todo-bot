import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { readConfig } from './config.js';

const config = readConfig();
const app = await NestFactory.create(AppModule, { rawBody: true });
app.enableShutdownHooks();
await app.listen(config.httpPort, config.httpHost);

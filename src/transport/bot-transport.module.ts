import { DynamicModule, Module } from '@nestjs/common';
import type { BotPlatform } from '../config.js';
import { ElphTransportModule } from './elph/elph.module.js';
import { TelegramTransportModule } from './telegram/telegram.module.js';

@Module({})
export class BotTransportModule {
  public static register(platform: BotPlatform): DynamicModule {
    const selected = platform === 'elph' ? ElphTransportModule : TelegramTransportModule;
    return { module: BotTransportModule, imports: [selected], exports: [selected] };
  }
}

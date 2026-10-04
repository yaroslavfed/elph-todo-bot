import { Module } from '@nestjs/common';
import { BotUpdateHandler } from '../../bot-update.handler.js';
import { BOT_TRANSPORT } from '../types.js';
import { TelegramBotAdapter } from './telegram.adapter.js';
import { TelegramBridge } from './telegram.bridge.js';
import { TelegramWebhookController } from './telegram.controller.js';

@Module({
  controllers: [TelegramWebhookController],
  providers: [TelegramBotAdapter, TelegramBridge, BotUpdateHandler, { provide: BOT_TRANSPORT, useExisting: TelegramBotAdapter }],
  exports: [BOT_TRANSPORT],
})
export class TelegramTransportModule {}

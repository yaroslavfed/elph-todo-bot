import { Module } from '@nestjs/common';
import { BotUpdateHandler } from '../../bot-update.handler.js';
import { BOT_TRANSPORT } from '../types.js';
import { TelegramBotAdapter } from './telegram.adapter.js';
import { TelegramBridge } from './telegram.bridge.js';
import { TelegramWebhookController } from './telegram.controller.js';
import { BotInterfaceService } from '../../bot-interface.service.js';

@Module({
  controllers: [TelegramWebhookController],
  providers: [TelegramBotAdapter, TelegramBridge, BotInterfaceService, BotUpdateHandler, { provide: BOT_TRANSPORT, useExisting: TelegramBotAdapter }],
  exports: [BOT_TRANSPORT, BotInterfaceService],
})
export class TelegramTransportModule {}

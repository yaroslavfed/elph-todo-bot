import { Body, Controller, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import type { Update } from 'grammy/types';
import { TelegramBotAdapter } from './telegram.adapter.js';

@Controller('webhooks/telegram')
export class TelegramWebhookController {
  public constructor(private readonly adapter: TelegramBotAdapter) {}
  @Post()
  @HttpCode(204)
  public async receive(@Body() update: Update, @Headers('x-telegram-bot-api-secret-token') secret?: string): Promise<void> {
    try { await this.adapter.handle(update, secret); }
    catch (error) { if (error instanceof Error && error.message === 'Telegram webhook secret is invalid') throw new UnauthorizedException(error.message); throw error; }
  }
}

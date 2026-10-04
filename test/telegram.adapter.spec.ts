import assert from 'node:assert/strict';
import test from 'node:test';
import type { Update } from 'grammy/types';
import { TelegramBotAdapter } from '../src/transport/telegram/telegram.adapter.js';

test('initializes grammY before handling a Telegram webhook', async () => {
  const previous = { ...process.env };
  process.env.TELEGRAM_BOT_TOKEN = 'token';
  process.env.TELEGRAM_WEBHOOK_SECRET = 'secret-token';
  try {
    const adapter = new TelegramBotAdapter();
    const bot = (adapter as unknown as { bot: { init: () => Promise<void>; handleUpdate: (update: Update) => Promise<void> } }).bot;
    let initialized = false;
    bot.init = async () => { initialized = true; };
    bot.handleUpdate = async () => { assert.equal(initialized, true); };

    await adapter.onModuleInit();
    await adapter.handle({ update_id: 1 } as Update, 'secret-token');
  } finally {
    process.env = previous;
  }
});

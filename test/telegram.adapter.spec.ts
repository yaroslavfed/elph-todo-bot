import assert from 'node:assert/strict';
import test from 'node:test';
import type { Update } from 'grammy/types';
import { TelegramBotAdapter } from '../src/transport/telegram/telegram.adapter.js';
import { BotUiService } from '../src/bot-ui.service.js';

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

test('flattens nested keyboards without registering a webhook during interface update', async () => {
  const previous = { ...process.env };
  process.env.TELEGRAM_BOT_TOKEN = 'token';
  process.env.TELEGRAM_WEBHOOK_SECRET = 'secret-token';
  try {
    const adapter = new TelegramBotAdapter();
    const bot = (adapter as unknown as {
      bot: { api: { setMyCommands: (commands: unknown) => Promise<void>; sendMessage: (chatId: string, text: string, options: unknown) => Promise<void> } };
      registerWebhook: () => Promise<void>;
    }).bot;
    const commands: unknown[] = [];
    const messages: unknown[] = [];
    let webhookCalls = 0;
    bot.api.setMyCommands = async (value) => { commands.push(value); };
    bot.api.sendMessage = async (_chatId, _text, options) => { messages.push(options); };
    (adapter as unknown as { registerWebhook: () => Promise<void> }).registerWebhook = async () => { webhookCalls += 1; };

    const ui = new BotUiService();
    await adapter.updateInterface(ui.profile('compact').menu, ui.profile('compact').replyKeyboard);
    await adapter.sendText('telegram:1', 'text', 'Проверка');
    await adapter.sendKeyboard('telegram:1', 'keyboard', ui.listActions());

    assert.equal(webhookCalls, 0);
    assert.equal(commands.length, 1);
    assert.deepEqual(messages[0], {
      reply_markup: {
        keyboard: [
          ['➕ Новая задача'],
          ['📋 Активные задачи'],
          ['✅ Выполненные задачи'],
          ['🔄 Обновить активные задачи'],
          ['➕ Создать новую задачу'],
          ['📋 Показать активные задачи'],
          ['✅ Показать выполненные задачи'],
          ['📤 Экспортировать все задачи в JSON'],
          ['⚙️ Настроить вид меню'],
          ['ℹ️ Помощь по работе с ToDo Bot'],
        ],
        resize_keyboard: true,
      },
    });
    assert.deepEqual(messages[1], {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Активные задачи', callback_data: '/tasks' }],
          [{ text: '✅ Выполненные задачи', callback_data: '/done' }],
          [{ text: '🔄 Обновить активные задачи', callback_data: 'tasks:refresh' }],
          [{ text: '➕ Новая задача', callback_data: 'task:new' }],
          [{ text: '➕ Создать новую задачу', callback_data: '/new' }],
          [{ text: '📋 Показать активные задачи', callback_data: '/tasks' }],
          [{ text: '✅ Показать выполненные задачи', callback_data: '/done' }],
          [{ text: '📤 Экспортировать все задачи в JSON', callback_data: '/export' }],
          [{ text: '⚙️ Настроить вид меню', callback_data: '/settings' }],
          [{ text: 'ℹ️ Помощь по работе с ToDo Bot', callback_data: '/help' }],
        ],
      },
    });
  } finally {
    process.env = previous;
  }
});

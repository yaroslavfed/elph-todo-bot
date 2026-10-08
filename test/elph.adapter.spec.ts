import assert from 'node:assert/strict';
import test from 'node:test';
import { ElphBotAdapter } from '../src/transport/elph/elph.adapter.js';
import { BotUiService } from '../src/bot-ui.service.js';

test('preserves nested keyboard children in ELPh requests', async () => {
  const calls: { message?: unknown; menu?: unknown; reply?: unknown } = {};
  const bot = {
    sendMessage: async (request: unknown) => { calls.message = request; },
    sendFile: async () => undefined,
    setMyCommands: async (request: unknown) => { calls.menu = request; },
    setReplyKeyboard: async (request: unknown) => { calls.reply = request; },
  };
  const adapter = new ElphBotAdapter(bot as never);
  const ui = new BotUiService();

  await adapter.sendKeyboard('elph:1', 'message', ui.listActions(), 'Действия');
  await adapter.updateInterface(ui.profile('compact').menu, ui.profile('compact').replyKeyboard);

  assert.deepEqual(calls.message, {
    chatId: '1',
    requestId: 'message',
    text: 'Действия',
    inlineKeyboard: {
      rows: [
        {
          buttons: [
            {
              text: '📋 Просмотр задач',
              command: '/tasks',
              children: {
                rows: [
                  { buttons: [{ text: '📋 Активные задачи', command: '/tasks' }] },
                  { buttons: [{ text: '✅ Выполненные задачи', command: '/done' }] },
                  { buttons: [{ text: '🔄 Обновить активные задачи', command: 'tasks:refresh' }] },
                ],
              },
            },
          ],
        },
        { buttons: [{ text: '➕ Новая задача', command: 'task:new' }] },
      ],
    },
  });
  assert.deepEqual(calls.menu, { buttons: ui.profile('compact').menu });
  assert.deepEqual(calls.reply, {
    rows: [
      { buttons: [{ text: '➕ Новая задача', command: '/new' }] },
      {
        buttons: [
          {
            text: '☰ Все действия',
            command: '',
            children: {
              rows: [
                { buttons: [{ text: '➕ Создать новую задачу', command: '/new' }] },
                { buttons: [{ text: '📋 Показать активные задачи', command: '/tasks' }] },
                { buttons: [{ text: '✅ Показать выполненные задачи', command: '/done' }] },
                { buttons: [{ text: '📤 Экспортировать все задачи в JSON', command: '/export' }] },
                { buttons: [{ text: '⚙️ Настроить вид меню', command: '/settings' }] },
                { buttons: [{ text: 'ℹ️ Помощь по работе с ToDo Bot', command: '/help' }] },
              ],
            },
          },
        ],
      },
    ],
  });
});

test('uses all supported command and nested-menu button combinations', () => {
  const ui = new BotUiService();
  const executeOnly = ui.listActions().rows[1]![0]!;
  const executeAndNavigate = ui.listActions().rows[0]![0]!;
  const navigateOnly = ui.profile('compact').replyKeyboard.rows[1]![0]!;

  assert.notEqual(executeOnly.command, '');
  assert.equal(executeOnly.children, undefined);
  assert.notEqual(executeAndNavigate.command, '');
  assert.notEqual(executeAndNavigate.children, undefined);
  assert.equal(navigateOnly.command, '');
  assert.notEqual(navigateOnly.children, undefined);
});

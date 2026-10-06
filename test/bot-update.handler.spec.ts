import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DatabaseService } from '../src/database.service.js';
import { TasksRepository } from '../src/tasks/tasks.repository.js';
import { ConversationService } from '../src/conversation.service.js';
import { FileStorageService } from '../src/file-storage.service.js';
import { BotUiService } from '../src/bot-ui.service.js';
import { BotSettingsRepository } from '../src/bot-settings.repository.js';
import { BotInterfaceService } from '../src/bot-interface.service.js';
import { BotUpdateHandler } from '../src/bot-update.handler.js';
import { dispatchTelegramUpdate, setIncomingReceiver } from '../src/transport/incoming-bridge.js';
import type { BotTransport, CommandButton, Keyboard, OutgoingFile } from '../src/transport/types.js';

class TestTransport implements BotTransport {
  readonly texts: string[] = [];
  readonly files: OutgoingFile[] = [];
  readonly keyboards: Array<{ text?: string; keyboard: Keyboard }> = [];
  readonly setups: Array<{ menu: CommandButton[]; keyboard: Keyboard }> = [];
  readonly updates: Array<{ menu: CommandButton[]; keyboard: Keyboard }> = [];
  updateError: Error | undefined;
  public async sendText(_chat: string, _operation: string, text: string): Promise<void> { this.texts.push(text); }
  public async sendKeyboard(_chat: string, _operation: string, keyboard: Keyboard, text?: string): Promise<void> { this.keyboards.push({ keyboard, text }); }
  public async sendFile(_chat: string, _operation: string, file: OutgoingFile): Promise<void> { this.files.push(file); }
  public async setup(menu: CommandButton[], keyboard: Keyboard): Promise<void> { this.setups.push({ menu, keyboard }); }
  public async updateInterface(menu: CommandButton[], keyboard: Keyboard): Promise<void> {
    if (this.updateError) throw this.updateError;
    this.updates.push({ menu, keyboard });
  }
}

function fixture(): { handler: BotUpdateHandler; repository: TasksRepository; settings: BotSettingsRepository; transport: TestTransport; botInterface: BotInterfaceService; database: DatabaseService; root: string } {
  const root = mkdtempSync(join(tmpdir(), 'todo-bot-'));
  process.env.BOT_PLATFORM = 'telegram';
  process.env.TELEGRAM_BOT_TOKEN = 'token'; process.env.TELEGRAM_WEBHOOK_URL = 'https://example.test/webhooks/telegram'; process.env.TELEGRAM_WEBHOOK_SECRET = 'secret';
  process.env.DATA_PATH = join(root, 'todo.sqlite'); process.env.FILE_STORAGE_PATH = join(root, 'storage');
  const database = new DatabaseService(); const repository = new TasksRepository(database); const transport = new TestTransport();
  const ui = new BotUiService();
  const settings = new BotSettingsRepository(database);
  const botInterface = new BotInterfaceService(transport, settings, ui);
  return { handler: new BotUpdateHandler(transport, repository, database, new ConversationService(), new FileStorageService(), ui, botInterface), repository, settings, transport, botInterface, database, root };
}

test('creates a task once when the same title update is delivered twice', async () => {
  const value = fixture();
  try {
    await value.handler.handle({ id: 'new', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'message', text: '/new', attachments: [] });
    const title = { id: 'title', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'message' as const, text: 'Проверить webhook', attachments: [] };
    await value.handler.handle(title); await value.handler.handle(title);
    assert.equal(value.repository.list('telegram:1', 'ACTIVE').length, 1);
    assert.equal(value.transport.keyboards.length, 1);
    assert.match(value.transport.keyboards[0]!.text ?? '', /^Задача создана\./);
  } finally { value.database.close(); rmSync(value.root, { recursive: true, force: true }); }
});

test('keeps attachments and export scoped to the task owner', async () => {
  const value = fixture();
  try {
    await value.handler.handle({ id: 'new', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'message', text: '/new', attachments: [] });
    await value.handler.handle({ id: 'title', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'message', text: 'Отчёт', attachments: [] });
    const task = value.repository.list('telegram:1', 'ACTIVE')[0]!;
    await value.handler.handle({ id: 'attach', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'inline-action', command: `task:${task.id}:attach` });
    await value.handler.handle({ id: 'file', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'message', attachments: [{ id: 'source', name: 'first.txt', mimeType: 'text/plain', download: async () => ({ bytes: Buffer.from('one'), filename: 'first.txt', mimeType: 'text/plain' }) }] });
    await value.handler.handle({ id: 'attach-two', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'inline-action', command: `task:${task.id}:attach` });
    await value.handler.handle({ id: 'file-two', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'message', attachments: [
      { id: 'source-two', name: 'second.txt', mimeType: 'text/plain', download: async () => ({ bytes: Buffer.from('two'), filename: 'second.txt', mimeType: 'text/plain' }) },
      { id: 'source-three', name: 'third.txt', mimeType: 'text/plain', download: async () => ({ bytes: Buffer.from('three'), filename: 'third.txt', mimeType: 'text/plain' }) },
    ] });
    assert.equal(value.repository.attachments(task.id).length, 3);
    await value.handler.handle({ id: 'foreign-download', userKey: 'telegram:2', chatKey: 'telegram:2', type: 'inline-action', command: `task:${task.id}:download:${value.repository.attachments(task.id)[0]!.id}` });
    assert.equal(value.transport.files.length, 0);
    const attachment = value.repository.attachments(task.id)[0]!;
    await value.handler.handle({ id: 'owner-download', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'inline-action', command: `task:${task.id}:download:${attachment.id}` });
    assert.equal(value.transport.files.length, 1);
    assert.equal(value.transport.files[0]!.filename, 'first.txt');
    await value.handler.handle({ id: 'export', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'message', text: '/export', attachments: [] });
    assert.equal(value.transport.files.length, 2);
    assert.match(Buffer.from(value.transport.files[1]!.bytes).toString(), /Отчёт/);
  } finally { value.database.close(); rmSync(value.root, { recursive: true, force: true }); }
});

test('marks fallback events as processed and maps Telegram reply keyboard text to a command', async () => {
  const value = fixture();
  try {
    const fallback = { id: 'idle-text', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'message' as const, text: 'Привет', attachments: [] };
    await value.handler.handle(fallback); await value.handler.handle(fallback);
    assert.equal(value.transport.texts.length, 1);
    const events: Array<{ text?: string }> = [];
    setIncomingReceiver(async (event) => { if (event.type === 'message') events.push({ text: event.text }); });
    await dispatchTelegramUpdate({ update_id: 1, message: { message_id: 1, date: 0, chat: { id: 1, type: 'private' }, from: { id: 1, is_bot: false, first_name: 'Test' }, text: '📋 Мои задачи' } } as never, async () => new Uint8Array(), (text) => text === '📋 Мои задачи' ? '/tasks' : text);
    assert.deepEqual(events, [{ text: '/tasks' }]);
  } finally { value.database.close(); rmSync(value.root, { recursive: true, force: true }); }
});

test('switches the global menu layout and keeps it after restart', async () => {
  const value = fixture();
  try {
    await value.handler.handle({ id: 'layout', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'inline-action', command: 'ui:layout:compact' });
    assert.equal(value.settings.uiMode(), 'compact');
    assert.equal(value.transport.updates.length, 1);
    assert.deepEqual(value.transport.updates[0]!.menu.map((item) => item.command), ['/start', '/new', '/menu', '/settings', '/help']);

    const restarted = new BotInterfaceService(value.transport, value.settings, new BotUiService());
    await restarted.initialize();
    assert.equal(value.transport.setups.length, 1);
    assert.deepEqual(value.transport.setups[0]!.menu.map((item) => item.command), ['/start', '/new', '/menu', '/settings', '/help']);
  } finally { value.database.close(); rmSync(value.root, { recursive: true, force: true }); }
});

test('does not persist or mark a layout change when transport update fails', async () => {
  const value = fixture();
  try {
    value.transport.updateError = new Error('network unavailable');
    const event = { id: 'layout-error', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'inline-action' as const, command: 'ui:layout:compact' };
    await assert.rejects(value.handler.handle(event), /network unavailable/);
    assert.equal(value.settings.uiMode(), 'expanded');
    value.transport.updateError = undefined;
    await value.handler.handle(event);
    assert.equal(value.settings.uiMode(), 'compact');
    assert.equal(value.transport.updates.length, 1);
  } finally { value.database.close(); rmSync(value.root, { recursive: true, force: true }); }
});

test('serializes concurrent layout changes and keeps the last selected mode', async () => {
  const value = fixture();
  try {
    await Promise.all([
      value.botInterface.apply('compact'),
      value.botInterface.apply('expanded'),
    ]);
    assert.equal(value.settings.uiMode(), 'expanded');
    assert.deepEqual(value.transport.updates.map((update) => update.menu[2]!.command), ['/menu', '/tasks']);
  } finally { value.database.close(); rmSync(value.root, { recursive: true, force: true }); }
});

test('opens settings from an inline command', async () => {
  const value = fixture();
  try {
    await value.handler.handle({ id: 'settings', userKey: 'telegram:1', chatKey: 'telegram:1', type: 'inline-action', command: '/settings' });
    assert.equal(value.transport.keyboards.length, 1);
    assert.deepEqual(value.transport.keyboards[0]!.keyboard.rows.map((row) => row[0]!.command), ['ui:layout:compact', 'ui:layout:expanded']);
  } finally { value.database.close(); rmSync(value.root, { recursive: true, force: true }); }
});

test('uses nested menus for task files and global actions', () => {
  const ui = new BotUiService();
  const expanded = ui.profile('expanded');
  const compact = ui.profile('compact');
  const allActions = expanded.replyKeyboard.rows[2]![0]!.children;
  assert.equal(allActions?.rows.length, 6);
  assert.notDeepEqual(expanded.menu, compact.menu);
  assert.notDeepEqual(expanded.replyKeyboard, compact.replyKeyboard);

  const card = ui.taskCard(
    { id: 1, userKey: 'telegram:1', chatKey: 'telegram:1', title: 'Проверить файлы', status: 'ACTIVE', createdAt: '2026-10-06T00:00:00.000Z' },
    [{ id: 'attachment-1', taskId: 1, originalName: 'очень-длинное-название-документа.pdf', mimeType: 'application/pdf', size: 1, storageKey: 'file' }],
  );
  const files = card.keyboard.rows[1]![0]!.children;
  assert.equal(files?.rows.length, 2);
  assert.match(files?.rows[1]![0]!.text ?? '', /очень-длинное-название-документа/);
});

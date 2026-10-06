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
import { BotUpdateHandler } from '../src/bot-update.handler.js';
import type { BotTransport, Button, Keyboard, OutgoingFile } from '../src/transport/types.js';

class TestTransport implements BotTransport {
  readonly texts: string[] = [];
  readonly files: OutgoingFile[] = [];
  readonly keyboards: Array<{ text?: string; keyboard: Keyboard }> = [];
  public async sendText(_chat: string, _operation: string, text: string): Promise<void> {
    this.texts.push(text);
  }
  public async sendKeyboard(
    _chat: string,
    _operation: string,
    keyboard: Keyboard,
    text?: string,
  ): Promise<void> {
    this.keyboards.push({ keyboard, text });
  }
  public async sendFile(_chat: string, _operation: string, file: OutgoingFile): Promise<void> {
    this.files.push(file);
  }
  public async configure(_menu: Button[], _keyboard: Keyboard): Promise<void> {}
}

function fixture(): {
  handler: BotUpdateHandler;
  repository: TasksRepository;
  transport: TestTransport;
  database: DatabaseService;
  root: string;
} {
  const root = mkdtempSync(join(tmpdir(), 'todo-bot-'));
  process.env.ELPH_API_URL = 'https://example.test';
  process.env.ELPH_BOT_TOKEN = 'token';
  process.env.ELPH_WEBHOOK_URL = 'https://example.test/webhooks/elph';
  process.env.ELPH_WEBHOOK_SECRET = 'secret';
  process.env.DATA_PATH = join(root, 'todo.sqlite');
  process.env.FILE_STORAGE_PATH = join(root, 'storage');
  const database = new DatabaseService();
  const repository = new TasksRepository(database);
  const transport = new TestTransport();
  return {
    handler: new BotUpdateHandler(
      transport,
      repository,
      database,
      new ConversationService(),
      new FileStorageService(),
      new BotUiService(),
    ),
    repository,
    transport,
    database,
    root,
  };
}

test('creates a task once when the same title update is delivered twice', async () => {
  const value = fixture();
  try {
    await value.handler.handle({
      id: 'new',
      userKey: 'elph:1',
      chatKey: 'elph:1',
      type: 'message',
      text: '/new',
      attachments: [],
    });
    const title = {
      id: 'title',
      userKey: 'elph:1',
      chatKey: 'elph:1',
      type: 'message' as const,
      text: 'Проверить webhook',
      attachments: [],
    };
    await value.handler.handle(title);
    await value.handler.handle(title);
    assert.equal(value.repository.list('elph:1', 'ACTIVE').length, 1);
    assert.equal(value.transport.keyboards.length, 1);
    assert.match(value.transport.keyboards[0]!.text ?? '', /^Задача создана\./);
  } finally {
    value.database.close();
    rmSync(value.root, { recursive: true, force: true });
  }
});

test('keeps attachments and export scoped to the task owner', async () => {
  const value = fixture();
  try {
    await value.handler.handle({
      id: 'new',
      userKey: 'elph:1',
      chatKey: 'elph:1',
      type: 'message',
      text: '/new',
      attachments: [],
    });
    await value.handler.handle({
      id: 'title',
      userKey: 'elph:1',
      chatKey: 'elph:1',
      type: 'message',
      text: 'Отчёт',
      attachments: [],
    });
    const task = value.repository.list('elph:1', 'ACTIVE')[0]!;
    await value.handler.handle({
      id: 'attach',
      userKey: 'elph:1',
      chatKey: 'elph:1',
      type: 'inline-action',
      command: `task:${task.id}:attach`,
    });
    await value.handler.handle({
      id: 'file',
      userKey: 'elph:1',
      chatKey: 'elph:1',
      type: 'message',
      attachments: [
        {
          id: 'source',
          name: 'first.txt',
          mimeType: 'text/plain',
          download: async () => ({
            bytes: Buffer.from('one'),
            filename: 'first.txt',
            mimeType: 'text/plain',
          }),
        },
      ],
    });
    await value.handler.handle({
      id: 'attach-two',
      userKey: 'elph:1',
      chatKey: 'elph:1',
      type: 'inline-action',
      command: `task:${task.id}:attach`,
    });
    await value.handler.handle({
      id: 'file-two',
      userKey: 'elph:1',
      chatKey: 'elph:1',
      type: 'message',
      attachments: [
        {
          id: 'source-two',
          name: 'second.txt',
          mimeType: 'text/plain',
          download: async () => ({
            bytes: Buffer.from('two'),
            filename: 'second.txt',
            mimeType: 'text/plain',
          }),
        },
        {
          id: 'source-three',
          name: 'third.txt',
          mimeType: 'text/plain',
          download: async () => ({
            bytes: Buffer.from('three'),
            filename: 'third.txt',
            mimeType: 'text/plain',
          }),
        },
      ],
    });
    assert.equal(value.repository.attachments(task.id).length, 3);
    await value.handler.handle({
      id: 'foreign-download',
      userKey: 'elph:2',
      chatKey: 'elph:2',
      type: 'inline-action',
      command: `task:${task.id}:download:${value.repository.attachments(task.id)[0]!.id}`,
    });
    assert.equal(value.transport.files.length, 0);
    const attachment = value.repository.attachments(task.id)[0]!;
    await value.handler.handle({
      id: 'owner-download',
      userKey: 'elph:1',
      chatKey: 'elph:1',
      type: 'inline-action',
      command: `task:${task.id}:download:${attachment.id}`,
    });
    assert.equal(value.transport.files.length, 1);
    assert.equal(value.transport.files[0]!.filename, 'first.txt');
    await value.handler.handle({
      id: 'export',
      userKey: 'elph:1',
      chatKey: 'elph:1',
      type: 'message',
      text: '/export',
      attachments: [],
    });
    assert.equal(value.transport.files.length, 2);
    assert.match(Buffer.from(value.transport.files[1]!.bytes).toString(), /Отчёт/);
  } finally {
    value.database.close();
    rmSync(value.root, { recursive: true, force: true });
  }
});

test('marks fallback events as processed', async () => {
  const value = fixture();
  try {
    const fallback = {
      id: 'idle-text',
      userKey: 'elph:1',
      chatKey: 'elph:1',
      type: 'message' as const,
      text: 'Привет',
      attachments: [],
    };
    await value.handler.handle(fallback);
    await value.handler.handle(fallback);
    assert.equal(value.transport.texts.length, 1);
  } finally {
    value.database.close();
    rmSync(value.root, { recursive: true, force: true });
  }
});

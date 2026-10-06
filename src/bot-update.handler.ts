import { Injectable, Inject } from '@nestjs/common';
import { BOT_TRANSPORT, type BotTransport, type IncomingAttachment, type IncomingBotEvent } from './transport/types.js';
import { TasksRepository } from './tasks/tasks.repository.js';
import { DatabaseService } from './database.service.js';
import { ConversationService } from './conversation.service.js';
import { FileStorageService } from './file-storage.service.js';
import { BotUiService } from './bot-ui.service.js';
import { BotInterfaceService } from './bot-interface.service.js';
import type { TaskAttachment } from './tasks/task.types.js';

@Injectable()
export class BotUpdateHandler {
  public constructor(
    @Inject(BOT_TRANSPORT) private readonly transport: BotTransport,
    private readonly repository: TasksRepository,
    private readonly database: DatabaseService,
    private readonly conversation: ConversationService,
    private readonly storage: FileStorageService,
    private readonly ui: BotUiService,
    private readonly botInterface: BotInterfaceService,
  ) {}

  public async handle(event: IncomingBotEvent): Promise<void> {
    if (this.repository.isProcessed(event.id)) return;
    if (event.type === 'inline-action') return this.handleInline(event);
    if (event.attachments.length) return this.handleAttachments(event, event.attachments);
    if (event.text !== undefined) return this.handleText(event, event.text);
    this.mark(event.id);
    await this.reply(event, 'Я не смог обработать это сообщение.');
  }
  private async handleText(event: Extract<IncomingBotEvent, { type: 'message' }>, text: string): Promise<void> {
    const command = text.trim();
    if (command.startsWith('/')) return this.command(event, command);
    const state = this.conversation.get(event.userKey, event.chatKey);
    if (state.type !== 'AWAITING_TASK_TITLE') {
      this.mark(event.id);
      await this.reply(event, 'Я не жду сейчас текст задачи.\n\nЧтобы создать задачу, используй /new или кнопку «➕ Новая задача».');
      return;
    }
    if (!command) { this.mark(event.id); await this.reply(event, 'Не получилось создать задачу: название не должно быть пустым.'); return; }
    const task = this.database.transaction(() => { const created = this.repository.create(event.userKey, event.chatKey, command); this.repository.markProcessed(event.id); return created; });
    this.conversation.clear(event.userKey, event.chatKey);
    await this.showTask(event.chatKey, event.id, task.id, event.userKey, true);
  }
  private async command(
    event: Pick<IncomingBotEvent, 'id' | 'userKey' | 'chatKey'>,
    command: string,
  ): Promise<void> {
    if (command === '/start') { this.mark(event.id); await this.reply(event, 'Привет! Я ToDo Bot.\n\nЯ сохраняю задачи и файлы, показываю активные и выполненные задачи. Создай задачу командой /new или кнопкой «➕ Новая задача».'); return; }
    if (command === '/new') { this.mark(event.id); this.conversation.set(event.userKey, event.chatKey, { type: 'AWAITING_TASK_TITLE' }); await this.reply(event, 'Напиши название новой задачи.'); return; }
    if (command === '/tasks') { this.mark(event.id); await this.showList(event, 'ACTIVE'); return; }
    if (command === '/done') { this.mark(event.id); await this.showList(event, 'DONE'); return; }
    if (command === '/menu') {
      this.mark(event.id);
      await this.transport.sendKeyboard(event.chatKey, `${event.id}:menu`, this.ui.allActions(), 'Все действия:');
      return;
    }
    if (command === '/settings') {
      this.mark(event.id);
      await this.transport.sendKeyboard(event.chatKey, `${event.id}:settings`, this.ui.settings(), 'Выбери вид меню:');
      return;
    }
    if (command === '/help') { this.mark(event.id); await this.reply(event, 'ToDo Bot\n\n/new — создать задачу\n/tasks — показать активные задачи\n/done — показать выполненные задачи\n/export — экспортировать задачи\n/menu — все действия\n/settings — настроить вид меню\n/help — помощь\n\nНастройка вида меню применяется ко всему экземпляру бота.'); return; }
    if (command === '/export') { this.mark(event.id); const tasks = this.repository.list(event.userKey, 'ACTIVE').concat(this.repository.list(event.userKey, 'DONE')); const bytes = Buffer.from(JSON.stringify({ tasks }, null, 2)); await this.transport.sendFile(event.chatKey, `${event.id}:export`, { filename: 'todo-export.json', mimeType: 'application/json', bytes, caption: 'Экспорт задач готов.' }); return; }
    this.mark(event.id); await this.reply(event, 'Неизвестная команда.\n\nИспользуй /help, чтобы посмотреть доступные команды.');
  }
  private async handleInline(event: Extract<IncomingBotEvent, { type: 'inline-action' }>): Promise<void> {
    if (event.command.startsWith('/')) return this.command(event, event.command);
    const layout = /^ui:layout:(compact|expanded)$/.exec(event.command);
    if (layout) {
      await this.botInterface.apply(layout[1] as 'compact' | 'expanded');
      this.mark(event.id);
      await this.reply(event, `Вид меню изменён на ${layout[1] === 'compact' ? 'компактный' : 'расширенный'} для этого экземпляра бота.`);
      return;
    }
    if (event.command === 'task:new') { this.mark(event.id); this.conversation.set(event.userKey, event.chatKey, { type: 'AWAITING_TASK_TITLE' }); await this.reply(event, 'Напиши название новой задачи.'); return; }
    if (event.command === 'tasks:refresh') { this.mark(event.id); await this.showList(event, 'ACTIVE'); return; }
    if (event.command === 'tasks:done') { this.mark(event.id); await this.showList(event, 'DONE'); return; }
    const download = /^task:(\d+):download:([\w-]+)$/.exec(event.command);
    if (download) return this.download(event, Number(download[1]), download[2]!);
    const match = /^task:(\d+):(open|complete|delete|attach)$/.exec(event.command);
    if (!match) { this.mark(event.id); await this.reply(event, 'Неизвестное действие.'); return; }
    const taskId = Number(match[1]); const action = match[2];
    if (action === 'open') { this.mark(event.id); return this.showTask(event.chatKey, event.id, taskId, event.userKey); }
    if (action === 'attach') { if (!this.repository.getOwned(taskId, event.userKey)) { this.mark(event.id); await this.reply(event, 'Задача больше не существует.'); return; } this.mark(event.id); this.conversation.set(event.userKey, event.chatKey, { type: 'AWAITING_TASK_ATTACHMENT', taskId }); await this.reply(event, 'Отправь файл, который нужно прикрепить к задаче.'); return; }
    if (action === 'complete') { const task = this.database.transaction(() => { const value = this.repository.complete(taskId, event.userKey); this.repository.markProcessed(event.id); return value; }); if (!task) { await this.reply(event, 'Задача больше не существует.'); return; } await this.reply(event, `Задача выполнена:\n\n${task.title}`); return; }
    const deleted = this.database.transaction(() => { const value = this.repository.delete(taskId, event.userKey); this.repository.markProcessed(event.id); return value; });
    await this.reply(event, deleted ? 'Задача удалена.' : 'Задача больше не существует.');
  }
  private async handleAttachments(event: Extract<IncomingBotEvent, { type: 'message' }>, attachments: IncomingAttachment[]): Promise<void> {
    const state = this.conversation.get(event.userKey, event.chatKey);
    if (state.type !== 'AWAITING_TASK_ATTACHMENT') { this.mark(event.id); await this.reply(event, 'Сейчас я не ожидаю файл.\n\nОткрой задачу и нажми «📎 Прикрепить файл».'); return; }
    if (!this.repository.getOwned(state.taskId, event.userKey)) { this.conversation.clear(event.userKey, event.chatKey); this.mark(event.id); await this.reply(event, 'Задача больше не существует.'); return; }
    try {
      const saved: TaskAttachment[] = [];
      for (const attachment of attachments) saved.push(this.storage.save(state.taskId, await attachment.download()));
      this.database.transaction(() => { for (const attachment of saved) this.repository.addAttachment(state.taskId, attachment); this.repository.markProcessed(event.id); });
      this.conversation.clear(event.userKey, event.chatKey);
      await this.reply(event, `${saved.length === 1 ? 'Файл' : 'Файлы'} ${saved.map((attachment) => attachment.originalName).join(', ')} ${saved.length === 1 ? 'прикреплён' : 'прикреплены'} к задаче #${state.taskId}.`);
      await this.showTask(event.chatKey, `${event.id}:card`, state.taskId, event.userKey);
    } catch { await this.reply(event, 'Не удалось сохранить файл. Попробуй отправить его ещё раз.'); }
  }
  private async download(event: Extract<IncomingBotEvent, { type: 'inline-action' }>, taskId: number, attachmentId: string): Promise<void> { const attachment = this.repository.attachmentOwned(attachmentId, taskId, event.userKey); this.mark(event.id); if (!attachment) { await this.reply(event, 'Файл или задача больше не существуют.'); return; } await this.transport.sendFile(event.chatKey, `${event.id}:file`, { filename: attachment.originalName, mimeType: attachment.mimeType, bytes: this.storage.read(attachment), caption: `Файл из задачи #${taskId}` }); }
  private async showList(event: { id: string; userKey: string; chatKey: string }, status: 'ACTIVE' | 'DONE'): Promise<void> { const tasks = this.repository.list(event.userKey, status); if (!tasks.length) { await this.reply(event, status === 'ACTIVE' ? 'Активных задач пока нет.' : 'Выполненных задач пока нет.'); return; } const heading = status === 'ACTIVE' ? 'Активные задачи:' : 'Выполненные задачи:'; await this.reply(event, `${heading}\n\n${tasks.map((task) => `#${task.id} ${task.title}`).join('\n')}`); await this.transport.sendKeyboard(event.chatKey, `${event.id}:select`, this.ui.selection(tasks), 'Выбери задачу:'); await this.transport.sendKeyboard(event.chatKey, `${event.id}:actions`, this.ui.listActions()); }
  private async showTask(chatKey: string, eventId: string, taskId: number, userKey: string, created = false): Promise<void> { const task = this.repository.getOwned(taskId, userKey); if (!task) { await this.transport.sendText(chatKey, `${eventId}:missing`, 'Задача больше не существует.'); return; } const card = this.ui.taskCard(task, this.repository.attachments(taskId)); await this.transport.sendKeyboard(chatKey, `${eventId}:card`, card.keyboard, created ? `Задача создана.\n\n${card.text}` : card.text); }
  private mark(id: string): void { this.database.transaction(() => this.repository.markProcessed(id)); }
  private reply(event: { id: string; chatKey: string }, text: string): Promise<void> { return this.transport.sendText(event.chatKey, `${event.id}:reply`, text); }
}

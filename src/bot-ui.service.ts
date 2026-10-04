import { Injectable } from '@nestjs/common';
import type { Keyboard, Button } from './transport/types.js';
import type { Task, TaskAttachment } from './tasks/task.types.js';

@Injectable()
export class BotUiService {
  readonly menu: Button[] = [
    { command: '/start', text: 'Запустить бота' }, { command: '/new', text: 'Создать задачу' },
    { command: '/tasks', text: 'Активные задачи' }, { command: '/done', text: 'Выполненные задачи' },
    { command: '/export', text: 'Экспорт задач' }, { command: '/help', text: 'Помощь' },
  ];
  readonly replyKeyboard: Keyboard = { rows: [
    [{ text: '➕ Новая задача', command: '/new' }, { text: '📋 Мои задачи', command: '/tasks' }],
    [{ text: '✅ Выполненные', command: '/done' }, { text: 'ℹ️ Помощь', command: '/help' }],
  ] };
  taskCard(task: Task, attachments: TaskAttachment[]): { text: string; keyboard: Keyboard } {
    const lines = [`Задача #${task.id}`, '', task.title, '', `Статус: ${task.status === 'ACTIVE' ? 'активна' : 'выполнена'}`];
    if (attachments.length) lines.push('', ...attachments.map((item) => `📎 ${item.originalName}`));
    const rows: Button[][] = [];
    if (task.status === 'ACTIVE') rows.push([{ text: '✅ Выполнить', command: `task:${task.id}:complete` }, { text: '📎 Прикрепить файл', command: `task:${task.id}:attach` }]);
    else rows.push([{ text: '📎 Прикрепить файл', command: `task:${task.id}:attach` }]);
    for (const attachment of attachments) rows.push([{ text: `📥 ${attachment.originalName}`, command: `task:${task.id}:download:${attachment.id}` }]);
    rows.push([{ text: '🗑 Удалить', command: `task:${task.id}:delete` }]);
    return { text: lines.join('\n'), keyboard: { rows } };
  }
  selection(tasks: Task[]): Keyboard { return { rows: tasks.map((task) => [{ text: `#${task.id} ${task.title}`, command: `task:${task.id}:open` }]) }; }
  listActions(): Keyboard { return { rows: [[{ text: '🔄 Обновить', command: 'tasks:refresh' }, { text: '➕ Новая задача', command: 'task:new' }], [{ text: '✅ Выполненные', command: 'tasks:done' }]] }; }
}

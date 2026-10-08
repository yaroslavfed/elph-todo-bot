import { Injectable } from '@nestjs/common';
import type { CommandButton, Keyboard, KeyboardButton } from './transport/types.js';
import type { Task, TaskAttachment } from './tasks/task.types.js';

export type UiMode = 'expanded' | 'compact';

export interface BotUiProfile {
  menu: CommandButton[];
  replyKeyboard: Keyboard;
}

@Injectable()
export class BotUiService {
  public profile(mode: UiMode): BotUiProfile {
    return mode === 'compact' ? this.compactProfile() : this.expandedProfile();
  }

  public settings(): Keyboard {
    return {
      rows: [
        [{ text: 'Компактное меню', command: 'ui:layout:compact' }],
        [{ text: 'Расширенное меню', command: 'ui:layout:expanded' }],
      ],
    };
  }

  public allActions(): Keyboard {
    return this.allActionsButton().children!;
  }

  public taskCard(task: Task, attachments: TaskAttachment[]): { text: string; keyboard: Keyboard } {
    const lines = [
      `Задача #${task.id}`,
      '',
      task.title,
      '',
      `Статус: ${task.status === 'ACTIVE' ? 'активна' : 'выполнена'}`,
    ];
    if (attachments.length) lines.push('', ...attachments.map((item) => `📎 ${item.originalName}`));
    const rows: KeyboardButton[][] = [];
    if (task.status === 'ACTIVE') rows.push([{ text: '✅ Выполнить', command: `task:${task.id}:complete` }]);
    rows.push([this.filesButton(task.id, attachments)]);
    rows.push([{ text: '🗑 Удалить', command: `task:${task.id}:delete` }]);
    return { text: lines.join('\n'), keyboard: { rows } };
  }

  public selection(tasks: Task[]): Keyboard {
    return {
      rows: tasks.map((task) => [{ text: `#${task.id} ${task.title}`, command: `task:${task.id}:open` }]),
    };
  }

  public listActions(): Keyboard {
    return {
      rows: [
        [
          {
            text: '📋 Просмотр задач',
            command: '/tasks',
            children: {
              rows: [
                [{ text: '📋 Активные задачи', command: '/tasks' }],
                [{ text: '✅ Выполненные задачи', command: '/done' }],
                [{ text: '🔄 Обновить активные задачи', command: 'tasks:refresh' }],
              ],
            },
          },
        ],
        [{ text: '➕ Новая задача', command: 'task:new' }],
      ],
    };
  }

  private expandedProfile(): BotUiProfile {
    return {
      menu: [
        { command: '/start', text: 'Запустить бота' },
        { command: '/new', text: 'Создать задачу' },
        { command: '/tasks', text: 'Активные задачи' },
        { command: '/done', text: 'Выполненные задачи' },
        { command: '/export', text: 'Экспорт задач' },
        { command: '/settings', text: 'Настроить вид меню' },
        { command: '/help', text: 'Помощь' },
      ],
      replyKeyboard: {
        rows: [
          [
            { text: '➕ Новая задача', command: '/new' },
            { text: '📋 Мои задачи', command: '/tasks' },
          ],
          [
            { text: '✅ Выполненные', command: '/done' },
            { text: '📤 Экспорт', command: '/export' },
          ],
          [this.allActionsButton()],
          [{ text: 'ℹ️ Помощь', command: '/help' }],
        ],
      },
    };
  }

  private compactProfile(): BotUiProfile {
    return {
      menu: [
        { command: '/start', text: 'Запустить бота' },
        { command: '/new', text: 'Создать задачу' },
        { command: '/menu', text: 'Все действия' },
        { command: '/settings', text: 'Настроить вид меню' },
        { command: '/help', text: 'Помощь' },
      ],
      replyKeyboard: {
        rows: [
          [{ text: '➕ Новая задача', command: '/new' }],
          [this.allActionsButton()],
        ],
      },
    };
  }

  private allActionsButton(): KeyboardButton {
    return {
      text: '☰ Все действия',
      command: '',
      children: {
        rows: [
          [{ text: '➕ Создать новую задачу', command: '/new' }],
          [{ text: '📋 Показать активные задачи', command: '/tasks' }],
          [{ text: '✅ Показать выполненные задачи', command: '/done' }],
          [{ text: '📤 Экспортировать все задачи в JSON', command: '/export' }],
          [{ text: '⚙️ Настроить вид меню', command: '/settings' }],
          [{ text: 'ℹ️ Помощь по работе с ToDo Bot', command: '/help' }],
        ],
      },
    };
  }

  private filesButton(taskId: number, attachments: TaskAttachment[]): KeyboardButton {
    return {
      text: '📎 Файлы',
      command: `task:${taskId}:attach`,
      children: {
        rows: [
          [{ text: '📎 Прикрепить новый файл', command: `task:${taskId}:attach` }],
          ...attachments.map((attachment) => [
            { text: `📥 Скачать ${attachment.originalName}`, command: `task:${taskId}:download:${attachment.id}` },
          ]),
        ],
      },
    };
  }
}

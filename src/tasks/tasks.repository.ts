import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service.js';
import type { Task, TaskAttachment, TaskStatus } from './task.types.js';

interface TaskRow {
  id: number;
  user_key: string;
  chat_key: string;
  title: string;
  status: TaskStatus;
  created_at: string;
  completed_at: string | null;
}
interface AttachmentRow {
  id: string;
  task_id: number;
  original_name: string;
  mime_type: string;
  size: number;
  storage_key: string;
}

@Injectable()
export class TasksRepository {
  public constructor(private readonly database: DatabaseService) {}
  public isProcessed(id: string): boolean {
    return Boolean(
      this.database.database.prepare('SELECT 1 FROM processed_events WHERE id = ?').get(id),
    );
  }
  public markProcessed(id: string): void {
    this.database.database
      .prepare('INSERT INTO processed_events (id, processed_at) VALUES (?, ?)')
      .run(id, new Date().toISOString());
  }
  public create(userKey: string, chatKey: string, title: string): Task {
    const createdAt = new Date().toISOString();
    const result = this.database.database
      .prepare(
        'INSERT INTO tasks (user_key, chat_key, title, status, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(userKey, chatKey, title, 'ACTIVE', createdAt);
    return {
      id: Number(result.lastInsertRowid),
      userKey,
      chatKey,
      title,
      status: 'ACTIVE',
      createdAt,
    };
  }
  public getOwned(id: number, userKey: string): Task | undefined {
    return this.mapTask(
      this.database.database
        .prepare('SELECT * FROM tasks WHERE id = ? AND user_key = ?')
        .get(id, userKey) as TaskRow | undefined,
    );
  }
  public list(userKey: string, status: TaskStatus): Task[] {
    return (
      this.database.database
        .prepare('SELECT * FROM tasks WHERE user_key = ? AND status = ? ORDER BY id DESC')
        .all(userKey, status) as unknown as TaskRow[]
    ).map((row) => this.mapTask(row)!);
  }
  public complete(id: number, userKey: string): Task | undefined {
    const task = this.getOwned(id, userKey);
    if (!task) return undefined;
    if (task.status === 'DONE') return task;
    const completedAt = new Date().toISOString();
    this.database.database
      .prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?')
      .run('DONE', completedAt, id);
    return { ...task, status: 'DONE', completedAt };
  }
  public delete(id: number, userKey: string): boolean {
    return (
      Number(
        this.database.database
          .prepare('DELETE FROM tasks WHERE id = ? AND user_key = ?')
          .run(id, userKey).changes,
      ) === 1
    );
  }
  public addAttachment(taskId: number, attachment: TaskAttachment): void {
    this.database.database
      .prepare(
        'INSERT INTO task_attachments (id, task_id, original_name, mime_type, size, storage_key) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        attachment.id,
        taskId,
        attachment.originalName,
        attachment.mimeType,
        attachment.size,
        attachment.storageKey,
      );
  }
  public attachments(taskId: number): TaskAttachment[] {
    return (
      this.database.database
        .prepare('SELECT * FROM task_attachments WHERE task_id = ? ORDER BY rowid')
        .all(taskId) as unknown as AttachmentRow[]
    ).map((row) => this.mapAttachment(row)!);
  }
  public attachmentOwned(id: string, taskId: number, userKey: string): TaskAttachment | undefined {
    if (!this.getOwned(taskId, userKey)) return undefined;
    return this.mapAttachment(
      this.database.database
        .prepare('SELECT * FROM task_attachments WHERE id = ? AND task_id = ?')
        .get(id, taskId) as AttachmentRow | undefined,
    );
  }
  private mapTask(row: TaskRow | undefined): Task | undefined {
    return (
      row && {
        id: row.id,
        userKey: row.user_key,
        chatKey: row.chat_key,
        title: row.title,
        status: row.status,
        createdAt: row.created_at,
        ...(row.completed_at ? { completedAt: row.completed_at } : {}),
      }
    );
  }
  private mapAttachment = (row: AttachmentRow | undefined): TaskAttachment | undefined =>
    row && {
      id: row.id,
      taskId: row.task_id,
      originalName: row.original_name,
      mimeType: row.mime_type,
      size: row.size,
      storageKey: row.storage_key,
    };
}

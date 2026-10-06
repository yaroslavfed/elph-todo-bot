import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { readConfig } from './config.js';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly database: DatabaseSync;
  public constructor() {
    const path = readConfig().databasePath;
    mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path, { enableForeignKeyConstraints: true, timeout: 5_000 });
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY, user_key TEXT NOT NULL, chat_key TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT);
      CREATE TABLE IF NOT EXISTS task_attachments (id TEXT PRIMARY KEY, task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE, original_name TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, storage_key TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS processed_events (id TEXT PRIMARY KEY, processed_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS tasks_user_status ON tasks(user_key, status, id);
    `);
  }
  public transaction<T>(action: () => T): T {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
  public onApplicationShutdown(): void {
    this.close();
  }
  public close(): void {
    if (this.database.isOpen) this.database.close();
  }
}

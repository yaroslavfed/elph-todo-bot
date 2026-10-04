import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { readConfig } from './config.js';
import type { DownloadedAttachment } from './transport/types.js';
import type { TaskAttachment } from './tasks/task.types.js';

@Injectable()
export class FileStorageService {
  private readonly root = readConfig().storagePath;
  public save(taskId: number, input: DownloadedAttachment): TaskAttachment {
    const id = randomUUID();
    const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'attachment';
    const storageKey = join(String(taskId), `${id}-${safeName}`);
    const target = join(this.root, storageKey);
    mkdirSync(dirname(target), { recursive: true });
    const temporary = `${target}.${randomUUID()}.tmp`;
    writeFileSync(temporary, input.bytes, { flag: 'wx' });
    renameSync(temporary, target);
    return { id, taskId, originalName: input.filename, mimeType: input.mimeType ?? 'application/octet-stream', size: input.bytes.byteLength, storageKey };
  }
  public read(attachment: TaskAttachment): Uint8Array { return readFileSync(join(this.root, attachment.storageKey)); }
}

import { Injectable } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import type { UiMode } from './bot-ui.service.js';

@Injectable()
export class BotSettingsRepository {
  public constructor(private readonly database: DatabaseService) {}

  public uiMode(): UiMode {
    const row = this.database.database
      .prepare("SELECT value FROM bot_settings WHERE key = 'ui_mode'")
      .get() as { value: string } | undefined;
    return row?.value === 'compact' ? 'compact' : 'expanded';
  }

  public setUiMode(mode: UiMode): void {
    this.database.database
      .prepare("INSERT INTO bot_settings (key, value) VALUES ('ui_mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(mode);
  }
}

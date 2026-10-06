import { Inject, Injectable } from '@nestjs/common';
import { BotSettingsRepository } from './bot-settings.repository.js';
import { BotUiService, type UiMode } from './bot-ui.service.js';
import { BOT_TRANSPORT, type BotTransport } from './transport/types.js';

@Injectable()
export class BotInterfaceService {
  private queue: Promise<void> = Promise.resolve();

  public constructor(
    @Inject(BOT_TRANSPORT) private readonly transport: BotTransport,
    private readonly settings: BotSettingsRepository,
    private readonly ui: BotUiService,
  ) {}

  public initialize(): Promise<void> {
    return this.enqueue(async () => {
      const profile = this.ui.profile(this.settings.uiMode());
      await this.transport.setup(profile.menu, profile.replyKeyboard);
    });
  }

  public apply(mode: UiMode): Promise<void> {
    return this.enqueue(async () => {
      const profile = this.ui.profile(mode);
      await this.transport.updateInterface(profile.menu, profile.replyKeyboard);
      this.settings.setUiMode(mode);
    });
  }

  private enqueue(action: () => Promise<void>): Promise<void> {
    const result = this.queue.then(action);
    this.queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

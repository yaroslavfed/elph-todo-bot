import { Injectable, OnApplicationBootstrap, Inject } from '@nestjs/common';
import { BOT_TRANSPORT, type BotTransport } from './transport/types.js';
import { BotUiService } from './bot-ui.service.js';

@Injectable()
export class BotSetupService implements OnApplicationBootstrap {
  public constructor(@Inject(BOT_TRANSPORT) private readonly transport: BotTransport, private readonly ui: BotUiService) {}
  public onApplicationBootstrap(): Promise<void> { return this.transport.configure(this.ui.menu, this.ui.replyKeyboard); }
}

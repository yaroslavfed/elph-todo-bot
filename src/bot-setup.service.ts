import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { BotInterfaceService } from './bot-interface.service.js';

@Injectable()
export class BotSetupService implements OnApplicationBootstrap {
  public constructor(private readonly botInterface: BotInterfaceService) {}
  public onApplicationBootstrap(): Promise<void> { return this.botInterface.initialize(); }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { BotUpdateHandler } from '../../bot-update.handler.js';
import { setIncomingReceiver } from '../incoming-bridge.js';

@Injectable()
export class ElphBridge implements OnModuleInit {
  public constructor(private readonly handler: BotUpdateHandler) {}
  public onModuleInit(): void {
    setIncomingReceiver((event) => this.handler.handle(event));
  }
}

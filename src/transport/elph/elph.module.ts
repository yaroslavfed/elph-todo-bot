import { Module } from '@nestjs/common';
import { ElphBotModule } from '@yaroslavfed/bot-sdk-nestjs';
import { readConfig } from '../../config.js';
import { BotUpdateHandler } from '../../bot-update.handler.js';
import { BOT_TRANSPORT } from '../types.js';
import { dispatchElphUpdate } from '../incoming-bridge.js';
import { ElphBotAdapter } from './elph.adapter.js';
import { ElphBridge } from './elph.bridge.js';

const environment = process.env;
@Module({
  imports: [ElphBotModule.register({ apiUrl: environment.ELPH_API_URL!, token: environment.ELPH_BOT_TOKEN!, webhookUrl: environment.ELPH_WEBHOOK_URL!, webhookSecret: environment.ELPH_WEBHOOK_SECRET!, onUpdate: dispatchElphUpdate })],
  providers: [ElphBotAdapter, ElphBridge, { provide: BOT_TRANSPORT, useExisting: ElphBotAdapter }, BotUpdateHandler],
  exports: [BOT_TRANSPORT],
})
export class ElphTransportModule { static readonly config = readConfig; }

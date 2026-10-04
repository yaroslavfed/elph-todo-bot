import { Module } from '@nestjs/common';
import { readConfig } from './config.js';
import { SharedModule } from './shared.module.js';
import { BotTransportModule } from './transport/bot-transport.module.js';
import { BotSetupService } from './bot-setup.service.js';

@Module({
  imports: [SharedModule, BotTransportModule.register(readConfig().platform)],
  providers: [BotSetupService],
})
export class AppModule {}

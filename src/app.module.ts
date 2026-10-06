import { Module } from '@nestjs/common';
import { SharedModule } from './shared.module.js';
import { ElphTransportModule } from './transport/elph/elph.module.js';
import { BotSetupService } from './bot-setup.service.js';

@Module({
  imports: [SharedModule, ElphTransportModule],
  providers: [BotSetupService],
})
export class AppModule {}

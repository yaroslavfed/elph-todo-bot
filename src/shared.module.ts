import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { TasksRepository } from './tasks/tasks.repository.js';
import { ConversationService } from './conversation.service.js';
import { FileStorageService } from './file-storage.service.js';
import { BotUiService } from './bot-ui.service.js';
import { BotSettingsRepository } from './bot-settings.repository.js';

@Global()
@Module({
  providers: [DatabaseService, TasksRepository, ConversationService, FileStorageService, BotUiService, BotSettingsRepository],
  exports: [DatabaseService, TasksRepository, ConversationService, FileStorageService, BotUiService, BotSettingsRepository],
})
export class SharedModule {}

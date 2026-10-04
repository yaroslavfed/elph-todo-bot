declare module '@yaroslavfed/bot-sdk' {
  export interface Attachment { id: string; name?: string; mimeType?: string; size?: number; downloadUrl?: string }
  export interface BotUpdate { updateId: string; chat: { id: string }; from: { id: string }; message?: { id: string; text?: string; attachments?: Attachment[] }; inlineCommand?: { sourceMessageId: string; commandId: string } }
}

declare module '@yaroslavfed/bot-sdk-nestjs' {
  import type { DynamicModule } from '@nestjs/common';
  import type { BotUpdate } from '@yaroslavfed/bot-sdk';
  export class ElphBotService {
    sendMessage(request: { chatId: string; requestId: string; text?: string; inlineKeyboard?: unknown }): Promise<unknown>;
    sendFile(request: { chatId: string; requestId: string; file: Blob; filename: string; caption?: string }): Promise<unknown>;
    setReplyKeyboard(value: unknown): Promise<unknown>;
    setMyCommands(value: unknown): Promise<unknown>;
  }
  export class ElphBotModule { static register(options: { apiUrl: string; token: string; webhookUrl: string; webhookSecret: string; onUpdate: (update: BotUpdate) => Promise<void> }): DynamicModule }
}

import { Injectable } from '@nestjs/common';
import { ElphBotService } from '@elph/bot-sdk-nestjs';
import type { BotTransport, Button, Keyboard, OutgoingFile } from '../types.js';

@Injectable()
export class ElphBotAdapter implements BotTransport {
  public constructor(private readonly bot: ElphBotService) {}
  public async sendText(chatKey: string, operationId: string, text: string): Promise<void> {
    await this.bot.sendMessage({ chatId: this.nativeId(chatKey), requestId: operationId, text });
  }
  public async sendKeyboard(
    chatKey: string,
    operationId: string,
    keyboard: Keyboard,
    text?: string,
  ): Promise<void> {
    await this.bot.sendMessage({
      chatId: this.nativeId(chatKey),
      requestId: operationId,
      ...(text ? { text } : {}),
      inlineKeyboard: { rows: keyboard.rows.map((row) => ({ buttons: row })) },
    });
  }
  public async sendFile(chatKey: string, operationId: string, file: OutgoingFile): Promise<void> {
    const bytes = file.bytes.buffer.slice(
      file.bytes.byteOffset,
      file.bytes.byteOffset + file.bytes.byteLength,
    ) as ArrayBuffer;
    await this.bot.sendFile({
      chatId: this.nativeId(chatKey),
      requestId: operationId,
      file: new Blob([bytes], { type: file.mimeType }),
      filename: file.filename,
      caption: file.caption,
    });
  }
  public async configure(menu: Button[], replyKeyboard: Keyboard): Promise<void> {
    await this.bot.setMyCommands({ buttons: menu });
    await this.bot.setReplyKeyboard({ rows: replyKeyboard.rows.map((buttons) => ({ buttons })) });
  }
  private nativeId(key: string): string {
    return key.replace(/^elph:/, '');
  }
}

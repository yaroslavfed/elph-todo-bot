import { Injectable } from '@nestjs/common';
import { ElphBotService } from '@elph/bot-sdk-nestjs';
import type { BotTransport, CommandButton, Keyboard, KeyboardButton, OutgoingFile } from '../types.js';

@Injectable()
export class ElphBotAdapter implements BotTransport {
  public constructor(private readonly bot: ElphBotService) {}
  public async sendText(chatKey: string, operationId: string, text: string): Promise<void> { await this.bot.sendMessage({ chatId: this.nativeId(chatKey), requestId: operationId, text }); }
  public async sendKeyboard(chatKey: string, operationId: string, keyboard: Keyboard, text?: string): Promise<void> { await this.bot.sendMessage({ chatId: this.nativeId(chatKey), requestId: operationId, ...(text ? { text } : {}), inlineKeyboard: toElphKeyboard(keyboard) }); }
  public async sendFile(chatKey: string, operationId: string, file: OutgoingFile): Promise<void> { const bytes = file.bytes.buffer.slice(file.bytes.byteOffset, file.bytes.byteOffset + file.bytes.byteLength) as ArrayBuffer; await this.bot.sendFile({ chatId: this.nativeId(chatKey), requestId: operationId, file: new Blob([bytes], { type: file.mimeType }), filename: file.filename, caption: file.caption }); }
  public setup(menu: CommandButton[], replyKeyboard: Keyboard): Promise<void> {
    return this.updateInterface(menu, replyKeyboard);
  }
  public async updateInterface(menu: CommandButton[], replyKeyboard: Keyboard): Promise<void> {
    await this.bot.setMyCommands({ buttons: menu });
    await this.bot.setReplyKeyboard(toElphKeyboard(replyKeyboard));
  }
  private nativeId(key: string): string { return key.replace(/^elph:/, ''); }
}

interface ElphKeyboard { rows: ElphKeyboardRow[] }
interface ElphKeyboardRow { buttons: ElphKeyboardButton[] }
interface ElphKeyboardButton extends CommandButton { children?: ElphKeyboard }

function toElphKeyboard(keyboard: Keyboard): ElphKeyboard {
  return {
    rows: keyboard.rows.map((buttons) => ({ buttons: buttons.map(toElphButton) })),
  };
}

function toElphButton(button: KeyboardButton): ElphKeyboardButton {
  return {
    text: button.text,
    command: button.command,
    ...(button.children ? { children: toElphKeyboard(button.children) } : {}),
  };
}

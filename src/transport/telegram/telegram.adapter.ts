import { Injectable, type OnModuleInit } from '@nestjs/common';
import { Bot, InputFile } from 'grammy';
import type { Update } from 'grammy/types';
import type { BotTransport, CommandButton, Keyboard, KeyboardButton, OutgoingFile } from '../types.js';
import { dispatchTelegramUpdate } from '../incoming-bridge.js';

@Injectable()
export class TelegramBotAdapter implements BotTransport, OnModuleInit {
  private readonly bot: Bot;
  public constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    this.bot = new Bot(token);
    this.bot.use(async (context) => { await dispatchTelegramUpdate(context.update, (fileId, filename, mimeType) => this.download(fileId, filename, mimeType), (text) => this.replyCommands.get(text ?? '') ?? text); });
  }
  public onModuleInit(): Promise<void> { return this.bot.init(); }
  public async handle(update: Update, secret: string | undefined): Promise<void> {
    if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) throw new Error('Telegram webhook secret is invalid');
    await this.bot.handleUpdate(update);
  }
  public async registerWebhook(): Promise<void> { await this.bot.api.setWebhook(process.env.TELEGRAM_WEBHOOK_URL!, { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET! }); }
  public async sendText(chatKey: string, _operationId: string, text: string): Promise<void> { await this.bot.api.sendMessage(this.nativeId(chatKey), text, this.replyMarkup()); }
  public async sendKeyboard(chatKey: string, _operationId: string, keyboard: Keyboard, text?: string): Promise<void> {
    const flattened = flattenKeyboard(keyboard);
    await this.bot.api.sendMessage(this.nativeId(chatKey), text ?? 'Действия:', {
      reply_markup: {
        inline_keyboard: flattened.rows.map((row) => row.map((button) => ({ text: button.text, callback_data: button.command }))),
      },
    });
  }
  public async sendFile(chatKey: string, _operationId: string, file: OutgoingFile): Promise<void> { await this.bot.api.sendDocument(this.nativeId(chatKey), new InputFile(file.bytes, file.filename), { caption: file.caption }); }
  public async setup(menu: CommandButton[], replyKeyboard: Keyboard): Promise<void> {
    await this.updateInterface(menu, replyKeyboard);
    await this.registerWebhook();
  }
  public async updateInterface(menu: CommandButton[], replyKeyboard: Keyboard): Promise<void> {
    await this.bot.api.setMyCommands(menu.map((item) => ({ command: item.command.slice(1), description: item.text })));
    this.replyKeyboard = flattenKeyboard(replyKeyboard);
    this.replyCommands = new Map(this.replyKeyboard.rows.flat().map((button) => [button.text, button.command]));
  }
  private replyKeyboard: Keyboard | undefined;
  private replyCommands = new Map<string, string>();
  private replyMarkup(): { reply_markup?: { keyboard: string[][]; resize_keyboard: true } } { return this.replyKeyboard ? { reply_markup: { keyboard: this.replyKeyboard.rows.map((row) => row.map((button) => button.text)), resize_keyboard: true } } : {}; }
  private nativeId(key: string): string { return key.replace(/^telegram:/, ''); }
  private async download(fileId: string, _filename: string, _mimeType?: string): Promise<Uint8Array> { const file = await this.bot.api.getFile(fileId); if (!file.file_path) throw new Error('Telegram did not return file path'); const response = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`); if (!response.ok) throw new Error(`Telegram attachment download failed with ${response.status}`); return new Uint8Array(await response.arrayBuffer()); }
}

function flattenKeyboard(keyboard: Keyboard): Keyboard {
  return {
    rows: keyboard.rows.flatMap((row) => {
      if (row.every((button) => !button.children)) return [row.map(withoutChildren)];
      return row.flatMap((button) => button.children ? flattenKeyboard(button.children).rows : [[withoutChildren(button)]]);
    }),
  };
}

function withoutChildren(button: KeyboardButton): KeyboardButton {
  return { text: button.text, command: button.command };
}

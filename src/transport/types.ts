export interface CommandButton { text: string; command: string }
export interface KeyboardButton extends CommandButton { children?: Keyboard }
export interface Keyboard { rows: KeyboardButton[][] }

export interface DownloadedAttachment { bytes: Uint8Array; filename: string; mimeType?: string }
export interface IncomingAttachment { id: string; name: string; mimeType?: string; size?: number; download: () => Promise<DownloadedAttachment> }

export type IncomingBotEvent =
  | { id: string; userKey: string; chatKey: string; type: 'message'; text?: string; attachments: IncomingAttachment[] }
  | { id: string; userKey: string; chatKey: string; type: 'inline-action'; command: string };

export interface OutgoingFile { filename: string; mimeType: string; bytes: Uint8Array; caption?: string }
export interface BotTransport {
  sendText(chatKey: string, operationId: string, text: string): Promise<void>;
  sendKeyboard(chatKey: string, operationId: string, keyboard: Keyboard, text?: string): Promise<void>;
  sendFile(chatKey: string, operationId: string, file: OutgoingFile): Promise<void>;
  setup(menu: CommandButton[], replyKeyboard: Keyboard): Promise<void>;
  updateInterface(menu: CommandButton[], replyKeyboard: Keyboard): Promise<void>;
}

export const BOT_TRANSPORT = Symbol('BOT_TRANSPORT');

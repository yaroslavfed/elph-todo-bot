import type { BotUpdate as ElphUpdate } from '@elph/bot-sdk';
import type { Update as TelegramUpdate } from 'grammy/types';
import type { IncomingBotEvent } from './types.js';

let receiver: ((event: IncomingBotEvent) => Promise<void>) | undefined;
export function setIncomingReceiver(value: (event: IncomingBotEvent) => Promise<void>): void { receiver = value; }
export function dispatchIncoming(event: IncomingBotEvent): Promise<void> { if (!receiver) throw new Error('Incoming bot receiver is not initialized'); return receiver(event); }

export async function dispatchElphUpdate(update: ElphUpdate): Promise<void> {
  const userKey = `elph:${update.from.id}`; const chatKey = `elph:${update.chat.id}`;
  if (update.inlineCommand) return dispatchIncoming({ id: update.updateId, userKey, chatKey, type: 'inline-action', command: update.inlineCommand.commandId });
  const message = update.message!;
  const attachments = (message.attachments ?? []).map((item) => ({
    id: item.id, name: item.name ?? 'attachment', mimeType: item.mimeType, size: item.size,
    download: async () => {
      if (!item.downloadUrl) throw new Error('ELPh attachment has no download URL');
      const response = await fetch(item.downloadUrl); if (!response.ok) throw new Error(`ELPh attachment download failed with ${response.status}`);
      return { bytes: new Uint8Array(await response.arrayBuffer()), filename: item.name ?? 'attachment', mimeType: item.mimeType };
    },
  }));
  return dispatchIncoming({ id: update.updateId, userKey, chatKey, type: 'message', text: message.text, attachments });
}

export async function dispatchTelegramUpdate(update: TelegramUpdate, download: (fileId: string, filename: string, mimeType?: string) => Promise<Uint8Array>, mapReplyText: (text: string | undefined) => string | undefined): Promise<void> {
  const message = update.message;
  if (message?.from && message.chat) {
    const document = message.document;
    return dispatchIncoming({ id: String(update.update_id), userKey: `telegram:${message.from.id}`, chatKey: `telegram:${message.chat.id}`, type: 'message', text: mapReplyText(message.text), attachments: document ? [{ id: document.file_id, name: document.file_name ?? 'attachment', mimeType: document.mime_type, size: document.file_size, download: async () => ({ bytes: await download(document.file_id, document.file_name ?? 'attachment', document.mime_type), filename: document.file_name ?? 'attachment', mimeType: document.mime_type }) }] : [] });
  }
  const callback = update.callback_query;
  if (callback?.from && callback.message && 'chat' in callback.message && callback.data) return dispatchIncoming({ id: String(update.update_id), userKey: `telegram:${callback.from.id}`, chatKey: `telegram:${callback.message.chat.id}`, type: 'inline-action', command: callback.data });
}

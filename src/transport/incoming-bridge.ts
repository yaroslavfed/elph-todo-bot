import type { BotUpdate as ElphUpdate } from '@elph/bot-sdk';
import type { IncomingBotEvent } from './types.js';

let receiver: ((event: IncomingBotEvent) => Promise<void>) | undefined;
export function setIncomingReceiver(value: (event: IncomingBotEvent) => Promise<void>): void {
  receiver = value;
}
export function dispatchIncoming(event: IncomingBotEvent): Promise<void> {
  if (!receiver) throw new Error('Incoming bot receiver is not initialized');
  return receiver(event);
}

export async function dispatchElphUpdate(update: ElphUpdate): Promise<void> {
  const userKey = `elph:${update.from.id}`;
  const chatKey = `elph:${update.chat.id}`;
  if (update.inlineCommand)
    return dispatchIncoming({
      id: update.updateId,
      userKey,
      chatKey,
      type: 'inline-action',
      command: update.inlineCommand.commandId,
    });
  const message = update.message!;
  const attachments = (message.attachments ?? []).map((item) => ({
    id: item.id,
    name: item.name ?? 'attachment',
    mimeType: item.mimeType,
    size: item.size,
    download: async () => {
      if (!item.downloadUrl) throw new Error('ELPh attachment has no download URL');
      const response = await fetch(item.downloadUrl);
      if (!response.ok) throw new Error(`ELPh attachment download failed with ${response.status}`);
      return {
        bytes: new Uint8Array(await response.arrayBuffer()),
        filename: item.name ?? 'attachment',
        mimeType: item.mimeType,
      };
    },
  }));
  return dispatchIncoming({
    id: update.updateId,
    userKey,
    chatKey,
    type: 'message',
    text: message.text,
    attachments,
  });
}

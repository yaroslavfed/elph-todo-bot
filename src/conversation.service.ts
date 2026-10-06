import { Injectable } from '@nestjs/common';

export type ConversationState =
  | { type: 'IDLE' }
  | { type: 'AWAITING_TASK_TITLE' }
  | { type: 'AWAITING_TASK_ATTACHMENT'; taskId: number };

@Injectable()
export class ConversationService {
  private readonly states = new Map<string, ConversationState>();
  public get(userKey: string, chatKey: string): ConversationState {
    return this.states.get(`${userKey}:${chatKey}`) ?? { type: 'IDLE' };
  }
  public set(userKey: string, chatKey: string, state: ConversationState): void {
    this.states.set(`${userKey}:${chatKey}`, state);
  }
  public clear(userKey: string, chatKey: string): void {
    this.states.delete(`${userKey}:${chatKey}`);
  }
}

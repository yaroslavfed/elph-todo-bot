import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../src/config.js';

test('rejects a Telegram webhook secret with unsupported characters', () => {
  const environment: NodeJS.ProcessEnv = {
    BOT_PLATFORM: 'telegram',
    TELEGRAM_BOT_TOKEN: 'token',
    TELEGRAM_WEBHOOK_URL: 'https://example.test/webhooks/telegram',
    TELEGRAM_WEBHOOK_SECRET: 'invalid+secret=',
  };

  assert.throws(() => readConfig(environment), /TELEGRAM_WEBHOOK_SECRET/);
});

test('accepts a Telegram webhook secret with supported characters', () => {
  const environment: NodeJS.ProcessEnv = {
    BOT_PLATFORM: 'telegram',
    TELEGRAM_BOT_TOKEN: 'token',
    TELEGRAM_WEBHOOK_URL: 'https://example.test/webhooks/telegram',
    TELEGRAM_WEBHOOK_SECRET: 'token_123-ABC',
  };

  assert.equal(readConfig(environment).platform, 'telegram');
});

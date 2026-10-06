import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig } from '../src/config.js';

test('requires ELPh webhook configuration', () => {
  const environment: NodeJS.ProcessEnv = {
    ELPH_API_URL: 'https://example.test',
    ELPH_BOT_TOKEN: 'token',
    ELPH_WEBHOOK_URL: 'https://example.test/webhooks/elph',
  };

  assert.throws(() => readConfig(environment), /ELPH_WEBHOOK_SECRET/);
});

test('reads ELPh configuration', () => {
  const environment: NodeJS.ProcessEnv = {
    ELPH_API_URL: 'https://example.test',
    ELPH_BOT_TOKEN: 'token',
    ELPH_WEBHOOK_URL: 'https://example.test/webhooks/elph',
    ELPH_WEBHOOK_SECRET: 'secret',
  };

  assert.equal(readConfig(environment).httpPort, 3000);
});

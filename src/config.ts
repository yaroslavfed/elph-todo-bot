export type BotPlatform = 'elph' | 'telegram';

export interface AppConfig {
  platform: BotPlatform;
  httpHost: string;
  httpPort: number;
  databasePath: string;
  storagePath: string;
}

export function readConfig(environment = process.env): AppConfig {
  const platform = environment.BOT_PLATFORM;
  if (platform !== 'elph' && platform !== 'telegram') throw new Error('BOT_PLATFORM must be elph or telegram');
  required(environment, platform === 'elph'
    ? ['ELPH_API_URL', 'ELPH_BOT_TOKEN', 'ELPH_WEBHOOK_URL', 'ELPH_WEBHOOK_SECRET']
    : ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_URL', 'TELEGRAM_WEBHOOK_SECRET']);
  if (platform === 'telegram') validateTelegramWebhookSecret(environment.TELEGRAM_WEBHOOK_SECRET!);
  const address = environment.HTTP_ADDR ?? ':3000';
  const match = /^(?:(.*):)?(\d+)$/.exec(address);
  if (!match) throw new Error('HTTP_ADDR must have the form host:port or :port');
  return {
    platform,
    httpHost: match[1] || '0.0.0.0',
    httpPort: Number(match[2]),
    databasePath: environment.DATA_PATH ?? './data/todo.sqlite',
    storagePath: environment.FILE_STORAGE_PATH ?? './storage',
  };
}

function required(environment: NodeJS.ProcessEnv, names: string[]): void {
  const missing = names.filter((name) => !environment[name]);
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(', ')}`);
}

function validateTelegramWebhookSecret(secret: string): void {
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET must contain 1-256 characters: A-Z, a-z, 0-9, _ or -');
  }
}

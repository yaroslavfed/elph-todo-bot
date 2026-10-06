export interface AppConfig {
  httpHost: string;
  httpPort: number;
  databasePath: string;
  storagePath: string;
}

export function readConfig(environment = process.env): AppConfig {
  required(environment, [
    'ELPH_API_URL',
    'ELPH_BOT_TOKEN',
    'ELPH_WEBHOOK_URL',
    'ELPH_WEBHOOK_SECRET',
  ]);
  const address = environment.HTTP_ADDR ?? ':3000';
  const match = /^(?:(.*):)?(\d+)$/.exec(address);
  if (!match) throw new Error('HTTP_ADDR must have the form host:port or :port');
  return {
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

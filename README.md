# ToDo Bot

## Запуск в Docker

Один образ используется для двух независимых экземпляров бота:

- ELPh работает на порту `3001`
- Telegram работает на порту `3002`

Каждый экземпляр хранит SQLite-базу и вложения в собственных Docker volumes. Docker загружает пакеты `@elph/bot-sdk` и `@elph/bot-sdk-nestjs` из Nexus согласно `package.json` и `yarn.lock`.

### Требования

- Docker Engine с Docker Compose plugin на Linux или Docker Desktop на Windows и macOS
- доступ к Nexus во время сборки образа
- публичный HTTPS-адрес для webhook

Сервис ELPh использует `network_mode: host`. На Linux дополнительная настройка не требуется. На Windows и macOS нужен Docker Desktop 4.34 или новее, а в `Settings` → `Resources` → `Network` должна быть включена настройка `Enable host networking`.

### Подготовка файлов окружения

Windows PowerShell:

```powershell
Copy-Item .env.elph.example .env.elph
Copy-Item .env.telegram.example .env.telegram
```

Linux и macOS:

```bash
cp .env.elph.example .env.elph
cp .env.telegram.example .env.telegram
```

Файлы `.env.elph` и `.env.telegram` содержат секреты и исключены из Git. Не добавляй их в репозиторий.

### Настройка ELPh

Заполни `.env.elph`:

```dotenv
BOT_PLATFORM=elph
ELPH_API_URL=https://<адрес-elph>
ELPH_BOT_TOKEN=<токен-бота-elph>
ELPH_WEBHOOK_URL=https://<публичный-host>/webhooks/elph
ELPH_WEBHOOK_SECRET=<случайный-секрет>
```

- `BOT_PLATFORM` оставь равным `elph`
- `ELPH_API_URL` укажи как базовый URL ELPh без пути
- `ELPH_BOT_TOKEN` возьми из настроек созданного в ELPh бота
- `ELPH_WEBHOOK_URL` должен быть публичным HTTPS-адресом и оканчиваться на `/webhooks/elph`
- `ELPH_WEBHOOK_SECRET` задай случайной непустой строкой. Сгенерить можно тут https://randomkeygen.com/ в 256-bit Hex или командой ниже

### Настройка Telegram

Заполни `.env.telegram`:

```dotenv
BOT_PLATFORM=telegram
TELEGRAM_BOT_TOKEN=<токен-от-botfather>
TELEGRAM_WEBHOOK_URL=https://<публичный-host>/webhooks/telegram
TELEGRAM_WEBHOOK_SECRET=<случайный-секрет>
```

- `BOT_PLATFORM` оставь равным `telegram`
- `TELEGRAM_BOT_TOKEN` получи у [BotFather](https://t.me/BotFather)
- `TELEGRAM_WEBHOOK_URL` должен быть публичным HTTPS-адресом и оканчиваться на `/webhooks/telegram`
- `TELEGRAM_WEBHOOK_SECRET` должен содержать от 1 до 256 символов `A-Z`, `a-z`, `0-9`, `_` или `-`

Для обоих секретов подходят 32 случайных байта в hex-представлении. Выполни команду два раза и сохрани разные значения в `ELPH_WEBHOOK_SECRET` и `TELEGRAM_WEBHOOK_SECRET`.

Windows PowerShell:

```powershell
[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
```

Linux и macOS:

```bash
openssl rand -hex 32
```

## Cloudflare Quick Tunnel для локального запуска

[Cloudflare Quick Tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) выдаёт временный публичный адрес вида `https://<random>.trycloudflare.com`. Учётная запись Cloudflare и собственный домен не требуются. Такой туннель предназначен только для разработки и тестирования, его адрес меняется после перезапуска.

### Установка cloudflared

Windows PowerShell:

```powershell
winget install --id Cloudflare.cloudflared
cloudflared --version
```

Если `winget` недоступен, скачай MSI или исполняемый файл со [страницы загрузки cloudflared](https://developers.cloudflare.com/tunnel/downloads/).

Linux на Debian или Ubuntu:

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update
sudo apt-get install cloudflared
cloudflared --version
```

Для других Linux-дистрибутивов используй пакет или исполняемый файл со [страницы загрузки cloudflared](https://developers.cloudflare.com/tunnel/downloads/).

macOS:

```bash
brew install cloudflared
cloudflared --version
```

### Туннель для ELPh

Запусти туннель в отдельном терминале до запуска контейнера:

```bash
cloudflared tunnel --url http://localhost:3001
```

Скопируй выданный адрес `https://<random>.trycloudflare.com` и запиши в `.env.elph`:

```dotenv
ELPH_WEBHOOK_URL=https://<random>.trycloudflare.com/webhooks/elph
```

Затем собери и запусти только ELPh:

```bash
docker compose --profile elph up --build -d todo-elph
docker compose logs -f todo-elph
```

### Туннель для Telegram

Запусти туннель в отдельном терминале до запуска контейнера:

```bash
cloudflared tunnel --url http://localhost:3002
```

Скопируй выданный адрес `https://<random>.trycloudflare.com` и запиши в `.env.telegram`:

```dotenv
TELEGRAM_WEBHOOK_URL=https://<random>.trycloudflare.com/webhooks/telegram
```

Затем собери и запусти только Telegram:

```bash
docker compose --profile telegram up --build -d todo-telegram
docker compose logs -f todo-telegram
```

### Запуск/перезапуск и доступность инстансов

Команды `cloudflared` и `docker compose` одинаковы для PowerShell, Linux и macOS. Если нужны оба бота, запусти два туннеля в разных терминалах, внеси их адреса в соответствующие `.env` и выполни:

```bash
docker compose --profile elph --profile telegram up --build -d
```

Не закрывай терминал с `cloudflared`, webhook должен оставаться доступным. После каждого перезапуска Quick Tunnel обнови URL в нужном `.env` и пересоздай соответствующий контейнер:

```bash
docker compose --profile elph up -d --force-recreate todo-elph
docker compose --profile telegram up -d --force-recreate todo-telegram
```

## Управление контейнерами

Показать состояние контейнеров:

```bash
docker compose --profile elph --profile telegram ps
```

Остановить отдельный экземпляр без удаления данных:

```bash
docker compose --profile elph stop todo-elph
docker compose --profile telegram stop todo-telegram
```

Остановить оба экземпляра без удаления данных:

```bash
docker compose --profile elph --profile telegram down
```

Удалить контейнеры, SQLite-базы и вложения обоих экземпляров:

```bash
docker compose --profile elph --profile telegram down --volumes
```

Последняя команда безвозвратно удаляет данные из Docker volumes.

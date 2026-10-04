# ToDo Bot

## Docker

Один образ запускает независимые экземпляры для ELPh и Telegram. Каждый сервис хранит SQLite-базу и вложения в собственных Docker volumes.

Для Docker-сборки используются локальные архивы SDK из соседнего каталога `../elph-bot-sdks/typescript`. Перед первой сборкой и после каждого изменения SDK выполни:

```powershell
Push-Location ..\elph-bot-sdks\typescript
yarn pack:local
Pop-Location
```

Подготовь конфигурации:

```powershell
Copy-Item .env.elph.example .env.elph
Copy-Item .env.telegram.example .env.telegram
```

Для `TELEGRAM_WEBHOOK_SECRET` используй строку длиной от 1 до 256 символов из `A-Z`, `a-z`, `0-9`, `_` и `-`. Например, в PowerShell:

```powershell
[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
```

В `ELPH_WEBHOOK_URL` укажи публичный адрес `https://<host>/webhooks/elph`. Для Telegram используй `https://<host>/webhooks/telegram`. Внешний reverse proxy должен направлять их соответственно на порты `3001` и `3002` хоста.

Запусти оба экземпляра:

```powershell
docker compose --profile elph --profile telegram up --build -d
```

Остановить экземпляры без удаления данных:

```powershell
docker compose --profile elph --profile telegram down
```

Удалить также SQLite-базы и вложения:

```powershell
docker compose --profile elph --profile telegram down --volumes
```

# ToDo Bot для ELPh Chat

Бот принимает webhook-события ELPh Chat, хранит задачи в SQLite и работает с вложениями.

## Docker

Для Docker-сборки используются локальные архивы SDK из соседнего каталога `../elph-bot-sdks/typescript`. Перед первой сборкой и после каждого изменения SDK выполни:

```powershell
Push-Location ..\elph-bot-sdks\typescript
yarn pack:local
Pop-Location
```

Подготовь конфигурацию:

```powershell
Copy-Item .env.elph.example .env.elph
```

В `ELPH_WEBHOOK_URL` укажи публичный адрес `https://<host>/webhooks/elph`. Внешний reverse proxy должен направлять его на порт `3001` хоста.

Запуск:

```powershell
docker compose up --build -d
```

Остановка без удаления данных:

```powershell
docker compose down
```

Удаление SQLite-базы и вложений:

```powershell
docker compose down --volumes
```

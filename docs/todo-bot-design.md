# Архитектура ToDo Bot для ELPh Chat

## Назначение

ToDo Bot принимает команды и вложения из ELPh Chat, хранит задачи в SQLite и отправляет пользователю результаты операций. Бот работает с одной платформой и использует SDK `@elph/bot-sdk-nestjs` для доставки webhook-событий и вызовов Bot API.

## Поток обновления

```text
ELPh Chat webhook
  ↓
ElphBotModule
  ↓
dispatchElphUpdate
  ↓
BotUpdateHandler
  ↓
TasksRepository / FileStorageService
  ↓
ElphBotAdapter
  ↓
ELPh Bot API
```

`dispatchElphUpdate` преобразует событие SDK во внутренний `IncomingBotEvent`. Внутренние идентификаторы пользователей и чатов получают префикс `elph:`. Это изолирует бизнес-логику от wire-format Bot API.

## Слои

- `BotUpdateHandler` обрабатывает команды, состояние диалога и операции с задачами
- `TasksRepository` сохраняет задачи и вложения в SQLite
- `FileStorageService` хранит содержимое вложений в файловой системе
- `BotTransport` описывает исходящие сообщения, клавиатуры и файлы
- `ElphBotAdapter` реализует `BotTransport` через ELPh Bot API
- `ElphBotModule` проверяет подпись webhook и регистрирует webhook при старте приложения

## Конфигурация

Для запуска требуются `ELPH_API_URL`, `ELPH_BOT_TOKEN`, `ELPH_WEBHOOK_URL` и `ELPH_WEBHOOK_SECRET`. Параметр `HTTP_ADDR` задаёт адрес HTTP-сервера, а `DATA_PATH` и `FILE_STORAGE_PATH` определяют расположение данных.

Публичный URL должен вести на `POST /webhooks/elph`. Исходящие операции используют идентификатор входящего обновления как `requestId`, поэтому повторная доставка одного обновления остаётся идемпотентной на стороне Bot API.

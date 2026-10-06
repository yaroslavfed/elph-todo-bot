# ToDo Bot — описание бизнес-логики и технической реализации

## 1. Назначение

**ToDo Bot** — небольшой, но функционально законченный бот для управления личными задачами.

Основная цель проекта — не построение сложного task manager, а создание понятного эталонного бота, на котором можно последовательно проверять один и тот же набор возможностей в **ELPh Chat** и **Telegram**.

Бот запускается **только на одной выбранной платформе за один запуск приложения**. Платформа определяется переменной окружения:

```env
BOT_PLATFORM=elph
```

или:

```env
BOT_PLATFORM=telegram
```

При этом бизнес-логика ToDo Bot не зависит от выбранного мессенджера. Команды, задачи, состояния диалога, действия над задачами и файловые сценарии находятся в общем core/application слое, а работа с конкретным SDK вынесена в transport adapter.

```text
                       ToDo Bot Core
                            │
                    BotTransport port
                            │
              ┌─────────────┴─────────────┐
              │                           │
       ElphBotAdapter             TelegramBotAdapter
              │                           │
       ELPh Bot SDK                Telegram SDK
              │                           │
          ELPh Chat                   Telegram
```

Бот должен оставаться полезным сам по себе: пользователь создаёт задачи, просматривает их, завершает и удаляет, а после добавления файловой поддержки — прикрепляет к задачам файлы и получает их обратно.

Проект реализуется на **NestJS**.

Для интеграции с ELPh используется:

- `@elph/bot-sdk`
- `@elph/bot-sdk-nestjs`

Репозиторий SDK:

- https://github.com/yaroslavfed/elph-bot-sdks
- Packages: https://github.com/users/yaroslavfed/packages?repo_name=elph-bot-sdks

Конкретный Telegram SDK не является частью бизнес-слоя. Он подключается только внутри `TelegramBotAdapter`, поэтому его можно заменить без изменения core-логики бота.

---

# Часть I. Бизнес-часть

## 2. Что умеет бот

ToDo Bot должен покрывать следующие пользовательские возможности:

| Возможность Bot API | Сценарий в ToDo Bot |
|---|---|
| Пользователь → бот: текст | создание новой задачи |
| Бот → пользователь: текст | подтверждения, списки задач, ошибки, помощь |
| Inline-кнопки с текстом сообщения | действия над конкретной задачей |
| Inline-кнопки без текста сообщения | панель быстрых действий после списка задач |
| Reply keyboard | быстрый выбор основных действий вместо ручного ввода команд |
| Menu commands | плоский список команд `/start`, `/new`, `/tasks`, `/done`, `/export`, `/help` |
| Пользователь → бот: файл | прикрепление файла к задаче |
| Бот → пользователь: файл | возврат прикреплённого файла |
| Бот → пользователь: сгенерированный файл | экспорт задач через `/export` |
| Reply на сообщение | при необходимости ответ бота на конкретное сообщение пользователя |
| Состояние диалога | ожидание текста новой задачи или файла для выбранной задачи |
| Обработка ошибок | неизвестная команда, пустое название, файл без выбранной задачи и т. п. |

---

## 3. Основная сущность — задача

Минимально задача содержит:

```text
Task
├── id
├── userKey
├── chatKey
├── title
├── status
├── createdAt
├── completedAt?
└── attachments[]
```

Статусы:

```text
ACTIVE
DONE
```

`userKey` и `chatKey` — внутренние непрозрачные идентификаторы приложения. Адаптер должен формировать их так, чтобы идентификаторы разных платформ не конфликтовали, например:

```text
elph:<native-user-id>
telegram:<native-user-id>
```

Бизнес-логика не разбирает префикс и не зависит от конкретной платформы.

Для первой версии этого достаточно.

При необходимости позже можно добавить:

- описание;
- deadline;
- priority;
- несколько файлов;
- напоминания.

В базовую версию это не входит, чтобы бизнес-логика не мешала тестированию Bot API.

---

# 4. Главное меню бота

У пользователя есть три разных механизма управления ботом.

Важно: они намеренно используются **раздельно**, чтобы можно было проверить каждый механизм отдельно.

## 4.1. Menu commands

Это глобальный плоский список команд бота.

Команды:

| Команда | Назначение |
|---|---|
| `/start` | приветствие и краткое описание возможностей |
| `/new` | создать новую задачу |
| `/tasks` | показать активные задачи |
| `/done` | показать выполненные задачи |
| `/export` | экспортировать задачи в файл |
| `/help` | показать помощь |

Пример отображения:

```text
/start   Запустить бота
/new     Создать задачу
/tasks   Активные задачи
/done    Выполненные задачи
/export  Экспортировать задачи
/help    Помощь
```

Menu commands не должны содержать вложенных уровней.

Их задача — проверить глобальное меню команд клиента.

---

## 4.2. Reply keyboard

Reply keyboard предоставляет основные действия в виде кнопок, заменяющих ручной ввод команд.

Клавиатура:

```text
┌──────────────────────┬──────────────────────┐
│ ➕ Новая задача      │ 📋 Мои задачи       │
├──────────────────────┼──────────────────────┤
│ ✅ Выполненные       │ ℹ️ Помощь           │
└──────────────────────┴──────────────────────┘
```

Соответствие кнопок командам:

```text
➕ Новая задача  -> /new
📋 Мои задачи   -> /tasks
✅ Выполненные  -> /done
ℹ️ Помощь       -> /help
```

Reply keyboard нужна именно как альтернативный способ отправить уже существующее действие.

То есть:

```text
нажатие кнопки "📋 Мои задачи"
```

и

```text
ручной ввод /tasks
```

должны приводить к одному и тому же бизнес-сценарию.

Кнопка `☰ Все действия` содержит вложенное меню из создания задачи, просмотра активных и выполненных задач, экспорта, настройки интерфейса и справки. В ELPh Chat вложенность отображается нативно. В Telegram дочерние кнопки разворачиваются в обычные строки reply keyboard.

## 4.2.1. Вид меню

Команда `/settings` открывает выбор двух режимов интерфейса:

- `Расширенный` показывает частые действия отдельными кнопками
- `Компактный` оставляет создание задачи и вложенное меню всех действий

Выбор применяется ко всему экземпляру бота, а не к отдельному пользователю. Режим хранится в SQLite и восстанавливается после перезапуска. При переключении бот обновляет и reply keyboard, и menu commands.

---

## 4.3. Inline-кнопки

Inline-кнопки относятся к конкретному сообщению или конкретному набору действий.

Они не заменяют глобальное меню.

Основное применение — действия над конкретной задачей.

Пример:

```text
Задача #12

Проверить документацию bot-service

[✅ Выполнить] [📎 Прикрепить файл]
[🗑 Удалить]
```

Кнопка `📎 Файлы` содержит вложенные действия для прикрепления и скачивания каждого файла. В Telegram эти действия показываются плоским списком, чтобы оставаться доступными без нативной поддержки вложенных inline-кнопок.

После появления файлов:

```text
Задача #12

Проверить документацию bot-service

📎 contract.pdf

[✅ Выполнить] [📥 Скачать файл]
[🗑 Удалить]
```

---

# 5. Основные пользовательские сценарии

## 5.1. `/start`

Пользователь:

```text
/start
```

Бот отправляет обычное текстовое сообщение:

```text
Привет! Я ToDo Bot.

Я могу сохранять задачи, показывать список активных и выполненных задач,
а также прикреплять к задачам файлы.

Создать задачу можно командой /new или кнопкой «➕ Новая задача».
```

Одновременно у пользователя доступна reply keyboard:

```text
[➕ Новая задача] [📋 Мои задачи]
[✅ Выполненные]  [ℹ️ Помощь]
```

### Что проверяет сценарий

- пользователь → бот: команда;
- бот → пользователь: обычное сообщение;
- reply keyboard;
- menu commands уже должны быть зарегистрированы у бота.

---

# 5.2. Создание задачи — пользователь → бот: текст

Пользователь:

```text
/new
```

Бот:

```text
Напиши название новой задачи.
```

Бот переводит текущий диалог в состояние:

```text
AWAITING_TASK_TITLE
```

Пользователь отправляет **обычное текстовое сообщение**:

```text
Проверить контракт Bot API
```

Бот создаёт задачу и отвечает:

```text
Задача создана.

Проверить контракт Bot API
```

Под этим сообщением располагаются inline-кнопки:

```text
[✅ Выполнить] [📎 Прикрепить файл]
[🗑 Удалить]
```

До реализации файлов кнопка `📎 Прикрепить файл` может:

1. отсутствовать;
2. либо появиться только начиная с файлового этапа.

Предпочтительный вариант — **не показывать функцию до момента, когда она реализована**.

### Что проверяет сценарий

- `/new` как menu command;
- обычное сообщение от бота;
- обычное сообщение пользователя боту;
- состояние диалога;
- сообщение с inline keyboard;
- обработку inline command.

---

# 5.3. Просмотр активных задач

Пользователь использует:

```text
/tasks
```

или reply-кнопку:

```text
📋 Мои задачи
```

Бот отправляет:

```text
Активные задачи:

#12 Проверить контракт Bot API
#15 Обновить README
#18 Сделать упражнение по Go
```

После списка бот отправляет **отдельное сообщение без текста**, содержащее только inline keyboard:

```text
[🔄 Обновить] [➕ Новая задача]
[✅ Выполненные]
```

Это отдельный тестовый сценарий для сообщения, у которого:

```text
text отсутствует
inlineKeyboard присутствует
```

### Что проверяет сценарий

- menu command `/tasks`;
- reply command с тем же бизнес-действием;
- бот → пользователь: обычное сообщение;
- inline keyboard без текста сообщения;
- обработку inline command.

> SDK допускает такой сценарий: в `SendMessageRequest` поля `text` и `inlineKeyboard` являются независимыми опциональными полями.

---

# 5.4. Карточка задачи — inline keyboard с текстом

При выборе или создании задачи бот отправляет карточку:

```text
Задача #12

Проверить контракт Bot API

Статус: активна
```

Inline-кнопки:

```text
[✅ Выполнить] [📎 Прикрепить файл]
[🗑 Удалить]
```

Пример команд кнопок:

```text
task:12:complete
task:12:attach
task:12:delete
```

После нажатия:

```text
✅ Выполнить
```

бот получает inline command и меняет статус задачи.

Ответ:

```text
Задача выполнена:

Проверить контракт Bot API
```

### Что проверяет сценарий

- inline keyboard, прикреплённую к текстовому сообщению;
- передачу `commandId`;
- связь команды с исходным сообщением;
- бизнес-обработку inline action;
- бот → пользователь: подтверждающее сообщение.

---

# 5.5. Удаление задачи

Карточка:

```text
Задача #12

Проверить контракт Bot API

[✅ Выполнить] [📎 Прикрепить файл]
[🗑 Удалить]
```

После:

```text
🗑 Удалить
```

бот отвечает:

```text
Задача удалена.
```

На первом этапе дополнительное подтверждение не требуется.

Если позже понадобится проверить вложенные inline keyboard, удаление можно изменить на:

```text
Удалить задачу?

[Да] [Нет]
```

Но это не обязательно для MVP.

---

# 5.6. Просмотр выполненных задач

Команда:

```text
/done
```

или reply-кнопка:

```text
✅ Выполненные
```

Ответ:

```text
Выполненные задачи:

#3 Настроить окружение
#8 Проверить webhook
#11 Обновить SDK
```

При отсутствии задач:

```text
Выполненных задач пока нет.
```

---

# 5.7. `/help`

Команда:

```text
/help
```

Ответ:

```text
ToDo Bot

/new — создать задачу
/tasks — показать активные задачи
/done — показать выполненные задачи
/export — экспортировать задачи
/help — помощь

Для основных действий также можно использовать кнопки под полем ввода.
Действия над конкретной задачей находятся под сообщением с задачей.
```

Этот сценарий удобен как простой smoke test отправки текста ботом.

---

# 6. Работа с файлами

Файловая функциональность добавляется отдельным этапом.

До неё ToDo Bot уже полностью работает как текстовый task manager.

---

## 6.1. Пользователь → бот: прикрепление файла

Пользователь открывает карточку задачи:

```text
Задача #12

Проверить контракт Bot API

[✅ Выполнить] [📎 Прикрепить файл]
[🗑 Удалить]
```

Нажимает:

```text
📎 Прикрепить файл
```

Бот отвечает:

```text
Отправь файл, который нужно прикрепить к задаче:

Проверить контракт Bot API
```

Состояние диалога:

```text
AWAITING_TASK_ATTACHMENT
taskId = 12
```

Пользователь отправляет:

```text
contract.pdf
```

Бот получает сообщение с `attachments`.

После успешной обработки:

```text
Файл contract.pdf прикреплён к задаче #12.
```

Обновлённая карточка:

```text
Задача #12

Проверить контракт Bot API

📎 contract.pdf

[✅ Выполнить] [📥 Скачать файл]
[🗑 Удалить]
```

### Что проверяет сценарий

```text
User -> Bot: file
```

То есть:

- получение ботом сообщения с вложением;
- чтение `message.attachments`;
- привязку файла к контексту выбранной задачи;
- сохранение metadata файла;
- подтверждение обычным сообщением.

---

## 6.2. Бот → пользователь: получение прикреплённого файла

Пользователь нажимает:

```text
📥 Скачать файл
```

Бот загружает сохранённый файл из своего хранилища и вызывает отправку файла пользователю.

Пользователь получает:

```text
contract.pdf
```

Опциональная подпись:

```text
Файл из задачи #12
```

### Что проверяет сценарий

```text
Bot -> User: file
```

То есть именно отправку файла ботом.

---

## 6.3. `/export` — независимый тест отправки файла ботом

Команда:

```text
/export
```

Бот создаёт файл, например:

```text
todo-export.json
```

Пример содержимого:

```json
{
  "tasks": [
    {
      "id": 12,
      "title": "Проверить контракт Bot API",
      "status": "ACTIVE"
    },
    {
      "id": 8,
      "title": "Проверить webhook",
      "status": "DONE"
    }
  ]
}
```

Бот отправляет файл:

```text
todo-export.json
```

с подписью:

```text
Экспорт задач готов.
```

### Зачем нужен отдельный `/export`

Он проверяет `Bot -> User: file` независимо от сценария, где пользователь ранее загрузил файл.

Это позволяет отдельно проверить:

1. генерацию файла приложением;
2. `sendFile`;
3. получение файла клиентом;
4. имя файла;
5. MIME type;
6. caption.

---

# 7. Обработка сообщений, не являющихся командами

Если бот не ожидает текст или файл, обычное сообщение не должно случайно создавать задачу.

Например:

```text
Привет
```

Ответ:

```text
Я не жду сейчас текст задачи.

Чтобы создать задачу, используй /new
или кнопку «➕ Новая задача».
```

Это делает state machine предсказуемой.

---

# 8. Ошибочные сценарии

Минимальный набор:

### Пустая задача

```text
/new
```

затем пустой или некорректный текст:

```text
Не получилось создать задачу: название не должно быть пустым.
```

### Файл без режима ожидания файла

Пользователь просто отправляет файл.

Ответ:

```text
Сейчас я не ожидаю файл.

Открой задачу и нажми «📎 Прикрепить файл».
```

### Неизвестная команда

```text
/foo
```

Ответ:

```text
Неизвестная команда.

Используй /help, чтобы посмотреть доступные команды.
```

### Несуществующая задача из inline command

Ответ:

```text
Задача больше не существует.
```

---

# 9. Полная матрица покрытия Bot API

| № | Возможность | Сценарий |
|---|---|---|
| 1 | Bot → User: text | `/start`, `/help`, подтверждения |
| 2 | User → Bot: text | текст задачи после `/new` |
| 3 | Inline keyboard + text | карточка задачи |
| 4 | Inline keyboard без text | панель после `/tasks` |
| 5 | Inline command | complete / attach / delete / refresh |
| 6 | Reply keyboard | основные действия под полем ввода |
| 7 | Menu commands | `/start`, `/new`, `/tasks`, `/done`, `/export`, `/help` |
| 8 | User → Bot: file | attachment после `📎 Прикрепить файл` |
| 9 | Bot → User: file | `📥 Скачать файл` |
| 10 | Bot → User: generated file | `/export` |
| 11 | Conversation state | ожидание title / attachment |
| 12 | Error handling | неизвестная команда, неверный тип входа |
| 13 | Idempotency | использование `updateId`/стабильного `requestId` |
| 14 | Reply to message | опционально через `replyToMessageId` |

---

# 10. Этапы реализации

## Этап 1 — core и текстовый функционал

Реализуются общие, не зависящие от платформы сценарии:

- `/start`;
- `/new`;
- `/tasks`;
- `/done`;
- `/help`;
- обычные сообщения;
- menu commands;
- reply keyboard;
- inline keyboard с текстом;
- inline action;
- создание/завершение/удаление задач;
- conversation state;
- общий интерфейс `BotTransport`;
- нормализованная модель входящего события.

На этом этапе core не должен импортировать SDK ELPh или Telegram.

---

## Этап 2 — первый transport adapter

Подключается один реальный транспорт, например ELPh:

```text
ELPh webhook
    ↓
ElphBotAdapter
    ↓
IncomingBotEvent
    ↓
ToDo Bot Core
```

Проверяется полный текстовый сценарий:

- Bot → User: text;
- User → Bot: text;
- menu commands;
- reply keyboard;
- inline keyboard;
- inline actions.

---

## Этап 3 — файловая функциональность

В общий core добавляются:

- `📎 Прикрепить файл`;
- нормализованное входящее attachment-событие;
- хранение файла;
- `📥 Скачать файл`;
- `/export`;
- отправка файла через `BotTransport`.

Конкретный способ скачать входящий файл и отправить исходящий файл реализуется внутри adapter.

Базовая логика задач при этом не меняется.

---

## Этап 4 — второй transport adapter и platform switching

Добавляется второй adapter.

Итоговое приложение должно поддерживать два режима:

```env
BOT_PLATFORM=elph
```

и:

```env
BOT_PLATFORM=telegram
```

При переключении значения `.env`:

- бизнес-логика не меняется;
- команды не меняются;
- сценарии задач не меняются;
- persistence не меняется;
- меняются только transport adapter, webhook endpoint и настройки SDK.

Цель этапа — запускать один и тот же ToDo Bot поочерёдно в ELPh Chat и Telegram и сравнивать поведение платформ на одинаковых сценариях.

### Важное различие inline keyboard без текста

ELPh позволяет отправить `sendMessage` с `inlineKeyboard` без `text`.

В Telegram inline keyboard является разметкой, прикреплённой к сообщению, а `sendMessage` требует непустой `text`. Поэтому standalone-панель кнопок без текста не имеет прямого эквивалента через Telegram `sendMessage`.

Core должен выражать намерение:

```text
показать панель действий без бизнес-текста
```

а adapter решает, как его реализовать:

```text
ELPh:
inlineKeyboard без text

Telegram:
"Действия:" + inlineKeyboard
```

Это не следует скрывать общей абстракцией: различие платформ само по себе является полезным результатом сравнительного тестирования.

---

# Часть II. Техническая часть

# 11. Транспортные SDK

## ELPh

Для NestJS используется пакет:

```text
@elph/bot-sdk-nestjs
```

Core SDK:

```text
@elph/bot-sdk
```

ELPh SDK предоставляет основные операции:

```ts
sendMessage(...)
sendFile(...)
setReplyKeyboard(...)
setMyCommands(...)
```

NestJS integration также:

- регистрирует webhook при старте приложения;
- добавляет обработку `POST /webhooks/elph`;
- проверяет подпись webhook;
- передаёт входящий `BotUpdate` в `onUpdate`.

`BotUpdate` содержит:

```text
message
```

для обычных сообщений и сообщений с вложениями;

или:

```text
inlineCommand
```

для нажатия inline-кнопки.

Эти ELPh-типы не должны уходить дальше `ElphBotAdapter`.

## Telegram

Telegram SDK подключается только внутри:

```text
TelegramBotAdapter
```

Adapter отвечает за:

- регистрацию/обработку Telegram webhook;
- преобразование Telegram update в общий `IncomingBotEvent`;
- отправку текста;
- отправку файлов;
- inline keyboard;
- reply keyboard;
- menu commands;
- callback query / inline action;
- преобразование Telegram file metadata в общий attachment.

Ни `TasksService`, ни command router, ни conversation state не должны импортировать Telegram SDK.

---

# 12. Конфигурация и выбор платформы

Пример `.env.example`:

```env
# telegram | elph
BOT_PLATFORM=elph
HTTP_ADDR=:8080

# Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCDEF...
TELEGRAM_WEBHOOK_URL=https://твой-cloudflare-url.trycloudflare.com/webhooks/telegram
TELEGRAM_WEBHOOK_SECRET=6a6df93f9cd2b7cb60e321fd01a0eac7a19cb3d44c179b0eb64976d0f41f1c9e

# Elph
ELPH_API_URL=https://elph-dev.app.eltex.loc
ELPH_BOT_TOKEN=123456789:ABCDEF...
ELPH_WEBHOOK_URL=https://твой-cloudflare-url.trycloudflare.com/webhooks/elph
ELPH_WEBHOOK_SECRET=bb15a445954cd0473acb9fd6289175b8777c3e8de65e3828da53ff45d3d793db
ELPH_LOG_UPDATES=false

# Только для dev со внутренним недоверенным сертификатом
ELPH_INSECURE_SKIP_TLS_VERIFY=false
```

При необходимости:

```env
DATABASE_URL=...
FILE_STORAGE_PATH=./storage
```

## Правило выбора

`BOT_PLATFORM` является обязательной переменной:

```text
elph
```

или:

```text
telegram
```

Любое другое значение должно приводить к ошибке конфигурации при старте приложения.

Приложение **не должно запускать оба adapter одновременно**.

При:

```env
BOT_PLATFORM=elph
```

активируются только:

```text
ElphBotAdapter
ELPh webhook
ELPh SDK configuration
```

При:

```env
BOT_PLATFORM=telegram
```

активируются только:

```text
TelegramBotAdapter
Telegram webhook
Telegram SDK configuration
```

Это важно, в частности, чтобы не регистрировать два webhook и не запускать lifecycle hooks неактивной платформы.

## Проверка конфигурации

На старте рекомендуется валидировать только настройки выбранной платформы.

Например, при:

```env
BOT_PLATFORM=elph
```

обязательны:

```text
ELPH_API_URL
ELPH_BOT_TOKEN
ELPH_WEBHOOK_URL
ELPH_WEBHOOK_SECRET
```

Telegram-переменные в этом режиме могут отсутствовать.

При:

```env
BOT_PLATFORM=telegram
```

обязательны:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_WEBHOOK_URL
TELEGRAM_WEBHOOK_SECRET
```

ELPh-переменные в этом режиме могут отсутствовать.

## `ELPH_LOG_UPDATES`

Флаг приложения/adapter для dev-логирования входящих ELPh update.

Секреты, token и содержимое чувствительных файлов в лог писать нельзя.

## `ELPH_INSECURE_SKIP_TLS_VERIFY`

Допускается только для локальной/dev-среды с внутренним недоверенным сертификатом.

Это настройка transport-слоя, а не бизнес-логики. Конкретная реализация зависит от того, поддерживает ли выбранная версия SDK кастомный HTTP client/fetch.

В production значение должно быть:

```env
ELPH_INSECURE_SKIP_TLS_VERIFY=false
```

---

# 13. Bootstrap NestJS

Приложение запускается как один NestJS process и выбирает transport до инициализации platform-specific модуля.

Условно:

```text
load env
   ↓
validate BOT_PLATFORM
   ↓
create selected transport module
   ↓
bootstrap NestJS
   ↓
configure commands/keyboards
   ↓
register selected webhook
```

Для ELPh в `main.ts` требуется `rawBody`, так как SDK проверяет подпись webhook по исходным байтам тела запроса.

Можно оставить `rawBody: true` включённым в обоих режимах:

```ts
const app = await NestFactory.create(AppModule, {
  rawBody: true,
});
```

`HTTP_ADDR=:8080` следует нормализовать в host/port перед `app.listen(...)`.

Например:

```text
:8080
↓
host = 0.0.0.0
port = 8080
```

Platform-specific lifecycle не должен находиться в `main.ts`: выбор adapter и регистрация webhook должны быть инкапсулированы transport-модулем.

---

# 14. Рекомендуемая структура проекта

```text
src/
├── main.ts
├── app.module.ts
│
├── config/
│   ├── bot-platform.ts
│   ├── env.schema.ts
│   └── config.service.ts
│
├── bot/
│   ├── bot.module.ts
│   ├── bot-application.service.ts
│   ├── bot-update.handler.ts
│   ├── bot-command.router.ts
│   ├── bot-inline.router.ts
│   ├── bot-ui.service.ts
│   └── bot-setup.service.ts
│
├── transport/
│   ├── bot-transport.ts
│   ├── incoming-bot-event.ts
│   ├── bot-transport.module.ts
│   │
│   ├── elph/
│   │   ├── elph.module.ts
│   │   ├── elph-bot.adapter.ts
│   │   ├── elph-update.mapper.ts
│   │   └── elph-file.mapper.ts
│   │
│   └── telegram/
│       ├── telegram.module.ts
│       ├── telegram-bot.adapter.ts
│       ├── telegram-update.mapper.ts
│       └── telegram-file.mapper.ts
│
├── tasks/
│   ├── tasks.module.ts
│   ├── tasks.service.ts
│   ├── tasks.repository.ts
│   ├── task.entity.ts
│   └── task.types.ts
│
├── conversation/
│   ├── conversation.module.ts
│   ├── conversation-state.service.ts
│   └── conversation-state.types.ts
│
└── files/
    ├── files.module.ts
    ├── task-files.service.ts
    ├── file-storage.service.ts
    └── file.types.ts
```

Ключевое правило структуры:

```text
tasks/
conversation/
bot routers/
```

не должны импортировать:

```text
@elph/bot-sdk
Telegram SDK
```

Все такие импорты остаются внутри `transport/elph` и `transport/telegram`.

Для маленького MVP часть файлов можно объединить, но границу `core/application ↔ transport adapter` желательно сохранить с самого начала.

---

# 15. Ответственность модулей

## `tasks`

Чистая бизнес-логика задач.

Не должна знать:

- что такое webhook;
- как устроен ELPh;
- как устроен Telegram;
- как выглядит SDK-specific inline keyboard;
- как отправляется HTTP-запрос в Bot API.

Основные операции:

```text
createTask
getTask
getActiveTasks
getCompletedTasks
completeTask
deleteTask
attachFile
```

---

## `conversation`

Хранит временное состояние диалога.

Например:

```ts
type ConversationState =
  | { type: 'IDLE' }
  | { type: 'AWAITING_TASK_TITLE' }
  | { type: 'AWAITING_TASK_ATTACHMENT'; taskId: string };
```

Для MVP состояние можно хранить в памяти.

Если бот будет запускаться в нескольких replica, state необходимо перенести в общее хранилище, например Redis.

---

## `IncomingBotEvent`

Это общая входящая модель приложения.

ELPh `BotUpdate` и Telegram update сначала преобразуются adapter'ом в неё.

Концептуально:

```ts
type IncomingBotEvent =
  | {
      id: string;
      userKey: string;
      chatKey: string;
      type: 'message';
      text?: string;
      attachments?: IncomingAttachment[];
    }
  | {
      id: string;
      userKey: string;
      chatKey: string;
      type: 'inline-action';
      command: string;
      sourceMessageId?: string;
    };
```

Core работает только с этой моделью.

---

## `BotTransport`

Общий исходящий port для core/application слоя.

Концептуально:

```ts
interface BotTransport {
  sendText(...): Promise<void>;
  sendMessageWithInlineKeyboard(...): Promise<void>;
  sendInlineKeyboard(...): Promise<void>;
  sendFile(...): Promise<void>;

  configureReplyKeyboard(...): Promise<void>;
  configureMenuCommands(...): Promise<void>;
}
```

Это не копия API конкретного SDK.

Интерфейс описывает операции, которые нужны ToDo Bot.

---

## `bot-update.handler`

Единая точка обработки `IncomingBotEvent`.

Логика высокого уровня:

```text
IncomingBotEvent
  |
  +-- inline-action? --------> bot-inline.router
  |
  +-- attachments? ---------> file flow / current conversation state
  |
  +-- text? ----------------> bot-command.router / text flow
```

---

## `bot-command.router`

Маршрутизирует:

```text
/start
/new
/tasks
/done
/export
/help
```

Команды от reply keyboard приводятся adapter'ом к тому же виду, что и команды, введённые пользователем вручную.

---

## `bot-inline.router`

Обрабатывает:

```text
task:<id>:complete
task:<id>:delete
task:<id>:attach
task:<id>:download

tasks:refresh
task:new
tasks:done
```

Парсер inline-команд отделяет:

```text
action
taskId
```

от транспортной callback/command-механики.

---

## `bot-ui.service`

Строит **platform-neutral** описание UI.

Например:

```text
buildTaskCard(task)
buildTasksActionsKeyboard()
buildReplyKeyboard()
buildMenuCommands()
```

Результат затем переводится adapter'ом в ELPh или Telegram markup.

Строки кнопок и action id не должны размазываться по platform-specific коду.

---

## `bot-setup.service`

При старте приложения один раз конфигурирует через `BotTransport`:

```text
menu commands
reply keyboard
```

Например:

```text
BotSetupService
     ↓
BotTransport.configureMenuCommands(...)
BotTransport.configureReplyKeyboard(...)
```

ELPh adapter внутри вызывает ELPh SDK.

Telegram adapter внутри вызывает соответствующие методы Telegram SDK.

---

## `ElphBotAdapter`

Отвечает только за ELPh transport:

- `BotUpdate` → `IncomingBotEvent`;
- ELPh attachments → `IncomingAttachment`;
- общий message model → `sendMessage`;
- общий file model → `sendFile`;
- menu commands → `setMyCommands`;
- reply keyboard → `setReplyKeyboard`;
- inline actions → `inlineCommand`;
- регистрацию/проверку ELPh webhook.

---

## `TelegramBotAdapter`

Отвечает только за Telegram transport:

- Telegram update → `IncomingBotEvent`;
- Telegram document/file → `IncomingAttachment`;
- общий message model → Telegram send message;
- общий file model → Telegram send document/file;
- menu commands → Telegram bot commands;
- reply keyboard → Telegram reply markup;
- inline actions → callback query;
- регистрацию/проверку Telegram webhook.

Различия возможностей платформ должны обрабатываться здесь, а не через `if (platform === ...)` внутри бизнес-сервисов.

---

# 16. Выбор transport-модуля

Вместо прямого подключения ELPh во всём приложении должен существовать единый `BotTransportModule`.

Концептуально:

```ts
BotTransportModule.register({
  platform: config.botPlatform,
});
```

Внутри dynamic module выбирается только один adapter:

```text
BOT_PLATFORM=elph
    ↓
import ElphTransportModule
    ↓
provide BOT_TRANSPORT = ElphBotAdapter
```

или:

```text
BOT_PLATFORM=telegram
    ↓
import TelegramTransportModule
    ↓
provide BOT_TRANSPORT = TelegramBotAdapter
```

Это важно: неактивный SDK не должен регистрировать webhook и выполнять bootstrap side effects.

## ELPh transport

Внутри `ElphTransportModule` подключается:

```ts
ElphBotModule.register({
  apiUrl: process.env.ELPH_API_URL!,
  token: process.env.ELPH_BOT_TOKEN!,
  webhookUrl: process.env.ELPH_WEBHOOK_URL!,
  webhookSecret: process.env.ELPH_WEBHOOK_SECRET!,
  onUpdate: async (update) => {
    // ElphUpdateMapper -> IncomingBotEvent -> BotUpdateHandler
  },
});
```

Не рекомендуется размещать бизнес-логику внутри `onUpdate`.

Путь:

```text
ELPh SDK onUpdate
      ↓
ElphUpdateMapper
      ↓
IncomingBotEvent
      ↓
BotUpdateHandler
      ↓
business/application services
```

## Telegram transport

Telegram transport строится по той же схеме:

```text
Telegram webhook/update
      ↓
TelegramUpdateMapper
      ↓
IncomingBotEvent
      ↓
BotUpdateHandler
      ↓
business/application services
```

Всё, что отличается между SDK, должно закончиться на уровне mapper/adapter.

---

# 17. Обработка входящего события

Оба adapter приводят platform-specific update к одному `IncomingBotEvent`.

Общий алгоритм core:

```text
1. Получить IncomingBotEvent.
2. Получить userKey и chatKey.
3. Проверить conversation state.
4. Если type == inline-action:
      маршрутизировать action.
5. Иначе если есть attachments:
      обработать файловый сценарий.
6. Иначе если есть text:
      сначала проверить command;
      затем проверить ожидаемый пользовательский ввод.
7. Если ничего не подошло:
      отправить понятный fallback.
```

Приоритет файлов важен.

Если бот находится в:

```text
AWAITING_TASK_ATTACHMENT
```

и приходит событие с attachment, оно должно попасть в файловый сценарий, а не в обработчик обычного текста.

Platform-specific поля не должны проверяться в этом handler:

```text
update.inlineCommand      // ELPh-specific
callback_query            // Telegram-specific
```

Они должны быть преобразованы adapter'ом заранее.

---

# 18. Menu commands

Core формирует единый список команд, а каждый adapter переводит его в формат своей платформы.

Ниже — пример реализации внутри ELPh adapter:

```ts
await bot.setMyCommands({
  buttons: [
    { command: '/start', text: 'Запустить бота' },
    { command: '/new', text: 'Создать задачу' },
    { command: '/tasks', text: 'Активные задачи' },
    { command: '/done', text: 'Выполненные задачи' },
    { command: '/export', text: 'Экспорт задач' },
    { command: '/help', text: 'Помощь' },
  ],
});
```

Menu commands являются плоским списком.

---

# 19. Reply keyboard

Core формирует общую reply keyboard. ELPh adapter и Telegram adapter переводят её в свои markup-модели.

Ниже — ELPh-вариант:

```ts
await bot.setReplyKeyboard({
  rows: [
    {
      buttons: [
        { text: '➕ Новая задача', command: '/new' },
        { text: '📋 Мои задачи', command: '/tasks' },
      ],
    },
    {
      buttons: [
        { text: '✅ Выполненные', command: '/done' },
        { text: 'ℹ️ Помощь', command: '/help' },
      ],
    },
  ],
});
```

Бизнес-обработчик не должен различать:

```text
пользователь напечатал /tasks
```

и

```text
пользователь нажал reply-кнопку, отправляющую /tasks
```

Оба события означают один command.

---

# 20. Inline keyboard с текстом

Этот сценарий поддерживается обеими платформами и должен иметь одинаковые action id.

Ниже показан ELPh-вариант adapter'а. Telegram adapter строит эквивалентный `InlineKeyboardMarkup`.

Пример карточки задачи:

```ts
await bot.sendMessage({
  chatId,
  requestId,
  text: [
    `Задача #${task.id}`,
    '',
    task.title,
    '',
    `Статус: ${task.status}`,
  ].join('\n'),
  inlineKeyboard: {
    rows: [
      {
        buttons: [
          {
            text: '✅ Выполнить',
            command: `task:${task.id}:complete`,
          },
          {
            text: '📎 Прикрепить файл',
            command: `task:${task.id}:attach`,
          },
        ],
      },
      {
        buttons: [
          {
            text: '🗑 Удалить',
            command: `task:${task.id}:delete`,
          },
        ],
      },
    ],
  },
});
```

---

# 21. Inline keyboard без текста

Это намеренно platform-capability тест.

ELPh SDK допускает отсутствие `text`, поэтому ELPh adapter отправляет standalone keyboard нативно.

В Telegram `sendMessage` требует непустой текст. Поэтому Telegram adapter для того же core-вызова должен использовать согласованный fallback, например:

```text
Действия:
[🔄 Обновить] [➕ Новая задача]
[✅ Выполненные]
```

Core не должен содержать проверку `if telegram`.

Ниже — нативный ELPh-вариант панели действий:

```ts
await bot.sendMessage({
  chatId,
  requestId,
  inlineKeyboard: {
    rows: [
      {
        buttons: [
          {
            text: '🔄 Обновить',
            command: 'tasks:refresh',
          },
          {
            text: '➕ Новая задача',
            command: 'task:new',
          },
        ],
      },
      {
        buttons: [
          {
            text: '✅ Выполненные',
            command: 'tasks:done',
          },
        ],
      },
    ],
  },
});
```

Этот сценарий должен присутствовать именно как отдельный тест совместимости клиента.

---

# 22. Обработка inline action

В core приходит нормализованное событие:

```text
type = inline-action
command
sourceMessageId?
```

Для ELPh adapter исходными полями являются:

```text
inlineCommand.sourceMessageId
inlineCommand.commandId
```

Для Telegram adapter источником является callback query.

Пример:

```text
commandId = task:12:complete
```

Маршрутизатор:

```text
task:12:complete
      ↓
taskId = 12
action = complete
      ↓
TasksService.completeTask(...)
```

После этого бот отправляет подтверждение пользователю.

---

# 23. Обычная отправка текста

Core вызывает `BotTransport.sendText(...)`.

Ниже — то, во что это преобразуется внутри ELPh adapter:

```ts
await bot.sendMessage({
  chatId,
  requestId,
  text: 'Задача создана.',
});
```

Простые ответы желательно оставлять простыми и не прикреплять клавиатуру туда, где она не нужна.

Это позволяет отдельно видеть обычный `Bot -> User message`.

---

# 24. Получение текста ботом

Core получает:

```text
IncomingBotEvent.text
```

Elph adapter берёт его из `update.message.text`.

Telegram adapter берёт его из соответствующего Telegram message update.

Дальше текст классифицируется:

```text
command
или
обычный пользовательский ввод
```

Пример:

```text
state = AWAITING_TASK_TITLE
text = "Проверить Bot API"
```

означает создание задачи.

---

# 25. Получение файла ботом

Core получает нормализованный:

```text
IncomingAttachment
```

В ELPh adapter исходный файл находится в:

```text
update.message.attachments
```

ELPh `Attachment` содержит, в частности:

```text
id
name
mimeType
size
downloadUrl
expiresAt
```

Telegram adapter должен преобразовать Telegram file/document metadata в ту же внутреннюю модель.

Общий алгоритм:

```text
1. Проверить state == AWAITING_TASK_ATTACHMENT.
2. Получить taskId из state.
3. Проверить наличие attachment.
4. Получить metadata.
5. Скачать/сохранить файл, если необходимо долговременное хранение.
6. Привязать файл к Task.
7. Вернуть state в IDLE.
8. Отправить подтверждение.
```

Важно: если `downloadUrl` ограничен по времени через `expiresAt`, нельзя рассчитывать на него как на постоянное хранилище.

Для возможности скачать вложение через несколько дней файл следует сохранить в собственное хранилище приложения.

---

# 26. Хранение файлов

Для demo/MVP достаточно:

```text
storage/
└── <userId>/
    └── <taskId>/
        └── <fileId>-<filename>
```

В БД хранится:

```text
TaskAttachment
├── id
├── taskId
├── originalName
├── mimeType
├── size
└── storageKey
```

Для production-подобной версии вместо local filesystem можно использовать S3/MinIO.

Для функционального тестового бота это необязательно.

---

# 27. Отправка файла ботом

Core вызывает:

```text
BotTransport.sendFile(...)
```

ELPh SDK принимает `Blob`.

Концептуальная реализация внутри `ElphBotAdapter`:

```ts
const blob = new Blob([buffer], {
  type: attachment.mimeType,
});

await bot.sendFile({
  chatId,
  requestId,
  file: blob,
  filename: attachment.originalName,
  caption: `Файл из задачи #${task.id}`,
});
```

Это используется для:

```text
📥 Скачать файл
```

---

# 28. Экспорт

`/export`:

```text
TasksService
   ↓
ExportService
   ↓
JSON / CSV
   ↓
Stored/Generated File
   ↓
BotTransport.sendFile
   ↓
selected adapter
```

Для MVP рекомендуется JSON, потому что он проще всего генерируется и проверяется.

---

# 29. Идемпотентность

Идемпотентность должна быть общей задачей application/transport boundary, потому что платформы предоставляют разные механизмы.

Внутреннее событие содержит стабильный:

```text
IncomingBotEvent.id
```

Adapter формирует его из native update id.

Например:

```text
ELPh -> update.updateId
Telegram -> Telegram update id / callback id согласно типу события
```

Одна входящая операция иногда порождает несколько исходящих действий, поэтому application layer может строить `operationId`:

```text
<eventId>:reply
<eventId>:task-card
<eventId>:actions
<eventId>:file
```

`BotTransport` может принимать этот `operationId`.

Далее:

```text
ElphBotAdapter
operationId -> requestId SDK
```

В Telegram, где такого же общего `requestId` для `sendMessage` нет, adapter/application infrastructure должен использовать собственную deduplication-механику при необходимости.

Главное инвариантное свойство:

> повторная обработка одного и того же входящего события не должна создавать неконтролируемые логические дубли.

---

# 30. Transport boundary

Разделение core и adapter является обязательной частью архитектуры этого бота, потому что готовое приложение должно запускаться как в ELPh, так и в Telegram.

Рекомендуемая зависимость:

```text
                TasksService
                     ↑
            BotApplicationService
                     ↓
               BotTransport
                     ↓
           selected at startup
                     │
          ┌──────────┴──────────┐
          │                     │
   ElphBotAdapter       TelegramBotAdapter
          │                     │
     ELPh SDK             Telegram SDK
```

Минимальный transport interface предоставляет операции уровня приложения:

```text
sendText
sendMessageWithInlineKeyboard
sendInlineKeyboard
sendFile
configureReplyKeyboard
configureMenuCommands
```

Входящая сторона симметрична:

```text
ELPh update ────────┐
                    ├─> IncomingBotEvent -> core
Telegram update ────┘
```

Core не должен:

```text
if (BOT_PLATFORM === 'elph') ...
if (BOT_PLATFORM === 'telegram') ...
```

Такие условия допустимы только в:

```text
config/bootstrap
BotTransportModule
transport adapters
```

Platform-specific ограничения также локализуются в adapter. Пример — inline keyboard без текста: ELPh умеет отправить её нативно, Telegram adapter применяет fallback.

---

# 31. Хранилище задач

Для самого первого прототипа возможен in-memory repository:

```text
Map<UserId, Task[]>
```

Но данные будут теряться при рестарте приложения.

Более реалистичный вариант:

```text
PostgreSQL
```

или SQLite для локального demo.

Минимальные таблицы:

```text
tasks
task_attachments
```

Conversation state для одной replica можно временно хранить в памяти.

---

# 32. Границы ответственности

## Domain/business слой знает

- что такое задача;
- кто её владелец через непрозрачный `userKey`;
- к какому чату относится сценарий через `chatKey`;
- статус задачи;
- какой файл к ней привязан;
- что задачу можно создать, завершить или удалить.

## Domain/business слой не знает

- что такое ELPh `BotUpdate`;
- что такое Telegram callback query;
- как проверяется webhook;
- как устроен конкретный SDK;
- как выглядит platform-specific keyboard markup;
- какой HTTP endpoint используется для отправки сообщения.

## Application слой знает

- `IncomingBotEvent`;
- `BotTransport`;
- commands/action ids;
- conversation state;
- общий UI model;
- `operationId` для идемпотентных операций.

Application слой не импортирует конкретные SDK.

## ELPh adapter знает

- как получить `BotUpdate`;
- как извлечь text/attachments/inline command;
- как вызвать `sendMessage`;
- как вызвать `sendFile`;
- как установить reply keyboard;
- как установить menu commands;
- как преобразовать ELPh id в внутренние `userKey/chatKey`;
- как зарегистрировать и проверить ELPh webhook.

## Telegram adapter знает

- как получить Telegram update;
- как извлечь text/file/callback;
- как отправить message/file;
- как построить Telegram inline/reply markup;
- как установить bot commands;
- как преобразовать Telegram id в внутренние `userKey/chatKey`;
- как зарегистрировать и проверить Telegram webhook.

Ни один adapter не должен реализовывать правила создания, выполнения или удаления задач.

---

# 33. Smoke-test сценарий

Один и тот же сценарий должен быть пройден дважды:

```env
BOT_PLATFORM=elph
```

и затем:

```env
BOT_PLATFORM=telegram
```

Для каждого режима поднимается только соответствующий adapter/webhook.

После запуска приложения можно пройти один последовательный сценарий.

## Без файлов

1. Открыть бота.
2. Проверить menu commands.
3. Выполнить `/start`.
4. Проверить reply keyboard.
5. Нажать `➕ Новая задача`.
6. Отправить обычный текст.
7. Получить карточку задачи с inline keyboard.
8. Выполнить `/tasks`.
9. Проверить inline keyboard без текста.
10. Нажать `✅ Выполнить`.
11. Выполнить `/done`.
12. Проверить результат.

## После добавления файлов

13. Создать новую задачу.
14. Нажать `📎 Прикрепить файл`.
15. Отправить файл боту.
16. Получить подтверждение.
17. Нажать `📥 Скачать файл`.
18. Получить файл от бота.
19. Выполнить `/export`.
20. Получить сгенерированный файл экспорта.

Так один короткий сценарий проверяет весь обязательный Bot API.

Результаты удобно сравнивать по таблице:

| Возможность | ELPh | Telegram | Примечание |
|---|---|---|---|
| Text in/out | должен работать | должен работать | одинаковый бизнес-сценарий |
| Menu commands | должен работать | должен работать | platform-specific registration |
| Reply keyboard | должен работать | должен работать | общий набор команд |
| Inline + text | должен работать | должен работать | одинаковые action id |
| Inline без text | нативно | fallback с текстом | ограничение Telegram `sendMessage` |
| File in | должен работать | должен работать | общий `IncomingAttachment` |
| File out | должен работать | должен работать | общий `BotTransport.sendFile` |
| Export | должен работать | должен работать | один и тот же файл/содержимое |

---

# 34. Критерии готовности этапа 1

Этап считается готовым, если:

- webhook стабильно принимает события;
- бот отправляет обычный текст;
- бот принимает обычный текст;
- menu commands отображаются в клиенте;
- reply keyboard отображается и отправляет команды;
- inline keyboard работает вместе с текстом;
- inline keyboard работает без текста;
- inline command доходит до NestJS-приложения;
- задачи создаются;
- задачи завершаются;
- задачи удаляются;
- команды и reply-кнопки приводят к одинаковому бизнес-поведению;
- повтор одного update не создаёт неконтролируемых дублей;
- текстовый сценарий работает через выбранный `BotTransport`;
- core не импортирует ни ELPh SDK, ни Telegram SDK.

---

# 35. Критерии готовности этапа 2

Файловый этап считается готовым, если:

- бот получает входящий attachment;
- файл связывается с выбранной задачей;
- файл сохраняется так, чтобы его можно было получить позже;
- бот может отправить сохранённый файл пользователю;
- имя файла сохраняется;
- MIME type обрабатывается корректно;
- `/export` формирует новый файл;
- бот отправляет export-файл;
- ошибки файлового сценария не ломают обычную работу с задачами;
- файловые use case работают через оба adapter без изменения `TasksService`.

---

# 36. Что намеренно не входит в MVP

Чтобы проект оставался тестовым стендом Bot API, а не полноценным task manager, пока не нужны:

- авторизация вне идентификатора пользователя из Bot API;
- проекты;
- теги;
- подзадачи;
- recurring tasks;
- напоминания;
- cron;
- дедлайны;
- приоритеты;
- совместные списки;
- роли;
- сложный поиск;
- редактирование задач;
- одновременная работа сразу в ELPh и Telegram из одного процесса.

Поддерживаются два adapter, но в одном запуске активен только один, выбранный через `BOT_PLATFORM`.

Эти функции можно добавлять позже только если для них появляется отдельная задача тестирования платформы.

---

# 37. Итоговая схема

```text
                         .env
                          │
                 BOT_PLATFORM
                  elph | telegram
                          │
                          ▼
                 BotTransportModule
                          │
              выбирает один adapter
                          │
             ┌────────────┴────────────┐
             │                         │
             ▼                         ▼
      ElphBotAdapter           TelegramBotAdapter
             │                         │
      ELPh Bot SDK               Telegram SDK
             │                         │
      /webhooks/elph          /webhooks/telegram
             │                         │
             └────────────┬────────────┘
                          │
                    mapper layer
                          │
                          ▼
                 IncomingBotEvent
                          │
                          ▼
                  BotUpdateHandler
                    ┌─────┴─────┐
                    │           │
             CommandRouter  InlineRouter
                    │           │
                    └─────┬─────┘
                          │
                 ConversationState
                          │
                          ▼
                    TasksService
                    ┌─────┴─────┐
                    │           │
               Repository   FileStorage
```

Исходящий путь:

```text
Tasks / Bot application logic
            ↓
       BotTransport
            ↓
     selected adapter
       ┌────┴────┐
       │         │
     ELPh     Telegram
```

В такой архитектуре ToDo Bot остаётся одним приложением и одним набором бизнес-сценариев, но может запускаться в двух конфигурациях:

```env
BOT_PLATFORM=elph
```

или:

```env
BOT_PLATFORM=telegram
```

Переключение платформы не должно требовать изменения:

```text
TasksService
ConversationState
CommandRouter
InlineRouter
FileStorage
ExportService
```

Меняется только transport/bootstrap слой.

Итоговый бот явно покрывает:

```text
text in
text out
inline with text
inline without business text
inline actions
reply keyboard
menu commands
file in
file out
generated file out
conversation state
idempotent update processing
ELPh transport
Telegram transport
platform switching through env
```

Это делает его одновременно:

- demo-ботом;
- smoke/e2e стендом ELPh Bot API;
- сравнительным стендом ELPh ↔ Telegram;
- примером корректного отделения бизнес-логики NestJS-приложения от SDK конкретного мессенджера.

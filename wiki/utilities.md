# Утилиты

## normalizeBase(base: string): string

Приводит basePath к виду `/foo` без хвостовых `/`. Пустое значение даёт `/`.

## safeDecodeURI(str) / safeDecodeURIComponent(str)

Безопасные обёртки над стандартными функциями: при ошибке возвращают исходную строку.

## DisposableScope

Хранит «очистители» (disposer‑функции):

- `add(disposer)` — регистрирует функцию.
- `effect(fn)` — создаёт реактивный эффект и добавляет его disposer.
- `listen(target, type, handler, options?)` — подписка на событие с автоснятием.
- `flush()` — вызывает все disposers, очищает контейнер.

Используется в Router (popstate, click) и Layout (слушатели/эффекты страницы).

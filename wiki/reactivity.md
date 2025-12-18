# Реактивность

Лёгкие сигналы без внешних зависимостей.

## API

- `signal<T>(value)` — функция‑геттер, `set(next)` меняет значение.
- `computed<T>(calc)` — сигнал, пересчитываемый при изменении зависимостей.
- `effect(fn)` — запускает `fn`, подписывается на использованные сигналы; возвращает disposer.
- `isSignal(value)` — проверка на сигнал.

### Пример

```ts
import { signal, computed, effect } from "@icrusai/ts-router/dist/utils/reactive";

const a = signal(1);
const b = signal(2);
const sum = computed(() => a() + b());

effect(() => console.log("sum =", sum())); // 3
a.set(5); // лог: 7
```

## Декоратор `@reactive`

Находится в `src/utils/decorators.ts`, использует стандартные декораторы TS ≥5.

```ts
import { reactive } from "@icrusai/ts-router";

class Counter {
    @reactive count = 0;
}
```

Для каждого экземпляра создаётся `signal`; работает с TemplateFeature и любыми эффектами.

## DisposableScope

Контейнер для очистителей (см. утилиты), удобен для хранения `effect` и DOM‑подписок:

```ts
const scope = new DisposableScope();
scope.effect(() => console.log(a()));
await scope.flush(); // снимает все эффекты/слушатели
```

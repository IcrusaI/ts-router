# Page и Layout

## Page

- `@reactive title: string` — синхронизируется с `document.title`.
- `route: CurrentRoute` — все данные текущего совпавшего маршрута.

Пример:

```ts
import Page from "@icrusai/ts-router/dist/components/Page";

export default class UserPage extends Page {
  created() {
    this.title = `User ${this.route.params.id}`;
  }

  protected renderStructure() {
    const el = document.createElement("section");
    el.innerHTML = `<h1>User ${this.route.params.id}</h1>`;
    return el;
  }
}
```

## Layout

Базовый класс без фреймворка.

Ключевые методы/хуки:

- `renderStructure(): HTMLElement | string | Layout` — строит корень. HTML‑строка обязана иметь один корневой элемент. Возврат `Layout` требует подключённый ChildrenFeature.
- `mountTo(container)` / `destroy()` — управление жизненным циклом.
- `getElement()` — лениво создаёт корень.
- `protected addEvent(el, type, handler)` — безопасная подписка с авто‑снятием.
- Хуки: `created`, `beforeMount`, `afterMount`, `beforeUnmount`, `unmounted`.

### Пример базового Layout

```ts
import Layout from "@icrusai/ts-router/dist/components/Layout";

export default class CardLayout extends Layout {
  protected renderStructure() {
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `<header><slot name="title"></slot></header><div class="body"></div>`;
    return card;
  }
}
```

# Плагинная система (Features)

Фичи подключаются через `withFeatures(Base, ...features)` и становятся доступными как поля экземпляра. План зависимостей строится автоматически.

## ChildrenFeature

- Имя: `"children"`.
- Позволяет `renderStructure()` возвращать `Layout`, обеспечивает каскадный `destroy`.
- Методы:
    - `attach(child, host)` — смонтировать ребёнка в контейнер.
    - `detach(child)` — удалить и уничтожить ребёнка.
    - `register(child)` — только учесть для каскадного destroy.
    - `compose(child, opts?)` — вернуть host‑элемент под ребёнка.

Пример:

```ts
import { Layout, withFeatures, ChildrenFeature } from "@icrusai/ts-router";

class Parent extends withFeatures(Layout, ChildrenFeature) {
    protected renderStructure() {
        const child = new SomeChildLayout();
        return this.children.compose(child, { tag: "section" });
    }
}
```

## SlotsFeature

- Имя: `"slots"`, зависит от ChildrenFeature.
- Находит `<template slot="name">` в корне, заменяет их маркерами.
- `setSlot(name, content)` — вставляет строку/Node/Layout, поддерживает отложенные вставки.

Пример:

```ts
class Shell extends withFeatures(Layout, SlotsFeature<"header" | "content">) {
    protected renderStructure() {
        return `
      <div>
        <header><template slot="header"></template></header>
        <main><template slot="content"></template></main>
      </div>`;
    }
}

// usage
await shell.slots.setSlot("header", "<h1>Hello</h1>");
```

## TemplateFeature

- Имя: `"template"`.
- Компилирует HTML‑строку с `{{ expr }}` в DOM, создаёт реактивные бинды.
- Понимает `<layout type="CtorName">` и передаёт слоты через `<template slot>`.
- API:
    - `html(tpl, components?)` — возвращает HTMLElement (требует один корень).
    - `compileFragment(tpl, components?)` — DocumentFragment с любым числом корней.

Пример:

```ts
class LoginPage extends withFeatures(Page, TemplateFeature) {
    @reactive counter = 0;

    protected renderStructure() {
        return this.template.html(`
      <div>
        <h1>Clicks: {{ counter }}</h1>
        <button id="btn">Add</button>
      </div>
    `);
    }

    afterMount() {
        this.getElement()
            .querySelector("#btn")
            ?.addEventListener("click", () => this.counter++);
    }
}
```

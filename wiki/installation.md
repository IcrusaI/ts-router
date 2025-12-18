# Установка и базовый пример

## Установка

```bash
npm install @icrusai/ts-router
```

> Пакет размещён в GitHub Packages. В `.npmrc` понадобится:
> ```
> @icrusai:registry=https://npm.pkg.github.com
> //npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
> ```

## Быстрый старт

```ts
import { Router } from "@icrusai/ts-router";
import Page from "@icrusai/ts-router/dist/components/Page";

class HomePage extends Page {
  created() { this.title = "Главная"; }
  protected renderStructure() {
    const el = document.createElement("div");
    el.textContent = "Привет!";
    return el;
  }
}

const app = document.getElementById("app")!;

Router.register("/", () => HomePage);
Router.init(app, {
  defaultTitle: "Demo",
  notFound: () => import("./NotFoundPage"),
  errorPage: () => import("./ErrorPage"),
});

// позже можно обновить опции
Router.configure({
  defaultTitle: "Demo v2",
});
```

## Архитектура по верхам

- Router — матчит пути, гоняет middleware, монтирует Page, обновляет `document.title`, перехватывает `<a>`, скроллит к `#hash`.
- Page — надстройка над Layout: поле `title`, объект `route` с данными перехода, быстрый доступ к query.
- Features — плагины для Layout (children, slots, шаблон).
- Реактивность — сигналы (`signal`, `effect`, `computed`) и декоратор `@reactive`.

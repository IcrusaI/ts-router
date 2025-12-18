# Router: маршруты и навигация

## Инициализация

```ts
Router.init(container, {
  basePath: "/app",        // префикс в URL
  defaultTitle: "My App",  // fallback для вкладки
  notFound: () => import("./NotFoundPage"), // необязательно
  errorPage: () => import("./ErrorPage"),   // необязательно
});
```

Параметры: см. `RouterOptions` (basePath, defaultTitle, notFound, errorPage).

### Обновление настроек после запуска

`Router.configure(opts)` — единый способ поменять basePath/defaultTitle/notFound/errorPage в рантайме.

## Регистрация маршрутов

```ts
Router.register("/users/:id", () => import("./pages/UserPage"), {
  middlewares: [requireAuth],
});

Router.register("/legacy", () => import("./pages/Home"), {
  redirectTo: "/",
});
```

- `pattern` — поддерживает `:params`.
- `provider` — класс или `() => import()`.
- `RouteOptions`:
  - `middlewares?: NavigationGuard[]`
  - `redirectTo?: string`

## Программная навигация

```ts
await Router.navigate("/users/42", {
  replace: false,
  query: { tab: "posts", draft: null }, // null/undefined удаляют ключ
});
```

`navigate` нормализует путь, запускает middleware, выполняет redirect, синхронизирует историю и `document.title`, скроллит к hash или наверх.

## Middleware (NavigationGuard)

```ts
const requireAuth: NavigationGuard = async (to, from) => {
  if (!localStorage.getItem("token")) {
    await Router.navigate("/login", { replace: true, query: { redirect: to.fullPath } });
    return false;
  }
  return true;
};
```

Guard получает `CurrentRoute` для `to` и `from`. Возврат `false` отменяет переход.

## Специальные страницы

- Рекомендуемый способ — передать `notFound` / `errorPage` в `Router.init` или вызвать `Router.configure`.

## Авто‑перехват ссылок

Router перехватывает клики по внутренним `<a>` (LMB, без модификаторов, без `_blank`/`download`), строит SPA‑переход. Внешние и только‑hash ссылки не трогает.

## Данные маршрута (CurrentRoute)

`page.route` и аргументы middleware содержат:

- `path` — нормализованный путь без basePath и без query/hash.
- `params` — объект `:params`.
- `meta` — RouteOptions.
- `query` / `queryObj` — URLSearchParams и объект.
- `pattern` — совпавший паттерн.
- `hash` — строка с `#` или пустая.
- `fullPath` — path + query + hash (без basePath).
- `href` — итоговый URL с basePath.
- `basePath` — текущий префикс.

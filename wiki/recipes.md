# Рецепты и кейсы

## 1) Защищённые маршруты (auth guard)

```ts
import { Router, NavigationGuard } from "@icrusai/ts-router";

const requireAuth: NavigationGuard = async (to, from) => {
  if (!localStorage.getItem("token")) {
    await Router.navigate("/login", { replace: true, query: { redirect: to.fullPath } });
    return false;
  }
  return true;
};

Router.register("/dashboard", () => import("./pages/DashboardPage"), { middlewares: [requireAuth] });
```

## 2) Redirect‑маршрут

```ts
Router.register("/old-path", () => import("./pages/HomePage"), { redirectTo: "/" });
```

## 3) Работа с hash и автоскролл

```ts
await Router.navigate("/guide#install");
// Router сам проскроллит к элементу с id="install" если он есть
```

## 4) Слоты для layout’а

```ts
class Shell extends withFeatures(Layout, SlotsFeature<"header"|"content">) {
  protected renderStructure() {
    return `
      <div>
        <header><template slot="header"></template></header>
        <main><template slot="content"></template></main>
      </div>`;
  }
}

await shell.slots.setSlot("header", "<h1>Title</h1>");
await shell.slots.setSlot("content", document.createElement("p"));
```

## 5) HTML‑шаблон с биндами

```ts
class LoginPage extends withFeatures(Page, TemplateFeature) {
  @reactive counter = 0;
  protected renderStructure() {
    return this.template.html(`
      <div>
        <p>Clicks: {{ counter }}</p>
        <button id="inc">+</button>
      </div>
    `);
  }
  afterMount() {
    this.getElement().querySelector("#inc")?.addEventListener("click", () => this.counter++);
  }
}
```

## 6) basePath подподдержка

```ts
Router.init(app, {
  basePath: "/app",
  defaultTitle: "Admin",
});
Router.register("/users/:id", () => import("./pages/UserPage"));
// итоговый URL: /app/users/42
```

## 7) Передача данных маршрута в страницу

```ts
class UserPage extends Page {
  created() {
    const { params, queryObj, fullPath } = this.route;
    this.title = `User ${params.id}`;
    console.log(queryObj, fullPath);
  }
}
```

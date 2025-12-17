import { Page } from "@icrusai/ts-router";

export default class NotFoundPage extends Page {
    protected created() {
        this.title = "404 — Not Found";
    }

    protected renderStructure(): HTMLElement {
        const el = document.createElement("div");
        el.innerHTML = `<h1>404</h1><p>Страница не найдена</p>`;
        return el;
    }
}

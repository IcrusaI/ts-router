import { Page } from "@icrusai/ts-router";

export default class ErrorPage extends Page {
    public getTitle(): string { return "Error"; }
    protected renderStructure(): HTMLElement {
        const el = document.createElement("div");
        el.innerHTML = `<h1>Ошибка</h1><p>Что-то пошло не так</p>`;
        return el;
    }
}
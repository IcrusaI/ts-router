import { Page } from "@icrusai/ts-router";

export default class ErrorPage extends Page {
    /**
     * Заголовок страницы устанавливается в created(). Не присваивайте здесь.
     */
    public title!: string;

    protected created() {
        this.title = "Error";
    }

    protected renderStructure(): HTMLElement {
        const el = document.createElement("div");
        el.innerHTML = `<h1>Ошибка</h1><p>Что-то пошло не так</p>`;
        return el;
    }
}
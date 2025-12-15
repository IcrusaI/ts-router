import { Page } from "@icrusai/ts-router";
import ShellLayout from "../layouts/ShellLayout";

export default class HomePage extends Page {
    /**
     * Заголовок страницы устанавливается в created(). Не присваивайте здесь.
     */
    public title!: string;

    protected renderStructure() {
        const shell = new ShellLayout();

        const header = document.createElement("div");
        header.innerHTML = `<h1>Главная</h1><p>Query: ${window.location.search || "—"}</p>`;

        const sidebar = document.createElement("div");
        sidebar.innerHTML = `
      <ul>
        <li><a href="/?anchor#section">Прокрутка к #section</a></li>
        <li><a href="/users/1?tab=info">User 1 (tab=info)</a></li>
      </ul>
    `;

        const content = document.createElement("div");
        content.innerHTML = `
      <p>Это пример страницы с layout и слотами.</p>
      <div id="section" class="anchor">#section — якорь</div>
    `;

        void shell.slots.setSlot("header", header);
        void shell.slots.setSlot("sidebar", sidebar);
        void shell.slots.setSlot("content", content);

        return shell;
    }

    private interval?: NodeJS.Timeout;

    created() {
        // Устанавливаем исходное значение заголовка
        this.title = "Home";
        let counter = 0;
        this.interval = setInterval(() => {
            this.title = "●".repeat(counter) + " Home";
            counter++;
            if (counter > 3) {
                counter = 0;
            }
        }, 700);
    }

    beforeUnmount() {
        clearInterval(this.interval)
    }
}
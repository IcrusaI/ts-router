import { Page } from "@icrusai/ts-router";
import ShellLayout from "../layouts/ShellLayout";

export default class HomePage extends Page {
    /**
     * Заголовок страницы устанавливается в created(). Не присваивайте здесь.
     */
    public title!: string;

    protected renderStructure() {
        return this.html(`
          <layout type="ShellLayout">
            <template slot="header">
              <h1>Главная</h1>
              <p>Query: {{ queryString }}</p>
            </template>

            <template slot="sidebar">
              <ul>
                <li><a href="/?anchor#section">Прокрутка к #section</a></li>
                <li><a href="/users/1?tab=info">User 1 (tab=info)</a></li>
              </ul>
            </template>

            <template slot="content">
              <p>Это пример страницы с layout и слотами.</p>
              <div id="section" class="anchor">#section — якорь</div>
            </template>
          </layout>
        `, { ShellLayout });
    }

    // значение для {{ queryString }}
    get queryString(): string {
        return window.location.search || "—";
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
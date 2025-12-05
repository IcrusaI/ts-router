import { Page } from "@icrusai/ts-router";

/**
 * Пример страницы авторизации.
 * Использует метод html() для генерации DOM и добавляет
 * обработчик клика в mounted().
 */
export default class LoginPage extends Page {
  title = "Login";

  private reactiveVar: string;

    private interval?: NodeJS.Timeout;

    protected created() {
        this.$state('reactiveVar', "Hello!");
        let counter = 0;

        this.interval = setInterval(() => {
            this.reactiveVar = "●".repeat(counter) + " Hello!";

            counter++;

            if (counter > 3) {
                counter = 0;
            }
        }, 700);
    }
  protected renderStructure(): HTMLElement {
    // Разметку можно описывать как строку с минимальным HTML.
    // Здесь контекст не нужен, поэтому передаём пустой объект.
    return this.html(`
      <div>
        <h1>{{ reactiveVar }} - Login</h1>
        <p>Имитация логина. Нажми кнопку — установим pseudo-token в localStorage</p>
        <button id="btn">Login</button>
      </div>
    `);
  }

  afterMount() {
    // Навешиваем обработчик на кнопку после монтирования
    const btn = this.getElement().querySelector<HTMLButtonElement>("#btn");
    if (btn) {
      btn.addEventListener("click", () => {
        // сохраняем токен
        localStorage.setItem("token", "1");
        // переходим на dashboard
        history.pushState({}, "", "/dashboard");
        dispatchEvent(new PopStateEvent("popstate"));
      });
    }
  }

    beforeUnmount() {
        clearInterval(this.interval)
    }
}
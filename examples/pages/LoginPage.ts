import { Page, reactive } from "@icrusai/ts-router";

/**
 * Пример страницы авторизации.
 * Использует метод html() для генерации DOM и добавляет
 * обработчик клика в mounted().
 */
export default class LoginPage extends Page {
  /**
   * Заголовок страницы. Не задавайте значение здесь напрямую —
   * присваивайте его в хуке created(). Иначе реактивность не сработает.
   */
  title!: string;

  /**
   * Приватное реактивное свойство для демонстрации. Декоратор
   * `@reactive` автоматически превратит его в сигнал. В шаблоне
   * используйте `{{ reactiveVar }}` для подстановки значения.
   */
  @reactive
  private reactiveVar: string = "Hello!";

  private interval?: NodeJS.Timeout;

  protected created() {
    // Устанавливаем заголовок в момент создания
    this.title = "Login";
    let counter = 0;
    this.interval = setInterval(() => {
      // При каждой итерации обновляем реактивное свойство. Поскольку
      // оно стало сигналом, изменения автоматически отражаются в DOM.
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
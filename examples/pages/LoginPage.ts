import { Page } from "@icrusai/ts-router";

export default class LoginPage extends Page {
    title = "Login";

    protected renderStructure(): HTMLElement {
        const el = document.createElement("div");
        el.innerHTML = `
      <h1>Login</h1>
      <p>Имитация логина. Нажми кнопку — установим pseudo-token в localStorage</p>
      <button id="btn">Login</button>
    `;
        const btn = el.querySelector<HTMLButtonElement>("#btn")!;
        btn.addEventListener("click", () => {
            localStorage.setItem("token", "1");
            // вернёмся на dashboard
            history.pushState({}, "", "/dashboard");
            dispatchEvent(new PopStateEvent("popstate"));
        });
        return el;
    }
}
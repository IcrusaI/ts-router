import { Page } from "@icrusai/ts-router";
import ShellLayout from "../layouts/ShellLayout";

export default class DashboardPage extends Page<"header" | "sidebar" | "content"> {
    title = "Dashboard";

    protected renderStructure() {
        const shell = new ShellLayout();

        const header = document.createElement("div");
        header.innerHTML = `<h1>Dashboard</h1>`;

        const sidebar = document.createElement("div");
        sidebar.innerHTML = `
      <button id="logout">Logout</button>
    `;

        const content = document.createElement("div");
        content.innerHTML = `<p>Секретная зона только для авторизованных</p>`;

        void shell.slots.setSlot("header", header);
        void shell.slots.setSlot("sidebar", sidebar);
        void shell.slots.setSlot("content", content);

        // простая кнопка логаута
        setTimeout(() => {
            const btn = (shell.getElement().querySelector("#logout") as HTMLButtonElement | null);
            btn?.addEventListener("click", () => {
                localStorage.removeItem("token");
                history.pushState({}, "", "/login?redirect=/dashboard");
                dispatchEvent(new PopStateEvent("popstate"));
            });
        });

        return shell;
    }
}
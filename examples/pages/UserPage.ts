import { Page } from "@icrusai/ts-router";
import ShellLayout from "../layouts/ShellLayout";

function getUserIdFromPath(): string {
    // простой разбор из pathname, твой Router сам хранит params — здесь just demo
    const m = window.location.pathname.match(/\/users\/([^/]+)/);
    return m?.[1] ?? "unknown";
}

export default class UserPage extends Page<"header" | "sidebar" | "content"> {
    title = `User ${getUserIdFromPath()}`;

    protected renderStructure() {
        const shell = new ShellLayout();

        const header = document.createElement("div");
        header.innerHTML = `<h1>User: ${getUserIdFromPath()}</h1>`;

        const sidebar = document.createElement("div");
        sidebar.innerHTML = `
      <strong>Query</strong>
      <pre>${JSON.stringify(this.queryObj, null, 2)}</pre>
      <a href="/users/42?tab=posts#details">К пользователю 42</a>
    `;

        const content = document.createElement("div");
        content.innerHTML = `
      <p>Контент пользователя.</p>
      <div id="details" class="anchor">#details — якорь</div>
    `;

        void shell.slots.setSlot("header", header);
        void shell.slots.setSlot("sidebar", sidebar);
        void shell.slots.setSlot("content", content);
        return shell;
    }
}
import { Layout } from "@icrusai/ts-router";

export default class ShellLayout extends Layout<"header" | "sidebar" | "content"> {
    protected renderStructure(): HTMLElement {
        const root = document.createElement("div");
        root.className = "layout";
        root.innerHTML = `
      <aside class="sidebar">
        <h4>Sidebar</h4>
        <template slot="sidebar"></template>
      </aside>
      <main class="content">
        <header><template slot="header"></template></header>
        <section><template slot="content"></template></section>
      </main>
    `;

        return root;
    }
}
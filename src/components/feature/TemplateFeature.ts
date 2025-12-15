import Layout, { isLayoutLike, type LayoutLike } from "@/components/Layout";
import type ChildrenFeature from "@/components/feature/ChildrenFeature";
import { effect } from "@/utils/reactive";
import { IFeature } from "@/components/IFeature";

/**
 * Фича шаблонов.
 *
 * Поддержка:
 * - `{{ expr }}`: реактивная подстановка значения в DOM.
 * - если значение — `Node`, он вставляется внутрь placeholder-узла.
 * - если значение — `LayoutLike`, он монтируется в placeholder (через ChildrenFeature, если она подключена).
 *
 * Выражения вычисляются относительно host-layout (`this`), как и в текущем `Layout.html`.
 */
export default class TemplateFeature implements IFeature {
    private host!: Layout;
    private children?: ChildrenFeature;

    /** Активные компоновки, вставленные из шаблонов (для каскадного destroy). */
    private readonly mountedFromTemplate = new Set<LayoutLike>();

    onInit(host: Layout) {
        this.host = host;
        this.children = (host as any).children as ChildrenFeature | undefined;
    }

    async onDestroy() {
        // Если ChildrenFeature есть — она сама сделает destroy детей.
        // Здесь добиваем только те layout'ы, которые были смонтированы напрямую.
        if (this.children) {
            this.mountedFromTemplate.clear();
            return;
        }
        for (const c of this.mountedFromTemplate) {
            await c.destroy?.();
        }
        this.mountedFromTemplate.clear();
    }

    /**
     * Рендер HTML-строки в HTMLElement с реактивными вставками.
     * Важно: строка должна содержать ровно один корневой элемент.
     */
    html(tpl: string): HTMLElement {
        const binds: Array<{ id: number; expr: string }> = [];
        let i = 0;

        const compiled = tpl.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, expr) => {
            const id = i++;
            binds.push({ id, expr: String(expr).trim() });
            // placeholder всегда элемент (удобно как host для mount)
            return `<span data-bind="${id}"></span>`;
        });

        const root = this.parseSingleRoot(compiled);

        for (const { id, expr } of binds) {
            const hostNode = root.querySelector<HTMLElement>(`[data-bind="${id}"]`);
            if (!hostNode) continue;

            // runtime состояния для каждого placeholder
            let current: unknown = undefined;

            effect(() => {
                const value = this.evalExpr(expr);

                // 1) Строки/числа/булевы — текст
                if (!isLayoutLike(value) && !(value instanceof Node)) {
                    if (current && isLayoutLike(current)) void this.detachLayout(current as LayoutLike);
                    current = value;
                    hostNode.textContent = value != null ? String(value) : "";
                    return;
                }

                // 2) DOM Node — вставка
                if (value instanceof Node) {
                    if (current && isLayoutLike(current)) void this.detachLayout(current as LayoutLike);
                    if (current === value) return;
                    current = value;
                    this.clear(hostNode);
                    hostNode.append(value);
                    return;
                }

                // 3) LayoutLike — mount
                if (isLayoutLike(value)) {
                    if (current === value) return;
                    if (current && isLayoutLike(current)) void this.detachLayout(current as LayoutLike);
                    current = value;
                    void this.attachLayout(value, hostNode);
                }
            });
        }

        return root;
    }

    // --- internals ---

    private parseSingleRoot(html: string): HTMLElement {
        const t = document.createElement("template");
        t.innerHTML = html.trim();
        const { firstElementChild, childElementCount } = t.content;
        if (childElementCount !== 1 || !firstElementChild) {
            throw new Error("TemplateFeature.html(): template must contain exactly one root element");
        }
        return firstElementChild as HTMLElement;
    }

    private evalExpr(expr: string): unknown {
        let value: any = this.host as any;
        for (const part of expr.split(".")) {
            if (value == null) break;
            value = value[part];
        }
        if (typeof value === "function") value = value.call(this.host);
        return value as unknown;
    }

    private clear(el: HTMLElement) {
        while (el.firstChild) el.removeChild(el.firstChild);
        el.textContent = "";
    }

    private async attachLayout(child: LayoutLike, host: HTMLElement) {
        this.clear(host);
        if (this.children && (child as any) instanceof Layout) {
            await (this.children as any).attach(child as any, host);
            return;
        }
        await child.mountTo(host);
        this.mountedFromTemplate.add(child);
    }

    private async detachLayout(child: LayoutLike) {
        // Если есть ChildrenFeature и это настоящий Layout — корректнее detach.
        if (this.children && (child as any) instanceof Layout) {
            await (this.children as any).detach(child as any);
            return;
        }
        await child.destroy?.();
        this.mountedFromTemplate.delete(child);
    }
}

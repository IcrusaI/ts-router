import Layout from "@/components/Layout";
import { IFeature } from "@/components/IFeature";

/**
 * Фича управления дочерними компонентами (каскадный жизненный цикл + композиция).
 *
 * Задачи:
 * 1) Каскадный destroy всех детей.
 * 2) Композиция: разрешить renderStructure() возвращать Layout,
 *    при этом Layout сам не содержит children-логики.
 *
 * Механика композиции:
 * - afterRender(result): если result Layout -> создаём host HTMLElement и
 *   возвращаем host вместо layout; пару {host, child} кладём в pending.
 * - onMounted(): монтируем все pending children в соответствующие host.
 */
export default class ChildrenFeature implements IFeature<Layout> {
    private host?: Layout;

    /**
     * Реестр детей для каскадного destroy.
     * Тут держим и Layout, и Layout (если вдруг будут не Layout).
     */
    private readonly children = new Set<Layout>();

    /**
     * Пары host->child, которые надо смонтировать при onMounted.
     * Это нужно, потому что afterRender работает в момент построения root,
     * а монтирование логически происходит при mountTo().
     */
    private readonly pending: Array<{ hostEl: HTMLElement; child: Layout }> = [];

    // -----------------------
    // IFeature hooks
    // -----------------------

    onInit(host: Layout): void {
        this.host = host;
    }

    /**
     * Разрешает renderStructure() вернуть Layout.
     * Layout увидит только HTMLElement, потому что мы подменяем результат.
     */
    afterRender(result: unknown): unknown {
        if (result instanceof Layout) {
            const hostEl = document.createElement("div");
            hostEl.dataset.layoutHost = "";

            this.pending.push({ hostEl, child: result });
            this.children.add(result);

            return hostEl;
        }
        return result;
    }

    /**
     * После монтирования родителя — монтируем всех pending детей в их host.
     * Возвращаем cleanup не нужно: каскадный destroy выполнится в onDestroy().
     */
    async onMounted(): Promise<void> {
        // Важное свойство: pending может пополняться при последующих ensureRoot,
        // но по твоей модели root строится один раз. Тем не менее делаем корректно.
        while (this.pending.length) {
            const { hostEl, child } = this.pending.shift()!;
            await child.mountTo(hostEl);
        }
    }

    /**
     * Каскадный destroy детей.
     */
    async onDestroy(): Promise<void> {
        // Сначала пытаемся домонтировать pending, если вдруг destroy случился до mountTo
        while (this.pending.length) {
            const { hostEl, child } = this.pending.shift()!;
            try {
                await child.mountTo(hostEl);
            } catch {
                // если mount невозможен — всё равно попробуем destroy ниже
            }
        }

        for (const c of this.children) {
            if (typeof c.destroy === "function") {
                await c.destroy();
            }
        }

        this.children.clear();
    }

    // -----------------------
    // Public API
    // -----------------------

    /**
     * Смонтировать ребёнка в указанный host немедленно и добавить в реестр.
     * Удобно, когда у тебя есть конкретный контейнер, например slot/region.
     */
    async attach(child: Layout, host: Element | DocumentFragment): Promise<void> {
        await child.mountTo(host);
        this.children.add(child);
    }

    /**
     * Отсоединить/уничтожить ранее зарегистрированного ребёнка.
     */
    async detach(child: Layout): Promise<void> {
        if (!this.children.delete(child)) return;
        if (typeof child.destroy === "function") await child.destroy();
    }

    /**
     * Зарегистрировать ребёнка без монтирования.
     * Используй, когда mount произойдёт позже (например, TemplateFeature сам
     * вставил DOM и нужно только каскадное уничтожение).
     */
    register(child: Layout): void {
        this.children.add(child);
    }

    /**
     * Элегантная композиция без возврата Layout из renderStructure:
     * создаёт host HTMLElement, запоминает {host, child} в pending и
     * возвращает host (который можно вернуть из renderStructure()).
     *
     * Это fallback-API, если ты решишь НЕ расширять тип renderStructure.
     */
    compose(child: Layout, opts?: { tag?: keyof HTMLElementTagNameMap; datasetKey?: string }): HTMLElement {
        const hostEl = document.createElement(opts?.tag ?? "div");
        hostEl.dataset[opts?.datasetKey ?? "layoutHost"] = "";

        this.pending.push({ hostEl, child });
        this.children.add(child);

        return hostEl;
    }
}
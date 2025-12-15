import type Layout from "@/components/Layout";

import { IFeature  } from "@/components/IFeature";

/**
 * Фича управления дочерними компонентами (каскадный жизненный цикл).
 *
 * Назначение:
 * - Безопасно **присоединять** дочерние layout’ы к произвольному host-узлу (`attach`);
 * - По требованию **отсоединять** и уничтожать конкретного ребёнка (`detach`);
 * - На этапе уничтожения родителя автоматически **разрушать всех детей** (`onDestroy`).
 *
 * Где используется:
 * - Как фича `layout.children`, подключённая через декоратор `@Feature()`;
 * - В связке с композициями, когда `renderStructure()` возвращает дочерний `LayoutLike`:
 *   родитель монтирует ребёнка во внутренний host, а `ChildrenFeature` гарантирует
 *   каскадный `destroy()` при уничтожении родителя.
 */
export default class ChildrenFeature implements IFeature {
    /**
     * Текущее множество дочерних layout’ов, присоединённых через {@link attach}.
     * Держим слабые ссылки на уровне логики (не DOM), чтобы корректно выполнить
     * каскадный `destroy()` в {@link onDestroy}.
     *
     * Замечание: предполагается, что `CoreLayout.destroy()` у детей снимает
     * все их DOM-подписки и освобождает ресурсы.
     * @private
     */
    private readonly children = new Set<Layout>();

    /**
     * Зарегистрировать ребёнка для каскадного destroy без немедленного mount.
     *
     * Используется в синхронной фазе композиции (например, при обработке
     * `<layout type="...">` внутри шаблона), когда требуется, чтобы
     * `renderStructure()` уже вернул готовый DOM, но дочерний компонент
     * будет считаться «принадлежащим» родителю и должен быть уничтожен
     * вместе с ним.
     */
    register(child: Layout): void {
        this.children.add(child);
    }

    /**
     * Присоединить дочерний layout к произвольному host (элемент или фрагмент).
     *
     * Что происходит:
     * 1) Вызывается `child.mountTo(host)` — ребёнок монтирует свой корень внутрь host;
     * 2) Ребёнок регистрируется во внутреннем реестре для последующего каскадного destroy.
     *
     * @param child Экземпляр дочернего компонента (`CoreLayout` или наследник).
     * @param host Узел-контейнер, в который требуется смонтировать ребёнка:
     *             `Element` (обычный DOM-элемент) или `DocumentFragment`.
     *
     * @example
     * ```ts
     * const shell = new ShellLayout().with("children", new ChildrenFeature());
     * await shell.children.attach(new SidebarLayout(), shell.getElement().querySelector("aside")!);
     * ```
     */
    async attach(child: Layout, host: Element | DocumentFragment): Promise<void> {
        await child.mountTo(host);
        this.children.add(child);
    }

    /**
     * Отсоединить и уничтожить ранее присоединённого ребёнка.
     *
     * Если указанный ребёнок зарегистрирован во внутреннем реестре, он будет:
     *  - удалён из множества;
     *  - корректно уничтожен через `child.destroy()`.
     * Если ребёнок не найден — метод тихо завершится (no-op).
     *
     * @param child Ребёнок, которого нужно отсоединить и уничтожить.
     *
     * @example
     * ```ts
     * await shell.children.detach(sidebar);
     * ```
     */
    async detach(child: Layout): Promise<void> {
        if (this.children.delete(child)) await child.destroy();
    }

    /**
     * Хук фичи: родительский layout уничтожается.
     *
     * Поведение:
     *  - для каждого зарегистрированного ребёнка вызывается `destroy()`;
     *  - внутренний реестр очищается.
     *
     * Вызывается автоматически из {@link Layout.destroy}.
     */
    async onDestroy(): Promise<void> {
        for (const c of this.children) await c.destroy();
        this.children.clear();
    }
}
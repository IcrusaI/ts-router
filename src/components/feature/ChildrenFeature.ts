import type CoreLayout from "@/components/CoreLayout";
import type { Feature } from "@/components/CoreLayout";

/**
 * Фича управления дочерними компонентами (каскадный жизненный цикл).
 *
 * Назначение:
 * - Безопасно **присоединять** дочерние layout’ы к произвольному host-узлу (`attach`);
 * - По требованию **отсоединять** и уничтожать конкретного ребёнка (`detach`);
 * - На этапе уничтожения родителя автоматически **разрушать всех детей** (`onDestroy`).
 *
 * Где используется:
 * - Как самостоятельная фича, добавляемая через `layout.with("children", new ChildrenFeature())`;
 * - В связке с композициями, когда `renderStructure()` возвращает дочерний `LayoutLike`:
 *   родитель монтирует ребёнка во внутренний host, а `ChildrenFeature` гарантирует
 *   каскадный `destroy()` при уничтожении родителя.
 */
export class ChildrenFeature implements Feature {
    /**
     * Текущее множество дочерних layout’ов, присоединённых через {@link attach}.
     * Держим слабые ссылки на уровне логики (не DOM), чтобы корректно выполнить
     * каскадный `destroy()` в {@link onDestroy}.
     *
     * Замечание: предполагается, что `CoreLayout.destroy()` у детей снимает
     * все их DOM-подписки и освобождает ресурсы.
     * @private
     */
    private readonly children = new Set<CoreLayout>();

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
    async attach(child: CoreLayout, host: Element | DocumentFragment): Promise<void> {
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
    async detach(child: CoreLayout): Promise<void> {
        if (this.children.delete(child)) await child.destroy();
    }

    /**
     * Хук фичи: родительский layout уничтожается.
     *
     * Поведение:
     *  - для каждого зарегистрированного ребёнка вызывается `destroy()`;
     *  - внутренний реестр очищается.
     *
     * Вызывается автоматически из {@link CoreLayout.destroy}.
     */
    async onDestroy(): Promise<void> {
        for (const c of this.children) await c.destroy();
        this.children.clear();
    }
}
import Layout, {Hook, LayoutLike} from "@/components/Layout";

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
     * Зарегистрировать дочерний layout без монтирования.
     *
     * В отличие от {@link attach}, этот метод лишь добавляет ребёнка
     * во внутренний реестр для корректного каскадного destroy, но не вызывает
     * `child.mountTo`. Используется, когда рендеринг дочернего layout
     * происходит синхронно в процессе шаблонизации (например, через
     * TemplateFeature), и mount будет вызван позже вместе с родителем.
     *
     * @param child Дочерний layout для регистрации.
     */
    register(child: Layout): void {
        this.children.add(child);
    }

    async onMounted() {
        if (firstTime && this._composedChild) {
            const child = this._composedChild.child;
            const host = this._composedChild.host;

            // todo: перенести привязку в сам ChildrenFeature (инъекция)
            const childrenFx = (this as any)["children"] as {
                attach?: (c: LayoutLike, h: Element | DocumentFragment) => Promise<void>;
            } | undefined;

            if (!childrenFx?.attach) {
                throw new Error(
                    "renderStructure() returned a Layout instance, but ChildrenFeature is not attached. " +
                    "Attach ChildrenFeature (this.children) before returning a child layout."
                );
            }
            await childrenFx.attach(child, host);
            this._composedChild = undefined;
        }
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
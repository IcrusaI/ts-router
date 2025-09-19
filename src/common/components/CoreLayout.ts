/**
 * Тип возвращаемого значения для асинхронных хуков жизненного цикла.
 * Хук может быть синхронным (void) или асинхронным (Promise<void>).
 */
export type Hook = void | Promise<void>;

/**
 * Плагин (feature) для {@link CoreLayout}.
 *
 * Плагин может реагировать на ключевые моменты жизненного цикла корневого
 * компонента и расширять его поведение. Плагины регистрируются методом
 * {@link CoreLayout.with} и становятся доступными как поля экземпляра
 * (например, `layout.slots`, `layout.children`).
 *
 * @typeParam Host Конкретный тип хоста (обычно сам CoreLayout или его наследник).
 */
export interface Feature<Host extends CoreLayout = CoreLayout> {
    /**
     * Инициализация плагина: хост уже создан, но корневой DOM ещё не построен.
     * Вызывается сразу при регистрации плагина в {@link CoreLayout.with}.
     *
     * @param host Экземпляр хоста.
     */
    onInit?(host: Host): void;

    /**
     * Корневой DOM-элемент создан, но ещё может не находиться в документе.
     * Удобно собирать ссылки на поддеревья, искать `<template>` и т.п.
     *
     * @param root Корневой HTMLElement хоста.
     */
    onRootCreated?(root: HTMLElement): void;

    /**
     * Хостовый корень уже вставлен в DOM (после {@link CoreLayout.mountTo}).
     * Можно выполнять измерения, подключать наблюдателей и пр.
     */
    onMounted?(): Hook;

    /**
     * Хост собирается уничтожаться ({@link CoreLayout.destroy}).
     * Здесь освобождаем ресурсы (таймеры, подписки, каскадный destroy и т.д.).
     */
    onDestroy?(): Hook;
}

/**
 * Минимальный «layout-подобный» контракт для композиции.
 * Используется, когда {@link CoreLayout.renderStructure} возвращает не `HTMLElement`,
 * а дочерний layout, который надо смонтировать внутрь родителя.
 */
export interface LayoutLike {
    /**
     * Смонтировать компонент в указанный контейнер.
     */
    mountTo(container: Element | DocumentFragment): Promise<void>;

    /**
     * Опциональный метод освобождения ресурсов.
     */
    destroy?(): Promise<void>;
}

/**
 * Type guard: является ли объект layout-подобным.
 *
 * @param x Любое значение.
 * @returns `true`, если у объекта есть функция `mountTo(...)`.
 */
export function isLayoutLike(x: unknown): x is LayoutLike {
    return !!x && typeof (x as any).mountTo === "function";
}

/**
 * Базовый минимальный layout-ядро без фреймворка.
 *
 * Возможности:
 * - Lazy-инициализация DOM через переопределяемый {@link renderStructure};
 * - Монтирование/демонтаж с асинхронными хуками жизненного цикла;
 * - Система плагинов/фич ({@link with}), которые доступны как поля экземпляра;
 * - Управление состоянием (`setState`) и безопасные DOM-подписки (`addEvent`);
 * - Композиция: {@link renderStructure} может вернуть другой layout
 *   ({@link LayoutLike}); его монтирование произойдёт автоматически,
 *   **но для каскадного destroy должен быть подключён ChildrenFeature**.
 */
export default abstract class CoreLayout {
    /** Корневой DOM-элемент компонента (создаётся при первом обращении). */
    private root?: HTMLElement;

    /** Флаг: был ли компонент смонтирован. */
    private _mounted = false;

    /**
     * Зарегистрированные отписчики DOM-событий, добавленных через {@link addEvent}.
     * При destroy() каждый будет вызван для снятия соответствующего listener’а.
     */
    private readonly listeners: Array<() => void> = [];

    /**
     * Зарегистрированные плагины (features), доступные также как поля экземпляра.
     * Ключ — имя фичи (передаётся в {@link with}), значение — инстанс фичи.
     */
    private readonly _features = new Map<string, Feature<this>>();

    /**
     * Дочерний layout, возвращённый из {@link renderStructure}, и host-контейнер
     * для его монтирования. Применяется один раз при первом {@link mountTo}.
     */
    private _composedChild?: { child: LayoutLike; host: HTMLElement };

    /**
     * Конструктор: синхронно вызывает опциональный хук {@link created}.
     * Плагины можно добавлять как до, так и после создания экземпляра, но до mount.
     */
    constructor() {
        this.created?.();
    }

    // —— плагины ————————————————————————————————————————————————

    /**
     * Подключить плагин (feature) к текущему экземпляру и сделать его доступным
     * как поле. Например:
     *
     * ```ts
     * const layout = new MyLayout()
     *   .with("children", new ChildrenFeature())
     *   .with("slots", new SlotsFeature());
     *
     * layout.children.attach(...);
     * layout.slots.setSlot(...);
     * ```
     *
     * @typeParam K Имя поля, под которым фича будет доступна на экземпляре.
     * @typeParam T Тип самой фичи.
     * @param key Уникальное имя фичи (станет полем экземпляра).
     * @param feature Инстанс фичи.
     * @throws Если фича с таким именем уже установлена.
     * @returns Текущий экземпляр с расширенным типом, включающим поле `key`.
     */
    public with<K extends string, T extends Feature<this>>(key: K, feature: T) {
        if (this._features.has(key)) throw new Error(`Feature "${key}" already installed`);
        this._features.set(key, feature);
        feature.onInit?.(this);
        Object.defineProperty(this, key, {
            value: feature,
            enumerable: true,
            configurable: false,
            writable: false,
        });
        return this as unknown as this & Record<K, T>;
    }

    /**
     * Утилита для последовательного вызова хук-методов на всех фичах.
     * Используется внутренне в жизненном цикле.
     *
     * @param fn Функция, вызываемая для каждой зарегистрированной фичи.
     * @returns Промис, завершающийся после завершения всех вызовов.
     * @protected
     */
    protected forEachFeature(fn: (f: Feature<this>) => Hook): Hook {
        const arr = Array.from(this._features.values());
        return arr.reduce<Promise<void>>(async (p, f) => {
            await p; await fn(f);
        }, Promise.resolve());
    }

    // —— lifecycle ————————————————————————————————————————————————

    /**
     * Смонтировать компонент в указанный контейнер.
     *
     * Порядок:
     * 1) Лениво создаётся корневой DOM (`ensureRoot` → `renderStructure`);
     * 2) Если вызывается впервые — `beforeMount?()`;
     * 3) Корень вставляется в контейнер;
     * 4) Если {@link renderStructure} вернул дочерний `LayoutLike`,
     *    он будет смонтирован **сейчас** в специальный host внутри корня.
     *    Для каскадного уничтожения ребёнка требуется подключённый ChildrenFeature
     *    (ожидается поле `this.children.attach`), иначе выбрасывается ошибка;
     * 5) Для всех фич вызывается `onMounted?()`;
     * 6) Вызывается `afterMount?()`.
     *
     * Повторные вызовы `mountTo` просто перемещают уже существующий корень
     * в новый контейнер и снова уведомляют фичи через `onMounted`.
     *
     * @param container Целевой контейнер (Element или DocumentFragment).
     */
    public async mountTo(container: Element | DocumentFragment): Promise<void> {
        if (!this.root) this.ensureRoot();

        const firstTime = !this._mounted;
        if (firstTime) await this.beforeMount?.();

        container.append(this.root!);
        this._mounted = true;

        // Если renderStructure() вернул layout — прикрепим его СЕЙЧАС
        if (firstTime && this._composedChild) {
            const child = this._composedChild.child;
            const host = this._composedChild.host;

            // todo: перенести привязку в сам ChildrenFeature (инъекция)
            const childrenFx = (this as any)["children"] as {
                attach?: (c: LayoutLike, h: Element | DocumentFragment) => Promise<void>;
            } | undefined;

            if (!childrenFx?.attach) {
                throw new Error(
                    "renderStructure() вернул Layout, но ChildrenFeature не подключён. " +
                    "Подключи feature: new ChildrenFeature() и обращайся как this.children."
                );
            }
            await childrenFx.attach(child, host);
            this._composedChild = undefined;
        }

        await this.forEachFeature(f => f.onMounted?.());
        await this.afterMount?.();
    }

    /**
     * Полностью уничтожить компонент:
     * - `beforeUnmount?()`;
     * - `features.onDestroy?()` для всех фич;
     * - удалить корневой DOM и сбросить флаг `_mounted`;
     * - `unmounted?()`;
     * - снять все DOM-подписки, оформленные через {@link addEvent}.
     *
     * Повторные вызовы безопасны (no-op, если компонент не смонтирован).
     */
    public async destroy(): Promise<void> {
        if (this._mounted && this.root) {
            await this.beforeUnmount?.();
            await this.forEachFeature(f => f.onDestroy?.());
            this.root.remove();
            this._mounted = false;
            await this.unmounted?.();
        }
        this.listeners.forEach(off => off());
        this.listeners.length = 0;
    }

    /**
     * Доступ к корневому DOM-элементу (лениво создаётся при первом обращении).
     */
    public getElement(): HTMLElement {
        if (!this.root) this.ensureRoot();
        return this.root!;
    }

    /**
     * Признак, что компонент в смонтированном состоянии.
     * Полезен в наследниках для условного поведения.
     */
    protected get mounted(): boolean {
        return this._mounted;
    }

    /**
     * Внутренняя инициализация корневого DOM.
     *
     * - Если {@link renderStructure} вернул `LayoutLike`, создаётся host-контейнер
     *   (div[data-layout-host]) для родителя, а сам ребёнок откладывается
     *   до первого `mountTo()` (там произойдёт корректный attach в DOM).
     * - Если возвращён `HTMLElement`, он становится корнем.
     * - В обоих случаях фичи получают событие {@link Feature.onRootCreated}.
     *
     * @throws Если {@link renderStructure} вернул неподдерживаемый тип.
     */
    private ensureRoot(): void {
        const node = this.renderStructure();

        // 1) Возвращён дочерний layout: создаём host и откладываем attach до mountTo()
        if (isLayoutLike(node)) {
            const host = document.createElement("div");
            host.dataset.layoutHost = "";
            this.root = host;
            this._composedChild = { child: node, host };
            void this.forEachFeature(f => f.onRootCreated?.(host));
            return;
        }

        // 2) Обычный HTMLElement
        if (!(node instanceof HTMLElement)) {
            throw new Error("renderStructure() должен вернуть HTMLElement или Layout");
        }
        this.root = node;
        void this.forEachFeature(f => f.onRootCreated?.(node));
    }

    // —— state/events ————————————————————————————————————————————————

    /**
     * Частичное обновление внутреннего состояния компонента с вызовом
     * пользовательского `update?()` (если определён).
     *
     * @param partial Объект с полями для слияния в текущее состояние.
     */
    protected readonly state: Record<string, any> = {};

    public setState(partial: Record<string, any>): void {
        Object.assign(this.state, partial);
        this.update?.();
    }

    /**
     * Безопасная подписка на DOM-событие: listener автоматически снимается
     * при {@link destroy}. Используй вместо ручного `addEventListener`,
     * чтобы избежать утечек.
     *
     * @typeParam K Тип события (см. стандартную карту событий HTMLElement).
     * @param el Элемент-источник события.
     * @param type Тип события (например, `"click"`).
     * @param handler Обработчик события.
     *
     * @example
     * ```ts
     * this.addEvent(button, "click", () => this.onClick());
     * ```
     */
    protected addEvent<K extends keyof HTMLElementEventMap>(
        el: HTMLElement,
        type: K,
        handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any
    ): void {
        el.addEventListener(type, handler);
        this.listeners.push(() => el.removeEventListener(type, handler));
    }

    // —— overridables ————————————————————————————————————————————————

    /**
     * Построить DOM-структуру компонента.
     *
     * Возвращаемое значение:
     * - `HTMLElement` — станет корневым DOM данного layout’а;
     * - `LayoutLike` — дочерний layout, который будет автоматически
     *   смонтирован внутрь специального host-контейнера при первом `mountTo()`.
     *   Для каскадного destroy ребёнка рекомендуется подключить ChildrenFeature.
     */
    protected abstract renderStructure(): HTMLElement | LayoutLike;

    /** Хук: экземпляр создан, DOM ещё не построен. */
    protected created?(): void;
    /** Хук: перед первым вставлением корня в DOM. */
    protected beforeMount?(): Hook;
    /** Хук: после вставки корня в DOM. */
    protected afterMount?(): Hook;
    /** Хук: перед удалением корня из DOM. */
    protected beforeUnmount?(): Hook;
    /** Хук: после удаления корня из DOM. */
    protected unmounted?(): Hook;
    /** Пользовательский «ручной» апдейт, вызывается из {@link setState}. */
    protected update?(): void;
}
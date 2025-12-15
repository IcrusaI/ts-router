import { signal} from "@/utils/reactive";
import {forEachFeature} from "@/utils/feature/featureRegistry";
import Feature from "@/utils/feature/Feature";
import {TemplateFeature} from "@/index";

/**
 * Internal symbol used to mark whether reactive properties have been
 * initialised on a CoreLayout instance. This symbol lives outside of the
 * class definition to avoid collisions on `this` and to keep it
 * non-enumerable.
 */
const _reactiveInitialised = Symbol("__reactiveInitialised");

/**
 * Helper interface describing a constructor function that may carry
 * reactive metadata. Classes decorated with {@link reactive} attach a
 * `__reactiveProps` set to their constructor to record which properties
 * were decorated.
 */
interface ReactiveConstructor extends Function {
  __reactiveProps?: Set<string>;
}

/**
 * Тип возвращаемого значения для асинхронных хуков жизненного цикла.
 * Хук может быть синхронным (void) или асинхронным (Promise<void>).
 */
export type Hook = void | Promise<void>;

/**
 * Базовый минимальный layout-ядро без фреймворка.
 *
 * Возможности:
 * - Lazy-инициализация DOM через переопределяемый {@link renderStructure};
 * - Монтирование/демонтаж с асинхронными хуками жизненного цикла;
 * - Система плагинов/фич ({@link with}), которые доступны как поля экземпляра;
 * - Управление состоянием (`setState`) и безопасные DOM-подписки (`addEvent`);
 * - Композиция: {@link renderStructure} может вернуть другой layout
 *   ({@link Layout}); его монтирование произойдёт автоматически,
 *   **но для каскадного destroy должен быть подключён ChildrenFeature**.
 */
export default abstract class Layout {
    @Feature(TemplateFeature)
    protected template!: TemplateFeature;

    /** Корневой DOM-элемент компонента (создаётся при первом обращении). */
    private root?: HTMLElement;

    /** Флаг: был ли компонент смонтирован. */
    private _mounted = false;

    /**
     * Зарегистрированные отписчики DOM-событий, добавленных через {@link addEvent}.
     * При destroy() каждый будет вызван для снятия соответствующего listener’а.
     */
    private readonly listeners: Array<() => void> = [];

    private readonly cleanups: Array<() => Promise<void>> = [];


    /**
     * Конструктор: синхронно вызывает опциональный хук {@link created}.
     * Плагины можно добавлять как до, так и после создания экземпляра, но до mount.
     */
    constructor() {
        this.created?.();

        queueMicrotask(() => {
            void forEachFeature(this, (f: any) => f.onFeaturesReady?.(this));
        });    }

    /**
     * Once per-instance routine to upgrade declared fields into reactive
     * properties. Fields that start with a dollar sign (`$`) or that were
     * decorated with the `@reactive` decorator will be converted into
     * getters/setters backed by a signal. This method is called lazily
     * just before the first template is rendered, so that class field
     * initialisers in derived classes have already executed. It avoids
     * scanning repeatedly by marking the instance with a private symbol.
     */
    private ensureReactiveProps(): void {
        // Only run once per instance
        if ((this as any)[_reactiveInitialised]) return;
        (this as any)[_reactiveInitialised] = true;

        // Gather property names explicitly marked via @reactive
        const ctor: ReactiveConstructor = (this as any).constructor;
        const marked: Set<string> = ctor.__reactiveProps ?? new Set<string>();

        // Names which should never be made reactive (framework internals).  
        // "title" is handled specially by Page and has its own signal.
        const reserved = new Set<string>([
            'state',
            'children',
            'slots',
            'title',
        ]);

        // Iterate over own enumerable properties. Field initialisers are
        // defined on the instance, so they will show up here. Methods live
        // on the prototype and will not be considered.
        for (const key of Object.keys(this)) {
            // Skip private/underscore-prefixed names and reserved names
            if (key.startsWith('_')) continue;
            if (reserved.has(key)) continue;

            const value: any = (this as any)[key];

            // Skip functions (methods) entirely
            if (typeof value === 'function') continue;

            // Determine whether this property should be reactive: either it
            // begins with `$` or is present in the set of marked props
            const shouldReactive = key.startsWith('$') || marked.has(key);
            if (!shouldReactive) continue;

            // If a getter/setter already exists, leave it as is
            const desc = Object.getOwnPropertyDescriptor(this, key);
            if (desc && (desc.get || desc.set)) continue;

            // If the value itself is already a signal (created via signal()),
            // simply proxy through to its getter/setter
            if (typeof value === 'function' && (value as any).__isSignal) {
                const sig = value as any;
                Object.defineProperty(this, key, {
                    get: () => sig(),
                    set: (v: any) => sig.set(v),
                    enumerable: true,
                    configurable: true,
                });
                continue;
            }

            // Otherwise create a new signal wrapping the current value
            const sig = signal(value);
            Object.defineProperty(this, key, {
                get: () => sig(),
                set: (v: any) => sig.set(v),
                enumerable: true,
                configurable: true,
            });
        }
    }

    // —— lifecycle ————————————————————————————————————————————————
    private registerCleanup(cleanup: any) {
        if (!cleanup) return;
        if (typeof cleanup === "function") {
            this.cleanups.push(async () => {
                await cleanup();
            });
        }
    }
    /**
     * Смонтировать компонент в указанный контейнер.
     *
     * Порядок:
     * 1) Лениво создаётся корневой DOM (`ensureRoot` → `renderStructure`);
     * 2) Если вызывается впервые — `beforeMount?()`;
     * 3) Корень вставляется в контейнер;
     * 4) Если {@link renderStructure} вернул дочерний `Layout`,
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
        if (firstTime) {
            await forEachFeature(this, (f: any) => f.beforeMountRoot?.(this.root!));
            await this.beforeMount?.();
        }

        container.append(this.root!);
        this._mounted = true;

        // onMounted
        forEachFeature(this, (f: any) => {
            const c = f.onMounted?.();
            this.registerCleanup(c);
        });

        await this.afterMount?.();

        // afterMounted (точно после afterMount)
        forEachFeature(this, (f: any) => {
            const c = f.afterMounted?.();
            this.registerCleanup(c);
        });
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
        forEachFeature(this, (f: any) => f.beforeDestroy?.());

        if (this._mounted && this.root) {
            await this.beforeUnmount?.();

            forEachFeature(this, (f: any) => {
                const c = f.onDestroy?.();
                this.registerCleanup(c);
            });

            // снимаем зарегистрированные cleanup-и (в т.ч. от onMounted/afterMounted/effect)
            for (const c of this.cleanups.splice(0)) await c();

            this.root.remove();
            this._mounted = false;

            forEachFeature(this, (f: any) => {
                const c = f.afterDestroy?.();
                this.registerCleanup(c);
            });

            // cleanup-и afterDestroy
            for (const c of this.cleanups.splice(0)) await c();

            await this.unmounted?.();
        } else {
            // если не смонтирован — всё равно снять cleanup-и (effects и т.п.)
            for (const c of this.cleanups.splice(0)) await c();
        }

        this.listeners.forEach((off) => off());
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
     * - Если {@link renderStructure} вернул `Layout`, создаётся host-контейнер
     *   (div[data-layout-host]) для родителя, а сам ребёнок откладывается
     *   до первого `mountTo()` (там произойдёт корректный attach в DOM).
     * - Если возвращён `HTMLElement`, он становится корнем.
     * - В обоих случаях фичи получают событие {@link Feature.onRootCreated}.
     *
     * @throws Если {@link renderStructure} вернул неподдерживаемый тип.
     */
    private ensureRoot(): void {
        forEachFeature(this, (f: any) => f.beforeRender?.());

        let node: any = this.renderStructure();

        // Поскольку ensureRoot синхронный в текущей архитектуре,
        // здесь deliberately оставляем afterRender синхронным по умолчанию.
        // Если хочешь поддержать async afterRender — нужно сделать ensureRoot async.
        // Поэтому здесь исполняем только sync-часть:
        forEachFeature(this, (f: any) => {
            if (!f.afterRender) return;
            const out = f.afterRender(node);
            // если фича вернула Promise — это ошибка конфигурации (см. комментарий выше)
            if (out && typeof (out as any).then === "function") {
                throw new Error("IFeature.afterRender() must be synchronous in current Layout.ensureRoot()");
            }
            node = out;
        });

        // ── 0) string html
        if (typeof node === "string") {
            const tpl = document.createElement("template");
            tpl.innerHTML = node.trim();
            const { firstElementChild, childElementCount } = tpl.content;
            if (childElementCount !== 1 || !firstElementChild) {
                throw new Error(
                    "renderStructure(): HTML string must contain exactly one root element. Example: <section>...</section>"
                );
            }
            node = firstElementChild as HTMLElement;
        }

        // 2) HTMLElement
        if (!(node instanceof HTMLElement)) {
            throw new Error("renderStructure() must return HTMLElement");
        }
        this.root = node;
        forEachFeature(this, (f: any) => f.onRootCreated?.(node));
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
        void forEachFeature(this, (f: any) => f.beforeUpdate?.(partial));
        void forEachFeature(this, (f: any) => f.onStateChanged?.(partial));

        Object.assign(this.state, partial);
        this.update?.();

        void forEachFeature(this, (f: any) => f.afterUpdate?.(partial));
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
     * Возможные варианты возвращаемого значения:
     *
     * - **`HTMLElement`** — станет корневым DOM-элементом данного layout’а;
     * - **`string`** — HTML-строка, которая **должна содержать ровно один корневой элемент**;
     * - **`Layout`** — дочерний layout, который будет автоматически
     *   смонтирован внутрь специального host-контейнера при первом вызове {@link mountTo}.
     *   Для каскадного уничтожения ребёнка рекомендуется подключить `ChildrenFeature`.
     *
     * @returns `HTMLElement` | `string`
     */
    protected abstract renderStructure(): HTMLElement | string | unknown;

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
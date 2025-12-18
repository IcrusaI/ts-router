import DisposableScope from "@/utils/disposables";
import { buildFeaturePlan, collectFeatureSpecs } from "@/components/feature/featureSpecs";
import { FeatureCtor, FeatureLifecycle } from "@/components/feature/contracts/FeatureLifecycle";

/**
 * Тип возвращаемого значения для асинхронных хуков жизненного цикла.
 * Хук может быть синхронным (void) или асинхронным (Promise<void>).
 */
export type Hook = void | Promise<void>;

/**
 * Базовое ядро Layout без фреймворка.
 *
 * Возможности:
 * - ленивое построение DOM через переопределяемый {@link renderStructure};
 * - монтирование/демонтаж с хуками жизненного цикла;
 * - система фич через {@link withFeatures}, фичи доступны как поля экземпляра;
 * - безопасные подписки на DOM через {@link addEvent};
 */
export default abstract class Layout {
    /** Корневой DOM-элемент компонента (создаётся при первом обращении). */
    private root?: HTMLElement;

    /** Флаг: был ли компонент смонтирован. */
    private _isMounted = false;

    /**
     * Общий контейнер для всех disposer-функций (DOM-события, эффекты и т.п.).
     */
    private readonly disposables = new DisposableScope();

    /** Реестр подключённых фич. */
    private readonly features = new Map<string, FeatureLifecycle<Layout>>();
    /**
     * Конструктор: синхронно вызывает опциональный хук {@link created}.
     * Плагины можно добавлять как до, так и после создания экземпляра, но до mount.
     */
    constructor() {
        const ctor = this.constructor as any;
        const specs = collectFeatureSpecs(ctor);
        const plan = buildFeaturePlan(specs);

        for (const { name, ctor: Fx, expose, instance } of plan) {
            const featureInstance = instance ?? new Fx();
            if (expose) (this as any)[name] = featureInstance;
            this.attachFeature(name, featureInstance);
        }

        queueMicrotask(() => this.forEachFeature((feature) => feature.onFeaturesReady?.(this)));

        this.created?.();
    }

    /**
     * Получить установленную фичу по имени или конструктору.
     * Удобно для межфичевого взаимодействия и работы с зависимостями.
     */
    public getFeature<F extends FeatureLifecycle>(
        key: string | FeatureCtor<any, F, any>
    ): F | undefined {
        return this.findFeature(key) as F | undefined;
    }

    // —— feature helpers ————————————————————————————————
    private attachFeature(name: string, feature: FeatureLifecycle<Layout>) {
        if (this.features.has(name)) throw new Error(`Feature "${name}" already installed`);
        this.features.set(name, feature);
        feature.onInit?.(this);
    }

    private findFeature(key: string | FeatureCtor<any, any, any>) {
        if (typeof key === "string") return this.features.get(key);
        for (const f of this.features.values()) {
            if (f instanceof key) return f;
        }
        return undefined;
    }

    private forEachFeature(cb: (feature: FeatureLifecycle<Layout>) => void) {
        for (const f of this.features.values()) cb(f);
    }

    // —— lifecycle ————————————————————————————————————————————————
    private registerCleanup(cleanup: any) {
        if (!cleanup) return;
        if (typeof cleanup === "function") {
            this.disposables.add(async () => {
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

        const firstTime = !this._isMounted;
        if (firstTime) {
            await this.forEachFeature((f) => f.beforeMountRoot?.(this.root!));
            await this.beforeMount?.();
        }

        container.append(this.root!);
        this._isMounted = true;

        // onMounted
        this.forEachFeature((f) => {
            const c = f.onMounted?.();
            this.registerCleanup(c);
        });

        await this.afterMount?.();

        // afterMounted (точно после afterMount)
        this.forEachFeature((f) => {
            const c = f.afterMounted?.();
            this.registerCleanup(c);
        });
    }

    /**
     * Полностью уничтожить компонент:
     * - `beforeUnmount?()`;
     * - `features.onDestroy?()` для всех фич;
     * - удалить корневой DOM и сбросить флаг `_isMounted`;
     * - `unmounted?()`;
     * - снять все DOM-подписки, оформленные через {@link addEvent}.
     *
     * Повторные вызовы безопасны (no-op, если компонент не смонтирован).
     */
    public async destroy(): Promise<void> {
        this.forEachFeature((f) => f.beforeDestroy?.());

        if (this._isMounted && this.root) {
            await this.beforeUnmount?.();

            this.forEachFeature((f) => {
                const c = f.onDestroy?.();
                this.registerCleanup(c);
            });

            // снимаем зарегистрированные cleanup-и (в т.ч. от onMounted/afterMounted/effect)
            await this.disposables.flush();

            this.root.remove();
            this._isMounted = false;

            this.forEachFeature((f) => {
                const c = f.afterDestroy?.();
                this.registerCleanup(c);
            });

            await this.disposables.flush();

            await this.unmounted?.();
        } else {
            // если не смонтирован — всё равно снять cleanup-и (effects и т.п.)
            await this.disposables.flush();
        }
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
    protected get isMounted(): boolean {
        return this._isMounted;
    }

    /**
     * Внутренняя инициализация корневого DOM.
     *
     * - Если {@link renderStructure} вернул `Layout`, создаётся host-контейнер
     *   (div[data-layout-host]) для родителя, а сам ребёнок откладывается
     *   до первого `mountTo()` (там произойдёт корректный attach в DOM).
     * - Если возвращён `HTMLElement`, он становится корнем.
     * - В обоих случаях фичи получают событие {@link FeatureLifecycle.onRootCreated}.
     *
     * @throws Если {@link renderStructure} вернул неподдерживаемый тип.
     */
    private ensureRoot(): void {
        this.forEachFeature((f) => f.beforeRender?.());

        let node: any = this.renderStructure();

        this.forEachFeature((f) => {
            if (!f.afterRender) return;
            const out = f.afterRender(node);
            if (out && typeof (out as any).then === "function") {
                throw new Error(
                    "FeatureLifecycle.afterRender() must be synchronous in current Layout.ensureRoot()"
                );
            }
            node = out;
        });

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
        this.forEachFeature((f) => f.onRootCreated?.(node));
    }

    // —— state/events ————————————————————————————————————————————————

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
        this.disposables.listen(el, type, handler as EventListener);
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
}

export function isLayout(value: unknown): value is Layout {
    return value instanceof Layout;
}

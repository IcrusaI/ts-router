import {renderTemplate} from "@/utils/template";
import {effect, signal} from "@/utils/reactive";
import {forEachFeature} from "@/utils/feature/featureRegistry";

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
 * Минимальный «layout-подобный» контракт для композиции.
 * Используется, когда {@link Layout.renderStructure} возвращает не `HTMLElement`,
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
export default abstract class Layout {
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

    // —— плагины ————————————————————————————————————————————————

    /**
     * Утилита для рендеринга HTML‑шаблонов со вставками вида `{{ path.to.value }}`.
     * Вы можете писать разметку прямо в шаблонной строке, а затем передать
     * объект контекста, в котором будут искаться значения для подстановки.
     *
     * Например:
     * ```ts
     * protected renderStructure(): HTMLElement {
     *   return this.html(`
     *     <div data-class="{{style.actions}}">
     *       <button data-class="{{style.auth}}">{{ml.signIn}}</button>
     *       <button data-class="{{style.auth}}">{{ml.signUp}}</button>
     *     </div>
     *   `, { ml, style });
     * }
     * ```
     *
     * Для разбора шаблона используется {@link renderTemplate}. Метод не
     * изменяет DOM самостоятельно;
     *
     * @param tpl HTML‑шаблон со вставками в фигурных скобках
     * @param ctx Объект, содержащий значения для подстановки
     * @returns DOM‑элемент, соответствующий корню шаблона
     */
    protected html(tpl: string): HTMLElement {
        this.ensureReactiveProps();

        const binds: { id: number; expr: string }[] = [];
        let i = 0;

        // заменяем КАЖДЫЙ {{ expr }} на отдельный span
        const compiled = tpl.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, expr) => {
            const id = i++;
            binds.push({ id, expr: expr.trim() });
            return `<span data-bind="${id}"></span>`;
        });

        const root = renderTemplate(compiled, {}); // контекст тут не нужен, берём this в effect

        for (const { id, expr } of binds) {
            const node = root.querySelector<HTMLElement>(`[data-bind="${id}"]`);
            if (!node) continue;

            effect(() => {
                let value: any = this as any;
                for (const part of expr.split('.')) {
                    if (value == null) break;
                    value = value[part];
                }
                if (typeof value === 'function') value = value.call(this);
                node.textContent = value != null ? String(value) : '';
            });
        }

        return root as HTMLElement;
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

        await forEachFeature(this, f => f.onMounted?.());
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
            await forEachFeature(this, f => f.onDestroy?.());
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
        let node = this.renderStructure();

        // ── 0) Строка-HTML: разрешаем ровно один корневой элемент
        if (typeof node === 'string') {
            const tpl = document.createElement('template');
            tpl.innerHTML = node.trim();

            const { firstElementChild, childElementCount } = tpl.content;
            if (childElementCount !== 1 || !firstElementChild) {
                throw new Error(
                    'renderStructure(): HTML-строка должна содержать ровно один корневой элемент. ' +
                    'Пример: <section>...</section>',
                );
            }

            node = firstElementChild as HTMLElement;
        }

        // 1) Возвращён дочерний layout: создаём host и откладываем attach до mountTo()
        if (isLayoutLike(node)) {
            const host = document.createElement("div");
            host.dataset.layoutHost = "";
            this.root = host;
            this._composedChild = { child: node, host };
            forEachFeature(this, f => f.onRootCreated?.(host));
            return;
        }

        // 2) Обычный HTMLElement
        if (!(node instanceof HTMLElement)) {
            throw new Error("renderStructure() должен вернуть HTMLElement или Layout");
        }
        this.root = node;
        forEachFeature(this, f => f.onRootCreated?.(node));
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
     * Возможные варианты возвращаемого значения:
     *
     * - **`HTMLElement`** — станет корневым DOM-элементом данного layout’а;
     * - **`string`** — HTML-строка, которая **должна содержать ровно один корневой элемент**;
     * - **`LayoutLike`** — дочерний layout, который будет автоматически
     *   смонтирован внутрь специального host-контейнера при первом вызове {@link mountTo}.
     *   Для каскадного уничтожения ребёнка рекомендуется подключить `ChildrenFeature`.
     *
     * @returns `HTMLElement` | `string` | `LayoutLike`
     */
    protected abstract renderStructure(): HTMLElement | LayoutLike | string;

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
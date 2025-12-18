import Layout from "@/components/Layout";

/** Очиститель хука: либо ничего, либо функция (sync/async) для отписки/очистки. */
export type HookCleanup = void | (() => void | Promise<void>);

/**
 * Базовый контракт для фичи компонента. Каждая фича может реагировать
 * на жизненный цикл {@link Layout} и добавлять свои возможности хосту.
 */
export interface FeatureLifecycle<Host extends Layout = Layout> {
    onInit?(host: Host): void | Promise<void>;
    onFeaturesReady?(host: Host): void | Promise<void>;

    beforeRender?(): void | Promise<void>;

    afterRender?(result: unknown): unknown;

    onRootCreated?(root: HTMLElement): void | Promise<void>;
    beforeMountRoot?(root: HTMLElement): void | Promise<void>;

    onMounted?(): HookCleanup | Promise<HookCleanup>;
    afterMounted?(): HookCleanup | Promise<HookCleanup>;

    beforeUpdate?(partial?: Record<string, any>): void | Promise<void>;
    afterUpdate?(partial?: Record<string, any>): void | Promise<void>;
    onStateChanged?(partial: Record<string, any>): void | Promise<void>;

    beforeDestroy?(): void | Promise<void>;
    onDestroy?(): HookCleanup | Promise<HookCleanup>;
    afterDestroy?(): HookCleanup | Promise<HookCleanup>;
}

/**
 * Простая сигнатура конструктора фичи. Требует только статических полей
 * featureName и опционально dependencies — без вложенных generic’ов.
 */
export interface FeatureCtor<
    Host extends Layout = Layout,
    Instance extends FeatureLifecycle<Host> = FeatureLifecycle<Host>,
    Name extends string = string,
> {
    new (...args: unknown[]): Instance;
    readonly prototype: Instance;
    readonly featureName: Name;
    readonly dependencies?: readonly FeatureCtor<any, any, any>[];
}

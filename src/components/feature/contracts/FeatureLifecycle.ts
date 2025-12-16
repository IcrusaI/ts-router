import Layout from "@/components/Layout";

/**
 * Очиститель, который может вернуть любой хук фичи.
 * Может быть синхронным или асинхронным.
 */
export type HookCleanup = void | (() => void | Promise<void>);

/**
 * Утилитарный тип для описания хуков, которые могут быть асинхронными.
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Базовый контракт для фичи компонента. Каждая фича может реагировать
 * на жизненный цикл {@link Layout} и добавлять свои возможности хосту.
 */
export interface FeatureLifecycle<Host extends Layout = Layout> {
    onInit?(host: Host): MaybePromise<void>;
    onFeaturesReady?(host: Host): MaybePromise<void>;

    beforeRender?(): MaybePromise<void>;

    afterRender?(result: unknown): unknown;

    onRootCreated?(root: HTMLElement): MaybePromise<void>;
    beforeMountRoot?(root: HTMLElement): MaybePromise<void>;

    onMounted?(): MaybePromise<HookCleanup>;
    afterMounted?(): MaybePromise<HookCleanup>;

    beforeUpdate?(partial?: Record<string, any>): MaybePromise<void>;
    afterUpdate?(partial?: Record<string, any>): MaybePromise<void>;
    onStateChanged?(partial: Record<string, any>): MaybePromise<void>;

    beforeDestroy?(): MaybePromise<void>;
    onDestroy?(): MaybePromise<HookCleanup>;
    afterDestroy?(): MaybePromise<HookCleanup>;
}

/**
 * Конструктор фичи, который также несёт дефолтное имя поля.
 * Пример:
 *   class ChildrenFeature { static featureName = "children" }
 */
export type FeatureCtor<
    Host extends Layout = Layout,
    Instance extends FeatureLifecycle<Host> = FeatureLifecycle<Host>
> = (new (...args: any[]) => Instance) & {
    featureName: string;
};

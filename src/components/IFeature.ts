import Layout from "@/components/Layout";

export type HookCleanup = void | (() => void | Promise<void>);
export type MaybePromise<T> = T | Promise<T>;

export interface IFeature<Host extends Layout = Layout> {
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
    Instance extends IFeature<Host> = IFeature<Host>
> = (new (...args: any[]) => Instance) & {
    featureName: string;
};
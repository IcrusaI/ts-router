import type Layout from "@/components/Layout";
import { signal } from "@/utils/reactive";
import type { FeatureLifecycle } from "@/components/feature/contracts/FeatureLifecycle";

const _reactiveInitialised = Symbol("__reactiveInitialised");

/**
 * Фича, которая включает реактивные поля, помеченные декоратором @reactive.
 * Работает один раз на инстанс, корректно оборачивает уже созданные сигналы.
 */
export default class ReactivityFeature implements FeatureLifecycle<Layout> {
    static readonly featureName = "reactivity";

    onInit(host: Layout): void {
        this.ensureReactiveProps(host);
    }

    private ensureReactiveProps(host: Layout): void {
        const anyHost = host as any;
        if (anyHost[_reactiveInitialised]) return;
        anyHost[_reactiveInitialised] = true;

        const ctor: any = anyHost.constructor;
        const marked: Set<string> = ctor.__reactiveProps ?? new Set<string>();

        for (const key of marked) {
            const desc = Object.getOwnPropertyDescriptor(anyHost, key);
            if (desc && (desc.get || desc.set)) continue; // уже обёрнуто (новый синтаксис декораторов)

            const value = anyHost[key];
            // сигналы передаются как функции с маркером __isSignal
            if (typeof value === "function" && value.__isSignal) {
                const sig = value;
                Object.defineProperty(anyHost, key, {
                    get: () => sig(),
                    set: (v: unknown) => sig.set(v),
                    enumerable: true,
                    configurable: true,
                });
                continue;
            }

            const sig = signal(value);
            Object.defineProperty(anyHost, key, {
                get: () => sig(),
                set: (v: unknown) => sig.set(v),
                enumerable: true,
                configurable: true,
            });
        }
    }
}

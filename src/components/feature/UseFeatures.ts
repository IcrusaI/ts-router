import type Layout from "@/components/Layout";
import {
    collectFeatureSpecs,
    type FeatureFields,
    type FeatureSpec,
    USE_FEATURES_KEY,
} from "@/components/feature/featureSpecs";

type AnyCtor<TInstance = unknown, TArgs extends any[] = any[]> = abstract new (
    ...args: TArgs
) => TInstance;

/** Конструктор, дополненный полями фич (инстанс + сохраняет статическую часть базового класса). */
export type ClassWithFeatures<Ctor extends AnyCtor, Specs extends readonly FeatureSpec[]> = AnyCtor<
    InstanceType<Ctor> & FeatureFields<Specs>,
    ConstructorParameters<Ctor>
>;

/**
 * Миксин для подключения фич без декораторов.
 * Складывает specs с наследуемыми, пишет их в конструктор и возвращает
 * класс с проецированными полями фич.
 *
 * Пример:
 *   class MyLayout extends withFeatures(Layout, ChildrenFeature) {}
 */
export function withFeatures<
    const Specs extends readonly FeatureSpec[],
    const Base extends AnyCtor<Layout>,
>(Base: Base, ...specs: Specs): ClassWithFeatures<Base, Specs> {
    const inherited = collectFeatureSpecs(Base);
    abstract class Featureful extends Base {
        constructor(...args: any[]) {
            super(...(args as any));
        }
    }
    (Featureful as unknown as Record<typeof USE_FEATURES_KEY, FeatureSpec[]>)[USE_FEATURES_KEY] = [
        ...inherited,
        ...specs,
    ];
    return Featureful as unknown as ClassWithFeatures<Base, Specs>;
}

export { USE_FEATURES_KEY } from "@/components/feature/featureSpecs";
export type {
    FeatureSpec,
    FeatureFields,
    FeatureNameFromSpec,
    FeatureInstanceFromSpec,
} from "@/components/feature/featureSpecs";

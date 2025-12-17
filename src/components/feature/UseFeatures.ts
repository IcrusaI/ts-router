import type Layout from "@/components/Layout";
import { collectFeatureSpecs, type FeatureFields, type FeatureSpec, USE_FEATURES_KEY } from "@/components/feature/featureSpecs";

type AnyCtor<TInstance = unknown, TArgs extends any[] = any[]> = abstract new (...args: TArgs) => TInstance;

export type ClassWithFeatures<
    Ctor extends AnyCtor,
    Specs extends readonly FeatureSpec[]
> = abstract new (...args: ConstructorParameters<Ctor>) => InstanceType<Ctor> & FeatureFields<Specs>;

/**
 * Подключение фич через миксин, без декораторов.
 *
 * Пример:
 *   class MyLayout extends withFeatures(Layout, SlotsFeature) {}
 */
export function withFeatures<const Specs extends readonly FeatureSpec[], const Base extends AnyCtor<Layout>>(
    Base: Base,
    ...specs: Specs
): ClassWithFeatures<Base, Specs> {
    const inherited = collectFeatureSpecs(Base);
    abstract class Featureful extends Base {
        // требование TS для mixin: единый rest-ctor any[]
        // eslint-disable-next-line @typescript-eslint/no-useless-constructor
        constructor(...args: any[]) { super(...args as any); }
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

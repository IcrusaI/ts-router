import type Layout from "@/components/Layout";
import { collectFeatureSpecs, type FeatureFields, type FeatureSpec, USE_FEATURES_KEY } from "@/components/feature/featureSpecs";

type StaticPart<T> = Omit<T, "prototype">;

export type FeaturefulConstructor<
    Ctor extends abstract new (...args: any[]) => any,
    Specs extends readonly FeatureSpec[],
    Instance = InstanceType<Ctor> & FeatureFields<Specs>,
> = StaticPart<Ctor> & (abstract new (...args: ConstructorParameters<Ctor>) => Instance);

export type ClassWithFeatures<
    Ctor extends abstract new (...args: any[]) => any,
    Specs extends readonly FeatureSpec[]
> = FeaturefulConstructor<Ctor, Specs>;

/**
 * Подключение фич через миксин, без декораторов.
 *
 * Пример:
 *   class MyLayout extends withFeatures(Layout, SlotsFeature) {}
 */
export function withFeatures<const Specs extends readonly FeatureSpec[], const Base extends abstract new (...args: any[]) => Layout>(
    Base: Base,
    ...specs: Specs
): ClassWithFeatures<Base, Specs> {
    const inherited = collectFeatureSpecs(Base);
    abstract class Featureful extends Base {}
    (Featureful as any)[USE_FEATURES_KEY] = [...inherited, ...specs];
    type FeaturefulCtor = abstract new (...args: ConstructorParameters<Base>) => InstanceType<Base> & FeatureFields<Specs>;
    return Featureful as unknown as FeaturefulCtor & Base;
}

export { USE_FEATURES_KEY } from "@/components/feature/featureSpecs";
export type {
    FeatureSpec,
    FeatureFields,
    FeatureNameFromSpec,
    FeatureInstanceFromSpec,
} from "@/components/feature/featureSpecs";

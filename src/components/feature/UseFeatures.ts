import type Layout from "@/components/Layout";
import type { FeatureFields, FeatureSpec } from "@/components/feature/featureSpecs";
import { USE_FEATURES_KEY } from "@/components/feature/featureSpecs";

export type FeaturefulConstructor<
    Ctor extends abstract new (...args: any[]) => any,
    Specs extends readonly FeatureSpec[],
    Instance = InstanceType<Ctor> & FeatureFields<Specs>,
> = Ctor & { prototype: Instance } & { new (...args: ConstructorParameters<Ctor>): Instance };

export type ClassWithFeatures<
    Ctor extends abstract new (...args: any[]) => any,
    Specs extends readonly FeatureSpec[]
> = FeaturefulConstructor<Ctor, Specs>;

export function UseFeatures<const Specs extends readonly FeatureSpec[]>(...specs: Specs) {
    return function <T extends abstract new (...args: any[]) => Layout>(
        value: T,
        _context: ClassDecoratorContext<T>,
    ): ClassWithFeatures<T, Specs> {
        (value as any)[USE_FEATURES_KEY] = specs;
        return value as ClassWithFeatures<T, Specs>;
    };
}

export { USE_FEATURES_KEY } from "@/components/feature/featureSpecs";
export type {
    FeatureSpec,
    FeatureFields,
    FeatureNameFromSpec,
    FeatureInstanceFromSpec,
} from "@/components/feature/featureSpecs";

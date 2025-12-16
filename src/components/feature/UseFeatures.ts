import type Layout from "@/components/Layout";
import type { FeatureCtor } from "@/components/feature/contracts/FeatureLifecycle";

/**
 * Спецификация фичи для декоратора {@link UseFeatures}.
 * Можно передать сам конструктор с `featureName` или объект с явным именем.
 */
export type FeatureSpec =
    | FeatureCtor<any, any>
    | { name?: string; feature: FeatureCtor<any, any> };

export type FeatureNameFromSpec<S extends FeatureSpec> = S extends FeatureCtor<any, any>
    ? S["featureName"]
    : S extends { name?: string; feature: FeatureCtor<any, any> }
        ? S["name"] extends string
            ? S["name"]
            : S["feature"]["featureName"]
        : never;

export type FeatureInstanceFromSpec<S extends FeatureSpec> = S extends FeatureCtor<any, infer Instance>
    ? Instance
    : S extends { feature: FeatureCtor<any, infer Instance> }
        ? Instance
        : never;

export type FeatureFields<Specs extends readonly FeatureSpec[]> = {
    [K in Specs[number] as FeatureNameFromSpec<K>]: FeatureInstanceFromSpec<K>;
};

export type ClassWithFeatures<
    Ctor extends abstract new (...args: any[]) => any,
    Specs extends readonly FeatureSpec[]
> = Ctor & {
    new (...args: ConstructorParameters<Ctor>): InstanceType<Ctor> & FeatureFields<Specs>;
};

const USE_FEATURES_KEY = Symbol.for("@@useFeaturesSpecs");

export function UseFeatures<const Specs extends readonly FeatureSpec[]>(...specs: Specs) {
    return function <T extends abstract new (...args: any[]) => Layout>(
        value: T,
        _context: ClassDecoratorContext<T>,
    ): ClassWithFeatures<T, Specs> {
        // кладём метаданные на constructor
        (value as any)[USE_FEATURES_KEY] = specs;
        return value as ClassWithFeatures<T, Specs>;
    };
}

// экспортни ключ, чтобы Layout мог читать
export { USE_FEATURES_KEY };
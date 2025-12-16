import type Layout from "@/components/Layout";
import type { FeatureCtor } from "@/components/IFeature";

export type FeatureSpec =
    | FeatureCtor<any, any>
    | { name?: string; feature: FeatureCtor<any, any> };

const USE_FEATURES_KEY = Symbol.for("@@useFeaturesSpecs");

export function UseFeatures(...specs: FeatureSpec[]) {
    return function <T extends abstract new (...args: any[]) => Layout>(
        value: T,
        _context: ClassDecoratorContext<T>,
    ) {
        // кладём метаданные на constructor
        (value as any)[USE_FEATURES_KEY] = specs;
    };
}

// экспортни ключ, чтобы Layout мог читать
export { USE_FEATURES_KEY };
import type { FeatureCtor, FeatureLifecycle } from "@/components/feature/contracts/FeatureLifecycle";

export type FeatureRequest = { name?: string; feature: FeatureCtor<any, any, any> };
export type FeatureSpec = FeatureRequest | FeatureCtor<any, any, any>;

export type FeatureNameFromSpec<S extends FeatureSpec> = S extends FeatureCtor<any, any, infer FN>
    ? FN
    : S extends { feature: infer F }
        ? F extends FeatureCtor<any, any, infer FN>
            ? S extends { name: infer N }
                ? N extends string
                    ? N
                    : F["featureName"]
                : F["featureName"]
            : never
        : never;

export type FeatureInstanceFromSpec<S extends FeatureSpec> = S extends FeatureCtor<any, infer I>
    ? I
    : S extends { feature: infer F }
        ? F extends FeatureCtor<any, infer Instance>
            ? Instance
            : never
        : never;

export type FeatureFields<Specs extends readonly FeatureSpec[]> = {
    [K in Specs[number] as FeatureNameFromSpec<K>]: FeatureInstanceFromSpec<K>;
};

export type FeaturePlanEntry = {
    name: string;
    ctor: FeatureCtor<any, any, any>;
    expose: boolean;
    instance?: FeatureLifecycle<any>;
};

export const USE_FEATURES_KEY = Symbol.for("@@useFeaturesSpecs");

export function collectFeatureSpecs(ctor: Function): FeatureSpec[] {
    const out: FeatureSpec[] = [];
    let cur: any = ctor;
    while (cur && cur !== Function.prototype) {
        const specs: FeatureSpec[] | undefined = cur[USE_FEATURES_KEY];
        if (specs) out.push(...specs);
        cur = Object.getPrototypeOf(cur);
    }
    return out;
}

function normalizeSpec(spec: FeatureSpec): { request: FeatureRequest; instance?: FeatureLifecycle<any> } {
    if (typeof spec === "function") return { request: { feature: spec }, instance: undefined };
    return { request: spec, instance: undefined };
}

function collectDependencies(
    spec: FeatureSpec,
    expose: boolean,
    plan: Map<string, FeaturePlanEntry>,
): void {
    const { request, instance } = normalizeSpec(spec);
    const name = request.name ?? request.feature.featureName;
    if (!name) throw new Error("Feature is missing featureName; provide name in @UseFeatures spec");

    const existing = plan.get(name);
    if (existing) {
        if (expose) existing.expose = true;
        return;
    }

    for (const dep of request.feature.dependencies ?? []) collectDependencies(dep, false, plan);

    plan.set(name, { name, ctor: request.feature, expose, instance });
}

export function buildFeaturePlan(specs: readonly FeatureSpec[]): FeaturePlanEntry[] {
    const plan = new Map<string, FeaturePlanEntry>();
    for (const spec of specs) collectDependencies(spec, true, plan);
    return [...plan.values()];
}

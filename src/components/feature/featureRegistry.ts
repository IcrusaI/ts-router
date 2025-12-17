import type Layout from "@/components/Layout";

import {FeatureCtor, FeatureLifecycle} from "@/components/feature/contracts/FeatureLifecycle";

const FEATURE_STORE = new WeakMap<Layout, Map<string, FeatureLifecycle<Layout>>>();

/**
 * Подключает фичу к экземпляру Layout и вызывает её `onInit`,
 * храняя инстанс в реестре, чтобы позже можно было оповещать все
 * фичи единообразно.
 */
export function attachFeature<H extends Layout, F extends FeatureLifecycle<H>>(
    host: H,
    key: string,
    feature: F,
) {
    let bucket = FEATURE_STORE.get(host);
    if (!bucket) {
        bucket = new Map();
        FEATURE_STORE.set(host, bucket);
    }
    if (bucket.has(key)) {
        throw new Error(`Feature "${key}" already installed`);
    }

    bucket.set(key, feature as unknown as FeatureLifecycle<Layout>);
    feature.onInit?.(host);
}

export function getFeature(host: Layout, key: string | FeatureCtor) {
    const bucket = FEATURE_STORE.get(host);
    if (!bucket) return;
    if (typeof key === "string") return bucket.get(key);
    for (const feature of bucket.values()) {
        if (feature instanceof key) return feature;
    }
    return undefined;
}

/**
 * Обходит все подключённые фичи и последовательно вызывает переданный колбэк.
 */
export function forEachFeature(host: Layout, cb: (feature: FeatureLifecycle<Layout>) => void) {
    const bucket = FEATURE_STORE.get(host);
    if (!bucket) return;
    for (const f of bucket.values()) cb(f);
}

/**
 * Уведомляет все фичи, что хост готов (после конструирования и microtask).
 */
export function notifyFeaturesReady(host: Layout) {
    forEachFeature(host, (feature) => void feature.onFeaturesReady?.(host));
}

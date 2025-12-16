import type Layout from "@/components/Layout";

import {IFeature} from "@/components/IFeature";

const FEATURE_STORE = new WeakMap<Layout, Map<string, IFeature<Layout>>>();

export function attachFeature<H extends Layout, F extends IFeature<H>>(
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

    bucket.set(key, feature as unknown as IFeature<Layout>);
    feature.onInit?.(host);
}

export function forEachFeature(host: Layout, cb: (feature: IFeature<Layout>) => void) {
    const bucket = FEATURE_STORE.get(host);
    if (!bucket) return;
    for (const f of bucket.values()) cb(f);
}

export function notifyFeaturesReady(host: Layout) {
    forEachFeature(host, (feature) => void feature.onFeaturesReady?.(host));
}
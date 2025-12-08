// src/core/featureRegistry.ts
import type Layout from "@/components/Layout";

import {Feature} from "@/components/Feature";

const FEATURE_STORE = new WeakMap<Layout, Map<string, Feature<Layout>>>();

export function attachFeature<H extends Layout, F extends Feature<H>>(
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

    bucket.set(key, feature as unknown as Feature<Layout>);
    feature.onInit?.(host);
}

export function forEachFeature(host: Layout, cb: (feature: Feature<Layout>) => void) {
    const bucket = FEATURE_STORE.get(host);
    if (!bucket) return;
    for (const f of bucket.values()) cb(f);
}
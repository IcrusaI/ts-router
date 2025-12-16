export { default as Router } from "@/router/Router";
export { default as Page } from "@/components/Page";
export { default as Layout } from "@/components/Layout";

export { signal, type ReadWriteSignal } from "@/utils/reactive";

export { reactive } from "@/utils/decorators";

export { default as Feature } from "@/components/feature/Feature";
export { UseFeatures } from "@/components/feature/UseFeatures";
export { default as ChildrenFeature } from "@/components/feature/ChildrenFeature";
export { default as SlotsFeature } from "@/components/feature/SlotsFeature";

// Шаблонизатор с поддержкой layout-тегов и слотов
export { default as TemplateFeature } from "@/components/feature/TemplateFeature";

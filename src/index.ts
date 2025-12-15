export { default as Router } from "@/router/Router";
export { default as Page } from "@/components/Page";
export { default as Layout } from "@/components/Layout";

export { signal, type ReadWriteSignal } from "@/utils/reactive";

export { reactive } from "@/utils/decorators";

export { default as Feature } from "@/utils/feature/Feature";
export { default as ChildrenFeature } from "@/components/feature/ChildrenFeature";
export { default as SlotsFeature } from "@/components/feature/SlotsFeature";
export { default as TemplateFeature, type TemplateComponents } from "@/components/feature/TemplateFeature";
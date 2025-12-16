import type Layout from "@/components/Layout";
import type { FeatureCtor } from "@/components/IFeature";
import {attachFeature, notifyFeaturesReady} from "./featureRegistry";

// Спецификация одного элемента списка
export type FeatureSpec =
    | FeatureCtor<any, any>
    | { name?: string; feature: FeatureCtor<any, any> };

// Унифицируем spec -> ctor + name
type SpecName<S> =
    S extends { name?: infer N extends string } ? N :
        S extends FeatureCtor ? S["featureName"] :
            never;

type SpecCtor<S> =
    S extends { feature: infer F extends FeatureCtor<any, any> } ? F :
        S extends FeatureCtor ? S :
            never;

type SpecInstance<S> = InstanceType<SpecCtor<S>>;

type SpecsByName<Specs extends readonly FeatureSpec[], Name extends string> =
    Extract<Specs[number], { name: Name }> extends never
        ? Extract<Specs[number], FeatureCtor & { featureName: Name }>
        : Extract<Specs[number], { name: Name }>;

// Поля, которые появятся на Layout после декоратора
type FeatureFields<Specs extends readonly FeatureSpec[]> = {
    [K in SpecName<Specs[number]>]: SpecInstance<SpecsByName<Specs, K>>;
};

// Расширение контракта renderStructure: если среди Specs есть ChildrenFeature — разрешаем Layout
type HasChildren<Specs extends readonly FeatureSpec[]> =
    Extract<SpecCtor<Specs[number]>, { featureName: "children" }> extends never ? false : true;

export type RenderResultBase = HTMLElement | string;
export type RenderResultWithChildren = RenderResultBase | Layout;

export type RenderResult<Specs extends readonly FeatureSpec[]> =
    HasChildren<Specs> extends true ? RenderResultWithChildren : RenderResultBase;

// Ctor helper
type Ctor<T = {}> = abstract new (...args: any[]) => T;

function normalizeSpec(spec: FeatureSpec): { name: string; ctor: FeatureCtor<any, any> } {
    if (typeof spec === "function") return { name: spec.featureName, ctor: spec };
    return { name: spec.name ?? spec.feature.featureName, ctor: spec.feature };
}

/**
 * @UseFeatures(ChildrenFeature, { name: "slots", feature: SlotsFeature }, TemplateFeature)
 *
 * - Создаёт инстансы фич при создании layout
 * - Присваивает их в поля this[имя]
 * - Регистрирует в featureRegistry (чтобы хуки реально вызывались)
 * - В типах добавляет поля и расширяет контракт renderStructure()
 */
export function UseFeatures<const Specs extends readonly FeatureSpec[]>(
    ...specs: Specs
) {
    return function <TBase extends Ctor<Layout>>(Base: TBase) {
        abstract class WithFeatures extends Base {
            /**
             * Документация для пользователя будет видна в IDE именно тут.
             *
             * Если подключён children (featureName === "children"), то допускается возврат Layout.
             */
            protected abstract override renderStructure(): RenderResult<Specs>;

            protected constructor(...args: any[]) {
                super(...args);
                // Инициализация фич: делаем ПОСЛЕ super(), когда host уже создан.
                for (const s of specs) {
                    const { name, ctor } = normalizeSpec(s);
                    if (!name) {
                        throw new Error("Feature is missing featureName; provide name in @UseFeatures spec");
                    }

                    // Создаём экземпляр фичи
                    const instance = new ctor();

                    // Кладём в поле на layout
                    (this as any)[name] = instance;

                    // Регистрируем в твоём реестре (внутри должен вызваться onInit)
                    attachFeature(this, name, instance);
                }

                queueMicrotask(() => notifyFeaturesReady(this));
            }
        }

        return WithFeatures as unknown as (new (...args: any[]) => InstanceType<TBase> & FeatureFields<Specs>) & typeof Base;
    };
}
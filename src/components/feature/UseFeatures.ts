import Layout from "@/components/Layout";
import type { FeatureCtor, IFeature } from "@/components/IFeature";
import {attachFeature} from "@/components/feature/featureRegistry";

// Спецификация одного элемента списка
export type FeatureSpec =
    | FeatureCtor<any, any>
    | { name: string; feature: FeatureCtor<any, any> };

// Унифицируем spec -> ctor + name
type SpecName<S> =
    S extends { name: infer N extends string } ? N :
        S extends FeatureCtor ? S["featureKey"] :
            never;

type SpecCtor<S> =
    S extends { feature: infer F extends FeatureCtor<any, any> } ? F :
        S extends FeatureCtor ? S :
            never;

type SpecInstance<S> = InstanceType<SpecCtor<S>>;

// Поля, которые появятся на Layout после декоратора
type FeatureFields<Specs extends readonly FeatureSpec[]> = {
    [K in SpecName<Specs[number]>]: SpecInstance<Extract<Specs[number], any>>;
};

// Расширение контракта renderStructure: если среди Specs есть ChildrenFeature — разрешаем Layout
type HasChildren<Specs extends readonly FeatureSpec[]> =
    Extract<SpecCtor<Specs[number]>, { featureKey: "children" }> extends never ? false : true;

export type RenderResultBase = HTMLElement | string;
export type RenderResultWithChildren = RenderResultBase | Layout;

export type RenderResult<Specs extends readonly FeatureSpec[]> =
    HasChildren<Specs> extends true ? RenderResultWithChildren : RenderResultBase;

// Ctor helper
type Ctor<T = {}> = new (...args: any[]) => T;

function normalizeSpec(spec: FeatureSpec): { name: string; ctor: FeatureCtor<any, any> } {
    if (typeof spec === "function") return { name: spec.featureKey, ctor: spec };
    return { name: spec.name, ctor: spec.feature };
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
            // Типы: поля появятся автоматически
            declare [K in keyof FeatureFields<Specs>]: FeatureFields<Specs>[K];

            /**
             * Документация для пользователя будет видна в IDE именно тут.
             *
             * Если подключён children (featureKey === "children"), то допускается возврат Layout.
             */
            protected abstract override renderStructure(): RenderResult<Specs>;

            constructor(...args: any[]) {
                super(...args);

                // Инициализация фич: делаем ПОСЛЕ super(), когда host уже создан.
                for (const s of specs) {
                    const { name, ctor } = normalizeSpec(s);

                    // Создаём экземпляр фичи
                    const instance = new ctor();

                    // Кладём в поле на layout
                    (this as any)[name] = instance;

                    // Регистрируем в твоём реестре (внутри должен вызваться onInit)
                    attachFeature(this, name, instance);
                }
            }
        }

        return WithFeatures as unknown as TBase;
    };
}
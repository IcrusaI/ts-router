import type Layout from "@/components/Layout";
import {attachFeature} from "@/utils/feature/featureRegistry";
import {Feature} from "@/components/Feature";

/**
 * Декоратор поля фичи.
 *
 * @example
 * class ShellLayout extends Layout {
 *   @Feature(ChildrenFeature)
 *   public children!: ChildrenFeature;
 * }
 */
export function Feature() {
    return <This extends Layout, V extends Feature<This>>(
        _value: undefined,
        context: ClassFieldDecoratorContext<This, V>,
    ) => {
        return function (this: This, initial: V | undefined) {
            if (!initial) {
                throw new Error(
                    `Field "${String(context.name)}" with @Feature() must have initializer`,
                );
            }

            const instance = initial;
            const name = String(context.name);

            // регистрируем фичу во внутреннем реестре
            attachFeature(this, name, instance);

            // просто возвращаем значение в поле — property создаёт сам JS
            return instance;
        };
    };
}
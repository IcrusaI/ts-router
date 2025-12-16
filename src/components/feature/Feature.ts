import type Layout from "@/components/Layout";
import {attachFeature} from "@/components/feature/featureRegistry";
import {FeatureLifecycle} from "@/components/feature/contracts/FeatureLifecycle";

/**
 * Декоратор поля фичи.
 *
 * @example
 * class ShellLayout extends Layout {
 *   @Feature(ChildrenFeature)
 *   public children!: ChildrenFeature;
 * }
 */
export default function Feature(
    ctor: new (...args: any[]) => FeatureLifecycle<any>,
) {
    return <This extends Layout, V extends FeatureLifecycle<This>>(
        _value: undefined,
        context: ClassFieldDecoratorContext<This, V>,
    ) => {
        return function (this: This, initial: V | undefined) {
            const name = String(context.name);

            const instance = (initial ?? (new ctor() as V));

            attachFeature(this, name, instance);
            return instance;
        };
    };
}
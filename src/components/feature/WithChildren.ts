import Layout from "@/components/Layout";
import Feature from "@/utils/feature/Feature";
import ChildrenFeature from "@/components/feature/ChildrenFeature";

type Ctor<T = {}> = new (...args: any[]) => T;

export function WithChildren<TBase extends Ctor<Layout>>(Base: TBase) {
  abstract class WithChildrenLayout extends Base {
    @Feature(ChildrenFeature)
    protected children!: ChildrenFeature;

    protected abstract renderStructure(): HTMLElement | string | Layout;
  }

  return WithChildrenLayout;
}
import Layout from "@/components/Layout";
import ChildrenFeature from "@/components/feature/ChildrenFeature";
import {UseFeatures} from "@/components/feature/UseFeatures";

type Ctor<T = {}> = abstract new (...args: any[]) => T;

export function WithChildren<TBase extends Ctor<Layout>>(Base: TBase) {
  return UseFeatures(ChildrenFeature)(Base);
}
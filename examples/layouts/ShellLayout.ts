import { Layout, SlotsFeature, withFeatures } from "@icrusai/ts-router";
import shell from "./shell.html?raw";

export default class ShellLayout extends withFeatures(
    Layout,
    SlotsFeature<"header" | "sidebar" | "content">
) {
    protected renderStructure() {
        return shell;
    }
}

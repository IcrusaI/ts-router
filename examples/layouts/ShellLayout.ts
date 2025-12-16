import {Layout, SlotsFeature, UseFeatures} from "@icrusai/ts-router";
import shell from "./shell.html?raw";

@UseFeatures(SlotsFeature<"header" | "sidebar" | "content">)
export default class ShellLayout extends Layout {
    protected renderStructure() {
        console.log(this);
        return shell;
    }
}
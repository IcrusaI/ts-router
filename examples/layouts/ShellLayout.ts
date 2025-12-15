import {Feature, Layout, SlotsFeature} from "@icrusai/ts-router";
import shell from "./shell.html?raw";

export default class ShellLayout extends Layout {
    @Feature(SlotsFeature)
    public slots!: SlotsFeature<"header" | "sidebar" | "content">;

    protected renderStructure() {
        return shell;
    }
}
import {Feature, Layout, SlotsFeature} from "@icrusai/ts-router";
import shell from "./shell.html?raw";

export default class ShellLayout extends Layout {
    protected renderStructure() {
        return shell;
    }
}
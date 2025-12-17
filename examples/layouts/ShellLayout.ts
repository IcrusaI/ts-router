import {Layout, SlotsFeature, withFeatures} from "@icrusai/ts-router";
import shell from "./shell.html?raw";

export default class ShellLayout extends withFeatures(
    Layout,
    SlotsFeature,
) {
    protected renderStructure() {
        console.log(this.slots);
        return shell;
    }
}

import { Layout } from "@icrusai/ts-router";
import shell from "./shell.html?raw";

export default class ShellLayout extends Layout<"header" | "sidebar" | "content"> {
    protected renderStructure() {
        return shell;
    }
}
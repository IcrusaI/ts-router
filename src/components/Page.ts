import Layout from "@/components/Layout";
import {reactive} from "@/utils/decorators";
import type {CurrentRoute} from "@/router/NavigationTarget";

/**
 * Базовый класс страницы поверх {@link Layout}.
 *
 * Добавляет обязательное поле {@link title}, которое синхронизируется с
 * `document.title`, и удобные геттеры для query‑строки.
 *
 * ```ts
 * export default class UserPage extends Page {
 *   created() { this.title = "User"; }
 *   protected renderStructure() { return document.createElement("section"); }
 * }
 * ```
 */
export default abstract class Page extends Layout {
    @reactive
    public title: string = '';

    /**
     * Подробности о совпавшем маршруте.
     *
     * Заполняется роутером перед монтированием страницы.
     */
    public route!: CurrentRoute;
}

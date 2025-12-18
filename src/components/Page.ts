import Layout from "@/components/Layout";
import {reactive} from "@/utils/decorators";

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
     * Удобный доступ к параметрам текущей query-строки (`?key=value`).
     * Каждый вызов возвращает новый экземпляр `URLSearchParams`, синхронизированный
     * с `window.location.search` на момент обращения.
     *
     * @example
     * ```ts
     * const page = new MyPage();
     * const tab = this.query.get("tab"); // например, "settings"
     * ```
     *
     * @protected
     */
    protected get query(): URLSearchParams {
        return new URLSearchParams(window.location.search);
    }

    /**
     * Представление query-строки в виде обычного объекта `{[key]: string}`.
     * Если ключ повторяется несколько раз, берётся **последнее** значение —
     * это поведение `Object.fromEntries(new URLSearchParams(...).entries())`.
     *
     * Полезно, когда нужно быстро деструктурировать параметры без ручных `get()`.
     *
     * @example
     * ```ts
     * const { tab = "overview", filter } = this.queryObj;
     * ```
     *
     * @protected
     */
    protected get queryObj(): Record<string, string> {
        return Object.fromEntries(this.query);
    }
}

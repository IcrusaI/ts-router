import Layout from "@/components/Layout";
import {reactive} from "@/utils/decorators";
import {withFeatures} from "@/components/feature/UseFeatures";
import ReactivityFeature from "@/components/feature/features/ReactivityFeature";

/**
 * =======================================================================
 * Page.ts — базовый класс страницы приложения
 * =======================================================================
 *
 * @fileoverview
 * Абстракция «страницы» поверх {@link Layout}: добавляет обязательный
 * заголовок вкладки (через {@link getTitle}) и удобные геттеры для доступа
 * к параметрам query-строки текущего URL.
 *
 * Зачем нужен отдельный класс:
 *  - единый контракт на заголовок документа (`document.title`);
 *  - единое место для доступа к `URLSearchParams`;
 *  - совместимость с `Router`, который после монтирования страницы
 *    вызывает `page.getTitle()` и устанавливает `document.title`.
 *
 * Как использовать:
 * ```ts
 * export default class UserPage extends Page<"content"> {
 *   public getTitle(): string {
 *     const id = this.query.get("id") ?? "—";
 *     return `User ${id}`;
 *   }
 *   protected renderStructure(): HTMLElement {
 *     const el = document.createElement("div");
 *     el.innerHTML = `<h1>User page</h1>`;
 *     return el;
 *   }
 * }
 * ```
 *
 * @template TSlots Строковый литеральный тип допустимых имён слотов
 * (наследуется от {@link Layout} и позволяет типобезопасно вызывать
 * {@link Layout.setSlot}).
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
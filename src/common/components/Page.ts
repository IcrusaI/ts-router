import Layout from "@/common/components/Layout";
import {effect, ReadWriteSignal, signal} from "@/common/utils/reactive";

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
export default abstract class Page<TSlots extends string = never> extends Layout<TSlots> {
    /**
     * @deprecated
     * Метод оставлен для обратной совместимости.
     * Возвращает текущее значение реактивного заголовка {@link title}.
     *
     * Вместо него рекомендуется использовать:
     * ```ts
     * this.title = "My Page";
     * ```
     */
    public getTitle(): string {
        return this.title;
    }

    /** приватный сигнал; не светится в публичных типах */
    private _title$?: ReadWriteSignal<string>;

    private get _titleSig(): ReadWriteSignal<string> {
        // создастся при первом доступе (в т.ч. из created())
        return (this._title$ ??= signal<string>(""));
    }

    /**
     * Реактивный заголовок страницы.
     *
     * Используется для отображения названия текущей страницы во вкладке браузера.
     * Роутер автоматически подписывается на изменения этого сигнала и
     * обновляет `document.title` при каждом обновлении.
     *
     * Пример:
     * ```ts
     * title = Dashboard;
     * ```
     */
    public get title(): string {
        return this._titleSig();
    }
    public set title(v: string) {
        this._titleSig.set(v);
    }

    /**
     * Подписка на изменения заголовка. Возвращает функцию отписки.
     * Роутер использует это, чтобы синхронизировать document.title.
     */
    public watchTitle(cb: (title: string) => void): () => void {
        return effect(() => cb(this._titleSig()));
    }

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
        return Object.fromEntries(this.query.entries());
    }
}
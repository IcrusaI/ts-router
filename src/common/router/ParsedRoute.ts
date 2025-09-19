import RouteOptions from "@/common/router/RouteOptions";
import { PageCtor } from "@/common/router/types";

export default interface ParsedRoute {
    /** Оригинальный паттерн ("/posts/:slug") для отладки */
    pattern: string;
    /** Скомпилированный RegExp */
    regex: RegExp;
    /** Имена `:params` в порядке появления */
    paramNames: string[];
    /** Фабрика класса страницы */
    loadPage: () => Promise<PageCtor>;
    /** Опции маршрута */
    opts: RouteOptions;
}
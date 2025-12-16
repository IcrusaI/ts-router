import RouteOptions from "@/router/RouteOptions";
import { PageClass } from "@/router/contracts/PageContracts";

export default interface ParsedRoute {
    /** Оригинальный паттерн ("/posts/:slug") для отладки */
    pattern: string;
    /** Скомпилированный RegExp */
    regex: RegExp;
    /** Имена `:params` в порядке появления */
    paramNames: string[];
    /** Фабрика класса страницы */
    loadPage: () => Promise<PageClass>;
    /** Опции маршрута */
    opts: RouteOptions;
}
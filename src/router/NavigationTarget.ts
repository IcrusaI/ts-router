import RouteOptions from "@/router/RouteOptions";

/** Минимальный набор данных о маршруте (используется в middleware). */
export default interface NavigationTarget {
    /** Нормализованный путь без query/hash, уже без basePath. */
    path: string;
    /** Динамические параметры из паттерна ("/user/:id"). */
    params: Record<string, string>;
    /** Опции маршрута (middlewares, redirectTo и т.п.). */
    meta: RouteOptions;
    /** Query‑параметры как URLSearchParams. */
    query: URLSearchParams;
    /** Удобный объект из query. */
    queryObj: Record<string, string>;
}

/**
 * Расширенная информация о текущем маршруте, которую получает Page.
 * Содержит всё, что может пригодиться в шаблонах и логике страницы.
 */
export interface CurrentRoute extends NavigationTarget {
    /** Исходный паттерн, который совпал (например "/users/:id"). */
    pattern: string;
    /** Строка hash вместе с "#", если есть (например "#section"). */
    hash: string;
    /** Полный путь без basePath, включая query и hash. */
    fullPath: string;
    /** Полный href с учётом basePath (то, что в адресной строке). */
    href: string;
    /** Текущий basePath приложения. */
    basePath: string;
}

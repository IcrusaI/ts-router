import RouteOptions from "@/common/router/RouteOptions";

/** Объект, передаваемый в middleware‑функции. */
export default interface NavigationTarget {
    /** Абсолютный путь БЕЗ query, c учётом basePath */
    path: string;
    /** Динамические параметры из шаблона ("/user/:id") */
    params: Record<string, string>;
    /** Опции маршрута (middlewares, redirectTo и т.п.) */
    meta: RouteOptions;
    /** Query‑параметры как URLSearchParams */
    query: URLSearchParams;
    /** Удобный объект из query */
    queryObj: Record<string, string>;
}
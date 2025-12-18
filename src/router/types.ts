import Page from "@/components/Page";

/** Класс компонента страницы. */
export type PageClass = new (...args: any[]) => Page;

/**
 * Провайдер страницы: синхронный класс ИЛИ динамический import, который
 * возвращает либо сам класс, либо модуль с `default` классом.
 */
export type PageResolver = (() => Promise<{ default: PageClass } | PageClass>) | PageClass;

/** Middleware-перехватчик навигации, вызывается перед каждым переходом. */
export type NavigationGuard = (to: CurrentRoute, from: CurrentRoute) => boolean | Promise<boolean>;

/** Тонкие настройки маршрута. */
export interface RouteOptions {
    /** Массив before‑each guards (выполняются последовательно). */
    middlewares?: NavigationGuard[];
    /** Автоматический редирект. */
    redirectTo?: string;
}

/** Общие опции инициализации Router. */
export interface RouterOptions {
    /** Корневая папка приложения (если не в "/"). */
    basePath?: string;
    /** Заголовок по умолчанию, если страница ничего не вернула. */
    defaultTitle?: string;
    /** Провайдер 404 страницы. */
    notFound?: PageResolver;
    /** Провайдер страницы ошибок. */
    errorPage?: PageResolver;
}

/** Минимальный набор данных о маршруте (используется в middleware). */
export interface NavigationTarget {
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

/** Скомпилированный маршрут, который хранит Router. */
export interface ParsedRoute {
    /** Оригинальный паттерн ("/posts/:slug") для отладки. */
    pattern: string;
    /** Скомпилированный RegExp. */
    regex: RegExp;
    /** Имена `:params` в порядке появления. */
    paramNames: string[];
    /** Фабрика класса страницы. */
    loadPage: () => Promise<PageClass>;
    /** Опции маршрута. */
    opts: RouteOptions;
}

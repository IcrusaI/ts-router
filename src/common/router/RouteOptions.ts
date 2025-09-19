import { BeforeEachHook } from "@/common/router/types";

/** Тонкие настройки маршрута */
export default interface RouteOptions {
    /** Массив before‑each guards (выполняются последовательно) */
    middlewares?: BeforeEachHook[];
    /** Автоматический редирект */
    redirectTo?: string;
}
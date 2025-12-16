import { NavigationGuard } from "@/router/contracts/NavigationGuard";

/** Тонкие настройки маршрута */
export default interface RouteOptions {
    /** Массив before‑each guards (выполняются последовательно) */
    middlewares?: NavigationGuard[];
    /** Автоматический редирект */
    redirectTo?: string;
}
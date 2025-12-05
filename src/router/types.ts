import NavigationTarget from "@/router/NavigationTarget";
import Page from "@/components/Page";

/** Middleware‑guard, вызывается перед каждым переходом. */
export type BeforeEachHook = (
    to: NavigationTarget,
    from: NavigationTarget,
) => boolean | Promise<boolean>;

/** Класс компонента страницы */
export type PageCtor = new (...args: any[]) => Page;

/**
 * Провайдер страницы: синхронный класс ИЛИ динамический import, который
 * возвращает либо сам класс, либо модуль с `default` классом.
 */
export type PageProvider = (() => Promise<{ default: PageCtor } | PageCtor>) | PageCtor;

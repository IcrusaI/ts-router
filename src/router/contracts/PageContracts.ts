import Page from "@/components/Page";

/** Класс компонента страницы. */
export type PageClass = new (...args: any[]) => Page;

/**
 * Провайдер страницы: синхронный класс ИЛИ динамический import, который
 * возвращает либо сам класс, либо модуль с `default` классом.
 */
export type PageResolver = (() => Promise<{ default: PageClass } | PageClass>) | PageClass;

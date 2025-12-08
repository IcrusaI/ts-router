import Layout, {Hook} from "@/components/Layout";

/**
 * Плагин (feature) для {@link Layout}.
 *
 * Плагин может реагировать на ключевые моменты жизненного цикла корневого
 * компонента и расширять его поведение. Плагины регистрируются методом
 * {@link Layout.with} и становятся доступными как поля экземпляра
 * (например, `layout.slots`, `layout.children`).
 *
 * @typeParam Host Конкретный тип хоста (обычно сам CoreLayout или его наследник).
 */
export interface Feature<Host extends Layout = Layout> {
    /**
     * Инициализация плагина: хост уже создан, но корневой DOM ещё не построен.
     * Вызывается сразу при регистрации плагина в {@link Layout.with}.
     *
     * @param host Экземпляр хоста.
     */
    onInit?(host: Host): void;

    /**
     * Корневой DOM-элемент создан, но ещё может не находиться в документе.
     * Удобно собирать ссылки на поддеревья, искать `<template>` и т.п.
     *
     * @param root Корневой HTMLElement хоста.
     */
    onRootCreated?(root: HTMLElement): void;

    /**
     * Хостовый корень уже вставлен в DOM (после {@link Layout.mountTo}).
     * Можно выполнять измерения, подключать наблюдателей и пр.
     */
    onMounted?(): Hook;

    /**
     * Хост собирается уничтожаться ({@link Layout.destroy}).
     * Здесь освобождаем ресурсы (таймеры, подписки, каскадный destroy и т.д.).
     */
    onDestroy?(): Hook;
}
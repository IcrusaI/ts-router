import CoreLayout from "@/common/components/CoreLayout";
import { ChildrenFeature } from "@/common/components/feature/ChildrenFeature";
import { SlotsFeature } from "@/common/components/feature/SlotsFeature";

/**
 * Публичный layout-класс для потребителей библиотеки.
 *
 * Это тонкая обёртка над {@link CoreLayout}, которая **по умолчанию** подключает
 * две фичи:
 *
 * - {@link ChildrenFeature} — управление дочерними компонентами (attach/detach)
 *   и каскадный жизненный цикл (авто-`destroy()` детей при уничтожении родителя).
 *   Доступна как поле {@link Layout.children | `layout.children`}.
 *
 * - {@link SlotsFeature} — система слотов на `<template slot="name">` с
 *   «отложенной» вставкой и интеграцией с ChildrenFeature для монтирования
 *   дочерних layout’ов внутрь слотов. Доступна как
 *   {@link Layout.slots | `layout.slots`}.
 *
 * Поведение и контракт:
 * - Наследник обязан реализовать `renderStructure()` (унаследованная абстракция
 *   из {@link CoreLayout}). Он может вернуть **HTMLElement** или **дочерний
 *   layout** (композиция). Во втором случае подключённая ChildrenFeature
 *   гарантирует корректный attach и каскадный destroy.
 *
 * - Дополнительные пользовательские фичи можно подключать через
 *   `this.with("my", new MyFeature())` прямо в конструкторе наследника —
 *   они появятся как поля (`this.my`).
 *
 * @typeParam TSlots Строковый литерал с допустимыми именами слотов
 * (используется типобезопасно в `layout.slots.setSlot(name, ...)`).
 */
export default abstract class Layout<TSlots extends string = never> extends CoreLayout {
    /**
     * Фича управления дочерними компонентами.
     * Появляется автоматически в конструкторе.
     */
    public children!: ChildrenFeature;

    /**
     * Фича слотов `<template slot="...">` с отложенной вставкой содержимого.
     * Появляется автоматически в конструкторе.
     */
    public slots!: SlotsFeature<TSlots>;

    /**
     * Конструктор:
     * - вызывает базовый конструктор {@link CoreLayout};
     * - подключает фичи `children` и `slots` так, чтобы они стали полями экземпляра.
     *
     * Примечание:
     * - Порядок установки важен: `children` подключается до `slots`, чтобы
     *   слоты могли монтировать дочерние layout’ы через `children.attach(...)`.
     */
    constructor() {
        super();
        // Подключаем фичи как поля экземпляра: this.children, this.slots
        this.with("children", new ChildrenFeature());
        this.with("slots", new SlotsFeature<TSlots>());
    }
}
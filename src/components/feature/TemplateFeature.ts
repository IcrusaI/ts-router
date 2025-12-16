import type { IFeature } from "@/components/IFeature";
import type Layout from "@/components/Layout";
import { effect } from "@/utils/reactive";
import type ChildrenFeature from "@/components/feature/ChildrenFeature";
import type SlotsFeature from "@/components/feature/SlotsFeature";

/**
 * TemplateFeature — расширенный шаблонизатор для Layout.
 *
 * Возможности:
 * - Подстановка выражений `{{ expr }}` с реактивной перерисовкой;
 * - Поддержка вложенных layout’ов через теги `<layout type="...">`;
 * - Передача слотов дочернему layout: `<template slot="name">...</template>`;
 * - Рендеринг содержимого слотов через шаблонизатор родителя.
 *
 * Для подключения используй декоратор {@link UseFeatures}:
 * ```ts
 * @UseFeatures(TemplateFeature)
 * class MyLayout extends Layout {}
 * ```
 */
export default class TemplateFeature implements IFeature {
    static readonly featureName = "template";

    /** Хостовый layout, для которого подключена фича. */
    private host!: Layout;
    /** Список disposer-функций эффектов, чтобы очистить при destroy. */
    private disposers: Array<() => void> = [];
    /** Ссылка на ChildrenFeature хоста (если есть) для регистрации дочерних layout’ов. */
    private children?: ChildrenFeature;

    /**
     * Инициализация: сохраняем хост и пробуем получить ссылку на ChildrenFeature.
     */
    onInit(host: Layout) {
        this.host = host;
        this.children = (host as any)["children"] as ChildrenFeature | undefined;
    }

    /**
     * Очистка: вызывается при уничтожении хоста. Здесь снимаются все эффекты.
     */
    onDestroy() {
        for (const dispose of this.disposers) dispose();
        this.disposers.length = 0;
    }

    /**
     * Скомпилировать строковый HTML-шаблон в DOM-дерево.
     *
     * Метод ожидает, что шаблон содержит ровно один корневой элемент. В
     * противном случае будет выброшена ошибка. Если необходимы
     * множественные корни (например, для содержимого слотов), используйте
     * {@link compileFragment} напрямую.
     *
     * @param tpl HTML-строка с выражениями `{{ ... }}` и `<layout>`-тегами.
     * @param components Карта имен layout’ов, доступных для создания через `<layout type>`.
     * @returns Готовый `HTMLElement` — корень скомпилированного шаблона.
     */
    public html(tpl: string, components: Record<string, any> = {}): HTMLElement {
        const fragment = this.compileFragment(tpl, components);
        const rootEl = fragment.firstElementChild;
        if (!rootEl || fragment.childElementCount !== 1) {
            throw new Error(
                "TemplateFeature.html(): template must contain exactly one root element. " +
                "Wrap multiple roots in a container element or use compileFragment()",
            );
        }
        return rootEl as HTMLElement;
    }

    /**
     * Скомпилировать строковый HTML в `DocumentFragment`. В отличие от
     * {@link html}, поддерживает любое количество корневых узлов. Выражения
     * `{{ ... }}` и вложенные layout’ы будут обработаны аналогично.
     *
     * @param tpl HTML-строка для компиляции.
     * @param components Карта имен layout’ов, доступных для создания через `<layout type>`.
     * @returns `DocumentFragment` с готовым DOM.
     */
    public compileFragment(tpl: string, components: Record<string, any> = {}): DocumentFragment {
        // 1) Заменяем все {{ expr }} на <span data-bind="id">
        const binds: { id: number; expr: string }[] = [];
        let counter = 0;
        const compiledString = tpl.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expr) => {
            const id = counter++;
            binds.push({ id, expr: String(expr).trim() });
            return `<span data-bind="${id}"></span>`;
        });

        // 2) Парсим HTML через <template>
        const tmpl = document.createElement("template");
        tmpl.innerHTML = compiledString.trim();
        const fragment = tmpl.content;

        // 3) Обрабатываем вложенные layout-теги до регистрации биндов. Это
        // важно, потому что layout-теги могут содержать собственные {{ }}.
        this.processLayouts(fragment, components);

        // 4) Для каждого бинда создаём эффект, обновляющий текст по изменению
        for (const { id, expr } of binds) {
            const placeholders = fragment.querySelectorAll(`[data-bind="${id}"]`);
            placeholders.forEach(node => {
                const el = node as HTMLElement;
                const dispose = effect(() => {
                    let value: any = this.host as any;
                    for (const part of expr.split(".")) {
                        if (value == null) break;
                        value = value[part];
                    }
                    if (typeof value === "function") value = value.call(this.host);
                    el.textContent = value != null ? String(value) : "";
                });
                this.disposers.push(dispose);
            });
        }

        return fragment;
    }

    /**
     * Найти и заменить все `<layout type="...">` внутри заданного DOM.
     * Созданные дочерние layout’ы регистрируются в {@link ChildrenFeature}.
     * Содержимое их слотов обрабатывается через текущий шаблонизатор, т.е.
     * выражения `{{ ... }}` ищутся в контексте родительского layout’а.
     *
     * @param root Корневой узел, в котором выполняется поиск.
     * @param components Карта конструкций layout’ов, доступных для вставки.
     */
    private processLayouts(root: ParentNode, components: Record<string, any>): void {
        // Собираем кандидатов: если root сам является layout, проверим отдельно
        const items: HTMLElement[] = [];

        const pushIfLayout = (elem: Element | null | undefined) => {
            if (!elem || !(elem instanceof HTMLElement)) return;
            const tagName = elem.tagName.toLowerCase();
            if (tagName === "layout" && elem.hasAttribute("type")) {
                items.push(elem);
            }
        };

        // 1) Проверяем корень, если это элемент
        if (root instanceof HTMLElement) {
            pushIfLayout(root);
        }

        // 2) Находим все вложенные layout-теги
        root.querySelectorAll("layout[type]").forEach(elem => {
            if (elem instanceof HTMLElement) items.push(elem);
        });

        // 3) Обрабатываем каждый найденный тег
        for (const node of items) {
            // возможно, узел уже удалён из DOM (обработан), пропускаем
            if (!node.isConnected) continue;
            const type = node.getAttribute("type") ?? undefined;
            if (!type) continue;
            const Ctor = components?.[type];
            if (typeof Ctor !== "function") continue;

            // Создаём экземпляр дочернего layout
            const child: any = new Ctor();

            // 3a) Ищем все <template slot="..."> внутри данного layout-тега
            const templates = Array.from(
                node.querySelectorAll(":scope > template[slot]")
            ) as HTMLTemplateElement[];
            for (const tpl of templates) {
                const slotName = tpl.getAttribute("slot") || "default";
                const inner = tpl.innerHTML;
                // Сначала удаляем живой <template>, чтобы потом его контент не смешался с default
                tpl.remove();
                // Компилируем содержимое слота в контексте родителя
                const frag = this.compileFragment(inner, components);
                const slots: any = (child as any).slots;
                if (slots && typeof slots.setSlot === "function") {
                    void slots.setSlot(slotName as any, frag);
                }
            }

            // 3b) Обрабатываем оставшиеся дочерние узлы как содержимое default слота
            const remaining: ChildNode[] = [];
            node.childNodes.forEach(ch => {
                if (ch instanceof HTMLTemplateElement) return; // template уже обработаны
                remaining.push(ch);
            });
            if (remaining.length > 0) {
                let htmlStr = "";
                for (const ch of remaining) {
                    if (ch instanceof HTMLElement) {
                        htmlStr += ch.outerHTML;
                    } else if (ch.nodeType === Node.TEXT_NODE) {
                        htmlStr += ch.textContent ?? "";
                    }
                }
                // Очищаем оригинальных детей перед передачей во фрагмент
                remaining.forEach(ch => ch.remove());
                const defFrag = this.compileFragment(htmlStr, components);
                const slots: any = (child as any).slots;
                if (slots && typeof slots.setSlot === "function") {
                    void slots.setSlot("default" as any, defFrag);
                }
            }

            // 3c) Получаем корневой DOM дочернего layout
            let childRoot: HTMLElement | null = null;
            if (typeof child.getElement === "function") {
                childRoot = child.getElement();
            } else if (child instanceof HTMLElement) {
                childRoot = child;
            }
            if (!childRoot) continue;

            // 3d) Регистрируем ребёнка для каскадного destroy
            if (this.children && typeof this.children.register === "function") {
                this.children.register(child);
            }

            // 3e) Заменяем тег <layout> на реальный DOM дочернего layout
            node.replaceWith(childRoot);
        }
    }
}
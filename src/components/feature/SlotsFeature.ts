import {isLayoutLike} from "@/components/Layout";
import Layout from "@/components/Layout";
import { ChildrenFeature } from "@/components/feature/ChildrenFeature";
import { Feature as FeatureContract } from "@/components/Feature";

/**
 * Фича «слотов» на базе `<template slot="name">` с поддержкой
 * отложенной вставки содержимого и композиций с дочерними layout’ами.
 *
 * Возможности:
 * - Поиск `<template slot="...">` в корневом DOM хоста;
 * - Однократная «обёртка» шаблона маркерами-комментариями
 *   `<!--slot:name-start--> ... <!--slot:name-end-->` (см. {@link ensureWrapped});
 * - Вставка контента в слот через {@link setSlot}:
 *   строка, DOM-узел или другой `Layout` (дочерний);
 * - «Отложенные слоты»: если `setSlot` вызван до появления DOM/шаблонов,
 *   контент накапливается в очереди и применяется при {@link onRootCreated}/{@link onMounted};
 * - Интеграция с {@link ChildrenFeature}: дочерние layout’ы монтируются через
 *   `children.attach` и корректно уничтожаются каскадом.
 *
 * @typeParam TSlots Строковый литерал с допустимыми именами слотов.
 */
export class SlotsFeature<TSlots extends string = never> implements FeatureContract<Layout> {
    /** Хостовый layout, к которому подключена фича. */
    private host!: Layout;

    /** Корневой DOM-элемент хоста (устанавливается в {@link onRootCreated}). */
    private root?: HTMLElement;

    /**
     * Карта обнаруженных `<template slot="...">`.
     * Ключ — имя слота, значение — соответствующий HTMLTemplateElement.
     */
    private readonly slotMap = new Map<string, HTMLTemplateElement>();

    /**
     * Очередь «отложенных» вставок для слотов, когда шаблон ещё не найден.
     * Ключ — имя слота, значение — массив контента (строка/узел/дочерний layout).
     */
    private readonly pending = new Map<string, Array<Node | string | Layout>>();

    /** Флаг: идёт ли сейчас применение отложенных слотов (см. {@link flush}). */
    private flushing = false;

    /**
     * Ссылка на {@link ChildrenFeature}, если она подключена у хоста.
     * Используется для корректного монтирования дочерних layout’ов в слот.
     */
    private children?: ChildrenFeature;

    /**
     * Инициализация фичи: сохраняем хост и пробуем получить ссылку на
     * подключённую фичу детей (`layout.children`), если она есть.
     */
    onInit(host: Layout) {
        this.host = host;
        this.children = (host as any).children as ChildrenFeature | undefined;
    }

    /**
     * Хук: корневой DOM создан. Здесь собираем все `<template slot="...">`
     * внутри корня и инициируем «проливку» отложенных вставок.
     */
    onRootCreated(root: HTMLElement) {
        this.root = root;
        for (const tpl of Array.from(root.querySelectorAll("template"))) {
            const name = tpl.getAttribute("slot") || "default";
            if (tpl instanceof HTMLTemplateElement) this.slotMap.set(name, tpl);
        }
        void this.flush();
    }

    /**
     * Хук: корень вставлен в документ. Повторно пробуем применить
     * отложенные вставки, если они были.
     */
    onMounted() {
        return this.flush();
    }

    /**
     * Вставить содержимое в именованный слот.
     *
     * Поведение:
     * - Если слот ещё не известен (шаблон не найден) — контент попадает в очередь
     *   {@link pending} и будет применён позже в {@link flush};
     * - В противном случае шаблон гарантированно «обёрнут» маркерами
     *   (см. {@link ensureWrapped}), текущий контент между ними очищается,
     *   затем вставляется новый:
     *   - `string` → текстовый узел;
     *   - `Node` → как есть;
     *   - `Layout` → монтируется через {@link ChildrenFeature.attach} (если есть),
     *     иначе через прямой `mountTo` (без каскадного destroy).
     *
     * @param name Имя слота.
     * @param content Текст, DOM-узел или дочерний layout.
     */
    async setSlot(name: TSlots, content: Node | string | Layout) {
        const key = String(name);
        if (!this.slotMap.has(key)) {
            const list = this.pending.get(key) ?? [];
            list.push(content);
            this.pending.set(key, list);
            return;
        }

        const { before, after } = this.ensureWrapped(key);

        // очистка существующего содержимого между маркерами
        let node = before.nextSibling;
        while (node && node !== after) {
            const next = node.nextSibling;
            (node as ChildNode).remove();
            node = next;
        }

        // вставка нового содержимого
        if (typeof content === "string") {
            after.before(document.createTextNode(content));
        } else if (isLayoutLike(content)) {
            if (this.children) {
                const frag = document.createDocumentFragment();
                await this.children.attach(content, frag);
                after.before(frag);
            } else {
                const frag = document.createDocumentFragment();
                await content.mountTo(frag);
                after.before(frag);
            }
        } else {
            after.before(content);
        }
    }

    // --- helpers ---

    /**
     * Гарантирует, что `<template slot="name">` заменён на пару маркеров
     * `<!--slot:name-start--> ... <!--slot:name-end-->`, и возвращает эти маркеры.
     *
     * Если маркеров ещё нет — они вставляются на место живого `<template>`,
     * а исходное содержимое `tpl.content` переносится между ними.
     *
     * @param name Имя слота.
     * @throws Если слот с таким именем не найден.
     * @returns Объект с маркерами `{ before, after }`.
     * @private
     */
    private ensureWrapped(name: string) {
        const tpl = this.slotMap.get(name);
        if (!tpl) throw new Error(`Slot "${name}" not found`);

        let before = this.findMarker(name, "start");
        let after  = this.findMarker(name, "end");

        if (!before || !after) {
            // создаём маркеры и заменяем ими живой <template>
            before = document.createComment(`slot:${name}-start`);
            after  = document.createComment(`slot:${name}-end`);

            tpl.replaceWith(before, after);

            // переносим начальное наполнение слота (используем tpl.content — DocumentFragment)
            after.before(tpl.content);
        }

        return { before: before!, after: after! };
    }

    /**
     * Поиск маркера-комментария слота в корневом DOM.
     *
     * @param name Имя слота.
     * @param pos Позиция маркера: `"start"` или `"end"`.
     * @returns Найденный `Comment` или `null`, если маркер отсутствует.
     * @private
     */
    private findMarker(name: string, pos: "start" | "end"): Comment | null {
        const root = this.root!;
        const search = `slot:${name}-${pos}`;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
        let node: Comment | null;
        while ((node = walker.nextNode() as Comment | null)) {
            if (node.nodeValue === search) return node;
        }
        return null;
    }

    /**
     * Применить («пролить») все отложенные вставки из {@link pending}.
     *
     * Логика:
     * - Берём снимок очереди и очищаем её (чтобы новые вставки не зациклливались);
     * - Для каждого имени слота:
     *   - если слот ещё не найден — возвращаем элементы обратно в очередь;
     *   - иначе — вызываем {@link setSlot} для каждого накопленного элемента
     *     в том порядке, в котором они были поставлены.
     *
     * Повторные вызовы защищены флагом {@link flushing}.
     *
     * @private
     */
    private async flush() {
        if (this.flushing) return;
        this.flushing = true;
        try {
            const snap = new Map(this.pending);
            this.pending.clear();

            for (const [key, items] of snap) {
                if (!this.slotMap.has(key)) {
                    const back = this.pending.get(key) ?? [];
                    back.push(...items);
                    this.pending.set(key, back);
                    continue;
                }
                for (const it of items) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await this.setSlot(key as any, it);
                }
            }
        } finally {
            this.flushing = false;
        }
    }
}
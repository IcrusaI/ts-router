import type Layout from "@/components/Layout";
import { IFeature } from "@/components/IFeature";
import { renderTemplate } from "@/utils/template";
import { effect } from "@/utils/reactive";
import { isLayoutLike } from "@/components/Layout";

/**
 * Карта компонентов, доступных внутри HTML-шаблона.
 *
 * Ключ — строковый идентификатор типа (например, "ShellLayout"),
 * значение — конструктор Layout.
 */
export type TemplateComponents = Record<string, new () => Layout>;

type Bind = { id: number; expr: string };

/**
 * Фича шаблонов.
 *
 * Возможности:
 * - Реактивные вставки `{{ expr }}` (берутся из instance layout);
 * - Вставка вложенных Layout'ов через теги:
 *   - `<layout type="ShellLayout"> ... </layout>`
 *   - `<ShellLayout> ... </ShellLayout>`
 * - Проброс слотов во вложенный layout через:
 *   - `<template slot="header"> ... </template>`
 *   - прямые дочерние узлы -> default slot
 */
export default class TemplateFeature implements IFeature {
  private host!: Layout;

  onInit(host: Layout) {
    this.host = host;
  }

  /**
   * Построить DOM из HTML-строки.
   *
   * Важно: метод синхронный и возвращает финальный DOM —
   * все `<layout ...>` будут заменены на реальные корни вложенных Layout'ов.
   */
  html(tpl: string, components: TemplateComponents = {}): HTMLElement {
    const binds: Bind[] = [];
    let i = 0;

    // Каждый {{ expr }} -> отдельный span placeholder
    const compiled = tpl.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, expr) => {
      const id = i++;
      binds.push({ id, expr: String(expr).trim() });
      return `<span data-bind="${id}"></span>`;
    });

    const root = renderTemplate(compiled, {});

    // 1) Сначала обработаем layout-теги (они должны превратиться в реальные DOM-узлы)
    this.processLayoutTags(root, components);

    // 2) Затем повесим реактивные биндинги
    for (const { id, expr } of binds) {
      const node = root.querySelector<HTMLElement>(`[data-bind="${id}"]`);
      if (!node) continue;

      effect(() => {
        let value: any = this.host as any;
        for (const part of expr.split('.')) {
          if (value == null) break;
          value = value[part];
        }
        if (typeof value === 'function') value = value.call(this.host);

        // DOM-узел
        if (value instanceof Node) {
          node.replaceWith(value);
          return;
        }

        // LayoutLike в {{ }} — поддержка композиции
        if (isLayoutLike(value)) {
          const child = value as any as Layout;
          this.registerChild(child);
          node.replaceWith((child as any).getElement ? (child as any).getElement() : (child as any));
          return;
        }

        node.textContent = value != null ? String(value) : '';
      });
    }

    return root;
  }

  private processLayoutTags(root: HTMLElement, components: TemplateComponents) {
    const layoutTags: HTMLElement[] = [];

    if (
        root instanceof HTMLElement &&
        root.tagName.toLowerCase() === "layout" &&
        root.hasAttribute("type")
    ) {
      layoutTags.push(root);
    }

    layoutTags.push(
        ...(Array.from(root.querySelectorAll("layout[type]")) as HTMLElement[])
    );

    for (const tag of layoutTags) {
      const type = tag.getAttribute('type')?.trim();
      if (!type) continue;
      const Ctor = components[type];
      if (!Ctor) continue;
      this.instantiateAndReplace(tag, Ctor);
    }
  }

  private instantiateAndReplace(tag: HTMLElement, Ctor: new () => Layout) {
    const child = new Ctor();
    this.registerChild(child);

    // Слоты: template[slot] + default
    const slots = (child as any).slots as { setSlot?: (name: string, content: any) => Promise<void> } | undefined;

    if (slots?.setSlot) {
      // template slot
      const directChildren = Array.from(tag.children);
      const templates = directChildren.filter(
        (el) => el.tagName.toLowerCase() === 'template' && (el as HTMLElement).hasAttribute('slot'),
      ) as HTMLTemplateElement[];

      for (const t of templates) {
        const slotName = t.getAttribute('slot') || 'default';
        const frag = t.content.cloneNode(true) as DocumentFragment;
        void slots.setSlot(slotName, frag);
        t.remove();
      }

      // default slot = оставшиеся узлы (включая текстовые)
      const defaultFrag = document.createDocumentFragment();
      while (tag.firstChild) defaultFrag.appendChild(tag.firstChild);
      if (defaultFrag.childNodes.length) {
        void slots.setSlot('default', defaultFrag);
      }
    } else {
      // Если слотов нет — просто переносим детей в корень ребёнка (как fallback)
      const host = (child as any).getElement?.() as HTMLElement | undefined;
      if (host) {
        while (tag.firstChild) host.appendChild(tag.firstChild);
      }
    }

    // Синхронный рендер ребёнка
    const el = (child as any).getElement ? (child as any).getElement() : (child as any);
    tag.replaceWith(el);
  }

  private registerChild(child: Layout) {
    const children = (this.host as any).children as { register?: (c: Layout) => void; attach?: any } | undefined;
    if (children?.register) children.register(child);
  }
}

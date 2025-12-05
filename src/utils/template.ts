/*
 * template.ts — простой шаблонизатор для подстановки контента в HTML
 *
 * Этот модуль предоставляет функцию для рендеринга строковых HTML‑шаблонов
 * с плейсхолдерами вида `{{ путь.к.значению }}`. Путь разбивается по точкам
 * и ищется в переданном объекте контекста. Если значение найдено, оно
 * подставляется в итоговую строку, иначе плейсхолдер заменяется на
 * пустую строку.
 *
 * Например:
 *
 * ```ts
 * import { renderTemplate } from "@/utils/template";
 *
 * const html = `<button>{{ user.name }}</button>`;
 * const el = renderTemplate(html, { user: { name: "Alice" } });
 * // el.outerHTML === '<button>Alice</button>'
 * ```
 */

/**
 * Скомпилировать шаблон в DOM‑элемент, заменив все выражения вида
 * `{{ ... }}` на значения из контекста. Выражение разбивается по
 * точкам и последовательно применяется к объекту `context`. Если
 * промежуточное значение становится `null` или `undefined`, то
 * результатом будет пустая строка.
 *
 * @param tpl HTML‑строка с плейсхолдерами
 * @param context Объект, в котором ищутся значения
 * @returns Первый DOM‑элемент, полученный из шаблона
 */
export function renderTemplate(
  tpl: string,
  context: Record<string, any>,
): HTMLElement {
  // заменяем все {{ expression }} на значение из context
  const compiled = tpl.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expr) => {
    // разбиваем выражение по точкам и убираем лишние пробелы
    const path = expr.split('.').map((s: string) => s.trim()).filter(Boolean);
    let value: any = context;
    for (const key of path) {
      if (value == null) {
        return '';
      }
      value = value[key];
    }
    return value != null ? String(value) : '';
  });
  // создаём временный <template>, чтобы распарсить строку в DOM
  const tmpl = document.createElement('template');
  tmpl.innerHTML = compiled.trim();
  const element = tmpl.content.firstElementChild;
  if (!element) {
    throw new Error('renderTemplate(): шаблон не содержит корневого элемента');
  }
  return element as HTMLElement;
}
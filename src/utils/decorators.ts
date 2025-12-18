import { signal } from "@/utils/reactive";

/**
 * Поле-классовый декоратор для простого сигнала.
 *
 * Использует новый стандартный синтаксис декораторов (TypeScript ≥5.0).
 * На каждый экземпляр создаётся отдельный `signal`, поэтому чтение/запись
 * свойства автоматически триггерит подписанные эффекты.
 *
 * ```ts
 * class Counter {
 *   @reactive count = 0;
 * }
 * ```
 */
export function reactive(initialValue: unknown, context: ClassFieldDecoratorContext): void {
    if (context.kind !== "field") {
        throw new Error("@reactive применим только к полям класса");
    }

    context.addInitializer(function () {
        const name = context.name as string;
        const sig = signal(initialValue as any);

        Object.defineProperty(this, name, {
            ...sig,
            enumerable: true,
            configurable: true,
        });
    });
}

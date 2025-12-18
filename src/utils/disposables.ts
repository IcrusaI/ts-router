import { effect, EffectDisposer } from "@/utils/reactive";

/**
 * Универсальный контейнер для «очистителей» (disposer-функций).
 *
 * Позволяет складывать однотипно любые функции завершения — отписки от
 * событий DOM, остановку реактивных эффектов, снятие таймеров и т.д.
 * Все добавленные функции вызываются методом {@link flush}, после чего
 * контейнер очищается.
 */
export class DisposableScope {
    /** Список накопленных disposer-функций. */
    private readonly disposers: Array<() => void | Promise<void>> = [];

    /**
     * Зарегистрировать произвольный очиститель.
     *
     * @param disposer Функция, которая снимает слушатель/эффект/таймер.
     */
    public add(disposer: () => void | Promise<void>): void {
        this.disposers.push(disposer);
    }

    /**
     * Упростить работу с {@link effect}: создаёт эффект и автоматически
     * добавляет его disposer в контейнер.
     *
     * @param fn Тело эффекта.
     * @returns Диспозер, возвращаемый `effect(fn)`.
     */
    public effect(fn: () => void): EffectDisposer {
        const dispose = effect(fn);
        this.add(dispose);
        return dispose;
    }

    /**
     * Подписаться на DOM-событие с автоснятием в {@link flush}.
     *
     * @param target Цель подписки (`window`, `document` или любой `EventTarget`).
     * @param type Имя события, например `"click"` или `"popstate"`.
     * @param handler Обработчик события.
     * @param options Дополнительные опции подписки.
     */
    public listen(
        target: EventTarget,
        type: string,
        handler: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions
    ): void {
        target.addEventListener(type, handler, options);
        this.add(() => target.removeEventListener(type, handler, options));
    }

    /**
     * Вызвать все зарегистрированные disposer-функции и очистить контейнер.
     */
    public async flush(): Promise<void> {
        while (this.disposers.length > 0) {
            const disposer = this.disposers.shift();
            if (!disposer) continue;
            await disposer();
        }
    }
}

export default DisposableScope;

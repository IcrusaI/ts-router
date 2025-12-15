/**
 * Читаемо-записываемый сигнал.
 *
 * Выглядит как функция без аргументов (чтение значения)
 * и имеет метод `set` для записи.
 *
 * ```ts
 * const count = signal(0);
 * console.log(count()); // 0
 * count.set(1);
 * ```
 *
 * @typeParam T Тип хранимого значения.
 */
export interface ReadWriteSignal<T> {
    (): T;                    // чтение
    set(value: T): void;      // запись
    readonly __isSignal: true; // маркер для type-guard'а
}

/**
 * Внутренний тип реализации сигнала.
 * Внешнему коду не нужен.
 */
type InternalSignal = SignalImpl<any>;

/**
 * Контекст эффекта:
 * хранит функцию запуска и зависимости (сигналы).
 */
type EffectCtx = {
    run: () => void;
    deps: Set<InternalSignal>;
};

/**
 * Текущий активный эффект (если любой выполняется).
 * Используется для трекинга зависимостей.
 */
let active: EffectCtx | null = null;

/**
 * Внутренняя реализация сигнала.
 *
 * @typeParam T Тип хранимого значения.
 */
class SignalImpl<T> {
    private _value: T;
    public subscribers = new Set<EffectCtx>();

    constructor(v: T) {
        this._value = v;
    }

    /**
     * Чтение значения с автоматической подпиской
     * активного эффекта (если он есть).
     */
    get(): T {
        if (active) {
            this.subscribers.add(active);
            active.deps.add(this);
        }
        return this._value;
    }

    /**
     * Запись значения с уведомлением подписчиков.
     */
    set(v: T): void {
        if (Object.is(v, this._value)) return;
        this._value = v;

        // Копируем Set в массив, чтобы избежать проблем
        // при изменении множества в процессе обхода.
        for (const eff of Array.from(this.subscribers)) {
            eff.run();
        }
    }
}

/**
 * Создаёт новый сигнал.
 *
 * ```ts
 * const name = signal("John");
 * console.log(name()); // "John"
 * name.set("Jane");
 * ```
 *
 * @typeParam T Тип хранимого значения.
 * @param v Начальное значение.
 * @returns Функция-сигнал с методом `set`.
 */
export function signal<T>(v: T): ReadWriteSignal<T> {
    const s = new SignalImpl<T>(v);

    const getter = (() => s.get()) as ReadWriteSignal<T>;
    getter.set = (nv: T) => s.set(nv);
    // В runtime помечаем, что это именно сигнал.
    (getter as any).__isSignal = true;

    return getter;
}

/**
 * Функция, отключающая эффект и удаляющая все подписки.
 */
export type EffectDisposer = () => void;

/**
 * Регистрирует «эффект» — функцию, которая автоматически
 * пересчитается при изменении сигналов, к которым она обращается.
 *
 * ```ts
 * const count = signal(0);
 * const stop = effect(() => {
 *   console.log("count =", count());
 * });
 *
 * count.set(1); // лог пересчитается
 * stop();       // эффект отписан
 * ```
 *
 * @param fn Пользовательская функция эффекта.
 * @returns Функция для остановки эффекта и очистки зависимостей.
 */
export function effect(fn: () => void): EffectDisposer {
    const ctx: EffectCtx = {
        run: () => {
            // Отписываемся от старых зависимостей
            for (const dep of ctx.deps) dep.subscribers.delete(ctx);
            ctx.deps.clear();

            // Трекаем новые зависимости
            active = ctx;
            try {
                fn();
            } finally {
                active = null;
            }
        },
        deps: new Set(),
    };

    // Первый запуск эффекта (инициализация зависимостей)
    ctx.run();

    // Возвращаем disposer
    return () => {
        for (const dep of ctx.deps) dep.subscribers.delete(ctx);
        ctx.deps.clear();
    };
}

/**
 * Создаёт вычисляемый сигнал (computed).
 *
 * Значение автоматически пересчитывается при изменении
 * всех сигналов, которые используются внутри `calc`.
 *
 * ```ts
 * const a = signal(1);
 * const b = signal(2);
 * const sum = computed(() => a() + b());
 *
 * console.log(sum()); // 3
 * a.set(5);
 * console.log(sum()); // 7
 * ```
 *
 * @typeParam T Тип вычисляемого значения.
 * @param calc Функция вычисления значения.
 * @returns Сигнал, отражающий результат вычисления.
 */
export function computed<T>(calc: () => T): ReadWriteSignal<T> {
    // Берём начальное значение сразу, чтобы computed
    // всегда был инициализирован.
    const out = signal<T>(calc());

    // Эффект, который будет обновлять out при изменении зависимостей.
    effect(() => out.set(calc()));

    return out;
}

/**
 * Проверяет, является ли значение сигналом.
 *
 * Удобно при работе с декораторами/рефлексией.
 *
 * ```ts
 * if (isSignal(value)) {
 *   value.set("new");
 * }
 * ```
 *
 * @typeParam T Предполагаемый тип значения сигнала.
 * @param value Любое значение.
 * @returns true, если значение — ReadWriteSignal.
 */
export function isSignal<T = unknown>(value: unknown): value is ReadWriteSignal<T> {
    return typeof value === 'function' && (value as any).__isSignal === true;
}
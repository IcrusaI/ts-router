export type ReadWriteSignal<T> = {
    (): T;            // чтение
    set(value: T): void; // запись
};

type EffectCtx = { run: () => void; deps: Set<SignalImpl<any>> };
let active: EffectCtx | null = null;

class SignalImpl<T> {
    private _value: T;
    public subscribers = new Set<EffectCtx>();
    constructor(v: T) { this._value = v; }
    get(): T {
        if (active) {
            this.subscribers.add(active);
            active.deps.add(this);
        }
        return this._value;
    }
    set(v: T): void {
        if (Object.is(v, this._value)) return;
        this._value = v;
        for (const eff of Array.from(this.subscribers)) eff.run();
    }
}

export function signal<T>(v: T): ReadWriteSignal<T> {
    const s = new SignalImpl<T>(v);
    const getter = (() => s.get()) as ReadWriteSignal<T>;
    getter.set = (nv: T) => s.set(nv);
    (getter as any).__isSignal = true;
    return getter;
}

export function effect(fn: () => void): () => void {
    const ctx: EffectCtx = {
        run: () => {
            for (const dep of ctx.deps) dep.subscribers.delete(ctx);
            ctx.deps.clear();
            active = ctx;
            try { fn(); } finally { active = null; }
        },
        deps: new Set(),
    };
    ctx.run();
    return () => {
        for (const dep of ctx.deps) dep.subscribers.delete(ctx);
        ctx.deps.clear();
    };
}

export function computed<T>(calc: () => T): ReadWriteSignal<T> {
    const out = signal<T>(undefined as unknown as T);
    effect(() => out.set(calc()));
    return out;
}
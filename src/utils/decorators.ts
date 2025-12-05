/**
 * Property decorator that marks a class field as reactive. When used on a
 * property, the name of that property is recorded on the class constructor
 * (via a `__reactiveProps` set). Later, {@link CoreLayout} will scan
 * instances for properties marked in this set and convert them into
 * getters/setters backed by signals. This allows you to write:
 *
 * ```ts
 * class MyPage extends Page {
 *   @reactive public count = 0;
 * }
 * ```
 *
 * and have `count` automatically become reactive (no need to call
 * `$state()` or use a signal directly).
 *
 * The decorator does not modify the property descriptor immediately; it
 * simply registers the field name for later processing. The actual
 * conversion happens lazily when the first template is rendered.
 */
import { signal } from "@/utils/reactive";

// Декоратор поля, который делает свойство реактивным. Поддерживает как
// старый синтаксис декораторов (target, propertyKey) при включённом
// experimentalDecorators, так и новый стандартизированный синтаксис
// (value, context) в TypeScript 5. Если используется старый синтаксис,
// имя поля сохраняется на конструкторе в __reactiveProps для дальнейшей
// обработки CoreLayout. В новом синтаксисе мы используем
// context.addInitializer() для замены свойства на сигнал.
//
// Пример использования:
//   class MyPage extends Page {
//     @reactive private count = 0;
//   }
// После инициализации экземпляра поле `count` станет геттером/сеттером,
// обращающимся к сигналу. В шаблоне `{{ count }}` будет реактивно
// обновляться. Изначальное значение поля остаётся неизменным до замены.
export function reactive(...args: any[]): any {
  // Старый синтаксис: (target: any, propertyKey: string)
  if (args.length === 2 && typeof args[1] === 'string') {
    const target = args[0];
    const propertyKey = args[1] as string;
    interface ReactiveCtor extends Function {
      __reactiveProps?: Set<string>;
    }
    const ctor = target.constructor as ReactiveCtor;
    if (!ctor.__reactiveProps) {
      ctor.__reactiveProps = new Set<string>();
    }
    ctor.__reactiveProps.add(propertyKey);
    return;
  }
  // Новый синтаксис: (initialValue: any, context: ClassFieldDecoratorContext)
  const initialValue = args[0];
  const context: any = args[1];
  if (!context || context.kind !== 'field') {
    throw new Error('@reactive можно применять только к полям класса');
  }
  context.addInitializer(function initReactive(this: any) {
    const name = context.name as string;
    const current = this[name];
    const sig = signal(current);
    Object.defineProperty(this, name, {
      get() {
        return sig();
      },
      set(v: any) {
        sig.set(v);
      },
      enumerable: true,
      configurable: true,
    });
  });
  return initialValue;
}
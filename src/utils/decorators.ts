import { signal } from "@/utils/reactive";

/**
 * Декоратор, помечающий поле класса как реактивное.
 *
 * Имя поля сохраняется на конструкторе в наборе `__reactiveProps`, после чего
 * {@link Layout} при первой отрисовке превращает свойство в геттер/сеттер на
 * базе сигнала. Так можно объявлять обычные поля, но получать реактивные
 * значения в шаблоне:
 *
 * ```ts
 * class MyPage extends Page {
 *   @reactive public count = 0;
 * }
 * ```
 *
 * Сам декоратор не меняет дескриптор сразу — он лишь регистрирует поле для
 * последующей обработки. При новом синтаксисе декораторов замена выполняется
 * через `context.addInitializer`, сохраняя начальное значение поля.
 */

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
    throw new Error('@reactive can only be applied to class fields');
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
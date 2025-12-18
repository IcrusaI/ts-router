/**
 * Безопасный `decodeURIComponent` (не бросает исключение при невалидной строке).
 *
 * @param v Строка для декодирования.
 * @returns Декодированное значение либо исходную строку при ошибке.
 */
export default function safeDecodeURIComponent(v: string): string {
    try {
        return decodeURIComponent(v);
    } catch {
        return v;
    }
}

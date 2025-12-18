/**
 * Безопасный `decodeURI` (не бросает исключение при невалидной строке).
 *
 * @param v Строка для декодирования.
 * @returns Декодированное значение либо исходную строку при ошибке.
 */
export default function safeDecodeURI(v: string): string {
    try {
        return decodeURI(v);
    } catch {
        return v;
    }
}

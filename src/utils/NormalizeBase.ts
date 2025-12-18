/**
 * Нормализует `basePath`:
 *  - гарантирует ведущий `/`;
 *  - удаляет хвостовые `/`;
 *  - пустое значение приводит к `"/"`.
 *
 * @param base Пользовательский базовый путь.
 * @returns Нормализованный базовый путь.
 */
export default function normalizeBase(base: string): string {
    if (!base) return "/";
    if (base === "/") return "/";
    let b = base;
    if (!b.startsWith("/")) b = "/" + b;
    b = b.replace(/\/+$/, "");
    return b || "/";
}

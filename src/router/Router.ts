/* ======================================================================= *
 *  Router.ts — лёгкий SPA-router с middleware, редиректами и error-page   *
 *                                                                         *
 *  ▸ Динамические параметры ("/post/:slug")                               *
 *  ▸ Navigation guards (middlewares)                                      *
 *  ▸ Redirect-роуты                                                       *
 *  ▸ Страницы 404/ERROR                                                   *
 *  ▸ Авто-скролл + поддержка #якорей                                      *
 *  ▸ Полностью асинхронный life-cycle Page-компонентов                    *
 *  ▸ Защита от гонок навигации (navToken)                                 *
 * ======================================================================= */

/**
 * @fileoverview
 * Минималистичный SPA-роутер без фреймворков. Управляет историей браузера,
 * матчингом путей, обработкой middleware, редиректами и монтированием
 * страниц на основе базового класса {@link Page}.
 *
 * Основные сущности:
 * - {@link Router} — центральный класс маршрутизации;
 * - {@link Page} — базовый класс страницы, умеет монтироваться/размонтироваться;
 * - {@link ParsedRoute} — скомпилированный маршрут (RegExp + имена параметров);
 * - {@link NavigationTarget} — “куда/откуда идём” (path/params/query/meta).
 *
 * Особенности реализации:
 * - Предотвращение гонок навигации через токен {@link Router.navToken}.
 * - Перехват кликов по `<a>` для SPA-навигации (внутренние ссылки).
 * - Нормализация путей с учётом `basePath`, очисткой лишних `/`.
 * - Авто-скролл к якорям (`#hash`) и сброс прокрутки при обычных переходах.
 *
 * @example Базовое использование
 * ```ts
 * import Router from "@/router/Router";
 * import NotFoundPage from "@/components/NotFoundPage";
 *
 * const router = new Router(document.getElementById("app")!, {
 *   basePath: "/",
 *   defaultTitle: "My App",
 * });
 *
 * // Регистрация маршрутов
 * router.register("/", () => import("@/pages/HomePage"));
 * router.register("/users/:id", () => import("@/pages/UserPage"), {
 *   middlewares: [
 *     async (to) => {
 *       // Пример проверки: id обязателен
 *       return Boolean(to.params.id);
 *     },
 *   ],
 * });
 *
 * // 404 и error-страницы
 * router.setNotFound(() => NotFoundPage);
 * router.setErrorPage(() => import("@/pages/ErrorPage"));
 *
 * // Старт
 * router.init();
 * ```
 */

import Page from "@/components/Page";
import ParsedRoute from "@/router/ParsedRoute";
import { PageCtor, PageProvider } from "@/router/types";
import RouterOptions from "@/router/RouterOptions";
import RouteOptions from "@/router/RouteOptions";
import NavigationTarget from "@/router/NavigationTarget";
import {effect} from "@/utils/reactive";

/**
 * Центральный класс маршрутизации приложения.
 *
 * Выполняет:
 * 1) парсинг и хранение конфигурации маршрутов;
 * 2) сопоставление текущего `location.pathname` с зарегистрированными паттернами;
 * 3) последовательный запуск middleware-хуков для “гвардов”;
 * 4) редиректы на уровне маршрутов;
 * 5) создание/монтаж/размонтаж экземпляров страниц {@link Page};
 * 6) обновление `document.title` на основании `Page.getTitle()`;
 * 7) управление историей браузера (`pushState`/`replaceState`) и intercept `<a>`.
 */
export default class Router {
    /* ======================   PRIVATE FIELDS   ======================= */

    /**
     * Скомпилированные маршруты (порядок регистрации имеет значение).
     * @private
     */
    private readonly routes: ParsedRoute[] = [];

    /**
     * Текущая смонтированная страница или `null`, если ничего не смонтировано.
     * @private
     */
    private currentPage: Page | null = null;

    /**
     * Ленивая фабрика для страницы 404 (“not found”).
     * @private
     */
    private notFoundPage?: () => Promise<PageCtor>;

    /**
     * Ленивая фабрика для страницы ошибок (“error page”).
     * @private
     */
    private errorPage?: () => Promise<PageCtor>;

    /**
     * DOM-контейнер, в который монтируются страницы.
     * @private
     */
    private readonly container: Element;

    /**
     * Базовый префикс для приложения, напр. `"/app"` (по умолчанию `"/"`).
     * Используется в нормализации путей и при формировании URL в истории.
     * @private
     */
    private readonly basePath: string;

    /**
     * Заголовок по умолчанию, если страница не предоставила свой.
     * @private
     */
    private readonly defaultTitle: string;

    /**
     * Функция-диспозер (отписка) для текущего эффекта,
     * синхронизирующего `document.title` с реактивным заголовком {@link Page.title}.
     *
     * Каждый раз при монтировании новой страницы (`mountPage`) создаётся новый
     * эффект через {@link effect}, который подписывается на `page.title$()`.
     * Когда происходит переход на другую страницу, предыдущий эффект вызывается
     * (через `offTitleEffect()`), чтобы:
     *  - снять все подписки с предыдущего сигнала;
     *  - предотвратить утечки памяти;
     *  - исключить дублирование обновлений заголовка.
     *
     * Значение `null` означает, что активный эффект отсутствует.
     *
     * @private
     */
    private offTitleEffect: (() => void) | null = null;

    /**
     * Навигационный токен для защиты от гонок.
     * Каждый вызов {@link navigate} увеличивает токен, и асинхронные операции
     * проверяют актуальность токена перед монтированием страницы.
     * @private
     */
    private navToken = 0;

    /**
     * Создаёт экземпляр роутера.
     *
     * @param container DOM-элемент, куда будут монтироваться страницы.
     * @param opts Дополнительные опции роутера:
     *  - `basePath` — корневой префикс приложения (например, `"/admin"`).
     *  - `defaultTitle` — заголовок по умолчанию для вкладки.
     *
     * @example
     * ```ts
     * const router = new Router(document.getElementById("app")!, {
     *   basePath: "/",
     *   defaultTitle: "App"
     * });
     * ```
     */
    constructor(container: Element, opts: RouterOptions = {}) {
        this.container = container;
        this.basePath = normalizeBase(opts.basePath ?? "/");
        this.defaultTitle = opts.defaultTitle ?? "App";

        // Переходы «назад/вперёд» в браузере
        window.addEventListener("popstate", () => {
            void this.navigate(
                window.location.pathname +
                window.location.search +
                window.location.hash,
                { replace: true }
            );
        });
    }

    /**
     * Инициализация роутера:
     *  - выполняет первый рендер текущего URL;
     *  - включает перехват кликов по внутренним ссылкам.
     *
     * Безопасно вызывать повторно — повторная инициализация не ломает состояние.
     *
     * @returns Промис, который завершится после первой отрисовки.
     */
    public async init(): Promise<void> {
        await this.navigate(
            window.location.pathname +
            window.location.search +
            window.location.hash,
            { replace: true }
        );
        this.interceptLinks();
    }

    /* =========================   API   ================================= */

    /**
     * Регистрирует новый маршрут.
     *
     * @param pattern Шаблон пути. Поддерживает именованные параметры через `:`,
     *  например `"/users/:id"` или `"/post/:slug"`.
     * @param provider Провайдер страницы. Может быть:
     *  - конструктором класса, наследованного от {@link Page};
     *  - функцией `() => import("...")` с дефолтным экспортом класса страницы;
     *  - функцией, возвращающей сам класс (`Promise<PageCtor> | PageCtor`).
     * @param opts Опции маршрута:
     *  - `middlewares` — массив хуков-гвардов, которые выполняются последовательно
     *    до монтирования страницы; возврат `false` отменяет переход;
     *  - `redirectTo` — если задан, маршрут не монтируется, а выполняется редирект.
     *
     * @example
     * ```ts
     * router.register("/dashboard", () => import("@/pages/Dashboard"), {
     *   middlewares: [requireAuth]
     * });
     * ```
     */
    public register(
        pattern: string,
        provider: PageProvider,
        opts: RouteOptions = {}
    ): void {
        this.routes.push({
            ...this.parse(pattern),
            loadPage: this.wrapProvider(provider),
            opts,
        });
    }

    /**
     * Назначает страницу 404 (not found).
     *
     * @param provider Провайдер 404-страницы (синхронный класс или динамический import).
     */
    public setNotFound(provider: PageProvider): void {
        this.notFoundPage = this.wrapProvider(provider);
    }

    /**
     * Назначает страницу ошибок (error page).
     *
     * @param provider Провайдер error-страницы (синхронный класс или динамический import).
     */
    public setErrorPage(provider: PageProvider): void {
        this.errorPage = this.wrapProvider(provider);
    }

    /**
     * Выполняет программную навигацию.
     *
     * - Проводит нормализацию пути с учётом `basePath`.
     * - Находит подходящий маршрут и вычисляет `params`/`query`.
     * - Последовательно выполняет middleware-хуки.
     * - Обрабатывает `redirectTo`, если он указан в опциях маршрута.
     * - Обновляет историю (`pushState`/`replaceState`) и скролл.
     * - Монтирует целевую страницу и снимает предыдущую.
     *
     * @param to Целевой путь. Может быть абсолютным (`"/users/42"`) или
     *  включать `?query` и `#hash`. Относительные ссылки будут приведены к абсолютным через `URL`.
     * @param opts Дополнительные опции:
     *  - `replace` — использовать `replaceState` вместо `pushState`;
     *  - `query` — объект для слияния с текущей строкой запроса (`null/undefined` удаляют ключ).
     * @returns Промис без значения.
     *
     * @example
     * ```ts
     * await router.navigate("/users/42", { query: { tab: "posts" } });
     * ```
     */
    public async navigate(
        to: string,
        opts: {
            replace?: boolean;
            query?: Record<
                string,
                string | number | boolean | null | undefined
            >;
        } = {}
    ): Promise<void> {
        const { replace = false, query } = opts;

        // Собираем URL с учётом basePath
        const url = new URL(to, window.location.origin);
        if (query) {
            const sp = new URLSearchParams(url.search);
            for (const [k, v] of Object.entries(query)) {
                if (v === null || v === undefined) sp.delete(k);
                else sp.set(k, String(v));
            }
            url.search = sp.toString();
        }

        const fullPath = url.pathname + (url.search || "") + (url.hash || "");
        const destPath = this.normalize(fullPath);

        // Находим роут
        const match = this.match(destPath);
        if (!match) return this.show404();

        const search = url.search || "";
        const toTarget: NavigationTarget = {
            path: destPath,
            params: match.params,
            meta: match.opts,
            query: new URLSearchParams(search),
            queryObj: Object.fromEntries(new URLSearchParams(search)),
        };
        const fromTarget = await this.resolveCurrentTarget();

        // middleware-гарды
        for (const mw of match.opts.middlewares ?? []) {
            if (!(await mw(toTarget, fromTarget))) return; // переход отменён
        }

        // redirect
        if (match.opts.redirectTo) {
            return this.navigate(match.opts.redirectTo, { replace, query });
        }

        // История
        const href =
            this.withBase(destPath) + (url.search || "") + (url.hash || "");
        if (replace) history.replaceState({}, "", href);
        else history.pushState({}, "", href);

        // Защита от гонок навигации
        const myToken = ++this.navToken;

        try {
            const PageClass = await match.loadPage();
            // Если за это время произошла другая навигация — прекращаем
            if (myToken !== this.navToken) return;

            const page = new PageClass();
            await this.mountPage(page);

            // Скролл
            if (url.hash) {
                const target = document.querySelector(url.hash);
                if (target) (target as HTMLElement).scrollIntoView({ block: "start" });
            } else {
                window.scrollTo({ top: 0 });
            }
        } catch (err) {
            console.error(err);
            await this.showError(err);
        }
    }

    /* ======================   INTERNAL HELPERS   ====================== */

    /**
     * Формирует {@link NavigationTarget} для текущего URL.
     * Используется как значение “from” в middleware.
     *
     * @returns Текущая цель навигации (path/params/meta/query).
     * @internal
     */
    private async resolveCurrentTarget(): Promise<NavigationTarget> {
        const path = this.normalize(
            window.location.pathname +
            window.location.search +
            window.location.hash
        );
        const qs = window.location.search;
        const m = this.match(path);

        return {
            path,
            params: m?.params ?? {},
            meta: m?.opts ?? {},
            query: new URLSearchParams(qs),
            queryObj: Object.fromEntries(new URLSearchParams(qs)),
        };
    }

    /**
     * Рендерит страницу 404 (not found). Если не назначена, делегирует в
     * {@link showError} с сообщением `"Not Found"`.
     *
     * @internal
     */
    private async show404(): Promise<void> {
        if (!this.notFoundPage) return this.showError("Not Found");
        const PageClass = await this.notFoundPage();
        const page = new PageClass();
        return this.mountPage(page);
    }

    /**
     * Рендерит страницу ошибок (error page). Если не назначена, показывает
     * простое сообщение и сбрасывает `document.title` в значение по умолчанию.
     *
     * @param _err Любая ошибка/сообщение, возникшее при навигации/рендере.
     * @internal
     */
    private async showError(_err: unknown): Promise<void> {
        if (!this.errorPage) {
            const el = document.createElement("div");
            el.textContent = "Something went wrong";
            if (this.currentPage) await this.currentPage.destroy();
            this.container.replaceChildren(el);
            this.currentPage = null;
            document.title = this.defaultTitle;
            return;
        }
        const PageClass = await this.errorPage();
        const page = new PageClass();
        return this.mountPage(page);
    }

    /**
     * Корректно размонтирует предыдущую страницу и монтирует новую в контейнер,
     * а также выполняет реактивную синхронизацию заголовка документа.
     *
     * ## Логика работы:
     * 1. Если ранее был установлен эффект синхронизации заголовка —
     *    он удаляется (чтобы избежать утечек и дублирования).
     * 2. Текущая страница (`currentPage`), если существует, уничтожается
     *    вызовом {@link Page.destroy}.
     * 3. Новая страница монтируется в основной контейнер приложения
     *    методом {@link Page.mountTo}.
     * 4. Устанавливается реактивный эффект {@link effect}, который:
     *    - подписывается на сигнал {@link Page.title};
     *    - автоматически обновляет `document.title` при каждом изменении заголовка;
     *    - сбрасывает заголовок на `defaultTitle`, если значение пустое.
     * 5. Эффект сохраняется в `offTitleEffect`, чтобы его можно было
     *    безопасно удалить при следующем переходе.
     *
     * @param page Экземпляр страницы, которую требуется смонтировать.
     * @returns Промис, завершающийся после монтирования страницы
     *          и установки эффекта синхронизации заголовка.
     *
     * @example
     * ```ts
     * const userPage = new UserPage();
     * await router.mountPage(userPage);
     * // document.title теперь всегда синхронизирован с userPage.title$()
     * ```
     *
     * @internal
     */
    private async mountPage(page: Page): Promise<void> {
        if (this.offTitleEffect) { this.offTitleEffect(); this.offTitleEffect = null; }
        await this.currentPage?.destroy();

        await page.mountTo(this.container);
        this.currentPage = page;

        document.title = page.title || this.defaultTitle;

        this.offTitleEffect = page.watchTitle((t) => {
            document.title = t || this.defaultTitle;
        });
    }

    /**
     * Нормализует путь:
     *  - учитывает `basePath` (срезает слева, если он присутствует в URL);
     *  - приводить к ведущему `/`;
     *  - удаляет повторяющиеся и хвостовые `/`.
     *
     * ВАЖНО: на вход ожидается **полный** путь (может содержать `?`/`#`),
     * на выходе возвращается **только pathname** без `?query` и `#hash`.
     *
     * @param u Любая строка пути/URL (например, `"/app/users/1?tab=a#h"`).
     * @returns Нормализованный `pathname`, например `"/users/1"`.
     * @internal
     */
    private normalize(u: string): string {
        // Берём только pathname (без query/hash)
        const [raw] = u.split(/[?#]/);

        // Безопасно декодируем
        const decoded = safeDecodeURI(raw);

        // Схлопываем повторы слэшей в самом начале
        let p = decoded.replace(/\/+/g, "/");

        // Срезаем basePath слева
        if (this.basePath !== "/" && p.startsWith(this.basePath)) {
            p = p.slice(this.basePath.length) || "/";
        }

        // Гарантируем ведущий '/'
        if (!p.startsWith("/")) p = "/" + p;

        // Убираем ведущие/хвостовые слэши и снова схлопываем повторы внутри
        // "/foo//bar/" -> "/foo/bar"
        p = "/" + p.replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/");

        return p === "//" ? "/" : p;
    }

    /**
     * Добавляет `basePath` к относительному пути.
     *
     * @param path Путь без `basePath`.
     * @returns Итоговый путь с префиксом `basePath` (если он не равен `"/"`).
     * @internal
     */
    private withBase(path: string): string {
        if (this.basePath === "/") return path;
        return (
            this.basePath.replace(/\/$/, "") +
            (path.startsWith("/") ? path : "/" + path)
        );
    }

    /**
     * Ищет первый подходящий маршрут, возвращая сопоставлённые параметры.
     *
     * @param urlPath Нормализованный путь (только pathname).
     * @returns Скомбинированный объект маршрута + `params` или `null`, если нет совпадения.
     * @internal
     */
    private match(
        urlPath: string
    ): (ParsedRoute & { params: Record<string, string> }) | null {
        for (const r of this.routes) {
            const m = urlPath.match(r.regex);
            if (!m) continue;
            const params: Record<string, string> = {};
            r.paramNames.forEach(
                (n, i) => (params[n] = safeDecodeURIComponent(m[i + 1] ?? ""))
            );
            return { ...r, params };
        }
        return null;
    }

    /**
     * Приводит “провайдер страницы” к унифицированной фабрике класса.
     * Поддерживает как синхронный класс, так и динамический import.
     *
     * @param p Провайдер страницы: класс или функция, возвращающая класс/модуль.
     * @returns Фабрика `() => Promise<PageCtor>`.
     * @internal
     */
    private wrapProvider(p: PageProvider): () => Promise<PageCtor> {
        // Синхронный класс (имеет prototype.mountTo)
        if (typeof p === "function" && (p as any).prototype?.mountTo) {
            return () => Promise.resolve(p as PageCtor);
        }
        // Динамический import
        return async () => {
            const mod = await (p as () => Promise<any>)();
            return ("default" in mod ? mod.default : mod) as PageCtor;
        };
    }

    /**
     * Компилирует строковый паттерн маршрута в RegExp и список имён параметров.
     *
     * Поддерживает сегменты вида `":name"`, каждый из которых матчится на `[^/]+`.
     * Пример: `"/users/:id"` → `^/users/([^/]+)$` + `paramNames = ["id"]`.
     *
     * @param pattern Шаблон маршрута.
     * @returns Объект без фабрики `loadPage` и без опций — они добавляются в `register`.
     * @internal
     */
    private parse(pattern: string): Omit<ParsedRoute, "loadPage" | "opts"> {
        const raw = this.normalize(pattern);
        const segments = raw.split("/").filter(Boolean);

        if (segments.length === 0)
            return { pattern: "/", regex: /^\/?$/, paramNames: [] };

        const paramNames: string[] = [];
        const regex =
            "^/" +
            segments
                .map((seg) =>
                    seg.startsWith(":")
                        ? (paramNames.push(seg.slice(1)), "([^/]+)")
                        : seg.replace(/[-[\]{}()*+?.\\^$|#\s]/g, "\\$&")
                )
                .join("/") +
            "$";

        return { pattern: raw, regex: new RegExp(regex), paramNames };
    }

    /**
     * Глобальный перехват кликов по `<a>` внутри документа для SPA-навигации.
     * Игнорирует:
     *  - модифицированные клики (Ctrl/Meta/Shift/Alt);
     *  - кнопки мыши ≠ LMB;
     *  - ссылки с `download` или `target="_blank"`;
     *  - внешние ссылки (другой `origin`).
     *
     * @internal
     */
    private interceptLinks(): void {
        document.addEventListener("click", (e) => {
            // Только обычный левый клик без модификаторов
            const me = e as MouseEvent;
            if (
                e.defaultPrevented ||
                me.button !== 0 ||
                me.metaKey || me.ctrlKey || me.shiftKey || me.altKey
            ) return;

            // Поднимаемся к <a>
            let el = e.target as HTMLElement | null;
            while (el && el.tagName !== "A") el = el.parentElement;
            const a = el as HTMLAnchorElement | null;
            if (!a) return;

            const href = a.getAttribute("href") || "";
            if (!href) return;

            // Особые случаи, которые НЕ перехватываем
            if (a.hasAttribute("download") || a.target === "_blank") return;

            // 1) только-хэш ссылки: "#id" или текущий путь + "#id" — пусть браузер сам скроллит
            if (href.startsWith("#")) return;

            // 2) абсолютные http(s) на другой origin — не наши
            try {
                const url = new URL(href, window.location.href);
                if (url.origin !== window.location.origin) return;

                // 3) если путь тот же, но меняется только hash — тоже не трогаем
                const samePath = url.pathname === window.location.pathname && url.search === window.location.search;
                if (samePath && url.hash) return;

                // 4) ./relative и ../relative — считаем внутренними, но считаем итоговый pathname честно
                // 5) нормальные абсолютные внутренние пути — SPA
                if (url.pathname.startsWith("/")) {
                    e.preventDefault();
                    void this.navigate(url.pathname + url.search + url.hash);
                }
            } catch {
                // если URL не распарсился — не трогаем
                return;
            }
        });
    }
}

/* ==========================  helpers  ============================== */

/**
 * Нормализует `basePath`:
 *  - гарантирует ведущий `/`;
 *  - удаляет хвостовые `/`;
 *  - пустое значение приводит к `"/"`.
 *
 * @param base Пользовательский базовый путь.
 * @returns Нормализованный базовый путь.
 */
function normalizeBase(base: string): string {
    if (!base) return "/";
    if (base === "/") return "/";
    let b = base;
    if (!b.startsWith("/")) b = "/" + b;
    b = b.replace(/\/+$/, "");
    return b || "/";
}

/**
 * Безопасный `decodeURI` (не бросает исключение при невалидной строке).
 *
 * @param v Строка для декодирования.
 * @returns Декодированное значение либо исходную строку при ошибке.
 */
function safeDecodeURI(v: string): string {
    try {
        return decodeURI(v);
    } catch {
        return v;
    }
}

/**
 * Безопасный `decodeURIComponent` (не бросает исключение при невалидной строке).
 *
 * @param v Строка для декодирования.
 * @returns Декодированное значение либо исходную строку при ошибке.
 */
function safeDecodeURIComponent(v: string): string {
    try {
        return decodeURIComponent(v);
    } catch {
        return v;
    }
}
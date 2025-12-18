import Page from "@/components/Page";
import ParsedRoute from "@/router/ParsedRoute";
import RouterOptions from "@/router/RouterOptions";
import RouteOptions from "@/router/RouteOptions";
import NavigationTarget, {CurrentRoute} from "@/router/NavigationTarget";
import {PageClass, PageResolver} from "@/router/contracts/PageContracts";
import DisposableScope from "@/utils/disposables";
import normalizeBase from "@/utils/NormalizeBase";
import safeDecodeURI from "@/utils/SafeDecodeURI";
import safeDecodeURIComponent from "@/utils/SafeDecodeURIComponent";

/**
 * Центральный класс маршрутизации приложения.
 *
 * Делает:
 * - хранит зарегистрированные паттерны и подбирает подходящий по URL;
 * - последовательно запускает middleware (гварды) перед монтированием страницы;
 * - поддерживает redirect-роуты и страницы 404/ошибок;
 * - монтирует/размонтирует экземпляры {@link Page};
 * - синхронизирует `document.title` с реактивным полем `page.title`;
 * - обновляет историю (`pushState`/`replaceState`) и перехватывает `<a>`.
 */
class Router {
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
    private notFoundPage?: () => Promise<PageClass>;

    /**
     * Ленивая фабрика для страницы ошибок (“error page”).
     * @private
     */
    private errorPage?: () => Promise<PageClass>;

    /**
     * DOM-контейнер, в который монтируются страницы.
     * @private
     */
    private  container!: Element;

    /**
     * Базовый префикс для приложения, напр. `"/app"` (по умолчанию `"/"`).
     * Используется в нормализации путей и при формировании URL в истории.
     * @private
     */
    private  basePath!: string;

    /**
     * Заголовок по умолчанию, если страница не предоставила свой.
     * @private
     */
    private  defaultTitle!: string;

    /**
     * Контейнер для реактивных эффектов текущей страницы (заголовок и пр.).
     * Позволяет единообразно снимать эффекты перед монтированием нового Page.
     */
    private readonly titleScope = new DisposableScope();

    /**
     * Контейнер для глобальных подписок на события (popstate, click и т.д.).
     * Держит их в одном месте и упрощает возможную перерегистрацию.
     */
    private readonly eventScope = new DisposableScope();

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
    public init(container: Element, opts: RouterOptions = {}): Router {
        this.container = container;
        this.basePath = normalizeBase(opts.basePath ?? "/");
        this.defaultTitle = opts.defaultTitle ?? "App";

        void this.eventScope.flush();

        // Переходы «назад/вперёд» в браузере
        this.eventScope.listen(window, "popstate", () => {
            void this.navigate(this.currentLocation(), { replace: true });
        });

        this.navigate(this.currentLocation(), { replace: true })
            .then(() => this.interceptLinks())

        return this;
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
     *  - функцией, возвращающей сам класс (`Promise<PageClass> | PageClass`).
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
        provider: PageResolver,
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
    public setNotFound(provider: PageResolver): void {
        this.notFoundPage = this.wrapProvider(provider);
    }

    /**
     * Назначает страницу ошибок (error page).
     *
     * @param provider Провайдер error-страницы (синхронный класс или динамический import).
     */
    public setErrorPage(provider: PageResolver): void {
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

        const url = this.buildUrl(to, query);

        const fullPath = url.pathname + (url.search || "") + (url.hash || "");
        const destPath = this.normalize(fullPath);

        // Находим роут
        const match = this.match(destPath);
        if (!match) return this.show404();

        const search = url.search || "";
        const hash = url.hash || "";
        const toTarget: CurrentRoute = {
            path: destPath,
            params: match.params,
            meta: match.opts,
            query: new URLSearchParams(search),
            queryObj: Object.fromEntries(new URLSearchParams(search)),
            pattern: match.pattern,
            hash,
            fullPath: destPath + search + hash,
            href: this.withBase(destPath) + search + hash,
            basePath: this.basePath,
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
        if (replace) history.replaceState({}, "", toTarget.href);
        else history.pushState({}, "", toTarget.href);

        // Защита от гонок навигации
        const myToken = ++this.navToken;

        try {
            const PageClass = await match.loadPage();
            // Если за это время произошла другая навигация — прекращаем
            if (myToken !== this.navToken) return;

            const page = new PageClass();
            page.route = toTarget;
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
     * Возвращает текущий путь браузера вместе с query/hash без учёта basePath.
     * Используется для первичной и обратной навигации (popstate).
     */
    private currentLocation(): string {
        return window.location.pathname + window.location.search + window.location.hash;
    }

    /**
     * Строит URL назначения с учётом дополнительного `query`.
     *
     * @param to Цель навигации (абсолютная или относительная).
     * @param query Патч для параметров строки запроса.
     */
    private buildUrl(
        to: string,
        query?: Record<string, string | number | boolean | null | undefined>,
    ): URL {
        const url = new URL(to, window.location.origin);
        if (!query) return url;

        const searchParams = new URLSearchParams(url.search);
        for (const [key, value] of Object.entries(query)) {
            if (value === null || value === undefined) searchParams.delete(key);
            else searchParams.set(key, String(value));
        }
        url.search = searchParams.toString();
        return url;
    }

    /**
     * Формирует {@link NavigationTarget} для текущего URL.
     * Используется как значение “from” в middleware.
     *
     * @returns Текущая цель навигации (path/params/meta/query).
     * @internal
     */
    private async resolveCurrentTarget(): Promise<CurrentRoute> {
        const pathWithExtras = window.location.pathname + window.location.search + window.location.hash;
        const path = this.normalize(pathWithExtras);
        const qs = window.location.search;
        const hash = window.location.hash;
        const m = this.match(path);

        const query = new URLSearchParams(qs);

        return {
            path,
            params: m?.params ?? {},
            meta: m?.opts ?? {},
            query,
            queryObj: Object.fromEntries(query),
            pattern: m?.pattern ?? path,
            hash,
            fullPath: path + qs + hash,
            href: window.location.pathname + window.location.search + window.location.hash,
            basePath: this.basePath,
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
     * Размонтирует предыдущую страницу, монтирует новую
     * и подписывает `document.title` на `page.title`.
     */
    private async mountPage(page: Page): Promise<void> {
        await this.titleScope.flush();
        await this.currentPage?.destroy();

        await page.mountTo(this.container);
        this.currentPage = page;

        this.titleScope.effect(() => {
            document.title = page.title || this.defaultTitle;
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
     * @returns Фабрика `() => Promise<PageClass>`.
     * @internal
     */
    private wrapProvider(p: PageResolver): () => Promise<PageClass> {
        // Синхронный класс (имеет prototype.mountTo)
        if (typeof p === "function" && (p as any).prototype?.mountTo) {
            return () => Promise.resolve(p as PageClass);
        }
        // Динамический import
        return async () => {
            const mod = await (p as () => Promise<any>)();
            return ("default" in mod ? mod.default : mod) as PageClass;
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
        this.eventScope.listen(document, "click", (e) => {
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

export default new Router();

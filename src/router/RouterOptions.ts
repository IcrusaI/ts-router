export default interface RouterOptions {
    /** Корневая папка приложения (если не в "/") */
    basePath?: string;
    /** Заголовок по умолчанию, если страница ничего не вернула */
    defaultTitle?: string;
}
import NavigationTarget from "@/router/NavigationTarget";

/**
 * Middleware-перехватчик навигации, вызывается перед каждым переходом.
 * Должен вернуть `true`, чтобы разрешить переход, либо `false/Promise<false>`,
 * чтобы прервать его или перенаправить вручную.
 */
export type NavigationGuard = (
    to: NavigationTarget,
    from: NavigationTarget,
) => boolean | Promise<boolean>;

import { Router } from "@icrusai/ts-router";
import NotFoundPage from "./pages/NotFoundPage";

// Гвард авторизации
const requireAuth = async (to: any) => {
    const authed = Boolean(localStorage.getItem("token"));
    if (!authed) {
        const usp = new URLSearchParams({ redirect: to.path });
        history.pushState({}, "", "/login?" + usp.toString());
        dispatchEvent(new PopStateEvent("popstate"));
        return false;
    }
    return true;
};

const app = document.getElementById("app")!;

const router = new Router(app, { basePath: "/", defaultTitle: "Examples" });

// Routes
router.register("/", () => import("./pages/HomePage"));
router.register("/users/:id", () => import("./pages/UserPage"));
router.register("/dashboard", () => import("./pages/DashboardPage"), { middlewares: [requireAuth] });
router.register("/login", () => import("./pages/LoginPage"));

// Redirect demo
router.register("/redirect", () => import("./pages/HomePage"), { redirectTo: "/dashboard" });

// 404/ERROR
router.setNotFound(NotFoundPage);
router.setErrorPage(() => import("./pages/ErrorPage"));

// go!
router.init();
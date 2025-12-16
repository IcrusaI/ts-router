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

// Routes
Router.register("/", () => import("./pages/HomePage"));
Router.register("/users/:id", () => import("./pages/UserPage"));
Router.register("/dashboard", () => import("./pages/DashboardPage"), { middlewares: [requireAuth] });
Router.register("/login", () => import("./pages/LoginPage"));

// Redirect demo
Router.register("/redirect", () => import("./pages/HomePage"), { redirectTo: "/dashboard" });

// 404/ERROR
Router.setNotFound(NotFoundPage);
Router.setErrorPage(() => import("./pages/ErrorPage"));

Router.init(app, { basePath: "/", defaultTitle: "Examples" });
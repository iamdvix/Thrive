// Router principal de Thrive; organiza rutas públicas, privadas y permisos por rol.
import {
    createRouter,
    createWebHashHistory
} from "vue-router";
import { supabase } from "../lib/supabaseClient.js";

import Home from "../views/Home.vue";
import Auth from "../views/Auth.vue";
import Catalogo from "../views/Catalogo.vue";
import DashboardEmprendedor from "../views/DashboardEmprendedor.vue";
import DashboardInstitucion from "../views/DashboardInstitucion.vue";
import Inventario from "../views/Inventario.vue";
import Calculadora from "../views/Calculadora.vue";
import PerfilEmprendedor from "../views/PerfilEmprendedor.vue";
import DetalleProducto from "../views/DetalleProducto.vue";

const routes = [
    {
        path: "/",
        name: "Home",
        component: Home,
        meta: {
            title: "Thrive"
        }
    },
    {
        path: "/auth",
        name: "Auth",
        component: Auth,
        meta: {
            title: "Acceso | Thrive"
        }
    },
    {
        path: "/catalogo",
        name: "Catalogo",
        component: Catalogo,
        meta: {
            requiresAuth: true,
            roles: ["cliente"],
            title: "Catálogo | Thrive"
        }
    },
    {
        path: "/dashboard-emprendedor",
        name: "DashboardEmprendedor",
        component: DashboardEmprendedor,
        meta: {
            requiresAuth: true,
            roles: ["emprendedor"],
            title: "Panel emprendedor | Thrive"
        }
    },
    {
        path: "/dashboard-emprendedor/inventario",
        alias: "/inventario",
        name: "Inventario",
        component: Inventario,
        meta: {
            requiresAuth: true,
            roles: ["emprendedor"],
            title: "Inventario | Thrive"
        }
    },
    {
        path: "/dashboard-emprendedor/calculadora",
        alias: "/calculadora",
        name: "Calculadora",
        component: Calculadora,
        meta: {
            requiresAuth: true,
            roles: ["emprendedor"],
            title: "Calculadora | Thrive"
        }
    },
    {
        path: "/dashboard-institucion",
        name: "DashboardInstitucion",
        component: DashboardInstitucion,
        meta: {
            requiresAuth: true,
            roles: ["institucion"],
            title: "Panel institucional | Thrive"
        }
    },
    {
        path: "/emprendedor/:id",
        name: "PerfilEmprendedor",
        component: PerfilEmprendedor,
        props: true,
        meta: {
            requiresAuth: true,
            roles: [
                "cliente",
                "emprendedor",
                "institucion"
            ],
            title: "Emprendimiento | Thrive"
        }
    },
    {
        path: "/producto/:id",
        name: "DetalleProducto",
        component: DetalleProducto,
        props: true,
        meta: {
            requiresAuth: true,
            roles: [
                "cliente",
                "emprendedor",
                "institucion"
            ],
            title: "Producto | Thrive"
        }
    },
    {
        path: "/:pathMatch(.*)*",
        name: "NotFound",
        redirect: "/"
    }
];

const router = createRouter({
    // Hash History evita errores al recargar rutas dentro de GitHub Pages.
    history: createWebHashHistory(
        import.meta.env.BASE_URL
    ),
    routes,
    scrollBehavior() {
        return {
            top: 0,
            left: 0
        };
    }
});

const homeByRole = {
    cliente: "Catalogo",
    emprendedor: "DashboardEmprendedor",
    institucion: "DashboardInstitucion"
};

async function getSessionAndRole() {
    const {
        data: { session },
        error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
        return {
            session: null,
            role: null
        };
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", session.user.id)
        .maybeSingle();

    if (profileError) {
        console.warn(
            "No se pudo comprobar el tipo de cuenta:",
            profileError
        );
    }

    return {
        session,
        role: profile?.user_type || null
    };
}

router.beforeEach(async function (to) {
    const requiresAuth = to.matched.some(
        function (record) {
            return record.meta.requiresAuth;
        }
    );

    const needsSessionCheck =
        requiresAuth || to.name === "Auth";

    if (!needsSessionCheck) {
        return true;
    }

    const { session, role } =
        await getSessionAndRole();

    if (!session && requiresAuth) {
        return {
            name: "Auth",
            query: {
                redirect: to.fullPath
            }
        };
    }

    if (session && to.name === "Auth") {
        return {
            name: homeByRole[role] || "Home"
        };
    }

    const allowedRoles = to.meta.roles || [];

    if (
        requiresAuth &&
        allowedRoles.length &&
        !allowedRoles.includes(role)
    ) {
        return {
            name: homeByRole[role] || "Home"
        };
    }

    return true;
});

router.afterEach(function (to) {
    document.title = to.meta.title || "Thrive";
});

export default router;

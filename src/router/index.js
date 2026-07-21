// Router principal de Thrive.
import {
    createRouter,
    createWebHashHistory
} from "vue-router";
import { supabase } from "../lib/supabaseClient";

// Vistas principales.
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
    // Página principal.
    {
        path: "/",
        name: "Home",
        component: Home,
        meta: {
            title: "Thrive"
        }
    },

    /*
        Esta ruta siempre queda disponible.
        Aunque exista una sesión iniciada, el botón
        "Comenzar" de Home abrirá Auth.vue.
    */
    {
        path: "/auth",
        name: "Auth",
        component: Auth,
        meta: {
            title: "Acceso | Thrive"
        }
    },

    // Catálogo para clientes.
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

    // Panel principal del emprendedor.
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

    // Inventario del emprendedor.
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

    // Calculadora del emprendedor.
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

    // Panel principal de instituciones.
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

    // Perfil público de un emprendimiento.
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

    // Detalle público interno de un producto.
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

    // Cualquier ruta inexistente vuelve al inicio.
    {
        path: "/:pathMatch(.*)*",
        name: "NotFound",
        redirect: "/"
    }
];

const router = createRouter({
    /*
        Hash History evita errores al recargar
        rutas internas en GitHub Pages.
    */
    history: createWebHashHistory(
        import.meta.env.BASE_URL
    ),

    routes,

    // Cada página nueva comienza desde arriba.
    scrollBehavior() {
        return {
            top: 0,
            left: 0
        };
    }
});

// Página principal de cada tipo de cuenta.
const homeByRole = {
    cliente: "Catalogo",
    emprendedor: "DashboardEmprendedor",
    institucion: "DashboardInstitucion"
};

// Consulta la sesión y el tipo de usuario conectado.
async function getSessionAndRole() {
    const {
        data: { session },
        error: sessionError
    } = await supabase.auth.getSession();

    if (
        sessionError ||
        !session?.user
    ) {
        return {
            session: null,
            role: null
        };
    }

    const {
        data: profile,
        error: profileError
    } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", session.user.id)
        .maybeSingle();

    if (profileError) {
        console.warn(
            "No se pudo comprobar el tipo de usuario:",
            profileError
        );
    }

    return {
        session,
        role:
            profile?.user_type ||
            null
    };
}

// Protege únicamente las rutas privadas.
router.beforeEach(async function (to) {
    const requiresAuth =
        to.matched.some(
            function (route) {
                return (
                    route.meta.requiresAuth
                );
            }
        );

    /*
        Home y Auth son públicas.
        No se redirigen aunque haya una sesión activa.
    */
    if (!requiresAuth) {
        return true;
    }

    const {
        session,
        role
    } = await getSessionAndRole();

    // Sin sesión, enviamos al inicio de sesión.
    if (!session) {
        return {
            name: "Auth",
            query: {
                redirect:
                    to.fullPath
            }
        };
    }

    const allowedRoles =
        to.meta.roles || [];

    /*
        Si el usuario intenta entrar a una sección
        de otro tipo de cuenta, vuelve a su panel.
    */
    if (
        allowedRoles.length &&
        !allowedRoles.includes(role)
    ) {
        return {
            name:
                homeByRole[role] ||
                "Home"
        };
    }

    return true;
});

// Cambia el título de la pestaña del navegador.
router.afterEach(function (to) {
    document.title =
        to.meta.title ||
        "Thrive";
});

export default router;
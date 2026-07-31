// Rutas principales de Thrive. Las pantallas están separadas por función, excepto crear y editar productos, que viven dentro del dashboard.
import { createRouter, createWebHashHistory } from "vue-router";
import { supabase } from "../lib/supabaseClient";

import Landing from "../views/Landing.vue";
import Access from "../views/Access.vue";
import Catalog from "../views/Catalog.vue";
import Business from "../views/Business.vue";
import Product from "../views/Product.vue";
import BizHome from "../views/business/Home.vue";
import BizProfile from "../views/business/Profile.vue";
import BizStock from "../views/business/Stock.vue";
import BizProfit from "../views/business/Profit.vue";
import BizNews from "../views/business/News.vue";
import OrgHome from "../views/org/Home.vue";
import OrgPosts from "../views/org/Posts.vue";
import OrgBusinesses from "../views/org/Businesses.vue";
import OrgProfile from "../views/org/Profile.vue";

const customerOnly = {
    requiresAuth: true,
    roles: ["cliente"]
};

const businessOnly = {
    requiresAuth: true,
    roles: ["emprendedor"]
};

const subscribedBusinessOnly = {
    requiresAuth: true,
    requiresSubscription: true,
    roles: ["emprendedor"]
};

const orgOnly = {
    requiresAuth: true,
    roles: ["institucion"]
};

const signedUsers = {
    requiresAuth: true,
    roles: [
        "cliente",
        "emprendedor",
        "institucion"
    ]
};

const routes = [
    // Páginas públicas.
    {
        path: "/",
        name: "Landing",
        component: Landing,
        meta: {
            title: "Thrive"
        }
    },
    {
        path: "/access",
        alias: "/auth",
        name: "Access",
        component: Access,
        meta: {
            title: "Acceso | Thrive"
        }
    },

    // Cliente.
    {
        path: "/catalog",
        alias: "/catalogo",
        name: "Catalog",
        component: Catalog,
        meta: {
            ...customerOnly,
            title: "Catálogo | Thrive"
        }
    },

    // Emprendedor.
    {
        path: "/biz",
        alias: "/dashboard-emprendedor",
        name: "BizHome",
        component: BizHome,
        meta: {
            ...businessOnly,
            title: "Panel | Thrive"
        }
    },

    // Productos forma parte del dashboard; esta URL antigua vuelve a Inicio.
    {
        path: "/biz/products",
        redirect: {
            name: "BizHome"
        }
    },

    // Estas URLs antiguas vuelven al dashboard y abren el editor allí mismo.
    {
        path: "/biz/products/new",
        redirect: {
            name: "BizHome",
            query: {
                product: "new"
            }
        }
    },
    {
        path: "/biz/products/:id/edit",
        redirect: function (to) {
            return {
                name: "BizHome",
                query: {
                    editProduct:
                        String(to.params.id)
                }
            };
        }
    },

    {
        path: "/biz/profile",
        name: "BizProfile",
        component: BizProfile,
        meta: {
            ...businessOnly,
            title: "Perfil | Thrive"
        }
    },
    {
        path: "/biz/stock",
        alias: [
            "/inventario",
            "/dashboard-emprendedor/inventario"
        ],
        name: "BizStock",
        component: BizStock,
        meta: {
            ...subscribedBusinessOnly,
            title: "Inventario | Thrive"
        }
    },

    // Pedidos es una pestaña interna de Inventario.
    {
        path: "/biz/orders",
        redirect: {
            name: "BizStock",
            query: {
                tab: "orders"
            }
        }
    },
    {
        path: "/biz/profit",
        alias: [
            "/calculadora",
            "/dashboard-emprendedor/calculadora"
        ],
        name: "BizProfit",
        component: BizProfit,
        meta: {
            ...subscribedBusinessOnly,
            title: "Calculadora | Thrive"
        }
    },
    {
        path: "/biz/news",
        name: "BizNews",
        component: BizNews,
        meta: {
            ...businessOnly,
            title: "Novedades | Thrive"
        }
    },

    // Institución.
    {
        path: "/org",
        alias: "/dashboard-institucion",
        name: "OrgHome",
        component: OrgHome,
        meta: {
            ...orgOnly,
            title: "Institución | Thrive"
        }
    },
    {
        path: "/org/posts",
        name: "OrgPosts",
        component: OrgPosts,
        meta: {
            ...orgOnly,
            title: "Publicaciones | Thrive"
        }
    },
    {
        path: "/org/businesses",
        name: "OrgBusinesses",
        component: OrgBusinesses,
        meta: {
            ...orgOnly,
            title: "Emprendimientos | Thrive"
        }
    },
    {
        path: "/org/profile",
        name: "OrgProfile",
        component: OrgProfile,
        meta: {
            ...orgOnly,
            title: "Perfil institucional | Thrive"
        }
    },

    // Pantallas compartidas entre tipos de cuenta.
    {
        path: "/business/:id",
        alias: "/emprendedor/:id",
        name: "Business",
        component: Business,
        props: true,
        meta: {
            ...signedUsers,
            title: "Emprendimiento | Thrive"
        }
    },
    {
        path: "/product/:id",
        alias: "/producto/:id",
        name: "Product",
        component: Product,
        props: true,
        meta: {
            ...signedUsers,
            title: "Producto | Thrive"
        }
    },

    // Una URL inexistente siempre vuelve a la portada.
    {
        path: "/:pathMatch(.*)*",
        name: "NotFound",
        redirect: "/"
    }
];

const router = createRouter({
    // Hash History evita errores al recargar rutas internas en GitHub Pages.
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

// Pantalla inicial correspondiente a cada tipo de cuenta.
const homeByRole = {
    cliente: "Catalog",
    emprendedor: "BizHome",
    institucion: "OrgHome"
};

// Comprueba si una suscripción activa todavía es válida.
function subscriptionIsActive(data) {
    if (
        data?.subscription_status !==
        "active"
    ) {
        return false;
    }

    if (!data.subscription_expires_at) {
        return true;
    }

    return (
        new Date(
            data.subscription_expires_at
        ).getTime() >
        Date.now()
    );
}

// Lee la sesión, el rol y, cuando corresponde, el estado de la suscripción.
async function getSessionContext() {
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
            role: null,
            subscriptionActive: false
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

    const role =
        profile?.user_type ||
        null;

    if (role !== "emprendedor") {
        return {
            session,
            role,
            subscriptionActive: false
        };
    }

    const {
        data: entrepreneur,
        error: subscriptionError
    } = await supabase
        .from("entrepreneurs")
        .select(`
            subscription_status,
            subscription_expires_at
        `)
        .eq("id", session.user.id)
        .maybeSingle();

    if (subscriptionError) {
        console.warn(
            "No se pudo comprobar la suscripción:",
            subscriptionError
        );
    }

    return {
        session,
        role,
        subscriptionActive:
            subscriptionIsActive(
                entrepreneur
            )
    };
}

router.beforeEach(async function (to) {
    const requiresAuth =
        to.matched.some(
            function (route) {
                return (
                    route.meta.requiresAuth
                );
            }
        );

    if (!requiresAuth) {
        return true;
    }

    const {
        session,
        role,
        subscriptionActive
    } = await getSessionContext();

    if (!session) {
        return {
            name: "Access",
            query: {
                redirect:
                    to.fullPath
            }
        };
    }

    const allowedRoles =
        to.meta.roles || [];

    if (
        allowedRoles.length &&
        !allowedRoles.includes(role)
    ) {
        return {
            name:
                homeByRole[role] ||
                "Landing"
        };
    }

    /*
        Inventario y Calculadora requieren plan activo.
        El dashboard, perfil y novedades permanecen disponibles.
    */
    if (
        to.meta.requiresSubscription &&
        role === "emprendedor" &&
        !subscriptionActive
    ) {
        return {
            name: "BizHome",
            query: {
                subscription:
                    "required"
            }
        };
    }

    return true;
});

// Mantiene el título del navegador sincronizado con la pantalla actual.
router.afterEach(function (to) {
    document.title =
        to.meta.title ||
        "Thrive";
});

export default router;

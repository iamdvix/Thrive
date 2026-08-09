// Rutas principales de Thrive.
// Las pantallas están separadas por función, excepto crear y editar productos,
// que siguen viviendo dentro del dashboard del emprendedor.

import { createRouter, createWebHashHistory } from "vue-router";
import { supabase } from "../lib/supabaseClient";

import Landing from "../views/Landing.vue";
import Access from "../views/Access.vue";

// Cliente.
import Catalog from "../views/Catalog.vue";
import CustomerProfile from "../views/customer/Profile.vue";
import Entrepreneurs from "../views/Entrepreneurs.vue";
import BusinessMap from "../views/BusinessMap.vue";

// Pantallas públicas/compartidas dentro de usuarios autenticados.
import Business from "../views/Business.vue";
import Product from "../views/Product.vue";
import Institution from "../views/Institution.vue";

// Emprendedor.
import BizHome from "../views/business/Home.vue";
import BizProfile from "../views/business/Profile.vue";
import BizStock from "../views/business/Stock.vue";
import BizProfit from "../views/business/Profit.vue";
import BizNews from "../views/business/News.vue";
import BizInstitutions from "../views/business/Institutions.vue";

// Institución.
import OrgHome from "../views/org/Home.vue";
import OrgPosts from "../views/org/Posts.vue";
import OrgBusinesses from "../views/org/Businesses.vue";
import OrgProfile from "../views/org/Profile.vue";

// Permisos reutilizables para mantener las rutas ordenadas.
const customerOnly = {
    requiresAuth: true,
    roles: ["cliente"]
};

const businessOnly = {
    requiresAuth: true,
    roles: ["emprendedor"]
};

const orgOnly = {
    requiresAuth: true,
    roles: ["institucion"]
};

const signedUsers = {
    requiresAuth: true,
    roles: ["cliente", "emprendedor", "institucion"]
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

    // =====================================================
    // CLIENTE
    // =====================================================

    // Pantalla principal de descubrimiento y catálogo.
    {
        path: "/catalog",
        alias: "/catalogo",
        name: "Catalog",
        component: Catalog,
        meta: {
            ...customerOnly,
            title: "Descubrir | Thrive"
        }
    },

    // Perfil del cliente.
    {
        path: "/catalog/profile",
        alias: "/perfil-cliente",
        name: "CustomerProfile",
        component: CustomerProfile,
        meta: {
            ...customerOnly,
            title: "Mi perfil | Thrive"
        }
    },

    // Nuevo directorio independiente de emprendedores.
    {
        path: "/entrepreneurs",
        alias: "/emprendedores",
        name: "Entrepreneurs",
        component: Entrepreneurs,
        meta: {
            ...customerOnly,
            title: "Emprendedores | Thrive"
        }
    },

    // Nuevo mapa con las ubicaciones de los emprendimientos.
    {
        path: "/map",
        alias: "/mapa",
        name: "BusinessMap",
        component: BusinessMap,
        meta: {
            ...customerOnly,
            title: "Mapa | Thrive"
        }
    },

    // =====================================================
    // EMPRENDEDOR
    // =====================================================

    // Dashboard principal.
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

    // Productos ya no tiene una pantalla independiente.
    {
        path: "/biz/products",
        redirect: {
            name: "BizHome"
        }
    },

    // Crear producto abre directamente el editor del dashboard.
    {
        path: "/biz/products/new",
        redirect: {
            name: "BizHome",
            query: {
                product: "new"
            }
        }
    },

    // Editar producto también utiliza el dashboard.
    {
        path: "/biz/products/:id/edit",
        redirect(to) {
            return {
                name: "BizHome",
                query: {
                    editProduct: String(to.params.id)
                }
            };
        }
    },

    // Perfil y configuración del emprendimiento.
    {
        path: "/biz/profile",
        name: "BizProfile",
        component: BizProfile,
        meta: {
            ...businessOnly,
            title: "Perfil | Thrive"
        }
    },

    // Inventario y pedidos.
    {
        path: "/biz/stock",
        alias: [
            "/inventario",
            "/dashboard-emprendedor/inventario"
        ],
        name: "BizStock",
        component: BizStock,
        meta: {
            ...businessOnly,
            title: "Inventario | Thrive"
        }
    },

    // Pedidos sigue siendo una pestaña interna de Inventario.
    {
        path: "/biz/orders",
        redirect: {
            name: "BizStock",
            query: {
                tab: "orders"
            }
        }
    },

    // Calculadora.
    {
        path: "/biz/profit",
        alias: [
            "/calculadora",
            "/dashboard-emprendedor/calculadora"
        ],
        name: "BizProfit",
        component: BizProfit,
        meta: {
            ...businessOnly,
            title: "Calculadora | Thrive"
        }
    },

    // Novedades.
    {
        path: "/biz/news",
        name: "BizNews",
        component: BizNews,
        meta: {
            ...businessOnly,
            title: "Novedades | Thrive"
        }
    },

    // Nuevo directorio de instituciones para emprendedores.
    {
        path: "/biz/institutions",
        alias: "/dashboard-emprendedor/instituciones",
        name: "BizInstitutions",
        component: BizInstitutions,
        meta: {
            ...businessOnly,
            title: "Instituciones | Thrive"
        }
    },

    // =====================================================
    // INSTITUCIÓN
    // =====================================================

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

    // =====================================================
    // PANTALLAS COMPARTIDAS
    // =====================================================

    // Perfil público del emprendimiento.
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

    // Detalle del producto.
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

    // Perfil público de una institución.
    // Puede abrirlo cliente, emprendedor o institución.
    {
        path: "/institution/:id",
        alias: "/institucion/:id",
        name: "InstitutionPublic",
        component: Institution,
        props: true,
        meta: {
            ...signedUsers,
            title: "Institución | Thrive"
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
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes,

    // Cada cambio de pantalla comienza desde arriba.
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

// Lee la sesión y el rol antes de permitir la entrada a una ruta privada.
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
        role: profile?.user_type || null
    };
}

// Protege las pantallas según el tipo de cuenta.
router.beforeEach(async function (to) {
    const requiresAuth = to.matched.some(function (route) {
        return route.meta.requiresAuth;
    });

    if (!requiresAuth) {
        return true;
    }

    const {
        session,
        role
    } = await getSessionAndRole();

    // Sin sesión, vuelve al acceso y recuerda la pantalla solicitada.
    if (!session) {
        return {
            name: "Access",
            query: {
                redirect: to.fullPath
            }
        };
    }

    const allowedRoles = to.meta.roles || [];

    // Si tiene sesión pero no el rol correcto, vuelve a su propio inicio.
    if (
        allowedRoles.length &&
        !allowedRoles.includes(role)
    ) {
        return {
            name: homeByRole[role] || "Landing"
        };
    }

    return true;
});

// Mantiene el título del navegador sincronizado con la pantalla actual.
router.afterEach(function (to) {
    document.title = to.meta.title || "Thrive";
});

export default router;
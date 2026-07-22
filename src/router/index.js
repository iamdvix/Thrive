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
const customerOnly = { requiresAuth: true, roles: ["cliente"] };
const businessOnly = { requiresAuth: true, roles: ["emprendedor"] };
const orgOnly = { requiresAuth: true, roles: ["institucion"] };
const signedUsers = { requiresAuth: true, roles: ["cliente", "emprendedor", "institucion"] };
const routes = [
    // Páginas públicas.
    { path: "/", name: "Landing", component: Landing, meta: { title: "Thrive" } },
    { path: "/access", alias: "/auth", name: "Access", component: Access, meta: { title: "Acceso | Thrive" } },
    // Cliente.
    { path: "/catalog", alias: "/catalogo", name: "Catalog", component: Catalog, meta: { ...customerOnly, title: "Catálogo | Thrive" } },
    // Emprendedor. Las rutas antiguas se conservan como alias para no romper enlaces guardados.
    { path: "/biz", alias: "/dashboard-emprendedor", name: "BizHome", component: BizHome, meta: { ...businessOnly, title: "Panel | Thrive" } },
    // Productos forma parte del dashboard; esta URL antigua vuelve a Inicio.
    { path: "/biz/products", redirect: { name: "BizHome" } },
    // Estas URLs antiguas vuelven al dashboard y abren el editor allí mismo.
    { path: "/biz/products/new", redirect: { name: "BizHome", query: { product: "new" } } },
    { path: "/biz/products/:id/edit", redirect: function (to) {
        return { name: "BizHome", query: { editProduct: String(to.params.id) } };
    } },
    { path: "/biz/profile", name: "BizProfile", component: BizProfile, meta: { ...businessOnly, title: "Perfil | Thrive" } },
    { path: "/biz/stock", alias: ["/inventario", "/dashboard-emprendedor/inventario"], name: "BizStock", component: BizStock, meta: { ...businessOnly, title: "Inventario | Thrive" } },
    // Pedidos es una pestaña interna de Inventario, no una pantalla separada.
    { path: "/biz/orders", redirect: { name: "BizStock", query: { tab: "orders" } } },
    { path: "/biz/profit", alias: ["/calculadora", "/dashboard-emprendedor/calculadora"], name: "BizProfit", component: BizProfit, meta: { ...businessOnly, title: "Calculadora | Thrive" } },
    { path: "/biz/news", name: "BizNews", component: BizNews, meta: { ...businessOnly, title: "Novedades | Thrive" } },
    // Institución.
    { path: "/org", alias: "/dashboard-institucion", name: "OrgHome", component: OrgHome, meta: { ...orgOnly, title: "Institución | Thrive" } },
    { path: "/org/posts", name: "OrgPosts", component: OrgPosts, meta: { ...orgOnly, title: "Publicaciones | Thrive" } },
    { path: "/org/businesses", name: "OrgBusinesses", component: OrgBusinesses, meta: { ...orgOnly, title: "Emprendimientos | Thrive" } },
    { path: "/org/profile", name: "OrgProfile", component: OrgProfile, meta: { ...orgOnly, title: "Perfil institucional | Thrive" } },
    // Pantallas compartidas entre tipos de cuenta.
    { path: "/business/:id", alias: "/emprendedor/:id", name: "Business", component: Business, props: true, meta: { ...signedUsers, title: "Emprendimiento | Thrive" } },
    { path: "/product/:id", alias: "/producto/:id", name: "Product", component: Product, props: true, meta: { ...signedUsers, title: "Producto | Thrive" } },
    // Una URL inexistente siempre vuelve a la portada.
    { path: "/:pathMatch(.*)*", name: "NotFound", redirect: "/" }
];
const router = createRouter({
    // Hash History evita errores al recargar rutas internas en GitHub Pages.
    history: createWebHashHistory(import.meta.env.BASE_URL),
    routes,
    scrollBehavior() {
        return { top: 0, left: 0 };
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
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) return { session: null, role: null };
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", session.user.id)
        .maybeSingle();
    if (profileError) console.warn("No se pudo comprobar el tipo de usuario:", profileError);
    return { session, role: profile?.user_type || null };
}
router.beforeEach(async function (to) {
    const requiresAuth = to.matched.some(function (route) {
        return route.meta.requiresAuth;
    });
    if (!requiresAuth) return true;
    const { session, role } = await getSessionAndRole();
    if (!session) {
        return { name: "Access", query: { redirect: to.fullPath } };
    }
    const allowedRoles = to.meta.roles || [];
    if (allowedRoles.length && !allowedRoles.includes(role)) {
        return { name: homeByRole[role] || "Landing" };
    }
    return true;
});
// Mantiene el título del navegador sincronizado con la pantalla actual.
router.afterEach(function (to) {
    document.title = to.meta.title || "Thrive";
});
export default router;

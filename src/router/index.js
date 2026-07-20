// Router principal de Thrive.
import {
    createRouter,
    createWebHashHistory
} from "vue-router";

// Vistas principales.
import Home from "../views/Home.vue";
import Auth from "../views/Auth.vue";
import Catalogo from "../views/Catalogo.vue";
import DashboardEmprendedor from "../views/DashboardEmprendedor.vue";
import PerfilEmprendedor from "../views/PerfilEmprendedor.vue";
import DetalleProducto from "../views/DetalleProducto.vue";

const routes = [
    // Página principal.
    {
        path: "/",
        name: "Home",
        component: Home
    },

    // Inicio de sesión y registro.
    {
        path: "/auth",
        name: "Auth",
        component: Auth
    },

    // Catálogo principal para clientes.
    {
        path: "/catalogo",
        name: "Catalogo",
        component: Catalogo
    },

    // Panel privado del emprendedor.
    {
        path: "/dashboard-emprendedor",
        name: "DashboardEmprendedor",
        component: DashboardEmprendedor
    },

    // Perfil público de un emprendimiento.
    {
        path: "/emprendedor/:id",
        name: "PerfilEmprendedor",
        component: PerfilEmprendedor,
        props: true
    },

    // Vista independiente con el detalle del producto y reseñas.
    {
        path: "/producto/:id",
        name: "DetalleProducto",
        component: DetalleProducto,
        props: true
    },

    // Si alguien entra a una dirección que no existe,
    // lo enviamos nuevamente a la página principal.
    {
        path: "/:pathMatch(.*)*",
        redirect: "/"
    }
];

const router = createRouter({
    /*
        Usamos Hash History para evitar problemas
        al recargar rutas internas en GitHub Pages.
    */
    history: createWebHashHistory(),

    routes,

    // Al cambiar de pantalla comenzamos desde arriba.
    scrollBehavior() {
        return {
            top: 0,
            left: 0
        };
    }
});

export default router;
import { createRouter, createWebHistory } from "vue-router";

import Home from "../views/Home.vue";
import Auth from "../views/Auth.vue";
import Catalogo from "../views/Catalogo.vue";
import DashboardEmprendedor from "../views/DashboardEmprendedor.vue";
import PerfilEmprendedor from "../views/PerfilEmprendedor.vue";
import DetalleProducto from "../views/DetalleProducto.vue";
import Calculadora from "../views/Calculadora.vue";
import Inventario from "../views/Inventario.vue";

const routes = [
    {
        path: "/",
        name: "Home",
        component: Home
    },
    {
        path: "/auth",
        name: "Auth",
        component: Auth
    },
    {
        path: "/catalogo",
        name: "Catalogo",
        component: Catalogo
    },
    {
        path: "/dashboard-emprendedor",
        name: "DashboardEmprendedor",
        component: DashboardEmprendedor
    },
    {
        path: "/emprendedor/:id",
        name: "PerfilEmprendedor",
        component: PerfilEmprendedor
    },
    {
        path: "/producto/:id",
        name: "DetalleProducto",
        component: DetalleProducto
    },

    // Herramientas independientes del panel del emprendedor.
    {
        path: "/inventario",
        name: "Inventario",
        component: Inventario
    },
    {
        path: "/calculadora",
        name: "Calculadora",
        component: Calculadora
    },

    // Si se escribe una ruta inexistente, volvemos al inicio.
    {
        path: "/:pathMatch(.*)*",
        redirect: "/"
    }
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes
});

export default router;
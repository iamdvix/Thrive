// Herramientas utilizadas para manejar la navegación de la aplicación.
import { createRouter, createWebHistory } from "vue-router";

// Importamos las páginas disponibles.
import Home from "../views/Home.vue";
import Auth from "../views/Auth.vue";
import Catalogo from "../views/Catalogo.vue";
import PerfilEmprendedor from "../views/PerfilEmprendedor.vue";
import DashboardEmprendedor from "../views/DashboardEmprendedor.vue";

// Cada ruta conecta una dirección con su respectiva vista.
const router = createRouter({
    // Importante para que Vue Router funcione correctamente dentro de /Thrive/.
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
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
            // El ID permitirá abrir cualquier emprendimiento desde la base de datos.
            path: "/emprendedor/:id",
            name: "PerfilEmprendedor",
            component: PerfilEmprendedor
        },
        {
            path: "/dashboard-emprendedor",
            name: "DashboardEmprendedor",
            component: DashboardEmprendedor
        }
    ]
});

export default router;
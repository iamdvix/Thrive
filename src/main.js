// Importamos Vue, el componente principal, las rutas y los estilos globales.
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import "./style.css";

// Creamos la aplicación, activamos las rutas y finalmente la montamos en index.html.
createApp(App)
    .use(router)
    .mount("#app");
<script setup>
// Pantalla de acceso y registro; permite iniciar sesión a clientes, emprendedores e instituciones.
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";
import {
    uploadProfileImage,
    uploadEntrepreneurLogo
} from "../lib/storage";
const router = useRouter();
// Lista de departamentos y distritos utilizada en los formularios.
const districtsByDepartment = {
    "Ahuachapán": [
        "Ahuachapán", "Apaneca", "Atiquizaya", "Concepción de Ataco",
        "El Refugio", "Guaymango", "Jujutla", "San Francisco Menéndez",
        "San Lorenzo", "San Pedro Puxtla", "Tacuba", "Turín"
    ],
    "Cabañas": [
        "Cinquera", "Dolores", "Guacotecti", "Ilobasco", "Jutiapa",
        "San Isidro", "Sensuntepeque", "Tejutepeque", "Victoria"
    ],
    "Chalatenango": [
        "Agua Caliente", "Arcatao", "Azacualpa", "Chalatenango", "Citalá",
        "Comalapa", "Concepción Quezaltepeque", "Dulce Nombre de María",
        "El Carrizal", "El Paraíso", "La Laguna", "La Palma", "La Reina",
        "Las Flores", "Las Vueltas", "Nombre de Jesús", "Nueva Concepción",
        "Nueva Trinidad", "Ojos de Agua", "Potonico", "San Antonio de la Cruz",
        "San Antonio Los Ranchos", "San Fernando", "San Francisco Lempa",
        "San Francisco Morazán", "San Ignacio", "San Isidro Labrador",
        "San José Cancasque", "San Luis del Carmen", "San Miguel de Mercedes",
        "San Rafael", "Santa Rita", "Tejutla"
    ],
    "Cuscatlán": [
        "Candelaria", "Cojutepeque", "El Carmen", "El Rosario",
        "Monte San Juan", "Oratorio de Concepción", "San Bartolomé Perulapía",
        "San Cristóbal", "San José Guayabal", "San Pedro Perulapán",
        "San Rafael Cedros", "San Ramón", "Santa Cruz Analquito",
        "Santa Cruz Michapa", "Suchitoto", "Tenancingo"
    ],
    "La Libertad": [
        "Antiguo Cuscatlán", "Chiltiupán", "Ciudad Arce", "Colón",
        "Comasagua", "Huizúcar", "Jayaque", "Jicalapa", "La Libertad",
        "Nuevo Cuscatlán", "Quezaltepeque", "Sacacoyo", "San José Villanueva",
        "San Juan Opico", "San Matías", "San Pablo Tacachico", "Santa Tecla",
        "Talnique", "Tamanique", "Teotepeque", "Tepecoyo", "Zaragoza"
    ],
    "La Paz": [
        "Cuyultitán", "El Rosario", "Jerusalén", "Mercedes La Ceiba",
        "Olocuilta", "Paraíso de Osorio", "San Antonio Masahuat", "San Emigdio",
        "San Francisco Chinameca", "San Juan Nonualco", "San Juan Talpa",
        "San Juan Tepezontes", "San Luis La Herradura", "San Luis Talpa",
        "San Miguel Tepezontes", "San Pedro Masahuat", "San Pedro Nonualco",
        "San Rafael Obrajuelo", "Santa María Ostuma", "Santiago Nonualco",
        "Tapalhuaca", "Zacatecoluca"
    ],
    "La Unión": [
        "Anamorós", "Bolívar", "Concepción de Oriente", "Conchagua",
        "El Carmen", "El Sauce", "Intipucá", "La Unión", "Lislique",
        "Meanguera del Golfo", "Nueva Esparta", "Pasaquina", "Polorós",
        "San Alejo", "San José", "Santa Rosa de Lima", "Yayantique", "Yucuaiquín"
    ],
    "Morazán": [
        "Arambala", "Cacaopera", "Chilanga", "Corinto", "Delicias de Concepción",
        "El Divisadero", "El Rosario", "Gualococti", "Guatajiagua", "Joateca",
        "Jocoaitique", "Jocoro", "Lolotiquillo", "Meanguera", "Osicala",
        "Perquín", "San Carlos", "San Fernando", "San Francisco Gotera",
        "San Isidro", "San Simón", "Sensembra", "Sociedad", "Torola",
        "Yamabal", "Yoloaiquín"
    ],
    "San Miguel": [
        "Carolina", "Chapeltique", "Chinameca", "Chirilagua", "Ciudad Barrios",
        "Comacarán", "El Tránsito", "Lolotique", "Moncagua", "Nueva Guadalupe",
        "Nuevo Edén de San Juan", "Quelepa", "San Antonio", "San Gerardo",
        "San Jorge", "San Luis de la Reina", "San Miguel", "San Rafael Oriente",
        "Sesori", "Uluazapa"
    ],
    "San Salvador": [
        "Aguilares", "Apopa", "Ayutuxtepeque", "Ciudad Delgado",
        "Cuscatancingo", "El Paisnal", "Guazapa", "Ilopango", "Mejicanos",
        "Nejapa", "Panchimalco", "Rosario de Mora", "San Marcos",
        "San Martín", "San Salvador", "Santiago Texacuangos", "Santo Tomás",
        "Soyapango", "Tonacatepeque"
    ],
    "San Vicente": [
        "Apastepeque", "Guadalupe", "San Cayetano Istepeque",
        "San Esteban Catarina", "San Ildefonso", "San Lorenzo",
        "San Sebastián", "San Vicente", "Santa Clara", "Santo Domingo",
        "Tecoluca", "Tepetitán", "Verapaz"
    ],
    "Santa Ana": [
        "Candelaria de la Frontera", "Chalchuapa", "Coatepeque", "El Congo",
        "El Porvenir", "Masahuat", "Metapán", "San Antonio Pajonal",
        "San Sebastián Salitrillo", "Santa Ana", "Santa Rosa Guachipilín",
        "Santiago de la Frontera", "Texistepeque"
    ],
    "Sonsonate": [
        "Acajutla", "Armenia", "Caluco", "Cuisnahuat", "Izalco", "Juayúa",
        "Nahuizalco", "Nahulingo", "Salcoatitán", "San Antonio del Monte",
        "San Julián", "Santa Catarina Masahuat", "Santa Isabel Ishuatán",
        "Santo Domingo de Guzmán", "Sonsonate", "Sonzacate"
    ],
    "Usulután": [
        "Alegría", "Berlín", "California", "Concepción Batres", "El Triunfo",
        "Ereguayquín", "Estanzuelas", "Jiquilisco", "Jucuapa", "Jucuarán",
        "Mercedes Umaña", "Nueva Granada", "Ozatlán", "Puerto El Triunfo",
        "San Agustín", "San Buenaventura", "San Dionisio",
        "San Francisco Javier", "Santa Elena", "Santa María",
        "Santiago de María", "Tecapán", "Usulután"
    ]
};
const departments = Object.keys(districtsByDepartment);
// Estados que controlan la vista y el comportamiento general de esta pantalla.
const activeTab = ref("login");
const accountType = ref("client");
// Datos y controles del inicio de sesión.
const loginEmail = ref("");
const loginPassword = ref("");
const loginLoading = ref(false);
const showLoginPassword = ref(false);
// Datos y pasos utilizados para registrar una cuenta de cliente.
const clientStep = ref(1);
const clientName = ref("");
const clientEmail = ref("");
const clientPhone = ref("");
const clientPassword = ref("");
const clientLoading = ref(false);
const showClientPassword = ref(false);
// Archivo real que se enviará a Supabase Storage.
const clientPhotoFile = ref(null);
// Vista previa mostrada antes del registro.
const clientPhotoPreview = ref("");
const clientPhotoName = ref("Ningún archivo seleccionado");
// Datos y pasos utilizados para registrar una cuenta de emprendedor.
const entrepreneurStep = ref(1);
const businessName = ref("");
const businessEmail = ref("");
const businessPhone = ref("");
const businessPassword = ref("");
const businessDescription = ref("");
const businessDepartment = ref("");
const businessDistrict = ref("");
const entrepreneurLoading = ref(false);
const showBusinessPassword = ref(false);
// Archivo real del logo.
const businessLogoFile = ref(null);
// Vista previa del logo.
const businessLogoPreview = ref("");
const businessLogoName = ref("Ningún archivo seleccionado");
// Actualiza los distritos según el departamento seleccionado.
const businessDistricts = computed(function () {
    if (!businessDepartment.value) return [];
    return districtsByDepartment[businessDepartment.value]
        .slice()
        .sort(function (a, b) {
            return a.localeCompare(b, "es");
        });
});
// Limpia el distrito elegido cuando cambia el departamento del emprendimiento.
function changeBusinessDepartment() {
    businessDistrict.value = "";
}
// Maneja la selección y vista previa de las imágenes.
function handleImagePreview(event, type) {
    const file = event.target.files?.[0];
    if (!file) {
        if (type === "client") {
            clientPhotoFile.value = null;
            clientPhotoPreview.value = "";
            clientPhotoName.value = "Ningún archivo seleccionado";
        } else {
            businessLogoFile.value = null;
            businessLogoPreview.value = "";
            businessLogoName.value = "Ningún archivo seleccionado";
        }
        return;
    }
    // Comprobamos que sea realmente una imagen.
    if (!file.type.startsWith("image/")) {
        alert("Selecciona un archivo de imagen válido.");
        event.target.value = "";
        return;
    }
    // El mismo límite utilizado por storage.js.
    if (file.size > 5 * 1024 * 1024) {
        alert("La imagen no puede superar los 5 MB.");
        event.target.value = "";
        return;
    }
    /*
        Guardamos el archivo real.
        Este era el cambio importante que faltaba:
        FileReader solo crea una vista previa, pero necesitamos
        conservar también el File para subirlo a Storage.
    */
    if (type === "client") {
        clientPhotoFile.value = file;
        clientPhotoName.value = file.name;
    } else {
        businessLogoFile.value = file;
        businessLogoName.value = file.name;
    }
    const reader = new FileReader();
    reader.onload = function (loadEvent) {
        if (type === "client") {
            clientPhotoPreview.value = loadEvent.target.result;
        } else {
            businessLogoPreview.value = loadEvent.target.result;
        }
    };
    reader.readAsDataURL(file);
}
// Proceso utilizado para iniciar sesión.
async function loginUser() {
    if (loginLoading.value) return;
    loginLoading.value = true;
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: loginEmail.value.trim(),
            password: loginPassword.value
        });
        if (error) {
            console.error("Error de inicio de sesión:", error);
            alert("Correo electrónico o contraseña incorrectos.");
            return;
        }
        if (!data.user) {
            alert("No fue posible obtener la información de tu cuenta.");
            return;
        }
        // Revisamos el tipo de cuenta para enviarlo a su pantalla.
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", data.user.id)
            .single();
        if (profileError || !profile) {
            console.error("Error al obtener profiles:", profileError);
            alert(
                "Tu sesión inició correctamente, pero no encontramos tu perfil."
            );
            return;
        }
        if (profile.user_type === "emprendedor") {
            router.push({ name: "BizHome" });
            return;
        }
        if (profile.user_type === "institucion") {
            /*
                Las instituciones no se registran desde esta pantalla.
                Sus cuentas son creadas previamente por los administradores
                y desde aquí únicamente inician sesión.
            */
            router.push({ name: "OrgHome" });
            return;
        }
        if (profile.user_type === "cliente") {
            router.push({ name: "Catalog" });
            return;
        }
        alert("Tu cuenta no tiene un tipo de usuario válido.");
    } catch (error) {
        console.error("Error inesperado al iniciar sesión:", error);
        alert(
            "Ocurrió un problema inesperado al iniciar sesión."
        );
    } finally {
        loginLoading.value = false;
    }
}
// Proceso utilizado para registrar una cuenta de cliente.
async function registerClient() {
    if (clientLoading.value) return;
    clientLoading.value = true;
    try {
        // Primero creamos el usuario en Supabase Authentication.
        const { data, error } = await supabase.auth.signUp({
            email: clientEmail.value.trim(),
            password: clientPassword.value
        });
        if (error) {
            console.error("Error en signUp del cliente:", error);
            alert(
                "No se pudo crear la cuenta: " +
                error.message
            );
            return;
        }
        if (!data.user) {
            alert(
                "No fue posible obtener la información del nuevo usuario."
            );
            return;
        }
        /*
            Para poder insertar en profiles y subir imágenes
            necesitamos que exista una sesión autenticada.
            Durante el desarrollo tienes desactivada la confirmación
            obligatoria de correo, así que normalmente data.session existe.
        */
        if (!data.session) {
            alert(
                "La cuenta fue creada, pero todavía no existe una sesión activa. Revisa la configuración de confirmación de correo en Supabase."
            );
            return;
        }
        /*
            Primero creamos siempre el perfil.
            Así, aunque ocurra un problema con la fotografía,
            la cuenta del cliente no queda sin registro en profiles.
        */
        const { error: profileError } = await supabase
            .from("profiles")
            .insert({
                id: data.user.id,
                full_name: clientName.value.trim(),
                phone: clientPhone.value.trim(),
                user_type: "cliente",
                avatar_url: null
            });
        if (profileError) {
            console.error(
                "Error al crear profiles del cliente:",
                profileError
            );
            alert(
                "La cuenta se creó, pero no se pudo guardar el perfil: " +
                profileError.message
            );
            return;
        }
        let photoWarning = "";
        /*
            Si el usuario eligió una fotografía,
            ahora sí la subimos al bucket thrive-images.
        */
        if (clientPhotoFile.value) {
            try {
                const uploadedPhoto = await uploadProfileImage(
                    data.user.id,
                    clientPhotoFile.value
                );
                /*
                    Después de subirla, guardamos su URL pública
                    dentro de profiles.avatar_url.
                */
                const { error: avatarError } = await supabase
                    .from("profiles")
                    .update({
                        avatar_url: uploadedPhoto.publicUrl
                    })
                    .eq("id", data.user.id);
                if (avatarError) {
                    throw avatarError;
                }
            } catch (photoError) {
                console.error(
                    "Error al guardar la foto del cliente:",
                    photoError
                );
                photoWarning =
                    " La cuenta se creó correctamente, pero no fue posible guardar la fotografía.";
            }
        }
        alert(
            "Tu cuenta de cliente fue creada correctamente." +
            photoWarning
        );
        // Limpiamos el formulario.
        clientName.value = "";
        clientEmail.value = "";
        clientPhone.value = "";
        clientPassword.value = "";
        clientPhotoFile.value = null;
        clientPhotoPreview.value = "";
        clientPhotoName.value = "Ningún archivo seleccionado";
        clientStep.value = 1;
        // El cliente entra al catálogo con su sesión activa.
        router.push({ name: "Catalog" });
    } catch (error) {
        console.error(
            "Error inesperado al crear cliente:",
            error
        );
        alert(
            "Ocurrió un problema inesperado al crear la cuenta."
        );
    } finally {
        clientLoading.value = false;
    }
}
// Proceso utilizado para registrar una cuenta de emprendedor.
async function registerEntrepreneur() {
    if (entrepreneurLoading.value) return;
    entrepreneurLoading.value = true;
    try {
        // Creamos la cuenta de Authentication.
        const { data, error } = await supabase.auth.signUp({
            email: businessEmail.value.trim(),
            password: businessPassword.value
        });
        if (error) {
            console.error(
                "Error en signUp del emprendedor:",
                error
            );
            alert(
                "No se pudo crear la cuenta: " +
                error.message
            );
            return;
        }
        if (!data.user) {
            alert(
                "No fue posible obtener la información del nuevo usuario."
            );
            return;
        }
        if (!data.session) {
            alert(
                "La cuenta fue creada, pero todavía no existe una sesión activa. Revisa la configuración de confirmación de correo en Supabase."
            );
            return;
        }
        /*
            Creamos primero el perfil general.
            Este registro identifica al usuario como emprendedor.
        */
        const { error: profileError } = await supabase
            .from("profiles")
            .insert({
                id: data.user.id,
                full_name: null,
                phone: businessPhone.value.trim(),
                user_type: "emprendedor",
                avatar_url: null
            });
        if (profileError) {
            console.error(
                "Error al crear profiles del emprendedor:",
                profileError
            );
            alert(
                "La cuenta se creó, pero no se pudo guardar el perfil: " +
                profileError.message
            );
            return;
        }
        let logoUrl = null;
        let logoWarning = "";
        /*
            Subimos el logo antes de crear entrepreneurs
            para guardar directamente la URL correcta.
        */
        if (businessLogoFile.value) {
            try {
                const uploadedLogo =
                    await uploadEntrepreneurLogo(
                        data.user.id,
                        businessLogoFile.value
                    );
                logoUrl =
                    uploadedLogo.publicUrl;
            } catch (logoError) {
                console.error(
                    "Error al subir el logo:",
                    logoError
                );
                /*
                    Como la imagen es opcional, permitimos crear
                    el emprendimiento aunque el logo falle.
                */
                logoWarning =
                    " El emprendimiento se creó, pero no fue posible guardar el logo.";
            }
        }
        // Creamos los datos específicos del emprendimiento.
        const { error: entrepreneurError } =
            await supabase
                .from("entrepreneurs")
                .insert({
                    id: data.user.id,
                    business_name:
                        businessName.value.trim(),
                    description:
                        businessDescription.value.trim(),
                    department:
                        businessDepartment.value,
                    district:
                        businessDistrict.value,
                    logo_url:
                        logoUrl
                });
        if (entrepreneurError) {
            console.error(
                "Error al crear entrepreneurs:",
                entrepreneurError
            );
            alert(
                "La cuenta y el perfil se crearon, pero no se pudo crear el emprendimiento: " +
                entrepreneurError.message
            );
            return;
        }
        alert(
            "Tu cuenta de emprendedor fue creada correctamente." +
            logoWarning
        );
        // Limpiamos los datos.
        businessName.value = "";
        businessEmail.value = "";
        businessPhone.value = "";
        businessPassword.value = "";
        businessDescription.value = "";
        businessDepartment.value = "";
        businessDistrict.value = "";
        businessLogoFile.value = null;
        businessLogoPreview.value = "";
        businessLogoName.value = "Ningún archivo seleccionado";
        entrepreneurStep.value = 1;
        // Entramos directamente al panel.
        router.push({ name: "BizHome" });
    } catch (error) {
        console.error(
            "Error inesperado al crear emprendedor:",
            error
        );
        alert(
            "Ocurrió un problema inesperado al crear la cuenta."
        );
    } finally {
        entrepreneurLoading.value = false;
    }
}
</script>
<template>
    <div class="auth-page min-h-screen font-sans">
        <!-- Fondo oscuro -->
        <main class="flex min-h-screen items-center justify-center bg-black/30 px-4 py-8 sm:px-6 lg:px-8">
            <!-- Tarjeta -->
            <section class="w-full max-w-[560px] rounded-[28px] border border-white/20 bg-black/50 p-5 shadow-[0_20px_55px_rgba(0,0,0,0.40)] backdrop-blur-md sm:p-8">
                <!-- Cabecera -->
                <div class="relative mb-7 flex items-center justify-center">
                    <RouterLink
                        to="/"
                        class="absolute left-0 top-1/2 flex -translate-y-1/2 items-center gap-2 text-sm font-bold text-white/75"
                    >
                        <img
                            src="../assets/img/back.png"
                            alt="Volver"
                            class="h-7 w-7 object-contain"
                        >
                        <span class="hidden sm:inline">
                            Volver
                        </span>
                    </RouterLink>
                    <img
                        src="../assets/img/logo.png"
                        alt="Logo Thrive"
                        class="h-14 w-auto object-contain"
                    >
                </div>
                <!-- Login / Registro -->
                <div class="mb-7 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/10 p-1">
                    <button
                        type="button"
                        :class="
                            activeTab === 'login'
                                ? 'rounded-xl bg-[#00B4D8] px-4 py-3 font-bold text-white'
                                : 'rounded-xl px-4 py-3 font-bold text-white/70'
                        "
                        @click="activeTab = 'login'"
                    >
                        Iniciar sesión
                    </button>
                    <button
                        type="button"
                        :class="
                            activeTab === 'register'
                                ? 'rounded-xl bg-[#00B4D8] px-4 py-3 font-bold text-white'
                                : 'rounded-xl px-4 py-3 font-bold text-white/70'
                        "
                        @click="activeTab = 'register'"
                    >
                        Registrarse
                    </button>
                </div>
                <!-- Login. -->
                <section v-if="activeTab === 'login'">
                    <div class="mb-7">
                        <p class="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#90E0EF]">
                            Bienvenido a Thrive
                        </p>
                        <h1 class="text-3xl font-black text-white sm:text-4xl">
                            Inicio de sesión
                        </h1>
                        <p class="mt-2 text-white/60">
                            Ingresa tus datos para acceder a tu cuenta.
                        </p>
                    </div>
                    <form
                        class="space-y-5"
                        @submit.prevent="loginUser"
                    >
                        <!-- Correo -->
                        <div>
                            <label
                                for="loginEmail"
                                class="mb-2 block text-sm font-bold text-white/80"
                            >
                                Correo electrónico
                            </label>
                            <input
                                id="loginEmail"
                                v-model="loginEmail"
                                type="email"
                                autocomplete="email"
                                placeholder="ejemplo@gmail.com"
                                required
                                class="auth-input w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#00B4D8]"
                            >
                        </div>
                        <!-- Contraseña -->
                        <div>
                            <label
                                for="loginPassword"
                                class="mb-2 block text-sm font-bold text-white/80"
                            >
                                Contraseña
                            </label>
                            <div class="relative">
                                <input
                                    id="loginPassword"
                                    v-model="loginPassword"
                                    :type="showLoginPassword ? 'text' : 'password'"
                                    autocomplete="current-password"
                                    placeholder="Ingresa tu contraseña"
                                    required
                                    class="auth-input auth-password-input w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 pr-12 text-white outline-none placeholder:text-white/35 focus:border-[#00B4D8]"
                                >
                                <button
                                    type="button"
                                    aria-label="Mostrar u ocultar contraseña"
                                    class="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
                                    @click="showLoginPassword = !showLoginPassword"
                                >
                                    <svg
                                        v-if="!showLoginPassword"
                                        class="h-5 w-5"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="1.8"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
                                        ></path>
                                        <circle
                                            cx="12"
                                            cy="12"
                                            r="3"
                                        ></circle>
                                    </svg>
                                    <svg
                                        v-else
                                        class="h-5 w-5"
                                        fill="none"
                                        stroke="currentColor"
                                        stroke-width="1.8"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            d="M3 3l18 18"
                                        ></path>
                                        <path
                                            stroke-linecap="round"
                                            d="M10.6 6.2A10.8 10.8 0 0112 6c6.5 0 10 6 10 6a15 15 0 01-2.3 3"
                                        ></path>
                                        <path
                                            stroke-linecap="round"
                                            d="M6.7 6.7C3.7 8.5 2 12 2 12s3.5 6 10 6a10 10 0 004.2-.9"
                                        ></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="text-right">
                            <a
                                href="#"
                                class="text-sm font-semibold text-[#90E0EF]"
                            >
                                ¿Olvidaste tu contraseña?
                            </a>
                        </div>
                        <button
                            type="submit"
                            :disabled="loginLoading"
                            class="w-full rounded-xl bg-[#00B4D8] px-6 py-3.5 font-bold text-white transition hover:bg-[#009CC0] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {{
                                loginLoading
                                    ? "Iniciando sesión..."
                                    : "Iniciar sesión"
                            }}
                        </button>
                    </form>
                    <!-- Separador -->
                    <div class="my-7 flex items-center gap-4">
                        <div class="h-px flex-1 bg-white/20"></div>
                        <span class="text-sm text-white/45">
                            o continúa con
                        </span>
                        <div class="h-px flex-1 bg-white/20"></div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            class="rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-bold text-white"
                        >
                            Google
                        </button>
                        <button
                            type="button"
                            class="rounded-xl bg-[#0077B6] px-4 py-3 font-bold text-white"
                        >
                            Microsoft
                        </button>
                    </div>
                </section>
                <!-- Registro. -->
                <section v-else>
                    <div class="mb-6">
                        <p class="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#90E0EF]">
                            Únete a Thrive
                        </p>
                        <h2 class="text-3xl font-black text-white">
                            Crear una cuenta
                        </h2>
                        <p class="mt-2 text-white/60">
                            Selecciona cómo deseas utilizar la plataforma.
                        </p>
                    </div>
                    <!-- Tipo de usuario -->
                    <div class="mb-6 grid grid-cols-2 rounded-2xl border border-white/10 bg-white/10 p-1">
                        <button
                            type="button"
                            :class="
                                accountType === 'client'
                                    ? 'rounded-xl bg-[#0077B6] px-4 py-3 font-bold text-white'
                                    : 'rounded-xl px-4 py-3 font-bold text-white/70'
                            "
                            @click="accountType = 'client'"
                        >
                            Cliente
                        </button>
                        <button
                            type="button"
                            :class="
                                accountType === 'entrepreneur'
                                    ? 'rounded-xl bg-[#0077B6] px-4 py-3 font-bold text-white'
                                    : 'rounded-xl px-4 py-3 font-bold text-white/70'
                            "
                            @click="accountType = 'entrepreneur'"
                        >
                            Emprendedor
                        </button>
                    </div>
                    <!-- Cliente. -->
                    <div v-if="accountType === 'client'">
                        <!-- Progreso -->
                        <div class="mb-6">
                            <div class="mb-2 flex items-center justify-between">
                                <span class="text-xs font-bold text-[#90E0EF]">
                                    Paso {{ clientStep }} de 2
                                </span>
                                <span class="text-xs text-white/45">
                                    Cuenta de cliente
                                </span>
                            </div>
                            <div class="h-1 overflow-hidden rounded-full bg-white/15">
                                <div
                                    class="h-full bg-[#00B4D8] transition-all"
                                    :class="
                                        clientStep === 1
                                            ? 'w-1/2'
                                            : 'w-full'
                                    "
                                ></div>
                            </div>
                        </div>
                        <!-- PASO 1 -->
                        <div v-if="clientStep === 1">
                            <form
                                class="space-y-4"
                                @submit.prevent="clientStep = 2"
                            >
                                <!-- Nombre -->
                                <div>
                                    <label
                                        for="clientName"
                                        class="mb-2 block text-sm font-bold text-white/80"
                                    >
                                        Nombre completo
                                    </label>
                                    <input
                                        id="clientName"
                                        v-model="clientName"
                                        type="text"
                                        autocomplete="name"
                                        placeholder="Tu nombre completo"
                                        required
                                        class="auth-input w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#00B4D8]"
                                    >
                                </div>
                                <!-- Correo -->
                                <div>
                                    <label
                                        for="clientEmail"
                                        class="mb-2 block text-sm font-bold text-white/80"
                                    >
                                        Correo electrónico
                                    </label>
                                    <input
                                        id="clientEmail"
                                        v-model="clientEmail"
                                        type="email"
                                        autocomplete="email"
                                        placeholder="ejemplo@gmail.com"
                                        required
                                        class="auth-input w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#00B4D8]"
                                    >
                                </div>
                                <div class="grid gap-4 sm:grid-cols-2">
                                    <!-- Teléfono -->
                                    <div>
                                        <label
                                            for="clientPhone"
                                            class="mb-2 block text-sm font-bold text-white/80"
                                        >
                                            Teléfono
                                        </label>
                                        <input
                                            id="clientPhone"
                                            v-model="clientPhone"
                                            type="tel"
                                            autocomplete="tel"
                                            placeholder="0000 0000"
                                            required
                                            class="auth-input w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#00B4D8]"
                                        >
                                    </div>
                                    <!-- Contraseña -->
                                    <div>
                                        <label
                                            for="clientPassword"
                                            class="mb-2 block text-sm font-bold text-white/80"
                                        >
                                            Contraseña
                                        </label>
                                        <div class="relative">
                                            <input
                                                id="clientPassword"
                                                v-model="clientPassword"
                                                :type="showClientPassword ? 'text' : 'password'"
                                                autocomplete="new-password"
                                                minlength="8"
                                                placeholder="Mínimo 8 caracteres"
                                                required
                                                class="auth-input auth-password-input w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 pr-12 text-white outline-none placeholder:text-white/35 focus:border-[#00B4D8]"
                                            >
                                            <button
                                                type="button"
                                                aria-label="Mostrar u ocultar contraseña"
                                                class="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
                                                @click="showClientPassword = !showClientPassword"
                                            >
                                                <svg
                                                    v-if="!showClientPassword"
                                                    class="h-5 w-5"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="1.8"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
                                                    ></path>
                                                    <circle
                                                        cx="12"
                                                        cy="12"
                                                        r="3"
                                                    ></circle>
                                                </svg>
                                                <svg
                                                    v-else
                                                    class="h-5 w-5"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="1.8"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        stroke-linecap="round"
                                                        d="M3 3l18 18"
                                                    ></path>
                                                    <path
                                                        stroke-linecap="round"
                                                        d="M6.7 6.7C3.7 8.5 2 12 2 12s3.5 6 10 6a10 10 0 004.2-.9"
                                                    ></path>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    class="w-full rounded-xl bg-[#00B4D8] px-6 py-3.5 font-bold text-white transition hover:bg-[#009CC0]"
                                >
                                    Continuar
                                </button>
                            </form>
                        </div>
                        <!-- PASO 2 -->
                        <div v-else>
                            <form
                                class="space-y-5"
                                @submit.prevent="registerClient"
                            >
                                <!-- Foto del cliente -->
                                <div>
                                    <p class="mb-2 block text-sm font-bold text-white/80">
                                        Foto de perfil
                                        <span class="font-normal text-white/40">
                                            (opcional)
                                        </span>
                                    </p>
                                    <div class="rounded-2xl border border-white/15 bg-black/15 p-4">
                                        <div class="flex flex-col items-center gap-4 sm:flex-row">
                                            <!-- Vista previa -->
                                            <div class="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-[#00B4D8]/70 bg-black/30">
                                                <img
                                                    v-if="clientPhotoPreview"
                                                    :src="clientPhotoPreview"
                                                    alt="Vista previa de foto de perfil"
                                                    class="h-full w-full object-cover"
                                                >
                                                <div
                                                    v-else
                                                    class="flex h-full w-full items-center justify-center px-2 text-center text-xs font-semibold text-white/45"
                                                >
                                                    Vista previa
                                                </div>
                                            </div>
                                            <!-- Selector -->
                                            <div class="w-full text-center sm:text-left">
                                                <p class="text-sm font-bold text-white">
                                                    Elige tu foto
                                                </p>
                                                <p class="mt-1 text-xs leading-relaxed text-white/50">
                                                    La fotografía se guardará en tu perfil de Thrive.
                                                </p>
                                                <input
                                                    id="clientPhoto"
                                                    type="file"
                                                    accept="image/*"
                                                    class="hidden"
                                                    @change="handleImagePreview($event, 'client')"
                                                >
                                                <div class="mt-3 flex flex-col items-center gap-2 sm:items-start">
                                                    <label
                                                        for="clientPhoto"
                                                        class="cursor-pointer rounded-xl border border-[#00B4D8]/60 bg-[#00B4D8]/15 px-4 py-2 text-sm font-bold text-[#90E0EF] transition hover:bg-[#00B4D8]/25"
                                                    >
                                                        Seleccionar imagen
                                                    </label>
                                                    <span class="max-w-full truncate text-xs text-white/40">
                                                        {{ clientPhotoName }}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <!-- Botones -->
                                <div class="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        class="rounded-xl border border-white/20 bg-white/10 px-5 py-3.5 font-bold text-white"
                                        @click="clientStep = 1"
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        type="submit"
                                        :disabled="clientLoading"
                                        class="rounded-xl bg-[#00B4D8] px-5 py-3.5 font-bold text-white transition hover:bg-[#009CC0] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {{
                                            clientLoading
                                                ? "Creando cuenta..."
                                                : "Crear cuenta"
                                        }}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                    <!-- Emprendedor. -->
                    <div v-else>
                        <!-- Progreso -->
                        <div class="mb-6">
                            <div class="mb-2 flex items-center justify-between">
                                <span class="text-xs font-bold text-[#90E0EF]">
                                    Paso {{ entrepreneurStep }} de 2
                                </span>
                                <span class="text-xs text-white/45">
                                    Cuenta de emprendedor
                                </span>
                            </div>
                            <div class="h-1 overflow-hidden rounded-full bg-white/15">
                                <div
                                    class="h-full bg-[#00B4D8] transition-all"
                                    :class="
                                        entrepreneurStep === 1
                                            ? 'w-1/2'
                                            : 'w-full'
                                    "
                                ></div>
                            </div>
                        </div>
                        <!-- PASO 1 -->
                        <div v-if="entrepreneurStep === 1">
                            <form
                                class="space-y-4"
                                @submit.prevent="entrepreneurStep = 2"
                            >
                                <!-- Nombre -->
                                <div>
                                    <label
                                        for="businessName"
                                        class="mb-2 block text-sm font-bold text-white/80"
                                    >
                                        Nombre del emprendimiento
                                    </label>
                                    <input
                                        id="businessName"
                                        v-model="businessName"
                                        type="text"
                                        placeholder="Nombre de tu emprendimiento"
                                        required
                                        class="auth-input w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#00B4D8]"
                                    >
                                </div>
                                <!-- Correo -->
                                <div>
                                    <label
                                        for="businessEmail"
                                        class="mb-2 block text-sm font-bold text-white/80"
                                    >
                                        Correo electrónico
                                    </label>
                                    <input
                                        id="businessEmail"
                                        v-model="businessEmail"
                                        type="email"
                                        autocomplete="email"
                                        placeholder="ejemplo@gmail.com"
                                        required
                                        class="auth-input w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#00B4D8]"
                                    >
                                </div>
                                <div class="grid gap-4 sm:grid-cols-2">
                                    <!-- Teléfono -->
                                    <div>
                                        <label
                                            for="businessPhone"
                                            class="mb-2 block text-sm font-bold text-white/80"
                                        >
                                            Teléfono
                                        </label>
                                        <input
                                            id="businessPhone"
                                            v-model="businessPhone"
                                            type="tel"
                                            autocomplete="tel"
                                            placeholder="0000 0000"
                                            required
                                            class="auth-input w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#00B4D8]"
                                        >
                                    </div>
                                    <!-- Contraseña -->
                                    <div>
                                        <label
                                            for="businessPassword"
                                            class="mb-2 block text-sm font-bold text-white/80"
                                        >
                                            Contraseña
                                        </label>
                                        <div class="relative">
                                            <input
                                                id="businessPassword"
                                                v-model="businessPassword"
                                                :type="showBusinessPassword ? 'text' : 'password'"
                                                autocomplete="new-password"
                                                minlength="8"
                                                placeholder="Mínimo 8 caracteres"
                                                required
                                                class="auth-input auth-password-input w-full rounded-xl border border-white/20 bg-black/20 px-4 py-3 pr-12 text-white outline-none placeholder:text-white/35 focus:border-[#00B4D8]"
                                            >
                                            <button
                                                type="button"
                                                aria-label="Mostrar u ocultar contraseña"
                                                class="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
                                                @click="showBusinessPassword = !showBusinessPassword"
                                            >
                                                <svg
                                                    v-if="!showBusinessPassword"
                                                    class="h-5 w-5"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="1.8"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"
                                                    ></path>
                                                    <circle
                                                        cx="12"
                                                        cy="12"
                                                        r="3"
                                                    ></circle>
                                                </svg>
                                                <svg
                                                    v-else
                                                    class="h-5 w-5"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    stroke-width="1.8"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        stroke-linecap="round"
                                                        d="M3 3l18 18"
                                                    ></path>
                                                    <path
                                                        stroke-linecap="round"
                                                        d="M6.7 6.7C3.7 8.5 2 12 2 12s3.5 6 10 6a10 10 0 004.2-.9"
                                                    ></path>
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="submit"
                                    class="w-full rounded-xl bg-[#00B4D8] px-6 py-3.5 font-bold text-white transition hover:bg-[#009CC0]"
                                >
                                    Continuar
                                </button>
                            </form>
                        </div>
                        <!-- PASO 2 -->
                        <div v-else>
                            <form
                                class="space-y-5"
                                @submit.prevent="registerEntrepreneur"
                            >
                                <!-- Ubicación -->
                                <div class="grid gap-4 sm:grid-cols-2">
                                    <!-- Departamento -->
                                    <div>
                                        <label
                                            for="businessDepartment"
                                            class="mb-2 block text-sm font-bold text-white/80"
                                        >
                                            Departamento
                                        </label>
                                        <select
                                            id="businessDepartment"
                                            v-model="businessDepartment"
                                            required
                                            class="w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-white outline-none focus:border-[#00B4D8]"
                                            @change="changeBusinessDepartment"
                                        >
                                            <option value="">
                                                Selecciona un departamento
                                            </option>
                                            <option
                                                v-for="department in departments"
                                                :key="department"
                                                :value="department"
                                            >
                                                {{ department }}
                                            </option>
                                        </select>
                                    </div>
                                    <!-- Distrito -->
                                    <div>
                                        <label
                                            for="businessDistrict"
                                            class="mb-2 block text-sm font-bold text-white/80"
                                        >
                                            Distrito
                                        </label>
                                        <select
                                            id="businessDistrict"
                                            v-model="businessDistrict"
                                            required
                                            :disabled="!businessDepartment"
                                            class="w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-white outline-none focus:border-[#00B4D8] disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            <option value="">
                                                {{
                                                    businessDepartment
                                                        ? "Selecciona un distrito"
                                                        : "Primero selecciona un departamento"
                                                }}
                                            </option>
                                            <option
                                                v-for="district in businessDistricts"
                                                :key="district"
                                                :value="district"
                                            >
                                                {{ district }}
                                            </option>
                                        </select>
                                    </div>
                                </div>
                                <!-- Descripción -->
                                <div>
                                    <label
                                        for="businessDescription"
                                        class="mb-2 block text-sm font-bold text-white/80"
                                    >
                                        Descripción
                                    </label>
                                    <textarea
                                        id="businessDescription"
                                        v-model="businessDescription"
                                        rows="3"
                                        placeholder="Cuéntanos brevemente sobre tu emprendimiento"
                                        required
                                        class="auth-input w-full resize-none rounded-xl border border-white/20 bg-black/20 px-4 py-3 text-white outline-none placeholder:text-white/35 focus:border-[#00B4D8]"
                                    ></textarea>
                                </div>
                                <!-- Logo -->
                                <div>
                                    <p class="mb-2 block text-sm font-bold text-white/80">
                                        Foto o logo del emprendimiento
                                        <span class="font-normal text-white/40">
                                            (opcional)
                                        </span>
                                    </p>
                                    <div class="rounded-2xl border border-white/15 bg-black/15 p-4">
                                        <div class="flex flex-col items-center gap-4 sm:flex-row">
                                            <!-- Vista previa -->
                                            <div class="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-[#00B4D8]/70 bg-black/30">
                                                <img
                                                    v-if="businessLogoPreview"
                                                    :src="businessLogoPreview"
                                                    alt="Vista previa del logo"
                                                    class="h-full w-full object-cover"
                                                >
                                                <div
                                                    v-else
                                                    class="flex h-full w-full items-center justify-center px-2 text-center text-xs font-semibold text-white/45"
                                                >
                                                    Vista previa
                                                </div>
                                            </div>
                                            <!-- Selector -->
                                            <div class="w-full text-center sm:text-left">
                                                <p class="text-sm font-bold text-white">
                                                    Imagen del emprendimiento
                                                </p>
                                                <p class="mt-1 text-xs leading-relaxed text-white/50">
                                                    El logo se guardará junto con la información de tu emprendimiento.
                                                </p>
                                                <input
                                                    id="businessLogo"
                                                    type="file"
                                                    accept="image/*"
                                                    class="hidden"
                                                    @change="handleImagePreview($event, 'business')"
                                                >
                                                <div class="mt-3 flex flex-col items-center gap-2 sm:items-start">
                                                    <label
                                                        for="businessLogo"
                                                        class="cursor-pointer rounded-xl border border-[#00B4D8]/60 bg-[#00B4D8]/15 px-4 py-2 text-sm font-bold text-[#90E0EF] transition hover:bg-[#00B4D8]/25"
                                                    >
                                                        Seleccionar imagen
                                                    </label>
                                                    <span class="max-w-full truncate text-xs text-white/40">
                                                        {{ businessLogoName }}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <!-- Botones -->
                                <div class="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        class="rounded-xl border border-white/20 bg-white/10 px-5 py-3.5 font-bold text-white"
                                        @click="entrepreneurStep = 1"
                                    >
                                        Atrás
                                    </button>
                                    <button
                                        type="submit"
                                        :disabled="entrepreneurLoading"
                                        class="rounded-xl bg-[#00B4D8] px-5 py-3.5 font-bold text-white transition hover:bg-[#009CC0] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {{
                                            entrepreneurLoading
                                                ? "Creando cuenta..."
                                                : "Crear cuenta"
                                        }}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </section>
            </section>
        </main>
    </div>
</template>
<style scoped>
/* Fondo exclusivo de la pantalla de autenticación. */
.auth-page {
    background-image: url("../assets/img/firstp.png");
    background-repeat: repeat;
    background-size: 1050px auto;
    background-position: center top;
}
/* Mantiene los campos rellenados automáticamente con el mismo diseño oscuro. */
.auth-input:-webkit-autofill,
.auth-input:-webkit-autofill:hover,
.auth-input:-webkit-autofill:focus,
.auth-input:-webkit-autofill:active {
    -webkit-text-fill-color: #ffffff !important;
    caret-color: #ffffff !important;
    -webkit-box-shadow: 0 0 0 1000px #171717 inset !important;
    box-shadow: 0 0 0 1000px #171717 inset !important;
    border-color: rgba(255, 255, 255, 0.2) !important;
    transition: background-color 9999s ease-out 0s;
}
/* Evita que Microsoft Edge muestre un segundo botón para revelar contraseña. */
.auth-password-input::-ms-reveal,
.auth-password-input::-ms-clear {
    display: none;
    width: 0;
    height: 0;
}
/* Ajustamos el patrón de fondo para teléfonos. */
@media (max-width: 640px) {
    .auth-page {
        background-size: 750px auto;
    }
}
</style>

<script setup>
// Vista principal de la institución; mantiene la misma navegación del dashboard del emprendedor.
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient.js";
import InicioInstitucion from "../components/institucion/InicioInstitucion.vue";
import PublicacionesInstitucion from "../components/institucion/PublicacionesInstitucion.vue";
import EmprendedoresInstitucion from "../components/institucion/EmprendedoresInstitucion.vue";
import PerfilInstitucion from "../components/institucion/PerfilInstitucion.vue";

const router = useRouter();
const institution = ref(null);
const loading = ref(true);
const loadError = ref("");
const logoutLoading = ref(false);
const activeSection = ref("inicio");

const institutionInitials = computed(function () {
    const name = institution.value?.institutionName || "Thrive";
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(function (word) {
            return word.charAt(0).toUpperCase();
        })
        .join("");
});

function changeSection(section) {
    activeSection.value = section;
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function updateInstitution(updatedInstitution) {
    institution.value = {
        ...institution.value,
        ...updatedInstitution
    };
}

async function loadInstitution() {
    loading.value = true;
    loadError.value = "";

    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
            router.replace("/auth");
            return;
        }

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select(`
                id,
                full_name,
                phone,
                user_type,
                avatar_url
            `)
            .eq("id", user.id)
            .single();

        if (
            profileError ||
            profile?.user_type !== "institucion"
        ) {
            console.error(
                "La cuenta no tiene acceso institucional:",
                profileError
            );
            loadError.value =
                "Esta cuenta no tiene permisos para abrir el panel institucional.";
            return;
        }

        const { data, error } = await supabase
            .from("institutions")
            .select(`
                id,
                institution_name,
                description,
                website,
                department,
                district,
                logo_url,
                active,
                created_at
            `)
            .eq("id", user.id)
            .single();

        if (error || !data) {
            console.error(
                "No se pudo cargar la institución:",
                error
            );
            loadError.value =
                "No encontramos el perfil institucional conectado a esta cuenta.";
            return;
        }

        institution.value = {
            id: data.id,
            institutionName:
                data.institution_name || profile.full_name || "",
            description: data.description || "",
            website: data.website || "",
            department: data.department || "",
            district: data.district || "",
            logoUrl: data.logo_url || profile.avatar_url || "",
            phone: profile.phone || "",
            email: user.email || "",
            active: data.active,
            createdAt: data.created_at
        };
    } catch (error) {
        console.error(
            "Error al cargar el panel institucional:",
            error
        );
        loadError.value =
            "Ocurrió un problema inesperado al cargar el panel.";
    } finally {
        loading.value = false;
    }
}

async function logout() {
    if (logoutLoading.value) return;
    logoutLoading.value = true;

    try {
        const { error } = await supabase.auth.signOut({
            scope: "local"
        });

        if (error) throw error;
        router.replace("/auth");
    } catch (error) {
        console.error(
            "Error al cerrar sesión:",
            error
        );
        alert("No fue posible cerrar la sesión.");
    } finally {
        logoutLoading.value = false;
    }
}

function handleEscape(event) {
    if (event.key === "Escape") {
        document.body.style.overflow = "";
    }
}

onMounted(function () {
    loadInstitution();
    document.addEventListener("keydown", handleEscape);
});

onBeforeUnmount(function () {
    document.removeEventListener("keydown", handleEscape);
    document.body.style.overflow = "";
});
</script>

<template>
<div class="min-h-screen bg-[#F8FBFC] pb-[76px] text-gray-700 lg:pb-0">
    <!-- Cabecera igual a la del dashboard del emprendedor. -->
    <header class="sticky top-0 z-40 bg-[#F8FBFC]">
        <div class="mx-auto max-w-[1450px] px-2 pt-2 sm:px-5 lg:px-8 lg:pt-4">
            <!-- Cabecera móvil. -->
            <div class="flex items-center gap-1 rounded-[24px] bg-[#00B4D8] p-1.5 shadow-sm sm:gap-2 sm:p-2 lg:hidden">
                <div class="flex min-w-0 flex-1 items-center gap-2 px-3">
                    <div class="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 text-xs font-black text-white">
                        <img
                            v-if="institution?.logoUrl"
                            :src="institution.logoUrl"
                            :alt="institution.institutionName"
                            class="h-full w-full object-cover"
                        >
                        <span v-else>
                            {{ institutionInitials }}
                        </span>
                    </div>
                    <span class="truncate text-sm font-bold text-white sm:text-base">
                        {{ institution?.institutionName || "Thrive" }}
                    </span>
                </div>

                <button
                    type="button"
                    aria-label="Notificaciones"
                    class="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/20"
                >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                        <path stroke-linecap="round" d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"></path>
                    </svg>
                </button>

                <button
                    type="button"
                    aria-label="Abrir perfil"
                    class="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/20"
                    @click="changeSection('perfil')"
                >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                        <circle cx="12" cy="8" r="4"></circle>
                        <path stroke-linecap="round" d="M4 21a8 8 0 0116 0"></path>
                    </svg>
                </button>
            </div>

            <!-- Navbar principal para laptop. -->
            <nav class="hidden items-center justify-center gap-2 rounded-[24px] bg-[#00B4D8] p-2 shadow-sm lg:flex">
                <button
                    v-for="item in [
                        ['inicio', 'Inicio'],
                        ['publicaciones', 'Publicaciones'],
                        ['emprendedores', 'Emprendedores'],
                        ['perfil', 'Perfil']
                    ]"
                    :key="item[0]"
                    type="button"
                    class="rounded-full px-6 py-2.5 text-sm font-bold transition"
                    :class="activeSection === item[0] ? 'bg-white text-[#0077B6] shadow-sm' : 'text-white/85 hover:bg-white/15 hover:text-white'"
                    @click="changeSection(item[0])"
                >
                    {{ item[1] }}
                </button>
            </nav>
        </div>
    </header>

    <!-- Cargando. -->
    <main
        v-if="loading"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center"
    >
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        <p class="mt-4 text-sm font-semibold text-gray-400">
            Cargando panel institucional...
        </p>
    </main>

    <!-- Error. -->
    <main
        v-else-if="loadError"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center"
    >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 font-black text-red-600">
            !
        </div>
        <p class="mt-4 font-black text-gray-700">
            No pudimos cargar el dashboard
        </p>
        <p class="mt-2 text-sm text-gray-400">
            {{ loadError }}
        </p>
        <button
            type="button"
            class="mt-5 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white"
            @click="loadInstitution"
        >
            Intentar nuevamente
        </button>
    </main>

    <!-- Cada sección vive en su propio archivo para mantener el dashboard ligero. -->
    <main
        v-else-if="institution"
        class="mx-auto max-w-[1450px] px-3 pb-10 pt-3 sm:px-5 lg:px-8"
    >
        <InicioInstitucion
            v-if="activeSection === 'inicio'"
            :institution="institution"
            @change-section="changeSection"
        />

        <PublicacionesInstitucion
            v-else-if="activeSection === 'publicaciones'"
            :institution="institution"
        />

        <EmprendedoresInstitucion
            v-else-if="activeSection === 'emprendedores'"
        />

        <PerfilInstitucion
            v-else
            :institution="institution"
            :logout-loading="logoutLoading"
            @updated="updateInstitution"
            @logout="logout"
        />
    </main>

    <!-- Menú móvil igual al del dashboard del emprendedor. -->
    <nav class="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border-t border-white/20 bg-[#00B4D8] shadow-[0_-6px_20px_rgba(0,0,0,0.12)] lg:hidden">
        <div class="mx-auto grid max-w-lg grid-cols-4">
            <button
                type="button"
                class="flex flex-col items-center gap-1 py-2 text-white"
                :class="activeSection === 'inicio' ? 'bg-white/15' : 'text-white/75'"
                @click="changeSection('inicio')"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M3 11l9-8 9 8"></path>
                    <path d="M5 10v10h14V10"></path>
                </svg>
                <span class="text-[9px] font-bold">
                    Inicio
                </span>
            </button>

            <button
                type="button"
                class="flex flex-col items-center gap-1 py-2 text-white"
                :class="activeSection === 'publicaciones' ? 'bg-white/15' : 'text-white/75'"
                @click="changeSection('publicaciones')"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linejoin="round" d="M4 5h16v14H4z"></path>
                    <path stroke-linecap="round" d="M8 9h8M8 13h8M8 17h5"></path>
                </svg>
                <span class="text-[9px] font-bold">
                    Publicaciones
                </span>
            </button>

            <button
                type="button"
                class="flex flex-col items-center gap-1 py-2 text-white"
                :class="activeSection === 'emprendedores' ? 'bg-white/15' : 'text-white/75'"
                @click="changeSection('emprendedores')"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <circle cx="9" cy="8" r="3"></circle>
                    <circle cx="17" cy="9" r="2"></circle>
                    <path stroke-linecap="round" d="M3 20a6 6 0 0112 0M14 20a4 4 0 018 0"></path>
                </svg>
                <span class="text-[9px] font-bold">
                    Emprendedores
                </span>
            </button>

            <button
                type="button"
                class="flex flex-col items-center gap-1 py-2 text-white"
                :class="activeSection === 'perfil' ? 'bg-white/15' : 'text-white/75'"
                @click="changeSection('perfil')"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <circle cx="12" cy="8" r="4"></circle>
                    <path stroke-linecap="round" d="M4 21a8 8 0 0116 0"></path>
                </svg>
                <span class="text-[9px] font-bold">
                    Perfil
                </span>
            </button>
        </div>
    </nav>
</div>
</template>

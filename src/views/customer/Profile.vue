<script setup>
// Perfil dedicado del cliente, con el mismo orden visual de institución y emprendedor.
import {
    ref,
    computed,
    onMounted,
    onBeforeUnmount
} from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../../lib/supabaseClient";
import CustomerHeader from "../../components/customer/CustomerHeader.vue";
import {
    uploadProfileImage,
    deleteImage,
    getStoragePathFromPublicUrl
} from "../../lib/storage";

const router = useRouter();

const profile = ref(null);
const loading = ref(true);
const loadError = ref("");
const saving = ref(false);
const logoutLoading = ref(false);
const showEditor = ref(false);
const headerSearch=ref("");
const headerDepartment=ref("Todos");

const form = ref({
    fullName: "",
    phone: ""
});

const photoFile = ref(null);
const photoPreview = ref("");

const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

const initials = computed(function () {
    const name =
        profile.value?.fullName ||
        "Cliente Thrive";

    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(function (word) {
            return word
                .charAt(0)
                .toUpperCase();
        })
        .join("");
});

async function loadProfile() {
    loading.value = true;
    loadError.value = "";

    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (
            userError ||
            !user
        ) {
            router.replace({
                name: "Access"
            });
            return;
        }

        const { data, error } =
            await supabase
                .from("profiles")
                .select(`
                    id,
                    full_name,
                    phone,
                    avatar_url,
                    user_type,
                    created_at
                `)
                .eq("id", user.id)
                .single();

        if (error) {
            throw error;
        }

        profile.value = {
            id:
                data.id,
            fullName:
                data.full_name ||
                "Cliente Thrive",
            phone:
                data.phone ||
                "",
            avatarUrl:
                data.avatar_url ||
                "",
            email:
                user.email ||
                "",
            createdAt:
                data.created_at
        };
    } catch (error) {
        console.error(
            "Error al cargar el perfil del cliente:",
            error
        );

        loadError.value =
            "No fue posible cargar tu perfil.";
    } finally {
        loading.value = false;
    }
}

function clearPasswordFields() {
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
    showCurrentPassword.value = false;
    showNewPassword.value = false;
    showConfirmPassword.value = false;
}

function openEditor() {
    if (!profile.value) return;

    form.value = {
        fullName:
            profile.value.fullName ||
            "",
        phone:
            profile.value.phone ||
            ""
    };

    photoFile.value = null;
    photoPreview.value =
        profile.value.avatarUrl ||
        "";

    clearPasswordFields();

    showEditor.value = true;
    document.body.style.overflow =
        "hidden";
}

function closeEditor() {
    showEditor.value = false;
    photoFile.value = null;
    photoPreview.value = "";
    clearPasswordFields();
    document.body.style.overflow = "";
}

function handlePhoto(event) {
    const file =
        event.target.files?.[0];

    if (!file) return;

    if (
        !file.type.startsWith(
            "image/"
        )
    ) {
        alert(
            "Selecciona una imagen válida."
        );
        event.target.value = "";
        return;
    }

    if (
        file.size >
        5 * 1024 * 1024
    ) {
        alert(
            "La fotografía no puede superar los 5 MB."
        );
        event.target.value = "";
        return;
    }

    photoFile.value = file;

    const reader =
        new FileReader();

    reader.onload =
        function (loadEvent) {
            photoPreview.value =
                loadEvent.target.result;
        };

    reader.readAsDataURL(file);
}

async function saveProfile() {
    if (
        saving.value ||
        !profile.value
    ) {
        return;
    }

    if (
        !form.value.fullName.trim()
    ) {
        alert(
            "Escribe tu nombre antes de guardar."
        );
        return;
    }

    saving.value = true;

    let uploadedPhoto = null;

    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (
            userError ||
            !user?.email
        ) {
            throw new Error(
                "No fue posible verificar tu sesión."
            );
        }

        const wantsPasswordChange =
            currentPassword.value ||
            newPassword.value ||
            confirmPassword.value;

        if (wantsPasswordChange) {
            if (
                !currentPassword.value ||
                !newPassword.value ||
                !confirmPassword.value
            ) {
                alert(
                    "Completa los tres campos de contraseña."
                );
                return;
            }

            if (
                newPassword.value.length <
                8
            ) {
                alert(
                    "La nueva contraseña debe tener al menos 8 caracteres."
                );
                return;
            }

            if (
                newPassword.value !==
                confirmPassword.value
            ) {
                alert(
                    "Las nuevas contraseñas no coinciden."
                );
                return;
            }

            const { error } =
                await supabase.auth
                    .signInWithPassword({
                        email:
                            user.email,
                        password:
                            currentPassword.value
                    });

            if (error) {
                alert(
                    "La contraseña actual es incorrecta."
                );
                return;
            }
        }

        const oldPhotoPath =
            getStoragePathFromPublicUrl(
                profile.value.avatarUrl
            );

        let avatarUrl =
            profile.value.avatarUrl ||
            null;

        if (photoFile.value) {
            uploadedPhoto =
                await uploadProfileImage(
                    user.id,
                    photoFile.value
                );

            avatarUrl =
                uploadedPhoto.publicUrl;
        }

        const { data, error } =
            await supabase
                .from("profiles")
                .update({
                    full_name:
                        form.value.fullName.trim(),
                    phone:
                        form.value.phone.trim(),
                    avatar_url:
                        avatarUrl
                })
                .eq("id", user.id)
                .select(`
                    full_name,
                    phone,
                    avatar_url
                `)
                .single();

        if (error) {
            throw error;
        }

        if (
            uploadedPhoto?.path &&
            oldPhotoPath &&
            uploadedPhoto.path !==
            oldPhotoPath
        ) {
            try {
                await deleteImage(
                    oldPhotoPath
                );
            } catch (deleteError) {
                console.warn(
                    "No se pudo borrar la fotografía anterior:",
                    deleteError
                );
            }
        }

        if (wantsPasswordChange) {
            const { error } =
                await supabase.auth
                    .updateUser({
                        password:
                            newPassword.value
                    });

            if (error) {
                throw error;
            }
        }

        profile.value = {
            ...profile.value,
            fullName:
                data.full_name ||
                "",
            phone:
                data.phone ||
                "",
            avatarUrl:
                data.avatar_url ||
                ""
        };

        alert(
            "Perfil actualizado correctamente."
        );

        closeEditor();
    } catch (error) {
        console.error(
            "Error al guardar el perfil del cliente:",
            error
        );

        if (
            uploadedPhoto?.path
        ) {
            try {
                await deleteImage(
                    uploadedPhoto.path
                );
            } catch {
                // La limpieza no debe ocultar el error principal.
            }
        }

        alert(
            "No fue posible guardar los cambios: " +
            (
                error.message ||
                "Error inesperado"
            )
        );
    } finally {
        saving.value = false;
    }
}

function goCatalog() {
    router.push({
        name: "Catalog"
    });
}

// Desde el perfil, la búsqueda y los departamentos vuelven al catálogo ya filtrado.
function searchFromHeader() {
    const query={};
    if(headerSearch.value.trim()) query.q=headerSearch.value.trim();
    if(headerDepartment.value!=="Todos") query.department=headerDepartment.value;
    router.push({name:"Catalog",query});
}
function changeHeaderDepartment(value) {
    headerDepartment.value=value;
    const query={};
    if(headerSearch.value.trim()) query.q=headerSearch.value.trim();
    if(value!=="Todos") query.department=value;
    router.push({name:"Catalog",query});
}

function goFavorites() {
    router.push({
        name: "Catalog",
        query: {
            mode: "favorites"
        }
    });
}

async function logout() {
    if (logoutLoading.value) return;

    logoutLoading.value = true;

    try {
        const { error } =
            await supabase.auth.signOut({
                scope: "local"
            });

        if (error) {
            throw error;
        }

        document.body.style.overflow = "";

        router.replace({
            name: "Access"
        });
    } catch (error) {
        console.error(
            "Error al cerrar sesión:",
            error
        );

        alert(
            "No fue posible cerrar la sesión."
        );
    } finally {
        logoutLoading.value = false;
    }
}

function handleEscape(event) {
    if (
        event.key === "Escape" &&
        showEditor.value
    ) {
        closeEditor();
    }
}

onMounted(function () {
    loadProfile();

    document.addEventListener(
        "keydown",
        handleEscape
    );
});

onBeforeUnmount(function () {
    document.removeEventListener(
        "keydown",
        handleEscape
    );

    document.body.style.overflow = "";
});
</script>

<template>
<div class="min-h-screen bg-[#F8FBFC] pb-[76px] text-gray-700 lg:pb-10">
    <CustomerHeader v-model="headerSearch" :department="headerDepartment" active="profile" search-placeholder="Buscar productos, emprendimientos o categorías" @search-submit="searchFromHeader" @update:department="changeHeaderDepartment"/>

    <main
        v-if="loading"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center"
    >
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>

        <p class="mt-4 text-sm font-semibold text-gray-400">
            Cargando tu perfil...
        </p>
    </main>

    <main
        v-else-if="loadError"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center"
    >
        <p class="font-black text-gray-700">
            {{ loadError }}
        </p>

        <button
            type="button"
            class="mt-5 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white"
            @click="loadProfile"
        >
            Intentar nuevamente
        </button>
    </main>

    <main
        v-else-if="profile"
        class="mx-auto max-w-[1450px] px-3 pb-10 pt-4 sm:px-5 lg:px-8 lg:pt-6"
    >
        <section class="rounded-[24px] bg-white p-5 shadow-sm sm:p-7">
            <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div class="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
                    <img
                        v-if="profile.avatarUrl"
                        :src="profile.avatarUrl"
                        :alt="profile.fullName"
                        class="h-24 w-24 rounded-full border-4 border-[#CAF0F8] object-cover sm:h-28 sm:w-28"
                    >

                    <div
                        v-else
                        class="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#CAF0F8] bg-[#EAF9FC] text-2xl font-black text-[#0077B6] sm:h-28 sm:w-28"
                    >
                        {{ initials }}
                    </div>

                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Perfil del cliente
                        </p>

                        <h1 class="mt-1 text-2xl font-black text-gray-700 sm:text-3xl">
                            {{ profile.fullName }}
                        </h1>

                        <p class="mt-1 text-sm text-gray-400">
                            {{ profile.email }}
                        </p>

                        <p class="mt-1 text-sm text-gray-400">
                            {{ profile.phone || "Teléfono no registrado" }}
                        </p>
                    </div>
                </div>

                <div class="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                    <button
                        type="button"
                        class="w-full rounded-xl border border-[#00B4D8] px-5 py-3 text-sm font-bold text-[#0077B6] transition hover:bg-[#CAF0F8] lg:w-auto"
                        @click="openEditor"
                    >
                        Editar perfil
                    </button>

                    <button
                        type="button"
                        :disabled="logoutLoading"
                        class="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-60 lg:w-auto"
                        @click="logout"
                    >
                        <svg
                            class="h-5 w-5"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            viewBox="0 0 24 24"
                        >
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 012 2v12a2 2 0 01-2 2h-5"
                            ></path>
                        </svg>

                        {{ logoutLoading ? "Cerrando..." : "Cerrar sesión" }}
                    </button>
                </div>
            </div>
        </section>

        <section class="mt-5 grid gap-4 md:grid-cols-2">
            <article class="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                    Mi cuenta
                </p>

                <div class="mt-3 space-y-3 text-sm text-gray-500">
                    <p>
                        <span class="font-bold text-gray-600">
                            Tipo de cuenta:
                        </span>

                        Cliente
                    </p>

                    <p>
                        <span class="font-bold text-gray-600">
                            Correo:
                        </span>

                        {{ profile.email }}
                    </p>
                </div>
            </article>

            <article class="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                    Accesos rápidos
                </p>

                <div class="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        class="rounded-xl bg-[#CAF0F8] px-4 py-3 text-sm font-bold text-[#0077B6]"
                        @click="goCatalog"
                    >
                        Explorar productos
                    </button>

                    <button
                        type="button"
                        class="rounded-xl bg-[#CAF0F8] px-4 py-3 text-sm font-bold text-[#0077B6]"
                        @click="goFavorites"
                    >
                        Ver favoritos
                    </button>
                </div>
            </article>
        </section>
    </main>



    <!-- Editor del cliente. -->
    <Teleport to="body">
        <div
            v-if="showEditor"
            class="fixed inset-0 z-[130] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
            @click.self="closeEditor"
        >
            <section class="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[680px] sm:rounded-[28px]">
                <div class="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Mi cuenta
                        </p>

                        <h2 class="text-lg font-black text-gray-700">
                            Editar perfil
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                        @click="closeEditor"
                    >
                        ×
                    </button>
                </div>

                <form
                    class="space-y-5 p-5 sm:p-7"
                    @submit.prevent="saveProfile"
                >
                    <div>
                        <label class="block text-sm font-bold text-gray-600">
                            Fotografía
                        </label>

                        <div class="mt-3 flex flex-col items-center gap-4 sm:flex-row">
                            <img
                                v-if="photoPreview"
                                :src="photoPreview"
                                alt="Fotografía del cliente"
                                class="h-24 w-24 rounded-full border-4 border-[#CAF0F8] object-cover"
                            >

                            <div
                                v-else
                                class="flex h-24 w-24 items-center justify-center rounded-full bg-[#CAF0F8] text-xl font-black text-[#0077B6]"
                            >
                                {{ initials }}
                            </div>

                            <label class="cursor-pointer rounded-xl border border-[#00B4D8] px-4 py-2.5 text-sm font-bold text-[#0077B6] hover:bg-[#CAF0F8]">
                                Cambiar foto

                                <input
                                    type="file"
                                    accept="image/*"
                                    class="hidden"
                                    @change="handlePhoto"
                                >
                            </label>
                        </div>
                    </div>

                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Nombre completo
                        </label>

                        <input
                            v-model="form.fullName"
                            required
                            type="text"
                            autocomplete="name"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                    </div>

                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Correo electrónico
                        </label>

                        <input
                            :value="profile.email"
                            disabled
                            type="email"
                            class="w-full cursor-not-allowed rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-gray-400 outline-none"
                        >
                    </div>

                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Teléfono
                        </label>

                        <input
                            v-model="form.phone"
                            type="tel"
                            autocomplete="tel"
                            placeholder="0000 0000"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                    </div>

                    <div class="border-t border-gray-100 pt-5">
                        <h3 class="font-black text-gray-700">
                            Cambiar contraseña
                        </h3>

                        <p class="mt-1 text-xs text-gray-400">
                            Deja los campos vacíos si no deseas cambiarla.
                        </p>

                        <div class="mt-4 space-y-3">
                            <div class="relative">
                                <input
                                    v-model="currentPassword"
                                    :type="showCurrentPassword ? 'text' : 'password'"
                                    placeholder="Contraseña actual"
                                    class="w-full rounded-xl border border-gray-200 px-4 py-3 pr-20 outline-none focus:border-[#00B4D8]"
                                >

                                <button
                                    type="button"
                                    class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-2 text-[10px] font-bold text-gray-400 hover:bg-gray-100"
                                    @click="showCurrentPassword = !showCurrentPassword"
                                >
                                    {{ showCurrentPassword ? "Ocultar" : "Ver" }}
                                </button>
                            </div>

                            <div class="relative">
                                <input
                                    v-model="newPassword"
                                    :type="showNewPassword ? 'text' : 'password'"
                                    placeholder="Nueva contraseña"
                                    class="w-full rounded-xl border border-gray-200 px-4 py-3 pr-20 outline-none focus:border-[#00B4D8]"
                                >

                                <button
                                    type="button"
                                    class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-2 text-[10px] font-bold text-gray-400 hover:bg-gray-100"
                                    @click="showNewPassword = !showNewPassword"
                                >
                                    {{ showNewPassword ? "Ocultar" : "Ver" }}
                                </button>
                            </div>

                            <div class="relative">
                                <input
                                    v-model="confirmPassword"
                                    :type="showConfirmPassword ? 'text' : 'password'"
                                    placeholder="Confirmar nueva contraseña"
                                    class="w-full rounded-xl border border-gray-200 px-4 py-3 pr-20 outline-none focus:border-[#00B4D8]"
                                >

                                <button
                                    type="button"
                                    class="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-2 text-[10px] font-bold text-gray-400 hover:bg-gray-100"
                                    @click="showConfirmPassword = !showConfirmPassword"
                                >
                                    {{ showConfirmPassword ? "Ocultar" : "Ver" }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        :disabled="saving"
                        class="w-full rounded-xl bg-[#00B4D8] px-5 py-3.5 font-bold text-white disabled:opacity-50"
                    >
                        {{ saving ? "Guardando..." : "Guardar cambios" }}
                    </button>
                </form>
            </section>
        </div>
    </Teleport>
</div>
</template>

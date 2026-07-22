<script setup>
// Perfil institucional y editor de cuenta.
import { ref, computed, onBeforeUnmount } from "vue";
import { supabase } from "../../lib/supabaseClient";
import {
    uploadInstitutionLogo,
    deleteInstitutionImages,
    getInstitutionStoragePath
} from "../../lib/orgStorage";
const props = defineProps({
    institution: {
        type: Object,
        required: true
    },
    logoutLoading: {
        type: Boolean,
        default: false
    }
});
const emit = defineEmits([
    "updated",
    "logout"
]);
const showEditor = ref(false);
const saving = ref(false);
const logoFile = ref(null);
const logoPreview = ref("");
const form = ref({
    institutionName: "",
    phone: "",
    website: "",
    description: "",
    department: "",
    district: ""
});
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const departments = [
    "Ahuachapán",
    "Cabañas",
    "Chalatenango",
    "Cuscatlán",
    "La Libertad",
    "La Paz",
    "La Unión",
    "Morazán",
    "San Miguel",
    "San Salvador",
    "San Vicente",
    "Santa Ana",
    "Sonsonate",
    "Usulután"
];
const initials = computed(function () {
    return props.institution.institutionName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(function (word) {
            return word.charAt(0).toUpperCase();
        })
        .join("");
});
function clearPasswordFields() {
    currentPassword.value = "";
    newPassword.value = "";
    confirmPassword.value = "";
}
function openEditor() {
    form.value = {
        institutionName:
            props.institution.institutionName || "",
        phone:
            props.institution.phone || "",
        website:
            props.institution.website || "",
        description:
            props.institution.description || "",
        department:
            props.institution.department || "",
        district:
            props.institution.district || ""
    };
    logoFile.value = null;
    logoPreview.value =
        props.institution.logoUrl || "";
    clearPasswordFields();
    showEditor.value = true;
    document.body.style.overflow = "hidden";
}
function closeEditor() {
    showEditor.value = false;
    logoFile.value = null;
    logoPreview.value = "";
    clearPasswordFields();
    document.body.style.overflow = "";
}
function handleLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        alert("Selecciona una imagen válida.");
        event.target.value = "";
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        alert("La imagen no puede superar los 5 MB.");
        event.target.value = "";
        return;
    }
    logoFile.value = file;
    const reader = new FileReader();
    reader.onload = function (loadEvent) {
        logoPreview.value = loadEvent.target.result;
    };
    reader.readAsDataURL(file);
}
async function saveProfile() {
    if (saving.value) return;
    if (!form.value.institutionName.trim()) {
        alert("Escribe el nombre de la institución.");
        return;
    }
    saving.value = true;
    let uploadedLogo = null;
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
                "No fue posible verificar la sesión."
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
            if (newPassword.value.length < 8) {
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
            const { error } = await supabase.auth
                .signInWithPassword({
                    email: user.email,
                    password: currentPassword.value
                });
            if (error) {
                alert(
                    "La contraseña actual es incorrecta."
                );
                return;
            }
        }
        const oldLogoPath =
            getInstitutionStoragePath(
                props.institution.logoUrl
            );
        let logoUrl =
            props.institution.logoUrl || null;
        if (logoFile.value) {
            uploadedLogo =
                await uploadInstitutionLogo(
                    user.id,
                    logoFile.value
                );
            logoUrl = uploadedLogo.publicUrl;
        }
        const { data, error } = await supabase
            .from("institutions")
            .update({
                institution_name:
                    form.value.institutionName.trim(),
                description:
                    form.value.description.trim(),
                website:
                    form.value.website.trim() || null,
                department:
                    form.value.department || null,
                district:
                    form.value.district.trim() || null,
                logo_url: logoUrl
            })
            .eq("id", user.id)
            .select()
            .single();
        if (error) throw error;
        const { error: profileError } = await supabase
            .from("profiles")
            .update({
                full_name:
                    form.value.institutionName.trim(),
                phone:
                    form.value.phone.trim(),
                avatar_url: logoUrl
            })
            .eq("id", user.id);
        if (profileError) throw profileError;
        if (
            uploadedLogo?.path &&
            oldLogoPath &&
            uploadedLogo.path !== oldLogoPath
        ) {
            try {
                await deleteInstitutionImages([
                    oldLogoPath
                ]);
            } catch (deleteError) {
                console.warn(
                    "No se pudo borrar el logo anterior:",
                    deleteError
                );
            }
        }
        if (wantsPasswordChange) {
            const { error: passwordError } =
                await supabase.auth.updateUser({
                    password: newPassword.value
                });
            if (passwordError) throw passwordError;
        }
        emit("updated", {
            institutionName: data.institution_name,
            description: data.description || "",
            website: data.website || "",
            department: data.department || "",
            district: data.district || "",
            logoUrl: data.logo_url || "",
            phone: form.value.phone.trim()
        });
        alert("Perfil institucional actualizado.");
        closeEditor();
    } catch (error) {
        console.error(
            "Error al guardar el perfil institucional:",
            error
        );
        if (uploadedLogo?.path) {
            try {
                await deleteInstitutionImages([
                    uploadedLogo.path
                ]);
            } catch {
                // La limpieza no debe ocultar el error principal.
            }
        }
        alert(
            "No fue posible guardar los cambios: " +
            (error.message || "Error inesperado")
        );
    } finally {
        saving.value = false;
    }
}
onBeforeUnmount(function () {
    document.body.style.overflow = "";
});
</script>
<template>
<section>
    <section class="rounded-[24px] bg-white p-5 shadow-sm sm:p-7">
        <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div class="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
                <img
                    v-if="institution.logoUrl"
                    :src="institution.logoUrl"
                    :alt="institution.institutionName"
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
                        Perfil institucional
                    </p>
                    <h1 class="mt-1 text-2xl font-black text-gray-700 sm:text-3xl">
                        {{ institution.institutionName }}
                    </h1>
                    <p class="mt-1 text-sm text-gray-400">
                        {{ institution.email }}
                    </p>
                    <p class="mt-1 text-sm text-gray-400">
                        {{ institution.phone || "Teléfono no registrado" }}
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
                    @click="emit('logout')"
                >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 012 2v12a2 2 0 01-2 2h-5"></path>
                    </svg>
                    {{ logoutLoading ? "Cerrando..." : "Cerrar sesión" }}
                </button>
            </div>
        </div>
    </section>
    <section class="mt-5 grid gap-4 md:grid-cols-2">
        <article class="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
            <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                Acerca de la institución
            </p>
            <p class="mt-3 whitespace-pre-line text-sm leading-7 text-gray-500">
                {{ institution.description || "Sin descripción institucional." }}
            </p>
        </article>
        <article class="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
            <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                Información
            </p>
            <div class="mt-3 space-y-3 text-sm text-gray-500">
                <p>
                    <span class="font-bold text-gray-600">
                        Ubicación:
                    </span>
                    {{ institution.district || institution.department || "No registrada" }}
                </p>
                <p>
                    <span class="font-bold text-gray-600">
                        Sitio web:
                    </span>
                    <a
                        v-if="institution.website"
                        :href="institution.website"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="font-bold text-[#0077B6]"
                    >
                        {{ institution.website }}
                    </a>
                    <span v-else>
                        No registrado
                    </span>
                </p>
            </div>
        </article>
    </section>
    <!-- Editor con el mismo estilo del perfil del emprendedor. -->
    <Teleport to="body">
        <div
            v-if="showEditor"
            class="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
            @click.self="closeEditor"
        >
            <section class="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[620px] sm:rounded-[28px]">
                <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Mi institución
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
                        <label class="mb-3 block text-sm font-bold text-gray-600">
                            Foto de la institución
                        </label>
                        <div class="flex flex-col items-center gap-4 sm:flex-row">
                            <img
                                v-if="logoPreview"
                                :src="logoPreview"
                                alt="Foto de la institución"
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
                                    @change="handleLogo"
                                >
                            </label>
                        </div>
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Nombre de la institución
                        </label>
                        <input
                            v-model="form.institutionName"
                            required
                            type="text"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Correo electrónico
                        </label>
                        <input
                            :value="institution.email"
                            disabled
                            type="email"
                            class="w-full cursor-not-allowed rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-gray-400"
                        >
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Teléfono
                        </label>
                        <input
                            v-model="form.phone"
                            type="tel"
                            placeholder="0000 0000"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Sitio web
                        </label>
                        <input
                            v-model="form.website"
                            type="url"
                            placeholder="https://..."
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                    </div>
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Descripción
                        </label>
                        <textarea
                            v-model="form.description"
                            rows="4"
                            class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        ></textarea>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Departamento
                            </label>
                            <select
                                v-model="form.department"
                                class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                                <option value="">
                                    Seleccionar
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
                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Distrito
                            </label>
                            <input
                                v-model="form.district"
                                type="text"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>
                    </div>
                    <div class="border-t border-gray-100 pt-5">
                        <h3 class="font-black text-gray-700">
                            Cambiar contraseña
                        </h3>
                        <p class="mt-1 text-xs text-gray-400">
                            Deja estos campos vacíos si no deseas cambiarla.
                        </p>
                        <div class="mt-4 space-y-3">
                            <input
                                v-model="currentPassword"
                                type="password"
                                autocomplete="current-password"
                                placeholder="Contraseña actual"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                            <input
                                v-model="newPassword"
                                type="password"
                                autocomplete="new-password"
                                placeholder="Nueva contraseña"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                            <input
                                v-model="confirmPassword"
                                type="password"
                                autocomplete="new-password"
                                placeholder="Confirmar nueva contraseña"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>
                    </div>
                    <button
                        type="submit"
                        :disabled="saving"
                        class="w-full rounded-xl bg-[#00B4D8] px-5 py-3 font-bold text-white disabled:opacity-50"
                    >
                        {{ saving ? "Guardando..." : "Guardar cambios" }}
                    </button>
                </form>
            </section>
        </div>
    </Teleport>
</section>
</template>

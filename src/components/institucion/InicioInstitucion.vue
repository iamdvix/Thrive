<script setup>
// Resumen del panel institucional.
import {
    ref,
    computed,
    onMounted
} from "vue";
import { supabase } from "../../lib/supabaseClient";

const props = defineProps({
    institution: {
        type: Object,
        required: true
    }
});

const emit = defineEmits([
    "change-section"
]);

const loading = ref(true);
const posts = ref([]);
const entrepreneurCount = ref(0);

const publishedCount = computed(function () {
    return posts.value.filter(function (post) {
        return post.status === "published";
    }).length;
});

const draftCount = computed(function () {
    return posts.value.filter(function (post) {
        return post.status === "draft";
    }).length;
});

const upcomingCount = computed(function () {
    const now = Date.now();

    return posts.value.filter(function (post) {
        return (
            post.status === "published" &&
            post.eventDate &&
            new Date(post.eventDate).getTime() >= now
        );
    }).length;
});

const recentPosts = computed(function () {
    return posts.value.slice(0, 4);
});

function isInformativeType(type) {
    return [
        "noticia",
        "anuncio"
    ].includes(type);
}

function formatDate(date) {
    if (!date) return "";

    return new Intl.DateTimeFormat(
        "es-SV",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    ).format(new Date(date));
}

function typeLabel(type) {
    const labels = {
        noticia: "Noticia",
        taller: "Taller",
        evento: "Evento",
        convocatoria: "Convocatoria",
        oportunidad: "Oportunidad",
        anuncio: "Anuncio"
    };

    return labels[type] || "Publicación";
}

function statusClasses(status) {
    if (status === "published") {
        return "bg-green-100 text-green-700";
    }

    if (status === "archived") {
        return "bg-gray-100 text-gray-600";
    }

    return "bg-amber-100 text-amber-700";
}

function cardDate(post) {
    if (isInformativeType(post.postType)) {
        return "";
    }

    return formatDate(
        post.eventDate ||
        post.createdAt
    );
}

async function loadSummary() {
    loading.value = true;

    try {
        const {
            data: postRows,
            error: postError
        } = await supabase
            .from("institution_posts")
            .select(`
                id,
                title,
                description,
                post_type,
                event_date,
                requires_registration,
                available_spots,
                status,
                created_at
            `)
            .eq(
                "institution_id",
                props.institution.id
            )
            .order("created_at", {
                ascending: false
            });

        if (postError) {
            throw postError;
        }

        const rows =
            postRows || [];

        const postIds =
            rows.map(function (post) {
                return post.id;
            });

        let imageRows = [];

        if (postIds.length) {
            const {
                data,
                error
            } = await supabase
                .from("institution_post_images")
                .select(`
                    post_id,
                    image_url,
                    sort_order
                `)
                .in("post_id", postIds)
                .order("sort_order", {
                    ascending: true
                });

            if (error) {
                throw error;
            }

            imageRows =
                data || [];
        }

        posts.value =
            rows.map(function (post) {
                const cover =
                    imageRows.find(
                        function (image) {
                            return (
                                image.post_id ===
                                post.id
                            );
                        }
                    );

                return {
                    id:
                        post.id,
                    title:
                        post.title,
                    description:
                        post.description,
                    postType:
                        post.post_type,
                    eventDate:
                        post.event_date,
                    requiresRegistration:
                        post.requires_registration,
                    availableSpots:
                        post.available_spots,
                    status:
                        post.status,
                    createdAt:
                        post.created_at,
                    cover:
                        cover?.image_url ||
                        ""
                };
            });

        const {
            count,
            error: countError
        } = await supabase
            .from("entrepreneurs")
            .select("id", {
                count: "exact",
                head: true
            });

        if (countError) {
            throw countError;
        }

        entrepreneurCount.value =
            count || 0;
    } catch (error) {
        console.error(
            "Error al cargar el resumen institucional:",
            error
        );
    } finally {
        loading.value = false;
    }
}

onMounted(loadSummary);
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
                    {{ institution.institutionName.charAt(0).toUpperCase() }}
                </div>

                <div>
                    <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                        Mi institución
                    </p>
                    <h1 class="mt-1 text-2xl font-black text-gray-700 sm:text-3xl">
                        {{ institution.institutionName }}
                    </h1>
                    <p class="mt-1 text-sm text-gray-400">
                        {{ institution.district || institution.department || "Ubicación no registrada" }}
                    </p>
                    <p class="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
                        {{ institution.description || "Agrega una descripción para presentar tu institución." }}
                    </p>
                </div>
            </div>

            <div class="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                <button
                    type="button"
                    class="w-full rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#009CC0] lg:w-auto"
                    @click="emit('change-section', 'publicaciones')"
                >
                    Crear publicación
                </button>
            </div>
        </div>
    </section>

    <section class="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article class="rounded-[22px] bg-white p-4 shadow-sm sm:p-5">
            <p class="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">
                Publicadas
            </p>
            <p class="mt-2 text-3xl font-black text-[#0077B6]">
                {{ loading ? "—" : publishedCount }}
            </p>
        </article>

        <article class="rounded-[22px] bg-white p-4 shadow-sm sm:p-5">
            <p class="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">
                Borradores
            </p>
            <p class="mt-2 text-3xl font-black text-amber-500">
                {{ loading ? "—" : draftCount }}
            </p>
        </article>

        <article class="rounded-[22px] bg-white p-4 shadow-sm sm:p-5">
            <p class="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">
                Próximos eventos
            </p>
            <p class="mt-2 text-3xl font-black text-[#00B4D8]">
                {{ loading ? "—" : upcomingCount }}
            </p>
        </article>

        <article class="rounded-[22px] bg-white p-4 shadow-sm sm:p-5">
            <p class="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">
                Emprendedores
            </p>
            <p class="mt-2 text-3xl font-black text-[#4F7180]">
                {{ loading ? "—" : entrepreneurCount }}
            </p>
        </article>
    </section>

    <section class="mt-7">
        <div class="mb-5 flex items-end justify-between gap-3">
            <div>
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                    Actividad reciente
                </p>
                <h2 class="mt-1 text-2xl font-black text-gray-700">
                    Últimas publicaciones
                </h2>
            </div>

            <button
                type="button"
                class="text-sm font-bold text-[#0077B6]"
                @click="emit('change-section', 'publicaciones')"
            >
                Ver todas
            </button>
        </div>

        <div
            v-if="loading"
            class="rounded-[24px] bg-white px-5 py-16 text-center shadow-sm"
        >
            <div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        </div>

        <div
            v-else-if="recentPosts.length"
            class="grid grid-cols-2 gap-x-2 gap-y-5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
        >
            <article
                v-for="post in recentPosts"
                :key="post.id"
                class="min-w-0 overflow-hidden"
            >
                <div class="relative overflow-hidden rounded-2xl bg-[#EAF9FC] shadow-sm">
                    <img
                        v-if="post.cover"
                        :src="post.cover"
                        :alt="post.title"
                        class="aspect-square w-full object-cover"
                    >

                    <div
                        v-else
                        class="flex aspect-square items-center justify-center bg-gradient-to-br from-[#CAF0F8] to-[#EAF9FC] text-xs font-bold text-[#0077B6]"
                    >
                        {{ typeLabel(post.postType) }}
                    </div>

                    <span
                        v-if="post.requiresRegistration && post.availableSpots !== null"
                        class="absolute right-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black text-green-700"
                    >
                        {{ post.availableSpots }} cupos
                    </span>
                </div>

                <div class="pt-3 sm:px-1">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-[9px] font-bold uppercase text-[#00B4D8]">
                            {{ typeLabel(post.postType) }}
                        </span>

                        <span
                            class="rounded-full px-2 py-1 text-[9px] font-bold"
                            :class="statusClasses(post.status)"
                        >
                            {{ post.status === "published" ? "Publicado" : post.status === "archived" ? "Archivado" : "Borrador" }}
                        </span>
                    </div>

                    <h3 class="mt-2 line-clamp-2 min-h-[34px] text-xs font-bold leading-tight text-gray-600 sm:min-h-[40px] sm:text-sm">
                        {{ post.title }}
                    </h3>

                    <p
                        v-if="cardDate(post)"
                        class="mt-2 text-[10px] text-gray-400 sm:text-xs"
                    >
                        {{ cardDate(post) }}
                    </p>
                </div>
            </article>
        </div>

        <div
            v-else
            class="rounded-[24px] border border-dashed border-[#90E0EF] bg-white px-5 py-16 text-center"
        >
            <h3 class="font-black text-gray-700">
                Aún no tienes publicaciones
            </h3>
            <p class="mt-1 text-sm text-gray-400">
                Crea la primera novedad para los emprendedores.
            </p>
        </div>
    </section>
</section>
</template>
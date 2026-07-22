<script setup>
// Muestra al emprendedor las novedades publicadas por instituciones.
import {
    ref,
    computed,
    onMounted,
    onBeforeUnmount
} from "vue";
import { supabase } from "../../lib/supabaseClient";
import NewsModal from "../shared/NewsModal.vue";
const posts = ref([]);
const loading = ref(true);
const loadError = ref("");
const searchText = ref("");
const selectedType = ref("todos");
const selectedPost = ref(null);
const showDetail = ref(false);
const postTypes = [
    ["todos", "Todo"],
    ["noticia", "Noticias"],
    ["taller", "Talleres"],
    ["evento", "Eventos"],
    ["convocatoria", "Convocatorias"],
    ["oportunidad", "Oportunidades"],
    ["anuncio", "Anuncios"]
];
const filteredPosts = computed(function () {
    const search =
        searchText.value
            .trim()
            .toLowerCase();
    return posts.value.filter(function (post) {
        const matchesType =
            selectedType.value === "todos" ||
            post.postType === selectedType.value;
        const matchesSearch =
            !search ||
            [
                post.title,
                post.description,
                post.location,
                post.institutionName
            ]
                .join(" ")
                .toLowerCase()
                .includes(search);
        return (
            matchesType &&
            matchesSearch
        );
    });
});
function typeLabel(type) {
    return (
        postTypes.find(function (item) {
            return item[0] === type;
        })?.[1] ||
        "Publicación"
    );
}
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
    ).format(
        new Date(date)
    );
}
function cardDate(post) {
    if (
        isInformativeType(
            post.postType
        )
    ) {
        return "";
    }
    if (post.eventDate) {
        return formatDate(
            post.eventDate
        );
    }
    if (post.deadline) {
        return `Hasta ${formatDate(
            post.deadline
        )}`;
    }
    return formatDate(
        post.publishedAt
    );
}
async function loadPosts() {
    loading.value = true;
    loadError.value = "";
    try {
        const {
            data: postRows,
            error: postError
        } = await supabase
            .from("institution_posts")
            .select(`
                id,
                institution_id,
                title,
                description,
                post_type,
                location,
                external_url,
                event_date,
                event_end_date,
                deadline,
                requires_registration,
                available_spots,
                contact_phone,
                published_at,
                created_at
            `)
            .eq("status", "published")
            .order("published_at", {
                ascending: false,
                nullsFirst: false
            });
        if (postError) {
            throw postError;
        }
        const rows =
            postRows || [];
        if (!rows.length) {
            posts.value = [];
            return;
        }
        const postIds =
            rows.map(function (post) {
                return post.id;
            });
        const institutionIds = [
            ...new Set(
                rows.map(function (post) {
                    return post.institution_id;
                })
            )
        ];
        const [
            imageResponse,
            institutionResponse
        ] = await Promise.all([
            supabase
                .from("institution_post_images")
                .select(`
                    id,
                    post_id,
                    image_url,
                    sort_order
                `)
                .in("post_id", postIds)
                .order("sort_order", {
                    ascending: true
                }),
            supabase
                .from("institutions")
                .select(`
                    id,
                    institution_name,
                    logo_url
                `)
                .in("id", institutionIds)
        ]);
        if (imageResponse.error) {
            throw imageResponse.error;
        }
        if (institutionResponse.error) {
            throw institutionResponse.error;
        }
        const imageRows =
            imageResponse.data || [];
        const institutionRows =
            institutionResponse.data || [];
        posts.value =
            rows.map(function (post) {
                const institution =
                    institutionRows.find(
                        function (item) {
                            return (
                                item.id ===
                                post.institution_id
                            );
                        }
                    );
                const images =
                    imageRows
                        .filter(
                            function (image) {
                                return (
                                    image.post_id ===
                                    post.id
                                );
                            }
                        )
                        .map(
                            function (image) {
                                return {
                                    id:
                                        image.id,
                                    imageUrl:
                                        image.image_url
                                };
                            }
                        );
                return {
                    id:
                        post.id,
                    institutionId:
                        post.institution_id,
                    institutionName:
                        institution?.institution_name ||
                        "Institución Thrive",
                    institutionLogo:
                        institution?.logo_url ||
                        "",
                    title:
                        post.title,
                    description:
                        post.description,
                    postType:
                        post.post_type,
                    location:
                        post.location ||
                        "",
                    externalUrl:
                        post.external_url ||
                        "",
                    eventDate:
                        post.event_date,
                    eventEndDate:
                        post.event_end_date,
                    deadline:
                        post.deadline,
                    requiresRegistration:
                        post.requires_registration,
                    availableSpots:
                        post.available_spots,
                    contactPhone:
                        post.contact_phone ||
                        "",
                    publishedAt:
                        post.published_at ||
                        post.created_at,
                    images,
                    cover:
                        images[0]?.imageUrl ||
                        ""
                };
            });
    } catch (error) {
        console.error(
            "Error al cargar novedades:",
            error
        );
        loadError.value =
            "No fue posible cargar las novedades institucionales.";
    } finally {
        loading.value = false;
    }
}
function openDetail(post) {
    selectedPost.value = post;
    showDetail.value = true;
    document.body.style.overflow =
        "hidden";
}
function closeDetail() {
    showDetail.value = false;
    selectedPost.value = null;
    document.body.style.overflow = "";
}
function handleEscape(event) {
    if (
        event.key === "Escape" &&
        showDetail.value
    ) {
        closeDetail();
    }
}
onMounted(function () {
    loadPosts();
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
<section>
    <div class="mb-5">
        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
            Información para crecer
        </p>
        <h1 class="mt-1 text-2xl font-black text-gray-700 sm:text-3xl">
            Novedades
        </h1>
        <p class="mt-1 text-sm text-gray-400">
            Talleres, eventos, convocatorias y oportunidades de instituciones.
        </p>
    </div>
    <!-- Buscador y filtros. -->
    <section class="mb-6 rounded-[24px] bg-white p-3 shadow-sm sm:p-4">
        <div class="flex items-center gap-3 rounded-xl bg-[#F8FBFC] px-4 py-3">
            <svg class="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="7"></circle>
                <path stroke-linecap="round" d="M20 20l-3.5-3.5"></path>
            </svg>
            <input
                v-model="searchText"
                type="search"
                placeholder="Buscar novedades..."
                class="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
            >
        </div>
        <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
            <button
                v-for="type in postTypes"
                :key="type[0]"
                type="button"
                class="shrink-0 rounded-full px-4 py-2 text-xs font-bold transition"
                :class="selectedType === type[0] ? 'bg-[#00B4D8] text-white shadow-sm' : 'bg-[#CAF0F8] text-[#0077B6]'"
                @click="selectedType = type[0]"
            >
                {{ type[1] }}
            </button>
        </div>
    </section>
    <div
        v-if="loading"
        class="rounded-[24px] bg-white px-5 py-20 text-center shadow-sm"
    >
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        <p class="mt-4 text-sm font-semibold text-gray-400">
            Cargando novedades...
        </p>
    </div>
    <div
        v-else-if="loadError"
        class="rounded-[24px] bg-white px-5 py-16 text-center shadow-sm"
    >
        <p class="font-black text-gray-700">
            {{ loadError }}
        </p>
        <button
            type="button"
            class="mt-4 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white"
            @click="loadPosts"
        >
            Intentar nuevamente
        </button>
    </div>
    <!-- Tarjetas más llamativas, pero conservando el estilo del catálogo. -->
    <div
        v-else-if="filteredPosts.length"
        class="grid grid-cols-2 gap-x-2 gap-y-6 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
    >
        <article
            v-for="post in filteredPosts"
            :key="post.id"
            class="group min-w-0 overflow-hidden"
        >
            <button
                type="button"
                class="relative block w-full overflow-hidden rounded-2xl bg-[#EAF9FC] text-left shadow-sm"
                @click="openDetail(post)"
            >
                <img
                    v-if="post.cover"
                    :src="post.cover"
                    :alt="post.title"
                    class="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                >
                <div
                    v-else
                    class="flex aspect-square items-center justify-center bg-gradient-to-br from-[#CAF0F8] to-[#EAF9FC] text-xs font-black text-[#0077B6]"
                >
                    {{ typeLabel(post.postType) }}
                </div>
                <span class="absolute left-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black uppercase text-[#0077B6] shadow-sm backdrop-blur">
                    {{ typeLabel(post.postType) }}
                </span>
                <span
                    v-if="post.images.length > 1"
                    class="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-bold text-white"
                >
                    {{ post.images.length }} imágenes
                </span>
                <span
                    v-if="post.requiresRegistration && post.availableSpots !== null"
                    class="absolute right-2 top-2 rounded-full px-2.5 py-1 text-[9px] font-black shadow-sm"
                    :class="Number(post.availableSpots) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'"
                >
                    {{ Number(post.availableSpots) > 0 ? `${post.availableSpots} cupos` : "Lleno" }}
                </span>
            </button>
            <div class="pt-3 sm:px-1">
                <div class="flex items-center gap-2">
                    <img
                        v-if="post.institutionLogo"
                        :src="post.institutionLogo"
                        :alt="post.institutionName"
                        class="h-7 w-7 rounded-full border border-[#CAF0F8] object-cover"
                    >
                    <div
                        v-else
                        class="flex h-7 w-7 items-center justify-center rounded-full bg-[#CAF0F8] text-[9px] font-black text-[#0077B6]"
                    >
                        {{ post.institutionName.charAt(0).toUpperCase() }}
                    </div>
                    <p class="truncate text-[10px] font-bold text-gray-400 sm:text-xs">
                        {{ post.institutionName }}
                    </p>
                </div>
                <h2 class="mt-2 line-clamp-2 min-h-[34px] text-xs font-black leading-tight text-gray-600 sm:min-h-[40px] sm:text-sm">
                    {{ post.title }}
                </h2>
                <!-- Noticias y anuncios no muestran fechas. -->
                <p
                    v-if="cardDate(post)"
                    class="mt-2 text-[10px] font-semibold text-gray-400 sm:text-xs"
                >
                    {{ cardDate(post) }}
                </p>
                <button
                    type="button"
                    class="mt-3 w-full rounded-xl bg-[#CAF0F8] px-3 py-2.5 text-[10px] font-black text-[#0077B6] transition hover:bg-[#B8EAF4] sm:text-xs"
                    @click="openDetail(post)"
                >
                    Ver información
                </button>
            </div>
        </article>
    </div>
    <div
        v-else
        class="rounded-[24px] border border-dashed border-[#90E0EF] bg-white px-5 py-16 text-center"
    >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#CAF0F8] text-[#0077B6]">
            <svg class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                <path stroke-linejoin="round" d="M4 5h16v14H4z"></path>
                <path stroke-linecap="round" d="M8 9h8M8 13h8M8 17h5"></path>
            </svg>
        </div>
        <h3 class="mt-4 font-black text-gray-700">
            No encontramos novedades
        </h3>
        <p class="mt-1 text-sm text-gray-400">
            Las publicaciones institucionales aparecerán aquí.
        </p>
    </div>
    <NewsModal
        :show="showDetail"
        :post="selectedPost"
        @close="closeDetail"
    />
</section>
</template>

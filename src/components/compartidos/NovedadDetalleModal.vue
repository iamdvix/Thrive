<script setup>
// Vista compartida para que institución y emprendedor vean exactamente la misma publicación.
import {
    ref,
    computed,
    watch
} from "vue";

const props = defineProps({
    show: {
        type: Boolean,
        default: false
    },
    post: {
        type: Object,
        default: null
    },
    canManage: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits([
    "close",
    "edit",
    "delete"
]);

const currentImageIndex = ref(0);

const images = computed(function () {
    const source =
        props.post?.images ||
        props.post?.imageRecords ||
        [];

    return source
        .map(function (image) {
            if (typeof image === "string") {
                return {
                    id: image,
                    imageUrl: image
                };
            }

            return {
                id:
                    image.id ||
                    image.imageUrl,
                imageUrl:
                    image.imageUrl ||
                    image.image_url ||
                    ""
            };
        })
        .filter(function (image) {
            return Boolean(image.imageUrl);
        });
});

const currentImage = computed(function () {
    return (
        images.value[
            currentImageIndex.value
        ]?.imageUrl ||
        ""
    );
});

const isInformativePost = computed(function () {
    return [
        "noticia",
        "anuncio"
    ].includes(
        props.post?.postType
    );
});

const isAttendancePost = computed(function () {
    return [
        "taller",
        "evento",
        "convocatoria",
        "oportunidad"
    ].includes(
        props.post?.postType
    );
});

const showContactButton = computed(function () {
    return (
        isAttendancePost.value &&
        Boolean(
            props.post?.contactPhone
        )
    );
});

watch(
    function () {
        return [
            props.show,
            props.post?.id
        ];
    },
    function () {
        currentImageIndex.value = 0;
    }
);

function typeLabel(type) {
    const labels = {
        noticia: "Noticia",
        taller: "Taller",
        evento: "Evento",
        convocatoria: "Convocatoria",
        oportunidad: "Oportunidad",
        anuncio: "Anuncio"
    };

    return (
        labels[type] ||
        "Publicación"
    );
}

function formatDate(date) {
    if (!date) return "Sin fecha";

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

function formatDateTime(date) {
    if (!date) return "Sin fecha";

    return new Intl.DateTimeFormat(
        "es-SV",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    ).format(
        new Date(date)
    );
}

function previousImage() {
    if (!images.value.length) return;

    currentImageIndex.value =
        currentImageIndex.value === 0
            ? images.value.length - 1
            : currentImageIndex.value - 1;
}

function nextImage() {
    if (!images.value.length) return;

    currentImageIndex.value =
        currentImageIndex.value ===
        images.value.length - 1
            ? 0
            : currentImageIndex.value + 1;
}

function selectImage(index) {
    currentImageIndex.value = index;
}

function normalizePhone(phone) {
    let digits =
        String(phone || "")
            .replace(/\D/g, "");

    if (digits.length === 8) {
        digits = `503${digits}`;
    }

    return digits;
}

function contactByWhatsApp() {
    const number =
        normalizePhone(
            props.post?.contactPhone
        );

    if (!number) {
        alert(
            "Esta publicación no tiene un teléfono de contacto."
        );
        return;
    }

    const message =
        `Hola, vi en Thrive la publicación "${props.post.title}" de ${props.post.institutionName}. Me gustaría recibir información para asistir.`;

    window.open(
        `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
        "_blank",
        "noopener,noreferrer"
    );
}
</script>

<template>
<Teleport to="body">
    <div
        v-if="show && post"
        class="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 sm:items-center sm:p-5"
        @click.self="emit('close')"
    >
        <section class="max-h-[95vh] w-full overflow-y-auto rounded-t-[30px] bg-white sm:max-w-[820px] sm:rounded-[30px]">
            <!-- Cabecera -->
            <div class="sticky top-0 z-30 flex items-center justify-between border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur">
                <div class="min-w-0">
                    <p class="text-xs font-black uppercase tracking-[0.12em] text-[#00B4D8]">
                        {{ canManage ? "Vista del emprendedor" : typeLabel(post.postType) }}
                    </p>
                    <h2 class="truncate text-lg font-black text-gray-700">
                        {{ post.title }}
                    </h2>
                </div>

                <button
                    type="button"
                    aria-label="Cerrar"
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                    @click="emit('close')"
                >
                    ×
                </button>
            </div>

            <!-- Galería igual a la visualización de productos. -->
            <div
                v-if="images.length"
                class="bg-[#F5FAFC] p-3 sm:p-5"
            >
                <div class="relative overflow-hidden rounded-[24px] bg-white">
                    <img
                        :src="currentImage"
                        :alt="post.title"
                        class="aspect-square w-full object-cover sm:aspect-[16/10]"
                    >

                    <template v-if="images.length > 1">
                        <button
                            type="button"
                            aria-label="Imagen anterior"
                            class="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-gray-600 shadow"
                            @click="previousImage"
                        >
                            ‹
                        </button>

                        <button
                            type="button"
                            aria-label="Imagen siguiente"
                            class="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-gray-600 shadow"
                            @click="nextImage"
                        >
                            ›
                        </button>

                        <span class="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white">
                            {{ currentImageIndex + 1 }}/{{ images.length }}
                        </span>
                    </template>
                </div>

                <div
                    v-if="images.length > 1"
                    class="mt-3 flex gap-2 overflow-x-auto"
                >
                    <button
                        v-for="(image, index) in images"
                        :key="image.id"
                        type="button"
                        class="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2"
                        :class="currentImageIndex === index ? 'border-[#00B4D8]' : 'border-transparent'"
                        @click="selectImage(index)"
                    >
                        <img
                            :src="image.imageUrl"
                            :alt="`${post.title} ${index + 1}`"
                            class="h-full w-full object-cover"
                        >
                    </button>
                </div>
            </div>

            <!-- Información principal -->
            <div class="p-5 sm:p-7">
                <div class="flex items-center gap-3">
                    <img
                        v-if="post.institutionLogo"
                        :src="post.institutionLogo"
                        :alt="post.institutionName"
                        class="h-12 w-12 rounded-full border-2 border-[#CAF0F8] object-cover"
                    >

                    <div
                        v-else
                        class="flex h-12 w-12 items-center justify-center rounded-full bg-[#CAF0F8] font-black text-[#0077B6]"
                    >
                        {{ post.institutionName?.charAt(0).toUpperCase() || "I" }}
                    </div>

                    <div class="min-w-0">
                        <p class="truncate font-black text-gray-700">
                            {{ post.institutionName || "Institución Thrive" }}
                        </p>

                        <!-- Noticias y anuncios no muestran fecha de creación/publicación. -->
                        <p
                            v-if="!isInformativePost && post.publishedAt"
                            class="text-xs text-gray-400"
                        >
                            Publicado el {{ formatDate(post.publishedAt) }}
                        </p>
                    </div>
                </div>

                <div class="mt-5 flex flex-wrap items-center gap-2">
                    <span class="rounded-full bg-[#CAF0F8] px-3 py-1.5 text-xs font-black text-[#0077B6]">
                        {{ typeLabel(post.postType) }}
                    </span>

                    <span
                        v-if="post.requiresRegistration"
                        class="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-700"
                    >
                        Requiere inscripción
                    </span>

                    <span
                        v-if="post.requiresRegistration && post.availableSpots !== null && post.availableSpots !== undefined"
                        class="rounded-full px-3 py-1.5 text-xs font-black"
                        :class="Number(post.availableSpots) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'"
                    >
                        {{ Number(post.availableSpots) > 0 ? `${post.availableSpots} cupos disponibles` : "Sin cupos" }}
                    </span>
                </div>

                <h1 class="mt-4 text-2xl font-black leading-tight text-gray-700 sm:text-3xl">
                    {{ post.title }}
                </h1>

                <p class="mt-4 whitespace-pre-line text-sm leading-7 text-gray-500 sm:text-base">
                    {{ post.description }}
                </p>

                <!-- Datos relevantes únicamente para actividades y oportunidades. -->
                <div
                    v-if="!isInformativePost"
                    class="mt-6 grid gap-3 sm:grid-cols-2"
                >
                    <div
                        v-if="post.eventDate"
                        class="rounded-2xl bg-[#F8FBFC] p-4"
                    >
                        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                            Inicio
                        </p>
                        <p class="mt-1 text-sm font-bold text-gray-600">
                            {{ formatDateTime(post.eventDate) }}
                        </p>
                    </div>

                    <div
                        v-if="post.eventEndDate"
                        class="rounded-2xl bg-[#F8FBFC] p-4"
                    >
                        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                            Finalización
                        </p>
                        <p class="mt-1 text-sm font-bold text-gray-600">
                            {{ formatDateTime(post.eventEndDate) }}
                        </p>
                    </div>

                    <div
                        v-if="post.location"
                        class="rounded-2xl bg-[#F8FBFC] p-4"
                    >
                        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                            Ubicación
                        </p>
                        <p class="mt-1 text-sm font-bold text-gray-600">
                            {{ post.location }}
                        </p>
                    </div>

                    <div
                        v-if="post.deadline"
                        class="rounded-2xl bg-[#F8FBFC] p-4"
                    >
                        <p class="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                            Fecha límite
                        </p>
                        <p class="mt-1 text-sm font-bold text-gray-600">
                            {{ formatDateTime(post.deadline) }}
                        </p>
                    </div>
                </div>

                <!-- Acciones disponibles para el emprendedor. -->
                <div
                    v-if="showContactButton || post.externalUrl"
                    class="mx-auto mt-7 flex max-w-[680px] flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-center"
                >
                    <button
                        v-if="showContactButton"
                        type="button"
                        class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-[#20BD5A] sm:flex-1"
                        @click="contactByWhatsApp"
                    >
                        <svg class="h-5 w-5" viewBox="0 0 32 32" fill="currentColor">
                            <path d="M19.11 17.34c-.26-.13-1.53-.76-1.77-.84-.24-.09-.41-.13-.59.13-.17.26-.67.84-.82 1.01-.15.17-.3.2-.56.07-.26-.13-1.08-.4-2.06-1.28-.76-.68-1.28-1.52-1.43-1.78-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.33-.02-.46-.07-.13-.59-1.42-.8-1.94-.21-.51-.43-.44-.59-.45h-.5c-.17 0-.46.07-.69.33-.24.26-.91.89-.91 2.17s.93 2.51 1.06 2.68c.13.17 1.83 2.79 4.43 3.91.62.27 1.1.43 1.48.55.62.2 1.18.17 1.63.1.5-.07 1.53-.63 1.75-1.23.22-.61.22-1.13.15-1.23-.06-.11-.24-.17-.5-.3z"></path>
                            <path d="M16.02 3.2A12.7 12.7 0 005.16 22.48L3.2 28.8l6.49-1.91a12.7 12.7 0 106.33-23.69zm0 22.89a10.2 10.2 0 01-5.2-1.42l-.37-.22-3.85 1.13 1.16-3.75-.24-.39a10.2 10.2 0 118.5 4.65z"></path>
                        </svg>
                        Consultar por WhatsApp
                    </button>

                    <a
                        v-if="post.externalUrl"
                        :href="post.externalUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="flex w-full items-center justify-center rounded-xl border border-[#00B4D8] px-5 py-3.5 text-sm font-black text-[#0077B6] transition hover:bg-[#CAF0F8] sm:flex-1"
                    >
                        Abrir enlace de inscripción
                    </a>
                </div>

                <!-- Acciones exclusivas de la institución. -->
                <div
                    v-if="canManage"
                    class="mt-7 grid grid-cols-2 gap-3 border-t border-gray-100 pt-5"
                >
                    <button
                        type="button"
                        class="rounded-xl bg-[#CAF0F8] px-4 py-3 text-sm font-black text-[#0077B6]"
                        @click="emit('edit')"
                    >
                        Editar
                    </button>

                    <button
                        type="button"
                        class="rounded-xl border border-red-200 px-4 py-3 text-sm font-black text-red-600"
                        @click="emit('delete')"
                    >
                        Eliminar
                    </button>
                </div>
            </div>
        </section>
    </div>
</Teleport>
</template>

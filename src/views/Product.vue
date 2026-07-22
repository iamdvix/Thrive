<script setup>
// Vista independiente del producto; reúne galería, información, WhatsApp y reseñas.
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";
const route = useRoute();
const router = useRouter();
const product = ref(null);
const loading = ref(true);
const loadError = ref("");
const currentUserId = ref("");
const currentUserType = ref("");
const selectedImageIndex = ref(0);
const reviews = ref([]);
const reviewsLoading = ref(false);
const reviewSaving = ref(false);
const reviewForm = ref({
    rating: 5,
    comment: ""
});
// La edición se abre únicamente desde el lápiz de la reseña propia.
const editingReviewId = ref("");
const openReviewMenuId = ref("");
const editReviewForm = ref({
    rating: 5,
    comment: ""
});
const productId = computed(function () {
    return String(route.params.id || "");
});
const productImages = computed(function () {
    return product.value?.images || [];
});
const selectedImage = computed(function () {
    if (!productImages.value.length) {
        return null;
    }
    return (
        productImages.value[
            selectedImageIndex.value
        ] ||
        productImages.value[0]
    );
});
const averageRating = computed(function () {
    if (!reviews.value.length) {
        return 0;
    }
    const total =
        reviews.value.reduce(
            function (sum, review) {
                return (
                    sum +
                    (Number(review.rating) || 0)
                );
            },
            0
        );
    return total / reviews.value.length;
});
const reviewCountText = computed(function () {
    const total = reviews.value.length;
    return total === 1
        ? "1 reseña"
        : `${total} reseñas`;
});
const myReview = computed(function () {
    if (!currentUserId.value) {
        return null;
    }
    return (
        reviews.value.find(
            function (review) {
                return (
                    review.userId ===
                    currentUserId.value
                );
            }
        ) || null
    );
});
const canReview = computed(function () {
    return (
        currentUserType.value ===
        "cliente"
    );
});
function formatPrice(price) {
    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD"
        }
    ).format(Number(price) || 0);
}
// Muestra la fecha de creación de la reseña de forma clara y corta.
function formatReviewDate(date) {
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
function getInitials(name) {
    if (!name) return "TH";
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
}
function goBack() {
    if (window.history.length > 1) {
        router.back();
        return;
    }
    router.push({ name: "Catalog" });
}
function openEntrepreneurProfile() {
    if (!product.value?.entrepreneurId) {
        return;
    }
    router.push({
        name: "Business",
        params: {
            id:
                product.value.entrepreneurId
        }
    });
}
function nextImage() {
    if (
        productImages.value.length <= 1
    ) {
        return;
    }
    selectedImageIndex.value =
        (
            selectedImageIndex.value + 1
        ) %
        productImages.value.length;
}
function previousImage() {
    if (
        productImages.value.length <= 1
    ) {
        return;
    }
    selectedImageIndex.value =
        (
            selectedImageIndex.value -
            1 +
            productImages.value.length
        ) %
        productImages.value.length;
}
// Carga el usuario conectado para decidir si puede escribir una reseña.
async function loadCurrentUser() {
    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();
    if (userError || !user) {
        currentUserId.value = "";
        currentUserType.value = "";
        return;
    }
    currentUserId.value =
        user.id;
    const { data, error } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle();
    if (error) {
        console.error(
            "No se pudo cargar el tipo de usuario:",
            error
        );
        return;
    }
    currentUserType.value =
        data?.user_type || "";
}
// Carga el teléfono público del emprendimiento.
async function loadWhatsapp(
    entrepreneurId
) {
    if (!entrepreneurId) return;
    try {
        const { data, error } =
            await supabase.rpc(
                "get_entrepreneur_public_contact",
                {
                    target_entrepreneur_id:
                        entrepreneurId
                }
            );
        if (error) {
            throw error;
        }
        if (product.value) {
            product.value.whatsapp =
                data?.[0]?.phone || "";
        }
    } catch (error) {
        console.warn(
            "No se pudo cargar el WhatsApp:",
            error
        );
    }
}
// Carga el producto junto con todas sus fotografías.
async function loadProduct() {
    loading.value = true;
    loadError.value = "";
    selectedImageIndex.value = 0;
    try {
        const id =
            productId.value;
        if (!id) {
            loadError.value =
                "El enlace del producto no es válido.";
            return;
        }
        const { data, error } = await supabase
            .from("products")
            .select(`
                id,
                entrepreneur_id,
                name,
                description,
                categories,
                price,
                stock,
                active,
                entrepreneurs (
                    id,
                    business_name,
                    department,
                    district,
                    logo_url
                ),
                product_images (
                    id,
                    image_url,
                    sort_order
                )
            `)
            .eq("id", id)
            .maybeSingle();
        if (error) {
            throw error;
        }
        if (!data) {
            loadError.value =
                "No pudimos encontrar este producto.";
            return;
        }
        const images =
            (data.product_images || [])
                .slice()
                .sort(
                    function (a, b) {
                        return (
                            a.sort_order -
                            b.sort_order
                        );
                    }
                )
                .map(
                    function (image) {
                        return image.image_url;
                    }
                );
        const store =
            data.entrepreneurs;
        product.value = {
            id:
                data.id,
            entrepreneurId:
                data.entrepreneur_id,
            name:
                data.name,
            description:
                data.description || "",
            categories:
                data.categories || [],
            price:
                Number(data.price) || 0,
            stock:
                Number(data.stock) || 0,
            images,
            store:
                store?.business_name ||
                "Emprendimiento",
            storeAvatar:
                store?.logo_url || "",
            department:
                store?.department || "",
            district:
                store?.district || "",
            whatsapp: ""
        };
        await Promise.all([
            loadReviews(),
            loadWhatsapp(
                data.entrepreneur_id
            )
        ]);
    } catch (error) {
        console.error(
            "Error al cargar producto:",
            error
        );
        loadError.value =
            "Ocurrió un problema al cargar el producto.";
    } finally {
        loading.value = false;
    }
}
// Obtiene las reseñas con el nombre y la foto pública del cliente.
async function loadReviews() {
    reviewsLoading.value = true;
    try {
        const { data, error } =
            await supabase.rpc(
                "get_product_reviews",
                {
                    target_product_id:
                        productId.value
                }
            );
        if (error) {
            throw error;
        }
        reviews.value =
            (data || []).map(
                function (review) {
                    return {
                        id:
                            review.review_id,
                        userId:
                            review.user_id,
                        fullName:
                            review.full_name ||
                            "Usuario de Thrive",
                        avatarUrl:
                            review.avatar_url || "",
                        rating:
                            Number(review.rating) || 0,
                        comment:
                            review.comment || "",
                        createdAt:
                            review.created_at,
                        updatedAt:
                            review.updated_at
                    };
                }
            );
        // La interfaz detecta automáticamente si el cliente ya tiene una reseña.
    } catch (error) {
        console.error(
            "No se pudieron cargar las reseñas:",
            error
        );
        reviews.value = [];
    } finally {
        reviewsLoading.value = false;
    }
}
// Abre o cierra el menú de tres puntos de la reseña propia.
function toggleReviewMenu(reviewId) {
    openReviewMenuId.value =
        openReviewMenuId.value === reviewId
            ? ""
            : reviewId;
}
// Inicia la edición únicamente desde la reseña que pertenece al cliente.
function startEditingReview(review) {
    if (
        review.userId !== currentUserId.value ||
        reviewSaving.value
    ) {
        return;
    }
    openReviewMenuId.value = "";
    editingReviewId.value = review.id;
    editReviewForm.value = {
        rating: review.rating,
        comment: review.comment
    };
}
// Cancela la edición y vuelve a mostrar la reseña normalmente.
function cancelEditingReview() {
    editingReviewId.value = "";
    openReviewMenuId.value = "";
    editReviewForm.value = {
        rating: 5,
        comment: ""
    };
}
// Crea la única reseña permitida para este cliente y producto.
async function saveReview() {
    if (
        !canReview.value ||
        reviewSaving.value ||
        myReview.value
    ) {
        return;
    }
    if (!reviewForm.value.comment.trim()) {
        alert("Escribe un comentario para publicar tu reseña.");
        return;
    }
    reviewSaving.value = true;
    try {
        /*
            La función de Supabase crea la reseña.
            Si por algún motivo todavía existe una fila anterior,
            la reutiliza en lugar de chocar con la restricción UNIQUE.
        */
        const { error } = await supabase.rpc(
            "save_my_product_review",
            {
                target_product_id:
                    productId.value,
                target_rating:
                    Number(
                        reviewForm.value.rating
                    ),
                target_comment:
                    reviewForm.value.comment.trim()
            }
        );
        if (error) {
            throw error;
        }
        reviewForm.value = {
            rating: 5,
            comment: ""
        };
        await loadReviews();
        alert("Reseña publicada correctamente.");
    } catch (error) {
        console.error(
            "Error al guardar reseña:",
            error
        );
        alert(
            "No fue posible guardar la reseña: " +
            (error.message || "Error inesperado")
        );
    } finally {
        reviewSaving.value = false;
    }
}
// Guarda los cambios hechos desde el editor pequeño de la reseña.
async function updateMyReview(review) {
    if (
        !review ||
        review.userId !== currentUserId.value ||
        reviewSaving.value
    ) {
        return;
    }
    if (!editReviewForm.value.comment.trim()) {
        alert("Escribe un comentario para guardar los cambios.");
        return;
    }
    reviewSaving.value = true;
    try {
        const { error } = await supabase.rpc(
            "save_my_product_review",
            {
                target_product_id:
                    productId.value,
                target_rating:
                    Number(
                        editReviewForm.value.rating
                    ),
                target_comment:
                    editReviewForm.value.comment.trim()
            }
        );
        if (error) {
            throw error;
        }
        editingReviewId.value = "";
        openReviewMenuId.value = "";
        await loadReviews();
        alert("Reseña actualizada correctamente.");
    } catch (error) {
        console.error(
            "Error al actualizar reseña:",
            error
        );
        alert(
            "No fue posible actualizar la reseña: " +
            (error.message || "Error inesperado")
        );
    } finally {
        reviewSaving.value = false;
    }
}
// El cliente solamente puede eliminar su propia reseña.
async function deleteMyReview(review = myReview.value) {
    if (
        !review ||
        review.userId !== currentUserId.value ||
        reviewSaving.value
    ) {
        return;
    }
    const confirmed =
        window.confirm(
            "¿Deseas eliminar tu reseña?"
        );
    if (!confirmed) {
        openReviewMenuId.value = "";
        return;
    }
    reviewSaving.value = true;
    try {
        /*
            Eliminamos usando el producto actual y el usuario autenticado.
            Así no dependemos del ID que devuelve la lista de reseñas.
        */
        const { data, error } = await supabase.rpc(
            "delete_my_product_review_by_product",
            {
                target_product_id:
                    productId.value
            }
        );
        if (error) {
            throw error;
        }
        if (data !== true) {
            throw new Error(
                "No se encontró una reseña propia para eliminar."
            );
        }
        // Quitamos inmediatamente la reseña propia de la pantalla.
        reviews.value =
            reviews.value.filter(
                function (item) {
                    return item.userId !== currentUserId.value;
                }
            );
        reviewForm.value = {
            rating: 5,
            comment: ""
        };
        editingReviewId.value = "";
        openReviewMenuId.value = "";
        // Confirmamos el estado real con Supabase.
        await loadReviews();
        alert("Reseña eliminada correctamente.");
    } catch (error) {
        console.error(
            "Error al eliminar reseña:",
            error
        );
        alert(
            "No fue posible eliminar la reseña: " +
            (error.message || "Error inesperado")
        );
    } finally {
        reviewSaving.value = false;
    }
}
// Abre WhatsApp con un mensaje preparado para el producto.
function contactWhatsApp() {
    if (!product.value) return;
    const message =
        encodeURIComponent(
            `Hola, estoy interesado/a en "${product.value.name}" de ${product.value.store}. Quisiera obtener más información sobre el producto.`
        );
    const rawWhatsapp =
        String(
            product.value.whatsapp || ""
        ).replace(/\D/g, "");
    const whatsapp =
        rawWhatsapp.length === 8
            ? `503${rawWhatsapp}`
            : rawWhatsapp;
    const url =
        whatsapp
            ? `https://wa.me/${whatsapp}?text=${message}`
            : `https://wa.me/?text=${message}`;
    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );
}
async function loadPage() {
    await loadCurrentUser();
    await loadProduct();
}
onMounted(function () {
    loadPage();
});
watch(
    function () {
        return route.params.id;
    },
    function () {
        loadPage();
    }
);
</script>
<template>
<div class="min-h-screen bg-[#F8FBFC] pb-10 text-gray-700">
    <!-- Cabecera -->
    <header class="sticky top-0 z-40 bg-[#F8FBFC]">
        <div class="mx-auto max-w-[1450px] px-2 pt-2 sm:px-5 lg:px-8 lg:pt-4">
            <div class="flex items-center gap-2 rounded-[24px] bg-[#00B4D8] p-2 shadow-sm">
                <button
                    type="button"
                    aria-label="Volver"
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/20"
                    @click="goBack"
                >
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6"></path>
                    </svg>
                </button>
                <p class="min-w-0 flex-1 truncate text-sm font-bold text-white">
                    {{ product?.name || "Detalle del producto" }}
                </p>
            </div>
        </div>
    </header>
    <!-- Cargando -->
    <main
        v-if="loading"
        class="mx-auto max-w-[1100px] px-5 py-24 text-center"
    >
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        <p class="mt-4 text-sm font-semibold text-gray-400">
            Cargando producto...
        </p>
    </main>
    <!-- Error -->
    <main
        v-else-if="loadError"
        class="mx-auto max-w-[1100px] px-5 py-24 text-center"
    >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 font-black text-red-600">
            !
        </div>
        <h1 class="mt-4 text-xl font-black text-gray-700">
            No pudimos cargar el producto
        </h1>
        <p class="mt-2 text-sm text-gray-400">
            {{ loadError }}
        </p>
        <button
            type="button"
            class="mt-5 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white"
            @click="loadPage"
        >
            Intentar nuevamente
        </button>
    </main>
    <!-- Producto -->
    <main
        v-else-if="product"
        class="mx-auto max-w-[1100px] px-3 pb-10 pt-4 sm:px-5"
    >
        <section class="overflow-hidden bg-white sm:rounded-[28px]">
            <div class="grid md:grid-cols-2">
                <!-- Galería -->
                <div class="bg-gray-50 p-4 sm:p-6">
                    <div class="relative overflow-hidden rounded-[22px] bg-gray-100">
                        <img
                            v-if="selectedImage"
                            :src="selectedImage"
                            :alt="product.name"
                            class="aspect-square w-full object-cover"
                        >
                        <div
                            v-else
                            class="flex aspect-square items-center justify-center text-sm font-bold text-gray-400"
                        >
                            Sin fotografía
                        </div>
                        <span
                            v-if="productImages.length"
                            class="absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white"
                        >
                            {{ selectedImageIndex + 1 }} / {{ productImages.length }}
                        </span>
                        <template v-if="productImages.length > 1">
                            <button
                                type="button"
                                class="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-gray-600 shadow"
                                @click="previousImage"
                            >
                                ‹
                            </button>
                            <button
                                type="button"
                                class="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-gray-600 shadow"
                                @click="nextImage"
                            >
                                ›
                            </button>
                        </template>
                    </div>
                    <div
                        v-if="productImages.length > 1"
                        class="mt-3 flex gap-2 overflow-x-auto pb-1"
                    >
                        <button
                            v-for="(image, index) in productImages"
                            :key="image"
                            type="button"
                            class="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2"
                            :class="
                                selectedImageIndex === index
                                    ? 'border-[#00B4D8]'
                                    : 'border-transparent'
                            "
                            @click="selectedImageIndex = index"
                        >
                            <img
                                :src="image"
                                alt="Fotografía del producto"
                                class="h-full w-full object-cover"
                            >
                        </button>
                    </div>
                </div>
                <!-- Información -->
                <div class="p-5 sm:p-7">
                    <button
                        type="button"
                        class="flex items-center gap-2 text-left"
                        @click="openEntrepreneurProfile"
                    >
                        <img
                            v-if="product.storeAvatar"
                            :src="product.storeAvatar"
                            :alt="product.store"
                            class="h-10 w-10 rounded-full border border-gray-100 object-cover"
                        >
                        <div
                            v-else
                            class="flex h-10 w-10 items-center justify-center rounded-full bg-[#CAF0F8] text-xs font-bold text-[#0077B6]"
                        >
                            {{ getInitials(product.store) }}
                        </div>
                        <div>
                            <p class="text-sm font-bold text-[#0077B6]">
                                {{ product.store }}
                            </p>
                            <p class="text-xs text-gray-400">
                                {{ product.district }}, {{ product.department }}
                            </p>
                        </div>
                    </button>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <span
                            v-for="category in product.categories"
                            :key="category"
                            class="rounded-full bg-[#CAF0F8] px-3 py-1.5 text-xs font-bold text-[#0077B6]"
                        >
                            {{ category }}
                        </span>
                    </div>
                    <h1 class="mt-4 text-2xl font-black leading-tight text-gray-700 sm:text-3xl">
                        {{ product.name }}
                    </h1>
                    <div class="mt-3 flex items-center gap-2">
                        <span class="text-lg text-amber-500">★</span>
                        <span class="font-black text-gray-700">
                            {{ averageRating.toFixed(1) }}
                        </span>
                        <span class="text-sm text-gray-400">
                            {{ reviewCountText }}
                        </span>
                    </div>
                    <p class="mt-3 text-3xl font-black text-[#4F7180]">
                        {{ formatPrice(product.price) }}
                    </p>
                    <p class="mt-6 whitespace-pre-line text-sm leading-6 text-gray-500">
                        {{ product.description || "Este producto no tiene una descripción." }}
                    </p>
                    <button
                        type="button"
                        class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3.5 font-bold text-white"
                        @click="contactWhatsApp"
                    >
                        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.003a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.885 9.887-9.885 2.64 0 5.122 1.03 6.988 2.897a9.825 9.825 0 012.895 6.993c-.003 5.45-4.437 9.887-9.887 9.887"></path>
                        </svg>
                        Consultar por WhatsApp
                    </button>
                </div>
            </div>
        </section>
        <!-- Reseñas -->
        <section class="mt-6 bg-white p-5 sm:rounded-[28px] sm:p-7">
            <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                        Opiniones
                    </p>
                    <h2 class="mt-1 text-2xl font-black text-gray-700">
                        Reseñas del producto
                    </h2>
                </div>
                <div class="flex items-center gap-2 text-sm">
                    <span class="text-xl text-amber-500">★</span>
                    <span class="font-black text-gray-700">
                        {{ averageRating.toFixed(1) }}
                    </span>
                    <span class="text-gray-400">
                        {{ reviewCountText }}
                    </span>
                </div>
            </div>
            <!-- El formulario solo aparece mientras el cliente todavía no ha reseñado. -->
            <div
                v-if="canReview && !myReview"
                class="mt-6 rounded-2xl bg-[#F8FBFC] p-4 sm:p-5"
            >
                <h3 class="font-black text-gray-700">
                    Escribir una reseña
                </h3>
                <div class="mt-3 flex items-center gap-1">
                    <button
                        v-for="star in 5"
                        :key="star"
                        type="button"
                        :aria-label="`${star} estrellas`"
                        class="text-3xl"
                        :class="
                            star <= reviewForm.rating
                                ? 'text-amber-500'
                                : 'text-gray-200'
                        "
                        @click="reviewForm.rating = star"
                    >
                        ★
                    </button>
                </div>
                <textarea
                    v-model="reviewForm.comment"
                    rows="4"
                    maxlength="800"
                    placeholder="Cuéntanos qué te pareció este producto..."
                    class="mt-3 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#00B4D8]"
                ></textarea>
                <button
                    type="button"
                    :disabled="reviewSaving"
                    class="mt-3 w-full rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white disabled:opacity-50 sm:w-auto"
                    @click="saveReview"
                >
                    {{ reviewSaving ? "Publicando..." : "Publicar reseña" }}
                </button>
            </div>
            <!-- Lista de reseñas -->
            <div
                v-if="reviewsLoading"
                class="py-12 text-center text-sm font-semibold text-gray-400"
            >
                Cargando reseñas...
            </div>
            <div
                v-else-if="!reviews.length"
                class="py-12 text-center"
            >
                <p class="font-bold text-gray-600">
                    Este producto todavía no tiene reseñas.
                </p>
                <p class="mt-1 text-sm text-gray-400">
                    Sé la primera persona en compartir su experiencia.
                </p>
            </div>
            <div
                v-else
                class="mt-6 divide-y divide-gray-100"
            >
                <article
                    v-for="review in reviews"
                    :key="review.id"
                    class="py-5 first:pt-0 last:pb-0"
                >
                    <div class="flex items-start gap-3">
                        <img
                            v-if="review.avatarUrl"
                            :src="review.avatarUrl"
                            :alt="review.fullName"
                            class="h-10 w-10 shrink-0 rounded-full object-cover"
                        >
                        <div
                            v-else
                            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#CAF0F8] text-xs font-black text-[#0077B6]"
                        >
                            {{ getInitials(review.fullName) }}
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <p class="font-bold text-gray-700">
                                            {{ review.fullName }}
                                        </p>
                                        <span
                                            v-if="review.userId === currentUserId"
                                            class="rounded-full bg-[#CAF0F8] px-2 py-0.5 text-[10px] font-bold text-[#0077B6]"
                                        >
                                            Tu reseña
                                        </span>
                                    </div>
                                    <p class="mt-0.5 text-xs text-gray-400">
                                        {{ formatReviewDate(review.createdAt) }}
                                    </p>
                                </div>
                                <!-- Las opciones de la reseña propia se agrupan en un menú de tres puntos. -->
                                <div
                                    v-if="
                                        review.userId === currentUserId &&
                                        editingReviewId !== review.id
                                    "
                                    class="relative shrink-0"
                                >
                                    <button
                                        type="button"
                                        aria-label="Opciones de mi reseña"
                                        class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-[#CAF0F8] hover:text-[#0077B6]"
                                        @click.stop="toggleReviewMenu(review.id)"
                                    >
                                        <svg
                                            class="h-5 w-5"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                        >
                                            <circle cx="12" cy="5" r="1.8"></circle>
                                            <circle cx="12" cy="12" r="1.8"></circle>
                                            <circle cx="12" cy="19" r="1.8"></circle>
                                        </svg>
                                    </button>
                                    <div
                                        v-if="openReviewMenuId === review.id"
                                        class="absolute right-0 top-9 z-20 w-32 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
                                    >
                                        <button
                                            type="button"
                                            class="flex w-full items-center px-4 py-2.5 text-left text-sm font-semibold text-gray-600 hover:bg-gray-50"
                                            @click.stop="startEditingReview(review)"
                                        >
                                            Editar
                                        </button>
                                        <button
                                            type="button"
                                            class="flex w-full items-center px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                                            @click.stop="deleteMyReview(review)"
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <!-- Vista normal de la reseña. -->
                            <template v-if="editingReviewId !== review.id">
                                <div class="mt-1 text-sm text-amber-500">
                                    {{
                                        "★".repeat(review.rating) +
                                        "☆".repeat(5 - review.rating)
                                    }}
                                </div>
                                <p class="mt-2 whitespace-pre-line text-sm leading-6 text-gray-500">
                                    {{ review.comment }}
                                </p>
                            </template>
                            <!-- Editor pequeño que aparece al tocar el lápiz. -->
                            <div
                                v-else
                                class="mt-3 rounded-2xl bg-[#F8FBFC] p-4"
                            >
                                <div class="flex items-center gap-1">
                                    <button
                                        v-for="star in 5"
                                        :key="`edit-${review.id}-${star}`"
                                        type="button"
                                        :aria-label="`${star} estrellas`"
                                        class="text-2xl"
                                        :class="
                                            star <= editReviewForm.rating
                                                ? 'text-amber-500'
                                                : 'text-gray-200'
                                        "
                                        @click="editReviewForm.rating = star"
                                    >
                                        ★
                                    </button>
                                </div>
                                <textarea
                                    v-model="editReviewForm.comment"
                                    rows="3"
                                    maxlength="800"
                                    class="mt-3 w-full resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#00B4D8]"
                                ></textarea>
                                <div class="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        :disabled="reviewSaving"
                                        class="rounded-xl bg-[#00B4D8] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                                        @click="updateMyReview(review)"
                                    >
                                        {{ reviewSaving ? "Guardando..." : "Guardar" }}
                                    </button>
                                    <button
                                        type="button"
                                        :disabled="reviewSaving"
                                        class="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-500"
                                        @click="cancelEditingReview"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        </section>
    </main>
</div>
</template>

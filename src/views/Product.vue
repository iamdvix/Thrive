<script setup>
// Detalle del producto. Mantiene galería, descuentos, WhatsApp y reseñas.
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
const openReviewMenuId = ref("");
const editingReviewId = ref("");

const reviewForm = ref({
    rating: 5,
    comment: ""
});

const editReviewForm = ref({
    rating: 5,
    comment: ""
});

const productId = computed(() => String(route.params.id || ""));
const productImages = computed(() => product.value?.images || []);

const selectedImage = computed(() => {
    if (!productImages.value.length) return null;
    return productImages.value[selectedImageIndex.value] || productImages.value[0];
});

const averageRating = computed(() => {
    if (!reviews.value.length) return 0;
    const total = reviews.value.reduce((sum, review) => sum + (Number(review.rating) || 0), 0);
    return total / reviews.value.length;
});

const reviewCountText = computed(() => {
    const total = reviews.value.length;
    return total === 1 ? "1 reseña" : `${total} reseñas`;
});

const myReview = computed(() => {
    if (!currentUserId.value) return null;
    return reviews.value.find(review => review.userId === currentUserId.value) || null;
});

const canReview = computed(() => currentUserType.value === "cliente");

const discountPercent = computed(() => {
    return Math.max(0, Math.min(90, Number(product.value?.discountPercent) || 0));
});

const hasDiscount = computed(() => discountPercent.value > 0);

const finalPrice = computed(() => {
    const price = Number(product.value?.price) || 0;
    if (!hasDiscount.value) return price;
    return price * (1 - discountPercent.value / 100);
});

function formatPrice(price) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(Number(price) || 0);
}

function formatReviewDate(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat("es-SV", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date(date));
}

function getInitials(name) {
    if (!name) return "TH";
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join("");
}

function goBack() {
    if (window.history.length > 1) {
        router.back();
        return;
    }
    router.push("/catalog");
}

function openEntrepreneurProfile() {
    if (!product.value?.entrepreneurId) return;
    router.push({
        name: "Business",
        params: { id: product.value.entrepreneurId }
    });
}

function nextImage() {
    if (productImages.value.length <= 1) return;
    selectedImageIndex.value = (selectedImageIndex.value + 1) % productImages.value.length;
}

function previousImage() {
    if (productImages.value.length <= 1) return;
    selectedImageIndex.value =
        (selectedImageIndex.value - 1 + productImages.value.length) %
        productImages.value.length;
}

// Revisa quién está conectado para saber si puede dejar una reseña.
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

    currentUserId.value = user.id;

    const { data, error } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .maybeSingle();

    if (error) {
        console.error("No se pudo cargar el tipo de usuario:", error);
        return;
    }

    currentUserType.value = data?.user_type || "";
}

// Obtiene el WhatsApp público del emprendimiento.
async function loadWhatsapp(entrepreneurId) {
    if (!entrepreneurId) return;

    try {
        const { data, error } = await supabase.rpc(
            "get_entrepreneur_public_contact",
            {
                target_entrepreneur_id: entrepreneurId
            }
        );

        if (error) throw error;
        if (product.value) product.value.whatsapp = data?.[0]?.phone || "";
    } catch (error) {
        console.warn("No se pudo cargar el WhatsApp:", error);
    }
}

// Carga toda la información necesaria del producto.
async function loadProduct() {
    loading.value = true;
    loadError.value = "";
    selectedImageIndex.value = 0;

    try {
        if (!productId.value) {
            loadError.value = "El enlace del producto no es válido.";
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
                discount_percent,
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
            .eq("id", productId.value)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            loadError.value = "No pudimos encontrar este producto.";
            return;
        }

        const images = (data.product_images || [])
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(image => image.image_url);

        const store = data.entrepreneurs;

        product.value = {
            id: data.id,
            entrepreneurId: data.entrepreneur_id,
            name: data.name,
            description: data.description || "",
            categories: data.categories || [],
            price: Number(data.price) || 0,
            discountPercent: Number(data.discount_percent) || 0,
            stock: Number(data.stock) || 0,
            images,
            store: store?.business_name || "Emprendimiento",
            storeAvatar: store?.logo_url || "",
            department: store?.department || "",
            district: store?.district || "",
            whatsapp: ""
        };

        await Promise.all([
            loadReviews(),
            loadWhatsapp(data.entrepreneur_id)
        ]);
    } catch (error) {
        console.error("Error al cargar producto:", error);
        loadError.value = "Ocurrió un problema al cargar el producto.";
    } finally {
        loading.value = false;
    }
}

// Obtiene las reseñas públicas del producto.
async function loadReviews() {
    reviewsLoading.value = true;

    try {
        const { data, error } = await supabase.rpc(
            "get_product_reviews",
            {
                target_product_id: productId.value
            }
        );

        if (error) throw error;

        reviews.value = (data || []).map(review => ({
            id: review.review_id,
            userId: review.user_id,
            fullName: review.full_name || "Usuario de Thrive",
            avatarUrl: review.avatar_url || "",
            rating: Number(review.rating) || 0,
            comment: review.comment || "",
            createdAt: review.created_at,
            updatedAt: review.updated_at
        }));
    } catch (error) {
        console.error("No se pudieron cargar las reseñas:", error);
        reviews.value = [];
    } finally {
        reviewsLoading.value = false;
    }
}

function toggleReviewMenu(reviewId) {
    openReviewMenuId.value =
        openReviewMenuId.value === reviewId ? "" : reviewId;
}

function startEditingReview(review) {
    if (review.userId !== currentUserId.value || reviewSaving.value) return;

    openReviewMenuId.value = "";
    editingReviewId.value = review.id;
    editReviewForm.value = {
        rating: review.rating,
        comment: review.comment
    };
}

function cancelEditingReview() {
    editingReviewId.value = "";
    openReviewMenuId.value = "";
    editReviewForm.value = {
        rating: 5,
        comment: ""
    };
}

// Publica una reseña nueva.
async function saveReview() {
    if (!canReview.value || reviewSaving.value || myReview.value) return;

    if (!reviewForm.value.comment.trim()) {
        alert("Escribe un comentario para publicar tu reseña.");
        return;
    }

    reviewSaving.value = true;

    try {
        const { error } = await supabase
            .from("product_reviews")
            .insert({
                product_id: productId.value,
                user_id: currentUserId.value,
                rating: Number(reviewForm.value.rating),
                comment: reviewForm.value.comment.trim()
            });

        if (error) {
            if (error.code === "23505") {
                await loadReviews();
                alert("Ya tienes una reseña publicada para este producto.");
                return;
            }
            throw error;
        }

        reviewForm.value = {
            rating: 5,
            comment: ""
        };

        await loadReviews();
    } catch (error) {
        console.error("Error al guardar reseña:", error);
        alert("No fue posible guardar la reseña.");
    } finally {
        reviewSaving.value = false;
    }
}

// Guarda cambios de la reseña propia.
async function updateMyReview(review) {
    if (!review || review.userId !== currentUserId.value || reviewSaving.value) return;

    if (!editReviewForm.value.comment.trim()) {
        alert("Escribe un comentario para guardar los cambios.");
        return;
    }

    reviewSaving.value = true;

    try {
        const { error } = await supabase
            .from("product_reviews")
            .update({
                rating: Number(editReviewForm.value.rating),
                comment: editReviewForm.value.comment.trim()
            })
            .eq("id", review.id)
            .eq("user_id", currentUserId.value);

        if (error) throw error;

        editingReviewId.value = "";
        await loadReviews();
    } catch (error) {
        console.error("Error al actualizar reseña:", error);
        alert("No fue posible actualizar la reseña.");
    } finally {
        reviewSaving.value = false;
    }
}

// El cliente solamente puede eliminar su propia opinión.
async function deleteMyReview(review = myReview.value) {
    if (!review || review.userId !== currentUserId.value || reviewSaving.value) return;

    if (!window.confirm("¿Deseas eliminar tu reseña?")) {
        openReviewMenuId.value = "";
        return;
    }

    reviewSaving.value = true;

    try {
        const { error } = await supabase
            .from("product_reviews")
            .delete()
            .eq("id", review.id)
            .eq("user_id", currentUserId.value);

        if (error) throw error;

        reviews.value = reviews.value.filter(item => item.id !== review.id);
        editingReviewId.value = "";
        openReviewMenuId.value = "";
    } catch (error) {
        console.error("Error al eliminar reseña:", error);
        alert("No fue posible eliminar la reseña.");
    } finally {
        reviewSaving.value = false;
    }
}

// Abre WhatsApp con el producto ya escrito en el mensaje.
function contactWhatsApp() {
    if (!product.value) return;

    const message = encodeURIComponent(
        `Hola, estoy interesado/a en "${product.value.name}" de ${product.value.store}. Quisiera obtener más información sobre el producto.`
    );

    const rawWhatsapp = String(product.value.whatsapp || "").replace(/\D/g, "");
    const whatsapp =
        rawWhatsapp.length === 8
            ? `503${rawWhatsapp}`
            : rawWhatsapp;

    const url = whatsapp
        ? `https://wa.me/${whatsapp}?text=${message}`
        : `https://wa.me/?text=${message}`;

    window.open(url, "_blank", "noopener,noreferrer");
}

async function loadPage() {
    await loadCurrentUser();
    await loadProduct();
}

onMounted(loadPage);

watch(
    () => route.params.id,
    () => loadPage()
);
</script>

<template>
<div class="min-h-screen bg-[#F7FAFB] pb-10 text-gray-700">
    <!-- Cargando -->
    <main
        v-if="loading"
        class="mx-auto max-w-[1200px] px-5 py-24 text-center"
    >
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        <p class="mt-4 text-sm font-semibold text-gray-400">
            Cargando producto...
        </p>
    </main>

    <!-- Error -->
    <main
        v-else-if="loadError"
        class="mx-auto max-w-[1200px] px-5 py-24 text-center"
    >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 font-black text-red-500">
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

    <!-- Contenido -->
    <main
        v-else-if="product"
        class="mx-auto max-w-[1250px] pb-10 sm:px-4 sm:pt-4 lg:px-6"
    >
        <div class="grid gap-4 lg:grid-cols-[1.08fr_.92fr] lg:items-start">

            <!-- Galería -->
            <section class="bg-white sm:rounded-[28px] sm:border sm:border-gray-200 sm:p-4">
                <div class="relative overflow-hidden bg-gray-100 sm:rounded-[23px]">

                    <img
                        v-if="selectedImage"
                        :src="selectedImage"
                        :alt="product.name"
                        class="aspect-[4/5] w-full object-cover sm:aspect-square"
                    >

                    <div
                        v-else
                        class="flex aspect-[4/5] w-full items-center justify-center text-sm font-bold text-gray-400 sm:aspect-square"
                    >
                        Sin fotografía
                    </div>

                    <!-- Isla superior. Solo regresar es interactivo. -->
                    <div
                        class="absolute left-3 right-3 top-3 z-20 flex h-11 items-center rounded-full bg-[#00B4D8] px-1.5 shadow-md sm:left-4 sm:right-4"
                    >
                        <button
                            type="button"
                            aria-label="Regresar"
                            class="flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/20"
                            @click="goBack"
                        >
                            <svg
                                class="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    d="M15 18l-6-6 6-6"
                                ></path>
                            </svg>
                        </button>
                    </div>

                    <!-- Categorías dentro de la isla, como en la referencia. -->
                    <div
                        class="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-1.5 overflow-x-auto rounded-full bg-[#00B4D8] p-1.5 shadow-md sm:left-4 sm:right-4"
                    >
                        <span
                            v-if="!product.categories.length"
                            class="shrink-0 rounded-full bg-white/20 px-4 py-1.5 text-[11px] font-semibold text-white"
                        >
                            Producto
                        </span>

                        <span
                            v-for="category in product.categories"
                            :key="category"
                            class="shrink-0 rounded-full bg-white/20 px-4 py-1.5 text-[11px] font-semibold text-white"
                        >
                            {{ category }}
                        </span>
                    </div>

                    <span
                        v-if="productImages.length > 1"
                        class="absolute right-5 top-[66px] rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold text-white"
                    >
                        {{ selectedImageIndex + 1 }}/{{ productImages.length }}
                    </span>

                    <template v-if="productImages.length > 1">
                        <button
                            type="button"
                            aria-label="Imagen anterior"
                            class="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-gray-600 shadow sm:flex"
                            @click="previousImage"
                        >
                            ‹
                        </button>

                        <button
                            type="button"
                            aria-label="Imagen siguiente"
                            class="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-gray-600 shadow sm:flex"
                            @click="nextImage"
                        >
                            ›
                        </button>
                    </template>
                </div>

                <!-- Miniaturas -->
                <div
                    v-if="productImages.length > 1"
                    class="flex gap-2 overflow-x-auto px-3 py-3 sm:px-0 sm:pb-0"
                >
                    <button
                        v-for="(image, index) in productImages"
                        :key="image"
                        type="button"
                        class="h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 sm:h-16 sm:w-16"
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
            </section>

            <div class="space-y-4 px-3 sm:px-0">

                <!-- Información principal -->
                <section class="rounded-[24px] border border-gray-200 bg-white p-5 sm:p-6">
                    <!-- Emprendimiento -->
                    <button
                        type="button"
                        class="flex items-center gap-3 text-left"
                        @click="openEntrepreneurProfile"
                    >
                        <img
                            v-if="product.storeAvatar"
                            :src="product.storeAvatar"
                            :alt="product.store"
                            class="h-11 w-11 rounded-full border border-gray-100 object-cover"
                        >

                        <div
                            v-else
                            class="flex h-11 w-11 items-center justify-center rounded-full bg-[#CAF0F8] text-xs font-black text-[#0077B6]"
                        >
                            {{ getInitials(product.store) }}
                        </div>

                        <div>
                            <p class="text-sm font-black text-[#0077B6]">
                                {{ product.store }}
                            </p>
                            <p class="text-xs text-gray-400">
                                {{ product.district }}<span v-if="product.district && product.department">, </span>{{ product.department }}
                            </p>
                        </div>
                    </button>

                    <div class="mt-5 flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                            <h1 class="text-xl font-black leading-tight text-gray-800 sm:text-3xl">
                                {{ product.name }}
                            </h1>

                            <div class="mt-2 flex items-center gap-2 text-sm">
                                <span class="tracking-wide text-amber-400">
                                    ★★★★★
                                </span>
                                <span class="font-bold text-gray-600">
                                    {{ averageRating.toFixed(1) }}
                                </span>
                                <span class="text-gray-400">
                                    ({{ reviewCountText }})
                                </span>
                            </div>
                        </div>

                        <span
                            v-if="hasDiscount"
                            class="rounded-full bg-[#E5F8FC] px-3 py-1.5 text-xs font-black text-[#0099BC]"
                        >
                            -{{ discountPercent }}%
                        </span>
                    </div>

                    <!-- Precio -->
                    <div class="mt-5 flex flex-wrap items-end gap-3">
                        <p class="text-3xl font-black text-[#00A9CF]">
                            {{ formatPrice(finalPrice) }}
                        </p>

                        <p
                            v-if="hasDiscount"
                            class="pb-1 text-sm font-semibold text-gray-400 line-through"
                        >
                            {{ formatPrice(product.price) }}
                        </p>
                    </div>

                    <!-- Descripción dentro de la misma tarjeta -->
                    <div class="mt-5 border-t border-gray-100 pt-5">
                        <h2 class="text-sm font-black text-gray-700">
                            Descripción
                        </h2>

                        <p class="mt-2 whitespace-pre-line text-sm leading-6 text-gray-500">
                            {{ product.description || "Este producto todavía no tiene una descripción." }}
                        </p>
                    </div>

                    <!-- Disponibilidad -->
                    <div class="mt-5 flex items-center justify-between rounded-2xl bg-[#F7FAFB] px-4 py-3">
                        <span class="text-xs font-bold text-gray-500">
                            Disponibilidad
                        </span>

                        <span
                            class="text-xs font-black"
                            :class="product.stock > 0 ? 'text-emerald-600' : 'text-red-500'"
                        >
                            {{ product.stock > 0 ? `${product.stock} disponibles` : "Agotado" }}
                        </span>
                    </div>

                    <button
                        type="button"
                        class="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3.5 text-sm font-black text-white transition hover:brightness-95"
                        @click="contactWhatsApp"
                    >
                        <svg
                            class="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            aria-hidden="true"
                        >
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"></path>
                        </svg>
                        Consultar por WhatsApp
                    </button>
                </section>

                <!-- Reseñas -->
                <section class="rounded-[24px] border border-gray-200 bg-white p-5 sm:p-6">
                    <div class="flex items-center justify-between gap-4">
                        <div>
                            <h2 class="text-lg font-black text-gray-800">
                                Reseñas de producto
                            </h2>
                            <p class="mt-1 text-xs text-gray-400">
                                Opiniones de clientes
                            </p>
                        </div>

                        <div class="flex items-center gap-1.5">
                            <span class="text-lg text-amber-400">★</span>
                            <span class="text-sm font-black text-gray-700">
                                {{ averageRating.toFixed(1) }}
                            </span>
                            <span class="text-xs text-gray-400">
                                ({{ reviews.length }})
                            </span>
                        </div>
                    </div>

                    <!-- Dejar reseña -->
                    <div
                        v-if="canReview && !myReview"
                        class="mt-5 rounded-[18px] border border-gray-200 bg-[#FAFCFD] p-4"
                    >
                        <p class="text-sm font-black text-gray-700">
                            Deja tu reseña
                        </p>

                        <div class="mt-2 flex items-center gap-0.5">
                            <button
                                v-for="star in 5"
                                :key="star"
                                type="button"
                                :aria-label="`${star} estrellas`"
                                class="text-2xl"
                                :class="
                                    star <= reviewForm.rating
                                        ? 'text-amber-400'
                                        : 'text-gray-200'
                                "
                                @click="reviewForm.rating = star"
                            >
                                ★
                            </button>
                        </div>

                        <div class="mt-3 flex items-end gap-2">
                            <textarea
                                v-model="reviewForm.comment"
                                rows="2"
                                maxlength="800"
                                placeholder="Escribe tu opinión..."
                                class="min-h-[50px] flex-1 resize-none rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#00B4D8]"
                            ></textarea>

                            <button
                                type="button"
                                :disabled="reviewSaving"
                                aria-label="Publicar reseña"
                                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#00B4D8] text-white disabled:opacity-50"
                                @click="saveReview"
                            >
                                <svg
                                    class="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        d="M5 12h14M13 6l6 6-6 6"
                                    ></path>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <!-- Cargando reseñas -->
                    <div
                        v-if="reviewsLoading"
                        class="py-10 text-center text-sm font-semibold text-gray-400"
                    >
                        Cargando reseñas...
                    </div>

                    <!-- Sin reseñas -->
                    <div
                        v-else-if="!reviews.length"
                        class="py-10 text-center"
                    >
                        <p class="text-sm font-bold text-gray-600">
                            Todavía no hay reseñas.
                        </p>
                        <p class="mt-1 text-xs text-gray-400">
                            Sé la primera persona en compartir su experiencia.
                        </p>
                    </div>

                    <!-- Lista -->
                    <div
                        v-else
                        class="mt-5 divide-y divide-gray-100"
                    >
                        <article
                            v-for="review in reviews"
                            :key="review.id"
                            class="py-4 first:pt-0 last:pb-0"
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
                                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E4F8FC] text-xs font-black text-[#0077B6]"
                                >
                                    {{ getInitials(review.fullName) }}
                                </div>

                                <div class="min-w-0 flex-1">
                                    <div class="flex items-start justify-between gap-3">
                                        <div>
                                            <div class="flex flex-wrap items-center gap-2">
                                                <p class="text-sm font-black text-gray-700">
                                                    {{ review.fullName }}
                                                </p>

                                                <span
                                                    v-if="review.userId === currentUserId"
                                                    class="rounded-full bg-[#E4F8FC] px-2 py-0.5 text-[9px] font-black text-[#0077B6]"
                                                >
                                                    Tú
                                                </span>
                                            </div>

                                            <div class="mt-0.5 flex items-center gap-2">
                                                <span class="text-xs tracking-wide text-amber-400">
                                                    {{ "★".repeat(review.rating) }}{{ "☆".repeat(5 - review.rating) }}
                                                </span>

                                                <span class="text-[10px] text-gray-400">
                                                    {{ formatReviewDate(review.createdAt) }}
                                                </span>
                                            </div>
                                        </div>

                                        <!-- Opciones de la reseña propia -->
                                        <div
                                            v-if="
                                                review.userId === currentUserId &&
                                                editingReviewId !== review.id
                                            "
                                            class="relative"
                                        >
                                            <button
                                                type="button"
                                                aria-label="Opciones"
                                                class="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
                                                @click.stop="toggleReviewMenu(review.id)"
                                            >
                                                <svg
                                                    class="h-5 w-5"
                                                    viewBox="0 0 24 24"
                                                    fill="currentColor"
                                                >
                                                    <circle cx="12" cy="5" r="1.7"></circle>
                                                    <circle cx="12" cy="12" r="1.7"></circle>
                                                    <circle cx="12" cy="19" r="1.7"></circle>
                                                </svg>
                                            </button>

                                            <div
                                                v-if="openReviewMenuId === review.id"
                                                class="absolute right-0 top-9 z-30 w-32 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
                                            >
                                                <button
                                                    type="button"
                                                    class="w-full px-4 py-2.5 text-left text-xs font-bold text-gray-600 hover:bg-gray-50"
                                                    @click.stop="startEditingReview(review)"
                                                >
                                                    Editar
                                                </button>

                                                <button
                                                    type="button"
                                                    class="w-full px-4 py-2.5 text-left text-xs font-bold text-red-500 hover:bg-red-50"
                                                    @click.stop="deleteMyReview(review)"
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <template v-if="editingReviewId !== review.id">
                                        <p class="mt-2 whitespace-pre-line text-sm leading-6 text-gray-500">
                                            {{ review.comment }}
                                        </p>
                                    </template>

                                    <!-- Edición de la reseña -->
                                    <div
                                        v-else
                                        class="mt-3 rounded-2xl border border-gray-200 bg-[#FAFCFD] p-3"
                                    >
                                        <div class="flex gap-0.5">
                                            <button
                                                v-for="star in 5"
                                                :key="`edit-${review.id}-${star}`"
                                                type="button"
                                                class="text-xl"
                                                :class="
                                                    star <= editReviewForm.rating
                                                        ? 'text-amber-400'
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
                                            class="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#00B4D8]"
                                        ></textarea>

                                        <div class="mt-2 flex gap-2">
                                            <button
                                                type="button"
                                                :disabled="reviewSaving"
                                                class="rounded-xl bg-[#00B4D8] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                                                @click="updateMyReview(review)"
                                            >
                                                Guardar
                                            </button>

                                            <button
                                                type="button"
                                                class="rounded-xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-500"
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
            </div>
        </div>
    </main>
</div>
</template>
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";

const route = useRoute();
const router = useRouter();

// ===============================
// ESTADO GENERAL
// ===============================

const entrepreneur = ref(null);
const products = ref([]);
const loading = ref(true);
const loadError = ref("");

// ===============================
// FOLLOW
// ===============================

const isFollowing = ref(false);
const followLoading = ref(false);
const followerCount = ref(0);

// ===============================
// DETALLE DE PRODUCTO
// ===============================

const selectedProduct = ref(null);
const selectedProductImageIndex = ref(0);

// ===============================
// COMPUTED
// ===============================

const entrepreneurId = computed(function () {
    return String(route.params.id || "");
});

const entrepreneurInitials = computed(function () {
    const name = entrepreneur.value?.businessName || "Thrive";

    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(function (word) {
            return word.charAt(0).toUpperCase();
        })
        .join("");
});

const followerCountText = computed(function () {
    return followerCount.value === 1
        ? "1 seguidor"
        : `${followerCount.value} seguidores`;
});

const selectedProductImages = computed(function () {
    return selectedProduct.value?.images || [];
});

const selectedProductImage = computed(function () {
    if (!selectedProductImages.value.length) {
        return null;
    }

    return (
        selectedProductImages.value[
            selectedProductImageIndex.value
        ] || selectedProductImages.value[0]
    );
});

// ===============================
// FUNCIONES GENERALES
// ===============================

function formatPrice(price) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(Number(price) || 0);
}

function goBack() {
    if (window.history.length > 1) {
        router.back();
        return;
    }

    router.push("/catalogo");
}

// ===============================
// CARGAR PERFIL PÚBLICO
// ===============================

async function loadPublicProfile() {
    loading.value = true;
    loadError.value = "";
    entrepreneur.value = null;
    products.value = [];

    try {
        const id = entrepreneurId.value;

        if (!id) {
            loadError.value = "El enlace del emprendimiento no es válido.";
            return;
        }

        // El ID viene de route.params.id, no del usuario conectado.
        const { data: entrepreneurData, error: entrepreneurError } =
            await supabase
                .from("entrepreneurs")
                .select(`
                    id,
                    business_name,
                    description,
                    department,
                    district,
                    logo_url
                `)
                .eq("id", id)
                .maybeSingle();

        if (entrepreneurError) {
            throw entrepreneurError;
        }

        if (!entrepreneurData) {
            loadError.value = "No pudimos encontrar este emprendimiento.";
            return;
        }

        entrepreneur.value = {
            id: entrepreneurData.id,
            businessName: entrepreneurData.business_name,
            description: entrepreneurData.description || "",
            department: entrepreneurData.department || "",
            district: entrepreneurData.district || "",
            avatar: entrepreneurData.logo_url || ""
        };

        await Promise.all([
            loadProducts(id),
            loadFollowState(id),
            loadFollowerCount(id)
        ]);
    } catch (error) {
        console.error("Error al cargar perfil público:", error);
        loadError.value =
            "Ocurrió un problema al cargar este emprendimiento.";
    } finally {
        loading.value = false;
    }
}

// ===============================
// CARGAR PRODUCTOS
// ===============================

async function loadProducts(id) {
    const { data: productRows, error: productError } = await supabase
        .from("products")
        .select(`
            id,
            entrepreneur_id,
            name,
            description,
            categories,
            price,
            stock,
            featured,
            active,
            created_at
        `)
        .eq("entrepreneur_id", id)
        .eq("active", true)
        .order("created_at", {
            ascending: false
        });

    if (productError) {
        throw productError;
    }

    if (!productRows?.length) {
        products.value = [];
        return;
    }

    const productIds = productRows.map(function (product) {
        return product.id;
    });

    const { data: imageRows, error: imageError } = await supabase
        .from("product_images")
        .select(`
            id,
            product_id,
            image_url,
            sort_order
        `)
        .in("product_id", productIds)
        .order("sort_order", {
            ascending: true
        });

    if (imageError) {
        throw imageError;
    }

    products.value = productRows.map(function (product) {
        const images = (imageRows || [])
            .filter(function (image) {
                return image.product_id === product.id;
            })
            .sort(function (a, b) {
                return a.sort_order - b.sort_order;
            })
            .map(function (image) {
                return image.image_url;
            });

        return {
            id: product.id,
            entrepreneurId: product.entrepreneur_id,
            name: product.name,
            description: product.description || "",
            categories: product.categories || [],
            price: Number(product.price) || 0,
            stock: Number(product.stock) || 0,
            featured: product.featured,
            image: images[0] || null,
            images
        };
    });
}

// ===============================
// FOLLOW
// ===============================

async function loadFollowState(id) {
    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
            isFollowing.value = false;
            return;
        }

        const { data, error } = await supabase
            .from("follows")
            .select("id")
            .eq("follower_id", user.id)
            .eq("entrepreneur_id", id)
            .maybeSingle();

        if (error) {
            throw error;
        }

        isFollowing.value = Boolean(data);
    } catch (error) {
        console.error("Error al cargar estado de follow:", error);
        isFollowing.value = false;
    }
}

async function loadFollowerCount(id) {
    try {
        const { data, error } = await supabase.rpc(
            "get_entrepreneur_follower_count",
            {
                p_entrepreneur_id: id
            }
        );

        if (error) {
            throw error;
        }

        followerCount.value = Number(data) || 0;
    } catch (error) {
        console.error("Error al cargar contador de seguidores:", error);
        followerCount.value = 0;
    }
}

async function toggleFollow() {
    if (!entrepreneur.value || followLoading.value) return;

    followLoading.value = true;

    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
            router.push("/auth");
            return;
        }

        const id = entrepreneur.value.id;

        if (user.id === id) {
            alert("No puedes seguir tu propio emprendimiento.");
            return;
        }

        if (isFollowing.value) {
            const { error } = await supabase
                .from("follows")
                .delete()
                .eq("follower_id", user.id)
                .eq("entrepreneur_id", id);

            if (error) {
                throw error;
            }

            isFollowing.value = false;
            followerCount.value = Math.max(
                0,
                followerCount.value - 1
            );

            return;
        }

        const { error } = await supabase
            .from("follows")
            .insert({
                follower_id: user.id,
                entrepreneur_id: id
            });

        if (error) {
            if (error.code === "23505") {
                isFollowing.value = true;
                await loadFollowerCount(id);
                return;
            }

            throw error;
        }

        isFollowing.value = true;
        followerCount.value += 1;
    } catch (error) {
        console.error("Error al actualizar follow:", error);
        alert("No fue posible actualizar el seguimiento.");
    } finally {
        followLoading.value = false;
    }
}

// ===============================
// DETALLE DEL PRODUCTO
// ===============================

function openProductDetail(product) {
    selectedProduct.value = product;
    selectedProductImageIndex.value = 0;
    document.body.style.overflow = "hidden";
}

function closeProductDetail() {
    selectedProduct.value = null;
    selectedProductImageIndex.value = 0;
    document.body.style.overflow = "";
}

function nextProductImage() {
    if (selectedProductImages.value.length <= 1) return;

    selectedProductImageIndex.value =
        (selectedProductImageIndex.value + 1) %
        selectedProductImages.value.length;
}

function previousProductImage() {
    if (selectedProductImages.value.length <= 1) return;

    selectedProductImageIndex.value =
        (
            selectedProductImageIndex.value -
            1 +
            selectedProductImages.value.length
        ) % selectedProductImages.value.length;
}

function handleEscape(event) {
    if (
        event.key === "Escape" &&
        selectedProduct.value
    ) {
        closeProductDetail();
    }
}

// ===============================
// CICLO DE VIDA
// ===============================

onMounted(function () {
    loadPublicProfile();
    document.addEventListener("keydown", handleEscape);
});

watch(
    function () {
        return route.params.id;
    },
    function () {
        loadPublicProfile();
    }
);

onBeforeUnmount(function () {
    document.removeEventListener("keydown", handleEscape);
    document.body.style.overflow = "";
});
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

                <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-bold text-white">
                        {{ entrepreneur?.businessName || "Perfil del emprendimiento" }}
                    </p>
                </div>
            </div>
        </div>
    </header>

    <!-- Cargando -->
    <main
        v-if="loading"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center"
    >
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        <p class="mt-4 text-sm font-semibold text-gray-400">
            Cargando emprendimiento...
        </p>
    </main>

    <!-- Error -->
    <main
        v-else-if="loadError"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center"
    >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 font-black text-red-600">
            !
        </div>

        <h1 class="mt-4 text-xl font-black text-gray-700">
            No pudimos cargar el perfil
        </h1>

        <p class="mt-2 text-sm text-gray-400">
            {{ loadError }}
        </p>

        <button
            type="button"
            class="mt-5 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white"
            @click="loadPublicProfile"
        >
            Intentar nuevamente
        </button>
    </main>

    <!-- Contenido -->
    <main
        v-else-if="entrepreneur"
        class="mx-auto max-w-[1450px] px-3 pb-10 pt-4 sm:px-5 lg:px-8"
    >
        <!-- Perfil público -->
        <section class="bg-white px-4 py-6 sm:rounded-[24px] sm:px-7">
            <div class="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
                <img
                    v-if="entrepreneur.avatar"
                    :src="entrepreneur.avatar"
                    :alt="entrepreneur.businessName"
                    class="h-24 w-24 rounded-full border-4 border-[#CAF0F8] object-cover sm:h-28 sm:w-28"
                >

                <div
                    v-else
                    class="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#CAF0F8] bg-[#EAF9FC] text-2xl font-black text-[#0077B6] sm:h-28 sm:w-28"
                >
                    {{ entrepreneurInitials }}
                </div>

                <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                        Emprendimiento
                    </p>

                    <h1 class="mt-1 text-2xl font-black text-gray-700 sm:text-3xl">
                        {{ entrepreneur.businessName }}
                    </h1>

                    <p class="mt-1 text-sm text-gray-400">
                        {{ entrepreneur.district }}, {{ entrepreneur.department }}
                    </p>

                    <p class="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
                        {{ entrepreneur.description || "Este emprendimiento aún no tiene una descripción." }}
                    </p>

                    <div class="mt-4 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
                        <span class="text-sm font-bold text-gray-600">
                            {{ followerCountText }}
                        </span>

                        <button
                            type="button"
                            :disabled="followLoading"
                            class="rounded-full border px-4 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50"
                            :class="
                                isFollowing
                                    ? 'border-[#00B4D8] bg-[#CAF0F8] text-[#0077B6]'
                                    : 'border-[#00B4D8] text-[#0077B6]'
                            "
                            @click="toggleFollow"
                        >
                            {{
                                followLoading
                                    ? "Actualizando..."
                                    : isFollowing
                                        ? "Siguiendo"
                                        : "Seguir +"
                            }}
                        </button>
                    </div>
                </div>
            </div>
        </section>

        <!-- Productos -->
        <section class="mt-7">
            <div class="mb-5">
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                    Catálogo
                </p>
                <h2 class="mt-1 text-2xl font-black text-gray-700">
                    Productos de {{ entrepreneur.businessName }}
                </h2>
            </div>

            <div
                v-if="products.length"
                class="grid grid-cols-2 gap-x-2 gap-y-5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
            >
                <article
                    v-for="product in products"
                    :key="product.id"
                    class="min-w-0 cursor-pointer overflow-hidden bg-transparent"
                    @click="openProductDetail(product)"
                >
                    <div class="overflow-hidden rounded-xl bg-gray-100 sm:rounded-2xl">
                        <img
                            v-if="product.image"
                            :src="product.image"
                            :alt="product.name"
                            class="aspect-square w-full object-cover"
                        >

                        <div
                            v-else
                            class="flex aspect-square items-center justify-center text-xs font-bold text-gray-400"
                        >
                            Sin imagen
                        </div>
                    </div>

                    <div class="pt-1.5 sm:px-1 sm:pt-3">
                        <div class="mb-1 flex flex-wrap gap-1">
                            <span
                                v-for="category in product.categories.slice(0, 1)"
                                :key="category"
                                class="text-[9px] font-bold uppercase text-[#00B4D8]"
                            >
                                {{ category }}
                            </span>
                        </div>

                        <h3 class="min-h-[30px] text-[11px] font-medium leading-tight text-gray-500 sm:min-h-[40px] sm:text-sm">
                            {{ product.name }}
                        </h3>

                        <p class="mt-1 text-base font-extrabold text-[#4F7180] sm:text-xl">
                            {{ formatPrice(product.price) }}
                        </p>
                    </div>
                </article>
            </div>

            <div
                v-else
                class="rounded-[24px] border border-dashed border-[#90E0EF] bg-white px-5 py-16 text-center"
            >
                <p class="font-black text-gray-700">
                    Este emprendimiento aún no tiene productos publicados.
                </p>
            </div>
        </section>
    </main>

    <!-- Detalle del producto -->
    <Teleport to="body">
        <div
            v-if="selectedProduct"
            class="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
            @click.self="closeProductDetail"
        >
            <section class="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[900px] sm:rounded-[28px]">
                <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Producto
                        </p>
                        <h2 class="font-bold text-gray-700">
                            {{ selectedProduct.name }}
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                        @click="closeProductDetail"
                    >
                        ×
                    </button>
                </div>

                <div class="grid md:grid-cols-2">
                    <div class="bg-gray-50 p-4 sm:p-6">
                        <div class="relative overflow-hidden rounded-2xl bg-gray-100">
                            <img
                                v-if="selectedProductImage"
                                :src="selectedProductImage"
                                :alt="selectedProduct.name"
                                class="aspect-square w-full object-cover"
                            >

                            <div
                                v-else
                                class="flex aspect-square items-center justify-center text-sm font-bold text-gray-400"
                            >
                                Sin fotografía
                            </div>

                            <template v-if="selectedProductImages.length > 1">
                                <button
                                    type="button"
                                    class="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-gray-600 shadow"
                                    @click="previousProductImage"
                                >
                                    ‹
                                </button>

                                <button
                                    type="button"
                                    class="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-gray-600 shadow"
                                    @click="nextProductImage"
                                >
                                    ›
                                </button>
                            </template>
                        </div>

                        <div
                            v-if="selectedProductImages.length > 1"
                            class="mt-3 flex gap-2 overflow-x-auto"
                        >
                            <button
                                v-for="(image, index) in selectedProductImages"
                                :key="image"
                                type="button"
                                class="h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2"
                                :class="
                                    selectedProductImageIndex === index
                                        ? 'border-[#00B4D8]'
                                        : 'border-transparent'
                                "
                                @click="selectedProductImageIndex = index"
                            >
                                <img
                                    :src="image"
                                    alt="Fotografía del producto"
                                    class="h-full w-full object-cover"
                                >
                            </button>
                        </div>
                    </div>

                    <div class="p-5 sm:p-7">
                        <div class="flex flex-wrap gap-2">
                            <span
                                v-for="category in selectedProduct.categories"
                                :key="category"
                                class="rounded-full bg-[#CAF0F8] px-3 py-1.5 text-xs font-bold text-[#0077B6]"
                            >
                                {{ category }}
                            </span>
                        </div>

                        <h2 class="mt-4 text-2xl font-black text-gray-700">
                            {{ selectedProduct.name }}
                        </h2>

                        <p class="mt-4 text-3xl font-extrabold text-[#4F7180]">
                            {{ formatPrice(selectedProduct.price) }}
                        </p>

                        <p class="mt-6 whitespace-pre-line text-sm leading-relaxed text-gray-500">
                            {{ selectedProduct.description || "Este producto no tiene una descripción." }}
                        </p>
                    </div>
                </div>
            </section>
        </div>
    </Teleport>
</div>
</template>
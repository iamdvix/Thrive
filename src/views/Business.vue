<script setup>
// Perfil público del emprendimiento; muestra información, productos, seguidores y contacto.
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";
const route = useRoute();
const router = useRouter();
const entrepreneur = ref(null);
const products = ref([]);
const loading = ref(true);
const loadError = ref("");
const isFollowing = ref(false);
const followLoading = ref(false);
const followerCount = ref(0);
// Identificamos quién está viendo el perfil para usar el sistema correcto.
const viewerUserId = ref("");
const viewerType = ref("");
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
const canFollow = computed(function () {
    return [
        "cliente",
        "institucion"
    ].includes(
        viewerType.value
    );
});
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
    router.push({ name: "Catalog" });
}
// Carga el tipo de usuario que está viendo el emprendimiento.
async function loadViewerContext() {
    viewerUserId.value = "";
    viewerType.value = "";
    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();
        if (userError || !user) {
            return;
        }
        viewerUserId.value =
            user.id;
        const { data, error } = await supabase
            .from("profiles")
            .select("user_type")
            .eq("id", user.id)
            .maybeSingle();
        if (error) {
            throw error;
        }
        viewerType.value =
            data?.user_type || "";
    } catch (error) {
        console.warn(
            "No se pudo identificar el tipo de usuario:",
            error
        );
    }
}
// Carga el perfil público y la información relacionada.
async function loadPublicProfile() {
    loading.value = true;
    loadError.value = "";
    entrepreneur.value = null;
    products.value = [];
    try {
        const id = entrepreneurId.value;
        if (!id) {
            loadError.value =
                "El enlace del emprendimiento no es válido.";
            return;
        }
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
            loadError.value =
                "No pudimos encontrar este emprendimiento.";
            return;
        }
        entrepreneur.value = {
            id: entrepreneurData.id,
            businessName:
                entrepreneurData.business_name,
            description:
                entrepreneurData.description || "",
            department:
                entrepreneurData.department || "",
            district:
                entrepreneurData.district || "",
            avatar:
                entrepreneurData.logo_url || "",
            whatsapp: ""
        };
        // Primero identificamos si entra un cliente o una institución.
        await loadViewerContext();
        await Promise.all([
            loadProducts(id),
            loadFollowState(id),
            loadFollowerCount(id),
            loadWhatsapp(id)
        ]);
    } catch (error) {
        console.error(
            "Error al cargar perfil público:",
            error
        );
        loadError.value =
            "Ocurrió un problema al cargar este emprendimiento.";
    } finally {
        loading.value = false;
    }
}
// Obtiene el promedio de reseñas de los productos del emprendimiento.
async function loadReviewSummary(productIds) {
    if (!productIds.length) return {};
    const { data, error } = await supabase
        .from("product_reviews")
        .select("product_id, rating")
        .in("product_id", productIds);
    if (error) {
        console.error(
            "No se pudieron cargar las reseñas:",
            error
        );
        return {};
    }
    const summary = {};
    for (const review of data || []) {
        if (!summary[review.product_id]) {
            summary[review.product_id] = {
                total: 0,
                count: 0
            };
        }
        summary[review.product_id].total +=
            Number(review.rating) || 0;
        summary[review.product_id].count += 1;
    }
    return summary;
}
// Carga los productos y su promedio de reseñas.
async function loadProducts(id) {
    const { data: productRows, error: productError } =
        await supabase
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
    const { data: imageRows, error: imageError } =
        await supabase
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
    const reviewSummary =
        await loadReviewSummary(productIds);
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
        const reviews =
            reviewSummary[product.id];
        return {
            id: product.id,
            entrepreneurId:
                product.entrepreneur_id,
            name:
                product.name,
            description:
                product.description || "",
            categories:
                product.categories || [],
            price:
                Number(product.price) || 0,
            stock:
                Number(product.stock) || 0,
            featured:
                product.featured,
            image:
                images[0] || null,
            images,
            averageRating:
                reviews?.count
                    ? reviews.total / reviews.count
                    : 0,
            reviewCount:
                reviews?.count || 0
        };
    });
}
// Carga el teléfono del emprendimiento sin exponer otros datos del perfil.
async function loadWhatsapp(id) {
    try {
        const { data, error } = await supabase.rpc(
            "get_entrepreneur_public_contact",
            {
                target_entrepreneur_id: id
            }
        );
        if (error) {
            throw error;
        }
        if (entrepreneur.value) {
            entrepreneur.value.whatsapp =
                data?.[0]?.phone || "";
        }
    } catch (error) {
        console.warn(
            "No se pudo cargar el WhatsApp del emprendimiento:",
            error
        );
    }
}
async function loadFollowState(id) {
    try {
        if (!viewerUserId.value) {
            isFollowing.value = false;
            return;
        }
        /*
            Las instituciones usan institution_follows.
            Los clientes conservan el sistema follows que ya tenía Thrive.
        */
        if (viewerType.value === "institucion") {
            const { data, error } = await supabase.rpc(
                "is_institution_following",
                {
                    target_entrepreneur_id:
                        id
                }
            );
            if (error) {
                throw error;
            }
            isFollowing.value =
                data === true;
            return;
        }
        if (viewerType.value === "cliente") {
            const { data, error } = await supabase
                .from("follows")
                .select("id")
                .eq(
                    "follower_id",
                    viewerUserId.value
                )
                .eq(
                    "entrepreneur_id",
                    id
                )
                .maybeSingle();
            if (error) {
                throw error;
            }
            isFollowing.value =
                Boolean(data);
            return;
        }
        isFollowing.value = false;
    } catch (error) {
        console.error(
            "Error al cargar estado de follow:",
            error
        );
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
        followerCount.value =
            Number(data) || 0;
    } catch (error) {
        console.error(
            "Error al cargar contador de seguidores:",
            error
        );
        followerCount.value = 0;
    }
}
async function toggleFollow() {
    if (
        !entrepreneur.value ||
        followLoading.value ||
        !canFollow.value
    ) {
        return;
    }
    followLoading.value = true;
    try {
        if (!viewerUserId.value) {
            router.push({ name: "Access" });
            return;
        }
        const id =
            entrepreneur.value.id;
        /*
            La institución sigue el emprendimiento con su propia tabla.
            Para el contador público, clientes e instituciones sí cuentan
            juntos como seguidores del emprendimiento.
        */
        if (viewerType.value === "institucion") {
            const { data, error } = await supabase.rpc(
                "toggle_institution_follow",
                {
                    target_entrepreneur_id:
                        id
                }
            );
            if (error) {
                throw error;
            }
            isFollowing.value =
                data === true;
            /*
                Volvemos a consultar el estado y el contador total.
                Así se incluyen tanto clientes como instituciones.
            */
            await Promise.all([
                loadFollowState(id),
                loadFollowerCount(id)
            ]);
            return;
        }
        // El cliente conserva el funcionamiento original.
        if (viewerType.value !== "cliente") {
            return;
        }
        if (viewerUserId.value === id) {
            alert(
                "No puedes seguir tu propio emprendimiento."
            );
            return;
        }
        if (isFollowing.value) {
            const { error } = await supabase
                .from("follows")
                .delete()
                .eq(
                    "follower_id",
                    viewerUserId.value
                )
                .eq(
                    "entrepreneur_id",
                    id
                );
            if (error) {
                throw error;
            }
            isFollowing.value = false;
            // Leemos el total real para no perder los seguidores institucionales.
            await loadFollowerCount(id);
            return;
        }
        const { error } = await supabase
            .from("follows")
            .insert({
                follower_id:
                    viewerUserId.value,
                entrepreneur_id:
                    id
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
        // El total público se vuelve a leer desde Supabase.
        await loadFollowerCount(id);
    } catch (error) {
        console.error(
            "Error al actualizar follow:",
            error
        );
        alert(
            "No fue posible actualizar el seguimiento: " +
            (error.message || "Error inesperado")
        );
    } finally {
        followLoading.value = false;
    }
}
// Abre el producto en la pantalla independiente de detalle.
function openProductDetail(product) {
    if (!product?.id) return;
    router.push({
        name: "Product",
        params: {
            id: product.id
        }
    });
}
// Abre WhatsApp con un mensaje dirigido al emprendimiento.
function contactWhatsApp() {
    if (!entrepreneur.value) return;
    const message =
        encodeURIComponent(
            `Hola, vi el perfil de ${entrepreneur.value.businessName} en Thrive y quisiera obtener más información.`
        );
    const rawWhatsapp =
        String(
            entrepreneur.value.whatsapp || ""
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
onMounted(function () {
    loadPublicProfile();
});
watch(
    function () {
        return route.params.id;
    },
    function () {
        loadPublicProfile();
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
                    <div class="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                        <span class="mr-1 text-sm font-bold text-gray-600">
                            {{ followerCountText }}
                        </span>
                        <button
                            v-if="canFollow"
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
                        <button
                            type="button"
                            class="flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-xs font-bold text-white"
                            @click="contactWhatsApp"
                        >
                            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.003a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.885 9.887-9.885 2.64 0 5.122 1.03 6.988 2.897a9.825 9.825 0 012.895 6.993c-.003 5.45-4.437 9.887-9.887 9.887"></path>
                            </svg>
                            WhatsApp
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
                        <div class="mt-1 flex items-center gap-1 text-[10px] sm:text-xs">
                            <span class="text-amber-500">★</span>
                            <span class="font-bold text-gray-600">
                                {{ Number(product.averageRating).toFixed(1) }}
                            </span>
                            <span class="text-gray-400">
                                {{ product.reviewCount }} reseñas
                            </span>
                        </div>
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
</div>
</template>

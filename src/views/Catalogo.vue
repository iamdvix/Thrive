<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";
import {
    uploadProfileImage,
    deleteImage,
    getStoragePathFromPublicUrl
} from "../lib/storage";

const router = useRouter();

// ===============================
// PERFIL DEL CLIENTE
// ===============================

// Información real del cliente conectado.
const clientProfile = ref(null);
const profileLoading = ref(false);
const profileSaving = ref(false);

// Controla la ventana del perfil.
const showClientProfile = ref(false);

// Información editable.
const profileForm = ref({
    fullName: "",
    phone: ""
});

// Archivo real de la nueva fotografía.
const profilePhotoFile = ref(null);

// Imagen que mostramos como vista previa.
const profilePhotoPreview = ref("");

// ===============================
// PRODUCTOS
// ===============================

// Productos reales provenientes de Supabase.
const products = ref([]);
const loadingProducts = ref(false);
const productsError = ref("");

// Controles de búsqueda.
const searchText = ref("");
const selectedDepartment = ref("Todos");

// Seguimientos.
// Por ahora continúan siendo locales hasta crear la tabla follows.
// Emprendimientos que el cliente sigue realmente en Supabase.
const followedEntrepreneurs = ref([]);

// Evita múltiples clics mientras se guarda o elimina un follow.
const followLoading = ref([]);

// ===============================
// DETALLE DEL PRODUCTO
// ===============================

const selectedProduct = ref(null);
const selectedProductImageIndex = ref(0);

// ===============================
// CARGAR PERFIL DEL CLIENTE
// ===============================

async function loadClientProfile() {
    profileLoading.value = true;

    try {
        // Obtenemos el usuario actualmente autenticado.
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
            console.error(
                "No se encontró una sesión activa:",
                userError
            );

            router.replace("/auth");
            return;
        }

        /*
            Buscamos el perfil utilizando el mismo UUID
            del usuario de Supabase Authentication.
        */
        const { data, error } = await supabase
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

        if (error) {
            console.error(
                "No se pudo cargar el perfil:",
                error
            );

            return;
        }

        clientProfile.value = {
            id: data.id,
            fullName: data.full_name || "",
            phone: data.phone || "",
            avatarUrl: data.avatar_url || "",
            email: user.email || ""
        };
    } catch (error) {
        console.error(
            "Error inesperado al cargar el perfil:",
            error
        );
    } finally {
        profileLoading.value = false;
    }
}

// ===============================
// ABRIR PERFIL
// ===============================

function openClientProfile() {
    if (!clientProfile.value) return;

    // Copiamos los datos actuales al formulario.
    profileForm.value = {
        fullName:
            clientProfile.value.fullName || "",

        phone:
            clientProfile.value.phone || ""
    };

    // Mostramos inicialmente la fotografía actual.
    profilePhotoPreview.value =
        clientProfile.value.avatarUrl || "";

    // No existe una nueva fotografía hasta que se seleccione.
    profilePhotoFile.value = null;

    showClientProfile.value = true;
    document.body.style.overflow = "hidden";
}

// Cierra la ventana del perfil.
function closeClientProfile() {
    showClientProfile.value = false;
    profilePhotoFile.value = null;
    profilePhotoPreview.value = "";
    document.body.style.overflow = "";
}

// ===============================
// FOTO DEL CLIENTE
// ===============================

function handleProfilePhoto(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    // Solo permitimos imágenes.
    if (!file.type.startsWith("image/")) {
        alert(
            "Selecciona un archivo de imagen válido."
        );

        event.target.value = "";
        return;
    }

    // Limitamos también a 5 MB desde la interfaz.
    if (file.size > 5 * 1024 * 1024) {
        alert(
            "La fotografía no puede superar los 5 MB."
        );

        event.target.value = "";
        return;
    }

    // Guardamos el archivo verdadero.
    profilePhotoFile.value = file;

    // Creamos la vista previa.
    const reader = new FileReader();

    reader.onload = function (loadEvent) {
        profilePhotoPreview.value =
            loadEvent.target.result;
    };

    reader.readAsDataURL(file);
}

// ===============================
// GUARDAR PERFIL
// ===============================

// Actualiza los datos y la fotografía del cliente.
async function saveClientProfile() {
    if (
        !clientProfile.value ||
        profileSaving.value
    ) {
        return;
    }

    if (!profileForm.value.fullName.trim()) {
        alert(
            "Escribe tu nombre antes de guardar."
        );

        return;
    }

    profileSaving.value = true;

    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
            alert(
                "No fue posible verificar tu sesión."
            );

            return;
        }

        /*
            Guardamos la URL anterior antes de realizar cambios.

            De esta manera, después podremos eliminar
            el archivo antiguo de Storage.
        */
        const oldAvatarUrl =
            clientProfile.value.avatarUrl || null;

        const oldAvatarPath =
            getStoragePathFromPublicUrl(
                oldAvatarUrl
            );

        // Por defecto conservamos la foto actual.
        let avatarUrl =
            oldAvatarUrl;

        let newPhotoUploaded = false;

        /*
            Si seleccionó una foto nueva,
            primero la subimos a Storage.
        */
        if (profilePhotoFile.value) {
            const uploadedPhoto =
                await uploadProfileImage(
                    user.id,
                    profilePhotoFile.value
                );

            avatarUrl =
                uploadedPhoto.publicUrl;

            newPhotoUploaded = true;
        }

        /*
            Actualizamos profiles.

            En este momento avatar_url comienza
            a apuntar a la fotografía nueva.
        */
        const { data, error } =
            await supabase
                .from("profiles")
                .update({
                    full_name:
                        profileForm.value.fullName.trim(),

                    phone:
                        profileForm.value.phone.trim(),

                    avatar_url:
                        avatarUrl
                })
                .eq(
                    "id",
                    user.id
                )
                .select(`
                    id,
                    full_name,
                    phone,
                    avatar_url
                `)
                .single();

        if (error) {
            console.error(
                "Error al actualizar el perfil:",
                error
            );

            alert(
                "No se pudo actualizar el perfil: " +
                error.message
            );

            return;
        }

        /*
            Solamente después de que la base de datos
            haya guardado correctamente la nueva URL,
            eliminamos la fotografía anterior.

            Este orden es importante.

            Nunca eliminamos primero la foto antigua,
            porque si después falla el UPDATE,
            el usuario podría quedarse sin fotografía.
        */
        if (
            newPhotoUploaded &&
            oldAvatarPath
        ) {
            try {
                await deleteImage(
                    oldAvatarPath
                );
            } catch (deleteError) {
                /*
                    El perfil ya se actualizó correctamente.

                    Si falla la limpieza del archivo antiguo,
                    no impedimos que el usuario continúe.
                */
                console.warn(
                    "La foto nueva se guardó, pero no se pudo eliminar la anterior:",
                    deleteError
                );
            }
        }

        // Actualizamos inmediatamente la interfaz.
        clientProfile.value = {
            ...clientProfile.value,

            fullName:
                data.full_name || "",

            phone:
                data.phone || "",

            avatarUrl:
                data.avatar_url || ""
        };

        alert(
            "Tu perfil fue actualizado correctamente."
        );

        closeClientProfile();
    } catch (error) {
        console.error(
            "Error al guardar el perfil:",
            error
        );

        alert(
            "Ocurrió un problema al guardar los cambios."
        );
    } finally {
        profileSaving.value = false;
    }
}

// ===============================
// CERRAR SESIÓN
// ===============================

async function logout() {
    try {
        /*
            Cerramos únicamente la sesión actual.

            Después enviamos al usuario directamente
            a la pantalla de autenticación.
        */
        const { error } =
            await supabase.auth.signOut({
                scope: "local"
            });

        if (error) {
            console.error(
                "Error al cerrar sesión:",
                error
            );

            alert(
                "No fue posible cerrar la sesión."
            );

            return;
        }

        closeClientProfile();

        router.replace("/auth");
    } catch (error) {
        console.error(
            "Error inesperado al cerrar sesión:",
            error
        );

        alert(
            "Ocurrió un problema al cerrar la sesión."
        );
    }
}

// ===============================
// CARGAR PRODUCTOS REALES
// ===============================

async function loadProducts() {
    loadingProducts.value = true;
    productsError.value = "";

    try {
        /*
            Obtenemos los productos reales.

            También pedimos:
            - Información del emprendimiento.
            - Todas las fotografías del producto.
        */
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
                featured,
                active,
                created_at,

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
                    storage_path,
                    sort_order
                )
            `)
            .eq("active", true)
            .order(
                "created_at",
                {
                    ascending: false
                }
            );

        if (error) {
            throw error;
        }

        products.value = (data || []).map(
            function (product) {
                /*
                    Ordenamos las fotografías para que
                    sort_order = 0 sea siempre la portada.
                */
                const imageRecords = (
                    product.product_images || []
                )
                    .slice()
                    .sort(function (a, b) {
                        return (
                            a.sort_order -
                            b.sort_order
                        );
                    });

                const images =
                    imageRecords.map(
                        function (image) {
                            return image.image_url;
                        }
                    );

                const store =
                    product.entrepreneurs;

                return {
                    id:
                        product.id,

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

                    store:
                        store?.business_name ||
                        "Emprendimiento",

                    storeAvatar:
                        store?.logo_url || "",

                    department:
                        store?.department || "",

                    district:
                        store?.district || "",

                    // Las reseñas se conectarán después.
                    rating:
                        0,

                    // El número de WhatsApp lo conectaremos después.
                    whatsapp:
                        ""
                };
            }
        );
    } catch (error) {
        console.error(
            "No se pudieron cargar los productos:",
            error
        );

        productsError.value =
            "No fue posible cargar los productos.";
    } finally {
        loadingProducts.value = false;
    }
}

// ===============================
// FILTROS
// ===============================

const departments = computed(function () {
    const availableDepartments =
        products.value
            .map(function (product) {
                return product.department;
            })
            .filter(Boolean);

    return [
        "Todos",
        ...new Set(availableDepartments)
    ];
});

const filteredProducts = computed(function () {
    const search =
        searchText.value
            .toLowerCase()
            .trim();

    return products.value.filter(
        function (product) {
            /*
                Ahora buscamos también dentro
                de todas las categorías.
            */
            const searchableText = [
                product.name,
                product.store,
                ...(product.categories || [])
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            const matchesSearch =
                !search ||
                searchableText.includes(search);

            const matchesDepartment =
                selectedDepartment.value ===
                    "Todos" ||
                product.department ===
                    selectedDepartment.value;

            return (
                matchesSearch &&
                matchesDepartment
            );
        }
    );
});

const featuredProducts = computed(function () {
    return products.value.filter(
        function (product) {
            return product.featured;
        }
    );
});

const productCountText = computed(function () {
    const total =
        filteredProducts.value.length;

    return total === 1
        ? "1 producto encontrado"
        : `${total} productos encontrados`;
});

// ===============================
// FOTO / INICIALES DEL CLIENTE
// ===============================

const clientInitials = computed(function () {
    const name =
        clientProfile.value?.fullName ||
        "Cliente";

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

// ===============================
// PRODUCTO SELECCIONADO
// ===============================

const selectedProductImages = computed(
    function () {
        return (
            selectedProduct.value?.images ||
            []
        );
    }
);

const selectedProductImage = computed(
    function () {
        if (
            !selectedProductImages.value.length
        ) {
            return null;
        }

        return (
            selectedProductImages.value[
                selectedProductImageIndex.value
            ] ||
            selectedProductImages.value[0]
        );
    }
);

// ===============================
// FUNCIONES GENERALES
// ===============================

function getInitials(store) {
    if (!store) return "TH";

    return store
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

function ratingText(rating) {
    const value = Math.max(
        0,
        Math.min(
            5,
            Math.round(
                Number(rating) || 0
            )
        )
    );

    return (
        "★".repeat(value) +
        "☆".repeat(5 - value)
    );
}

function formatPrice(price) {
    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD"
        }
    ).format(Number(price) || 0);
}


// ===============================
// SISTEMA DE FOLLOW
// ===============================

// Carga los emprendimientos que sigue el cliente conectado.
async function loadFollows() {
    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
            followedEntrepreneurs.value = [];
            return;
        }

        const { data, error } = await supabase
            .from("follows")
            .select("entrepreneur_id")
            .eq("follower_id", user.id);

        if (error) {
            throw error;
        }

        followedEntrepreneurs.value = (data || []).map(function (row) {
            return row.entrepreneur_id;
        });
    } catch (error) {
        console.error("Error al cargar follows:", error);
        followedEntrepreneurs.value = [];
    }
}

function isFollowing(entrepreneurId) {
    return followedEntrepreneurs.value.includes(entrepreneurId);
}

function isFollowLoading(entrepreneurId) {
    return followLoading.value.includes(entrepreneurId);
}

// Sigue o deja de seguir un emprendimiento y guarda el cambio en Supabase.
async function toggleFollow(entrepreneurId) {
    if (!entrepreneurId || isFollowLoading(entrepreneurId)) return;

    followLoading.value.push(entrepreneurId);

    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
            router.replace("/auth");
            return;
        }

        if (isFollowing(entrepreneurId)) {
            const { error } = await supabase
                .from("follows")
                .delete()
                .eq("follower_id", user.id)
                .eq("entrepreneur_id", entrepreneurId);

            if (error) {
                throw error;
            }

            followedEntrepreneurs.value =
                followedEntrepreneurs.value.filter(function (id) {
                    return id !== entrepreneurId;
                });

            return;
        }

        const { error } = await supabase
            .from("follows")
            .insert({
                follower_id: user.id,
                entrepreneur_id: entrepreneurId
            });

        if (error) {
            // Si ya existía el follow, recargamos el estado y no mostramos error.
            if (error.code === "23505") {
                await loadFollows();
                return;
            }

            throw error;
        }

        followedEntrepreneurs.value.push(entrepreneurId);
    } catch (error) {
        console.error("Error al actualizar follow:", error);
        alert("No fue posible actualizar el seguimiento.");
    } finally {
        followLoading.value =
            followLoading.value.filter(function (id) {
                return id !== entrepreneurId;
            });
    }
}

// ===============================
// PERFIL DEL EMPRENDEDOR
// ===============================

function openEntrepreneurProfile(
    entrepreneurId
) {
    router.push({
        name: "PerfilEmprendedor",
        params: {
            id: entrepreneurId
        }
    });
}

// ===============================
// DETALLE DEL PRODUCTO
// ===============================

function openProductDetail(product) {
    selectedProduct.value = product;
    selectedProductImageIndex.value = 0;

    document.body.style.overflow =
        "hidden";
}

function closeProductDetail() {
    selectedProduct.value = null;
    selectedProductImageIndex.value = 0;

    document.body.style.overflow = "";
}

function nextProductImage() {
    if (
        selectedProductImages.value.length <= 1
    ) {
        return;
    }

    selectedProductImageIndex.value =
        (
            selectedProductImageIndex.value +
            1
        ) %
        selectedProductImages.value.length;
}

function previousProductImage() {
    if (
        selectedProductImages.value.length <= 1
    ) {
        return;
    }

    selectedProductImageIndex.value =
        (
            selectedProductImageIndex.value -
            1 +
            selectedProductImages.value.length
        ) %
        selectedProductImages.value.length;
}

// ===============================
// WHATSAPP
// ===============================

function contactWhatsApp(product) {
    const message =
        encodeURIComponent(
            `Hola, estoy interesado/a en "${product.name}" de ${product.store}. Quisiera obtener más información sobre el producto.`
        );

    const whatsapp =
        String(
            product.whatsapp || ""
        ).replace(/\D/g, "");

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

// ===============================
// TECLADO
// ===============================

function handleEscape(event) {
    if (event.key !== "Escape") return;

    if (selectedProduct.value) {
        closeProductDetail();
        return;
    }

    if (showClientProfile.value) {
        closeClientProfile();
    }
}

// ===============================
// INICIO
// ===============================

onMounted(async function () {
    /*
        Cargamos perfil y productos al mismo tiempo
        para que el catálogo aparezca más rápido.
    */
    await Promise.all([
        loadClientProfile(),
        loadProducts(),
        loadFollows()
    ]);

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
<div class="min-h-screen bg-white pb-[72px] text-gray-700 lg:pb-0">

    <!-- ================= CABECERA ================= -->
    <header class="sticky top-0 z-40 border-b border-gray-100 bg-white">

        <div class="mx-auto max-w-[1450px] px-2 pt-2 sm:px-5 lg:px-8 lg:pt-4">

            <!-- Isla superior -->
            <div class="flex items-center gap-1 rounded-[24px] bg-[#00B4D8] p-1.5 sm:gap-2 sm:p-2">

                <!-- Buscador -->
                <div class="flex min-w-0 flex-1 items-center rounded-full bg-white px-3 py-2">

                    <svg
                        class="mr-2 h-5 w-5 shrink-0 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            cx="11"
                            cy="11"
                            r="7"
                        ></circle>

                        <path
                            stroke-linecap="round"
                            d="m20 20-3.5-3.5"
                        ></path>
                    </svg>

                    <input
                        v-model="searchText"
                        type="text"
                        placeholder="Buscar productos o tiendas"
                        class="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none placeholder:text-gray-400"
                    >
                </div>

                <!-- Perfil del cliente -->
                <button
                    type="button"
                    aria-label="Mi perfil"
                    class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-white transition hover:bg-white/20"
                    @click="openClientProfile"
                >
                    <!-- Foto real -->
                    <img
                        v-if="clientProfile?.avatarUrl"
                        :src="clientProfile.avatarUrl"
                        :alt="clientProfile.fullName"
                        class="h-8 w-8 rounded-full border-2 border-white/70 object-cover"
                    >

                    <!-- Iniciales -->
                    <span
                        v-else-if="clientProfile"
                        class="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-[10px] font-black text-white"
                    >
                        {{ clientInitials }}
                    </span>

                    <!-- Icono mientras carga -->
                    <svg
                        v-else
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            cx="12"
                            cy="8"
                            r="4"
                        ></circle>

                        <path
                            stroke-linecap="round"
                            d="M4 21a8 8 0 0116 0"
                        ></path>
                    </svg>
                </button>

                <!-- Mensajes -->
                <button
                    type="button"
                    aria-label="Mensajes"
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/20"
                >
                    <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linejoin="round"
                            d="M4 5h16v12H8l-4 3V5z"
                        ></path>

                        <path
                            stroke-linecap="round"
                            d="M8 9h8M8 13h5"
                        ></path>
                    </svg>
                </button>

                <!-- Notificaciones -->
                <button
                    type="button"
                    aria-label="Notificaciones"
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/20"
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
                            d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
                        ></path>
                    </svg>
                </button>
            </div>

            <!-- Departamentos -->
            <div class="mt-2 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

                <button
                    v-for="department in departments"
                    :key="department"
                    type="button"
                    class="whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition sm:text-sm"
                    :class="
                        selectedDepartment === department
                            ? 'bg-[#00B4D8] text-white'
                            : 'bg-[#CAF0F8] text-[#0077B6] hover:bg-[#90E0EF]'
                    "
                    @click="selectedDepartment = department"
                >
                    {{ department }}
                </button>
            </div>

            <!-- Navegación computadora -->
            <nav class="hidden items-center justify-between border-t border-gray-100 py-3 lg:flex">

                <div class="flex items-center gap-6">

                    <RouterLink
                        to="/catalogo"
                        class="font-bold text-[#0077B6]"
                    >
                        Inicio
                    </RouterLink>

                    <a
                        href="#productos"
                        class="text-sm font-semibold text-gray-500 hover:text-[#0077B6]"
                    >
                        Explorar
                    </a>

                    <a
                        href="#"
                        class="text-sm font-semibold text-gray-500 hover:text-[#0077B6]"
                    >
                        Bandeja
                    </a>

                    <!-- Perfil -->
                    <button
                        type="button"
                        class="text-sm font-semibold text-gray-500 hover:text-[#0077B6]"
                        @click="openClientProfile"
                    >
                        Mi perfil
                    </button>
                </div>

                <p class="text-sm text-gray-400">
                    Descubre productos de emprendimientos salvadoreños
                </p>
            </nav>
        </div>
    </header>

    <!-- ================= CATÁLOGO ================= -->
    <main
        id="productos"
        class="mx-auto max-w-[1450px] px-1.5 pb-6 pt-3 sm:px-5 sm:pt-5 lg:px-8"
    >

        <!-- Destacados -->
        <section
            v-if="featuredProducts.length"
            class="mb-7"
        >
            <div class="mb-3 flex items-end justify-between px-1">

                <div>
                    <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                        Recomendados para ti
                    </p>

                    <h1 class="mt-0.5 text-xl font-black text-gray-700 sm:text-2xl">
                        Productos destacados
                    </h1>
                </div>
            </div>

            <div class="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

                <div class="flex w-max gap-3 pb-2 sm:gap-4">

                    <article
                        v-for="product in featuredProducts"
                        :key="`featured-${product.id}`"
                        class="w-[165px] shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-[#90E0EF]/50 bg-white p-2 sm:w-[215px]"
                        @click="openProductDetail(product)"
                    >

                        <!-- Emprendimiento -->
                        <button
                            type="button"
                            class="mb-2 flex min-w-0 items-center gap-2 text-left"
                            @click.stop="openEntrepreneurProfile(product.entrepreneurId)"
                        >

                            <img
                                v-if="product.storeAvatar"
                                :src="product.storeAvatar"
                                :alt="product.store"
                                class="h-8 w-8 shrink-0 rounded-full border border-gray-100 object-cover"
                            >

                            <div
                                v-else
                                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#CAF0F8] text-[10px] font-bold text-[#0077B6]"
                            >
                                {{ getInitials(product.store) }}
                            </div>

                            <span class="truncate text-xs font-semibold text-gray-500">
                                {{ product.store }}
                            </span>
                        </button>

                        <!-- Imagen -->
                        <div class="overflow-hidden rounded-xl bg-gray-100">

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

                        <!-- Información -->
                        <div class="pt-2">

                            <h3 class="truncate text-[11px] font-medium text-gray-500 sm:text-sm">
                                {{ product.name }}
                            </h3>

                            <div class="mt-1 flex items-center justify-between gap-2">

                                <span class="font-extrabold text-[#4F7180]">
                                    {{ formatPrice(product.price) }}
                                </span>

                                <button
                                    type="button"
                                    :disabled="isFollowLoading(product.entrepreneurId)"
                                    class="rounded-full border px-2 py-1 text-[9px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                                    :class="
                                        isFollowing(product.entrepreneurId)
                                            ? 'border-[#00B4D8] bg-[#CAF0F8] text-[#0077B6]'
                                            : 'border-gray-300 text-gray-500'
                                    "
                                    @click.stop="toggleFollow(product.entrepreneurId)"
                                >
                                    {{
                                        isFollowLoading(product.entrepreneurId)
                                            ? "..."
                                            : isFollowing(product.entrepreneurId)
                                                ? "Siguiendo"
                                                : "Seguir +"
                                    }}
                                </button>
                            </div>
                        </div>
                    </article>
                </div>
            </div>
        </section>

        <!-- Encabezado -->
        <div class="mb-5 flex items-end justify-between border-t border-gray-100 pt-5">

            <div>
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                    Explorar
                </p>

                <h2 class="mt-0.5 text-xl font-black text-gray-700 sm:text-2xl">
                    Todos los productos
                </h2>
            </div>

            <span class="hidden text-sm text-gray-400 sm:block">
                {{ productCountText }}
            </span>
        </div>

        <!-- Cargando -->
        <div
            v-if="loadingProducts"
            class="py-20 text-center"
        >
            <div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>

            <p class="mt-4 text-sm font-semibold text-gray-400">
                Cargando productos...
            </p>
        </div>

        <!-- Error -->
        <div
            v-else-if="productsError"
            class="py-20 text-center"
        >
            <p class="font-bold text-gray-700">
                No pudimos cargar los productos
            </p>

            <p class="mt-1 text-sm text-gray-400">
                {{ productsError }}
            </p>

            <button
                type="button"
                class="mt-4 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white"
                @click="loadProducts"
            >
                Intentar nuevamente
            </button>
        </div>

        <!-- Sin resultados -->
        <div
            v-else-if="!filteredProducts.length"
            class="py-20 text-center"
        >
            <p class="font-bold text-gray-700">
                No encontramos productos
            </p>

            <p class="mt-1 text-sm text-gray-400">
                Prueba otra búsqueda o departamento.
            </p>
        </div>

        <!-- Productos -->
        <section
            v-else
            class="grid grid-cols-2 gap-x-2 gap-y-5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
        >
            <article
                v-for="product in filteredProducts"
                :key="product.id"
                class="min-w-0 cursor-pointer overflow-hidden bg-white sm:rounded-2xl sm:border sm:border-gray-100 sm:p-2"
                @click="openProductDetail(product)"
            >

                <!-- Emprendedor -->
                <div class="mb-1.5 flex items-center justify-between gap-1">

                    <button
                        type="button"
                        class="flex min-w-0 items-center gap-1.5 text-left"
                        @click.stop="openEntrepreneurProfile(product.entrepreneurId)"
                    >

                        <img
                            v-if="product.storeAvatar"
                            :src="product.storeAvatar"
                            :alt="product.store"
                            class="h-7 w-7 shrink-0 rounded-full border border-gray-200 object-cover sm:h-9 sm:w-9"
                        >

                        <div
                            v-else
                            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#CAF0F8] text-[9px] font-bold text-[#0077B6] sm:h-9 sm:w-9"
                        >
                            {{ getInitials(product.store) }}
                        </div>

                        <span class="truncate text-[10px] font-medium text-gray-500 sm:text-sm">
                            {{ product.store }}
                        </span>
                    </button>

                    <button
                        type="button"
                        :disabled="isFollowLoading(product.entrepreneurId)"
                        class="shrink-0 rounded-full border px-2 py-1 text-[9px] font-medium disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-xs"
                        :class="
                            isFollowing(product.entrepreneurId)
                                ? 'border-[#00B4D8] bg-[#CAF0F8] text-[#0077B6]'
                                : 'border-gray-300 text-gray-500'
                        "
                        @click.stop="toggleFollow(product.entrepreneurId)"
                    >
                        {{
                            isFollowLoading(product.entrepreneurId)
                                ? "..."
                                : isFollowing(product.entrepreneurId)
                                    ? "Siguiendo"
                                    : "Seguir +"
                        }}
                    </button>
                </div>

                <!-- Portada -->
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

                <!-- Información -->
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

                    <h2 class="min-h-[30px] text-[11px] font-medium leading-tight text-gray-500 sm:min-h-[40px] sm:text-sm">
                        {{ product.name }}
                    </h2>

                    <div class="mt-1 flex items-end justify-between gap-2">

                        <span class="text-base font-extrabold text-[#4F7180] sm:text-xl">
                            {{ formatPrice(product.price) }}
                        </span>

                        <button
                            type="button"
                            aria-label="Consultar por WhatsApp"
                            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white sm:h-10 sm:w-10"
                            @click.stop="contactWhatsApp(product)"
                        >
                            <svg
                                class="h-5 w-5 sm:h-6 sm:w-6"
                                viewBox="0 0 32 32"
                                fill="currentColor"
                            >
                                <path d="M16.04 3C8.86 3 3.02 8.78 3.02 15.9c0 2.27.6 4.49 1.74 6.43L3 28.8l6.66-1.74a13.1 13.1 0 006.37 1.62h.01c7.17 0 13.01-5.78 13.01-12.89C29.05 8.78 23.21 3 16.04 3zm0 23.5a10.9 10.9 0 01-5.56-1.52l-.4-.24-3.95 1.03 1.06-3.82-.26-.4a10.6 10.6 0 01-1.68-5.66c0-5.9 4.84-10.7 10.79-10.7s10.78 4.8 10.78 10.7c0 5.9-4.83 10.7-10.78 10.7z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </article>
        </section>
    </main>

    <!-- ================= MENÚ MÓVIL ================= -->
    <nav class="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border-t border-white/20 bg-[#00B4D8] px-2 shadow-[0_-6px_20px_rgba(0,0,0,0.12)] lg:hidden">

        <div class="mx-auto grid max-w-md grid-cols-4">

            <RouterLink
                to="/catalogo"
                class="flex flex-col items-center gap-0.5 py-2 text-white"
            >
                <svg
                    class="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5"
                    ></path>
                </svg>

                <span class="border-b-2 border-white text-[10px] font-bold">
                    Inicio
                </span>
            </RouterLink>

            <a
                href="#productos"
                class="flex flex-col items-center gap-0.5 py-2 text-white/90"
            >
                <svg
                    class="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    viewBox="0 0 24 24"
                >
                    <circle
                        cx="11"
                        cy="11"
                        r="6"
                    ></circle>

                    <path
                        stroke-linecap="round"
                        d="m20 20-4.5-4.5"
                    ></path>
                </svg>

                <span class="text-[10px] font-bold">
                    Explorar
                </span>
            </a>

            <button
                type="button"
                class="flex flex-col items-center gap-0.5 py-2 text-white/90"
            >
                <svg
                    class="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linejoin="round"
                        d="M4 5h16v12H8l-4 3V5z"
                    ></path>
                </svg>

                <span class="text-[10px] font-bold">
                    Bandeja
                </span>
            </button>

            <!-- Abre el perfil -->
            <button
                type="button"
                class="flex flex-col items-center gap-0.5 py-2 text-white/90"
                @click="openClientProfile"
            >
                <svg
                    class="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    viewBox="0 0 24 24"
                >
                    <circle
                        cx="12"
                        cy="8"
                        r="4"
                    ></circle>

                    <path
                        stroke-linecap="round"
                        d="M4 21a8 8 0 0116 0"
                    ></path>
                </svg>

                <span class="text-[10px] font-bold">
                    Perfil
                </span>
            </button>
        </div>
    </nav>

    <!-- ================= PERFIL DEL CLIENTE ================= -->
    <Teleport to="body">

        <div
            v-if="showClientProfile"
            class="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
            @click.self="closeClientProfile"
        >

            <section class="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[600px] sm:rounded-[28px]">

                <!-- Cabecera -->
                <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">

                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Mi cuenta
                        </p>

                        <h2 class="text-lg font-black text-gray-700">
                            Mi perfil
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                        @click="closeClientProfile"
                    >
                        ×
                    </button>
                </div>

                <form
                    class="space-y-5 p-5 sm:p-7"
                    @submit.prevent="saveClientProfile"
                >

                    <!-- ================= FOTO ================= -->
                    <div class="flex flex-col items-center text-center">

                        <div class="relative">

                            <img
                                v-if="profilePhotoPreview"
                                :src="profilePhotoPreview"
                                alt="Foto de perfil"
                                class="h-28 w-28 rounded-full border-4 border-[#CAF0F8] object-cover shadow-sm"
                            >

                            <div
                                v-else
                                class="flex h-28 w-28 items-center justify-center rounded-full border-4 border-[#CAF0F8] bg-[#EAF9FC] text-2xl font-black text-[#0077B6]"
                            >
                                {{ clientInitials }}
                            </div>
                        </div>

                        <label class="mt-4 cursor-pointer rounded-xl border border-[#00B4D8] px-5 py-2.5 text-sm font-bold text-[#0077B6] transition hover:bg-[#CAF0F8]">

                            Cambiar foto

                            <input
                                type="file"
                                accept="image/*"
                                class="hidden"
                                @change="handleProfilePhoto"
                            >
                        </label>

                        <p
                            v-if="profilePhotoFile"
                            class="mt-2 max-w-full truncate text-xs text-gray-400"
                        >
                            {{ profilePhotoFile.name }}
                        </p>
                    </div>

                    <!-- ================= INFORMACIÓN ================= -->
                    <div>

                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Nombre completo
                        </label>

                        <input
                            v-model="profileForm.fullName"
                            required
                            type="text"
                            autocomplete="name"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-[#00B4D8]"
                        >
                    </div>

                    <div>

                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Correo electrónico
                        </label>

                        <!-- El correo viene de Supabase Authentication -->
                        <input
                            :value="clientProfile?.email"
                            disabled
                            type="email"
                            class="w-full cursor-not-allowed rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-gray-400 outline-none"
                        >

                        <p class="mt-1 text-xs text-gray-400">
                            El correo pertenece a tu cuenta de acceso.
                        </p>
                    </div>

                    <div>

                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Teléfono
                        </label>

                        <input
                            v-model="profileForm.phone"
                            type="tel"
                            autocomplete="tel"
                            placeholder="0000 0000"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition focus:border-[#00B4D8]"
                        >
                    </div>

                    <!-- Guardar -->
                    <button
                        type="submit"
                        :disabled="profileSaving"
                        class="w-full rounded-xl bg-[#00B4D8] px-5 py-3.5 font-bold text-white transition hover:bg-[#009CC0] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {{
                            profileSaving
                                ? "Guardando cambios..."
                                : "Guardar cambios"
                        }}
                    </button>

                    <!-- ================= CERRAR SESIÓN ================= -->
                    <div class="border-t border-gray-100 pt-5">

                        <button
                            type="button"
                            class="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 font-bold text-red-600 transition hover:bg-red-100"
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

                            Cerrar sesión
                        </button>
                    </div>
                </form>
            </section>
        </div>
    </Teleport>

    <!-- ================= DETALLE DEL PRODUCTO ================= -->
    <Teleport to="body">

        <div
            v-if="selectedProduct"
            class="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
            @click.self="closeProductDetail"
        >

            <section class="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[950px] sm:rounded-[28px]">

                <!-- Cabecera -->
                <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">

                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Detalle del producto
                        </p>

                        <h2 class="font-bold text-gray-700">
                            Información completa
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

                    <!-- ================= GALERÍA ================= -->
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

                            <!-- Flechas -->
                            <template
                                v-if="selectedProductImages.length > 1"
                            >

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

                        <!-- Miniaturas -->
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
                                @click="
                                    selectedProductImageIndex = index
                                "
                            >

                                <img
                                    :src="image"
                                    alt="Fotografía del producto"
                                    class="h-full w-full object-cover"
                                >
                            </button>
                        </div>
                    </div>

                    <!-- ================= INFORMACIÓN ================= -->
                    <div class="p-5 sm:p-7">

                        <!-- Emprendimiento -->
                        <button
                            type="button"
                            class="flex items-center gap-2 text-left"
                            @click="openEntrepreneurProfile(selectedProduct.entrepreneurId)"
                        >

                            <img
                                v-if="selectedProduct.storeAvatar"
                                :src="selectedProduct.storeAvatar"
                                :alt="selectedProduct.store"
                                class="h-10 w-10 rounded-full border border-gray-100 object-cover"
                            >

                            <div
                                v-else
                                class="flex h-10 w-10 items-center justify-center rounded-full bg-[#CAF0F8] text-xs font-bold text-[#0077B6]"
                            >
                                {{ getInitials(selectedProduct.store) }}
                            </div>

                            <div>

                                <p class="text-sm font-bold text-[#0077B6]">
                                    {{ selectedProduct.store }}
                                </p>

                                <p class="text-xs text-gray-400">
                                    {{ selectedProduct.district }},
                                    {{ selectedProduct.department }}
                                </p>
                            </div>
                        </button>

                        <!-- Categorías -->
                        <div class="mt-4 flex flex-wrap gap-2">

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
                            {{
                                selectedProduct.description ||
                                "Este producto no tiene una descripción."
                            }}
                        </p>

                        <!-- WhatsApp -->
                        <button
                            type="button"
                            class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 font-bold text-white transition hover:bg-[#20BD5A]"
                            @click="contactWhatsApp(selectedProduct)"
                        >
                            Consultar por WhatsApp
                        </button>
                    </div>
                </div>
            </section>
        </div>
    </Teleport>
</div>
</template>
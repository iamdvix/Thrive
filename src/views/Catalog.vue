<script setup>
// Catálogo principal del cliente; reúne perfil, productos, filtros, seguimiento y detalle de cada publicación.
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";
import {
    uploadProfileImage,
    deleteImage,
    getStoragePathFromPublicUrl
} from "../lib/storage";
const router = useRouter();
// Datos y controles del perfil del cliente conectado.
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
// Campos opcionales para cambiar la contraseña desde el perfil.
const currentPassword = ref("");
const newPassword = ref("");
const confirmNewPassword = ref("");
// Datos y controles utilizados para mostrar los productos.
// Productos reales provenientes de Supabase.
const products = ref([]);
const loadingProducts = ref(false);
const productsError = ref("");
// Controles de búsqueda.
const searchText = ref("");
const selectedDepartment = ref("Todos");
// Seguimientos guardados realmente en Supabase.
const followedEntrepreneurs = ref([]);
// Evita múltiples clics mientras se guarda o elimina un follow.
const followLoading = ref([]);
// Carga la información del perfil del cliente conectado.
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
            router.replace({ name: "Access" });
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
// Limpia los campos sensibles cada vez que abrimos o cerramos el perfil.
function clearPasswordFields() {
    currentPassword.value = "";
    newPassword.value = "";
    confirmNewPassword.value = "";
}
// Abre y prepara la ventana del perfil del cliente.
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
    clearPasswordFields();
    showClientProfile.value = true;
    document.body.style.overflow = "hidden";
}
// Cierra la ventana del perfil.
function closeClientProfile() {
    showClientProfile.value = false;
    profilePhotoFile.value = null;
    profilePhotoPreview.value = "";
    clearPasswordFields();
    document.body.style.overflow = "";
}
// Maneja la selección y vista previa de la foto del cliente.
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
// Guarda los cambios realizados en el perfil.
// Actualiza los datos y la fotografía del cliente.
async function saveClientProfile() {
    if (
        !clientProfile.value ||
        profileSaving.value
    ) {
        return;
    }
    if (!profileForm.value.fullName.trim()) {
        alert("Escribe tu nombre antes de guardar.");
        return;
    }
    profileSaving.value = true;
    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();
        if (userError || !user?.email) {
            alert("No fue posible verificar tu sesión.");
            return;
        }
        const wantsPasswordChange =
            currentPassword.value.length > 0 ||
            newPassword.value.length > 0 ||
            confirmNewPassword.value.length > 0;
        if (wantsPasswordChange) {
            if (
                !currentPassword.value ||
                !newPassword.value ||
                !confirmNewPassword.value
            ) {
                alert("Para cambiar la contraseña debes completar los tres campos.");
                return;
            }
            if (newPassword.value.length < 8) {
                alert("La nueva contraseña debe tener al menos 8 caracteres.");
                return;
            }
            if (newPassword.value !== confirmNewPassword.value) {
                alert("Las nuevas contraseñas no coinciden.");
                return;
            }
            // Comprobamos la contraseña actual antes de cambiar información sensible.
            const { error: passwordCheckError } =
                await supabase.auth.signInWithPassword({
                    email: user.email,
                    password: currentPassword.value
                });
            if (passwordCheckError) {
                alert("La contraseña actual es incorrecta.");
                return;
            }
        }
        const oldAvatarUrl =
            clientProfile.value.avatarUrl || null;
        const oldAvatarPath =
            getStoragePathFromPublicUrl(oldAvatarUrl);
        let avatarUrl = oldAvatarUrl;
        let uploadedPhoto = null;
        // Subimos una nueva foto únicamente cuando el cliente la seleccionó.
        if (profilePhotoFile.value) {
            uploadedPhoto =
                await uploadProfileImage(
                    user.id,
                    profilePhotoFile.value
                );
            avatarUrl =
                uploadedPhoto.publicUrl;
        }
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
                .eq("id", user.id)
                .select(`
                    id,
                    full_name,
                    phone,
                    avatar_url
                `)
                .single();
        if (error) {
            // Si la foto nueva se subió pero el perfil falló, limpiamos ese archivo.
            if (uploadedPhoto?.path) {
                try {
                    await deleteImage(uploadedPhoto.path);
                } catch (cleanupError) {
                    console.warn(
                        "No se pudo limpiar la foto nueva:",
                        cleanupError
                    );
                }
            }
            throw error;
        }
        // Eliminamos la foto anterior solo cuando la nueva URL ya quedó guardada.
        if (
            uploadedPhoto?.path &&
            oldAvatarPath &&
            oldAvatarPath !== uploadedPhoto.path
        ) {
            try {
                await deleteImage(oldAvatarPath);
            } catch (deleteError) {
                console.warn(
                    "La foto nueva se guardó, pero no se pudo eliminar la anterior:",
                    deleteError
                );
            }
        }
        clientProfile.value = {
            ...clientProfile.value,
            fullName:
                data.full_name || "",
            phone:
                data.phone || "",
            avatarUrl:
                data.avatar_url || ""
        };
        // La contraseña se cambia al final, cuando el resto del perfil ya se guardó.
        if (wantsPasswordChange) {
            const { error: passwordError } =
                await supabase.auth.updateUser({
                    password: newPassword.value
                });
            if (passwordError) {
                alert(
                    "El perfil se actualizó, pero no fue posible cambiar la contraseña: " +
                    passwordError.message
                );
                return;
            }
        }
        alert("Tu perfil fue actualizado correctamente.");
        closeClientProfile();
    } catch (error) {
        console.error("Error al guardar el perfil:", error);
        alert(
            "No fue posible guardar los cambios: " +
            (error.message || "Error inesperado")
        );
    } finally {
        profileSaving.value = false;
    }
}
// Cierra la sesión actual y redirige al usuario.
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
        router.replace({ name: "Access" });
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
// Obtiene el promedio y cantidad de reseñas de todos los productos cargados.
async function loadReviewSummary(productIds) {
    if (!productIds.length) return {};
    const { data, error } = await supabase
        .from("product_reviews")
        .select("product_id, rating")
        .in("product_id", productIds);
    if (error) {
        console.error("No se pudieron cargar los promedios:", error);
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
        summary[review.product_id].total += Number(review.rating) || 0;
        summary[review.product_id].count += 1;
    }
    return summary;
}
// Obtiene el número público de WhatsApp de cada emprendimiento.
async function loadWhatsappNumbers(entrepreneurIds) {
    const uniqueIds = [...new Set(entrepreneurIds.filter(Boolean))];
    const entries = await Promise.all(
        uniqueIds.map(async function (id) {
            try {
                const { data, error } = await supabase.rpc(
                    "get_entrepreneur_public_contact",
                    {
                        target_entrepreneur_id: id
                    }
                );
                if (error) throw error;
                return [
                    id,
                    data?.[0]?.phone || ""
                ];
            } catch (error) {
                console.warn("No se pudo cargar el WhatsApp del emprendimiento:", error);
                return [id, ""];
            }
        })
    );
    return Object.fromEntries(entries);
}
// Carga los productos guardados en la base de datos.
async function loadProducts() {
    loadingProducts.value = true;
    productsError.value = "";
    try {
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
            .order("created_at", {
                ascending: false
            });
        if (error) throw error;
        const mappedProducts = (data || []).map(function (product) {
            const images = (product.product_images || [])
                .slice()
                .sort(function (a, b) {
                    return a.sort_order - b.sort_order;
                })
                .map(function (image) {
                    return image.image_url;
                });
            const store = product.entrepreneurs;
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
                images,
                store: store?.business_name || "Emprendimiento",
                storeAvatar: store?.logo_url || "",
                department: store?.department || "",
                district: store?.district || "",
                averageRating: 0,
                reviewCount: 0,
                whatsapp: ""
            };
        });
        const productIds = mappedProducts.map(function (product) {
            return product.id;
        });
        const entrepreneurIds = mappedProducts.map(function (product) {
            return product.entrepreneurId;
        });
        const [reviewSummary, whatsappNumbers] = await Promise.all([
            loadReviewSummary(productIds),
            loadWhatsappNumbers(entrepreneurIds)
        ]);
        products.value = mappedProducts.map(function (product) {
            const reviews = reviewSummary[product.id];
            return {
                ...product,
                averageRating:
                    reviews?.count
                        ? reviews.total / reviews.count
                        : 0,
                reviewCount:
                    reviews?.count || 0,
                whatsapp:
                    whatsappNumbers[product.entrepreneurId] || ""
            };
        });
    } catch (error) {
        console.error("No se pudieron cargar los productos:", error);
        productsError.value = "No fue posible cargar los productos.";
    } finally {
        loadingProducts.value = false;
    }
}
// Estados y opciones utilizados para filtrar el catálogo.
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
// Muestra la foto del cliente o sus iniciales cuando no tiene imagen.
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
// Funciones pequeñas reutilizadas en distintas partes de la vista.
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
// Convierte la calificación numérica en un texto fácil de mostrar.
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
// Da formato al precio para mostrar siempre dos decimales.
function formatPrice(price) {
    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD"
        }
    ).format(Number(price) || 0);
}
// Controla el seguimiento de emprendimientos.
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
// Comprueba si el cliente ya sigue a este emprendimiento.
function isFollowing(entrepreneurId) {
    return followedEntrepreneurs.value.includes(entrepreneurId);
}
// Indica si una acción de seguimiento sigue en proceso.
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
            router.replace({ name: "Access" });
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
// Abre el perfil público del emprendimiento seleccionado.
function openEntrepreneurProfile(
    entrepreneurId
) {
    router.push({
        name: "Business",
        params: {
            id: entrepreneurId
        }
    });
}
// Abre el detalle del producto en su propia pantalla.
function openProductDetail(product) {
    if (!product?.id) return;
    router.push({
        name: "Product",
        params: {
            id: product.id
        }
    });
}
// Prepara el contacto del producto por WhatsApp.
function contactWhatsApp(product) {
    const message =
        encodeURIComponent(
            `Hola, estoy interesado/a en "${product.name}" de ${product.store}. Quisiera obtener más información sobre el producto.`
        );
    const rawWhatsapp =
        String(
            product.whatsapp || ""
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
// Maneja accesos rápidos del teclado para cerrar ventanas.
function handleEscape(event) {
    if (event.key !== "Escape") return;
    if (showClientProfile.value) {
        closeClientProfile();
    }
}
// Carga inicial de los datos necesarios para mostrar la página.
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
    <!-- Cabecera. -->
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
                        to="/catalog"
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
    <!-- Catálogo. -->
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
                            <div class="mt-1 flex items-center gap-1 text-[10px] sm:text-xs">
                                <span class="text-amber-500">★</span>
                                <span class="font-bold text-gray-600">
                                    {{ Number(product.averageRating).toFixed(1) }}
                                </span>
                                <span class="text-gray-400">
                                    ({{ product.reviewCount }})
                                </span>
                            </div>
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
                    <div class="mt-1 flex items-center gap-1 text-[10px] sm:text-xs">
                        <span class="text-amber-500">★</span>
                        <span class="font-bold text-gray-600">
                            {{ Number(product.averageRating).toFixed(1) }}
                        </span>
                        <span class="text-gray-400">
                            {{ product.reviewCount }} reseñas
                        </span>
                    </div>
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
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.003a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.885 9.887-9.885 2.64 0 5.122 1.03 6.988 2.897a9.825 9.825 0 012.895 6.993c-.003 5.45-4.437 9.887-9.887 9.887"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </article>
        </section>
    </main>
    <!-- Menú móvil. -->
    <nav class="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border-t border-white/20 bg-[#00B4D8] px-2 shadow-[0_-6px_20px_rgba(0,0,0,0.12)] lg:hidden">
        <div class="mx-auto grid max-w-md grid-cols-4">
            <RouterLink
                to="/catalog"
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
    <!-- Perfil del cliente. -->
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
                    <!-- Foto. -->
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
                    <!-- Información. -->
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
                    <!-- La contraseña es opcional; si no se llena, no se modifica. -->
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
                                v-model="confirmNewPassword"
                                type="password"
                                autocomplete="new-password"
                                placeholder="Confirmar nueva contraseña"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>
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
                    <!-- Cerrar sesión. -->
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
</div>
</template>

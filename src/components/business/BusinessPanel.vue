<script setup>
// Panel principal del emprendedor; centraliza perfil, productos, seguidores y vistas de administración.
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "../../lib/supabaseClient";
import {
    uploadEntrepreneurLogo,
    uploadProductImages,
    deleteImage
} from "../../lib/storage";
import NewsFeed from "./NewsFeed.vue";
import BusinessNav from "./BusinessNav.vue";
import LocationPicker from "../maps/LocationPicker.vue";
import SubscriptionCard from "../shared/SubscriptionCard.vue";
import BrandLogo from "../shared/BrandLogo.vue";
import {
    subscriptionIsActive,
    startSubscriptionCheckout
} from "../../lib/subscription";
const props = defineProps({
    // La vista de ruta decide qué parte del panel se muestra.
    screen: {
        type: String,
        default: "home"
    }
});
const route = useRoute();
const router = useRouter();
const screenMode = computed(function () {
    return props.screen;
});
// Estados principales compartidos por las pantallas del emprendedor.
const entrepreneur = ref(null);
const products = ref([]);
const loading = ref(true);
const loadError = ref("");
const profileSaving = ref(false);
const productSaving = ref(false);
const logoutLoading = ref(false);
const checkoutLoading = ref(false);
const deletingProductId = ref("");
// Control de ventanas.
const showProfileEditor = ref(false);
const showProductEditor = ref(false);
const showFollowersModal = ref(false);
// Datos y controles relacionados con los seguidores.
// Guarda la cantidad total y los datos públicos de quienes siguen al emprendimiento.
const followerCount = ref(0);
const followers = ref([]);
const followersLoading = ref(false);
// Reseñas que los clientes han dejado directamente al emprendimiento.
const entrepreneurReviews = ref([]);
// Los locales se administran desde el panel para que formen parte del trabajo diario del negocio.
const locations=ref([]);
const locationSaving=ref(false);
const noPhysicalStoreSaving=ref(false);
const showLocationEditor=ref(false);
const locationForm=ref({id:"",name:"",address:"",latitude:null,longitude:null,isPrimary:false,active:true,hours:[]});
const weekdays=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
// Datos y controles utilizados para editar el perfil del emprendimiento.
const profileForm = ref({
    businessName: "",
    phone: "",
    description: "",
    department: "",
    district: ""
});
const profileLogoFile = ref(null);
const profileLogoPreview = ref("");
// Campos utilizados cuando el emprendedor desea cambiar su contraseña.
const currentPassword = ref("");
const newPassword = ref("");
const confirmNewPassword = ref("");
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
// Datos y controles utilizados para mostrar los productos.
const productEditorMode = ref("add");
const selectedProduct = ref(null);
const productForm = ref({
    name: "",
    description: "",
    categories: [],
    price: 0,
    discountPercent: 0,
    stock: 0
});
// Aquí mantenemos juntas las imágenes actuales y las nuevas.
// Esto permite cambiar el orden y elegir fácilmente la portada.
const editorImages = ref([]);
// Conserva las imágenes originales para saber cuáles
// fueron eliminadas durante una edición.
const originalProductImages = ref([]);
const showCategoryDropdown = ref(false);
// 12 categorías principales utilizadas dentro de Thrive.
const productCategories = [
    "Alimentos y bebidas",
    "Repostería y dulces",
    "Artesanías",
    "Moda y ropa",
    "Accesorios y joyería",
    "Belleza y cuidado personal",
    "Hogar y decoración",
    "Arte y diseño",
    "Papelería y personalizados",
    "Tecnología y accesorios",
    "Plantas y jardinería",
    "Productos para mascotas"
];
// Datos generales y listas utilizadas en esta pantalla.
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
// Valores calculados automáticamente a partir del estado actual.
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
const productCountText = computed(function () {
    const total = products.value.length;
    return total === 1 ? "1 producto" : `${total} productos`;
});
const productEditorTitle = computed(function () {
    return productEditorMode.value === "add"
        ? "Añadir producto"
        : "Editar producto";
});
const followerCountText = computed(function () {
    return followerCount.value === 1
        ? "1 seguidor"
        : `${followerCount.value} seguidores`;
});
const entrepreneurReviewCount = computed(function () {
    return entrepreneurReviews.value.length;
});
const entrepreneurRating = computed(function () {
    if (!entrepreneurReviews.value.length) return 0;
    const total = entrepreneurReviews.value.reduce(function (sum, review) {
        return sum + Number(review.rating || 0);
    }, 0);
    return total / entrepreneurReviews.value.length;
});
const entrepreneurTags = computed(function () {
    return [
        ...(entrepreneur.value?.paymentMethods || []),
        ...(entrepreneur.value?.serviceTags || [])
    ];
});
const hasNoPhysicalStore = computed(function () {
    return (entrepreneur.value?.serviceTags || []).includes("Sin local físico");
});
const entrepreneurSocials = computed(function () {
    return [
        { label: "Instagram", value: entrepreneur.value?.instagramUrl, type: "instagram", classes: "bg-pink-50 text-pink-700" },
        { label: "Facebook", value: entrepreneur.value?.facebookUrl, type: "facebook", classes: "bg-blue-50 text-blue-700" },
        { label: "TikTok", value: entrepreneur.value?.tiktokUrl, type: "tiktok", classes: "bg-gray-100 text-gray-700" },
        { label: "Sitio web", value: entrepreneur.value?.websiteUrl, type: "website", classes: "bg-cyan-50 text-[#0077B6]" }
    ].filter(function (item) {
        return item.value;
    });
});
const subscription = computed(function () {
    return {
        status:
            entrepreneur.value?.subscriptionStatus ||
            "inactive",
        price:
            Number(
                entrepreneur.value?.subscriptionPrice
            ) || 4.99,
        startedAt:
            entrepreneur.value?.subscriptionStartedAt ||
            null,
        expiresAt:
            entrepreneur.value?.subscriptionExpiresAt ||
            null
    };
});
const hasActiveSubscription = computed(function () {
    return subscriptionIsActive(subscription.value);
});
// Funciones pequeñas reutilizadas en distintas partes de la vista.
function formatPrice(price) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(price) || 0);
}
function discountedPrice(product) {
    const discount=Math.min(90,Math.max(0,Number(product?.discountPercent)||0));
    return Number(product?.price||0)*(1-discount/100);
}
function tagClasses(tag) {
    const value = String(tag || "").toLowerCase();
    if (value.includes("efectivo")) return "bg-emerald-50 text-emerald-700";
    if (value.includes("tarjeta")) return "bg-indigo-50 text-indigo-700";
    if (value.includes("transfer")) return "bg-sky-50 text-sky-700";
    if (value.includes("retiro")) return "bg-amber-50 text-amber-700";
    if (value.includes("entrega")) return "bg-orange-50 text-orange-700";
    if (value.includes("envío")) return "bg-violet-50 text-violet-700";
    if (value.includes("personal")) return "bg-pink-50 text-pink-700";
    if (value.includes("reserva")) return "bg-lime-50 text-lime-700";
    if (value.includes("sin local")) return "bg-slate-100 text-slate-600";
    return "bg-[#EAF9FC] text-[#0077B6]";
}
function socialHref(item) {
    const value = String(item.value || "").trim();
    if (/^https?:\/\//i.test(value)) return value;
    const clean = value.replace(/^@/, "");
    if (item.type === "instagram") return `https://instagram.com/${clean}`;
    if (item.type === "facebook") return `https://facebook.com/${clean}`;
    if (item.type === "tiktok") return `https://tiktok.com/@${clean}`;
    return `https://${clean}`;
}
function reviewInitials(name) {
    return String(name || "TH").trim().split(/\s+/).slice(0, 2).map(function (word) {
        return word.charAt(0).toUpperCase();
    }).join("");
}
function formatReviewDate(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}
function emptyHours(){return weekdays.map((_,weekday)=>({weekday,isClosed:weekday===6,openTime:weekday===5?"09:00":"08:00",closeTime:weekday===5?"14:00":"18:00"}));}
async function setNoPhysicalStore(enabled){
    if(noPhysicalStoreSaving.value||!entrepreneur.value?.id)return;
    if(enabled&&locations.value.length){alert("Primero elimina tus locales registrados para indicar que no cuentas con un local físico.");return;}
    noPhysicalStoreSaving.value=true;
    try{
        const current=entrepreneur.value.serviceTags||[];
        const next=enabled?[...new Set([...current,"Sin local físico"])]:current.filter(tag=>tag!=="Sin local físico");
        const{error}=await supabase.from("entrepreneurs").update({service_tags:next}).eq("id",entrepreneur.value.id);
        if(error)throw error;
        entrepreneur.value={...entrepreneur.value,serviceTags:next};
    }catch(error){
        console.error(error);
        alert("No fue posible actualizar esta opción.");
    }finally{
        noPhysicalStoreSaving.value=false;
    }
}
function openLocation(location=null){
    if(location){
        locationForm.value={id:location.id,name:location.name,address:location.address,latitude:location.latitude,longitude:location.longitude,isPrimary:location.isPrimary,active:location.active,hours:weekdays.map((_,weekday)=>{const hour=location.hours.find(item=>item.weekday===weekday);return hour?{weekday,isClosed:hour.is_closed,openTime:String(hour.open_time||"08:00").slice(0,5),closeTime:String(hour.close_time||"18:00").slice(0,5)}:emptyHours()[weekday];})};
    }else{
        locationForm.value={id:"",name:"",address:"",latitude:null,longitude:null,isPrimary:locations.value.length===0,active:true,hours:emptyHours()};
    }
    showLocationEditor.value=true;document.body.style.overflow="hidden";
}
function closeLocation(){showLocationEditor.value=false;document.body.style.overflow="";}
async function loadLocations(userId){
    const{data,error}=await supabase.from("entrepreneur_locations").select(`id,name,address,latitude,longitude,is_primary,active,entrepreneur_location_hours(weekday,is_closed,open_time,close_time)`).eq("entrepreneur_id",userId).order("is_primary",{ascending:false});
    if(error)throw error;
    locations.value=(data||[]).map(location=>({id:location.id,name:location.name,address:location.address,latitude:Number(location.latitude),longitude:Number(location.longitude),isPrimary:Boolean(location.is_primary),active:Boolean(location.active),hours:(location.entrepreneur_location_hours||[]).sort((a,b)=>a.weekday-b.weekday)}));
}
async function saveLocation(){
    if(locationSaving.value)return;
    if(!locationForm.value.name.trim()||!locationForm.value.address.trim()||!Number.isFinite(Number(locationForm.value.latitude))||!Number.isFinite(Number(locationForm.value.longitude))){alert("Completa el nombre, dirección y coloca el punto exacto en el mapa.");return;}
    locationSaving.value=true;
    try{
        const userId=entrepreneur.value?.id;if(!userId)throw new Error("Sesión no válida");
        if(locationForm.value.isPrimary){const{error}=await supabase.from("entrepreneur_locations").update({is_primary:false}).eq("entrepreneur_id",userId).eq("is_primary",true);if(error)throw error;}
        const payload={entrepreneur_id:userId,name:locationForm.value.name.trim(),address:locationForm.value.address.trim(),latitude:Number(locationForm.value.latitude),longitude:Number(locationForm.value.longitude),is_primary:Boolean(locationForm.value.isPrimary),active:Boolean(locationForm.value.active)};
        let locationId=locationForm.value.id;
        if(locationId){const{error}=await supabase.from("entrepreneur_locations").update(payload).eq("id",locationId);if(error)throw error;}else{const{data,error}=await supabase.from("entrepreneur_locations").insert(payload).select("id").single();if(error)throw error;locationId=data.id;}
        const{error:deleteHoursError}=await supabase.from("entrepreneur_location_hours").delete().eq("location_id",locationId);if(deleteHoursError)throw deleteHoursError;
        const rows=locationForm.value.hours.map(hour=>({location_id:locationId,weekday:hour.weekday,is_closed:Boolean(hour.isClosed),open_time:hour.isClosed?null:hour.openTime,close_time:hour.isClosed?null:hour.closeTime}));
        const{error:hoursError}=await supabase.from("entrepreneur_location_hours").insert(rows);if(hoursError)throw hoursError;
        if(hasNoPhysicalStore.value){
            const next=(entrepreneur.value.serviceTags||[]).filter(tag=>tag!=="Sin local físico");
            const{error:tagError}=await supabase.from("entrepreneurs").update({service_tags:next}).eq("id",userId);
            if(tagError)throw tagError;
            entrepreneur.value={...entrepreneur.value,serviceTags:next};
        }
        await loadLocations(userId);closeLocation();
    }catch(error){console.error(error);alert(error.message||"No fue posible guardar el local.");}finally{locationSaving.value=false;}
}
async function deleteLocation(location){
    if(!confirm(`¿Eliminar ${location.name}?`))return;
    try{const{error}=await supabase.from("entrepreneur_locations").delete().eq("id",location.id);if(error)throw error;locations.value=locations.value.filter(item=>item.id!==location.id);}catch(error){console.error(error);alert("No fue posible eliminar el local.");}
}
function locationSchedule(location){
    const openDays=(location.hours||[]).filter(hour=>!hour.is_closed);
    if(!openDays.length)return"Sin horario registrado";
    const first=openDays[0];
    return `${String(first.open_time||"").slice(0,5)} - ${String(first.close_time||"").slice(0,5)}`;
}
// Devuelve las clases visuales correspondientes al nivel de existencias.
function stockClasses(stock) {
    const amount = Number(stock) || 0;
    if (amount > 10) {
        return "bg-green-100 text-green-700";
    }
    if (amount >= 5) {
        return "bg-yellow-100 text-yellow-700";
    }
    return "bg-red-100 text-red-700";
}
// Devuelve el texto que describe el estado actual del inventario.
function stockText(stock) {
    const amount = Number(stock) || 0;
    if (amount === 0) return "Sin stock";
    if (amount === 1) return "1 unidad";
    return `${amount} unidades`;
}
// Cierra la sesión actual y vuelve a la pantalla de autenticación.
async function logout() {
    if (logoutLoading.value) return;
    logoutLoading.value = true;
    try {
        const { error } = await supabase.auth.signOut({
            scope: "local"
        });
        if (error) {
            throw error;
        }
        // Cerramos cualquier ventana antes de cambiar de pantalla.
        showProfileEditor.value = false;
        showProductEditor.value = false;
        showFollowersModal.value = false;
        document.body.style.overflow = "";
        router.replace({ name: "Access" });
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        alert("No fue posible cerrar la sesión. Intenta nuevamente.");
    } finally {
        logoutLoading.value = false;
    }
}
// Carga la información base que comparten las pantallas del emprendedor.
async function loadDashboard() {
    loading.value = true;
    loadError.value = "";
    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();
        if (userError || !user) {
            loadError.value =
                "No se encontró una sesión activa. Inicia sesión nuevamente.";
            return;
        }
        // Primero cargamos la información del emprendimiento.
        const { data: entrepreneurData, error: entrepreneurError } =
            await supabase
                .from("entrepreneurs")
                .select(`
                    id,
                    business_name,
                    description,
                    department,
                    district,
                    logo_url,
                    instagram_url,
                    facebook_url,
                    tiktok_url,
                    website_url,
                    payment_methods,
                    service_tags,
                    subscription_status,
                    subscription_price,
                    subscription_started_at,
                    subscription_expires_at
                `)
                .eq("id", user.id)
                .single();
        if (entrepreneurError || !entrepreneurData) {
            console.error(
                "Error al cargar el emprendimiento:",
                entrepreneurError
            );
            loadError.value =
                "No fue posible cargar la información del emprendimiento.";
            return;
        }
        // El teléfono pertenece al perfil general de la cuenta.
        const { data: accountData, error: accountError } =
            await supabase
                .from("profiles")
                .select("phone")
                .eq("id", user.id)
                .single();
        if (accountError) {
            console.warn(
                "No se pudo cargar el teléfono del perfil:",
                accountError
            );
        }
        entrepreneur.value = {
            id: entrepreneurData.id,
            businessName: entrepreneurData.business_name,
            phone: accountData?.phone || "",
            email: user.email || "",
            description: entrepreneurData.description,
            department: entrepreneurData.department,
            district: entrepreneurData.district,
            avatar: entrepreneurData.logo_url,
            instagramUrl: entrepreneurData.instagram_url || "",
            facebookUrl: entrepreneurData.facebook_url || "",
            tiktokUrl: entrepreneurData.tiktok_url || "",
            websiteUrl: entrepreneurData.website_url || "",
            paymentMethods: entrepreneurData.payment_methods || [],
            serviceTags: entrepreneurData.service_tags || [],
            subscriptionStatus:
                entrepreneurData.subscription_status ||
                "inactive",
            subscriptionPrice:
                Number(
                    entrepreneurData.subscription_price
                ) || 4.99,
            subscriptionStartedAt:
                entrepreneurData.subscription_started_at ||
                null,
            subscriptionExpiresAt:
                entrepreneurData.subscription_expires_at ||
                null
        };
        // Cada pantalla carga únicamente la información que necesita.
        const pendingLoads = [];
        if (screenMode.value === "home") {
            pendingLoads.push(loadProducts(user.id));
        }
        if (screenMode.value === "home") {
            pendingLoads.push(loadFollowers());
            pendingLoads.push(loadEntrepreneurReviews(user.id));
            pendingLoads.push(loadLocations(user.id));
        }
        await Promise.all(pendingLoads);
    } catch (error) {
        console.error("Error al cargar el panel del emprendedor:", error);
        loadError.value =
            "Ocurrió un problema inesperado al cargar el panel.";
    } finally {
        loading.value = false;
    }
}
// Obtiene el promedio de reseñas de los productos del emprendedor.
async function loadReviewSummary(productIds) {
    if (!productIds.length) return {};
    const { data, error } = await supabase
        .from("product_reviews")
        .select("product_id, rating")
        .in("product_id", productIds);
    if (error) {
        console.error("No se pudieron cargar las reseñas:", error);
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
// Carga todos los productos pertenecientes al emprendedor.
async function loadProducts(userId) {
    const { data: productRows, error: productError } = await supabase
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
            featured,
            active,
            created_at,
            updated_at
        `)
        .eq("entrepreneur_id", userId)
        .order("created_at", {
            ascending: false
        });
    if (productError) {
        console.error("Error al cargar los productos:", productError);
        throw productError;
    }
    if (!productRows?.length) {
        products.value = [];
        return;
    }
    const productIds = productRows.map(function (product) {
        return product.id;
    });
    const [
        { data: imageRows, error: imageError },
        reviewSummary
    ] = await Promise.all([
        supabase
            .from("product_images")
            .select(`
                id,
                product_id,
                image_url,
                storage_path,
                sort_order
            `)
            .in("product_id", productIds)
            .order("sort_order", {
                ascending: true
            }),
        loadReviewSummary(productIds)
    ]);
    if (imageError) {
        console.error("Error al cargar imágenes:", imageError);
        throw imageError;
    }
    products.value = productRows.map(function (product) {
        const productImages = (imageRows || [])
            .filter(function (image) {
                return image.product_id === product.id;
            })
            .sort(function (a, b) {
                return a.sort_order - b.sort_order;
            })
            .map(function (image) {
                return {
                    id: image.id,
                    imageUrl: image.image_url,
                    storagePath: image.storage_path,
                    sortOrder: image.sort_order
                };
            });
        const reviews = reviewSummary[product.id];
        return {
            id: product.id,
            entrepreneurId: product.entrepreneur_id,
            name: product.name,
            description: product.description || "",
            categories: product.categories || [],
            price: Number(product.price) || 0,
            discountPercent: Number(product.discount_percent) || 0,
            stock: Number(product.stock) || 0,
            featured: product.featured,
            active: product.active,
            imageRecords: productImages,
            images: productImages.map(function (image) {
                return image.imageUrl;
            }),
            image: productImages[0]?.imageUrl || null,
            averageRating:
                reviews?.count
                    ? reviews.total / reviews.count
                    : 0,
            reviewCount:
                reviews?.count || 0,
            createdAt: product.created_at
        };
    });
}
// Carga las reseñas del negocio para mostrarlas directamente en el panel.
async function loadEntrepreneurReviews(userId) {
    try {
        const { data, error } = await supabase.rpc("get_entrepreneur_reviews", {
            target_entrepreneur_id: userId
        });
        if (error) throw error;
        entrepreneurReviews.value = (data || []).map(function (review) {
            return {
                id: review.review_id,
                clientId: review.client_id,
                fullName: review.full_name || "Usuario de Thrive",
                avatarUrl: review.avatar_url || "",
                rating: Number(review.rating) || 0,
                comment: review.comment || "",
                createdAt: review.created_at
            };
        });
    } catch (error) {
        console.error("No se pudieron cargar las reseñas del emprendimiento:", error);
        entrepreneurReviews.value = [];
    }
}

// Carga y prepara la lista de seguidores del emprendimiento.
async function loadFollowers() {
    followersLoading.value = true;
    try {
        /*
            La función devuelve en una sola lista a clientes e instituciones.
            El contador del dashboard usa exactamente esa misma información.
        */
        const { data, error } = await supabase.rpc(
            "get_my_followers"
        );
        if (error) {
            throw error;
        }
        const rows = data || [];
        followerCount.value =
            rows.length;
        followers.value =
            rows.map(function (follower) {
                return {
                    id:
                        follower.id,
                    fullName:
                        follower.full_name ||
                        (
                            follower.follower_type ===
                            "institucion"
                                ? "Institución de Thrive"
                                : "Usuario de Thrive"
                        ),
                    avatarUrl:
                        follower.avatar_url || "",
                    followedAt:
                        follower.created_at,
                    followerType:
                        follower.follower_type ||
                        "cliente"
                };
            });
    } catch (error) {
        console.error(
            "Error al cargar seguidores:",
            error
        );
        followerCount.value = 0;
        followers.value = [];
    } finally {
        followersLoading.value = false;
    }
}
// Genera las iniciales que se muestran cuando un seguidor no tiene foto.
function followerInitials(name) {
    if (!name) return "TH";
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(function (word) {
            return word.charAt(0).toUpperCase();
        })
        .join("");
}
// Abre la ventana con la lista de seguidores.
async function openFollowersModal() {
    if (!entrepreneur.value) return;
    showFollowersModal.value = true;
    document.body.style.overflow = "hidden";
    // Actualizamos la lista cada vez que se abre.
    await loadFollowers();
}
// Cierra la ventana de seguidores.
function closeFollowersModal() {
    showFollowersModal.value = false;
    document.body.style.overflow = "";
}
async function subscribeToPlan() {
    if (checkoutLoading.value) return;
    checkoutLoading.value = true;
    try {
        await startSubscriptionCheckout();
    } catch (error) {
        console.error("No se pudo abrir el pago:", error);
        alert(
            "No fue posible abrir el pago seguro: " +
            (error.message || "Error inesperado")
        );
    } finally {
        checkoutLoading.value = false;
    }
}
function requireSubscription() {
    if (hasActiveSubscription.value) return true;
    alert(
        "Esta herramienta requiere el plan Thrive de $4.99 al mes. Puedes activarlo desde Mi perfil."
    );
    router.push({ name: "BizProfile" });
    return false;
}

// Funciones utilizadas para abrir, editar y guardar el perfil.
function openProfileEditor() {
    if (!entrepreneur.value) return;
    profileForm.value = {
        businessName: entrepreneur.value.businessName || "",
        phone: entrepreneur.value.phone || "",
        description: entrepreneur.value.description || "",
        department: entrepreneur.value.department || "",
        district: entrepreneur.value.district || ""
    };
    profileLogoPreview.value =
        entrepreneur.value.avatar || "";
    profileLogoFile.value = null;
    clearPasswordFields();
    showProfileEditor.value = true;
    document.body.style.overflow = "hidden";
}
// Prepara la vista previa del nuevo logo antes de guardarlo.
function handleProfileLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        alert("Selecciona un archivo de imagen válido.");
        event.target.value = "";
        return;
    }
    profileLogoFile.value = file;
    const reader = new FileReader();
    reader.onload = function (loadEvent) {
        profileLogoPreview.value =
            loadEvent.target.result;
    };
    reader.readAsDataURL(file);
}
// Limpia los campos de contraseña para evitar conservar datos anteriores.
function clearPasswordFields() {
    currentPassword.value = "";
    newPassword.value = "";
    confirmNewPassword.value = "";
    showCurrentPassword.value = false;
    showNewPassword.value = false;
    showConfirmPassword.value = false;
}
// Cierra el editor de perfil y limpia sus estados temporales.
function closeProfileEditor() {
    showProfileEditor.value = false;
    profileLogoFile.value = null;
    clearPasswordFields();
    document.body.style.overflow = "";
}
// Valida y guarda los cambios realizados en el perfil del emprendimiento.
async function saveProfile() {
    if (!entrepreneur.value || profileSaving.value) return;
    profileSaving.value = true;
    try {
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
                alert(
                    "Para cambiar la contraseña debes completar los tres campos."
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
                confirmNewPassword.value
            ) {
                alert(
                    "Las nuevas contraseñas no coinciden."
                );
                return;
            }
        }
        let logoUrl =
            entrepreneur.value.avatar || null;
        // Si existe una nueva imagen, se sube primero a Storage.
        if (profileLogoFile.value) {
            const uploadedLogo =
                await uploadEntrepreneurLogo(
                    entrepreneur.value.id,
                    profileLogoFile.value
                );
            logoUrl = uploadedLogo.publicUrl;
        }
        // Verificamos la contraseña actual antes de cambiarla.
        if (wantsPasswordChange) {
            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser();
            if (userError || !user?.email) {
                alert(
                    "No fue posible verificar tu cuenta."
                );
                return;
            }
            const { error: passwordCheckError } =
                await supabase.auth.signInWithPassword({
                    email: user.email,
                    password: currentPassword.value
                });
            if (passwordCheckError) {
                alert(
                    "La contraseña actual es incorrecta."
                );
                return;
            }
        }
        const { data, error } = await supabase
            .from("entrepreneurs")
            .update({
                business_name:
                    profileForm.value.businessName.trim(),
                description:
                    profileForm.value.description.trim(),
                department:
                    profileForm.value.department,
                district:
                    profileForm.value.district.trim(),
                logo_url:
                    logoUrl
            })
            .eq(
                "id",
                entrepreneur.value.id
            )
            .select()
            .single();
        if (error) {
            alert(
                "No fue posible actualizar el perfil: " +
                error.message
            );
            return;
        }
        // El teléfono se guarda en profiles, igual que en la cuenta del cliente.
        const { error: accountUpdateError } =
            await supabase
                .from("profiles")
                .update({
                    phone:
                        profileForm.value.phone.trim()
                })
                .eq(
                    "id",
                    entrepreneur.value.id
                );
        if (accountUpdateError) {
            alert(
                "El emprendimiento se actualizó, pero no fue posible guardar el teléfono: " +
                accountUpdateError.message
            );
            return;
        }
        entrepreneur.value = {
            id: data.id,
            businessName: data.business_name,
            phone: profileForm.value.phone.trim(),
            email: entrepreneur.value.email || "",
            description: data.description,
            department: data.department,
            district: data.district,
            avatar: data.logo_url,
            subscriptionStatus:
                entrepreneur.value.subscriptionStatus,
            subscriptionPrice:
                entrepreneur.value.subscriptionPrice,
            subscriptionStartedAt:
                entrepreneur.value.subscriptionStartedAt,
            subscriptionExpiresAt:
                entrepreneur.value.subscriptionExpiresAt
        };
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
        alert("Perfil actualizado correctamente.");
        closeProfileEditor();
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
// Controla la selección de categorías del emprendimiento o producto.
function toggleCategory(category) {
    const categories =
        productForm.value.categories;
    const index =
        categories.indexOf(category);
    if (index === -1) {
        categories.push(category);
    } else {
        categories.splice(index, 1);
    }
}
// Comprueba si una categoría ya está seleccionada.
function isCategorySelected(category) {
    return productForm.value.categories.includes(
        category
    );
}
// Prepara el formulario para registrar un producto nuevo.
function openAddProduct() {
    if (!requireSubscription()) return;
    productEditorMode.value = "add";
    selectedProduct.value = null;
    productForm.value = {
        name: "",
        description: "",
        categories: [],
        price: 0,
        discountPercent: 0,
        stock: 0
    };
    editorImages.value = [];
    originalProductImages.value = [];
    showCategoryDropdown.value = false;
    showProductEditor.value = true;
    document.body.style.overflow = "hidden";
}
// Carga un producto existente dentro del formulario de edición.
function openProductEditor(product) {
    if (!requireSubscription()) return;
    productEditorMode.value = "edit";
    selectedProduct.value = product;
    productForm.value = {
        name: product.name || "",
        description: product.description || "",
        categories: [
            ...(product.categories || [])
        ],
        price: Number(product.price) || 0,
        discountPercent: Number(product.discountPercent) || 0,
        stock: Number(product.stock) || 0
    };
    /*
        Las imágenes existentes conservan su ID y ruta.
        Así podemos identificar cuáles se mantienen o eliminan.
    */
    editorImages.value = (
        product.imageRecords || []
    ).map(function (image) {
        return {
            kind: "existing",
            id: image.id,
            imageUrl: image.imageUrl,
            storagePath: image.storagePath,
            preview: image.imageUrl
        };
    });
    originalProductImages.value =
        editorImages.value.map(function (image) {
            return {
                ...image
            };
        });
    showCategoryDropdown.value = false;
    showProductEditor.value = true;
    document.body.style.overflow = "hidden";
}
// Convierte un archivo en una vista previa.
function fileToPreview(file) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function (event) {
            resolve(event.target.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
// Permite añadir varias fotografías sin borrar las anteriores.
async function handleProductImages(event) {
    const files = Array.from(
        event.target.files || []
    );
    if (!files.length) return;
    const validFiles = [];
    for (const file of files) {
        if (!file.type.startsWith("image/")) {
            continue;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert(
                `${file.name} supera el límite de 5 MB.`
            );
            continue;
        }
        validFiles.push(file);
    }
    const newImages =
        await Promise.all(
            validFiles.map(
                async function (file, index) {
                    const preview =
                        await fileToPreview(file);
                    return {
                        kind: "new",
                        key:
                            `${Date.now()}-${index}-${file.name}`,
                        file,
                        preview
                    };
                }
            )
        );
    editorImages.value.push(...newImages);
    // Permite seleccionar nuevamente los mismos archivos.
    event.target.value = "";
}
// Elimina una imagen únicamente del formulario.
// La eliminación real ocurre cuando se guardan los cambios.
function removeProductImage(index) {
    editorImages.value.splice(index, 1);
}
// Convierte cualquier fotografía en la portada.
function makeProductImageCover(index) {
    if (index === 0) return;
    const [image] =
        editorImages.value.splice(index, 1);
    editorImages.value.unshift(image);
}
// Cierra el formulario de producto y limpia los datos temporales.
function closeProductEditor() {
    showProductEditor.value = false;
    selectedProduct.value = null;
    editorImages.value = [];
    originalProductImages.value = [];
    showCategoryDropdown.value = false;
    document.body.style.overflow = "";
    // Si se llegó desde una URL antigua, limpiamos el parámetro al cerrar.
    if (route.query.product || route.query.editProduct) {
        router.replace({ name: "BizHome" });
    }
}
// Guarda un producto nuevo o actualiza uno existente.
async function saveProduct() {
    if (productSaving.value) return;
    if (!requireSubscription()) return;
    if (!productForm.value.categories.length) {
        alert(
            "Selecciona al menos una categoría."
        );
        return;
    }
    productSaving.value = true;
    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();
        if (userError || !user) {
            alert(
                "No se encontró una sesión activa."
            );
            return;
        }
        if (productEditorMode.value === "add") {
            await createProduct(user);
        } else {
            await updateProduct(user);
        }
        await loadProducts(user.id);
        alert(
            productEditorMode.value === "add"
                ? "Producto publicado correctamente."
                : "Producto actualizado correctamente."
        );
        closeProductEditor();
    } catch (error) {
        console.error(
            "Error al guardar el producto:",
            error
        );
        alert(
            "No fue posible guardar el producto: " +
            error.message
        );
    } finally {
        productSaving.value = false;
    }
}
// Crea el registro principal y después almacena sus fotografías.
async function createProduct(user) {
    const { data: newProduct, error: productError } =
        await supabase
            .from("products")
            .insert({
                entrepreneur_id: user.id,
                name: productForm.value.name.trim(),
                description: productForm.value.description.trim(),
                categories: productForm.value.categories,
                price: Number(productForm.value.price) || 0,
                discount_percent: Math.min(90,Math.max(0,Number(productForm.value.discountPercent)||0)),
                stock: Number(productForm.value.stock) || 0,
                featured: false,
                active: true
            })
            .select()
            .single();
    if (productError) {
        throw productError;
    }
    const newImages = editorImages.value.filter(function (image) {
        return image.kind === "new";
    });
    if (!newImages.length) {
        return;
    }
    let uploadedImages = [];
    try {
        // Subimos todas las imágenes al Storage del producto.
        uploadedImages = await uploadProductImages(
            user.id,
            newProduct.id,
            newImages.map(function (image) {
                return image.file;
            })
        );
        const imageRows = uploadedImages.map(function (image, index) {
            return {
                product_id: newProduct.id,
                image_url: image.publicUrl,
                storage_path: image.path,
                sort_order: index
            };
        });
        const { error: imageError } = await supabase
            .from("product_images")
            .insert(imageRows);
        if (imageError) {
            throw imageError;
        }
    } catch (error) {
        /*
            Si algo falla después de subir fotografías, limpiamos
            los archivos nuevos para no dejar imágenes huérfanas.
        */
        for (const image of uploadedImages) {
            try {
                await deleteImage(image.path);
            } catch (cleanupError) {
                console.warn(
                    "No se pudo limpiar una imagen subida:",
                    cleanupError
                );
            }
        }
        /*
            Como el producto todavía no terminó de crearse correctamente,
            eliminamos también su registro. product_images se elimina en
            cascada si ya se alcanzó a insertar alguna fila.
        */
        try {
            await supabase
                .from("products")
                .delete()
                .eq("id", newProduct.id);
        } catch (cleanupError) {
            console.warn(
                "No se pudo limpiar el producto incompleto:",
                cleanupError
            );
        }
        throw error;
    }
}
// Actualiza el producto y sincroniza por completo sus fotografías.
async function updateProduct(user) {
    if (!selectedProduct.value) {
        throw new Error(
            "No se encontró el producto seleccionado."
        );
    }
    const productId = selectedProduct.value.id;
    // Actualizamos primero la información principal del producto.
    const { error: updateError } = await supabase
        .from("products")
        .update({
            name: productForm.value.name.trim(),
            description: productForm.value.description.trim(),
            categories: productForm.value.categories,
            price: Number(productForm.value.price) || 0,
            discount_percent: Math.min(90,Math.max(0,Number(productForm.value.discountPercent)||0)),
            stock: Number(productForm.value.stock) || 0,
            updated_at: new Date().toISOString()
        })
        .eq("id", productId);
    if (updateError) {
        throw updateError;
    }
    /*
        Comparamos las imágenes que existían al abrir el editor
        con las que todavía siguen presentes cuando el usuario guarda.
    */
    const currentExistingIds = editorImages.value
        .filter(function (image) {
            return image.kind === "existing";
        })
        .map(function (image) {
            return image.id;
        });
    const removedImages = originalProductImages.value.filter(
        function (image) {
            return !currentExistingIds.includes(image.id);
        }
    );
    const newImages = editorImages.value.filter(function (image) {
        return image.kind === "new";
    });
    let uploadedImages = [];
    let insertedImageIds = [];
    try {
        // 1. Subimos primero las fotografías nuevas.
        if (newImages.length) {
            uploadedImages = await uploadProductImages(
                user.id,
                productId,
                newImages.map(function (image) {
                    return image.file;
                })
            );
        }
        /*
            2. Construimos las filas nuevas respetando exactamente
            el orden visual del editor. La posición 0 será la portada.
        */
        let uploadedIndex = 0;
        const newImageRows = [];
        for (
            let index = 0;
            index < editorImages.value.length;
            index++
        ) {
            const image = editorImages.value[index];
            if (image.kind === "new") {
                const uploaded = uploadedImages[uploadedIndex];
                if (uploaded) {
                    newImageRows.push({
                        product_id: productId,
                        image_url: uploaded.publicUrl,
                        storage_path: uploaded.path,
                        sort_order: index
                    });
                }
                uploadedIndex++;
            }
        }
        // 3. Registramos las imágenes nuevas en product_images.
        if (newImageRows.length) {
            const { data: insertedRows, error: insertError } =
                await supabase
                    .from("product_images")
                    .insert(newImageRows)
                    .select("id");
            if (insertError) {
                throw insertError;
            }
            insertedImageIds = (insertedRows || []).map(function (row) {
                return row.id;
            });
        }
        /*
            4. Actualizamos el orden de las fotografías que ya existían.
            Esto también permite cambiar cuál imagen es la portada.
        */
        for (
            let index = 0;
            index < editorImages.value.length;
            index++
        ) {
            const image = editorImages.value[index];
            if (image.kind !== "existing") {
                continue;
            }
            const { error: orderError } = await supabase
                .from("product_images")
                .update({
                    sort_order: index
                })
                .eq("id", image.id);
            if (orderError) {
                throw orderError;
            }
        }
        /*
            5. Las fotografías quitadas del editor se eliminan
            definitivamente de la tabla product_images.
        */
        if (removedImages.length) {
            const removedIds = removedImages.map(function (image) {
                return image.id;
            });
            const { error: deleteRowsError } = await supabase
                .from("product_images")
                .delete()
                .in("id", removedIds);
            if (deleteRowsError) {
                throw deleteRowsError;
            }
            /*
                6. Después de eliminar sus filas, borramos también
                los archivos físicos del bucket thrive-images.
            */
            for (const image of removedImages) {
                try {
                    await deleteImage(image.storagePath);
                } catch (storageDeleteError) {
                    /*
                        La fila ya se eliminó de la base de datos.
                        Si Storage falla, dejamos una advertencia en consola
                        sin romper la actualización completa del producto.
                    */
                    console.warn(
                        "La imagen se eliminó de la base de datos, pero no del Storage:",
                        storageDeleteError
                    );
                }
            }
        }
    } catch (error) {
        /*
            Si las fotografías nuevas se subieron pero la sincronización
            de la base de datos falla, intentamos retirar esas nuevas
            fotografías y sus filas para evitar archivos duplicados.
        */
        if (insertedImageIds.length) {
            try {
                await supabase
                    .from("product_images")
                    .delete()
                    .in("id", insertedImageIds);
            } catch (cleanupError) {
                console.warn(
                    "No se pudieron limpiar las filas nuevas:",
                    cleanupError
                );
            }
        }
        for (const image of uploadedImages) {
            try {
                await deleteImage(image.path);
            } catch (cleanupError) {
                console.warn(
                    "No se pudo limpiar una imagen nueva:",
                    cleanupError
                );
            }
        }
        throw error;
    }
}
async function deleteProduct() {
    if (
        !selectedProduct.value ||
        deletingProductId.value ||
        !requireSubscription()
    ) {
        return;
    }
    const product = selectedProduct.value;
    const confirmed = window.confirm(
        `¿Eliminar definitivamente "${product.name}"? Esta acción no se puede deshacer.`
    );
    if (!confirmed) return;
    deletingProductId.value = product.id;
    try {
        const { data: imageRows, error: imageError } =
            await supabase
                .from("product_images")
                .select("storage_path")
                .eq("product_id", product.id);
        if (imageError) throw imageError;
        const { error: deleteError } = await supabase
            .from("products")
            .delete()
            .eq("id", product.id)
            .eq("entrepreneur_id", entrepreneur.value.id);
        if (deleteError) throw deleteError;
        for (const image of imageRows || []) {
            if (!image.storage_path) continue;
            try {
                await deleteImage(image.storage_path);
            } catch (storageError) {
                console.warn(
                    "El producto se eliminó, pero una imagen quedó en Storage:",
                    storageError
                );
            }
        }
        products.value = products.value.filter(function (item) {
            return item.id !== product.id;
        });
        closeProductEditor();
        alert("Producto eliminado correctamente.");
    } catch (error) {
        console.error("Error al eliminar producto:", error);
        alert(
            "No fue posible eliminar el producto: " +
            (error.message || "Error inesperado")
        );
    } finally {
        deletingProductId.value = "";
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
// Maneja accesos rápidos del teclado para cerrar ventanas.
function handleEscape(event) {
    if (event.key !== "Escape") return;
    if (showLocationEditor.value) {
        closeLocation();
        return;
    }
    if (showFollowersModal.value) {
        closeFollowersModal();
        return;
    }
    if (showProductEditor.value) {
        closeProductEditor();
        return;
    }
    if (showProfileEditor.value) {
        closeProfileEditor();
    }
}
onMounted(async function () {
    await loadDashboard();
    if (route.query.checkout === "success") {
        alert(
            "El pago fue recibido. Estamos confirmando la activación de tu plan."
        );

        // Damos tiempo al webhook y volvemos a consultar el estado real.
        await new Promise(function (resolve) {
            setTimeout(resolve, 1800);
        });
        await loadDashboard();
        router.replace({ name: "BizProfile" });
    }

    if (route.query.checkout === "cancelled") {
        alert(
            "El pago fue cancelado. No se realizó ningún cobro."
        );
        router.replace({ name: "BizProfile" });
    }

    // Crear y editar productos siempre sucede dentro del dashboard.
    if (screenMode.value === "home" && route.query.product === "new") {
        openAddProduct();
    }
    if (screenMode.value === "home" && route.query.editProduct) {
        const product = products.value.find(function (item) {
            return String(item.id) === String(route.query.editProduct);
        });
        if (product) {
            openProductEditor(product);
        } else {
            router.replace({ name: "BizHome" });
        }
    }
    document.addEventListener("keydown", handleEscape);
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
<div class="min-h-screen bg-[#F8FBFC] pb-[76px] text-gray-700 lg:pb-0">
    <!-- Un solo navbar compartido mantiene la navegación idéntica en todas las pantallas. -->
    <BusinessNav
        :active="screenMode === 'news' ? 'news' : 'home'"
        :business-name="entrepreneur?.businessName || 'Thrive'"
    />
    <!-- Cargando. -->
    <main
        v-if="loading"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center"
    >
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        <p class="mt-4 text-sm font-semibold text-gray-400">
            Cargando tu emprendimiento...
        </p>
    </main>
    <!-- Error. -->
    <main
        v-else-if="loadError"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center"
    >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 font-black text-red-600">
            !
        </div>
        <p class="mt-4 font-black text-gray-700">
            No pudimos cargar el panel
        </p>
        <p class="mt-2 text-sm text-gray-400">
            {{ loadError }}
        </p>
        <button
            type="button"
            class="mt-5 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white"
            @click="loadDashboard"
        >
            Intentar nuevamente
        </button>
    </main>
    <!-- Contenido. -->
    <main
        v-else-if="entrepreneur"
        class="mx-auto max-w-[1450px] px-3 pb-10 pt-4 sm:px-5 lg:px-8 lg:pt-6"
    >
        <!-- INICIO -->
        <section v-if="screenMode === 'home'">

            <!-- Resumen del emprendimiento -->
            <section v-if="screenMode === 'home'" class="rounded-[24px] bg-white p-5 shadow-sm sm:p-7">
                <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
                        <BrandLogo :src="entrepreneur.avatar" :alt="entrepreneur.businessName" :name="entrepreneur.businessName" size="profile"/>
                        <div>
                            <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                                Mi emprendimiento
                            </p>
                            <div class="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                                <h1 class="text-2xl font-black text-gray-700 sm:text-3xl">{{ entrepreneur.businessName }}</h1>
                                <span class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                                    <span class="text-amber-500">★</span>
                                    {{ entrepreneurReviewCount ? entrepreneurRating.toFixed(1) : "0.0" }}
                                    <span class="font-bold text-amber-600/70">· {{ entrepreneurReviewCount }} {{ entrepreneurReviewCount === 1 ? "reseña" : "reseñas" }}</span>
                                </span>
                            </div>
                            <p class="mt-1 text-sm text-gray-400">
                                {{ entrepreneur.district }},
                                {{ entrepreneur.department }}
                            </p>
                            <p class="mt-3 max-w-2xl text-sm leading-6 text-gray-500">{{ entrepreneur.description }}</p>
                            <div v-if="entrepreneurTags.length" class="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                                <span v-for="tag in entrepreneurTags" :key="tag" class="rounded-full px-2.5 py-1 text-[10px] font-bold" :class="tagClasses(tag)">{{ tag }}</span>
                            </div>
                            <div v-if="entrepreneurSocials.length" class="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                                <a v-for="social in entrepreneurSocials" :key="social.label" :href="socialHref(social)" target="_blank" rel="noopener noreferrer" class="rounded-full px-2.5 py-1 text-[10px] font-bold" :class="social.classes">{{ social.label }}</a>
                            </div>
                            <!-- Seguidores -->
                            <button
                                type="button"
                                class="mt-4 inline-flex items-center gap-2 rounded-full bg-[#EAF9FC] px-4 py-2 text-left transition hover:bg-[#CAF0F8]"
                                @click="openFollowersModal"
                            >
                                <span class="text-base font-black text-[#0077B6]">
                                    {{ followerCount }}
                                </span>
                                <span class="text-xs font-bold text-[#4F7180]">
                                    {{ followerCount === 1 ? "seguidor" : "seguidores" }}
                                </span>
                            </button>
                        </div>
                    </div>

                </div>
            </section>
            <!-- Reseñas del emprendimiento -->
            <section class="mt-5 rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
                <div class="flex flex-wrap items-end justify-between gap-3">
                    <div><p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">Lo que dicen tus clientes</p><h2 class="mt-1 text-xl font-black text-gray-700">Reseñas de tu emprendimiento</h2></div>
                    <div class="flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2"><span class="text-lg text-amber-500">★</span><span class="font-black text-amber-700">{{ entrepreneurReviewCount ? entrepreneurRating.toFixed(1) : "0.0" }}</span><span class="text-xs font-bold text-amber-600/70">{{ entrepreneurReviewCount }} {{ entrepreneurReviewCount === 1 ? "reseña" : "reseñas" }}</span></div>
                </div>
                <div v-if="entrepreneurReviews.length" class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <article v-for="review in entrepreneurReviews.slice(0,6)" :key="review.id" class="rounded-[18px] border border-[#DDEFF3] bg-[#F8FBFC] p-4">
                        <div class="flex items-center gap-3"><img v-if="review.avatarUrl" :src="review.avatarUrl" :alt="review.fullName" class="h-10 w-10 rounded-full object-cover"><div v-else class="flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF9FC] text-xs font-black text-[#0077B6]">{{ reviewInitials(review.fullName) }}</div><div class="min-w-0 flex-1"><p class="truncate text-sm font-black text-gray-700">{{ review.fullName }}</p><div class="flex items-center gap-2"><span class="text-xs tracking-[.08em] text-amber-500">{{ "★".repeat(review.rating) }}<span class="text-gray-200">{{ "★".repeat(5-review.rating) }}</span></span><span class="text-[10px] text-gray-400">{{ formatReviewDate(review.createdAt) }}</span></div></div></div>
                        <p class="mt-3 line-clamp-3 text-sm leading-6 text-gray-500">{{ review.comment || "El cliente dejó una calificación sin comentario." }}</p>
                    </article>
                </div>
                <div v-else class="mt-5 rounded-[18px] border border-dashed border-[#90E0EF] bg-[#EAF9FC]/35 px-5 py-7 text-center text-sm text-gray-500">Aún no tienes reseñas. Cuando un cliente valore tu emprendimiento aparecerá aquí.</div>
            </section>
            <!-- Locales y horarios -->
            <section class="mt-5 rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
                <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div><p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">Tus puntos de venta</p><h2 class="mt-1 text-xl font-black text-gray-700">Locales y horarios</h2><p class="mt-1 text-sm text-gray-400">Administra aquí las ubicaciones que aparecen en el mapa de Thrive.</p></div>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" :disabled="noPhysicalStoreSaving" class="rounded-full border px-4 py-2.5 text-xs font-black transition disabled:opacity-50" :class="hasNoPhysicalStore?'border-slate-300 bg-slate-100 text-slate-700':'border-[#BDEAF2] bg-white text-[#4F7180] hover:bg-[#F2FBFD]'" @click="setNoPhysicalStore(!hasNoPhysicalStore)">
                            {{ hasNoPhysicalStore?'✓ Sin local físico':'No tengo local físico' }}
                        </button>
                        <button type="button" class="rounded-full bg-[#00B4D8] px-5 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-[#009CC0]" @click="openLocation()">+ Agregar local</button>
                    </div>
                </div>
                <p v-if="hasNoPhysicalStore" class="mt-3 text-xs font-semibold text-slate-500">Tus clientes verán la etiqueta “Sin local físico”. Si agregas un local, Thrive la quitará automáticamente.</p>
                <div v-if="locations.length" class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <article v-for="location in locations" :key="location.id" class="rounded-[20px] border border-[#DDEFF3] bg-[#F8FBFC] p-4">
                        <div class="flex items-start justify-between gap-3"><div><p class="font-black text-gray-700">{{ location.name }}</p><p class="mt-1 text-xs font-semibold text-gray-400">{{ location.isPrimary?'Local principal':'Sucursal' }}</p></div><span class="rounded-full px-2.5 py-1 text-[9px] font-black" :class="location.active?'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-500'">{{ location.active?'Visible':'Oculto' }}</span></div>
                        <p class="mt-3 line-clamp-2 text-sm leading-6 text-gray-500">{{ location.address }}</p>
                        <div class="mt-3 flex items-center gap-2 text-xs font-bold text-[#4F7180]"><svg class="h-4 w-4 text-[#00B4D8]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>{{ locationSchedule(location) }}</div>
                        <div class="mt-4 flex gap-2"><button type="button" class="flex-1 rounded-xl bg-[#EAF9FC] px-3 py-2.5 text-xs font-black text-[#0077B6]" @click="openLocation(location)">Editar local</button><button type="button" class="rounded-xl bg-red-50 px-3 py-2.5 text-xs font-black text-red-600" @click="deleteLocation(location)">Eliminar</button></div>
                    </article>
                </div>
                <div v-else class="mt-5 rounded-[18px] border border-dashed border-[#90E0EF] bg-[#EAF9FC]/35 px-5 py-7 text-center text-sm text-gray-500">{{ hasNoPhysicalStore?'Tu emprendimiento está marcado como negocio sin local físico.':'Todavía no has agregado un local. Puedes registrar uno o indicar que no cuentas con local físico.' }}</div>
            </section>
            <!-- Productos -->
            <section
                v-if="screenMode === 'home'"
                class="mt-7"
            >
                <div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Mi catálogo
                        </p>
                        <h2 class="mt-1 text-2xl font-black text-gray-700">
                            Mis productos
                        </h2>
                        <p class="mt-1 text-sm text-gray-400">
                            {{ productCountText }}
                        </p>
                    </div>
                    <button
                        type="button"
                        class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#009CC0] sm:w-auto"
                        @click="openAddProduct"
                    >
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" d="M12 5v14M5 12h14"></path>
                        </svg>
                        {{ hasActiveSubscription ? "Añadir producto" : "Activar plan para publicar" }}
                    </button>
                </div>
                <!-- Productos con el mismo estilo limpio del catálogo -->
                <div
                    v-if="products.length"
                    class="grid grid-cols-2 gap-x-2 gap-y-5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
                >
                    <article
                        v-for="product in products"
                        :key="product.id"
                        class="min-w-0 overflow-hidden bg-transparent"
                    >
                        <button
                            type="button"
                            class="relative block w-full overflow-hidden rounded-xl bg-gray-100 sm:rounded-2xl"
                            @click="openProductDetail(product)"
                        >
                            <span v-if="product.discountPercent>0" class="absolute left-2 top-2 z-10 rounded-full bg-rose-500 px-2.5 py-1 text-[9px] font-black text-white">-{{ Math.round(product.discountPercent) }}%</span>
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
                                Sin fotografía
                            </div>
                        </button>
                        <div class="pt-1.5 sm:px-1 sm:pt-3">
                            <div class="mb-1 flex flex-wrap gap-1">
                                <span
                                    v-for="category in product.categories.slice(0, 1)"
                                    :key="category"
                                    class="text-[9px] font-bold uppercase text-[#00B4D8]"
                                >
                                    {{ category }}
                                </span>
                                <span
                                    v-if="product.categories.length > 1"
                                    class="text-[9px] font-bold text-gray-400"
                                >
                                    +{{ product.categories.length - 1 }}
                                </span>
                            </div>
                            <h3 class="line-clamp-2 min-h-[34px] text-xs font-bold leading-tight text-gray-600 sm:min-h-[40px] sm:text-sm">
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
                            <div class="mt-2 flex items-center justify-between gap-2">
                                <div><p v-if="product.discountPercent>0" class="text-[10px] font-bold text-gray-400 line-through">{{ formatPrice(product.price) }}</p><p class="text-base font-black sm:text-xl" :class="product.discountPercent>0?'text-rose-600':'text-[#4F7180]'">{{ formatPrice(product.discountPercent>0?discountedPrice(product):product.price) }}</p></div>
                                <span
                                    class="rounded-full px-2 py-1 text-[9px] font-bold sm:text-[10px]"
                                    :class="stockClasses(product.stock)"
                                >
                                    {{ stockText(product.stock) }}
                                </span>
                            </div>
                            <div class="mt-3 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    class="rounded-xl border border-gray-200 px-2 py-2 text-[10px] font-bold text-gray-500 sm:text-xs"
                                    @click="openProductDetail(product)"
                                >
                                    Ver detalle
                                </button>
                                <button
                                    type="button"
                                    class="rounded-xl px-2 py-2 text-[10px] font-bold sm:text-xs"
                                    :class="hasActiveSubscription ? 'bg-[#CAF0F8] text-[#0077B6]' : 'bg-gray-100 text-gray-400'"
                                    @click="openProductEditor(product)"
                                >
                                    {{ hasActiveSubscription ? "Editar" : "Bloqueado" }}
                                </button>
                            </div>
                        </div>
                    </article>
                </div>
                <!-- Sin productos -->
                <div
                    v-else
                    class="rounded-[24px] border border-dashed border-[#90E0EF] bg-white px-5 py-16 text-center"
                >
                    <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#CAF0F8] text-[#0077B6]">
                        <svg class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                            <path d="M4 7l8-4 8 4-8 4-8-4z"></path>
                            <path d="M4 7v10l8 4 8-4V7"></path>
                            <path d="M12 11v10"></path>
                        </svg>
                    </div>
                    <h3 class="mt-4 font-black text-gray-700">
                        Tu catálogo está vacío
                    </h3>
                    <p class="mt-1 text-sm text-gray-400">
                        Publica tu primer producto para comenzar.
                    </p>
                    <button
                        type="button"
                        class="mt-5 rounded-xl bg-[#00B4D8] px-6 py-3 text-sm font-bold text-white"
                        @click="openAddProduct"
                    >
                        {{ hasActiveSubscription ? "Añadir mi primer producto" : "Activar plan" }}
                    </button>
                </div>
            </section>
        </section>
        <!-- Las novedades institucionales viven en un componente independiente. -->
        <NewsFeed
            v-else-if="screenMode === 'news'"
            :can-interact="hasActiveSubscription"
            @subscribe="router.push({ name: 'BizProfile' })"
        />
    </main>
    <!-- Seguidores. -->
    <Teleport to="body">
        <div
            v-if="showFollowersModal"
            class="fixed inset-0 z-[130] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
            @click.self="closeFollowersModal"
        >
            <section class="max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[520px] sm:rounded-[28px]">
                <!-- Cabecera -->
                <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Comunidad
                        </p>
                        <h2 class="text-lg font-black text-gray-700">
                            Seguidores
                        </h2>
                        <p class="mt-0.5 text-xs text-gray-400">
                            {{ followerCountText }}
                        </p>
                    </div>
                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                        @click="closeFollowersModal"
                    >
                        ×
                    </button>
                </div>
                <!-- Cargando -->
                <div
                    v-if="followersLoading"
                    class="px-5 py-14 text-center"
                >
                    <div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
                    <p class="mt-3 text-sm font-semibold text-gray-400">
                        Cargando seguidores...
                    </p>
                </div>
                <!-- Sin seguidores -->
                <div
                    v-else-if="!followers.length"
                    class="px-5 py-14 text-center"
                >
                    <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#CAF0F8] text-[#0077B6]">
                        <svg
                            class="h-7 w-7"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            viewBox="0 0 24 24"
                        >
                            <circle cx="9" cy="8" r="3"></circle>
                            <circle cx="17" cy="9" r="2"></circle>
                            <path stroke-linecap="round" d="M3 20a6 6 0 0112 0M14 20a4 4 0 018 0"></path>
                        </svg>
                    </div>
                    <h3 class="mt-4 font-black text-gray-700">
                        Aún no tienes seguidores
                    </h3>
                    <p class="mt-1 text-sm text-gray-400">
                        Aquí aparecerán los clientes e instituciones que sigan tu emprendimiento.
                    </p>
                </div>
                <!-- Lista de seguidores -->
                <div
                    v-else
                    class="divide-y divide-gray-100 px-5 py-2"
                >
                    <div
                        v-for="follower in followers"
                        :key="follower.id"
                        class="flex items-center gap-3 py-3"
                    >
                        <img
                            v-if="follower.avatarUrl"
                            :src="follower.avatarUrl"
                            :alt="follower.fullName"
                            class="h-11 w-11 shrink-0 rounded-full border border-gray-100 object-cover"
                        >
                        <div
                            v-else
                            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#CAF0F8] text-xs font-black text-[#0077B6]"
                        >
                            {{ followerInitials(follower.fullName) }}
                        </div>
                        <div class="min-w-0">
                            <p class="truncate text-sm font-bold text-gray-700">
                                {{ follower.fullName }}
                            </p>
                            <div class="mt-0.5 flex items-center gap-2">
                                <span
                                    class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                                    :class="
                                        follower.followerType === 'institucion'
                                            ? 'bg-[#CAF0F8] text-[#0077B6]'
                                            : 'bg-gray-100 text-gray-500'
                                    "
                                >
                                    {{
                                        follower.followerType === "institucion"
                                            ? "Institución"
                                            : "Cliente"
                                    }}
                                </span>
                                <span class="text-xs text-gray-400">
                                    Sigue tu emprendimiento
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </Teleport>
    <!-- Crear / editar producto. -->
    <Teleport to="body">
        <div
            v-if="showProductEditor"
            class="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
            @click.self="closeProductEditor"
        >
            <section class="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[700px] sm:rounded-[28px]">
                <div class="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Mi catálogo
                        </p>
                        <h2 class="text-lg font-black text-gray-700">
                            {{ productEditorTitle }}
                        </h2>
                    </div>
                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                        @click="closeProductEditor"
                    >
                        ×
                    </button>
                </div>
                <form
                    class="space-y-5 p-5 sm:p-7"
                    @submit.prevent="saveProduct"
                >
                    <!-- Fotografías -->
                    <div>
                        <label class="block text-sm font-bold text-gray-600">
                            Fotografías
                        </label>
                        <p class="mt-1 text-xs text-gray-400">
                            La primera fotografía será la portada del producto.
                        </p>
                        <div
                            v-if="editorImages.length"
                            class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4"
                        >
                            <div
                                v-for="(image, index) in editorImages"
                                :key="image.id || image.key"
                                class="relative overflow-hidden rounded-xl bg-gray-100"
                            >
                                <img
                                    :src="image.preview"
                                    alt="Producto"
                                    class="aspect-square w-full object-cover"
                                >
                                <span
                                    v-if="index === 0"
                                    class="absolute bottom-1 left-1 rounded-full bg-[#00B4D8] px-2 py-1 text-[9px] font-bold text-white"
                                >
                                    Portada
                                </span>
                                <div class="absolute right-1 top-1 flex gap-1">
                                    <button
                                        v-if="index !== 0"
                                        type="button"
                                        title="Hacer portada"
                                        class="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#0077B6] shadow"
                                        @click="makeProductImageCover(index)"
                                    >
                                        ★
                                    </button>
                                    <button
                                        type="button"
                                        title="Eliminar"
                                        class="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                                        @click="removeProductImage(index)"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        </div>
                        <label class="mt-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[#90E0EF] bg-[#F7FCFD] px-4 py-5 text-sm font-bold text-[#0077B6] transition hover:bg-[#CAF0F8]">
                            Añadir fotografías
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                class="hidden"
                                @change="handleProductImages"
                            >
                        </label>
                    </div>
                    <!-- Nombre -->
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Nombre del producto
                        </label>
                        <input
                            v-model="productForm.name"
                            required
                            type="text"
                            placeholder="Ejemplo: Muñeco tejido personalizado"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                    </div>
                    <!-- Categorías múltiples -->
                    <div class="relative">
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Categorías
                        </label>
                        <button
                            type="button"
                            class="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm outline-none hover:border-[#00B4D8]"
                            @click="showCategoryDropdown = !showCategoryDropdown"
                        >
                            <span
                                :class="
                                    productForm.categories.length
                                        ? 'text-gray-600'
                                        : 'text-gray-400'
                                "
                            >
                                {{
                                    productForm.categories.length
                                        ? `${productForm.categories.length} categorías seleccionadas`
                                        : "Seleccionar categorías"
                                }}
                            </span>
                            <span class="text-gray-400">
                                ▼
                            </span>
                        </button>
                        <div
                            v-if="showCategoryDropdown"
                            class="absolute left-0 right-0 z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-xl"
                        >
                            <button
                                v-for="category in productCategories"
                                :key="category"
                                type="button"
                                class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-[#F1FAFC]"
                                @click="toggleCategory(category)"
                            >
                                <span
                                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
                                    :class="
                                        isCategorySelected(category)
                                            ? 'border-[#00B4D8] bg-[#00B4D8] text-white'
                                            : 'border-gray-300'
                                    "
                                >
                                    <span v-if="isCategorySelected(category)">
                                        ✓
                                    </span>
                                </span>
                                {{ category }}
                            </button>
                        </div>
                        <!-- Categorías seleccionadas -->
                        <div
                            v-if="productForm.categories.length"
                            class="mt-3 flex flex-wrap gap-2"
                        >
                            <button
                                v-for="category in productForm.categories"
                                :key="category"
                                type="button"
                                class="rounded-full bg-[#CAF0F8] px-3 py-1.5 text-xs font-bold text-[#0077B6]"
                                @click="toggleCategory(category)"
                            >
                                {{ category }} ×
                            </button>
                        </div>
                    </div>
                    <!-- Precio y stock -->
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Precio
                            </label>
                            <input
                                v-model.number="productForm.price"
                                required
                                min="0"
                                step="0.01"
                                type="number"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>
                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Stock
                            </label>
                            <input
                                v-model.number="productForm.stock"
                                required
                                min="0"
                                type="number"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>
                    </div>
                    <!-- Oferta opcional -->
                    <div class="rounded-xl border border-rose-100 bg-rose-50/50 p-4">
                        <div class="flex items-start justify-between gap-3"><div><label class="block text-sm font-bold text-gray-600">Descuento</label><p class="mt-1 text-xs text-gray-400">Déjalo en 0 si el producto no está en oferta.</p></div><span v-if="productForm.discountPercent>0" class="rounded-full bg-rose-500 px-2.5 py-1 text-[10px] font-black text-white">Oferta -{{ Math.round(productForm.discountPercent) }}%</span></div>
                        <div class="mt-3 flex items-center gap-3"><input v-model.number="productForm.discountPercent" min="0" max="90" step="1" type="number" class="w-28 rounded-xl border border-rose-100 bg-white px-4 py-3 outline-none focus:border-rose-300"><span class="text-sm font-bold text-gray-500">%</span><p v-if="productForm.discountPercent>0" class="ml-auto text-sm font-black text-rose-600">{{ formatPrice((Number(productForm.price)||0)*(1-Math.min(90,Math.max(0,Number(productForm.discountPercent)||0))/100)) }}</p></div>
                    </div>
                    <!-- Descripción -->
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Descripción
                        </label>
                        <textarea
                            v-model="productForm.description"
                            rows="4"
                            placeholder="Describe tu producto..."
                            class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        ></textarea>
                    </div>
                    <div class="grid gap-3" :class="productEditorMode === 'edit' ? 'sm:grid-cols-2' : ''">
                        <button
                            v-if="productEditorMode === 'edit'"
                            type="button"
                            :disabled="Boolean(deletingProductId) || productSaving"
                            class="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                            @click="deleteProduct"
                        >
                            {{ deletingProductId ? "Eliminando..." : "Eliminar producto" }}
                        </button>
                        <button
                            type="submit"
                            :disabled="productSaving || Boolean(deletingProductId)"
                            class="rounded-xl bg-[#00B4D8] px-5 py-3.5 font-bold text-white transition hover:bg-[#009CC0] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {{
                                productSaving
                                    ? "Guardando producto..."
                                    : productEditorMode === "add"
                                        ? "Publicar producto"
                                        : "Guardar cambios"
                            }}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    </Teleport>
    <Teleport to="body">
        <div v-if="showLocationEditor" class="fixed inset-0 z-[150] flex items-end justify-center bg-black/50 sm:items-center sm:p-5" @click.self="closeLocation">
            <section class="max-h-[95vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[860px] sm:rounded-[28px]">
                <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4"><div><p class="text-xs font-black uppercase tracking-[.14em] text-[#00B4D8]">Ubicación</p><h2 class="text-xl font-black text-gray-700">{{ locationForm.id?'Editar local':'Agregar local' }}</h2></div><button type="button" class="h-9 w-9 rounded-full bg-gray-100 font-bold" @click="closeLocation">×</button></div>
                <div class="space-y-5 p-5 sm:p-6">
                    <div class="grid gap-4 sm:grid-cols-2"><label class="text-sm font-bold">Nombre del local<input v-model="locationForm.name" placeholder="Ej. Sucursal Centro" class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"></label><label class="text-sm font-bold">Dirección<input v-model="locationForm.address" placeholder="Dirección que verá el cliente" class="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"></label></div>
                    <LocationPicker v-model:latitude="locationForm.latitude" v-model:longitude="locationForm.longitude"/>
                    <div class="flex flex-wrap gap-4"><label class="flex items-center gap-2 text-sm font-bold"><input v-model="locationForm.isPrimary" type="checkbox"> Local principal</label><label class="flex items-center gap-2 text-sm font-bold"><input v-model="locationForm.active" type="checkbox"> Visible para clientes</label></div>
                    <div><div class="flex items-center justify-between"><p class="text-sm font-black">Horario</p><button type="button" class="text-xs font-black text-[#0077B6]" @click="locationForm.hours=emptyHours()">Restablecer</button></div><div class="mt-3 space-y-2"><div v-for="hour in locationForm.hours" :key="hour.weekday" class="grid grid-cols-[90px_1fr] items-center gap-2 rounded-[14px] bg-[#F8FBFC] p-3 sm:grid-cols-[110px_100px_1fr_1fr]"><span class="text-xs font-black">{{ weekdays[hour.weekday] }}</span><label class="flex items-center gap-1 text-[10px] font-bold text-gray-500"><input v-model="hour.isClosed" type="checkbox"> Cerrado</label><input v-model="hour.openTime" type="time" :disabled="hour.isClosed" class="rounded-lg border border-gray-200 px-2 py-2 text-xs disabled:opacity-40"><input v-model="hour.closeTime" type="time" :disabled="hour.isClosed" class="rounded-lg border border-gray-200 px-2 py-2 text-xs disabled:opacity-40"></div></div></div>
                    <button type="button" :disabled="locationSaving" class="w-full rounded-[15px] bg-[#00B4D8] px-5 py-3.5 font-black text-white disabled:opacity-50" @click="saveLocation">{{ locationSaving?'Guardando...':'Guardar local' }}</button>
                </div>
            </section>
        </div>
    </Teleport>
</div>
</template>
<style scoped>
.password-field::-ms-reveal,
.password-field::-ms-clear {
    display: none;
    width: 0;
    height: 0;
}
/* Evita que el texto largo desborde las tarjetas. */
.line-clamp-2 {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
}
</style>

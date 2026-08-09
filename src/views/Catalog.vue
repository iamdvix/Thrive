<script setup>
// Catálogo del cliente: productos, favoritos, búsqueda, filtros y acceso al ecosistema Thrive.
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";
import { loadMyFavoriteProductIds, setProductFavorite } from "../lib/favorites";
import CustomerNav from "../components/customer/CustomerNav.vue";

const route = useRoute();
const router = useRouter();
const clientProfile = ref(null);
const products = ref([]);
const loading = ref(true);
const loadError = ref("");
const searchText = ref("");
const selectedDepartment = ref("Todos");
const favoriteProductIds = ref([]);
const favoriteSavingIds = ref([]);
const followedEntrepreneurs = ref([]);
const followLoading = ref([]);
const departments = ["Todos","Ahuachapán","Cabañas","Chalatenango","Cuscatlán","La Libertad","La Paz","La Unión","Morazán","San Miguel","San Salvador","San Vicente","Santa Ana","Sonsonate","Usulután"];

const isFavoritesMode = computed(() => route.query.mode === "favorites");
const navActive = computed(() => isFavoritesMode.value ? "favorites" : "discover");
const filteredProducts = computed(() => {
    const text = searchText.value.toLowerCase().trim();
    return products.value.filter((product) => {
        if (isFavoritesMode.value && !favoriteProductIds.value.includes(product.id)) return false;
        const matchesDepartment = selectedDepartment.value === "Todos" || product.department === selectedDepartment.value;
        const haystack = [product.name, product.store, product.description, ...(product.categories || [])].join(" ").toLowerCase();
        return matchesDepartment && (!text || haystack.includes(text));
    });
});
const featuredProducts = computed(() => products.value
    .filter((p) => p.featured || p.averageRating >= 4.5)
    .sort((a,b) => (b.averageRating - a.averageRating) || (b.reviewCount - a.reviewCount))
    .slice(0, 8));

function initials(name) { return String(name || "TH").trim().split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase()).join(""); }
function money(value) { return new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(Number(value)||0); }
function openBusiness(id) { if (id) router.push({ name:"Business", params:{ id } }); }
function openProduct(id) { if (id) router.push({ name:"Product", params:{ id } }); }
function openProfile() { router.push({ name:"CustomerProfile" }); }
function isFavorite(id) { return favoriteProductIds.value.includes(id); }
function isFavoriteSaving(id) { return favoriteSavingIds.value.includes(id); }
function isFollowing(id) { return followedEntrepreneurs.value.includes(id); }
function isFollowLoading(id) { return followLoading.value.includes(id); }

async function loadClient() {
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) return router.replace({ name:"Access" });
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").eq("id", user.id).maybeSingle();
    clientProfile.value = { id:user.id, name:data?.full_name || "Cliente", avatarUrl:data?.avatar_url || "" };
}
async function reviewSummary(ids) {
    if (!ids.length) return {};
    const { data } = await supabase.from("product_reviews").select("product_id,rating").in("product_id", ids);
    const summary = {};
    (data || []).forEach((r) => {
        summary[r.product_id] ||= { total:0, count:0 };
        summary[r.product_id].total += Number(r.rating)||0;
        summary[r.product_id].count += 1;
    });
    return summary;
}
async function loadWhatsappMap(ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    const entries = await Promise.all(unique.map(async (id) => {
        const { data } = await supabase.rpc("get_entrepreneur_public_contact", { target_entrepreneur_id:id });
        return [id, data?.[0]?.phone || ""];
    }));
    return Object.fromEntries(entries);
}
async function loadProducts() {
    const { data, error } = await supabase.from("products").select(`
        id, entrepreneur_id, name, description, categories, price, stock, featured, active, created_at,
        entrepreneurs (id, business_name, department, district, logo_url),
        product_images (id, image_url, sort_order)
    `).eq("active", true).order("created_at", { ascending:false });
    if (error) throw error;
    const rows = data || [];
    const summary = await reviewSummary(rows.map(r => r.id));
    const phones = await loadWhatsappMap(rows.map(r => r.entrepreneur_id));
    products.value = rows.map((p) => {
        const store = p.entrepreneurs || {};
        const images = (p.product_images || []).slice().sort((a,b) => a.sort_order-b.sort_order);
        const s = summary[p.id];
        return {
            id:p.id, entrepreneurId:p.entrepreneur_id, name:p.name, description:p.description || "",
            categories:p.categories || [], price:Number(p.price)||0, stock:Number(p.stock)||0, featured:Boolean(p.featured),
            store:store.business_name || "Emprendimiento", department:store.department || "", district:store.district || "",
            storeAvatar:store.logo_url || "", image:images[0]?.image_url || "", whatsapp:phones[p.entrepreneur_id] || "",
            averageRating:s?.count ? s.total/s.count : 0, reviewCount:s?.count || 0
        };
    });
}
async function loadFavorites() { try { favoriteProductIds.value = await loadMyFavoriteProductIds(); } catch { favoriteProductIds.value = []; } }
async function toggleFavorite(id) {
    if (!id || isFavoriteSaving(id)) return;
    favoriteSavingIds.value.push(id);
    try {
        const next = !isFavorite(id);
        await setProductFavorite(id, next);
        favoriteProductIds.value = next ? [...new Set([...favoriteProductIds.value,id])] : favoriteProductIds.value.filter(x => x !== id);
    } catch (error) { console.error(error); alert("No fue posible actualizar tus favoritos."); }
    finally { favoriteSavingIds.value = favoriteSavingIds.value.filter(x => x !== id); }
}
async function loadFollows() {
    const { data:{ user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("follows").select("entrepreneur_id").eq("follower_id", user.id);
    followedEntrepreneurs.value = (data || []).map(r => r.entrepreneur_id);
}
async function toggleFollow(id) {
    if (!id || isFollowLoading(id)) return;
    followLoading.value.push(id);
    try {
        const { data:{ user } } = await supabase.auth.getUser();
        if (!user) return;
        if (isFollowing(id)) {
            const { error } = await supabase.from("follows").delete().eq("follower_id",user.id).eq("entrepreneur_id",id);
            if (error) throw error;
            followedEntrepreneurs.value = followedEntrepreneurs.value.filter(x => x !== id);
        } else {
            const { error } = await supabase.from("follows").insert({ follower_id:user.id, entrepreneur_id:id });
            if (error && error.code !== "23505") throw error;
            if (!followedEntrepreneurs.value.includes(id)) followedEntrepreneurs.value.push(id);
        }
    } catch (error) { console.error(error); alert("No fue posible actualizar el seguimiento."); }
    finally { followLoading.value = followLoading.value.filter(x => x !== id); }
}
function whatsapp(product) {
    const raw = String(product.whatsapp || "").replace(/\D/g, "");
    const phone = raw.length === 8 ? `503${raw}` : raw;
    const message = encodeURIComponent(`Hola, estoy interesado/a en \"${product.name}\" de ${product.store}. Quisiera obtener más información.`);
    window.open(phone ? `https://wa.me/${phone}?text=${message}` : `https://wa.me/?text=${message}`, "_blank", "noopener,noreferrer");
}
async function loadAll() {
    loading.value = true; loadError.value = "";
    try { await Promise.all([loadClient(), loadProducts(), loadFavorites(), loadFollows()]); }
    catch (error) { console.error(error); loadError.value = "No pudimos cargar el catálogo."; }
    finally { loading.value = false; }
}
watch(() => route.query.mode, () => window.scrollTo({ top:0, behavior:"smooth" }));
onMounted(loadAll);
</script>

<template>
<div class="min-h-screen bg-[#F8FBFC] pb-[78px] text-gray-700 lg:pb-10">
    <header class="sticky top-0 z-40 border-b border-[#CAF0F8]/60 bg-[#F8FBFC]/95 backdrop-blur-xl">
        <div class="mx-auto max-w-[1450px] px-3 py-3 sm:px-5 lg:px-8 lg:py-4">
            <div class="flex items-center gap-3">
                <div class="min-w-0 flex-1 rounded-[22px] bg-white px-4 py-3 shadow-sm ring-1 ring-[#CAF0F8]">
                    <div class="flex items-center gap-3">
                        <svg class="h-5 w-5 shrink-0 text-[#00B4D8]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
                        <input v-model="searchText" type="search" placeholder="Buscar productos, emprendimientos o categorías" class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 sm:text-base">
                    </div>
                </div>
                <button type="button" class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[#00B4D8] text-white shadow-sm" @click="openProfile">
                    <img v-if="clientProfile?.avatarUrl" :src="clientProfile.avatarUrl" :alt="clientProfile.name" class="h-full w-full object-cover">
                    <span v-else class="text-xs font-black">{{ initials(clientProfile?.name) }}</span>
                </button>
            </div>
            <div class="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <button v-for="department in departments" :key="department" type="button" class="whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition" :class="selectedDepartment === department ? 'bg-[#0077B6] text-white shadow-sm' : 'bg-[#EAF9FC] text-[#0077B6] hover:bg-[#CAF0F8]'" @click="selectedDepartment = department">{{ department }}</button>
            </div>
            <div class="mt-3"><CustomerNav :active="navActive" :favorite-count="favoriteProductIds.length" /></div>
        </div>
    </header>

    <main class="mx-auto max-w-[1450px] px-3 py-5 sm:px-5 lg:px-8 lg:py-7">
        <section v-if="loading" class="py-24 text-center"><div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div><p class="mt-4 text-sm font-semibold text-gray-400">Descubriendo Thrive...</p></section>
        <section v-else-if="loadError" class="rounded-[24px] bg-white p-10 text-center shadow-sm"><p class="font-black">{{ loadError }}</p><button class="mt-4 rounded-xl bg-[#00B4D8] px-5 py-3 font-bold text-white" @click="loadAll">Intentar nuevamente</button></section>
        <template v-else>
            <section v-if="!isFavoritesMode && featuredProducts.length" class="mb-8">
                <div class="mb-4 flex items-end justify-between"><div><p class="text-xs font-black uppercase tracking-[0.16em] text-[#00B4D8]">Selección Thrive</p><h1 class="mt-1 text-2xl font-black text-gray-800">Productos destacados</h1></div><button type="button" class="rounded-full bg-[#EAF9FC] px-4 py-2 text-xs font-bold text-[#0077B6]" @click="router.push({name:'Entrepreneurs'})">Ver emprendedores</button></div>
                <div class="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <article v-for="product in featuredProducts" :key="`featured-${product.id}`" class="w-[190px] shrink-0 cursor-pointer rounded-[22px] bg-white p-2 shadow-sm ring-1 ring-[#CAF0F8]/70 sm:w-[230px]" @click="openProduct(product.id)">
                        <img v-if="product.image" :src="product.image" :alt="product.name" class="aspect-square w-full rounded-[18px] object-cover"><div v-else class="flex aspect-square items-center justify-center rounded-[18px] bg-gray-100 text-xs text-gray-400">Sin imagen</div>
                        <div class="p-2"><p class="truncate text-xs font-bold text-[#0077B6]">{{ product.store }}</p><h2 class="mt-1 truncate font-black text-gray-700">{{ product.name }}</h2><div class="mt-2 flex items-center justify-between"><span class="font-black text-[#4F7180]">{{ money(product.price) }}</span><span class="text-xs font-bold text-gray-500"><span class="text-amber-500">★</span> {{ product.averageRating.toFixed(1) }}</span></div></div>
                    </article>
                </div>
            </section>

            <div class="mb-4 flex items-end justify-between gap-3"><div><p class="text-xs font-black uppercase tracking-[0.16em] text-[#00B4D8]">{{ isFavoritesMode ? 'Tu colección' : 'Explora' }}</p><h2 class="mt-1 text-2xl font-black text-gray-800">{{ isFavoritesMode ? 'Productos favoritos' : 'Todos los productos' }}</h2></div><p class="text-sm font-semibold text-gray-400">{{ filteredProducts.length }} resultados</p></div>
            <section v-if="!filteredProducts.length" class="rounded-[26px] bg-white px-6 py-16 text-center shadow-sm"><h3 class="font-black text-gray-700">No encontramos resultados</h3><p class="mt-2 text-sm text-gray-400">Prueba otra búsqueda o un departamento diferente.</p></section>
            <section v-else class="grid grid-cols-2 gap-x-2 gap-y-5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                <article v-for="product in filteredProducts" :key="product.id" class="min-w-0 cursor-pointer rounded-[20px] bg-white p-2 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-md" @click="openProduct(product.id)">
                    <div class="mb-2 flex items-center justify-between gap-2 px-0.5">
                        <button type="button" class="flex min-w-0 items-center gap-2 text-left" @click.stop="openBusiness(product.entrepreneurId)"><img v-if="product.storeAvatar" :src="product.storeAvatar" :alt="product.store" class="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-[#CAF0F8]"><span v-else class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF9FC] text-[9px] font-black text-[#0077B6]">{{ initials(product.store) }}</span><span class="truncate text-[10px] font-bold text-gray-500 sm:text-xs">{{ product.store }}</span></button>
                        <button type="button" :disabled="isFollowLoading(product.entrepreneurId)" class="shrink-0 rounded-full px-2 py-1 text-[9px] font-bold" :class="isFollowing(product.entrepreneurId) ? 'bg-[#CAF0F8] text-[#0077B6]' : 'bg-gray-50 text-gray-400'" @click.stop="toggleFollow(product.entrepreneurId)">{{ isFollowing(product.entrepreneurId) ? 'Siguiendo' : 'Seguir' }}</button>
                    </div>
                    <div class="relative overflow-hidden rounded-[16px] bg-gray-100">
                        <button type="button" :disabled="isFavoriteSaving(product.id)" class="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm" :class="isFavorite(product.id) ? 'text-rose-500' : 'text-gray-400'" @click.stop="toggleFavorite(product.id)"><svg class="h-5 w-5" viewBox="0 0 24 24" :fill="isFavorite(product.id) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"></path></svg></button>
                        <img v-if="product.image" :src="product.image" :alt="product.name" class="aspect-square w-full object-cover"><div v-else class="flex aspect-square items-center justify-center text-xs text-gray-400">Sin imagen</div>
                    </div>
                    <div class="p-1.5 pt-3"><h3 class="truncate text-sm font-black text-gray-700">{{ product.name }}</h3><p class="mt-1 text-[10px] font-semibold text-gray-400">{{ product.district || product.department }}</p><div class="mt-2 flex items-center justify-between"><div><span class="font-black text-[#4F7180]">{{ money(product.price) }}</span><span class="ml-2 text-[10px] font-bold text-gray-400"><span class="text-amber-500">★</span> {{ product.averageRating.toFixed(1) }} ({{ product.reviewCount }})</span></div><button type="button" class="flex h-8 w-8 items-center justify-center rounded-full bg-[#25D366] text-white" @click.stop="whatsapp(product)" aria-label="WhatsApp"><svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path fill="white" d="M8.8 7.6c.2-.4.4-.4.7-.4h.4c.1 0 .3 0 .4.3l.8 1.9c.1.2.1.4 0 .6l-.6.8c-.2.2-.2.4 0 .7.5 1 1.4 1.9 2.4 2.4.3.2.5.1.7-.1l.8-1c.2-.2.4-.3.6-.2l1.9.9c.3.1.4.3.4.5 0 .5-.2 1.4-.8 1.9-.6.6-1.5.9-2.4.7-1.1-.2-2.6-.8-4.4-2.4-1.5-1.4-2.5-3.1-2.8-4.2-.3-1.1 0-1.9.4-2.4.3-.3.5-.5.5-.5z"></path></svg></button></div></div>
                </article>
            </section>
        </template>
    </main>
</div>
</template>

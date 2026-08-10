<script setup>
// Catálogo del cliente: productos, favoritos, búsqueda, filtros y acceso al ecosistema Thrive.
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";
import { loadMyFavoriteProductIds, setProductFavorite } from "../lib/favorites";
import CustomerHeader from "../components/customer/CustomerHeader.vue";
import BrandLogo from "../components/shared/BrandLogo.vue";

const route = useRoute();
const router = useRouter();
const products = ref([]);
const loading = ref(true);
const loadError = ref("");
const searchText=ref(typeof route.query.q==="string"?route.query.q:"");
const selectedDepartment=ref(typeof route.query.department==="string"?route.query.department:"Todos");
const favoriteProductIds = ref([]);
const favoriteSavingIds = ref([]);
const followedEntrepreneurs = ref([]);
const followLoading = ref([]);

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
const saleProducts = computed(() => products.value.filter(p => p.discountPercent > 0).sort((a,b) => b.discountPercent-a.discountPercent).slice(0,8));
const featuredProducts = computed(() => products.value
    .filter(p => p.featured || p.averageRating >= 4.5)
    .sort((a,b) => (b.averageRating-a.averageRating) || (b.reviewCount-a.reviewCount))
    .slice(0,8));

function initials(name) { return String(name || "TH").trim().split(/\s+/).slice(0,2).map(w => w[0]?.toUpperCase()).join(""); }
function money(value) { return new Intl.NumberFormat("en-US", { style:"currency", currency:"USD" }).format(Number(value)||0); }
function salePrice(product){const discount=Math.min(90,Math.max(0,Number(product?.discountPercent)||0));return Number(product?.price||0)*(1-discount/100);}
function openBusiness(id) { if (id) router.push({ name:"Business", params:{ id } }); }
function openProduct(id) { if (id) router.push({ name:"Product", params:{ id } }); }
function isFavorite(id) { return favoriteProductIds.value.includes(id); }
function isFavoriteSaving(id) { return favoriteSavingIds.value.includes(id); }
function isFollowing(id) { return followedEntrepreneurs.value.includes(id); }
function isFollowLoading(id) { return followLoading.value.includes(id); }

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
        id, entrepreneur_id, name, description, categories, price, discount_percent, stock, featured, active, created_at,
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
            categories:p.categories || [], price:Number(p.price)||0, discountPercent:Number(p.discount_percent)||0, stock:Number(p.stock)||0, featured:Boolean(p.featured),
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
    try { await Promise.all([loadProducts(), loadFavorites(), loadFollows()]); }
    catch (error) { console.error(error); loadError.value = "No pudimos cargar el catálogo."; }
    finally { loading.value = false; }
}
watch(() => route.query.mode, () => window.scrollTo({ top:0, behavior:"smooth" }));
onMounted(loadAll);
</script>

<template>
<div class="min-h-screen bg-[#F8FBFC] pb-[78px] text-gray-700 lg:pb-10">
    <CustomerHeader v-model="searchText" v-model:department="selectedDepartment" :active="navActive" :favorite-count="favoriteProductIds.length" search-placeholder="Buscar productos, emprendimientos o categorías"/>

    <main class="mx-auto max-w-[1450px] px-3 py-5 sm:px-5 lg:px-8 lg:py-7">
        <section v-if="loading" class="py-24 text-center"><div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div><p class="mt-4 text-sm font-semibold text-gray-400">Descubriendo Thrive...</p></section>
        <section v-else-if="loadError" class="rounded-[24px] bg-white p-10 text-center shadow-sm"><p class="font-black">{{ loadError }}</p><button class="mt-4 rounded-xl bg-[#00B4D8] px-5 py-3 font-bold text-white" @click="loadAll">Intentar nuevamente</button></section>
        <template v-else>
            <section v-if="!isFavoritesMode && saleProducts.length" class="mb-8">
                <div class="mb-4 flex items-end justify-between"><div><p class="text-xs font-black uppercase tracking-[.16em] text-rose-500">Precios especiales</p><h1 class="mt-1 text-2xl font-black text-gray-800">Ofertas en Thrive</h1></div><p class="hidden text-xs font-semibold text-gray-400 sm:block">Descuentos publicados por los emprendedores</p></div>
                <div class="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <article v-for="product in saleProducts" :key="`sale-${product.id}`" class="w-[190px] shrink-0 cursor-pointer rounded-[20px] bg-white p-2 shadow-sm ring-1 ring-rose-100 sm:w-[225px]" @click="openProduct(product.id)">
                        <div class="relative overflow-hidden rounded-[16px] bg-gray-100"><span class="absolute left-2 top-2 z-10 rounded-full bg-rose-500 px-2.5 py-1 text-[9px] font-black text-white">-{{ Math.round(product.discountPercent) }}%</span><img v-if="product.image" :src="product.image" :alt="product.name" class="aspect-square w-full object-cover"><div v-else class="flex aspect-square items-center justify-center text-xs text-gray-400">Sin imagen</div></div>
                        <div class="p-2"><p class="truncate text-xs font-bold text-[#0077B6]">{{ product.store }}</p><h2 class="mt-1 truncate font-black text-gray-700">{{ product.name }}</h2><div class="mt-2 flex items-baseline gap-2"><span class="text-[10px] font-bold text-gray-400 line-through">{{ money(product.price) }}</span><span class="font-black text-rose-600">{{ money(salePrice(product)) }}</span></div></div>
                    </article>
                </div>
            </section>

            <section v-if="!isFavoritesMode && featuredProducts.length" class="mb-8">
                <div class="mb-4 flex items-end justify-between"><div><p class="text-xs font-black uppercase tracking-[0.16em] text-[#00B4D8]">Selección Thrive</p><h1 class="mt-1 text-2xl font-black text-gray-800">Productos destacados</h1></div><button type="button" class="rounded-full bg-[#EAF9FC] px-4 py-2 text-xs font-bold text-[#0077B6]" @click="router.push({name:'Entrepreneurs'})">Ver emprendedores</button></div>
                <div class="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <article v-for="product in featuredProducts" :key="`featured-${product.id}`" class="w-[190px] shrink-0 cursor-pointer rounded-[22px] bg-white p-2 shadow-sm ring-1 ring-[#CAF0F8]/70 sm:w-[230px]" @click="openProduct(product.id)">
                        <img v-if="product.image" :src="product.image" :alt="product.name" class="aspect-square w-full rounded-[18px] object-cover"><div v-else class="flex aspect-square items-center justify-center rounded-[18px] bg-gray-100 text-xs text-gray-400">Sin imagen</div>
                        <div class="p-2"><p class="truncate text-xs font-bold text-[#0077B6]">{{ product.store }}</p><h2 class="mt-1 truncate font-black text-gray-700">{{ product.name }}</h2><div class="mt-2 flex items-center justify-between gap-2"><div class="min-w-0"><span v-if="product.discountPercent>0" class="mr-1 text-[10px] font-bold text-gray-400 line-through">{{ money(product.price) }}</span><span class="font-black" :class="product.discountPercent>0?'text-rose-600':'text-[#4F7180]'">{{ money(product.discountPercent>0?salePrice(product):product.price) }}</span></div><span class="text-xs font-bold text-gray-500"><span class="text-amber-500">★</span> {{ product.averageRating.toFixed(1) }}</span></div></div>
                    </article>
                </div>
            </section>

            <div class="mb-4 flex items-end justify-between gap-3"><div><p class="text-xs font-black uppercase tracking-[0.16em] text-[#00B4D8]">{{ isFavoritesMode ? 'Tu colección' : 'Explora' }}</p><h2 class="mt-1 text-2xl font-black text-gray-800">{{ isFavoritesMode ? 'Productos favoritos' : 'Todos los productos' }}</h2></div><p class="text-sm font-semibold text-gray-400">{{ filteredProducts.length }} resultados</p></div>
            <section v-if="!filteredProducts.length" class="rounded-[26px] bg-white px-6 py-16 text-center shadow-sm"><h3 class="font-black text-gray-700">No encontramos resultados</h3><p class="mt-2 text-sm text-gray-400">Prueba otra búsqueda o un departamento diferente.</p></section>
            <section v-else class="grid grid-cols-2 gap-x-2 gap-y-5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                <article v-for="product in filteredProducts" :key="product.id" class="min-w-0 cursor-pointer rounded-[20px] bg-white p-2 shadow-sm ring-1 ring-gray-100 transition hover:-translate-y-0.5 hover:shadow-md" @click="openProduct(product.id)">
                    <div class="mb-2 flex items-center justify-between gap-2 px-0.5">
                        <button type="button" class="flex min-w-0 items-center gap-2 text-left" @click.stop="openBusiness(product.entrepreneurId)"><BrandLogo :src="product.storeAvatar" :alt="product.store" :name="product.store" size="xs"/><span class="truncate text-[10px] font-bold text-gray-500 sm:text-xs">{{ product.store }}</span></button>
                        <button type="button" :disabled="isFollowLoading(product.entrepreneurId)" class="shrink-0 rounded-full px-2 py-1 text-[9px] font-bold" :class="isFollowing(product.entrepreneurId) ? 'bg-[#CAF0F8] text-[#0077B6]' : 'bg-gray-50 text-gray-400'" @click.stop="toggleFollow(product.entrepreneurId)">{{ isFollowing(product.entrepreneurId) ? 'Siguiendo' : 'Seguir +' }}</button>
                    </div>
                    <div class="relative overflow-hidden rounded-[16px] bg-gray-100">
                        <span v-if="product.discountPercent>0" class="absolute left-2 top-2 z-10 rounded-full bg-rose-500 px-2.5 py-1 text-[9px] font-black text-white">-{{ Math.round(product.discountPercent) }}%</span>
                        <button type="button" :disabled="isFavoriteSaving(product.id)" class="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm" :class="isFavorite(product.id) ? 'text-rose-500' : 'text-gray-400'" @click.stop="toggleFavorite(product.id)"><svg class="h-5 w-5" viewBox="0 0 24 24" :fill="isFavorite(product.id) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"></path></svg></button>
                        <img v-if="product.image" :src="product.image" :alt="product.name" class="aspect-square w-full object-cover"><div v-else class="flex aspect-square items-center justify-center text-xs text-gray-400">Sin imagen</div>
                    </div>
                    <div class="p-1.5 pt-3"><h3 class="truncate text-sm font-black text-gray-700">{{ product.name }}</h3><p class="mt-1 text-[10px] font-semibold text-gray-400">{{ product.district || product.department }}</p><div class="mt-2 flex items-center justify-between"><div class="min-w-0"><div class="flex flex-wrap items-baseline gap-x-1"><span v-if="product.discountPercent>0" class="text-[10px] font-bold text-gray-400 line-through">{{ money(product.price) }}</span><span class="font-black" :class="product.discountPercent>0?'text-rose-600':'text-[#4F7180]'">{{ money(product.discountPercent>0?salePrice(product):product.price) }}</span></div><span class="text-[10px] font-bold text-gray-400"><span class="text-amber-500">★</span> {{ product.averageRating.toFixed(1) }} ({{ product.reviewCount }})</span></div><button type="button" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white transition hover:brightness-95 sm:h-10 sm:w-10" @click.stop="whatsapp(product)" aria-label="WhatsApp"><svg class="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 448 512" aria-hidden="true"><path fill="#fff" d="M380.9 97.1C339 55.1 283.2 32 223.9 32 101.5 32 1.9 131.6 1.9 254c0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.8l-6.7-4-69.8 18.3 18.6-68-4.4-7c-18.5-29.4-28.2-63.4-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.1-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.7 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.3 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg></button></div></div>
                </article>
            </section>
        </template>
    </main>
</div>
</template>

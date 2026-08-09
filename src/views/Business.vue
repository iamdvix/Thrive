<script setup>
// Perfil público del emprendimiento. Conserva el estilo original de Thrive y suma reputación, ubicaciones y redes.
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";
import LocationMap from "../components/maps/LocationMap.vue";

const route=useRoute();
const router=useRouter();
const entrepreneur=ref(null),products=ref([]),reviews=ref([]),locations=ref([]);
const loading=ref(true),loadError=ref(""),viewerId=ref(""),viewerType=ref("");
const following=ref(false),followLoading=ref(false),followerCount=ref(0),reviewSaving=ref(false),selectedLocation=ref(null);
const reviewForm=ref({rating:5,comment:""});
const id=computed(()=>String(route.params.id||""));
const myReview=computed(()=>reviews.value.find(review=>review.clientId===viewerId.value)||null);
const averageRating=computed(()=>reviews.value.length?reviews.value.reduce((total,review)=>total+review.rating,0)/reviews.value.length:0);
const reviewCountText=computed(()=>`${reviews.value.length} ${reviews.value.length===1?"reseña":"reseñas"}`);
const canReview=computed(()=>viewerType.value==="cliente"&&viewerId.value!==id.value);
const allTags=computed(()=>[...new Set([...(entrepreneur.value?.paymentMethods||[]),...(entrepreneur.value?.serviceTags||[])])]);
const hasNoPhysicalStore=computed(()=>(entrepreneur.value?.serviceTags||[]).includes("Sin local físico"));

function initials(name){return String(name||"TH").trim().split(/\s+/).slice(0,2).map(word=>word[0]?.toUpperCase()).join("");}
function money(value){return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(value)||0);}
function salePrice(product){const discount=Math.min(90,Math.max(0,Number(product?.discountPercent)||0));return Number(product?.price||0)*(1-discount/100);}
function date(value){return value?new Intl.DateTimeFormat("es-SV",{day:"numeric",month:"short",year:"numeric"}).format(new Date(value)):"";}
function normalizeUrl(value,network){if(!value)return"";if(/^https?:\/\//i.test(value))return value;const clean=value.replace(/^@/,"").trim();const base={instagram:"https://instagram.com/",facebook:"https://facebook.com/",tiktok:"https://tiktok.com/@",website:"https://"}[network];return `${base}${clean}`;}
function tagClass(tag){
    const value=String(tag||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    if(value.includes("efectivo"))return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if(value.includes("tarjeta"))return "border-indigo-200 bg-indigo-50 text-indigo-700";
    if(value.includes("transfer"))return "border-sky-200 bg-sky-50 text-sky-700";
    if(value.includes("retiro"))return "border-amber-200 bg-amber-50 text-amber-700";
    if(value.includes("domicilio")||value.includes("entrega"))return "border-orange-200 bg-orange-50 text-orange-700";
    if(value.includes("envio"))return "border-violet-200 bg-violet-50 text-violet-700";
    if(value.includes("personal"))return "border-rose-200 bg-rose-50 text-rose-700";
    if(value.includes("sin local"))return "border-slate-200 bg-slate-50 text-slate-600";
    return "border-[#90E0EF] bg-[#EAF9FC] text-[#0077B6]";
}
// Abre WhatsApp con un mensaje corto para que el cliente no tenga que escribir desde cero.
function openWhatsapp(message){
    const raw=String(entrepreneur.value?.phone||"").replace(/\D/g,"");
    if(!raw){
        alert("Este emprendimiento todavía no ha agregado un número de WhatsApp.");
        return;
    }
    const phone=raw.length===8?`503${raw}`:raw;
    const text=encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${text}`,"_blank","noopener,noreferrer");
}
function whatsapp(){
    openWhatsapp(`Hola, vi el perfil de ${entrepreneur.value?.businessName||"tu emprendimiento"} en Thrive y quisiera obtener más información.`);
}
function contactProductWhatsApp(product){
    openWhatsapp(`Hola, vi el producto "${product.name}" de ${entrepreneur.value?.businessName||"tu emprendimiento"} en Thrive y quisiera obtener más información.`);
}
function goBack(){if(window.history.length>1)router.back();else router.push({name:"Catalog"});}
function openProduct(productId){router.push({name:"Product",params:{id:productId}});}
async function viewer(){const{data:{user}}=await supabase.auth.getUser();if(!user)return;viewerId.value=user.id;const{data}=await supabase.from("profiles").select("user_type").eq("id",user.id).maybeSingle();viewerType.value=data?.user_type||"";}
async function loadReviews(){const{data,error}=await supabase.rpc("get_entrepreneur_reviews",{target_entrepreneur_id:id.value});if(error)throw error;reviews.value=(data||[]).map(row=>({id:row.review_id,clientId:row.client_id,fullName:row.full_name||"Usuario de Thrive",avatarUrl:row.avatar_url||"",rating:Number(row.rating)||0,comment:row.comment||"",createdAt:row.created_at,updatedAt:row.updated_at}));const own=reviews.value.find(review=>review.clientId===viewerId.value);reviewForm.value=own?{rating:own.rating,comment:own.comment}:{rating:5,comment:""};}
async function loadProducts(){const{data,error}=await supabase.from("products").select(`id,name,description,categories,price,discount_percent,stock,active,product_images(image_url,sort_order)`).eq("entrepreneur_id",id.value).eq("active",true).order("created_at",{ascending:false});if(error)throw error;products.value=(data||[]).map(product=>{const images=(product.product_images||[]).slice().sort((a,b)=>a.sort_order-b.sort_order);return{id:product.id,name:product.name,description:product.description||"",categories:product.categories||[],price:Number(product.price)||0,discountPercent:Number(product.discount_percent)||0,stock:Number(product.stock)||0,image:images[0]?.image_url||""};});}
async function loadLocations(){const{data,error}=await supabase.from("entrepreneur_locations").select(`id,name,address,latitude,longitude,is_primary,active,entrepreneur_location_hours(weekday,is_closed,open_time,close_time)`).eq("entrepreneur_id",id.value).eq("active",true).order("is_primary",{ascending:false});if(error)throw error;locations.value=(data||[]).map(location=>({id:location.id,name:location.name,address:location.address,latitude:Number(location.latitude),longitude:Number(location.longitude),isPrimary:Boolean(location.is_primary),hours:(location.entrepreneur_location_hours||[]).sort((a,b)=>a.weekday-b.weekday),businessName:entrepreneur.value?.businessName||""}));selectedLocation.value=locations.value[0]||null;}
async function loadFollow(){if(!viewerId.value)return;try{if(viewerType.value==="cliente"){const{data}=await supabase.from("follows").select("id").eq("follower_id",viewerId.value).eq("entrepreneur_id",id.value).maybeSingle();following.value=Boolean(data);}else if(viewerType.value==="institucion"){const{data}=await supabase.rpc("is_institution_following",{target_entrepreneur_id:id.value});following.value=data===true;}}catch{following.value=false;}try{const{data}=await supabase.rpc("get_entrepreneur_follower_count",{p_entrepreneur_id:id.value});followerCount.value=Number(data)||0;}catch{followerCount.value=0;}}
async function toggleFollow(){if(followLoading.value||!["cliente","institucion"].includes(viewerType.value))return;followLoading.value=true;try{if(viewerType.value==="institucion"){const{data,error}=await supabase.rpc("toggle_institution_follow",{target_entrepreneur_id:id.value});if(error)throw error;following.value=data===true;}else if(following.value){const{error}=await supabase.from("follows").delete().eq("follower_id",viewerId.value).eq("entrepreneur_id",id.value);if(error)throw error;following.value=false;}else{const{error}=await supabase.from("follows").insert({follower_id:viewerId.value,entrepreneur_id:id.value});if(error&&error.code!=="23505")throw error;following.value=true;}await loadFollow();}catch(error){console.error(error);alert("No fue posible actualizar el seguimiento.");}finally{followLoading.value=false;}}
async function saveReview(){if(!canReview.value||reviewSaving.value)return;reviewSaving.value=true;try{if(myReview.value){const{error}=await supabase.from("entrepreneur_reviews").update({rating:Number(reviewForm.value.rating),comment:reviewForm.value.comment.trim()}).eq("id",myReview.value.id);if(error)throw error;}else{const{error}=await supabase.from("entrepreneur_reviews").insert({entrepreneur_id:id.value,client_id:viewerId.value,rating:Number(reviewForm.value.rating),comment:reviewForm.value.comment.trim()});if(error)throw error;}await loadReviews();}catch(error){console.error(error);alert("No fue posible guardar tu reseña.");}finally{reviewSaving.value=false;}}
async function deleteReview(){if(!myReview.value||!confirm("¿Eliminar tu reseña de este emprendimiento?"))return;reviewSaving.value=true;try{const{error}=await supabase.from("entrepreneur_reviews").delete().eq("id",myReview.value.id);if(error)throw error;await loadReviews();}catch(error){console.error(error);alert("No fue posible eliminar la reseña.");}finally{reviewSaving.value=false;}}
async function load(){loading.value=true;loadError.value="";try{await viewer();const{data,error}=await supabase.from("entrepreneurs").select(`id,business_name,description,department,district,logo_url,instagram_url,facebook_url,tiktok_url,website_url,payment_methods,service_tags`).eq("id",id.value).maybeSingle();if(error)throw error;if(!data){loadError.value="No encontramos este emprendimiento.";return;}const{data:phoneData}=await supabase.rpc("get_entrepreneur_public_contact",{target_entrepreneur_id:id.value});entrepreneur.value={id:data.id,businessName:data.business_name,description:data.description||"",department:data.department||"",district:data.district||"",logoUrl:data.logo_url||"",instagramUrl:data.instagram_url||"",facebookUrl:data.facebook_url||"",tiktokUrl:data.tiktok_url||"",websiteUrl:data.website_url||"",paymentMethods:data.payment_methods||[],serviceTags:data.service_tags||[],phone:phoneData?.[0]?.phone||""};await Promise.all([loadReviews(),loadProducts(),loadLocations(),loadFollow()]);}catch(error){console.error(error);loadError.value="Ocurrió un problema al cargar este emprendimiento.";}finally{loading.value=false;}}
watch(id,load);
onMounted(load);
</script>

<template>
<div class="min-h-screen bg-[#F8FBFC] pb-10 text-gray-700">
    <!-- Barra simple, igual a la identidad original del catálogo. -->
    <header class="sticky top-0 z-40 bg-[#F8FBFC]">
        <div class="mx-auto max-w-[1450px] px-2 pt-2 sm:px-5 lg:px-8 lg:pt-4">
            <div class="flex items-center gap-2 rounded-[22px] bg-[#00B4D8] p-2 shadow-sm">
                <button type="button" aria-label="Volver" class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/20" @click="goBack">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6"></path></svg>
                </button>
                <p class="min-w-0 flex-1 truncate text-sm font-bold text-white">{{ entrepreneur?.businessName||"Perfil del emprendimiento" }}</p>
            </div>
        </div>
    </header>

    <main v-if="loading" class="mx-auto max-w-[1450px] px-5 py-24 text-center">
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        <p class="mt-4 text-sm font-semibold text-gray-400">Cargando emprendimiento...</p>
    </main>

    <main v-else-if="loadError" class="mx-auto max-w-[1450px] px-5 py-24 text-center">
        <div class="mx-auto max-w-lg bg-white p-8 sm:rounded-[22px]"><h1 class="text-xl font-black text-gray-700">No pudimos cargar el perfil</h1><p class="mt-2 text-sm text-gray-400">{{ loadError }}</p><button class="mt-5 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white" @click="load">Intentar nuevamente</button></div>
    </main>

    <main v-else-if="entrepreneur" class="mx-auto max-w-[1450px] px-3 pb-10 pt-4 sm:px-5 lg:px-8">
        <!-- El perfil vuelve a ser limpio: logo, información y acciones en un solo bloque. -->
        <section class="bg-white px-4 py-6 sm:rounded-[24px] sm:px-7">
            <div class="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
                <img v-if="entrepreneur.logoUrl" :src="entrepreneur.logoUrl" :alt="entrepreneur.businessName" class="h-24 w-24 shrink-0 rounded-full border-4 border-[#CAF0F8] object-cover sm:h-28 sm:w-28">
                <div v-else class="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-4 border-[#CAF0F8] bg-[#EAF9FC] text-2xl font-black text-[#0077B6] sm:h-28 sm:w-28">{{ initials(entrepreneur.businessName) }}</div>
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold uppercase tracking-[.12em] text-[#00B4D8]">Emprendimiento</p>
                    <h1 class="mt-1 text-2xl font-black text-gray-700 sm:text-3xl">{{ entrepreneur.businessName }}</h1>
                    <div class="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm sm:justify-start">
                        <span class="text-gray-400">{{ entrepreneur.district }}<span v-if="entrepreneur.district&&entrepreneur.department">, </span>{{ entrepreneur.department }}</span>
                        <span class="font-bold text-amber-500">★ {{ averageRating.toFixed(1) }}</span>
                        <span class="text-gray-400">{{ reviewCountText }}</span>
                        <span class="text-gray-400">{{ followerCount }} seguidores</span>
                    </div>
                    <p class="mt-3 max-w-3xl whitespace-pre-line text-sm leading-6 text-gray-500">{{ entrepreneur.description||"Este emprendimiento aún no tiene una descripción." }}</p>

                    <!-- Las etiquetas usan colores según lo que representan. -->
                    <div v-if="allTags.length" class="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                        <span v-for="tag in allTags" :key="tag" class="rounded-full border px-3 py-1.5 text-[11px] font-bold" :class="tagClass(tag)">{{ tag }}</span>
                    </div>

                    <div class="mt-5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                        <button v-if="['cliente','institucion'].includes(viewerType)" type="button" :disabled="followLoading" class="rounded-full border border-[#00B4D8] px-4 py-2 text-xs font-bold text-[#0077B6] disabled:opacity-50" :class="following?'bg-[#CAF0F8]':''" @click="toggleFollow">{{ followLoading?'Actualizando...':following?'Siguiendo':'Seguir +' }}</button>
                        <button v-if="entrepreneur.phone" type="button" class="flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-xs font-bold text-white" @click="whatsapp">WhatsApp</button>
                        <a v-if="entrepreneur.instagramUrl" :href="normalizeUrl(entrepreneur.instagramUrl,'instagram')" target="_blank" rel="noopener noreferrer" class="rounded-full border border-pink-200 bg-pink-50 px-4 py-2 text-xs font-bold text-pink-700">Instagram</a>
                        <a v-if="entrepreneur.facebookUrl" :href="normalizeUrl(entrepreneur.facebookUrl,'facebook')" target="_blank" rel="noopener noreferrer" class="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700">Facebook</a>
                        <a v-if="entrepreneur.tiktokUrl" :href="normalizeUrl(entrepreneur.tiktokUrl,'tiktok')" target="_blank" rel="noopener noreferrer" class="rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-bold text-gray-700">TikTok</a>
                        <a v-if="entrepreneur.websiteUrl" :href="normalizeUrl(entrepreneur.websiteUrl,'website')" target="_blank" rel="noopener noreferrer" class="rounded-full border border-[#90E0EF] bg-[#EAF9FC] px-4 py-2 text-xs font-bold text-[#0077B6]">Sitio web</a>
                    </div>
                </div>
            </div>
        </section>

        <!-- Los productos vuelven a mostrarse como tarjetas, como en el diseño anterior. -->
        <section class="mt-8">
            <div class="mb-5"><p class="text-xs font-bold uppercase tracking-[.12em] text-[#00B4D8]">Catálogo</p><h2 class="mt-1 text-2xl font-black text-gray-700">Productos de {{ entrepreneur.businessName }}</h2></div>
            <div v-if="products.length" class="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
                <article v-for="product in products" :key="product.id" class="min-w-0 overflow-hidden rounded-[20px] border border-gray-100 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <button type="button" class="block w-full text-left" @click="openProduct(product.id)">
                        <div class="relative overflow-hidden rounded-[15px] bg-gray-100">
                            <span v-if="product.discountPercent>0" class="absolute left-2 top-2 z-10 rounded-full bg-rose-500 px-2.5 py-1 text-[9px] font-black text-white">-{{ Math.round(product.discountPercent) }}%</span>
                            <img v-if="product.image" :src="product.image" :alt="product.name" class="aspect-square w-full object-cover">
                            <div v-else class="flex aspect-square items-center justify-center text-xs font-bold text-gray-400">Sin imagen</div>
                        </div>
                        <div class="px-1 pb-1 pt-2">
                            <p v-if="product.categories.length" class="text-[9px] font-bold uppercase text-[#00B4D8]">{{ product.categories[0] }}</p>
                            <h3 class="mt-1 truncate text-sm font-bold text-gray-700">{{ product.name }}</h3>
                            <div class="mt-1 flex flex-wrap items-baseline gap-1">
                                <span v-if="product.discountPercent>0" class="text-[10px] font-bold text-gray-400 line-through">{{ money(product.price) }}</span>
                                <p class="font-black" :class="product.discountPercent>0?'text-rose-600':'text-[#4F7180]'">{{ money(product.discountPercent>0?salePrice(product):product.price) }}</p>
                            </div>
                        </div>
                    </button>
                    <button v-if="entrepreneur.phone" type="button" class="mt-1 flex w-full items-center justify-center gap-1.5 rounded-[14px] bg-[#25D366] px-2 py-2.5 text-[11px] font-bold text-white transition hover:brightness-95" @click.stop="contactProductWhatsApp(product)">
                        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.009-.371-.011-.57-.011-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"></path></svg>
                        WhatsApp
                    </button>
                </article>
            </div>
            <div v-else class="border-t border-gray-200 py-8 text-sm text-gray-500">Este emprendimiento todavía no tiene productos publicados.</div>
        </section>

        <!-- Ubicaciones integradas como parte del perfil, no como otro dashboard. -->
        <section class="mt-10 border-t border-[#DDEFF3] pt-7">
            <div class="mb-5"><p class="text-xs font-bold uppercase tracking-[.12em] text-[#00B4D8]">Dónde encontrarlo</p><h2 class="mt-1 text-2xl font-black text-gray-700">Ubicaciones y horarios</h2></div>
            <div v-if="locations.length" class="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
                <LocationMap :locations="locations" height="400px" @select="selectedLocation=$event"/>
                <div class="divide-y divide-gray-100 border-y border-gray-100 bg-white sm:rounded-[20px] sm:border sm:px-4">
                    <button v-for="location in locations" :key="location.id" type="button" class="w-full border-l-4 px-3 py-4 text-left transition" :class="selectedLocation?.id===location.id?'border-[#00B4D8] bg-[#F5FCFD]':'border-transparent hover:bg-gray-50'" @click="selectedLocation=location">
                        <div class="flex items-center justify-between gap-3"><p class="font-black text-gray-700">{{ location.name }}</p><span v-if="location.isPrimary" class="text-[10px] font-bold text-[#00B4D8]">Principal</span></div>
                        <p class="mt-1 text-xs leading-5 text-gray-500">{{ location.address }}</p>
                        <div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-gray-400"><span v-for="hour in location.hours" :key="hour.weekday">{{ ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][hour.weekday] }}: {{ hour.is_closed?'Cerrado':`${String(hour.open_time).slice(0,5)}–${String(hour.close_time).slice(0,5)}` }}</span></div>
                    </button>
                </div>
            </div>
            <div v-else class="border-t border-gray-200 py-8 text-sm text-gray-500">{{ hasNoPhysicalStore?'Este emprendimiento no cuenta con un local físico.':'Este emprendimiento aún no ha agregado una ubicación exacta.' }}</div>
        </section>

        <!-- Reseñas con el mismo lenguaje simple del resto del perfil. -->
        <section class="mt-10 border-t border-[#DDEFF3] pt-7">
            <div class="mb-5 flex items-end justify-between gap-4"><div><p class="text-xs font-bold uppercase tracking-[.12em] text-[#00B4D8]">Opiniones</p><h2 class="mt-1 text-2xl font-black text-gray-700">Reseñas del emprendimiento</h2></div><div class="text-right"><p class="text-xl font-black text-amber-500">★ {{ averageRating.toFixed(1) }}</p><p class="text-xs text-gray-400">{{ reviewCountText }}</p></div></div>
            <div class="grid gap-6 lg:grid-cols-[360px_1fr]">
                <article v-if="canReview" class="bg-white p-5 sm:rounded-[20px] sm:border sm:border-gray-100">
                    <h3 class="font-black text-gray-700">{{ myReview?'Editar tu reseña':'Dejar una reseña' }}</h3>
                    <div class="mt-3 flex gap-1"><button v-for="star in 5" :key="star" type="button" class="text-3xl" :class="star<=reviewForm.rating?'text-amber-400':'text-gray-200'" @click="reviewForm.rating=star">★</button></div>
                    <textarea v-model="reviewForm.comment" rows="5" maxlength="800" placeholder="Cuéntale a otros clientes cómo fue tu experiencia" class="mt-3 w-full resize-none rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-[#00B4D8]"></textarea>
                    <button :disabled="reviewSaving" class="mt-3 w-full rounded-xl bg-[#00B4D8] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" @click="saveReview">{{ myReview?'Actualizar reseña':'Publicar reseña' }}</button>
                    <button v-if="myReview" :disabled="reviewSaving" class="mt-2 w-full px-4 py-2 text-xs font-bold text-red-500" @click="deleteReview">Eliminar mi reseña</button>
                </article>
                <div :class="canReview?'':'lg:col-span-2'" class="divide-y divide-gray-100 bg-white sm:rounded-[20px] sm:border sm:border-gray-100 sm:px-5">
                    <div v-if="!reviews.length" class="py-8 text-sm text-gray-500">Todavía no hay reseñas de este emprendimiento.</div>
                    <article v-for="review in reviews" :key="review.id" class="py-5">
                        <div class="flex items-start gap-3"><img v-if="review.avatarUrl" :src="review.avatarUrl" class="h-10 w-10 rounded-full object-cover"><div v-else class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF9FC] text-xs font-black text-[#0077B6]">{{ initials(review.fullName) }}</div><div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-3"><div><p class="font-bold text-gray-700">{{ review.fullName }}</p><p class="text-xs text-gray-400">{{ date(review.updatedAt) }}</p></div><span class="text-sm font-black text-amber-500">★ {{ review.rating }}</span></div><p class="mt-2 whitespace-pre-line text-sm leading-6 text-gray-500">{{ review.comment||"Calificó este emprendimiento sin comentario." }}</p></div></div>
                    </article>
                </div>
            </div>
        </section>
    </main>
</div>
</template>

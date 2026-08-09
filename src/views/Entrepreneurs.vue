<script setup>
// Directorio de emprendimientos para clientes. Se mantiene visualmente cerca del catálogo de Thrive.
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";
import CustomerNav from "../components/customer/CustomerNav.vue";

const router=useRouter();
const businesses=ref([]),loading=ref(true),errorText=ref("");
const search=ref(""),department=ref("Todos"),followed=ref([]),followLoading=ref([]);
const departments=["Todos","Ahuachapán","Cabañas","Chalatenango","Cuscatlán","La Libertad","La Paz","La Unión","Morazán","San Miguel","San Salvador","San Vicente","Santa Ana","Sonsonate","Usulután"];
const filtered=computed(()=>{const query=search.value.toLowerCase().trim();return businesses.value.filter(business=>(department.value==="Todos"||business.department===department.value)&&(!query||[business.businessName,business.description,business.department,business.district,...business.tags].join(" ").toLowerCase().includes(query)));});
// Una reseña aislada no debe colocar automáticamente a un negocio en primer lugar.
const featured=computed(()=>filtered.value.filter(business=>business.reviewCount>0).slice().sort((a,b)=>b.featureScore-a.featureScore||b.reviewCount-a.reviewCount).slice(0,6));

function initials(name){return String(name||"TH").trim().split(/\s+/).slice(0,2).map(word=>word[0]?.toUpperCase()).join("");}
function open(id){router.push({name:"Business",params:{id}});}
function isFollowing(id){return followed.value.includes(id);}
function busy(id){return followLoading.value.includes(id);}
function tagClass(tag){
    const value=String(tag||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    if(value.includes("efectivo"))return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if(value.includes("tarjeta"))return "border-indigo-200 bg-indigo-50 text-indigo-700";
    if(value.includes("transfer"))return "border-sky-200 bg-sky-50 text-sky-700";
    if(value.includes("retiro"))return "border-amber-200 bg-amber-50 text-amber-700";
    if(value.includes("domicilio")||value.includes("entrega"))return "border-orange-200 bg-orange-50 text-orange-700";
    if(value.includes("envio"))return "border-violet-200 bg-violet-50 text-violet-700";
    if(value.includes("personal"))return "border-rose-200 bg-rose-50 text-rose-700";
    return "border-[#90E0EF] bg-[#EAF9FC] text-[#0077B6]";
}
async function loadFollows(){const{data:{user}}=await supabase.auth.getUser();if(!user)return;const{data}=await supabase.from("follows").select("entrepreneur_id").eq("follower_id",user.id);followed.value=(data||[]).map(row=>row.entrepreneur_id);}
async function toggleFollow(id){if(busy(id))return;followLoading.value.push(id);try{const{data:{user}}=await supabase.auth.getUser();if(!user)return;if(isFollowing(id)){const{error}=await supabase.from("follows").delete().eq("follower_id",user.id).eq("entrepreneur_id",id);if(error)throw error;followed.value=followed.value.filter(item=>item!==id);}else{const{error}=await supabase.from("follows").insert({follower_id:user.id,entrepreneur_id:id});if(error&&error.code!=="23505")throw error;if(!followed.value.includes(id))followed.value.push(id);}}catch(error){console.error(error);alert("No fue posible actualizar el seguimiento.");}finally{followLoading.value=followLoading.value.filter(item=>item!==id);}}
async function load(){loading.value=true;errorText.value="";try{const{data,error}=await supabase.rpc("get_entrepreneur_directory");if(error)throw error;businesses.value=(data||[]).map(row=>{const averageRating=Number(row.average_rating)||0;const reviewCount=Number(row.review_count)||0;return{id:row.id,businessName:row.business_name,description:row.description||"",department:row.department||"",district:row.district||"",logoUrl:row.logo_url||"",payment:row.payment_methods||[],services:row.service_tags||[],tags:[...(row.payment_methods||[]),...(row.service_tags||[])],averageRating,reviewCount,featureScore:reviewCount?((averageRating*reviewCount)+(4*3))/(reviewCount+3):0};}).sort((a,b)=>a.businessName.localeCompare(b.businessName,"es"));await loadFollows();}catch(error){console.error(error);errorText.value="No pudimos cargar los emprendimientos.";}finally{loading.value=false;}}
onMounted(load);
</script>

<template>
<div class="min-h-screen bg-[#F8FBFC] pb-[78px] text-gray-700 lg:pb-10">
    <header class="sticky top-0 z-40 border-b border-[#CAF0F8]/60 bg-[#F8FBFC]/95 backdrop-blur-xl">
        <div class="mx-auto max-w-[1450px] px-3 py-3 sm:px-5 lg:px-8 lg:py-4">
            <!-- El buscador usa el mismo lenguaje visual del catálogo. -->
            <div class="flex items-center gap-3">
                <div class="min-w-0 flex-1 rounded-[22px] bg-white px-4 py-3 shadow-sm ring-1 ring-[#CAF0F8]"><div class="flex items-center gap-3"><svg class="h-5 w-5 shrink-0 text-[#00B4D8]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg><input v-model="search" type="search" placeholder="Buscar emprendimiento, servicio o zona" class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400 sm:text-base"></div></div>
                <button type="button" class="hidden rounded-[18px] bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white sm:block" @click="router.push({name:'BusinessMap'})">Ver mapa</button>
            </div>
            <div class="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><button v-for="item in departments" :key="item" type="button" class="whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition" :class="department===item?'bg-[#0077B6] text-white shadow-sm':'bg-[#EAF9FC] text-[#0077B6] hover:bg-[#CAF0F8]'" @click="department=item">{{ item }}</button></div>
            <div class="mt-3"><CustomerNav active="entrepreneurs"/></div>
        </div>
    </header>

    <main class="mx-auto max-w-[1450px] px-3 py-5 sm:px-5 lg:px-8 lg:py-7">
        <div class="mb-6"><p class="text-xs font-black uppercase tracking-[.16em] text-[#00B4D8]">Descubre</p><div class="mt-1 flex items-end justify-between gap-3"><div><h1 class="text-2xl font-black text-gray-800">Emprendedores</h1><p class="mt-1 text-sm text-gray-400">Negocios, servicios y marcas dentro de Thrive.</p></div><p class="text-sm font-semibold text-gray-400">{{ filtered.length }} resultados</p></div></div>

        <div v-if="loading" class="py-24 text-center"><div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div></div>
        <div v-else-if="errorText" class="bg-white p-10 text-center sm:rounded-[22px]"><p class="font-black">{{ errorText }}</p><button class="mt-4 rounded-xl bg-[#00B4D8] px-5 py-3 font-bold text-white" @click="load">Reintentar</button></div>
        <template v-else>
            <!-- Destacados compactos; llaman la atención sin dominar la pantalla. -->
            <section v-if="featured.length" class="mb-9">
                <div class="mb-4 flex items-end justify-between"><div><p class="text-xs font-black uppercase tracking-[.14em] text-[#00B4D8]">Mejor valorados</p><h2 class="mt-1 text-xl font-black text-gray-700">Destacados</h2></div></div>
                <div class="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <article v-for="business in featured" :key="`featured-${business.id}`" class="w-[250px] shrink-0 cursor-pointer border-t-4 border-[#00B4D8] bg-white p-4 shadow-sm sm:rounded-b-[18px]" @click="open(business.id)">
                        <div class="flex items-center gap-3"><img v-if="business.logoUrl" :src="business.logoUrl" class="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-[#CAF0F8]"><div v-else class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EAF9FC] font-black text-[#0077B6]">{{ initials(business.businessName) }}</div><div class="min-w-0"><h3 class="truncate font-black text-gray-700">{{ business.businessName }}</h3><p class="mt-1 text-xs text-gray-400">{{ business.district||business.department }}</p><p class="mt-1 text-xs font-bold text-amber-500">★ {{ business.averageRating.toFixed(1) }} <span class="font-medium text-gray-400">· {{ business.reviewCount }} reseñas</span></p></div></div>
                        <div v-if="business.tags.length" class="mt-3 flex flex-wrap gap-1.5"><span v-for="tag in business.tags.slice(0,3)" :key="tag" class="rounded-full border px-2.5 py-1 text-[9px] font-bold" :class="tagClass(tag)">{{ tag }}</span></div>
                    </article>
                </div>
            </section>

            <section v-if="!filtered.length" class="bg-white px-6 py-14 text-center sm:rounded-[22px]"><h3 class="font-black text-gray-700">No encontramos emprendimientos</h3><p class="mt-2 text-sm text-gray-400">Prueba otra búsqueda o un departamento diferente.</p></section>
            <section v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <article v-for="business in filtered" :key="business.id" class="group cursor-pointer bg-white px-4 py-5 sm:rounded-[20px] sm:border sm:border-gray-100" @click="open(business.id)">
                    <div class="flex items-start gap-4">
                        <img v-if="business.logoUrl" :src="business.logoUrl" :alt="business.businessName" class="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-[#CAF0F8]"><div v-else class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#EAF9FC] text-sm font-black text-[#0077B6]">{{ initials(business.businessName) }}</div>
                        <div class="min-w-0 flex-1"><div class="flex items-start justify-between gap-2"><div class="min-w-0"><h2 class="truncate text-lg font-black text-gray-700">{{ business.businessName }}</h2><p class="mt-0.5 text-xs font-semibold text-gray-400">{{ business.district||business.department }}</p></div><button type="button" :disabled="busy(business.id)" class="shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-bold" :class="isFollowing(business.id)?'border-[#90E0EF] bg-[#EAF9FC] text-[#0077B6]':'border-gray-200 text-gray-500'" @click.stop="toggleFollow(business.id)">{{ isFollowing(business.id)?'Siguiendo':'Seguir +' }}</button></div><div class="mt-2 flex items-center gap-2 text-xs"><span class="font-black text-amber-500">★ {{ business.averageRating.toFixed(1) }}</span><span class="text-gray-400">{{ business.reviewCount }} reseñas</span></div></div>
                    </div>
                    <p class="mt-4 line-clamp-2 text-sm leading-6 text-gray-500">{{ business.description||"Conoce este emprendimiento y lo que ofrece dentro de Thrive." }}</p>
                    <div v-if="business.tags.length" class="mt-3 flex flex-wrap gap-1.5"><span v-for="tag in business.tags.slice(0,4)" :key="tag" class="rounded-full border px-2.5 py-1 text-[9px] font-bold" :class="tagClass(tag)">{{ tag }}</span></div>
                    <div class="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs font-bold text-[#0077B6]"><span>Ver perfil</span><span class="transition group-hover:translate-x-1">→</span></div>
                </article>
            </section>
        </template>
    </main>
</div>
</template>

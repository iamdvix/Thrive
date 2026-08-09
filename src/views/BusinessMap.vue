<script setup>
// Mapa general de emprendimientos. La interfaz se mantiene simple para que el mapa sea el protagonista.
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";
import CustomerHeader from "../components/customer/CustomerHeader.vue";
import LocationMap from "../components/maps/LocationMap.vue";

const router=useRouter();
const points=ref([]),selected=ref(null),loading=ref(true),errorText=ref("");
const search=ref(""),department=ref("Todos");
const filtered=computed(()=>{const query=search.value.toLowerCase().trim();return points.value.filter(point=>(department.value==="Todos"||point.department===department.value)&&(!query||[point.businessName,point.locationName,point.address,point.district,point.department].join(" ").toLowerCase().includes(query)));});
function initials(name){return String(name||"TH").trim().split(/\s+/).slice(0,2).map(word=>word[0]?.toUpperCase()).join("");}
function select(point){selected.value=point;}
function openBusiness(){if(selected.value)router.push({name:"Business",params:{id:selected.value.entrepreneurId}});}
watch(filtered,list=>{if(!list.length){selected.value=null;return;}if(!selected.value||!list.some(point=>point.id===selected.value.id))selected.value=list[0];});
async function load(){loading.value=true;errorText.value="";try{const{data,error}=await supabase.rpc("get_business_map_points");if(error)throw error;points.value=(data||[]).map(row=>({id:row.location_id,entrepreneurId:row.entrepreneur_id,name:row.location_name,locationName:row.location_name,address:row.address,latitude:Number(row.latitude),longitude:Number(row.longitude),isPrimary:Boolean(row.is_primary),businessName:row.business_name,department:row.department||"",district:row.district||"",logoUrl:row.logo_url||"",averageRating:Number(row.average_rating)||0,reviewCount:Number(row.review_count)||0}));selected.value=points.value[0]||null;}catch(error){console.error(error);errorText.value="No pudimos cargar el mapa.";}finally{loading.value=false;}}
onMounted(load);
</script>

<template>
<div class="min-h-screen bg-[#F8FBFC] pb-[78px] text-gray-700 lg:pb-10">
    <CustomerHeader v-model="search" v-model:department="department" active="map" search-placeholder="Buscar emprendimiento, local o zona"/>

    <main class="mx-auto max-w-[1450px] px-3 py-5 sm:px-5 lg:px-8 lg:py-7">
        <div class="mb-5"><p class="text-xs font-black uppercase tracking-[.16em] text-[#00B4D8]">Ubicaciones</p><div class="mt-1 flex items-end justify-between"><div><h1 class="text-2xl font-black text-gray-800">Mapa de emprendimientos</h1><p class="mt-1 text-sm text-gray-400">Toca un punto para conocer el negocio y su local.</p></div><p class="text-sm font-semibold text-gray-400">{{ filtered.length }} locales</p></div></div>

        <div v-if="loading" class="py-24 text-center"><div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div></div>
        <div v-else-if="errorText" class="bg-white p-10 text-center sm:rounded-[22px]">{{ errorText }}</div>
        <div v-else class="grid gap-4 lg:grid-cols-[1fr_330px]">
            <!-- El mapa ocupa el mayor espacio y evita adornos que compitan con él. -->
            <section class="overflow-hidden bg-white p-1.5 shadow-sm sm:rounded-[22px] sm:ring-1 sm:ring-[#CAF0F8]"><LocationMap :locations="filtered" height="min(72vh,720px)" @select="select"/></section>

            <aside class="bg-white sm:rounded-[22px] sm:border sm:border-gray-100">
                <article v-if="selected" class="p-5">
                    <div class="flex items-center gap-3"><img v-if="selected.logoUrl" :src="selected.logoUrl" :alt="selected.businessName" class="h-14 w-14 rounded-full object-cover ring-2 ring-[#CAF0F8]"><div v-else class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#EAF9FC] font-black text-[#0077B6]">{{ initials(selected.businessName) }}</div><div class="min-w-0"><p class="text-[10px] font-bold uppercase tracking-[.12em] text-[#00B4D8]">{{ selected.isPrimary?'Local principal':'Sucursal' }}</p><h2 class="mt-1 truncate text-lg font-black text-gray-700">{{ selected.businessName }}</h2><p class="mt-1 text-xs font-bold text-amber-500">★ {{ selected.averageRating.toFixed(1) }} <span class="font-medium text-gray-400">· {{ selected.reviewCount }} reseñas</span></p></div></div>
                    <div class="mt-5 border-y border-gray-100 py-4"><p class="font-bold text-gray-700">{{ selected.locationName }}</p><p class="mt-1 text-sm leading-6 text-gray-500">{{ selected.address }}</p><p class="mt-2 text-xs font-semibold text-[#0077B6]">{{ selected.district||selected.department }}</p></div>
                    <button class="mt-4 w-full rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white" @click="openBusiness">Ver perfil</button>
                </article>
                <div v-else class="p-6 text-sm text-gray-500">No hay locales que coincidan con estos filtros.</div>

                <!-- En laptop se puede cambiar de local sin abrir otra pantalla. -->
                <div v-if="filtered.length" class="max-h-[280px] overflow-y-auto border-t border-gray-100 px-3 py-2">
                    <button v-for="point in filtered" :key="point.id" type="button" class="flex w-full items-center gap-3 border-l-4 px-3 py-3 text-left" :class="selected?.id===point.id?'border-[#00B4D8] bg-[#F5FCFD]':'border-transparent hover:bg-gray-50'" @click="select(point)"><img v-if="point.logoUrl" :src="point.logoUrl" class="h-9 w-9 rounded-full object-cover"><div v-else class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF9FC] text-[9px] font-black text-[#0077B6]">{{ initials(point.businessName) }}</div><div class="min-w-0"><p class="truncate text-xs font-bold text-gray-700">{{ point.businessName }}</p><p class="truncate text-[10px] text-gray-400">{{ point.locationName }}</p></div></button>
                </div>
            </aside>
        </div>
    </main>
</div>
</template>

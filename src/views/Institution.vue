<script setup>
// Perfil público de una institución. Usa la misma estructura limpia de los perfiles de Thrive.
import { ref,computed,onMounted,watch } from "vue";
import { useRoute,useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";
const route=useRoute(),router=useRouter();
const institution=ref(null),posts=ref([]),loading=ref(true),errorText=ref("");
const id=computed(()=>String(route.params.id||""));
function initials(name){return String(name||"TH").trim().split(/\s+/).slice(0,2).map(word=>word[0]?.toUpperCase()).join("");}
function url(value){if(!value)return"";return /^https?:\/\//i.test(value)?value:`https://${value}`;}
function formatDate(value){return value?new Intl.DateTimeFormat("es-SV",{day:"numeric",month:"short",year:"numeric"}).format(new Date(value)):"";}
function goBack(){if(window.history.length>1)router.back();else router.push({name:"Catalog"});}
function whatsapp(){const raw=String(institution.value?.phone||"").replace(/\D/g,"");const phone=raw.length===8?`503${raw}`:raw;const message=encodeURIComponent(`Hola, encontré a ${institution.value?.name} por medio de Thrive y quisiera obtener más información.`);window.open(phone?`https://wa.me/${phone}?text=${message}`:`https://wa.me/?text=${message}`,"_blank","noopener,noreferrer");}
async function load(){loading.value=true;errorText.value="";try{const{data,error}=await supabase.rpc("get_public_institutions");if(error)throw error;const row=(data||[]).find(item=>item.id===id.value);if(!row){errorText.value="No encontramos esta institución.";institution.value=null;return;}institution.value={id:row.id,name:row.institution_name,description:row.description||"",website:row.website||"",department:row.department||"",district:row.district||"",logoUrl:row.logo_url||"",phone:row.phone||""};const{data:postRows,error:postError}=await supabase.from("institution_posts").select("id,title,description,post_type,location,external_url,event_date,published_at").eq("institution_id",id.value).eq("status","published").order("published_at",{ascending:false}).limit(6);if(!postError)posts.value=postRows||[];}catch(error){console.error(error);errorText.value="No fue posible cargar el perfil institucional.";}finally{loading.value=false;}}
watch(id,load);onMounted(load);
</script>
<template>
<div class="min-h-screen bg-[#F8FBFC] text-gray-700">
    <header class="sticky top-0 z-40 border-b border-[#DDEFF3] bg-[#F8FBFC]/95 backdrop-blur-xl"><div class="mx-auto flex max-w-[1100px] items-center gap-3 px-4 py-3 sm:px-6"><button type="button" class="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg font-bold text-[#0077B6] ring-1 ring-[#DDEFF3]" @click="goBack">←</button><div><p class="text-[10px] font-bold uppercase tracking-[.12em] text-[#00B4D8]">Thrive</p><p class="text-sm font-black text-gray-700">Perfil institucional</p></div></div></header>
    <main v-if="loading" class="py-28 text-center"><div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div></main>
    <main v-else-if="errorText" class="mx-auto max-w-xl px-5 py-24 text-center"><p class="font-black text-gray-700">{{ errorText }}</p></main>
    <main v-else-if="institution" class="mx-auto max-w-[1100px] px-4 py-5 sm:px-6 lg:py-8">
        <section class="overflow-hidden bg-white sm:rounded-[22px] sm:border sm:border-gray-100"><div class="h-2 bg-[#00B4D8]"></div><div class="p-5 sm:p-7">
            <div class="flex flex-col gap-5 sm:flex-row sm:items-center"><img v-if="institution.logoUrl" :src="institution.logoUrl" :alt="institution.name" class="h-24 w-24 shrink-0 rounded-full object-cover ring-4 ring-[#EAF9FC]"><div v-else class="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#EAF9FC] text-xl font-black text-[#0077B6] ring-4 ring-[#CAF0F8]">{{ initials(institution.name) }}</div><div class="min-w-0 flex-1"><p class="text-xs font-bold uppercase tracking-[.12em] text-[#00B4D8]">Institución en Thrive</p><h1 class="mt-1 text-2xl font-black text-gray-800 sm:text-3xl">{{ institution.name }}</h1><p class="mt-1 text-sm font-semibold text-gray-400">{{ institution.district||institution.department||'El Salvador' }}</p><div class="mt-4 flex flex-wrap gap-2"><button v-if="institution.phone" type="button" class="rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white" @click="whatsapp">WhatsApp</button><a v-if="institution.website" :href="url(institution.website)" target="_blank" rel="noopener noreferrer" class="rounded-xl bg-[#EAF9FC] px-4 py-2.5 text-sm font-bold text-[#0077B6]">Sitio web</a></div></div></div>
            <div class="mt-6 border-t border-gray-100 pt-5"><p class="text-xs font-bold uppercase tracking-[.12em] text-[#00B4D8]">Acerca de la institución</p><p class="mt-2 whitespace-pre-line text-sm leading-7 text-gray-500">{{ institution.description||'Información institucional disponible en Thrive.' }}</p></div>
            <div class="mt-5 grid gap-3 border-t border-gray-100 pt-5 sm:grid-cols-2"><div><p class="text-[10px] font-bold uppercase tracking-[.1em] text-gray-400">Contacto</p><p class="mt-1 text-sm font-semibold text-gray-600">{{ institution.phone||'No registrado' }}</p></div><div><p class="text-[10px] font-bold uppercase tracking-[.1em] text-gray-400">Ubicación</p><p class="mt-1 text-sm font-semibold text-gray-600">{{ institution.district||institution.department||'No registrada' }}</p></div></div>
        </div></section>
        <section class="mt-8"><div class="mb-4"><p class="text-xs font-bold uppercase tracking-[.12em] text-[#00B4D8]">Actualidad</p><h2 class="mt-1 text-2xl font-black text-gray-800">Publicaciones recientes</h2></div>
            <div v-if="posts.length" class="divide-y divide-gray-100 bg-white sm:rounded-[22px] sm:border sm:border-gray-100 sm:px-5"><article v-for="post in posts" :key="post.id" class="py-5"><div class="flex flex-wrap items-center gap-2"><span class="rounded-full bg-[#EAF9FC] px-3 py-1 text-[10px] font-bold uppercase text-[#0077B6]">{{ post.post_type }}</span><span class="text-xs text-gray-400">{{ formatDate(post.event_date||post.published_at) }}</span><span v-if="post.location" class="text-xs text-gray-400">· {{ post.location }}</span></div><h3 class="mt-3 text-lg font-black text-gray-700">{{ post.title }}</h3><p class="mt-2 text-sm leading-6 text-gray-500">{{ post.description }}</p><a v-if="post.external_url" :href="url(post.external_url)" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block text-sm font-bold text-[#0077B6]">Más información →</a></article></div>
            <div v-else class="bg-white px-5 py-8 text-sm text-gray-500 sm:rounded-[22px] sm:border sm:border-gray-100">Esta institución todavía no tiene publicaciones recientes.</div>
        </section>
    </main>
</div>
</template>

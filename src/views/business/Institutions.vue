<script setup>
// Directorio institucional para emprendedores. Mantiene el mismo lenguaje visual sencillo del panel Thrive.
import { ref,computed,onMounted } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../../lib/supabaseClient";
import BusinessNav from "../../components/business/BusinessNav.vue";
import BrandLogo from "../../components/shared/BrandLogo.vue";
const router=useRouter();
const businessName=ref("Thrive"),institutions=ref([]),loading=ref(true),errorText=ref(""),search=ref(""),department=ref("Todos");
const departments=computed(()=>["Todos",...new Set(institutions.value.map(i=>i.department).filter(Boolean).sort((a,b)=>a.localeCompare(b,"es")))]);
const filtered=computed(()=>{const q=search.value.toLowerCase().trim();return institutions.value.filter(i=>(department.value==="Todos"||i.department===department.value)&&(!q||[i.name,i.description,i.department,i.district].join(" ").toLowerCase().includes(q)));});
function initials(name){return String(name||"TH").trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()).join("");}
function url(value){if(!value)return"";return /^https?:\/\//i.test(value)?value:`https://${value}`;}
function whatsapp(phone,name){const raw=String(phone||"").replace(/\D/g,"");const finalPhone=raw.length===8?`503${raw}`:raw;const message=encodeURIComponent(`Hola, encontré a ${name} en Thrive y quisiera solicitar información.`);window.open(finalPhone?`https://wa.me/${finalPhone}?text=${message}`:`https://wa.me/?text=${message}`,"_blank","noopener,noreferrer");}
async function load(){loading.value=true;errorText.value="";try{const{data:{user}}=await supabase.auth.getUser();if(!user)return router.replace({name:"Access"});const[{data:b,error:bErr},{data,error}]=await Promise.all([supabase.from("entrepreneurs").select("business_name").eq("id",user.id).single(),supabase.rpc("get_public_institutions")]);if(bErr)throw bErr;if(error)throw error;businessName.value=b.business_name||"Thrive";institutions.value=(data||[]).map(i=>({id:i.id,name:i.institution_name,description:i.description||"",website:i.website||"",department:i.department||"",district:i.district||"",logoUrl:i.logo_url||"",phone:i.phone||""}));}catch(error){console.error(error);errorText.value="No fue posible cargar las instituciones.";}finally{loading.value=false;}}
onMounted(load);
</script>
<template>
<div class="min-h-screen bg-[#F8FBFC] pb-[78px] text-gray-700 lg:pb-10">
    <BusinessNav active="institutions" :business-name="businessName"/>
    <main class="mx-auto max-w-[1450px] px-3 py-5 sm:px-5 lg:px-8 lg:py-7">
        <section class="rounded-[22px] border border-[#DDEFF3] border-l-4 border-l-[#00B4D8] bg-white px-5 py-5 shadow-sm sm:px-6">
            <p class="text-xs font-black uppercase tracking-[.14em] text-[#00B4D8]">Red de apoyo</p>
            <div class="mt-1 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 class="text-2xl font-black text-gray-800 sm:text-3xl">Instituciones en Thrive</h1><p class="mt-1 max-w-2xl text-sm leading-6 text-gray-500">Encuentra contactos, sitios web y perfiles de las instituciones que acompañan a los emprendedores.</p></div><label class="flex w-full items-center gap-3 rounded-[16px] bg-[#F8FBFC] px-4 py-3 ring-1 ring-[#CAF0F8] lg:max-w-[390px]"><svg class="h-4 w-4 shrink-0 text-[#00B4D8]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg><input v-model="search" type="search" class="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400" placeholder="Buscar institución o zona"></label></div>
        </section>
        <div class="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><button v-for="item in departments" :key="item" type="button" class="whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold" :class="department===item?'bg-[#0077B6] text-white':'bg-[#EAF9FC] text-[#0077B6]'" @click="department=item">{{ item }}</button></div>
        <div v-if="loading" class="py-24 text-center"><div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div></div>
        <div v-else-if="errorText" class="mt-5 rounded-[22px] border border-[#DDEFF3] bg-white p-10 text-center">{{ errorText }}</div>
        <section v-else-if="filtered.length" class="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <article v-for="institution in filtered" :key="institution.id" class="group rounded-[20px] border border-[#DDEFF3] bg-white p-5 shadow-sm">
                <div class="flex items-start gap-4"><BrandLogo :src="institution.logoUrl" :alt="institution.name" :name="institution.name" size="lg"/><div class="min-w-0 flex-1"><h2 class="line-clamp-2 text-lg font-black text-gray-700">{{ institution.name }}</h2><p class="mt-1 text-xs font-semibold text-gray-400">{{ institution.district||institution.department||'El Salvador' }}</p></div></div>
                <p class="mt-4 line-clamp-3 min-h-[72px] text-sm leading-6 text-gray-500">{{ institution.description||'Institución asociada a Thrive.' }}</p>
                <div class="mt-4 flex flex-wrap gap-2"><span v-if="institution.phone" class="rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">WhatsApp disponible</span><span v-if="institution.website" class="rounded-full bg-sky-50 px-3 py-1.5 text-[10px] font-bold text-sky-700">Sitio web</span></div>
                <div class="mt-5 grid grid-cols-2 gap-2 border-t border-gray-100 pt-4"><button v-if="institution.phone" type="button" class="rounded-xl bg-[#25D366] px-3 py-2.5 text-xs font-black text-white" @click="whatsapp(institution.phone,institution.name)">WhatsApp</button><a v-if="institution.website" :href="url(institution.website)" target="_blank" rel="noopener noreferrer" class="rounded-xl bg-[#EAF9FC] px-3 py-2.5 text-center text-xs font-black text-[#0077B6]">Sitio web</a><button type="button" class="col-span-2 flex items-center justify-between rounded-xl px-1 py-2 text-left text-xs font-black text-[#0077B6]" @click="router.push({name:'InstitutionPublic',params:{id:institution.id}})"><span>Ver perfil institucional</span><span class="transition group-hover:translate-x-1">→</span></button></div>
            </article>
        </section>
        <div v-else class="mt-6 rounded-[22px] border border-[#DDEFF3] bg-white p-10 text-center text-sm text-gray-500">No encontramos instituciones con esos filtros.</div>
    </main>
</div>
</template>

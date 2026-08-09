<script setup>
// Navegación del emprendedor. En celular dejamos solo cinco accesos para no saturar la pantalla.
import { computed,ref } from "vue";
import { useRouter } from "vue-router";
const props=defineProps({active:{type:String,default:"home"},businessName:{type:String,default:"Thrive"}});
const router=useRouter();
const showMore=ref(false);
const desktopItems=[
    {key:"home",label:"Inicio",route:"BizHome"},
    {key:"stock",label:"Inventario",route:"BizStock"},
    {key:"news",label:"Novedades",route:"BizNews"},
    {key:"institutions",label:"Instituciones",route:"BizInstitutions"},
    {key:"profit",label:"Calculadora",route:"BizProfit"},
    {key:"profile",label:"Perfil",route:"BizProfile"}
];
const mobileItems=[
    {key:"home",label:"Inicio",route:"BizHome",icon:"home"},
    {key:"stock",label:"Inventario",route:"BizStock",icon:"stock"},
    {key:"news",label:"Novedades",route:"BizNews",icon:"news"},
    {key:"institutions",label:"Instituciones",route:"BizInstitutions",icon:"institution"}
];
const moreActive=computed(()=>["profit","profile"].includes(props.active));
function go(route){showMore.value=false;router.push({name:route});}
</script>
<template>
<header class="sticky top-0 z-40 hidden bg-[#F8FBFC] lg:block">
    <div class="mx-auto max-w-[1450px] px-8 pt-4">
        <nav class="rounded-[24px] bg-[#00B4D8] p-2 shadow-sm" aria-label="Navegación del emprendedor">
            <div class="mx-auto grid w-full max-w-[1080px] grid-cols-6 gap-2">
                <button v-for="item in desktopItems" :key="item.key" type="button" class="w-full rounded-full px-3 py-2.5 text-sm font-bold transition" :class="active===item.key?'bg-white text-[#0077B6] shadow-sm':'text-white/85 hover:bg-white/15 hover:text-white'" @click="go(item.route)">{{ item.label }}</button>
            </div>
        </nav>
    </div>
</header>

<!-- En móvil Calculadora y Perfil viven dentro del botón de engranaje. -->
<nav class="fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-[28px] border-t border-white/20 bg-[#00B4D8] shadow-[0_-6px_20px_rgba(0,0,0,0.12)] lg:hidden" aria-label="Navegación móvil del emprendedor">
    <div class="mx-auto grid max-w-lg grid-cols-5">
        <button v-for="item in mobileItems" :key="item.key" type="button" class="flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-white transition" :class="active===item.key?'bg-white/15':'text-white/70'" @click="go(item.route)">
            <svg v-if="item.icon==='home'" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"></path><path d="M5 10v10h14V10"></path></svg>
            <svg v-else-if="item.icon==='stock'" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 7l8-4 8 4-8 4-8-4z"></path><path d="M4 7v10l8 4 8-4V7"></path></svg>
            <svg v-else-if="item.icon==='news'" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path></svg>
            <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 9h18M5 9v10M9 9v10M15 9v10M19 9v10M2 19h20M12 3l9 4H3l9-4z"></path></svg>
            <span class="w-full truncate text-center text-[8px] font-bold sm:text-[9px]">{{ item.label }}</span>
        </button>
        <button type="button" class="flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-white transition" :class="moreActive||showMore?'bg-white/15':'text-white/70'" aria-label="Más opciones" @click="showMore=!showMore">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6v.2h-4V21a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 00.3-1.9A1.7 1.7 0 003 14H2.8v-4H3a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 001.9.3A1.7 1.7 0 0010 3v-.2h4V3a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.6 1h.2v4H21a1.7 1.7 0 00-1.6 1z"></path></svg>
            <span class="text-[8px] font-bold sm:text-[9px]">Más</span>
        </button>
    </div>
</nav>

<Teleport to="body">
    <div v-if="showMore" class="fixed inset-0 z-[49] bg-black/25 lg:hidden" @click="showMore=false"></div>
    <section v-if="showMore" class="fixed inset-x-3 bottom-[78px] z-[60] mx-auto max-w-md rounded-[24px] bg-white p-3 shadow-[0_18px_50px_rgba(0,0,0,.2)] ring-1 ring-[#DDEFF3] lg:hidden">
        <p class="px-2 pb-2 text-[10px] font-black uppercase tracking-[.12em] text-[#00B4D8]">{{ businessName }}</p>
        <div class="grid grid-cols-2 gap-2">
            <button type="button" class="flex items-center gap-3 rounded-[18px] p-3 text-left" :class="active==='profit'?'bg-[#EAF9FC] text-[#0077B6]':'bg-[#F8FBFC] text-gray-600'" @click="go('BizProfit')">
                <span class="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white shadow-sm"><svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"></path></svg></span>
                <span class="text-xs font-black">Calculadora</span>
            </button>
            <button type="button" class="flex items-center gap-3 rounded-[18px] p-3 text-left" :class="active==='profile'?'bg-[#EAF9FC] text-[#0077B6]':'bg-[#F8FBFC] text-gray-600'" @click="go('BizProfile')">
                <span class="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white shadow-sm"><svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0116 0"></path></svg></span>
                <span class="text-xs font-black">Mi perfil</span>
            </button>
        </div>
    </section>
</Teleport>
</template>

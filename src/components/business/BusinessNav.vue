<script setup>
// Navegación del emprendedor. El perfil queda fuera del menú principal como acceso de configuración.
import { useRouter } from "vue-router";
const props=defineProps({active:{type:String,default:"home"},businessName:{type:String,default:"Thrive"}});
const router=useRouter();
const items=[
    {key:"home",label:"Inicio",route:"BizHome",icon:"home"},
    {key:"stock",label:"Inventario",route:"BizStock",icon:"stock"},
    {key:"profit",label:"Calculadora",route:"BizProfit",icon:"profit"},
    {key:"news",label:"Novedades",route:"BizNews",icon:"news"},
    {key:"institutions",label:"Instituciones",route:"BizInstitutions",icon:"institution"}
];
function go(route){router.push({name:route});}
</script>
<template>
<header class="sticky top-0 z-40 hidden bg-[#F8FBFC] lg:block">
    <div class="mx-auto flex max-w-[1450px] items-center gap-3 px-8 pt-4">
        <nav class="min-w-0 flex-1 rounded-[24px] bg-[#00B4D8] p-2 shadow-sm" aria-label="Navegación del emprendedor">
            <div class="mx-auto grid w-full max-w-[980px] grid-cols-5 gap-2">
                <button v-for="item in items" :key="item.key" type="button" class="w-full rounded-full px-3 py-2.5 text-sm font-bold transition" :class="active===item.key?'bg-white text-[#0077B6] shadow-sm':'text-white/85 hover:bg-white/15 hover:text-white'" @click="go(item.route)">{{ item.label }}</button>
            </div>
        </nav>
        <button type="button" class="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-[#CAF0F8] bg-white text-[#0077B6] shadow-sm transition hover:bg-[#EAF9FC]" :class="active==='profile'?'ring-2 ring-[#00B4D8]':''" title="Configuración del perfil" aria-label="Configuración del perfil" @click="go('BizProfile')">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6v.2h-4V21a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 00.3-1.9A1.7 1.7 0 003 14H2.8v-4H3a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 001.9.3A1.7 1.7 0 0010 3v-.2h4V3a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.6 1h.2v4H21a1.7 1.7 0 00-1.6 1z"></path></svg>
        </button>
    </div>
</header>
<!-- En celular la configuración queda arriba y el menú inferior conserva cinco accesos claros. -->
<div class="sticky top-0 z-40 flex justify-end bg-[#F8FBFC]/95 px-3 py-2 backdrop-blur lg:hidden">
    <button type="button" class="flex h-10 w-10 items-center justify-center rounded-[15px] border border-[#CAF0F8] bg-white text-[#0077B6] shadow-sm" :class="active==='profile'?'ring-2 ring-[#00B4D8]':''" title="Configuración del perfil" aria-label="Configuración del perfil" @click="go('BizProfile')">
        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6v.2h-4V21a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 00.3-1.9A1.7 1.7 0 003 14H2.8v-4H3a1.7 1.7 0 001.6-1 1.7 1.7 0 00-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 001.9.3A1.7 1.7 0 0010 3v-.2h4V3a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 00-.3 1.9 1.7 1.7 0 001.6 1h.2v4H21a1.7 1.7 0 00-1.6 1z"></path></svg>
    </button>
</div>
<Teleport to="body">
    <nav class="fixed inset-x-0 bottom-0 z-[100] overflow-hidden rounded-t-[28px] border-t border-white/20 bg-[#00B4D8] shadow-[0_-6px_20px_rgba(0,0,0,.12)] lg:hidden" aria-label="Navegación móvil del emprendedor">
        <div class="mx-auto grid max-w-lg grid-cols-5">
            <button v-for="item in items" :key="item.key" type="button" class="flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-white transition" :class="active===item.key?'bg-white/15':'text-white/70'" @click="go(item.route)">
                <svg v-if="item.icon==='home'" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"></path><path d="M5 10v10h14V10"></path></svg>
                <svg v-else-if="item.icon==='stock'" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 7l8-4 8 4-8 4-8-4z"></path><path d="M4 7v10l8 4 8-4V7"></path></svg>
                <svg v-else-if="item.icon==='profit'" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"></path></svg>
                <svg v-else-if="item.icon==='news'" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path></svg>
                <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 9h18M5 9v10M9 9v10M15 9v10M19 9v10M2 19h20M12 3l9 4H3l9-4z"></path></svg>
                <span class="w-full truncate text-center text-[8px] font-bold sm:text-[9px]">{{ item.label }}</span>
            </button>
        </div>
    </nav>
</Teleport>
</template>

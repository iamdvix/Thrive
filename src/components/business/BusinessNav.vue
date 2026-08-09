<script setup>
// Navegación del emprendedor. En móvil el perfil vive en un menú pequeño para no saturar la barra inferior.
import { ref } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../../lib/supabaseClient";
const props=defineProps({active:{type:String,default:"home"},businessName:{type:String,default:"Thrive"}});
const router=useRouter();
const menuOpen=ref(false),logoutLoading=ref(false);
const mainItems=[
    {key:"home",label:"Inicio",route:"BizHome",icon:"home"},
    {key:"stock",label:"Inventario",route:"BizStock",icon:"stock"},
    {key:"profit",label:"Calculadora",route:"BizProfit",icon:"profit"},
    {key:"news",label:"Novedades",route:"BizNews",icon:"news"},
    {key:"institutions",label:"Instituciones",route:"BizInstitutions",icon:"institution"}
];
const desktopItems=[...mainItems,{key:"profile",label:"Perfil",route:"BizProfile",icon:"profile"}];
function go(route){menuOpen.value=false;router.push({name:route});}
async function logout(){if(logoutLoading.value)return;logoutLoading.value=true;try{await supabase.auth.signOut({scope:"local"});router.replace({name:"Access"});}finally{logoutLoading.value=false;menuOpen.value=false;}}
</script>
<template>
<header class="sticky top-0 z-40 hidden bg-[#F8FBFC] lg:block">
    <div class="mx-auto max-w-[1450px] px-8 pt-4">
        <nav class="rounded-[24px] bg-[#00B4D8] p-2 shadow-sm" aria-label="Navegación del emprendedor">
            <div class="mx-auto grid w-full max-w-[1120px] grid-cols-6 gap-2">
                <button v-for="item in desktopItems" :key="item.key" type="button" class="w-full rounded-full px-3 py-2.5 text-sm font-bold transition" :class="active===item.key?'bg-white text-[#0077B6] shadow-sm':'text-white/85 hover:bg-white/15 hover:text-white'" @click="go(item.route)">{{ item.label }}</button>
            </div>
        </nav>
    </div>
</header>
<!-- En celular los tres puntos guardan acciones secundarias y dejan cinco accesos principales abajo. -->
<div class="sticky top-0 z-40 flex justify-end bg-[#F8FBFC]/95 px-3 py-2 backdrop-blur lg:hidden">
    <div class="relative">
        <button type="button" class="flex h-9 w-9 items-center justify-center text-[#0077B6] transition hover:text-[#00B4D8] active:scale-95" :class="menuOpen?'text-[#00B4D8]':''" aria-label="Más opciones" :aria-expanded="menuOpen" @click="menuOpen=!menuOpen">
            <svg aria-hidden="true" class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.8"></circle>
                <circle cx="12" cy="12" r="1.8"></circle>
                <circle cx="19" cy="12" r="1.8"></circle>
            </svg>
        </button>
        <div v-if="menuOpen" class="absolute right-0 top-12 w-44 overflow-hidden rounded-[18px] border border-[#DDEFF3] bg-white p-1.5 shadow-xl">
            <button type="button" class="flex w-full items-center gap-3 rounded-[13px] px-3 py-3 text-left text-sm font-bold text-gray-700 hover:bg-[#EAF9FC]" @click="go('BizProfile')">
                <svg class="h-4 w-4 text-[#0077B6]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0116 0"></path></svg>
                Perfil
            </button>
            <button type="button" :disabled="logoutLoading" class="flex w-full items-center gap-3 rounded-[13px] px-3 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50" @click="logout">
                <svg class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 17l5-5-5-5"></path><path d="M15 12H3"></path><path d="M13 3h6a2 2 0 012 2v14a2 2 0 01-2 2h-6"></path></svg>
                {{ logoutLoading?'Saliendo...':'Cerrar sesión' }}
            </button>
        </div>
    </div>
</div>
<Teleport to="body">
    <nav class="fixed inset-x-0 bottom-0 z-[100] overflow-hidden rounded-t-[28px] border-t border-white/20 bg-[#00B4D8] shadow-[0_-6px_20px_rgba(0,0,0,.12)] lg:hidden" aria-label="Navegación móvil del emprendedor">
        <div class="mx-auto grid max-w-lg grid-cols-5">
            <button v-for="item in mainItems" :key="item.key" type="button" class="flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-white transition" :class="active===item.key?'bg-white/15':'text-white/70'" @click="go(item.route)">
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

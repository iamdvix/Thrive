<script setup>
// Encabezado común del cliente: búsqueda arriba, navegación debajo y departamentos al final.
import { ref,onMounted } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../../lib/supabaseClient";
import CustomerNav from "./CustomerNav.vue";
const props=defineProps({active:{type:String,default:"discover"},favoriteCount:{type:Number,default:0},modelValue:{type:String,default:""},department:{type:String,default:"Todos"},searchPlaceholder:{type:String,default:"Buscar en Thrive"}});
const emit=defineEmits(["update:modelValue","update:department","search-submit"]);
const router=useRouter();
const client=ref({name:"Cliente",avatarUrl:""});
const departments=["Todos","Ahuachapán","Cabañas","Chalatenango","Cuscatlán","La Libertad","La Paz","La Unión","Morazán","San Miguel","San Salvador","San Vicente","Santa Ana","Sonsonate","Usulután"];
function initials(name){return String(name||"TH").trim().split(/\s+/).slice(0,2).map(word=>word[0]?.toUpperCase()).join("");}
function submit(){emit("search-submit",props.modelValue);}
async function loadClient(){const{data:{user}}=await supabase.auth.getUser();if(!user)return;const{data}=await supabase.from("profiles").select("full_name,avatar_url").eq("id",user.id).maybeSingle();client.value={name:data?.full_name||"Cliente",avatarUrl:data?.avatar_url||""};}
onMounted(loadClient);
</script>
<template>
<header class="sticky top-0 z-40 border-b border-[#DDEFF3] bg-[#F8FBFC]/95 backdrop-blur-xl">
    <div class="mx-auto max-w-[1450px] px-3 py-3 sm:px-5 lg:px-8 lg:py-4">
        <div class="flex items-center gap-3">
            <!-- La isla azul se reserva únicamente para la búsqueda. -->
            <form class="min-w-0 flex-1 rounded-[24px] bg-[#00B4D8] p-2 shadow-[0_8px_22px_rgba(0,180,216,.14)]" @submit.prevent="submit">
                <label class="flex items-center gap-3 rounded-[17px] bg-white px-4 py-3">
                    <svg class="h-5 w-5 shrink-0 text-[#00B4D8]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg>
                    <input :value="modelValue" type="search" :placeholder="searchPlaceholder" class="min-w-0 flex-1 bg-transparent text-sm text-gray-600 outline-none placeholder:text-gray-400 sm:text-base" @input="emit('update:modelValue',$event.target.value)">
                </label>
            </form>
            <!-- La foto queda separada, como en el catálogo anterior. -->
            <button type="button" class="flex h-[52px] w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-white text-[#0077B6] shadow-sm ring-1 ring-[#CAF0F8]" aria-label="Abrir mi perfil" @click="router.push({name:'CustomerProfile'})">
                <img v-if="client.avatarUrl" :src="client.avatarUrl" :alt="client.name" class="h-full w-full object-cover"><span v-else class="text-xs font-black">{{ initials(client.name) }}</span>
            </button>
        </div>
        <div class="lg:mt-3"><CustomerNav :active="active" :favorite-count="favoriteCount"/></div>
        <!-- Los departamentos no son necesarios dentro del perfil del cliente. -->
        <div v-if="active !== 'profile'"class="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button v-for="item in departments" :key="item" type="button" class="whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition" :class="department===item?'bg-[#0077B6] text-white shadow-sm':'bg-[#EAF9FC] text-[#0077B6] hover:bg-[#CAF0F8]'" @click="emit('update:department',item)"> {{ item }} </button>
        </div>
    </div>
</header>
</template>

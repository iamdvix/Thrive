<script setup>
// Tarjeta del plan del emprendedor. Muestra el periodo actual sin convertirlo en una pantalla de publicidad.
import { computed } from "vue";
import { subscriptionIsActive,subscriptionStatusLabel } from "../../lib/subscription";
const props=defineProps({subscription:{type:Object,default:()=>({status:"inactive",price:4.99,startedAt:null,expiresAt:null})},loading:{type:Boolean,default:false},compact:{type:Boolean,default:false},showButton:{type:Boolean,default:true}});
const emit=defineEmits(["subscribe"]);
const active=computed(()=>subscriptionIsActive(props.subscription));
function formatDate(value){if(!value)return"Sin fecha";return new Intl.DateTimeFormat("es-SV",{day:"numeric",month:"long",year:"numeric"}).format(new Date(value));}
</script>
<template>
<section class="overflow-hidden border border-[#CAF0F8] bg-white sm:rounded-[24px]" :class="compact?'p-5':'p-5 sm:p-6'">
    <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2"><span class="rounded-full bg-[#00B4D8] px-3 py-1 text-[10px] font-black uppercase tracking-[.1em] text-white">Plan Thrive</span><span class="rounded-full px-3 py-1 text-[10px] font-black" :class="active?'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-500'">{{ subscriptionStatusLabel(subscription.status) }}</span></div>
            <div class="mt-4 flex flex-wrap items-baseline gap-x-2"><span class="text-3xl font-black text-[#0077B6] sm:text-4xl">${{ Number(subscription.price||4.99).toFixed(2) }}</span><span class="text-sm font-bold text-gray-400">al mes</span></div>
            <p class="mt-2 max-w-2xl text-sm leading-6 text-gray-500">Publica productos y usa inventario, pedidos, novedades y calculadora con todas sus funciones.</p>
            <div v-if="active" class="mt-4 grid gap-2 sm:grid-cols-2"><div class="border-l-4 border-[#00B4D8] bg-[#F8FBFC] px-4 py-3"><p class="text-[10px] font-black uppercase tracking-[.1em] text-gray-400">Tu periodo inició</p><p class="mt-1 text-sm font-black text-gray-700">{{ formatDate(subscription.startedAt) }}</p></div><div class="border-l-4 border-emerald-400 bg-[#F8FBFC] px-4 py-3"><p class="text-[10px] font-black uppercase tracking-[.1em] text-gray-400">Tu suscripción termina</p><p class="mt-1 text-sm font-black text-gray-700">{{ formatDate(subscription.expiresAt) }}</p></div></div>
            <p v-else class="mt-4 text-xs font-semibold text-gray-400">Al activar el plan, el periodo se registra con su fecha de inicio y finalización.</p>
        </div>
        <div class="w-full lg:w-auto"><button v-if="showButton&&!active" type="button" :disabled="loading" class="w-full rounded-xl bg-[#00B4D8] px-6 py-3.5 text-sm font-black text-white transition hover:bg-[#009CC0] disabled:opacity-60 lg:w-auto" @click="emit('subscribe')">{{ loading?'Activando plan...':'Activar plan Thrive' }}</button><div v-else-if="active" class="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700"><span class="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">✓</span><span>Herramientas desbloqueadas</span></div></div>
    </div>
</section>
</template>

<script setup>
import { computed } from "vue";
import {
    subscriptionIsActive,
    subscriptionStatusLabel
} from "../../lib/subscription";

const props = defineProps({
    subscription: {
        type: Object,
        default: function () {
            return {
                status: "inactive",
                price: 4.99,
                expiresAt: null
            };
        }
    },
    loading: {
        type: Boolean,
        default: false
    },
    compact: {
        type: Boolean,
        default: false
    },
    showButton: {
        type: Boolean,
        default: true
    }
});

const emit = defineEmits(["subscribe"]);
const active = computed(function () {
    return subscriptionIsActive(props.subscription);
});

function formatDate(date) {
    if (!date) return "";
    return new Intl.DateTimeFormat("es-SV", {
        day: "numeric",
        month: "long",
        year: "numeric"
    }).format(new Date(date));
}
</script>

<template>
<section
    class="overflow-hidden rounded-[24px] border border-[#90E0EF]/70 bg-gradient-to-br from-[#0077B6] via-[#00A8CC] to-[#00B4D8] text-white shadow-sm"
    :class="compact ? 'p-5' : 'p-6 sm:p-7'"
>
    <div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-white/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]">
                    Mi plan
                </span>
                <span
                    class="rounded-full px-3 py-1 text-[10px] font-black"
                    :class="active ? 'bg-green-100 text-green-700' : 'bg-white text-[#0077B6]'"
                >
                    {{ subscriptionStatusLabel(subscription.status) }}
                </span>
            </div>
            <div class="mt-4 flex items-end gap-2">
                <span class="text-4xl font-black sm:text-5xl">
                    ${{ Number(subscription.price || 4.99).toFixed(2) }}
                </span>
                <span class="pb-1 text-sm font-bold text-white/75">
                    al mes
                </span>
            </div>
            <p class="mt-3 max-w-2xl text-sm leading-6 text-white/80">
                Explora todas las herramientas antes de pagar. Al activar el plan podrás publicar productos y utilizar inventario, pedidos, novedades y calculadora sin bloqueos.
            </p>
            <div class="mt-4 grid gap-2 text-xs font-bold text-white/85 sm:grid-cols-2">
                <p class="rounded-xl bg-white/10 px-3 py-2">✓ Productos y fotografías</p>
                <p class="rounded-xl bg-white/10 px-3 py-2">✓ Inventario y pedidos</p>
                <p class="rounded-xl bg-white/10 px-3 py-2">✓ Calculadora financiera</p>
                <p class="rounded-xl bg-white/10 px-3 py-2">✓ Novedades completas</p>
            </div>
            <p
                v-if="active && subscription.expiresAt"
                class="mt-3 text-xs font-bold text-white/80"
            >
                Próxima renovación: {{ formatDate(subscription.expiresAt) }}
            </p>
        </div>
        <div class="w-full lg:w-auto">
            <button
                v-if="showButton && !active"
                type="button"
                :disabled="loading"
                class="w-full rounded-xl bg-white px-6 py-3.5 text-sm font-black text-[#0077B6] shadow-sm transition hover:bg-[#EAF9FC] disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
                @click="emit('subscribe')"
            >
                {{ loading ? "Activando plan..." : "Probar suscripción por $4.99" }}
            </button>
            <p
                v-if="showButton && !active"
                class="mt-2 text-center text-[10px] font-semibold text-white/70"
            >
                La demostración utiliza una tarjeta de prueba y no procesa dinero real.
            </p>
            <div
                v-else-if="active"
                class="rounded-xl border border-white/25 bg-white/15 px-5 py-3 text-center text-sm font-bold"
            >
                Todas las herramientas están disponibles
            </div>
        </div>
    </div>
</section>
</template>

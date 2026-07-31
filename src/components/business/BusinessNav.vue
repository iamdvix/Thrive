<script setup>
// Navegación compartida por todas las pantallas del emprendedor.
import { useRouter } from "vue-router";

const props = defineProps({
    active: {
        type: String,
        default: "home"
    },
    businessName: {
        type: String,
        default: "Thrive"
    }
});

const router = useRouter();

// Productos permanece dentro de Inicio y Pedidos dentro de Inventario.
const items = [
    {
        key: "home",
        label: "Inicio",
        route: "BizHome",
        icon: "home"
    },
    {
        key: "stock",
        label: "Inventario",
        route: "BizStock",
        icon: "stock"
    },
    {
        key: "news",
        label: "Novedades",
        route: "BizNews",
        icon: "news"
    },
    {
        key: "profit",
        label: "Calculadora",
        route: "BizProfit",
        icon: "profit"
    },
    {
        key: "profile",
        label: "Perfil",
        route: "BizProfile",
        icon: "profile"
    }
];

function goTo(item) {
    if (props.active === item.key) return;

    router.push({
        name: item.route
    });
}
</script>

<template>
    <!-- En computadora se muestra la isla principal con las cinco opciones. -->
    <header class="sticky top-0 z-40 hidden bg-[#F8FBFC] lg:block">
        <div class="mx-auto max-w-[1450px] px-8 pt-4">
            <nav
                class="rounded-[24px] bg-[#00B4D8] p-2 shadow-sm"
                aria-label="Navegación del emprendedor"
            >
                <div class="mx-auto grid w-full max-w-[900px] grid-cols-5 gap-2">
                    <button
                        v-for="item in items"
                        :key="item.key"
                        type="button"
                        class="w-full rounded-full px-4 py-2.5 text-sm font-bold transition"
                        :class="
                            active === item.key
                                ? 'bg-white text-[#0077B6] shadow-sm'
                                : 'text-white/85 hover:bg-white/15 hover:text-white'
                        "
                        :aria-current="active === item.key ? 'page' : undefined"
                        @click="goTo(item)"
                    >
                        {{ item.label }}
                    </button>
                </div>
            </nav>
        </div>
    </header>

    <!-- En celular Perfil también queda disponible en la barra inferior. -->
    <nav
        class="fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-[28px] border-t border-white/20 bg-[#00B4D8] shadow-[0_-6px_20px_rgba(0,0,0,0.12)] lg:hidden"
        aria-label="Navegación móvil del emprendedor"
    >
        <div class="mx-auto grid max-w-md grid-cols-5">
            <button
                v-for="item in items"
                :key="item.key"
                type="button"
                class="flex flex-col items-center gap-1 py-2 text-white transition"
                :class="active === item.key ? 'bg-white/15' : 'text-white/75'"
                :aria-current="active === item.key ? 'page' : undefined"
                @click="goTo(item)"
            >
                <svg
                    v-if="item.icon === 'home'"
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                >
                    <path d="M3 11l9-8 9 8"></path>
                    <path d="M5 10v10h14V10"></path>
                </svg>

                <svg
                    v-else-if="item.icon === 'stock'"
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                >
                    <path d="M4 7l8-4 8 4-8 4-8-4z"></path>
                    <path d="M4 7v10l8 4 8-4V7"></path>
                </svg>

                <svg
                    v-else-if="item.icon === 'news'"
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                >
                    <path
                        stroke-linecap="round"
                        d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"
                    ></path>
                </svg>

                <svg
                    v-else-if="item.icon === 'profit'"
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                >
                    <rect
                        x="5"
                        y="3"
                        width="14"
                        height="18"
                        rx="2"
                    ></rect>
                    <path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"></path>
                </svg>

                <svg
                    v-else
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                >
                    <circle cx="12" cy="8" r="4"></circle>
                    <path
                        stroke-linecap="round"
                        d="M4 21a8 8 0 0116 0"
                    ></path>
                </svg>

                <span class="text-[9px] font-bold">
                    {{ item.label }}
                </span>
            </button>
        </div>
    </nav>
</template>

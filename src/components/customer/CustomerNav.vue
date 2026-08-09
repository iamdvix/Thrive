<script setup>
// Navegación principal del cliente, con la misma identidad visual de Thrive.
import { useRouter } from "vue-router";

const props = defineProps({
    active: { type: String, default: "discover" },
    favoriteCount: { type: Number, default: 0 }
});

const router = useRouter();
const items = [
    { key: "discover", label: "Descubrir", route: "Catalog", icon: "discover" },
    { key: "entrepreneurs", label: "Emprendedores", route: "Entrepreneurs", icon: "business" },
    { key: "map", label: "Mapa", route: "BusinessMap", icon: "map" },
    { key: "favorites", label: "Favoritos", route: "Catalog", query: { mode: "favorites" }, icon: "heart" },
    { key: "profile", label: "Mi perfil", route: "CustomerProfile", icon: "profile" }
];

function go(item) {
    if (item.key === props.active && item.key !== "favorites") return;
    router.push({ name: item.route, query: item.query || undefined });
}
</script>

<template>
    <!-- En laptop se muestra como una isla Thrive, no como una franja con líneas grises. -->
    <div class="hidden lg:block">
        <nav class="mx-auto flex max-w-[920px] items-center gap-1 rounded-[26px] bg-[#00B4D8] p-2 shadow-[0_12px_35px_rgba(0,180,216,0.18)]" aria-label="Navegación del cliente">
            <button
                v-for="item in items"
                :key="item.key"
                type="button"
                class="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold transition"
                :class="active === item.key ? 'bg-white text-[#0077B6] shadow-sm' : 'text-white/85 hover:bg-white/15 hover:text-white'"
                :aria-current="active === item.key ? 'page' : undefined"
                @click="go(item)"
            >
                <svg v-if="item.icon === 'discover'" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"></path><path d="M5 10v10h14V10"></path></svg>
                <svg v-else-if="item.icon === 'business'" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 21V7l8-4 8 4v14"></path><path d="M8 10h2M14 10h2M8 14h2M14 14h2M9 21v-4h6v4"></path></svg>
                <svg v-else-if="item.icon === 'map'" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"></path><path d="M9 3v15M15 6v15"></path></svg>
                <svg v-else-if="item.icon === 'heart'" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"></path></svg>
                <svg v-else class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0116 0"></path></svg>
                <span class="truncate">{{ item.label }}</span>
                <span v-if="item.key === 'favorites' && favoriteCount" class="rounded-full px-1.5 py-0.5 text-[9px]" :class="active === item.key ? 'bg-[#CAF0F8] text-[#0077B6]' : 'bg-white/20 text-white'">{{ favoriteCount }}</span>
            </button>
        </nav>
    </div>

    <!-- En móvil mantiene acceso rápido a las cinco áreas. -->
    <nav class="fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-[28px] border-t border-white/20 bg-[#00B4D8] shadow-[0_-8px_24px_rgba(0,0,0,0.14)] lg:hidden" aria-label="Navegación móvil del cliente">
        <div class="mx-auto grid max-w-md grid-cols-5">
            <button
                v-for="item in items"
                :key="item.key"
                type="button"
                class="flex min-w-0 flex-col items-center gap-1 px-1 py-2 text-white transition"
                :class="active === item.key ? 'bg-white/15' : 'text-white/70'"
                @click="go(item)"
            >
                <svg v-if="item.icon === 'discover'" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"></path><path d="M5 10v10h14V10"></path></svg>
                <svg v-else-if="item.icon === 'business'" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 21V7l8-4 8 4v14"></path><path d="M8 10h2M14 10h2M9 21v-4h6v4"></path></svg>
                <svg v-else-if="item.icon === 'map'" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"></path><path d="M9 3v15M15 6v15"></path></svg>
                <svg v-else-if="item.icon === 'heart'" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"></path></svg>
                <svg v-else class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0116 0"></path></svg>
                <span class="w-full truncate text-center text-[8px] font-bold sm:text-[9px]">{{ item.label }}</span>
            </button>
        </div>
    </nav>
</template>

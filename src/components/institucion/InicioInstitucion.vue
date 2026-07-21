<script setup>
// Lista pública de emprendimientos para las instituciones.
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../../lib/supabaseClient";

const router = useRouter();
const entrepreneurs = ref([]);
const loading = ref(true);
const loadError = ref("");
const searchText = ref("");
const selectedDepartment = ref("Todos");

const departments = [
    "Todos",
    "Ahuachapán",
    "Cabañas",
    "Chalatenango",
    "Cuscatlán",
    "La Libertad",
    "La Paz",
    "La Unión",
    "Morazán",
    "San Miguel",
    "San Salvador",
    "San Vicente",
    "Santa Ana",
    "Sonsonate",
    "Usulután"
];

const filteredEntrepreneurs = computed(function () {
    const search = searchText.value
        .trim()
        .toLowerCase();

    return entrepreneurs.value.filter(function (item) {
        const matchesSearch =
            !search ||
            [
                item.businessName,
                item.description,
                item.department,
                item.district
            ]
                .join(" ")
                .toLowerCase()
                .includes(search);

        const matchesDepartment =
            selectedDepartment.value === "Todos" ||
            item.department === selectedDepartment.value;

        return matchesSearch && matchesDepartment;
    });
});

async function loadEntrepreneurs() {
    loading.value = true;
    loadError.value = "";

    try {
        const { data: rows, error } = await supabase
            .from("entrepreneurs")
            .select(`
                id,
                business_name,
                description,
                department,
                district,
                logo_url,
                created_at
            `)
            .order("business_name", {
                ascending: true
            });

        if (error) throw error;

        const entrepreneurRows = rows || [];

        if (!entrepreneurRows.length) {
            entrepreneurs.value = [];
            return;
        }

        const ids = entrepreneurRows.map(function (item) {
            return item.id;
        });

        const { data: productRows, error: productError } = await supabase
            .from("products")
            .select(`
                id,
                entrepreneur_id
            `)
            .in("entrepreneur_id", ids)
            .eq("active", true);

        if (productError) throw productError;

        entrepreneurs.value = entrepreneurRows.map(function (item) {
            const productCount = (productRows || []).filter(
                function (product) {
                    return product.entrepreneur_id === item.id;
                }
            ).length;

            return {
                id: item.id,
                businessName: item.business_name,
                description: item.description || "",
                department: item.department || "",
                district: item.district || "",
                logoUrl: item.logo_url || "",
                productCount
            };
        });
    } catch (error) {
        console.error(
            "Error al cargar emprendedores:",
            error
        );
        loadError.value =
            "No fue posible cargar los emprendimientos.";
    } finally {
        loading.value = false;
    }
}

function openProfile(id) {
    router.push({
        name: "PerfilEmprendedor",
        params: {
            id
        }
    });
}

onMounted(loadEntrepreneurs);
</script>

<template>
<section>
    <div class="mb-5">
        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
            Comunidad Thrive
        </p>
        <h1 class="mt-1 text-2xl font-black text-gray-700 sm:text-3xl">
            Emprendedores
        </h1>
        <p class="mt-1 text-sm text-gray-400">
            Consulta los emprendimientos registrados en la plataforma.
        </p>
    </div>

    <!-- Filtros con el mismo estilo del catálogo. -->
    <section class="mb-6 rounded-[24px] bg-white p-3 shadow-sm sm:p-4">
        <div class="grid gap-3 md:grid-cols-[1fr_220px]">
            <div class="flex items-center gap-3 rounded-xl bg-[#F8FBFC] px-4 py-3">
                <svg class="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7"></circle>
                    <path stroke-linecap="round" d="M20 20l-3.5-3.5"></path>
                </svg>
                <input
                    v-model="searchText"
                    type="search"
                    placeholder="Buscar emprendimiento..."
                    class="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                >
            </div>

            <select
                v-model="selectedDepartment"
                class="rounded-xl border-0 bg-[#F8FBFC] px-4 py-3 text-sm font-semibold text-gray-500 outline-none"
            >
                <option
                    v-for="department in departments"
                    :key="department"
                    :value="department"
                >
                    {{ department }}
                </option>
            </select>
        </div>
    </section>

    <div
        v-if="loading"
        class="rounded-[24px] bg-white px-5 py-20 text-center shadow-sm"
    >
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        <p class="mt-4 text-sm font-semibold text-gray-400">
            Cargando emprendimientos...
        </p>
    </div>

    <div
        v-else-if="loadError"
        class="rounded-[24px] bg-white px-5 py-16 text-center shadow-sm"
    >
        <p class="font-black text-gray-700">
            {{ loadError }}
        </p>
        <button
            type="button"
            class="mt-4 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white"
            @click="loadEntrepreneurs"
        >
            Intentar nuevamente
        </button>
    </div>

    <div
        v-else-if="filteredEntrepreneurs.length"
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
        <article
            v-for="item in filteredEntrepreneurs"
            :key="item.id"
            class="rounded-[24px] bg-white p-5 shadow-sm"
        >
            <div class="flex items-center gap-4">
                <img
                    v-if="item.logoUrl"
                    :src="item.logoUrl"
                    :alt="item.businessName"
                    class="h-16 w-16 shrink-0 rounded-full border-4 border-[#CAF0F8] object-cover"
                >
                <div
                    v-else
                    class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-[#CAF0F8] bg-[#EAF9FC] text-lg font-black text-[#0077B6]"
                >
                    {{ item.businessName.charAt(0).toUpperCase() }}
                </div>

                <div class="min-w-0">
                    <h2 class="truncate font-black text-gray-700">
                        {{ item.businessName }}
                    </h2>
                    <p class="mt-1 truncate text-xs text-gray-400">
                        {{ item.district || item.department || "Ubicación no registrada" }}
                    </p>
                    <p class="mt-2 text-xs font-bold text-[#0077B6]">
                        {{ item.productCount === 1 ? "1 producto" : `${item.productCount} productos` }}
                    </p>
                </div>
            </div>

            <p class="mt-4 line-clamp-3 min-h-[72px] text-sm leading-6 text-gray-500">
                {{ item.description || "Este emprendimiento todavía no tiene descripción." }}
            </p>

            <button
                type="button"
                class="mt-4 w-full rounded-xl border border-[#00B4D8] px-4 py-3 text-sm font-bold text-[#0077B6] transition hover:bg-[#CAF0F8]"
                @click="openProfile(item.id)"
            >
                Ver emprendimiento
            </button>
        </article>
    </div>

    <div
        v-else
        class="rounded-[24px] border border-dashed border-[#90E0EF] bg-white px-5 py-16 text-center"
    >
        <h3 class="font-black text-gray-700">
            No encontramos emprendimientos
        </h3>
        <p class="mt-1 text-sm text-gray-400">
            Cambia los filtros para intentar nuevamente.
        </p>
    </div>
</section>
</template>

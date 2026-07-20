<script setup>
// Calculadora financiera del emprendedor; usa directamente el precio y stock de sus productos en Supabase.
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";

const router = useRouter();

// Información cargada desde la cuenta actual.
const entrepreneur = ref(null);
const products = ref([]);
const loading = ref(true);
const loadError = ref("");
const selectedProductId = ref("");

// Datos editables utilizados para realizar cada estimación.
const costPerUnit = ref(0);
const variableCostPerUnit = ref(0);
const unitsToCalculate = ref(0);
const advertisingCost = ref(0);
const otherFixedCosts = ref(0);
const taxRate = ref(13);
const calculated = ref(false);

// Producto que se está analizando actualmente.
const selectedProduct = computed(function () {
    return products.value.find(function (product) {
        return product.id === selectedProductId.value;
    }) || null;
});

const salePrice = computed(function () {
    return Number(selectedProduct.value?.price) || 0;
});

const currentStock = computed(function () {
    return Number(selectedProduct.value?.stock) || 0;
});

// Nunca se permite calcular una cantidad mayor al stock disponible.
const calculatedUnits = computed(function () {
    const units = Math.max(Number(unitsToCalculate.value) || 0, 0);
    return Math.min(units, currentStock.value);
});

const income = computed(function () {
    return salePrice.value * calculatedUnits.value;
});

const unitVariableCost = computed(function () {
    return (Number(costPerUnit.value) || 0) + (Number(variableCostPerUnit.value) || 0);
});

const totalVariableCosts = computed(function () {
    return unitVariableCost.value * calculatedUnits.value;
});

const totalFixedCosts = computed(function () {
    return (Number(advertisingCost.value) || 0) + (Number(otherFixedCosts.value) || 0);
});

const totalTax = computed(function () {
    return income.value * ((Number(taxRate.value) || 0) / 100);
});

const totalCosts = computed(function () {
    return totalVariableCosts.value + totalFixedCosts.value + totalTax.value;
});

const estimatedProfit = computed(function () {
    return income.value - totalCosts.value;
});

// Ganancia de contribución de una unidad antes de repartir los costos fijos.
const profitPerUnit = computed(function () {
    const taxPerUnit = salePrice.value * ((Number(taxRate.value) || 0) / 100);
    return salePrice.value - unitVariableCost.value - taxPerUnit;
});

// El margen mostrado toma en cuenta todos los costos del cálculo, incluidos los costos fijos.
const profitMargin = computed(function () {
    if (income.value <= 0) return 0;
    return (estimatedProfit.value / income.value) * 100;
});

// Rentabilidad aproximada sobre el dinero utilizado para cubrir todos los costos.
const profitability = computed(function () {
    if (totalCosts.value <= 0) return estimatedProfit.value > 0 ? 100 : 0;
    return (estimatedProfit.value / totalCosts.value) * 100;
});

const costPercentage = computed(function () {
    if (income.value <= 0) return 0;
    return (totalCosts.value / income.value) * 100;
});

// Cantidad mínima de unidades necesarias para cubrir los costos fijos.
const breakEvenUnits = computed(function () {
    if (profitPerUnit.value <= 0) return 0;
    return Math.ceil(totalFixedCosts.value / profitPerUnit.value);
});

const breakEvenProgress = computed(function () {
    if (breakEvenUnits.value <= 0) return 0;
    return Math.min((calculatedUnits.value / breakEvenUnits.value) * 100, 100);
});

const inventoryValue = computed(function () {
    return salePrice.value * currentStock.value;
});

// Proyección si se vendiera todo el inventario con los mismos costos utilizados en el cálculo.
const fullStockProfit = computed(function () {
    const stockIncome = salePrice.value * currentStock.value;
    const stockVariables = unitVariableCost.value * currentStock.value;
    const stockTax = stockIncome * ((Number(taxRate.value) || 0) / 100);
    return stockIncome - stockVariables - totalFixedCosts.value - stockTax;
});

// La recomendación analiza primero pérdidas, punto de equilibrio y después el margen neto real.
const recommendation = computed(function () {
    if (!calculated.value) {
        return {
            title: "Calcula tu producto",
            text: "Selecciona un producto, agrega sus costos y descubre una estimación de su rentabilidad.",
            classes: "border-[#90E0EF] bg-[#EAF9FC] text-[#0077B6]"
        };
    }
    if (profitPerUnit.value <= 0) {
        return {
            title: "El producto genera pérdidas por unidad",
            text: "El precio actual no cubre correctamente los costos asociados a cada unidad. Revisa el costo de fabricación, los costos variables o el precio de venta.",
            classes: "border-red-200 bg-red-50 text-red-700"
        };
    }
    if (estimatedProfit.value < 0) {
        return {
            title: "Aún no cubres todos tus costos",
            text: `Cada unidad deja un margen positivo antes de costos fijos, pero con ${calculatedUnits.value} unidades todavía tendrías una pérdida aproximada de ${formatPrice(Math.abs(estimatedProfit.value))}. Necesitas vender aproximadamente ${breakEvenUnits.value} unidades para cubrir los costos fijos ingresados.`,
            classes: "border-red-200 bg-red-50 text-red-700"
        };
    }
    if (breakEvenUnits.value > 0 && currentStock.value < breakEvenUnits.value) {
        return {
            title: "Tu stock no alcanza el punto de equilibrio",
            text: `Actualmente tienes ${currentStock.value} unidades disponibles, pero necesitas vender aproximadamente ${breakEvenUnits.value} para cubrir los costos fijos. Revisa tu inventario, tus gastos o el precio del producto.`,
            classes: "border-orange-200 bg-orange-50 text-orange-700"
        };
    }
    if (profitMargin.value < 20) {
        return {
            title: "Rentabilidad reducida",
            text: `Después de considerar todos los costos, el margen neto estimado es de ${profitMargin.value.toFixed(1)}%. Revisa tus gastos para encontrar oportunidades de mejorar la rentabilidad.`,
            classes: "border-orange-200 bg-orange-50 text-orange-700"
        };
    }
    if (profitMargin.value < 40) {
        return {
            title: "Buena rentabilidad",
            text: `El producto presenta un margen neto estimado de ${profitMargin.value.toFixed(1)}%. Los ingresos cubren los costos considerados y todavía generan una ganancia positiva.`,
            classes: "border-yellow-200 bg-yellow-50 text-yellow-700"
        };
    }
    return {
        title: "Rentabilidad saludable",
        text: `Según esta estimación, el producto genera una ganancia positiva y un margen neto aproximado de ${profitMargin.value.toFixed(1)}%. Continúa controlando los costos y el movimiento del inventario para mantener estos resultados.`,
        classes: "border-green-200 bg-green-50 text-green-700"
    };
});

function formatPrice(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(Number(value) || 0);
}

function barWidth(value) {
    return Math.min(Math.max(Number(value) || 0, 0), 100);
}

// Cambia el producto y utiliza su stock completo como estimación inicial.
function selectProduct(product) {
    selectedProductId.value = product.id;
    unitsToCalculate.value = Number(product.stock) || 0;
    calculated.value = false;
}

function validateUnits() {
    if (unitsToCalculate.value < 0) unitsToCalculate.value = 0;
    if (unitsToCalculate.value > currentStock.value) unitsToCalculate.value = currentStock.value;
}

function calculateResults() {
    validateUnits();
    calculated.value = true;
    if (window.innerWidth < 1024) {
        setTimeout(function () {
            document.getElementById("calculatorResults")?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }, 50);
    }
}

function resetCalculator() {
    costPerUnit.value = 0;
    variableCostPerUnit.value = 0;
    advertisingCost.value = 0;
    otherFixedCosts.value = 0;
    taxRate.value = 13;
    unitsToCalculate.value = currentStock.value;
    calculated.value = false;
}

// Desde la calculadora regresamos al dashboard y abrimos directamente la sección elegida.
function goDashboardSection(section) {
    if (section === "calculadora") return;
    sessionStorage.setItem("thriveDashboardSection", section);
    router.back();
}

async function loadCalculator() {
    loading.value = true;
    loadError.value = "";
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            loadError.value = "No se encontró una sesión activa. Inicia sesión nuevamente.";
            return;
        }

        const { data: entrepreneurData, error: entrepreneurError } = await supabase
            .from("entrepreneurs")
            .select("id, business_name, logo_url")
            .eq("id", user.id)
            .single();

        if (entrepreneurError || !entrepreneurData) {
            throw entrepreneurError || new Error("No se encontró el emprendimiento.");
        }

        entrepreneur.value = {
            id: entrepreneurData.id,
            businessName: entrepreneurData.business_name,
            avatar: entrepreneurData.logo_url
        };

        const { data: productRows, error: productError } = await supabase
            .from("products")
            .select("id, name, description, categories, price, stock, active, created_at")
            .eq("entrepreneur_id", user.id)
            .order("created_at", { ascending: false });

        if (productError) throw productError;
        if (!productRows?.length) {
            products.value = [];
            return;
        }

        const productIds = productRows.map(function (product) {
            return product.id;
        });

        const { data: imageRows, error: imageError } = await supabase
            .from("product_images")
            .select("product_id, image_url, sort_order")
            .in("product_id", productIds)
            .order("sort_order", { ascending: true });

        if (imageError) throw imageError;

        products.value = productRows.map(function (product) {
            const firstImage = (imageRows || []).find(function (image) {
                return image.product_id === product.id;
            });
            return {
                id: product.id,
                name: product.name,
                description: product.description || "",
                categories: product.categories || [],
                price: Number(product.price) || 0,
                stock: Number(product.stock) || 0,
                active: product.active,
                image: firstImage?.image_url || ""
            };
        });

        if (products.value.length) selectProduct(products.value[0]);
    } catch (error) {
        console.error("Error al cargar la calculadora:", error);
        loadError.value = "No fue posible cargar la información de la calculadora.";
    } finally {
        loading.value = false;
    }
}

onMounted(function () {
    loadCalculator();
});
</script>

<template>
<div class="min-h-screen bg-[#F8FBFC] pb-[76px] text-gray-700 lg:pb-10">
    <!-- Cabecera. En móvil conserva la vista de la aplicación y en laptop funciona como navbar principal. -->
    <header class="sticky top-0 z-40 bg-[#F8FBFC]">
        <div class="mx-auto max-w-[1450px] px-2 pt-2 sm:px-5 lg:px-8 lg:pt-4">
            <!-- Cabecera móvil -->
            <div class="flex items-center gap-1 rounded-[24px] bg-[#00B4D8] p-1.5 shadow-sm sm:gap-2 sm:p-2 lg:hidden">
                <div class="flex min-w-0 flex-1 items-center px-3">
                    <span class="truncate text-sm font-bold text-white sm:text-base">
                        {{ entrepreneur?.businessName || "Thrive" }}
                    </span>
                </div>
                <button type="button" aria-label="Mensajes" class="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/20">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                        <path stroke-linejoin="round" d="M4 5h16v12H8l-4 3V5z"></path>
                        <path stroke-linecap="round" d="M8 9h8M8 13h5"></path>
                    </svg>
                </button>
                <button type="button" aria-label="Notificaciones" class="flex h-9 w-9 items-center justify-center rounded-full text-white transition hover:bg-white/20">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                        <path stroke-linecap="round" d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"></path>
                    </svg>
                </button>
            </div>

            <!-- Navbar principal para laptop -->
            <nav class="hidden items-center justify-center gap-2 rounded-[24px] bg-[#00B4D8] p-2 shadow-sm lg:flex">
                <button type="button" class="rounded-full px-6 py-2.5 text-sm font-bold text-white/85 transition hover:bg-white/15 hover:text-white" @click="goDashboardSection('inicio')">
                    Inicio
                </button>
                <button type="button" class="rounded-full px-6 py-2.5 text-sm font-bold text-white/85 transition hover:bg-white/15 hover:text-white" @click="goDashboardSection('inventario')">
                    Inventario
                </button>
                <button type="button" class="rounded-full px-6 py-2.5 text-sm font-bold text-white/85 transition hover:bg-white/15 hover:text-white" @click="goDashboardSection('novedades')">
                    Novedades
                </button>
                <button type="button" class="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-[#0077B6] shadow-sm">
                    Calculadora
                </button>
            </nav>
        </div>
    </header>

    <!-- Estado de carga -->
    <main v-if="loading" class="mx-auto max-w-[1450px] px-5 py-24 text-center">
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        <p class="mt-4 text-sm font-semibold text-gray-400">Cargando tus productos...</p>
    </main>

    <!-- Error al cargar -->
    <main v-else-if="loadError" class="mx-auto max-w-[1450px] px-5 py-24 text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 font-black text-red-600">!</div>
        <p class="mt-4 font-black text-gray-700">No pudimos cargar la calculadora</p>
        <p class="mt-2 text-sm text-gray-400">{{ loadError }}</p>
        <button type="button" class="mt-5 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white" @click="loadCalculator">
            Intentar nuevamente
        </button>
    </main>

    <!-- Contenido principal -->
    <main v-else class="mx-auto max-w-[1450px] px-3 pb-10 pt-4 sm:px-5 lg:px-8 lg:pt-6">
        <section class="mb-6">
            <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">Herramientas para tu negocio</p>
            <h1 class="mt-1 text-2xl font-black text-gray-700 sm:text-3xl">Calculadora de ganancias</h1>
            <p class="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
                Selecciona uno de tus productos y calcula una estimación utilizando su precio y stock actuales.
            </p>
        </section>

        <!-- Se muestra cuando todavía no hay productos registrados -->
        <section v-if="!products.length" class="rounded-[24px] bg-white px-5 py-16 text-center shadow-sm">
            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF9FC] text-[#00B4D8]">
                <svg class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <path stroke-linecap="round" d="M4 7h16M5 7l1 13h12l1-13M9 11v5M15 11v5M9 4h6l1 3H8l1-3z"></path>
                </svg>
            </div>
            <h2 class="mt-4 text-lg font-black text-gray-700">Todavía no tienes productos</h2>
            <p class="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-400">
                Crea tu primer producto desde el dashboard para comenzar a calcular sus posibles ganancias.
            </p>
        </section>

        <template v-else>
            <!-- Selector de productos -->
            <section class="mb-6 rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">Mis productos</p>
                <h2 class="mt-1 text-lg font-black text-gray-700">Selecciona el producto que quieres analizar</h2>
                <div class="mt-4 flex gap-3 overflow-x-auto pb-2">
                    <button
                        v-for="product in products"
                        :key="product.id"
                        type="button"
                        class="flex w-[230px] shrink-0 items-center gap-3 rounded-2xl border p-3 text-left transition"
                        :class="selectedProductId === product.id ? 'border-[#00B4D8] bg-[#EAF9FC]' : 'border-gray-100 bg-white'"
                        @click="selectProduct(product)"
                    >
                        <img v-if="product.image" :src="product.image" :alt="product.name" class="h-14 w-14 shrink-0 rounded-xl object-cover">
                        <div v-else class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-bold text-gray-400">Sin foto</div>
                        <div class="min-w-0">
                            <p class="truncate text-sm font-bold text-gray-600">{{ product.name }}</p>
                            <p class="mt-1 text-sm font-black text-black">{{ formatPrice(product.price) }}</p>
                            <p class="text-xs text-gray-400">{{ product.stock }} en stock</p>
                        </div>
                    </button>
                </div>
            </section>

            <!-- Resumen rápido del producto seleccionado -->
            <section v-if="selectedProduct" class="mb-6 grid gap-4 sm:grid-cols-3">
                <div class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">Precio de venta</p>
                    <p class="mt-2 text-2xl font-black text-black">{{ formatPrice(salePrice) }}</p>
                    <p class="mt-1 text-xs text-gray-400">Precio actual del producto</p>
                </div>
                <div class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">Stock disponible</p>
                    <p class="mt-2 text-2xl font-black text-gray-700">{{ currentStock }}</p>
                    <p class="mt-1 text-xs text-gray-400">unidades disponibles</p>
                </div>
                <div class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold uppercase tracking-[0.1em] text-gray-400">Valor del inventario</p>
                    <p class="mt-2 text-2xl font-black text-[#0077B6]">{{ formatPrice(inventoryValue) }}</p>
                    <p class="mt-1 text-xs text-gray-400">Si vendieras todo al precio actual</p>
                </div>
            </section>

            <div class="grid gap-6 lg:grid-cols-[380px_1fr]">
                <!-- Formulario de costos -->
                <section class="h-fit rounded-[24px] bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-[88px]">
                    <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">Costos</p>
                    <h2 class="mt-1 text-xl font-black text-gray-700">Datos del cálculo</h2>
                    <p class="mt-1 text-sm text-gray-400">Completa únicamente los costos relacionados con este producto.</p>

                    <div class="mt-6 space-y-5">
                        <label class="block">
                            <span class="text-sm font-bold text-gray-600">Costo de fabricación por unidad</span>
                            <div class="relative mt-2">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input v-model.number="costPerUnit" type="number" min="0" step="0.01" class="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-sm text-gray-700 outline-none focus:border-[#00B4D8]" placeholder="0.00">
                            </div>
                        </label>

                        <label class="block">
                            <span class="text-sm font-bold text-gray-600">Otros costos por unidad</span>
                            <div class="relative mt-2">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input v-model.number="variableCostPerUnit" type="number" min="0" step="0.01" class="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-sm text-gray-700 outline-none focus:border-[#00B4D8]" placeholder="Empaque, materiales...">
                            </div>
                        </label>

                        <label class="block">
                            <div class="flex items-center justify-between gap-3">
                                <span class="text-sm font-bold text-gray-600">Unidades a calcular</span>
                                <span class="text-xs text-gray-400">Máx. {{ currentStock }}</span>
                            </div>
                            <input v-model.number="unitsToCalculate" type="number" min="0" :max="currentStock" class="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 outline-none focus:border-[#00B4D8]" @input="validateUnits">
                            <p class="mt-2 text-xs leading-relaxed text-gray-400">Por defecto utilizamos todo tu stock actual para mostrar el potencial del producto.</p>
                        </label>

                        <label class="block">
                            <span class="text-sm font-bold text-gray-600">Publicidad</span>
                            <div class="relative mt-2">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input v-model.number="advertisingCost" type="number" min="0" step="0.01" class="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-sm text-gray-700 outline-none focus:border-[#00B4D8]" placeholder="0.00">
                            </div>
                        </label>

                        <label class="block">
                            <span class="text-sm font-bold text-gray-600">Otros gastos</span>
                            <div class="relative mt-2">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                                <input v-model.number="otherFixedCosts" type="number" min="0" step="0.01" class="w-full rounded-xl border border-gray-200 bg-white py-3 pl-9 pr-4 text-sm text-gray-700 outline-none focus:border-[#00B4D8]" placeholder="0.00">
                            </div>
                        </label>

                        <label class="block">
                            <span class="text-sm font-bold text-gray-600">Impuestos o comisiones (%)</span>
                            <input v-model.number="taxRate" type="number" min="0" max="100" step="0.1" class="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 outline-none focus:border-[#00B4D8]">
                        </label>
                    </div>

                    <div class="mt-6 grid gap-2">
                        <button type="button" class="rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0077B6]" @click="calculateResults">
                            Calcular resultados
                        </button>
                        <button type="button" class="rounded-xl border border-gray-200 px-5 py-3 text-sm font-bold text-gray-400" @click="resetCalculator">
                            Limpiar datos
                        </button>
                    </div>
                </section>

                <!-- Resultados financieros -->
                <section id="calculatorResults" class="space-y-5 scroll-mt-24">
                    <div class="rounded-[24px] bg-[#0077B6] p-6 text-white shadow-sm sm:p-8">
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#CAF0F8]">Ganancia estimada</p>
                        <h2 class="mt-3 text-4xl font-black sm:text-5xl">{{ calculated ? formatPrice(estimatedProfit) : "$0.00" }}</h2>
                        <p class="mt-3 max-w-xl text-sm leading-relaxed text-white/75">
                            Estimación basada en {{ calculatedUnits }} unidades de {{ selectedProduct.name }}.
                        </p>
                    </div>

                    <div class="grid grid-cols-2 gap-3 xl:grid-cols-4">
                        <div class="rounded-[22px] bg-white p-5 shadow-sm">
                            <p class="text-xs font-bold text-gray-400">Ganancia por unidad</p>
                            <p class="mt-2 text-xl font-black text-black">{{ calculated ? formatPrice(profitPerUnit) : "$0.00" }}</p>
                        </div>
                        <div class="rounded-[22px] bg-white p-5 shadow-sm">
                            <p class="text-xs font-bold text-gray-400">Margen neto estimado</p>
                            <p class="mt-2 text-xl font-black" :class="profitMargin >= 0 ? 'text-[#0077B6]' : 'text-red-600'">
                                {{ calculated ? profitMargin.toFixed(1) : "0.0" }}%
                            </p>
                        </div>
                        <div class="rounded-[22px] bg-white p-5 shadow-sm">
                            <p class="text-xs font-bold text-gray-400">Ingresos posibles</p>
                            <p class="mt-2 text-xl font-black text-gray-700">{{ calculated ? formatPrice(income) : "$0.00" }}</p>
                        </div>
                        <div class="rounded-[22px] bg-white p-5 shadow-sm">
                            <p class="text-xs font-bold text-gray-400">Costos totales</p>
                            <p class="mt-2 text-xl font-black text-gray-700">{{ calculated ? formatPrice(totalCosts) : "$0.00" }}</p>
                        </div>
                    </div>

                    <!-- Desglose completo -->
                    <div class="rounded-[24px] bg-white p-5 shadow-sm sm:p-7">
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">Resumen</p>
                        <h2 class="mt-1 text-xl font-black text-gray-700">Desglose financiero</h2>
                        <div class="mt-6 divide-y divide-gray-100">
                            <div class="flex items-center justify-between gap-4 py-3"><span class="text-sm text-gray-400">Ingresos estimados</span><span class="font-black text-gray-700">{{ calculated ? formatPrice(income) : "$0.00" }}</span></div>
                            <div class="flex items-center justify-between gap-4 py-3"><span class="text-sm text-gray-400">Costos variables</span><span class="font-black text-gray-700">{{ calculated ? formatPrice(totalVariableCosts) : "$0.00" }}</span></div>
                            <div class="flex items-center justify-between gap-4 py-3"><span class="text-sm text-gray-400">Costos fijos</span><span class="font-black text-gray-700">{{ calculated ? formatPrice(totalFixedCosts) : "$0.00" }}</span></div>
                            <div class="flex items-center justify-between gap-4 py-3"><span class="text-sm text-gray-400">Impuestos o comisiones</span><span class="font-black text-gray-700">{{ calculated ? formatPrice(totalTax) : "$0.00" }}</span></div>
                            <div class="flex items-center justify-between gap-4 py-4">
                                <span class="font-bold text-gray-600">Ganancia estimada</span>
                                <span class="text-xl font-black" :class="estimatedProfit >= 0 ? 'text-[#0077B6]' : 'text-red-600'">{{ calculated ? formatPrice(estimatedProfit) : "$0.00" }}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Indicadores visuales -->
                    <div class="rounded-[24px] bg-white p-5 shadow-sm sm:p-7">
                        <h2 class="text-xl font-black text-gray-700">Indicadores</h2>
                        <div class="mt-6 space-y-6">
                            <div>
                                <div class="mb-2 flex items-center justify-between text-sm">
                                    <span class="font-bold text-gray-500">Rentabilidad sobre costos</span>
                                    <span class="font-black" :class="profitability >= 0 ? 'text-gray-700' : 'text-red-600'">{{ calculated ? profitability.toFixed(1) : "0.0" }}%</span>
                                </div>
                                <div class="h-3 overflow-hidden rounded-full bg-gray-100">
                                    <div class="h-full rounded-full bg-[#00B4D8]" :style="{ width: calculated ? barWidth(profitability) + '%' : '0%' }"></div>
                                </div>
                            </div>
                            <div>
                                <div class="mb-2 flex items-center justify-between text-sm">
                                    <span class="font-bold text-gray-500">Costos sobre ingresos</span>
                                    <span class="font-black text-gray-700">{{ calculated ? costPercentage.toFixed(1) : "0.0" }}%</span>
                                </div>
                                <div class="h-3 overflow-hidden rounded-full bg-gray-100">
                                    <div class="h-full rounded-full bg-[#90E0EF]" :style="{ width: calculated ? barWidth(costPercentage) + '%' : '0%' }"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Punto de equilibrio y potencial del inventario -->
                    <div class="grid gap-5 md:grid-cols-2">
                        <div class="rounded-[24px] bg-white p-5 shadow-sm sm:p-7">
                            <p class="text-xs font-bold uppercase tracking-[0.1em] text-[#00B4D8]">Punto de equilibrio</p>
                            <p class="mt-3 text-4xl font-black text-gray-700">{{ calculated ? breakEvenUnits : 0 }}</p>
                            <p class="mt-1 text-sm text-gray-400">unidades necesarias para cubrir los costos fijos</p>
                            <div class="mt-5 h-3 overflow-hidden rounded-full bg-gray-100">
                                <div class="h-full rounded-full bg-[#00B4D8]" :style="{ width: calculated ? breakEvenProgress + '%' : '0%' }"></div>
                            </div>
                            <p class="mt-2 text-xs text-gray-400">Progreso: {{ calculated ? breakEvenProgress.toFixed(0) : 0 }}%</p>
                        </div>
                        <div class="rounded-[24px] bg-[#EAF9FC] p-5 sm:p-7">
                            <p class="text-xs font-bold uppercase tracking-[0.1em] text-[#0077B6]">Potencial del inventario</p>
                            <p class="mt-3 text-4xl font-black" :class="fullStockProfit >= 0 ? 'text-[#0077B6]' : 'text-red-600'">{{ calculated ? formatPrice(fullStockProfit) : "$0.00" }}</p>
                            <p class="mt-2 text-sm leading-relaxed text-gray-500">
                                Ganancia aproximada si vendieras las {{ currentStock }} unidades disponibles utilizando estos mismos costos.
                            </p>
                        </div>
                    </div>

                    <!-- Recomendación final -->
                    <div class="rounded-[24px] bg-white p-5 shadow-sm sm:p-7">
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">Recomendaciones Thrive</p>
                        <div class="mt-4 rounded-2xl border p-5" :class="recommendation.classes">
                            <h3 class="font-black">{{ recommendation.title }}</h3>
                            <p class="mt-2 text-sm leading-relaxed opacity-80">{{ recommendation.text }}</p>
                        </div>
                    </div>
                </section>
            </div>
        </template>
    </main>

    <!-- Menú móvil: se mantiene igual que en el dashboard. -->
    <nav class="fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] border-t border-white/20 bg-[#00B4D8] shadow-[0_-6px_20px_rgba(0,0,0,0.12)] lg:hidden">
        <div class="mx-auto grid max-w-lg grid-cols-4">
            <button type="button" class="flex flex-col items-center gap-1 py-2 text-white/75" @click="goDashboardSection('inicio')">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"></path><path d="M5 10v10h14V10"></path></svg>
                <span class="text-[9px] font-bold">Inicio</span>
            </button>
            <button type="button" class="flex flex-col items-center gap-1 py-2 text-white/75" @click="goDashboardSection('inventario')">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 7l8-4 8 4-8 4-8-4z"></path><path d="M4 7v10l8 4 8-4V7"></path></svg>
                <span class="text-[9px] font-bold">Inventario</span>
            </button>
            <button type="button" class="flex flex-col items-center gap-1 py-2 text-white/75" @click="goDashboardSection('novedades')">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path></svg>
                <span class="text-[9px] font-bold">Novedades</span>
            </button>
            <button type="button" class="flex flex-col items-center gap-1 bg-white/15 py-2 text-white">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"></path></svg>
                <span class="text-[9px] font-bold">Calculadora</span>
            </button>
        </div>
    </nav>
</div>
</template>
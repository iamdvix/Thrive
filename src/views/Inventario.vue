<script setup>
// Inventario del emprendedor: controla stock y pedidos desde la misma pantalla.
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";

const router = useRouter();
const entrepreneur = ref(null);
const products = ref([]);
const orders = ref([]);
const loading = ref(true);
const loadError = ref("");
const activeTab = ref("stock");
const productSearch = ref("");
const stockFilter = ref("all");
const orderSearch = ref("");
const orderFilter = ref("all");
const savingStockIds = ref([]);
const savingOrderIds = ref([]);
const showStockModal = ref(false);
const stockProduct = ref(null);
const stockValue = ref(0);

const orderStatuses = [
    { value: "pendiente", label: "Pendiente" },
    { value: "en_preparacion", label: "En preparación" },
    { value: "listo", label: "Listo" },
    { value: "entregado", label: "Entregado" },
    { value: "cancelado", label: "Cancelado" }
];

// Resumen automático del inventario.
const totalProducts = computed(() => products.value.length);
const totalUnits = computed(() => products.value.reduce((total, p) => total + (Number(p.stock) || 0), 0));
const lowStockCount = computed(() => products.value.filter(p => p.stock > 0 && p.stock <= 5).length);
const outOfStockCount = computed(() => products.value.filter(p => p.stock === 0).length);
const inventoryValue = computed(() => products.value.reduce((total, p) => total + p.price * p.stock, 0));
const attentionProducts = computed(() => products.value.filter(p => p.stock <= 5).sort((a, b) => a.stock - b.stock));

const filteredProducts = computed(function () {
    const text = productSearch.value.toLowerCase().trim();
    return products.value.filter(function (product) {
        const matchesText = product.name.toLowerCase().includes(text) || product.categories.join(" ").toLowerCase().includes(text);
        let matchesFilter = true;
        if (stockFilter.value === "available") matchesFilter = product.stock > 5;
        if (stockFilter.value === "low") matchesFilter = product.stock > 0 && product.stock <= 5;
        if (stockFilter.value === "out") matchesFilter = product.stock === 0;
        return matchesText && matchesFilter;
    });
});

// Resumen y filtros de pedidos.
const pendingOrders = computed(() => orders.value.filter(o => o.status === "pendiente").length);
const preparationOrders = computed(() => orders.value.filter(o => o.status === "en_preparacion").length);
const readyOrders = computed(() => orders.value.filter(o => o.status === "listo").length);
const deliveredOrders = computed(() => orders.value.filter(o => o.status === "entregado").length);

const filteredOrders = computed(function () {
    const text = orderSearch.value.toLowerCase().trim();
    return orders.value.filter(function (order) {
        const itemNames = order.items.map(item => item.productName).join(" ");
        const matchesText = order.id.toLowerCase().includes(text) || order.customerName.toLowerCase().includes(text) || itemNames.toLowerCase().includes(text);
        return matchesText && (orderFilter.value === "all" || order.status === orderFilter.value);
    });
});

function formatPrice(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) return "Sin fecha";
    return new Intl.DateTimeFormat("es-SV", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function shortOrderId(id) {
    return String(id || "").slice(0, 8).toUpperCase();
}

function stockLabel(stock) {
    if (stock === 0) return "Agotado";
    if (stock <= 5) return "Stock bajo";
    return "Disponible";
}

function stockClasses(stock) {
    if (stock === 0) return "bg-red-100 text-red-700";
    if (stock <= 5) return "bg-yellow-100 text-yellow-700";
    return "bg-green-100 text-green-700";
}

function orderStatusLabel(status) {
    return orderStatuses.find(item => item.value === status)?.label || "Pendiente";
}

function orderStatusClasses(status) {
    return {
        pendiente: "bg-yellow-100 text-yellow-700",
        en_preparacion: "bg-blue-100 text-blue-700",
        listo: "bg-[#CAF0F8] text-[#0077B6]",
        entregado: "bg-green-100 text-green-700",
        cancelado: "bg-red-100 text-red-700"
    }[status] || "bg-gray-100 text-gray-600";
}

// Mantiene la misma navegación utilizada por Dashboard y Calculadora.
function goSection(section) {
    if (section === "inventario") return;
    if (section === "calculadora") {
        if (router.hasRoute("Calculadora")) return router.push({ name: "Calculadora" });
        return router.push("/calculadora");
    }
    sessionStorage.setItem("thriveDashboardSection", section);
    if (router.hasRoute("DashboardEmprendedor")) return router.push({ name: "DashboardEmprendedor" });
    router.back();
}

// Carga los productos del emprendedor y usa su primera foto como portada.
async function loadProducts(userId) {
    const { data: rows, error } = await supabase
        .from("products")
        .select("id, entrepreneur_id, name, categories, price, stock, active, created_at")
        .eq("entrepreneur_id", userId)
        .order("created_at", { ascending: false });
    if (error) throw error;
    if (!rows?.length) {
        products.value = [];
        return;
    }

    const ids = rows.map(product => product.id);
    const { data: images, error: imageError } = await supabase
        .from("product_images")
        .select("product_id, image_url, sort_order")
        .in("product_id", ids)
        .order("sort_order", { ascending: true });
    if (imageError) throw imageError;

    products.value = rows.map(function (product) {
        const image = (images || []).find(item => item.product_id === product.id);
        return {
            id: product.id,
            name: product.name,
            categories: product.categories || [],
            price: Number(product.price) || 0,
            stock: Number(product.stock) || 0,
            active: product.active,
            image: image?.image_url || ""
        };
    });
}

// Carga los pedidos y los productos incluidos en cada uno.
async function loadOrders(userId) {
    const { data, error } = await supabase
        .from("orders")
        .select(`
            id, customer_id, customer_name, customer_phone, status, total, notes, created_at, updated_at,
            order_items (id, product_id, product_name, quantity, unit_price)
        `)
        .eq("entrepreneur_id", userId)
        .order("created_at", { ascending: false });
    if (error) throw error;

    orders.value = (data || []).map(function (order) {
        return {
            id: order.id,
            customerId: order.customer_id,
            customerName: order.customer_name || "Cliente",
            customerPhone: order.customer_phone || "",
            status: order.status || "pendiente",
            total: Number(order.total) || 0,
            notes: order.notes || "",
            createdAt: order.created_at,
            updatedAt: order.updated_at,
            items: (order.order_items || []).map(item => ({
                id: item.id,
                productId: item.product_id,
                productName: item.product_name || "Producto",
                quantity: Number(item.quantity) || 0,
                unitPrice: Number(item.unit_price) || 0
            }))
        };
    });
}

// Carga toda la pantalla en paralelo para reducir el tiempo de espera.
async function loadInventory() {
    loading.value = true;
    loadError.value = "";
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            loadError.value = "No se encontró una sesión activa. Inicia sesión nuevamente.";
            return;
        }

        const { data: business, error: businessError } = await supabase
            .from("entrepreneurs")
            .select("id, business_name, logo_url")
            .eq("id", user.id)
            .single();
        if (businessError || !business) throw businessError || new Error("No se encontró el emprendimiento.");

        entrepreneur.value = {
            id: business.id,
            businessName: business.business_name,
            avatar: business.logo_url || ""
        };

        await Promise.all([loadProducts(user.id), loadOrders(user.id)]);
    } catch (error) {
        console.error("Error al cargar el inventario:", error);
        loadError.value = "No fue posible cargar el inventario y los pedidos.";
    } finally {
        loading.value = false;
    }
}

// Guarda el nuevo stock y actualiza la tarjeta sin recargar la página.
async function updateStock(product, amount) {
    if (!product || savingStockIds.value.includes(product.id)) return;
    const newStock = Math.max(Math.floor(Number(amount) || 0), 0);
    savingStockIds.value.push(product.id);

    try {
        const { data, error } = await supabase
            .from("products")
            .update({ stock: newStock })
            .eq("id", product.id)
            .eq("entrepreneur_id", entrepreneur.value.id)
            .select("id, stock")
            .single();
        if (error) throw error;
        product.stock = Number(data.stock) || 0;
        if (stockProduct.value?.id === product.id) stockValue.value = product.stock;
    } catch (error) {
        console.error("Error al actualizar stock:", error);
        alert("No fue posible actualizar el stock.");
    } finally {
        savingStockIds.value = savingStockIds.value.filter(id => id !== product.id);
    }
}

function openStockModal(product) {
    stockProduct.value = product;
    stockValue.value = product.stock;
    showStockModal.value = true;
    document.body.style.overflow = "hidden";
}

function closeStockModal() {
    showStockModal.value = false;
    stockProduct.value = null;
    document.body.style.overflow = "";
}

async function saveExactStock() {
    if (!stockProduct.value) return;
    const product = stockProduct.value;
    await updateStock(product, stockValue.value);
    if (!savingStockIds.value.includes(product.id)) closeStockModal();
}

// El estado del pedido se guarda por separado del stock para evitar descuentos duplicados al corregir un estado.
async function updateOrderStatus(order, newStatus) {
    if (!order || order.status === newStatus || savingOrderIds.value.includes(order.id)) return;
    if (!orderStatuses.some(item => item.value === newStatus)) return;
    savingOrderIds.value.push(order.id);

    try {
        const { data, error } = await supabase
            .from("orders")
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq("id", order.id)
            .eq("entrepreneur_id", entrepreneur.value.id)
            .select("id, status, updated_at")
            .single();
        if (error) throw error;
        order.status = data.status;
        order.updatedAt = data.updated_at;
    } catch (error) {
        console.error("Error al actualizar pedido:", error);
        alert("No fue posible cambiar el estado del pedido.");
    } finally {
        savingOrderIds.value = savingOrderIds.value.filter(id => id !== order.id);
    }
}

// Prepara un mensaje rápido para comunicarse con el cliente.
function contactCustomer(order) {
    const rawPhone = String(order.customerPhone || "").replace(/\D/g, "");
    if (!rawPhone) return alert("Este pedido no tiene un número de WhatsApp registrado.");
    const phone = rawPhone.length === 8 ? `503${rawPhone}` : rawPhone;
    const message = encodeURIComponent(`Hola ${order.customerName}, te escribimos de ${entrepreneur.value?.businessName || "Thrive"} sobre tu pedido #${shortOrderId(order.id)}.`);
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank", "noopener,noreferrer");
}

function handleEscape(event) {
    if (event.key === "Escape" && showStockModal.value) closeStockModal();
}

onMounted(function () {
    loadInventory();
    document.addEventListener("keydown", handleEscape);
});

onBeforeUnmount(function () {
    document.removeEventListener("keydown", handleEscape);
    document.body.style.overflow = "";
});
</script>

<template>
<div class="min-h-screen bg-[#F8FBFC] pb-[76px] text-gray-700 lg:pb-10">
    <!-- Cabecera móvil y navbar principal de laptop. -->
    <header class="sticky top-0 z-40 bg-[#F8FBFC]">
        <div class="mx-auto max-w-[1450px] px-2 pt-2 sm:px-5 lg:px-8 lg:pt-4">
            <div class="flex items-center gap-1 rounded-[24px] bg-[#00B4D8] p-1.5 shadow-sm sm:gap-2 sm:p-2 lg:hidden">
                <div class="flex min-w-0 flex-1 items-center px-3">
                    <span class="truncate text-sm font-bold text-white sm:text-base">{{ entrepreneur?.businessName || "Thrive" }}</span>
                </div>
                <button type="button" aria-label="Mensajes" class="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/20">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linejoin="round" d="M4 5h16v12H8l-4 3V5z"></path><path stroke-linecap="round" d="M8 9h8M8 13h5"></path></svg>
                </button>
                <button type="button" aria-label="Notificaciones" class="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/20">
                    <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"></path></svg>
                </button>
            </div>

            <nav class="hidden items-center justify-center gap-2 rounded-[24px] bg-[#00B4D8] p-2 shadow-sm lg:flex">
                <button type="button" class="rounded-full px-6 py-2.5 text-sm font-bold text-white/85 hover:bg-white/15 hover:text-white" @click="goSection('inicio')">Inicio</button>
                <button type="button" class="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-[#0077B6] shadow-sm">Inventario</button>
                <button type="button" class="rounded-full px-6 py-2.5 text-sm font-bold text-white/85 hover:bg-white/15 hover:text-white" @click="goSection('novedades')">Novedades</button>
                <button type="button" class="rounded-full px-6 py-2.5 text-sm font-bold text-white/85 hover:bg-white/15 hover:text-white" @click="goSection('calculadora')">Calculadora</button>
            </nav>
        </div>
    </header>

    <!-- Carga y errores -->
    <main v-if="loading" class="mx-auto max-w-[1450px] px-5 py-24 text-center">
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        <p class="mt-4 text-sm font-semibold text-gray-400">Cargando inventario...</p>
    </main>
    <main v-else-if="loadError" class="mx-auto max-w-[1450px] px-5 py-24 text-center">
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 font-black text-red-600">!</div>
        <p class="mt-4 font-black text-gray-700">No pudimos cargar el inventario</p>
        <p class="mt-2 text-sm text-gray-400">{{ loadError }}</p>
        <button type="button" class="mt-5 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white" @click="loadInventory">Intentar nuevamente</button>
    </main>

    <main v-else class="mx-auto max-w-[1450px] px-3 pb-10 pt-4 sm:px-5 lg:px-8 lg:pt-6">
        <!-- Título y cambio entre stock y pedidos. -->
        <section class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">Gestión del emprendimiento</p>
                <h1 class="mt-1 text-2xl font-black text-gray-700 sm:text-3xl">Inventario</h1>
                <p class="mt-2 max-w-2xl text-sm text-gray-400">Controla la disponibilidad de tus productos y organiza los pedidos que recibes.</p>
            </div>
            <div class="grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm">
                <button type="button" class="rounded-xl px-5 py-2.5 text-sm font-bold" :class="activeTab === 'stock' ? 'bg-[#00B4D8] text-white' : 'text-gray-400'" @click="activeTab = 'stock'">Stock</button>
                <button type="button" class="rounded-xl px-5 py-2.5 text-sm font-bold" :class="activeTab === 'orders' ? 'bg-[#00B4D8] text-white' : 'text-gray-400'" @click="activeTab = 'orders'">
                    Pedidos <span v-if="pendingOrders" class="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{{ pendingOrders }}</span>
                </button>
            </div>
        </section>

        <!-- STOCK -->
        <template v-if="activeTab === 'stock'">
            <section class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <article v-for="card in [
                    ['Productos', totalProducts, 'registrados'],
                    ['Unidades', totalUnits, 'disponibles'],
                    ['Necesitan atención', lowStockCount + outOfStockCount, `${lowStockCount} bajos · ${outOfStockCount} agotados`]
                ]" :key="card[0]" class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold text-gray-400">{{ card[0] }}</p>
                    <p class="mt-2 text-2xl font-black text-gray-700">{{ card[1] }}</p>
                    <p class="mt-1 text-xs text-gray-400">{{ card[2] }}</p>
                </article>
                <article class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold text-gray-400">Valor potencial</p>
                    <p class="mt-2 text-2xl font-black text-black">{{ formatPrice(inventoryValue) }}</p>
                    <p class="mt-1 text-xs text-gray-400">precio × stock</p>
                </article>
            </section>

            <!-- Productos que requieren atención. -->
            <section v-if="attentionProducts.length" class="mb-6 rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">Necesitan atención</p>
                <h2 class="mt-1 text-lg font-black text-gray-700">Revisa estos productos</h2>
                <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <article v-for="product in attentionProducts" :key="product.id" class="flex items-center gap-3 rounded-2xl bg-[#F8FBFC] p-3">
                        <img v-if="product.image" :src="product.image" :alt="product.name" class="h-14 w-14 shrink-0 rounded-xl object-cover">
                        <div v-else class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-bold text-gray-400">Sin foto</div>
                        <div class="min-w-0 flex-1">
                            <p class="truncate text-sm font-bold text-gray-600">{{ product.name }}</p>
                            <p class="mt-0.5 text-xs" :class="product.stock === 0 ? 'text-red-500' : 'text-yellow-600'">{{ product.stock === 0 ? "Producto agotado" : `${product.stock} unidades restantes` }}</p>
                        </div>
                        <button type="button" class="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#0077B6] shadow-sm" @click="openStockModal(product)">Actualizar</button>
                    </article>
                </div>
            </section>

            <!-- Buscador y filtros. -->
            <section class="mb-5 rounded-[24px] bg-white p-4 shadow-sm sm:p-5">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex flex-1 items-center rounded-xl bg-[#F8FBFC] px-4 py-3 lg:max-w-md">
                        <svg class="mr-2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path stroke-linecap="round" d="m20 20-3.5-3.5"></path></svg>
                        <input v-model="productSearch" type="text" placeholder="Buscar producto" class="w-full bg-transparent text-sm text-gray-600 outline-none placeholder:text-gray-400">
                    </div>
                    <div class="flex gap-2 overflow-x-auto">
                        <button v-for="filter in [['all','Todos'],['available','Disponibles'],['low','Stock bajo'],['out','Agotados']]" :key="filter[0]" type="button" class="whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold" :class="stockFilter === filter[0] ? 'bg-[#00B4D8] text-white' : 'bg-[#F8FBFC] text-gray-400'" @click="stockFilter = filter[0]">{{ filter[1] }}</button>
                    </div>
                </div>
            </section>

            <!-- Tarjetas de inventario. -->
            <section v-if="filteredProducts.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <article v-for="product in filteredProducts" :key="product.id" class="rounded-[24px] bg-white p-4 shadow-sm">
                    <div class="flex gap-4">
                        <img v-if="product.image" :src="product.image" :alt="product.name" class="h-20 w-20 shrink-0 rounded-2xl object-cover">
                        <div v-else class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-xs font-bold text-gray-400">Sin foto</div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-start justify-between gap-2">
                                <div class="min-w-0">
                                    <h2 class="truncate text-sm font-black text-gray-600">{{ product.name }}</h2>
                                    <p class="mt-1 font-black text-black">{{ formatPrice(product.price) }}</p>
                                </div>
                                <span class="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold" :class="stockClasses(product.stock)">{{ stockLabel(product.stock) }}</span>
                            </div>
                            <p class="mt-2 truncate text-xs text-gray-400">{{ product.categories.join(" · ") || "Sin categoría" }}</p>
                        </div>
                    </div>

                    <div class="mt-4 rounded-2xl bg-[#F8FBFC] p-3">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-xs font-bold text-gray-400">Stock actual</p>
                                <p class="mt-0.5 text-sm font-black text-gray-600">{{ product.stock }} unidades</p>
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="button" :disabled="product.stock <= 0 || savingStockIds.includes(product.id)" class="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold text-gray-500 shadow-sm disabled:opacity-40" @click="updateStock(product, product.stock - 1)">−</button>
                                <span class="min-w-8 text-center font-black text-gray-700">{{ product.stock }}</span>
                                <button type="button" :disabled="savingStockIds.includes(product.id)" class="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold text-[#0077B6] shadow-sm disabled:opacity-40" @click="updateStock(product, product.stock + 1)">+</button>
                            </div>
                        </div>
                    </div>

                    <div class="mt-3 flex items-center justify-between">
                        <div>
                            <p class="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">Valor disponible</p>
                            <p class="text-sm font-black text-gray-700">{{ formatPrice(product.price * product.stock) }}</p>
                        </div>
                        <button type="button" class="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-500" @click="openStockModal(product)">Actualizar stock</button>
                    </div>
                </article>
            </section>

            <section v-else class="rounded-[24px] bg-white px-5 py-16 text-center shadow-sm">
                <p class="font-black text-gray-700">No encontramos productos</p>
                <p class="mt-2 text-sm text-gray-400">Prueba con otro filtro o término de búsqueda.</p>
            </section>
        </template>

        <!-- PEDIDOS -->
        <template v-else>
            <section class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <article v-for="card in [
                    ['Pendientes', pendingOrders, 'text-yellow-600'],
                    ['En preparación', preparationOrders, 'text-blue-600'],
                    ['Listos', readyOrders, 'text-[#0077B6]'],
                    ['Entregados', deliveredOrders, 'text-green-600']
                ]" :key="card[0]" class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold text-gray-400">{{ card[0] }}</p>
                    <p class="mt-2 text-2xl font-black" :class="card[2]">{{ card[1] }}</p>
                </article>
            </section>

            <section class="mb-5 rounded-[24px] bg-white p-4 shadow-sm sm:p-5">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex flex-1 items-center rounded-xl bg-[#F8FBFC] px-4 py-3 lg:max-w-md">
                        <svg class="mr-2 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><path stroke-linecap="round" d="m20 20-3.5-3.5"></path></svg>
                        <input v-model="orderSearch" type="text" placeholder="Buscar cliente, pedido o producto" class="w-full bg-transparent text-sm text-gray-600 outline-none placeholder:text-gray-400">
                    </div>
                    <select v-model="orderFilter" class="rounded-xl border border-gray-100 bg-[#F8FBFC] px-4 py-3 text-sm font-bold text-gray-500 outline-none">
                        <option value="all">Todos los estados</option>
                        <option v-for="status in orderStatuses" :key="status.value" :value="status.value">{{ status.label }}</option>
                    </select>
                </div>
            </section>

            <!-- Cada pedido permite revisar productos, cliente y cambiar su estado. -->
            <section v-if="filteredOrders.length" class="space-y-4">
                <article v-for="order in filteredOrders" :key="order.id" class="rounded-[24px] bg-white p-5 shadow-sm sm:p-6">
                    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div class="flex flex-wrap items-center gap-2">
                                <h2 class="font-black text-gray-700">Pedido #{{ shortOrderId(order.id) }}</h2>
                                <span class="rounded-full px-2.5 py-1 text-[10px] font-bold" :class="orderStatusClasses(order.status)">{{ orderStatusLabel(order.status) }}</span>
                            </div>
                            <p class="mt-1 text-xs text-gray-400">{{ formatDate(order.createdAt) }}</p>
                        </div>
                        <div class="flex flex-col gap-2 sm:flex-row">
                            <select :value="order.status" :disabled="savingOrderIds.includes(order.id)" class="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-600 outline-none disabled:opacity-50" @change="updateOrderStatus(order, $event.target.value)">
                                <option v-for="status in orderStatuses" :key="status.value" :value="status.value">{{ status.label }}</option>
                            </select>
                            <button v-if="order.customerPhone" type="button" class="rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white" @click="contactCustomer(order)">WhatsApp</button>
                        </div>
                    </div>

                    <div class="mt-5 grid gap-4 lg:grid-cols-[220px_1fr_150px]">
                        <div class="rounded-2xl bg-[#F8FBFC] p-4">
                            <p class="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">Cliente</p>
                            <p class="mt-1 text-sm font-black text-gray-600">{{ order.customerName }}</p>
                            <p class="mt-1 text-xs text-gray-400">{{ order.customerPhone || "Sin teléfono" }}</p>
                        </div>
                        <div class="rounded-2xl bg-[#F8FBFC] p-4">
                            <p class="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">Productos</p>
                            <div v-if="order.items.length" class="mt-2 space-y-2">
                                <div v-for="item in order.items" :key="item.id" class="flex items-center justify-between gap-3 text-sm">
                                    <span class="min-w-0 truncate text-gray-500">{{ item.quantity }} × {{ item.productName }}</span>
                                    <span class="shrink-0 font-bold text-gray-600">{{ formatPrice(item.quantity * item.unitPrice) }}</span>
                                </div>
                            </div>
                            <p v-else class="mt-2 text-sm text-gray-400">Sin productos registrados.</p>
                        </div>
                        <div class="rounded-2xl bg-[#EAF9FC] p-4">
                            <p class="text-[10px] font-bold uppercase tracking-[0.08em] text-[#0077B6]">Total</p>
                            <p class="mt-2 text-2xl font-black text-black">{{ formatPrice(order.total) }}</p>
                        </div>
                    </div>

                    <div v-if="order.notes" class="mt-4 border-t border-gray-100 pt-4">
                        <p class="text-xs font-bold text-gray-400">Nota del cliente</p>
                        <p class="mt-1 text-sm leading-relaxed text-gray-500">{{ order.notes }}</p>
                    </div>
                </article>
            </section>

            <section v-else class="rounded-[24px] bg-white px-5 py-16 text-center shadow-sm">
                <p class="font-black text-gray-700">No hay pedidos para mostrar</p>
                <p class="mt-2 text-sm text-gray-400">Los pedidos que recibas aparecerán automáticamente aquí.</p>
            </section>
        </template>
    </main>

    <!-- Navegación móvil. -->
    <nav class="fixed inset-x-0 bottom-0 z-50 bg-[#00B4D8] shadow-[0_-4px_15px_rgba(0,0,0,0.10)] lg:hidden">
        <div class="mx-auto grid max-w-md grid-cols-4">
            <button type="button" class="flex flex-col items-center gap-1 py-2 text-white/75" @click="goSection('inicio')">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"></path><path d="M5 10v10h14V10"></path></svg><span class="text-[9px] font-bold">Inicio</span>
            </button>
            <button type="button" class="flex flex-col items-center gap-1 bg-white/15 py-2 text-white">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 7l8-4 8 4-8 4-8-4z"></path><path d="M4 7v10l8 4 8-4V7"></path></svg><span class="text-[9px] font-bold">Inventario</span>
            </button>
            <button type="button" class="flex flex-col items-center gap-1 py-2 text-white/75" @click="goSection('novedades')">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path></svg><span class="text-[9px] font-bold">Novedades</span>
            </button>
            <button type="button" class="flex flex-col items-center gap-1 py-2 text-white/75" @click="goSection('calculadora')">
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"></path></svg><span class="text-[9px] font-bold">Calculadora</span>
            </button>
        </div>
    </nav>

    <!-- Ventana para escribir una cantidad exacta de stock. -->
    <Teleport to="body">
        <div v-if="showStockModal" class="fixed inset-0 z-[130] flex items-end justify-center bg-black/50 sm:items-center sm:p-5" @click.self="closeStockModal">
            <section class="w-full rounded-t-[28px] bg-white p-5 sm:max-w-[440px] sm:rounded-[28px] sm:p-6">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">Actualizar stock</p>
                        <h2 class="mt-1 text-lg font-black text-gray-700">{{ stockProduct?.name }}</h2>
                    </div>
                    <button type="button" class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500" @click="closeStockModal">×</button>
                </div>
                <label class="mt-6 block">
                    <span class="text-sm font-bold text-gray-600">Cantidad disponible</span>
                    <input v-model.number="stockValue" type="number" min="0" step="1" class="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-700 outline-none focus:border-[#00B4D8]">
                </label>
                <p class="mt-2 text-xs text-gray-400">Escribe la cantidad total que tienes disponible actualmente.</p>
                <div class="mt-6 grid grid-cols-2 gap-2">
                    <button type="button" class="rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-400" @click="closeStockModal">Cancelar</button>
                    <button type="button" :disabled="stockProduct && savingStockIds.includes(stockProduct.id)" class="rounded-xl bg-[#00B4D8] px-4 py-3 text-sm font-bold text-white disabled:opacity-50" @click="saveExactStock">Guardar</button>
                </div>
            </section>
        </div>
    </Teleport>
</div>
</template>
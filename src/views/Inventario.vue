<script setup>
// Inventario del emprendedor: administra stock y pedidos registrados manualmente.
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";

const router = useRouter();

// Información principal.
const entrepreneur = ref(null);
const products = ref([]);
const orders = ref([]);
const loading = ref(true);
const loadError = ref("");

// Control de pestañas, búsquedas y filtros.
const activeTab = ref("stock");
const productSearch = ref("");
const stockFilter = ref("all");
const orderSearch = ref("");
const orderFilter = ref("all");

// Evita guardar varias veces la misma información.
const savingStockIds = ref([]);
const savingOrderIds = ref([]);
const deletingOrderId = ref("");
const orderSaving = ref(false);

// Ventana para modificar el stock exacto.
const showStockModal = ref(false);
const stockProduct = ref(null);
const stockValue = ref(0);

// Ventana para crear o editar pedidos.
const showOrderEditor = ref(false);
const orderEditorMode = ref("add");
const selectedOrder = ref(null);

const orderForm = ref({
    customerName: "",
    customerPhone: "",
    status: "pendiente",
    notes: "",
    items: []
});

// Estados disponibles para los pedidos.
const orderStatuses = [
    {
        value: "pendiente",
        label: "Pendiente"
    },
    {
        value: "en_preparacion",
        label: "En preparación"
    },
    {
        value: "listo",
        label: "Listo"
    },
    {
        value: "entregado",
        label: "Entregado"
    },
    {
        value: "cancelado",
        label: "Cancelado"
    }
];

// Resumen general del inventario.
const totalProducts = computed(function () {
    return products.value.length;
});

const totalUnits = computed(function () {
    return products.value.reduce(function (total, product) {
        return total + product.stock;
    }, 0);
});

const lowStockCount = computed(function () {
    return products.value.filter(function (product) {
        return product.stock > 0 && product.stock <= 5;
    }).length;
});

const outOfStockCount = computed(function () {
    return products.value.filter(function (product) {
        return product.stock === 0;
    }).length;
});

const inventoryValue = computed(function () {
    return products.value.reduce(function (total, product) {
        return total + product.price * product.stock;
    }, 0);
});

// Coloca primero los productos que requieren atención.
const attentionProducts = computed(function () {
    return products.value
        .filter(function (product) {
            return product.stock <= 5;
        })
        .sort(function (a, b) {
            return a.stock - b.stock;
        });
});

// Filtra los productos según el buscador y el estado del stock.
const filteredProducts = computed(function () {
    const text = productSearch.value.toLowerCase().trim();

    return products.value.filter(function (product) {
        const categories = product.categories.join(" ").toLowerCase();

        const matchesText =
            product.name.toLowerCase().includes(text) ||
            categories.includes(text);

        let matchesFilter = true;

        if (stockFilter.value === "available") {
            matchesFilter = product.stock > 5;
        }

        if (stockFilter.value === "low") {
            matchesFilter =
                product.stock > 0 &&
                product.stock <= 5;
        }

        if (stockFilter.value === "out") {
            matchesFilter = product.stock === 0;
        }

        return matchesText && matchesFilter;
    });
});

// Cantidad de pedidos según su estado.
const pendingOrders = computed(function () {
    return orders.value.filter(function (order) {
        return order.status === "pendiente";
    }).length;
});

const preparationOrders = computed(function () {
    return orders.value.filter(function (order) {
        return order.status === "en_preparacion";
    }).length;
});

const readyOrders = computed(function () {
    return orders.value.filter(function (order) {
        return order.status === "listo";
    }).length;
});

const deliveredOrders = computed(function () {
    return orders.value.filter(function (order) {
        return order.status === "entregado";
    }).length;
});

// Filtra los pedidos por nombre, teléfono, producto o estado.
const filteredOrders = computed(function () {
    const text = orderSearch.value.toLowerCase().trim();

    return orders.value.filter(function (order) {
        const productNames = order.items
            .map(function (item) {
                return item.productName;
            })
            .join(" ")
            .toLowerCase();

        const matchesText =
            order.id.toLowerCase().includes(text) ||
            order.customerName.toLowerCase().includes(text) ||
            order.customerPhone.toLowerCase().includes(text) ||
            productNames.includes(text);

        const matchesStatus =
            orderFilter.value === "all" ||
            order.status === orderFilter.value;

        return matchesText && matchesStatus;
    });
});

// Suma automáticamente el total del pedido que se está creando.
const orderFormTotal = computed(function () {
    return orderForm.value.items.reduce(function (total, item) {
        const quantity = Math.max(
            Number(item.quantity) || 0,
            0
        );

        const unitPrice =
            Number(item.unitPrice) || 0;

        return total + quantity * unitPrice;
    }, 0);
});

// Formatea valores monetarios.
function formatPrice(value) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(Number(value) || 0);
}

// Muestra la fecha de manera más sencilla.
function formatDate(value) {
    if (!value) return "Sin fecha";

    return new Intl.DateTimeFormat("es-SV", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date(value));
}

// Acorta el UUID para mostrar un número de pedido legible.
function shortOrderId(id) {
    return String(id || "")
        .slice(0, 8)
        .toUpperCase();
}

// Devuelve el texto correspondiente al stock.
function stockLabel(stock) {
    if (stock === 0) return "Agotado";
    if (stock <= 5) return "Stock bajo";
    return "Disponible";
}

// Devuelve los colores correspondientes al stock.
function stockClasses(stock) {
    if (stock === 0) {
        return "bg-red-100 text-red-700";
    }

    if (stock <= 5) {
        return "bg-yellow-100 text-yellow-700";
    }

    return "bg-green-100 text-green-700";
}

// Busca el nombre visible de un estado.
function orderStatusLabel(status) {
    const selectedStatus =
        orderStatuses.find(function (item) {
            return item.value === status;
        });

    return selectedStatus?.label || "Pendiente";
}

// Colores suaves para cada estado del pedido.
function orderStatusClasses(status) {
    const classes = {
        pendiente:
            "bg-yellow-100 text-yellow-700",

        en_preparacion:
            "bg-blue-100 text-blue-700",

        listo:
            "bg-[#CAF0F8] text-[#0077B6]",

        entregado:
            "bg-green-100 text-green-700",

        cancelado:
            "bg-red-100 text-red-700"
    };

    return (
        classes[status] ||
        "bg-gray-100 text-gray-600"
    );
}

// Mantiene conectados Dashboard, Inventario y Calculadora.
function goSection(section) {
    if (section === "inventario") {
        return;
    }

    if (section === "calculadora") {
        router.push({
            name: "Calculadora"
        });

        return;
    }

    sessionStorage.setItem(
        "thriveDashboardSection",
        section
    );

    router.push({
        name: "DashboardEmprendedor"
    });
}

// Carga los productos del emprendimiento.
async function loadProducts(userId) {
    const {
        data: productRows,
        error: productError
    } = await supabase
        .from("products")
        .select(`
            id,
            entrepreneur_id,
            name,
            categories,
            price,
            stock,
            active,
            created_at
        `)
        .eq("entrepreneur_id", userId)
        .order("created_at", {
            ascending: false
        });

    if (productError) {
        throw productError;
    }

    if (!productRows?.length) {
        products.value = [];
        return;
    }

    const productIds =
        productRows.map(function (product) {
            return product.id;
        });

    // Se carga la primera fotografía de cada producto.
    const {
        data: imageRows,
        error: imageError
    } = await supabase
        .from("product_images")
        .select(`
            product_id,
            image_url,
            sort_order
        `)
        .in("product_id", productIds)
        .order("sort_order", {
            ascending: true
        });

    if (imageError) {
        throw imageError;
    }

    products.value =
        productRows.map(function (product) {
            const firstImage =
                (imageRows || []).find(
                    function (image) {
                        return (
                            image.product_id ===
                            product.id
                        );
                    }
                );

            return {
                id: product.id,
                name: product.name,
                categories:
                    product.categories || [],
                price:
                    Number(product.price) || 0,
                stock:
                    Number(product.stock) || 0,
                active: product.active,
                image:
                    firstImage?.image_url || ""
            };
        });
}

// Carga los pedidos creados manualmente por el emprendedor.
async function loadOrders(userId) {
    const { data, error } = await supabase
        .from("orders")
        .select(`
            id,
            customer_id,
            customer_name,
            customer_phone,
            status,
            total,
            notes,
            created_at,
            updated_at,
            order_items (
                id,
                product_id,
                product_name,
                quantity,
                unit_price
            )
        `)
        .eq("entrepreneur_id", userId)
        .order("created_at", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    orders.value =
        (data || []).map(function (order) {
            return {
                id: order.id,

                customerId:
                    order.customer_id,

                customerName:
                    order.customer_name ||
                    "Cliente",

                customerPhone:
                    order.customer_phone || "",

                status:
                    order.status ||
                    "pendiente",

                total:
                    Number(order.total) || 0,

                notes:
                    order.notes || "",

                createdAt:
                    order.created_at,

                updatedAt:
                    order.updated_at,

                items:
                    (order.order_items || [])
                        .map(function (item) {
                            return {
                                id: item.id,

                                productId:
                                    item.product_id,

                                productName:
                                    item.product_name ||
                                    "Producto",

                                quantity:
                                    Number(
                                        item.quantity
                                    ) || 1,

                                unitPrice:
                                    Number(
                                        item.unit_price
                                    ) || 0
                            };
                        })
            };
        });
}

// Carga toda la pantalla.
async function loadInventory() {
    loading.value = true;
    loadError.value = "";

    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user) {
            loadError.value =
                "No se encontró una sesión activa.";

            return;
        }

        const {
            data: business,
            error: businessError
        } = await supabase
            .from("entrepreneurs")
            .select(`
                id,
                business_name,
                logo_url
            `)
            .eq("id", user.id)
            .single();

        if (businessError || !business) {
            throw (
                businessError ||
                new Error(
                    "No se encontró el emprendimiento."
                )
            );
        }

        entrepreneur.value = {
            id: business.id,
            businessName:
                business.business_name,
            avatar:
                business.logo_url || ""
        };

        // Productos y pedidos se cargan al mismo tiempo.
        await Promise.all([
            loadProducts(user.id),
            loadOrders(user.id)
        ]);
    } catch (error) {
        console.error(
            "Error al cargar inventario:",
            error
        );

        loadError.value =
            "No fue posible cargar el inventario.";
    } finally {
        loading.value = false;
    }
}

// Actualiza el stock de un producto.
async function updateStock(product, amount) {
    if (
        !product ||
        savingStockIds.value.includes(
            product.id
        )
    ) {
        return;
    }

    const newStock = Math.max(
        Math.floor(Number(amount) || 0),
        0
    );

    savingStockIds.value.push(product.id);

    try {
        const { data, error } =
            await supabase
                .from("products")
                .update({
                    stock: newStock,
                    updated_at:
                        new Date().toISOString()
                })
                .eq("id", product.id)
                .eq(
                    "entrepreneur_id",
                    entrepreneur.value.id
                )
                .select("id, stock")
                .single();

        if (error) {
            throw error;
        }

        product.stock =
            Number(data.stock) || 0;

        if (
            stockProduct.value?.id ===
            product.id
        ) {
            stockValue.value =
                product.stock;
        }
    } catch (error) {
        console.error(
            "Error al actualizar stock:",
            error
        );

        alert(
            "No fue posible actualizar el stock."
        );
    } finally {
        savingStockIds.value =
            savingStockIds.value.filter(
                function (id) {
                    return id !== product.id;
                }
            );
    }
}

// Abre la ventana para escribir el stock exacto.
function openStockModal(product) {
    stockProduct.value = product;
    stockValue.value = product.stock;
    showStockModal.value = true;

    document.body.style.overflow =
        "hidden";
}

function closeStockModal() {
    showStockModal.value = false;
    stockProduct.value = null;

    document.body.style.overflow = "";
}

async function saveExactStock() {
    if (!stockProduct.value) return;

    const product = stockProduct.value;

    await updateStock(
        product,
        stockValue.value
    );

    if (
        !savingStockIds.value.includes(
            product.id
        )
    ) {
        closeStockModal();
    }
}

// Crea una fila para agregar un producto al pedido.
function createOrderItem(product = null) {
    return {
        key:
            `${Date.now()}-${Math.random()}`,

        productId:
            product?.id || "",

        productName:
            product?.name || "",

        quantity: 1,

        unitPrice:
            product?.price || 0
    };
}

// Limpia el formulario de pedidos.
function resetOrderForm() {
    orderForm.value = {
        customerName: "",
        customerPhone: "",
        status: "pendiente",
        notes: "",
        items: [
            createOrderItem(
                products.value[0] || null
            )
        ]
    };
}

// Abre el formulario para crear un pedido nuevo.
function openAddOrder() {
    if (!products.value.length) {
        alert(
            "Primero debes registrar al menos un producto."
        );

        return;
    }

    orderEditorMode.value = "add";
    selectedOrder.value = null;

    resetOrderForm();

    showOrderEditor.value = true;

    document.body.style.overflow =
        "hidden";
}

// Abre un pedido existente para editarlo.
function openEditOrder(order) {
    orderEditorMode.value = "edit";
    selectedOrder.value = order;

    orderForm.value = {
        customerName:
            order.customerName,

        customerPhone:
            order.customerPhone,

        status:
            order.status,

        notes:
            order.notes,

        items:
            order.items.length
                ? order.items.map(
                    function (item) {
                        return {
                            key:
                                item.id ||
                                `${Date.now()}-${Math.random()}`,

                            productId:
                                item.productId ||
                                "",

                            productName:
                                item.productName,

                            quantity:
                                item.quantity,

                            unitPrice:
                                item.unitPrice
                        };
                    }
                )
                : [
                    createOrderItem(
                        products.value[0] ||
                        null
                    )
                ]
    };

    showOrderEditor.value = true;

    document.body.style.overflow =
        "hidden";
}

// Cierra el formulario.
function closeOrderEditor() {
    showOrderEditor.value = false;
    selectedOrder.value = null;

    document.body.style.overflow = "";
}

// Actualiza nombre y precio al elegir un producto.
function selectOrderProduct(item) {
    const product =
        products.value.find(
            function (product) {
                return (
                    product.id ===
                    item.productId
                );
            }
        );

    if (!product) return;

    item.productName =
        product.name;

    item.unitPrice =
        product.price;
}

// Añade otra línea de producto.
function addOrderItem() {
    orderForm.value.items.push(
        createOrderItem(
            products.value[0] || null
        )
    );
}

// Elimina una línea del pedido.
function removeOrderItem(index) {
    if (
        orderForm.value.items.length === 1
    ) {
        alert(
            "El pedido debe tener al menos un producto."
        );

        return;
    }

    orderForm.value.items.splice(
        index,
        1
    );
}

// Comprueba que el formulario esté completo.
function validateOrderForm() {
    if (
        !orderForm.value.customerName.trim()
    ) {
        alert(
            "Escribe el nombre del cliente."
        );

        return false;
    }

    if (!orderForm.value.items.length) {
        alert(
            "Agrega al menos un producto."
        );

        return false;
    }

    for (
        const item of
        orderForm.value.items
    ) {
        if (!item.productId) {
            alert(
                "Selecciona un producto en cada fila."
            );

            return false;
        }

        if (
            (Number(item.quantity) || 0) <
            1
        ) {
            alert(
                "La cantidad debe ser mayor que cero."
            );

            return false;
        }

        if (
            (Number(item.unitPrice) || 0) <
            0
        ) {
            alert(
                "El precio no puede ser negativo."
            );

            return false;
        }
    }

    return true;
}

// Prepara las filas que se guardarán en order_items.
function buildOrderItemRows(orderId) {
    return orderForm.value.items.map(
        function (item) {
            return {
                order_id: orderId,

                product_id:
                    item.productId,

                product_name:
                    item.productName.trim(),

                quantity:
                    Math.max(
                        Math.floor(
                            Number(
                                item.quantity
                            ) || 1
                        ),
                        1
                    ),

                unit_price:
                    Number(
                        item.unitPrice
                    ) || 0
            };
        }
    );
}

// Decide si debe crear o editar el pedido.
async function saveOrder() {
    if (
        orderSaving.value ||
        !validateOrderForm()
    ) {
        return;
    }

    orderSaving.value = true;

    const editing =
        orderEditorMode.value === "edit";

    try {
        if (editing) {
            await updateOrder();
        } else {
            await createOrder();
        }

        await loadOrders(
            entrepreneur.value.id
        );

        closeOrderEditor();

        alert(
            editing
                ? "Pedido actualizado correctamente."
                : "Pedido creado correctamente."
        );
    } catch (error) {
        console.error(
            "Error al guardar pedido:",
            error
        );

        alert(
            "No fue posible guardar el pedido: " +
            error.message
        );
    } finally {
        orderSaving.value = false;
    }
}

// Crea el pedido principal y después sus productos.
async function createOrder() {
    const {
        data: newOrder,
        error: orderError
    } = await supabase
        .from("orders")
        .insert({
            entrepreneur_id:
                entrepreneur.value.id,

            customer_id: null,

            customer_name:
                orderForm.value
                    .customerName
                    .trim(),

            customer_phone:
                orderForm.value
                    .customerPhone
                    .trim() || null,

            status:
                orderForm.value.status,

            total:
                orderFormTotal.value,

            notes:
                orderForm.value
                    .notes
                    .trim() || null
        })
        .select("id")
        .single();

    if (orderError) {
        throw orderError;
    }

    const { error: itemsError } =
        await supabase
            .from("order_items")
            .insert(
                buildOrderItemRows(
                    newOrder.id
                )
            );

    if (!itemsError) return;

    // Evita dejar pedidos incompletos.
    await supabase
        .from("orders")
        .delete()
        .eq("id", newOrder.id);

    throw itemsError;
}

// Edita la información general y reemplaza sus productos.
async function updateOrder() {
    if (!selectedOrder.value) {
        throw new Error(
            "No se encontró el pedido."
        );
    }

    const orderId =
        selectedOrder.value.id;

    const { error: orderError } =
        await supabase
            .from("orders")
            .update({
                customer_name:
                    orderForm.value
                        .customerName
                        .trim(),

                customer_phone:
                    orderForm.value
                        .customerPhone
                        .trim() || null,

                status:
                    orderForm.value.status,

                total:
                    orderFormTotal.value,

                notes:
                    orderForm.value
                        .notes
                        .trim() || null,

                updated_at:
                    new Date()
                        .toISOString()
            })
            .eq("id", orderId)
            .eq(
                "entrepreneur_id",
                entrepreneur.value.id
            );

    if (orderError) {
        throw orderError;
    }

    // Eliminamos las líneas anteriores y guardamos las nuevas.
    const { error: deleteError } =
        await supabase
            .from("order_items")
            .delete()
            .eq("order_id", orderId);

    if (deleteError) {
        throw deleteError;
    }

    const { error: insertError } =
        await supabase
            .from("order_items")
            .insert(
                buildOrderItemRows(
                    orderId
                )
            );

    if (insertError) {
        throw insertError;
    }
}

// Cambia rápidamente el estado desde la tarjeta.
async function updateOrderStatus(
    order,
    newStatus
) {
    if (
        !order ||
        order.status === newStatus ||
        savingOrderIds.value.includes(
            order.id
        )
    ) {
        return;
    }

    savingOrderIds.value.push(order.id);

    try {
        const { data, error } =
            await supabase
                .from("orders")
                .update({
                    status: newStatus,
                    updated_at:
                        new Date()
                            .toISOString()
                })
                .eq("id", order.id)
                .eq(
                    "entrepreneur_id",
                    entrepreneur.value.id
                )
                .select(`
                    id,
                    status,
                    updated_at
                `)
                .single();

        if (error) {
            throw error;
        }

        order.status = data.status;
        order.updatedAt =
            data.updated_at;
    } catch (error) {
        console.error(
            "Error al cambiar estado:",
            error
        );

        alert(
            "No fue posible cambiar el estado."
        );
    } finally {
        savingOrderIds.value =
            savingOrderIds.value.filter(
                function (id) {
                    return id !== order.id;
                }
            );
    }
}

// Elimina el pedido; order_items se elimina mediante cascada.
async function deleteOrder(order) {
    if (
        !order ||
        deletingOrderId.value
    ) {
        return;
    }

    const confirmed =
        window.confirm(
            `¿Eliminar el pedido de ${order.customerName}?`
        );

    if (!confirmed) return;

    deletingOrderId.value = order.id;

    try {
        const { error } =
            await supabase
                .from("orders")
                .delete()
                .eq("id", order.id)
                .eq(
                    "entrepreneur_id",
                    entrepreneur.value.id
                );

        if (error) {
            throw error;
        }

        orders.value =
            orders.value.filter(
                function (item) {
                    return (
                        item.id !== order.id
                    );
                }
            );
    } catch (error) {
        console.error(
            "Error al eliminar pedido:",
            error
        );

        alert(
            "No fue posible eliminar el pedido."
        );
    } finally {
        deletingOrderId.value = "";
    }
}

// Abre una conversación de WhatsApp.
function contactCustomer(order) {
    const rawPhone =
        String(
            order.customerPhone || ""
        ).replace(/\D/g, "");

    if (!rawPhone) {
        alert(
            "Este pedido no tiene teléfono."
        );

        return;
    }

    const phone =
        rawPhone.length === 8
            ? `503${rawPhone}`
            : rawPhone;

    const message =
        encodeURIComponent(
            `Hola ${order.customerName}, te escribimos de ${entrepreneur.value?.businessName || "Thrive"} sobre tu pedido #${shortOrderId(order.id)}.`
        );

    window.open(
        `https://wa.me/${phone}?text=${message}`,
        "_blank",
        "noopener,noreferrer"
    );
}

// Cierra las ventanas utilizando Escape.
function handleEscape(event) {
    if (event.key !== "Escape") return;

    if (showOrderEditor.value) {
        closeOrderEditor();
        return;
    }

    if (showStockModal.value) {
        closeStockModal();
    }
}

onMounted(function () {
    loadInventory();

    document.addEventListener(
        "keydown",
        handleEscape
    );
});

onBeforeUnmount(function () {
    document.removeEventListener(
        "keydown",
        handleEscape
    );

    document.body.style.overflow = "";
});
</script>

<template>
<div class="min-h-screen bg-[#F8FBFC] pb-[76px] text-gray-700 lg:pb-10">
    <!-- Cabecera móvil y navbar para computadora. -->
    <header class="sticky top-0 z-40 bg-[#F8FBFC]">
        <div class="mx-auto max-w-[1450px] px-2 pt-2 sm:px-5 lg:px-8 lg:pt-4">
            <!-- En celular se conserva la cabecera original. -->
            <div class="flex items-center rounded-[24px] bg-[#00B4D8] p-2 shadow-sm lg:hidden">
                <div class="min-w-0 flex-1 px-3">
                    <span class="block truncate text-sm font-bold text-white">
                        {{ entrepreneur?.businessName || "Thrive" }}
                    </span>
                </div>

                <button
                    type="button"
                    aria-label="Mensajes"
                    class="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/20"
                >
                    <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linejoin="round"
                            d="M4 5h16v12H8l-4 3V5z"
                        ></path>
                        <path
                            stroke-linecap="round"
                            d="M8 9h8M8 13h5"
                        ></path>
                    </svg>
                </button>

                <button
                    type="button"
                    aria-label="Notificaciones"
                    class="flex h-9 w-9 items-center justify-center rounded-full text-white hover:bg-white/20"
                >
                    <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"
                        ></path>
                    </svg>
                </button>
            </div>

            <!-- Navbar principal para laptop. -->
            <nav class="hidden items-center justify-center gap-2 rounded-[24px] bg-[#00B4D8] p-2 shadow-sm lg:flex">
                <button
                    type="button"
                    class="rounded-full px-6 py-2.5 text-sm font-bold text-white/85 hover:bg-white/15 hover:text-white"
                    @click="goSection('inicio')"
                >
                    Inicio
                </button>

                <button
                    type="button"
                    class="rounded-full bg-white px-6 py-2.5 text-sm font-bold text-[#0077B6] shadow-sm"
                >
                    Inventario
                </button>

                <button
                    type="button"
                    class="rounded-full px-6 py-2.5 text-sm font-bold text-white/85 hover:bg-white/15 hover:text-white"
                    @click="goSection('novedades')"
                >
                    Novedades
                </button>

                <button
                    type="button"
                    class="rounded-full px-6 py-2.5 text-sm font-bold text-white/85 hover:bg-white/15 hover:text-white"
                    @click="goSection('calculadora')"
                >
                    Calculadora
                </button>
            </nav>
        </div>
    </header>

    <!-- Estado de carga. -->
    <main
        v-if="loading"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center"
    >
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>

        <p class="mt-4 text-sm font-semibold text-gray-400">
            Cargando inventario...
        </p>
    </main>

    <!-- Error general. -->
    <main
        v-else-if="loadError"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center"
    >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 font-black text-red-600">
            !
        </div>

        <p class="mt-4 font-black text-gray-700">
            No pudimos cargar el inventario
        </p>

        <p class="mt-2 text-sm text-gray-400">
            {{ loadError }}
        </p>

        <button
            type="button"
            class="mt-5 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white"
            @click="loadInventory"
        >
            Intentar nuevamente
        </button>
    </main>

    <!-- Contenido principal. -->
    <main
        v-else
        class="mx-auto max-w-[1450px] px-3 pb-10 pt-4 sm:px-5 lg:px-8 lg:pt-6"
    >
        <!-- Encabezado y cambio de pestaña. -->
        <section class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                    Gestión del emprendimiento
                </p>

                <h1 class="mt-1 text-2xl font-black text-gray-700 sm:text-3xl">
                    Inventario
                </h1>

                <p class="mt-2 max-w-2xl text-sm text-gray-400">
                    Controla tus existencias y registra los pedidos que recibes por WhatsApp, redes sociales o en persona.
                </p>
            </div>

            <div class="grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm">
                <button
                    type="button"
                    class="rounded-xl px-5 py-2.5 text-sm font-bold"
                    :class="
                        activeTab === 'stock'
                            ? 'bg-[#00B4D8] text-white'
                            : 'text-gray-400'
                    "
                    @click="activeTab = 'stock'"
                >
                    Stock
                </button>

                <button
                    type="button"
                    class="rounded-xl px-5 py-2.5 text-sm font-bold"
                    :class="
                        activeTab === 'orders'
                            ? 'bg-[#00B4D8] text-white'
                            : 'text-gray-400'
                    "
                    @click="activeTab = 'orders'"
                >
                    Pedidos

                    <span
                        v-if="pendingOrders"
                        class="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]"
                    >
                        {{ pendingOrders }}
                    </span>
                </button>
            </div>
        </section>

        <!-- STOCK -->
        <template v-if="activeTab === 'stock'">
            <!-- Resumen del inventario. -->
            <section class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <article class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold text-gray-400">
                        Productos
                    </p>

                    <p class="mt-2 text-2xl font-black text-gray-700">
                        {{ totalProducts }}
                    </p>

                    <p class="mt-1 text-xs text-gray-400">
                        registrados
                    </p>
                </article>

                <article class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold text-gray-400">
                        Unidades
                    </p>

                    <p class="mt-2 text-2xl font-black text-gray-700">
                        {{ totalUnits }}
                    </p>

                    <p class="mt-1 text-xs text-gray-400">
                        disponibles
                    </p>
                </article>

                <article class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold text-gray-400">
                        Necesitan atención
                    </p>

                    <p class="mt-2 text-2xl font-black text-[#0077B6]">
                        {{
                            lowStockCount +
                            outOfStockCount
                        }}
                    </p>

                    <p class="mt-1 text-xs text-gray-400">
                        {{ lowStockCount }} bajos ·
                        {{ outOfStockCount }} agotados
                    </p>
                </article>

                <article class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold text-gray-400">
                        Valor potencial
                    </p>

                    <p class="mt-2 text-2xl font-black text-black">
                        {{ formatPrice(inventoryValue) }}
                    </p>

                    <p class="mt-1 text-xs text-gray-400">
                        precio × stock
                    </p>
                </article>
            </section>

            <!-- Productos con pocas existencias. -->
            <section
                v-if="attentionProducts.length"
                class="mb-6 rounded-[24px] bg-white p-5 shadow-sm sm:p-6"
            >
                <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                    Necesitan atención
                </p>

                <h2 class="mt-1 text-lg font-black text-gray-700">
                    Revisa estos productos
                </h2>

                <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <article
                        v-for="product in attentionProducts"
                        :key="product.id"
                        class="flex items-center gap-3 rounded-2xl bg-[#F8FBFC] p-3"
                    >
                        <img
                            v-if="product.image"
                            :src="product.image"
                            :alt="product.name"
                            class="h-14 w-14 shrink-0 rounded-xl object-cover"
                        >

                        <div
                            v-else
                            class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs font-bold text-gray-400"
                        >
                            Sin foto
                        </div>

                        <div class="min-w-0 flex-1">
                            <p class="truncate text-sm font-bold text-gray-600">
                                {{ product.name }}
                            </p>

                            <p
                                class="mt-0.5 text-xs"
                                :class="
                                    product.stock === 0
                                        ? 'text-red-500'
                                        : 'text-yellow-600'
                                "
                            >
                                {{
                                    product.stock === 0
                                        ? "Producto agotado"
                                        : `${product.stock} unidades restantes`
                                }}
                            </p>
                        </div>

                        <button
                            type="button"
                            class="rounded-xl bg-white px-3 py-2 text-xs font-bold text-[#0077B6] shadow-sm"
                            @click="openStockModal(product)"
                        >
                            Actualizar
                        </button>
                    </article>
                </div>
            </section>

            <!-- Buscador y filtros. -->
            <section class="mb-5 rounded-[24px] bg-white p-4 shadow-sm sm:p-5">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex flex-1 items-center rounded-xl bg-[#F8FBFC] px-4 py-3 lg:max-w-md">
                        <svg
                            class="mr-2 h-5 w-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                cx="11"
                                cy="11"
                                r="7"
                            ></circle>

                            <path
                                stroke-linecap="round"
                                d="m20 20-3.5-3.5"
                            ></path>
                        </svg>

                        <input
                            v-model="productSearch"
                            type="text"
                            placeholder="Buscar producto"
                            class="w-full bg-transparent text-sm text-gray-600 outline-none placeholder:text-gray-400"
                        >
                    </div>

                    <div class="flex gap-2 overflow-x-auto">
                        <button
                            type="button"
                            class="whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold"
                            :class="
                                stockFilter === 'all'
                                    ? 'bg-[#00B4D8] text-white'
                                    : 'bg-[#F8FBFC] text-gray-400'
                            "
                            @click="stockFilter = 'all'"
                        >
                            Todos
                        </button>

                        <button
                            type="button"
                            class="whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold"
                            :class="
                                stockFilter === 'available'
                                    ? 'bg-[#00B4D8] text-white'
                                    : 'bg-[#F8FBFC] text-gray-400'
                            "
                            @click="stockFilter = 'available'"
                        >
                            Disponibles
                        </button>

                        <button
                            type="button"
                            class="whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold"
                            :class="
                                stockFilter === 'low'
                                    ? 'bg-[#00B4D8] text-white'
                                    : 'bg-[#F8FBFC] text-gray-400'
                            "
                            @click="stockFilter = 'low'"
                        >
                            Stock bajo
                        </button>

                        <button
                            type="button"
                            class="whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold"
                            :class="
                                stockFilter === 'out'
                                    ? 'bg-[#00B4D8] text-white'
                                    : 'bg-[#F8FBFC] text-gray-400'
                            "
                            @click="stockFilter = 'out'"
                        >
                            Agotados
                        </button>
                    </div>
                </div>
            </section>

            <!-- Productos del inventario. -->
            <section
                v-if="filteredProducts.length"
                class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            >
                <article
                    v-for="product in filteredProducts"
                    :key="product.id"
                    class="rounded-[24px] bg-white p-4 shadow-sm"
                >
                    <div class="flex gap-4">
                        <img
                            v-if="product.image"
                            :src="product.image"
                            :alt="product.name"
                            class="h-20 w-20 shrink-0 rounded-2xl object-cover"
                        >

                        <div
                            v-else
                            class="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gray-100 text-xs font-bold text-gray-400"
                        >
                            Sin foto
                        </div>

                        <div class="min-w-0 flex-1">
                            <div class="flex items-start justify-between gap-2">
                                <div class="min-w-0">
                                    <h2 class="truncate text-sm font-black text-gray-600">
                                        {{ product.name }}
                                    </h2>

                                    <p class="mt-1 font-black text-black">
                                        {{ formatPrice(product.price) }}
                                    </p>
                                </div>

                                <span
                                    class="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
                                    :class="stockClasses(product.stock)"
                                >
                                    {{ stockLabel(product.stock) }}
                                </span>
                            </div>

                            <p class="mt-2 truncate text-xs text-gray-400">
                                {{
                                    product.categories.join(" · ") ||
                                    "Sin categoría"
                                }}
                            </p>
                        </div>
                    </div>

                    <!-- Botones rápidos de stock. -->
                    <div class="mt-4 rounded-2xl bg-[#F8FBFC] p-3">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-xs font-bold text-gray-400">
                                    Stock actual
                                </p>

                                <p class="mt-0.5 text-sm font-black text-gray-600">
                                    {{ product.stock }} unidades
                                </p>
                            </div>

                            <div class="flex items-center gap-2">
                                <button
                                    type="button"
                                    :disabled="
                                        product.stock <= 0 ||
                                        savingStockIds.includes(product.id)
                                    "
                                    class="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold text-gray-500 shadow-sm disabled:opacity-40"
                                    @click="
                                        updateStock(
                                            product,
                                            product.stock - 1
                                        )
                                    "
                                >
                                    −
                                </button>

                                <span class="min-w-8 text-center font-black text-gray-700">
                                    {{ product.stock }}
                                </span>

                                <button
                                    type="button"
                                    :disabled="
                                        savingStockIds.includes(product.id)
                                    "
                                    class="flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg font-bold text-[#0077B6] shadow-sm disabled:opacity-40"
                                    @click="
                                        updateStock(
                                            product,
                                            product.stock + 1
                                        )
                                    "
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="mt-3 flex items-center justify-between">
                        <div>
                            <p class="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                                Valor disponible
                            </p>

                            <p class="text-sm font-black text-gray-700">
                                {{
                                    formatPrice(
                                        product.price *
                                        product.stock
                                    )
                                }}
                            </p>
                        </div>

                        <button
                            type="button"
                            class="rounded-xl border border-gray-200 px-4 py-2.5 text-xs font-bold text-gray-500"
                            @click="openStockModal(product)"
                        >
                            Actualizar stock
                        </button>
                    </div>
                </article>
            </section>

            <section
                v-else
                class="rounded-[24px] bg-white px-5 py-16 text-center shadow-sm"
            >
                <p class="font-black text-gray-700">
                    No encontramos productos
                </p>

                <p class="mt-2 text-sm text-gray-400">
                    Prueba con otro filtro o búsqueda.
                </p>
            </section>
        </template>

        <!-- PEDIDOS -->
        <template v-else>
            <!-- AQUÍ ESTÁ EL BOTÓN PARA CREAR PEDIDOS. -->
            <section class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                        Agenda de pedidos
                    </p>

                    <h2 class="mt-1 text-2xl font-black text-gray-700">
                        Pedidos registrados
                    </h2>

                    <p class="mt-1 text-sm text-gray-400">
                        Registra y organiza los pedidos que recibes fuera de Thrive.
                    </p>
                </div>

                <button
                    type="button"
                    class="flex items-center justify-center gap-2 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#009CC0]"
                    @click="openAddOrder"
                >
                    <svg
                        class="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            d="M12 5v14M5 12h14"
                        ></path>
                    </svg>

                    Nuevo pedido
                </button>
            </section>

            <!-- Resumen de pedidos. -->
            <section class="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <article class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold text-gray-400">
                        Pendientes
                    </p>

                    <p class="mt-2 text-2xl font-black text-yellow-600">
                        {{ pendingOrders }}
                    </p>
                </article>

                <article class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold text-gray-400">
                        En preparación
                    </p>

                    <p class="mt-2 text-2xl font-black text-blue-600">
                        {{ preparationOrders }}
                    </p>
                </article>

                <article class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold text-gray-400">
                        Listos
                    </p>

                    <p class="mt-2 text-2xl font-black text-[#0077B6]">
                        {{ readyOrders }}
                    </p>
                </article>

                <article class="rounded-[22px] bg-white p-5 shadow-sm">
                    <p class="text-xs font-bold text-gray-400">
                        Entregados
                    </p>

                    <p class="mt-2 text-2xl font-black text-green-600">
                        {{ deliveredOrders }}
                    </p>
                </article>
            </section>

            <!-- Búsqueda y filtro de pedidos. -->
            <section class="mb-5 rounded-[24px] bg-white p-4 shadow-sm sm:p-5">
                <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex flex-1 items-center rounded-xl bg-[#F8FBFC] px-4 py-3 lg:max-w-md">
                        <svg
                            class="mr-2 h-5 w-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                cx="11"
                                cy="11"
                                r="7"
                            ></circle>

                            <path
                                stroke-linecap="round"
                                d="m20 20-3.5-3.5"
                            ></path>
                        </svg>

                        <input
                            v-model="orderSearch"
                            type="text"
                            placeholder="Buscar cliente, teléfono o producto"
                            class="w-full bg-transparent text-sm text-gray-600 outline-none placeholder:text-gray-400"
                        >
                    </div>

                    <select
                        v-model="orderFilter"
                        class="rounded-xl border border-gray-100 bg-[#F8FBFC] px-4 py-3 text-sm font-bold text-gray-500 outline-none"
                    >
                        <option value="all">
                            Todos los estados
                        </option>

                        <option
                            v-for="status in orderStatuses"
                            :key="status.value"
                            :value="status.value"
                        >
                            {{ status.label }}
                        </option>
                    </select>
                </div>
            </section>

            <!-- Tarjetas de pedidos. -->
            <section
                v-if="filteredOrders.length"
                class="space-y-4"
            >
                <article
                    v-for="order in filteredOrders"
                    :key="order.id"
                    class="rounded-[24px] bg-white p-5 shadow-sm sm:p-6"
                >
                    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div class="flex flex-wrap items-center gap-2">
                                <h3 class="font-black text-gray-700">
                                    Pedido #{{ shortOrderId(order.id) }}
                                </h3>

                                <span
                                    class="rounded-full px-2.5 py-1 text-[10px] font-bold"
                                    :class="orderStatusClasses(order.status)"
                                >
                                    {{ orderStatusLabel(order.status) }}
                                </span>
                            </div>

                            <p class="mt-1 text-xs text-gray-400">
                                {{ formatDate(order.createdAt) }}
                            </p>
                        </div>

                        <div class="flex flex-wrap gap-2">
                            <select
                                :value="order.status"
                                :disabled="
                                    savingOrderIds.includes(order.id)
                                "
                                class="rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold text-gray-600 outline-none disabled:opacity-50"
                                @change="
                                    updateOrderStatus(
                                        order,
                                        $event.target.value
                                    )
                                "
                            >
                                <option
                                    v-for="status in orderStatuses"
                                    :key="status.value"
                                    :value="status.value"
                                >
                                    {{ status.label }}
                                </option>
                            </select>

                            <button
                                v-if="order.customerPhone"
                                type="button"
                                class="rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white"
                                @click="contactCustomer(order)"
                            >
                                WhatsApp
                            </button>

                            <button
                                type="button"
                                class="rounded-xl bg-[#CAF0F8] px-4 py-2.5 text-sm font-bold text-[#0077B6]"
                                @click="openEditOrder(order)"
                            >
                                Editar
                            </button>

                            <button
                                type="button"
                                :disabled="
                                    deletingOrderId === order.id
                                "
                                class="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 disabled:opacity-50"
                                @click="deleteOrder(order)"
                            >
                                {{
                                    deletingOrderId === order.id
                                        ? "Eliminando..."
                                        : "Eliminar"
                                }}
                            </button>
                        </div>
                    </div>

                    <div class="mt-5 grid gap-4 lg:grid-cols-[220px_1fr_150px]">
                        <!-- Cliente -->
                        <div class="rounded-2xl bg-[#F8FBFC] p-4">
                            <p class="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                                Cliente
                            </p>

                            <p class="mt-1 text-sm font-black text-gray-600">
                                {{ order.customerName }}
                            </p>

                            <p class="mt-1 text-xs text-gray-400">
                                {{
                                    order.customerPhone ||
                                    "Sin teléfono"
                                }}
                            </p>
                        </div>

                        <!-- Productos -->
                        <div class="rounded-2xl bg-[#F8FBFC] p-4">
                            <p class="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400">
                                Productos
                            </p>

                            <div
                                v-if="order.items.length"
                                class="mt-2 space-y-2"
                            >
                                <div
                                    v-for="item in order.items"
                                    :key="item.id"
                                    class="flex items-center justify-between gap-3 text-sm"
                                >
                                    <span class="min-w-0 truncate text-gray-500">
                                        {{ item.quantity }} ×
                                        {{ item.productName }}
                                    </span>

                                    <span class="shrink-0 font-bold text-gray-600">
                                        {{
                                            formatPrice(
                                                item.quantity *
                                                item.unitPrice
                                            )
                                        }}
                                    </span>
                                </div>
                            </div>

                            <p
                                v-else
                                class="mt-2 text-sm text-gray-400"
                            >
                                Sin productos registrados.
                            </p>
                        </div>

                        <!-- Total -->
                        <div class="rounded-2xl bg-[#EAF9FC] p-4">
                            <p class="text-[10px] font-bold uppercase tracking-[0.08em] text-[#0077B6]">
                                Total
                            </p>

                            <p class="mt-2 text-2xl font-black text-black">
                                {{ formatPrice(order.total) }}
                            </p>
                        </div>
                    </div>

                    <div
                        v-if="order.notes"
                        class="mt-4 border-t border-gray-100 pt-4"
                    >
                        <p class="text-xs font-bold text-gray-400">
                            Nota del pedido
                        </p>

                        <p class="mt-1 text-sm leading-relaxed text-gray-500">
                            {{ order.notes }}
                        </p>
                    </div>
                </article>
            </section>

            <!-- Lista vacía con otro botón para crear pedidos. -->
            <section
                v-else
                class="rounded-[24px] bg-white px-5 py-16 text-center shadow-sm"
            >
                <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF9FC] text-[#00B4D8]">
                    <svg
                        class="h-7 w-7"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linejoin="round"
                            d="M4 5h16v14H4z"
                        ></path>

                        <path
                            stroke-linecap="round"
                            d="M8 9h8M8 13h5"
                        ></path>
                    </svg>
                </div>

                <p class="mt-4 font-black text-gray-700">
                    No hay pedidos registrados
                </p>

                <p class="mt-2 text-sm text-gray-400">
                    Crea el primer pedido que hayas recibido.
                </p>

                <button
                    type="button"
                    class="mt-5 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white"
                    @click="openAddOrder"
                >
                    Crear primer pedido
                </button>
            </section>
        </template>
    </main>

    <!-- Menú móvil. -->
    <nav class="fixed inset-x-0 bottom-0 z-50 bg-[#00B4D8] shadow-[0_-4px_15px_rgba(0,0,0,0.10)] lg:hidden">
        <div class="mx-auto grid max-w-md grid-cols-4">
            <button
                type="button"
                class="flex flex-col items-center gap-1 py-2 text-white/75"
                @click="goSection('inicio')"
            >
                <svg
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                >
                    <path d="M3 11l9-8 9 8"></path>
                    <path d="M5 10v10h14V10"></path>
                </svg>

                <span class="text-[9px] font-bold">
                    Inicio
                </span>
            </button>

            <button
                type="button"
                class="flex flex-col items-center gap-1 bg-white/15 py-2 text-white"
            >
                <svg
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    viewBox="0 0 24 24"
                >
                    <path d="M4 7l8-4 8 4-8 4-8-4z"></path>
                    <path d="M4 7v10l8 4 8-4V7"></path>
                </svg>

                <span class="text-[9px] font-bold">
                    Inventario
                </span>
            </button>

            <button
                type="button"
                class="flex flex-col items-center gap-1 py-2 text-white/75"
                @click="goSection('novedades')"
            >
                <svg
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

                <span class="text-[9px] font-bold">
                    Novedades
                </span>
            </button>

            <button
                type="button"
                class="flex flex-col items-center gap-1 py-2 text-white/75"
                @click="goSection('calculadora')"
            >
                <svg
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

                <span class="text-[9px] font-bold">
                    Calculadora
                </span>
            </button>
        </div>
    </nav>

    <!-- Ventana para modificar el stock exacto. -->
    <Teleport to="body">
        <div
            v-if="showStockModal"
            class="fixed inset-0 z-[130] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
            @click.self="closeStockModal"
        >
            <section class="w-full rounded-t-[28px] bg-white p-5 sm:max-w-[440px] sm:rounded-[28px] sm:p-6">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Actualizar stock
                        </p>

                        <h2 class="mt-1 text-lg font-black text-gray-700">
                            {{ stockProduct?.name }}
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                        @click="closeStockModal"
                    >
                        ×
                    </button>
                </div>

                <label class="mt-6 block">
                    <span class="text-sm font-bold text-gray-600">
                        Cantidad disponible
                    </span>

                    <input
                        v-model.number="stockValue"
                        type="number"
                        min="0"
                        step="1"
                        class="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-gray-700 outline-none focus:border-[#00B4D8]"
                    >
                </label>

                <div class="mt-6 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        class="rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-400"
                        @click="closeStockModal"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        :disabled="
                            stockProduct &&
                            savingStockIds.includes(stockProduct.id)
                        "
                        class="rounded-xl bg-[#00B4D8] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                        @click="saveExactStock"
                    >
                        Guardar
                    </button>
                </div>
            </section>
        </div>
    </Teleport>

    <!-- Formulario completo para crear o editar pedidos. -->
    <Teleport to="body">
        <div
            v-if="showOrderEditor"
            class="fixed inset-0 z-[140] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
            @click.self="closeOrderEditor"
        >
            <section class="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[760px] sm:rounded-[28px]">
                <div class="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Gestión de pedidos
                        </p>

                        <h2 class="text-lg font-black text-gray-700">
                            {{
                                orderEditorMode === "add"
                                    ? "Nuevo pedido"
                                    : "Editar pedido"
                            }}
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                        @click="closeOrderEditor"
                    >
                        ×
                    </button>
                </div>

                <form
                    class="space-y-5 p-5 sm:p-7"
                    @submit.prevent="saveOrder"
                >
                    <!-- Datos del cliente. -->
                    <div class="grid gap-4 sm:grid-cols-2">
                        <label>
                            <span class="mb-1.5 block text-sm font-bold text-gray-600">
                                Nombre del cliente
                            </span>

                            <input
                                v-model="orderForm.customerName"
                                required
                                type="text"
                                placeholder="Ejemplo: María López"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </label>

                        <label>
                            <span class="mb-1.5 block text-sm font-bold text-gray-600">
                                Teléfono o WhatsApp
                            </span>

                            <input
                                v-model="orderForm.customerPhone"
                                type="tel"
                                placeholder="7000 0000"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </label>
                    </div>

                    <label class="block">
                        <span class="mb-1.5 block text-sm font-bold text-gray-600">
                            Estado
                        </span>

                        <select
                            v-model="orderForm.status"
                            class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                            <option
                                v-for="status in orderStatuses"
                                :key="status.value"
                                :value="status.value"
                            >
                                {{ status.label }}
                            </option>
                        </select>
                    </label>

                    <!-- Productos del pedido. -->
                    <div>
                        <div class="flex items-end justify-between gap-4">
                            <div>
                                <p class="text-sm font-bold text-gray-600">
                                    Productos del pedido
                                </p>

                                <p class="mt-1 text-xs text-gray-400">
                                    El precio se carga desde tu catálogo, pero puedes modificarlo.
                                </p>
                            </div>

                            <button
                                type="button"
                                :disabled="!products.length"
                                class="shrink-0 rounded-xl bg-[#CAF0F8] px-4 py-2.5 text-xs font-bold text-[#0077B6] disabled:opacity-50"
                                @click="addOrderItem"
                            >
                                Añadir producto
                            </button>
                        </div>

                        <div
                            v-if="products.length"
                            class="mt-4 space-y-3"
                        >
                            <article
                                v-for="(item, index) in orderForm.items"
                                :key="item.key"
                                class="rounded-2xl bg-[#F8FBFC] p-4"
                            >
                                <div class="grid gap-3 sm:grid-cols-[1fr_100px_130px_38px] sm:items-end">
                                    <label>
                                        <span class="mb-1 block text-xs font-bold text-gray-500">
                                            Producto
                                        </span>

                                        <select
                                            v-model="item.productId"
                                            required
                                            class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#00B4D8]"
                                            @change="selectOrderProduct(item)"
                                        >
                                            <option
                                                disabled
                                                value=""
                                            >
                                                Seleccionar producto
                                            </option>

                                            <option
                                                v-for="product in products"
                                                :key="product.id"
                                                :value="product.id"
                                            >
                                                {{ product.name }} ·
                                                {{ formatPrice(product.price) }}
                                                · Stock {{ product.stock }}
                                            </option>
                                        </select>
                                    </label>

                                    <label>
                                        <span class="mb-1 block text-xs font-bold text-gray-500">
                                            Cantidad
                                        </span>

                                        <input
                                            v-model.number="item.quantity"
                                            required
                                            min="1"
                                            step="1"
                                            type="number"
                                            class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#00B4D8]"
                                        >
                                    </label>

                                    <label>
                                        <span class="mb-1 block text-xs font-bold text-gray-500">
                                            Precio unitario
                                        </span>

                                        <input
                                            v-model.number="item.unitPrice"
                                            required
                                            min="0"
                                            step="0.01"
                                            type="number"
                                            class="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#00B4D8]"
                                        >
                                    </label>

                                    <button
                                        type="button"
                                        aria-label="Quitar producto"
                                        class="flex h-[42px] w-[38px] items-center justify-center rounded-xl bg-red-50 text-xl font-bold text-red-500"
                                        @click="removeOrderItem(index)"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div class="mt-3 flex items-center justify-between text-xs">
                                    <span class="text-gray-400">
                                        Subtotal
                                    </span>

                                    <span class="font-black text-gray-600">
                                        {{
                                            formatPrice(
                                                item.quantity *
                                                item.unitPrice
                                            )
                                        }}
                                    </span>
                                </div>
                            </article>
                        </div>

                        <div
                            v-else
                            class="mt-4 rounded-2xl border border-dashed border-[#90E0EF] bg-[#F8FBFC] px-5 py-8 text-center"
                        >
                            <p class="font-bold text-gray-600">
                                Primero registra un producto
                            </p>

                            <p class="mt-1 text-sm text-gray-400">
                                Los pedidos utilizan productos de tu catálogo.
                            </p>
                        </div>
                    </div>

                    <!-- Notas -->
                    <label class="block">
                        <span class="mb-1.5 block text-sm font-bold text-gray-600">
                            Notas del pedido
                        </span>

                        <textarea
                            v-model="orderForm.notes"
                            rows="3"
                            placeholder="Ejemplo: Entregar el sábado por la mañana."
                            class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        ></textarea>
                    </label>

                    <!-- Total automático -->
                    <div class="flex items-center justify-between rounded-2xl bg-[#EAF9FC] p-5">
                        <div>
                            <p class="text-xs font-bold uppercase tracking-[0.08em] text-[#0077B6]">
                                Total del pedido
                            </p>

                            <p class="mt-1 text-xs text-gray-400">
                                Calculado según precios y cantidades.
                            </p>
                        </div>

                        <p class="text-2xl font-black text-black">
                            {{ formatPrice(orderFormTotal) }}
                        </p>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            class="rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-400"
                            @click="closeOrderEditor"
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            :disabled="
                                orderSaving ||
                                !products.length
                            "
                            class="rounded-xl bg-[#00B4D8] px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                        >
                            {{
                                orderSaving
                                    ? "Guardando..."
                                    : orderEditorMode === "add"
                                        ? "Crear pedido"
                                        : "Guardar cambios"
                            }}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    </Teleport>
</div>
</template>
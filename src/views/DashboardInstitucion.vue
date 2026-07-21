<script setup>
// Panel principal del emprendedor; centraliza perfil, productos, seguidores y vistas de administración.
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient.js";
import {
    uploadEntrepreneurLogo,
    uploadProductImages,
    deleteImage
} from "../lib/storage.js";
import NovedadesEmprendedor from "../components/emprendedor/NovedadesEmprendedor.vue";
const router = useRouter();
// Estados principales utilizados por el dashboard.
const entrepreneur = ref(null);
const products = ref([]);
const loading = ref(true);
const loadError = ref("");
const profileSaving = ref(false);
const productSaving = ref(false);
const logoutLoading = ref(false);
// Controla la sección visible del dashboard.
const activeSection = ref("inicio");
// Control de ventanas.
const showProfileEditor = ref(false);
const showProductEditor = ref(false);
const showFollowersModal = ref(false);
// Datos y controles relacionados con los seguidores.
// Guarda la cantidad total y los datos públicos de quienes siguen al emprendimiento.
const followerCount = ref(0);
const followers = ref([]);
const followersLoading = ref(false);
// Datos y controles utilizados para editar el perfil del emprendimiento.
const profileForm = ref({
    businessName: "",
    phone: "",
    description: "",
    department: "",
    district: ""
});
const profileLogoFile = ref(null);
const profileLogoPreview = ref("");
// Campos utilizados cuando el emprendedor desea cambiar su contraseña.
const currentPassword = ref("");
const newPassword = ref("");
const confirmNewPassword = ref("");
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);
// Datos y controles utilizados para mostrar los productos.
const productEditorMode = ref("add");
const selectedProduct = ref(null);
const productForm = ref({
    name: "",
    description: "",
    categories: [],
    price: 0,
    stock: 0
});
// Aquí mantenemos juntas las imágenes actuales y las nuevas.
// Esto permite cambiar el orden y elegir fácilmente la portada.
const editorImages = ref([]);
// Conserva las imágenes originales para saber cuáles
// fueron eliminadas durante una edición.
const originalProductImages = ref([]);
const showCategoryDropdown = ref(false);
// 12 categorías principales utilizadas dentro de Thrive.
const productCategories = [
    "Alimentos y bebidas",
    "Repostería y dulces",
    "Artesanías",
    "Moda y ropa",
    "Accesorios y joyería",
    "Belleza y cuidado personal",
    "Hogar y decoración",
    "Arte y diseño",
    "Papelería y personalizados",
    "Tecnología y accesorios",
    "Plantas y jardinería",
    "Productos para mascotas"
];
// Datos generales y listas utilizadas en esta pantalla.
const departments = [
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
// Valores calculados automáticamente a partir del estado actual.
const entrepreneurInitials = computed(function () {
    const name = entrepreneur.value?.businessName || "Thrive";
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(function (word) {
            return word.charAt(0).toUpperCase();
        })
        .join("");
});
const productCountText = computed(function () {
    const total = products.value.length;
    return total === 1 ? "1 producto" : `${total} productos`;
});
const productEditorTitle = computed(function () {
    return productEditorMode.value === "add"
        ? "Añadir producto"
        : "Editar producto";
});
const followerCountText = computed(function () {
    return followerCount.value === 1
        ? "1 seguidor"
        : `${followerCount.value} seguidores`;
});
// Funciones pequeñas reutilizadas en distintas partes de la vista.
function formatPrice(price) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
    }).format(Number(price) || 0);
}
// Devuelve las clases visuales correspondientes al nivel de existencias.
function stockClasses(stock) {
    const amount = Number(stock) || 0;
    if (amount > 10) {
        return "bg-green-100 text-green-700";
    }
    if (amount >= 5) {
        return "bg-yellow-100 text-yellow-700";
    }
    return "bg-red-100 text-red-700";
}
// Devuelve el texto que describe el estado actual del inventario.
function stockText(stock) {
    const amount = Number(stock) || 0;
    if (amount === 0) return "Sin stock";
    if (amount === 1) return "1 unidad";
    return `${amount} unidades`;
}
// Cambia la sección visible o abre las herramientas que tienen su propia página.
function changeSection(section) {
    // Inventario tiene su propia vista para gestionar stock y pedidos.
    if (section === "inventario") {
        router.push({ name: "Inventario" });
        return;
    }

    // La calculadora también funciona como una vista independiente.
    if (section === "calculadora") {
        router.push({ name: "Calculadora" });
        return;
    }

    activeSection.value = section;
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}
// Cierra la sesión actual y vuelve a la pantalla de autenticación.
async function logout() {
    if (logoutLoading.value) return;
    logoutLoading.value = true;
    try {
        const { error } = await supabase.auth.signOut({
            scope: "local"
        });
        if (error) {
            throw error;
        }
        // Cerramos cualquier ventana antes de cambiar de pantalla.
        showProfileEditor.value = false;
        showProductEditor.value = false;
        showFollowersModal.value = false;
        document.body.style.overflow = "";
        router.replace("/auth");
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
        alert("No fue posible cerrar la sesión. Intenta nuevamente.");
    } finally {
        logoutLoading.value = false;
    }
}
// Carga la información necesaria para mostrar el dashboard.
async function loadDashboard() {
    loading.value = true;
    loadError.value = "";
    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();
        if (userError || !user) {
            loadError.value =
                "No se encontró una sesión activa. Inicia sesión nuevamente.";
            return;
        }
        // Primero cargamos la información del emprendimiento.
        const { data: entrepreneurData, error: entrepreneurError } =
            await supabase
                .from("entrepreneurs")
                .select(`
                    id,
                    business_name,
                    description,
                    department,
                    district,
                    logo_url
                `)
                .eq("id", user.id)
                .single();
        if (entrepreneurError || !entrepreneurData) {
            console.error(
                "Error al cargar el emprendimiento:",
                entrepreneurError
            );
            loadError.value =
                "No fue posible cargar la información del emprendimiento.";
            return;
        }
        // El teléfono pertenece al perfil general de la cuenta.
        const { data: accountData, error: accountError } =
            await supabase
                .from("profiles")
                .select("phone")
                .eq("id", user.id)
                .single();

        if (accountError) {
            console.warn(
                "No se pudo cargar el teléfono del perfil:",
                accountError
            );
        }

        entrepreneur.value = {
            id: entrepreneurData.id,
            businessName: entrepreneurData.business_name,
            phone: accountData?.phone || "",
            email: user.email || "",
            description: entrepreneurData.description,
            department: entrepreneurData.department,
            district: entrepreneurData.district,
            avatar: entrepreneurData.logo_url
        };
        // Cargamos productos y seguidores reales desde Supabase.
        await Promise.all([
            loadProducts(user.id),
            loadFollowers()
        ]);
    } catch (error) {
        console.error("Error al cargar el dashboard:", error);
        loadError.value =
            "Ocurrió un problema inesperado al cargar el dashboard.";
    } finally {
        loading.value = false;
    }
}
// Obtiene el promedio de reseñas de los productos del emprendedor.
async function loadReviewSummary(productIds) {
    if (!productIds.length) return {};
    const { data, error } = await supabase
        .from("product_reviews")
        .select("product_id, rating")
        .in("product_id", productIds);
    if (error) {
        console.error("No se pudieron cargar las reseñas:", error);
        return {};
    }
    const summary = {};
    for (const review of data || []) {
        if (!summary[review.product_id]) {
            summary[review.product_id] = {
                total: 0,
                count: 0
            };
        }
        summary[review.product_id].total += Number(review.rating) || 0;
        summary[review.product_id].count += 1;
    }
    return summary;
}

// Carga todos los productos pertenecientes al emprendedor.
async function loadProducts(userId) {
    const { data: productRows, error: productError } = await supabase
        .from("products")
        .select(`
            id,
            entrepreneur_id,
            name,
            description,
            categories,
            price,
            stock,
            featured,
            active,
            created_at,
            updated_at
        `)
        .eq("entrepreneur_id", userId)
        .order("created_at", {
            ascending: false
        });

    if (productError) {
        console.error("Error al cargar los productos:", productError);
        throw productError;
    }

    if (!productRows?.length) {
        products.value = [];
        return;
    }

    const productIds = productRows.map(function (product) {
        return product.id;
    });

    const [
        { data: imageRows, error: imageError },
        reviewSummary
    ] = await Promise.all([
        supabase
            .from("product_images")
            .select(`
                id,
                product_id,
                image_url,
                storage_path,
                sort_order
            `)
            .in("product_id", productIds)
            .order("sort_order", {
                ascending: true
            }),
        loadReviewSummary(productIds)
    ]);

    if (imageError) {
        console.error("Error al cargar imágenes:", imageError);
        throw imageError;
    }

    products.value = productRows.map(function (product) {
        const productImages = (imageRows || [])
            .filter(function (image) {
                return image.product_id === product.id;
            })
            .sort(function (a, b) {
                return a.sort_order - b.sort_order;
            })
            .map(function (image) {
                return {
                    id: image.id,
                    imageUrl: image.image_url,
                    storagePath: image.storage_path,
                    sortOrder: image.sort_order
                };
            });

        const reviews = reviewSummary[product.id];

        return {
            id: product.id,
            entrepreneurId: product.entrepreneur_id,
            name: product.name,
            description: product.description || "",
            categories: product.categories || [],
            price: Number(product.price) || 0,
            stock: Number(product.stock) || 0,
            featured: product.featured,
            active: product.active,
            imageRecords: productImages,
            images: productImages.map(function (image) {
                return image.imageUrl;
            }),
            image: productImages[0]?.imageUrl || null,
            averageRating:
                reviews?.count
                    ? reviews.total / reviews.count
                    : 0,
            reviewCount:
                reviews?.count || 0,
            createdAt: product.created_at
        };
    });
}
// Carga y prepara la lista de seguidores del emprendimiento.
async function loadFollowers() {
    followersLoading.value = true;
    try {
        /*
            Esta función RPC devuelve solamente los seguidores
            del emprendimiento que tiene la sesión iniciada.
            Así evitamos abrir profiles públicamente y evitamos
            políticas RLS que se consulten entre sí.
        */
        const { data, error } = await supabase.rpc(
            "get_my_followers"
        );
        if (error) {
            throw error;
        }
        const rows = data || [];
        followerCount.value = rows.length;
        followers.value = rows.map(function (follower) {
            return {
                id: follower.id,
                fullName:
                    follower.full_name ||
                    "Usuario de Thrive",
                avatarUrl:
                    follower.avatar_url || "",
                followedAt:
                    follower.created_at
            };
        });
    } catch (error) {
        console.error(
            "Error al cargar seguidores:",
            error
        );
        followerCount.value = 0;
        followers.value = [];
    } finally {
        followersLoading.value = false;
    }
}
// Genera las iniciales que se muestran cuando un seguidor no tiene foto.
function followerInitials(name) {
    if (!name) return "TH";
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(function (word) {
            return word.charAt(0).toUpperCase();
        })
        .join("");
}
// Abre la ventana con la lista de seguidores.
async function openFollowersModal() {
    if (!entrepreneur.value) return;
    showFollowersModal.value = true;
    document.body.style.overflow = "hidden";
    // Actualizamos la lista cada vez que se abre.
    await loadFollowers();
}
// Cierra la ventana de seguidores.
function closeFollowersModal() {
    showFollowersModal.value = false;
    document.body.style.overflow = "";
}
// Funciones utilizadas para abrir, editar y guardar el perfil.
function openProfileEditor() {
    if (!entrepreneur.value) return;
    profileForm.value = {
        businessName: entrepreneur.value.businessName || "",
        phone: entrepreneur.value.phone || "",
        description: entrepreneur.value.description || "",
        department: entrepreneur.value.department || "",
        district: entrepreneur.value.district || ""
    };
    profileLogoPreview.value =
        entrepreneur.value.avatar || "";
    profileLogoFile.value = null;
    clearPasswordFields();
    showProfileEditor.value = true;
    document.body.style.overflow = "hidden";
}
// Prepara la vista previa del nuevo logo antes de guardarlo.
function handleProfileLogo(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        alert("Selecciona un archivo de imagen válido.");
        event.target.value = "";
        return;
    }
    profileLogoFile.value = file;
    const reader = new FileReader();
    reader.onload = function (loadEvent) {
        profileLogoPreview.value =
            loadEvent.target.result;
    };
    reader.readAsDataURL(file);
}
// Limpia los campos de contraseña para evitar conservar datos anteriores.
function clearPasswordFields() {
    currentPassword.value = "";
    newPassword.value = "";
    confirmNewPassword.value = "";
    showCurrentPassword.value = false;
    showNewPassword.value = false;
    showConfirmPassword.value = false;
}
// Cierra el editor de perfil y limpia sus estados temporales.
function closeProfileEditor() {
    showProfileEditor.value = false;
    profileLogoFile.value = null;
    clearPasswordFields();
    document.body.style.overflow = "";
}
// Valida y guarda los cambios realizados en el perfil del emprendimiento.
async function saveProfile() {
    if (!entrepreneur.value || profileSaving.value) return;
    profileSaving.value = true;
    try {
        const wantsPasswordChange =
            currentPassword.value.length > 0 ||
            newPassword.value.length > 0 ||
            confirmNewPassword.value.length > 0;
        if (wantsPasswordChange) {
            if (
                !currentPassword.value ||
                !newPassword.value ||
                !confirmNewPassword.value
            ) {
                alert(
                    "Para cambiar la contraseña debes completar los tres campos."
                );
                return;
            }
            if (newPassword.value.length < 8) {
                alert(
                    "La nueva contraseña debe tener al menos 8 caracteres."
                );
                return;
            }
            if (
                newPassword.value !==
                confirmNewPassword.value
            ) {
                alert(
                    "Las nuevas contraseñas no coinciden."
                );
                return;
            }
        }
        let logoUrl =
            entrepreneur.value.avatar || null;
        // Si existe una nueva imagen, se sube primero a Storage.
        if (profileLogoFile.value) {
            const uploadedLogo =
                await uploadEntrepreneurLogo(
                    entrepreneur.value.id,
                    profileLogoFile.value
                );
            logoUrl = uploadedLogo.publicUrl;
        }
        // Verificamos la contraseña actual antes de cambiarla.
        if (wantsPasswordChange) {
            const {
                data: { user },
                error: userError
            } = await supabase.auth.getUser();
            if (userError || !user?.email) {
                alert(
                    "No fue posible verificar tu cuenta."
                );
                return;
            }
            const { error: passwordCheckError } =
                await supabase.auth.signInWithPassword({
                    email: user.email,
                    password: currentPassword.value
                });
            if (passwordCheckError) {
                alert(
                    "La contraseña actual es incorrecta."
                );
                return;
            }
        }
        const { data, error } = await supabase
            .from("entrepreneurs")
            .update({
                business_name:
                    profileForm.value.businessName.trim(),
                description:
                    profileForm.value.description.trim(),
                department:
                    profileForm.value.department,
                district:
                    profileForm.value.district.trim(),
                logo_url:
                    logoUrl
            })
            .eq(
                "id",
                entrepreneur.value.id
            )
            .select()
            .single();
        if (error) {
            alert(
                "No fue posible actualizar el perfil: " +
                error.message
            );
            return;
        }

        // El teléfono se guarda en profiles, igual que en la cuenta del cliente.
        const { error: accountUpdateError } =
            await supabase
                .from("profiles")
                .update({
                    phone:
                        profileForm.value.phone.trim()
                })
                .eq(
                    "id",
                    entrepreneur.value.id
                );

        if (accountUpdateError) {
            alert(
                "El emprendimiento se actualizó, pero no fue posible guardar el teléfono: " +
                accountUpdateError.message
            );
            return;
        }

        entrepreneur.value = {
            id: data.id,
            businessName: data.business_name,
            phone: profileForm.value.phone.trim(),
            email: entrepreneur.value.email || "",
            description: data.description,
            department: data.department,
            district: data.district,
            avatar: data.logo_url
        };
        if (wantsPasswordChange) {
            const { error: passwordError } =
                await supabase.auth.updateUser({
                    password: newPassword.value
                });
            if (passwordError) {
                alert(
                    "El perfil se actualizó, pero no fue posible cambiar la contraseña: " +
                    passwordError.message
                );
                return;
            }
        }
        alert("Perfil actualizado correctamente.");
        closeProfileEditor();
    } catch (error) {
        console.error(
            "Error al guardar el perfil:",
            error
        );
        alert(
            "Ocurrió un problema al guardar los cambios."
        );
    } finally {
        profileSaving.value = false;
    }
}
// Controla la selección de categorías del emprendimiento o producto.
function toggleCategory(category) {
    const categories =
        productForm.value.categories;
    const index =
        categories.indexOf(category);
    if (index === -1) {
        categories.push(category);
    } else {
        categories.splice(index, 1);
    }
}
// Comprueba si una categoría ya está seleccionada.
function isCategorySelected(category) {
    return productForm.value.categories.includes(
        category
    );
}
// Prepara el formulario para registrar un producto nuevo.
function openAddProduct() {
    productEditorMode.value = "add";
    selectedProduct.value = null;
    productForm.value = {
        name: "",
        description: "",
        categories: [],
        price: 0,
        stock: 0
    };
    editorImages.value = [];
    originalProductImages.value = [];
    showCategoryDropdown.value = false;
    showProductEditor.value = true;
    document.body.style.overflow = "hidden";
}
// Carga un producto existente dentro del formulario de edición.
function openProductEditor(product) {
    productEditorMode.value = "edit";
    selectedProduct.value = product;
    productForm.value = {
        name: product.name || "",
        description: product.description || "",
        categories: [
            ...(product.categories || [])
        ],
        price: Number(product.price) || 0,
        stock: Number(product.stock) || 0
    };
    /*
        Las imágenes existentes conservan su ID y ruta.
        Así podemos identificar cuáles se mantienen o eliminan.
    */
    editorImages.value = (
        product.imageRecords || []
    ).map(function (image) {
        return {
            kind: "existing",
            id: image.id,
            imageUrl: image.imageUrl,
            storagePath: image.storagePath,
            preview: image.imageUrl
        };
    });
    originalProductImages.value =
        editorImages.value.map(function (image) {
            return {
                ...image
            };
        });
    showCategoryDropdown.value = false;
    showProductEditor.value = true;
    document.body.style.overflow = "hidden";
}
// Convierte un archivo en una vista previa.
function fileToPreview(file) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function (event) {
            resolve(event.target.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
// Permite añadir varias fotografías sin borrar las anteriores.
async function handleProductImages(event) {
    const files = Array.from(
        event.target.files || []
    );
    if (!files.length) return;
    const validFiles = [];
    for (const file of files) {
        if (!file.type.startsWith("image/")) {
            continue;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert(
                `${file.name} supera el límite de 5 MB.`
            );
            continue;
        }
        validFiles.push(file);
    }
    const newImages =
        await Promise.all(
            validFiles.map(
                async function (file, index) {
                    const preview =
                        await fileToPreview(file);
                    return {
                        kind: "new",
                        key:
                            `${Date.now()}-${index}-${file.name}`,
                        file,
                        preview
                    };
                }
            )
        );
    editorImages.value.push(...newImages);
    // Permite seleccionar nuevamente los mismos archivos.
    event.target.value = "";
}
// Elimina una imagen únicamente del formulario.
// La eliminación real ocurre cuando se guardan los cambios.
function removeProductImage(index) {
    editorImages.value.splice(index, 1);
}
// Convierte cualquier fotografía en la portada.
function makeProductImageCover(index) {
    if (index === 0) return;
    const [image] =
        editorImages.value.splice(index, 1);
    editorImages.value.unshift(image);
}
// Cierra el formulario de producto y limpia los datos temporales.
function closeProductEditor() {
    showProductEditor.value = false;
    selectedProduct.value = null;
    editorImages.value = [];
    originalProductImages.value = [];
    showCategoryDropdown.value = false;
    document.body.style.overflow = "";
}
// Guarda un producto nuevo o actualiza uno existente.
async function saveProduct() {
    if (productSaving.value) return;
    if (!productForm.value.categories.length) {
        alert(
            "Selecciona al menos una categoría."
        );
        return;
    }
    productSaving.value = true;
    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();
        if (userError || !user) {
            alert(
                "No se encontró una sesión activa."
            );
            return;
        }
        if (productEditorMode.value === "add") {
            await createProduct(user);
        } else {
            await updateProduct(user);
        }
        await loadProducts(user.id);
        alert(
            productEditorMode.value === "add"
                ? "Producto publicado correctamente."
                : "Producto actualizado correctamente."
        );
        closeProductEditor();
    } catch (error) {
        console.error(
            "Error al guardar el producto:",
            error
        );
        alert(
            "No fue posible guardar el producto: " +
            error.message
        );
    } finally {
        productSaving.value = false;
    }
}
// Crea el registro principal y después almacena sus fotografías.
async function createProduct(user) {
    const { data: newProduct, error: productError } =
        await supabase
            .from("products")
            .insert({
                entrepreneur_id: user.id,
                name: productForm.value.name.trim(),
                description: productForm.value.description.trim(),
                categories: productForm.value.categories,
                price: Number(productForm.value.price) || 0,
                stock: Number(productForm.value.stock) || 0,
                featured: false,
                active: true
            })
            .select()
            .single();
    if (productError) {
        throw productError;
    }
    const newImages = editorImages.value.filter(function (image) {
        return image.kind === "new";
    });
    if (!newImages.length) {
        return;
    }
    let uploadedImages = [];
    try {
        // Subimos todas las imágenes al Storage del producto.
        uploadedImages = await uploadProductImages(
            user.id,
            newProduct.id,
            newImages.map(function (image) {
                return image.file;
            })
        );
        const imageRows = uploadedImages.map(function (image, index) {
            return {
                product_id: newProduct.id,
                image_url: image.publicUrl,
                storage_path: image.path,
                sort_order: index
            };
        });
        const { error: imageError } = await supabase
            .from("product_images")
            .insert(imageRows);
        if (imageError) {
            throw imageError;
        }
    } catch (error) {
        /*
            Si algo falla después de subir fotografías, limpiamos
            los archivos nuevos para no dejar imágenes huérfanas.
        */
        for (const image of uploadedImages) {
            try {
                await deleteImage(image.path);
            } catch (cleanupError) {
                console.warn(
                    "No se pudo limpiar una imagen subida:",
                    cleanupError
                );
            }
        }
        /*
            Como el producto todavía no terminó de crearse correctamente,
            eliminamos también su registro. product_images se elimina en
            cascada si ya se alcanzó a insertar alguna fila.
        */
        try {
            await supabase
                .from("products")
                .delete()
                .eq("id", newProduct.id);
        } catch (cleanupError) {
            console.warn(
                "No se pudo limpiar el producto incompleto:",
                cleanupError
            );
        }
        throw error;
    }
}
// Actualiza el producto y sincroniza por completo sus fotografías.
async function updateProduct(user) {
    if (!selectedProduct.value) {
        throw new Error(
            "No se encontró el producto seleccionado."
        );
    }
    const productId = selectedProduct.value.id;
    // Actualizamos primero la información principal del producto.
    const { error: updateError } = await supabase
        .from("products")
        .update({
            name: productForm.value.name.trim(),
            description: productForm.value.description.trim(),
            categories: productForm.value.categories,
            price: Number(productForm.value.price) || 0,
            stock: Number(productForm.value.stock) || 0,
            updated_at: new Date().toISOString()
        })
        .eq("id", productId);
    if (updateError) {
        throw updateError;
    }
    /*
        Comparamos las imágenes que existían al abrir el editor
        con las que todavía siguen presentes cuando el usuario guarda.
    */
    const currentExistingIds = editorImages.value
        .filter(function (image) {
            return image.kind === "existing";
        })
        .map(function (image) {
            return image.id;
        });
    const removedImages = originalProductImages.value.filter(
        function (image) {
            return !currentExistingIds.includes(image.id);
        }
    );
    const newImages = editorImages.value.filter(function (image) {
        return image.kind === "new";
    });
    let uploadedImages = [];
    let insertedImageIds = [];
    try {
        // 1. Subimos primero las fotografías nuevas.
        if (newImages.length) {
            uploadedImages = await uploadProductImages(
                user.id,
                productId,
                newImages.map(function (image) {
                    return image.file;
                })
            );
        }
        /*
            2. Construimos las filas nuevas respetando exactamente
            el orden visual del editor. La posición 0 será la portada.
        */
        let uploadedIndex = 0;
        const newImageRows = [];
        for (
            let index = 0;
            index < editorImages.value.length;
            index++
        ) {
            const image = editorImages.value[index];
            if (image.kind === "new") {
                const uploaded = uploadedImages[uploadedIndex];
                if (uploaded) {
                    newImageRows.push({
                        product_id: productId,
                        image_url: uploaded.publicUrl,
                        storage_path: uploaded.path,
                        sort_order: index
                    });
                }
                uploadedIndex++;
            }
        }
        // 3. Registramos las imágenes nuevas en product_images.
        if (newImageRows.length) {
            const { data: insertedRows, error: insertError } =
                await supabase
                    .from("product_images")
                    .insert(newImageRows)
                    .select("id");
            if (insertError) {
                throw insertError;
            }
            insertedImageIds = (insertedRows || []).map(function (row) {
                return row.id;
            });
        }
        /*
            4. Actualizamos el orden de las fotografías que ya existían.
            Esto también permite cambiar cuál imagen es la portada.
        */
        for (
            let index = 0;
            index < editorImages.value.length;
            index++
        ) {
            const image = editorImages.value[index];
            if (image.kind !== "existing") {
                continue;
            }
            const { error: orderError } = await supabase
                .from("product_images")
                .update({
                    sort_order: index
                })
                .eq("id", image.id);
            if (orderError) {
                throw orderError;
            }
        }
        /*
            5. Las fotografías quitadas del editor se eliminan
            definitivamente de la tabla product_images.
        */
        if (removedImages.length) {
            const removedIds = removedImages.map(function (image) {
                return image.id;
            });
            const { error: deleteRowsError } = await supabase
                .from("product_images")
                .delete()
                .in("id", removedIds);
            if (deleteRowsError) {
                throw deleteRowsError;
            }
            /*
                6. Después de eliminar sus filas, borramos también
                los archivos físicos del bucket thrive-images.
            */
            for (const image of removedImages) {
                try {
                    await deleteImage(image.storagePath);
                } catch (storageDeleteError) {
                    /*
                        La fila ya se eliminó de la base de datos.
                        Si Storage falla, dejamos una advertencia en consola
                        sin romper la actualización completa del producto.
                    */
                    console.warn(
                        "La imagen se eliminó de la base de datos, pero no del Storage:",
                        storageDeleteError
                    );
                }
            }
        }
    } catch (error) {
        /*
            Si las fotografías nuevas se subieron pero la sincronización
            de la base de datos falla, intentamos retirar esas nuevas
            fotografías y sus filas para evitar archivos duplicados.
        */
        if (insertedImageIds.length) {
            try {
                await supabase
                    .from("product_images")
                    .delete()
                    .in("id", insertedImageIds);
            } catch (cleanupError) {
                console.warn(
                    "No se pudieron limpiar las filas nuevas:",
                    cleanupError
                );
            }
        }
        for (const image of uploadedImages) {
            try {
                await deleteImage(image.path);
            } catch (cleanupError) {
                console.warn(
                    "No se pudo limpiar una imagen nueva:",
                    cleanupError
                );
            }
        }
        throw error;
    }
}
// Abre el producto en la pantalla independiente de detalle.
function openProductDetail(product) {
    if (!product?.id) return;
    router.push({
        name: "DetalleProducto",
        params: {
            id: product.id
        }
    });
}
// Maneja accesos rápidos del teclado para cerrar ventanas.
function handleEscape(event) {
    if (event.key !== "Escape") return;
    if (showFollowersModal.value) {
        closeFollowersModal();
        return;
    }
    if (showProductEditor.value) {
        closeProductEditor();
        return;
    }
    if (showProfileEditor.value) {
        closeProfileEditor();
    }
}
onMounted(function () {
    // Al regresar desde Inventario o Calculadora podemos volver directamente a Inicio o Novedades.
    const pendingSection = sessionStorage.getItem("thriveDashboardSection");
    if (["inicio", "novedades"].includes(pendingSection)) {
        activeSection.value = pendingSection;
        sessionStorage.removeItem("thriveDashboardSection");
    }

    loadDashboard();
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
<div class="min-h-screen bg-[#F8FBFC] pb-[76px] text-gray-700 lg:pb-0">
    <!-- Cabecera. En móvil conserva la vista original y en laptop funciona como navegación principal. -->
    <header class="sticky top-0 z-40 bg-[#F8FBFC]">
        <div class="mx-auto max-w-[1450px] px-2 pt-2 sm:px-5 lg:px-8 lg:pt-4">
            <!-- Cabecera móvil: mantiene el nombre y los accesos rápidos de la aplicación. -->
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

            <!-- Navbar principal para laptop. La antigua isla azul ahora sí se utiliza para navegar. -->
            <nav class="hidden items-center justify-center gap-2 rounded-[24px] bg-[#00B4D8] p-2 shadow-sm lg:flex">
                <button
                    v-for="item in [
                        ['inicio', 'Inicio'],
                        ['inventario', 'Inventario'],
                        ['novedades', 'Novedades'],
                        ['calculadora', 'Calculadora']
                    ]"
                    :key="item[0]"
                    type="button"
                    class="rounded-full px-6 py-2.5 text-sm font-bold transition"
                    :class="activeSection === item[0] ? 'bg-white text-[#0077B6] shadow-sm' : 'text-white/85 hover:bg-white/15 hover:text-white'"
                    @click="changeSection(item[0])"
                >
                    {{ item[1] }}
                </button>
            </nav>
        </div>
    </header>
    <!-- Cargando. -->
    <main
        v-if="loading"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center"
    >
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        <p class="mt-4 text-sm font-semibold text-gray-400">
            Cargando tu emprendimiento...
        </p>
    </main>
    <!-- Error. -->
    <main
        v-else-if="loadError"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center"
    >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 font-black text-red-600">
            !
        </div>
        <p class="mt-4 font-black text-gray-700">
            No pudimos cargar el dashboard
        </p>
        <p class="mt-2 text-sm text-gray-400">
            {{ loadError }}
        </p>
        <button
            type="button"
            class="mt-5 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white"
            @click="loadDashboard"
        >
            Intentar nuevamente
        </button>
    </main>
    <!-- Contenido. -->
    <main
        v-else-if="entrepreneur"
        class="mx-auto max-w-[1450px] px-3 pb-10 pt-3 sm:px-5 lg:px-8"
    >
        <!-- INICIO -->
        <section v-if="activeSection === 'inicio'">
            <!-- Perfil -->
            <section class="rounded-[24px] bg-white p-5 shadow-sm sm:p-7">
                <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div class="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
                        <img
                            v-if="entrepreneur.avatar"
                            :src="entrepreneur.avatar"
                            :alt="entrepreneur.businessName"
                            class="h-24 w-24 rounded-full border-4 border-[#CAF0F8] object-cover sm:h-28 sm:w-28"
                        >
                        <div
                            v-else
                            class="flex h-24 w-24 items-center justify-center rounded-full border-4 border-[#CAF0F8] bg-[#EAF9FC] text-2xl font-black text-[#0077B6] sm:h-28 sm:w-28"
                        >
                            {{ entrepreneurInitials }}
                        </div>
                        <div>
                            <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                                Mi emprendimiento
                            </p>
                            <h1 class="mt-1 text-2xl font-black text-gray-700 sm:text-3xl">
                                {{ entrepreneur.businessName }}
                            </h1>
                            <p class="mt-1 text-sm text-gray-400">
                                {{ entrepreneur.district }},
                                {{ entrepreneur.department }}
                            </p>
                            <p class="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
                                {{ entrepreneur.description }}
                            </p>
                            <!-- Seguidores -->
                            <button
                                type="button"
                                class="mt-4 inline-flex items-center gap-2 rounded-full bg-[#EAF9FC] px-4 py-2 text-left transition hover:bg-[#CAF0F8]"
                                @click="openFollowersModal"
                            >
                                <span class="text-base font-black text-[#0077B6]">
                                    {{ followerCount }}
                                </span>
                                <span class="text-xs font-bold text-[#4F7180]">
                                    {{ followerCount === 1 ? "seguidor" : "seguidores" }}
                                </span>
                            </button>
                        </div>
                    </div>
                    <div class="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                        <button
                            type="button"
                            class="w-full rounded-xl border border-[#00B4D8] px-5 py-3 text-sm font-bold text-[#0077B6] transition hover:bg-[#CAF0F8] lg:w-auto"
                            @click="openProfileEditor"
                        >
                            Editar perfil
                        </button>
                        <button
                            type="button"
                            :disabled="logoutLoading"
                            class="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
                            @click="logout"
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
                                    stroke-linejoin="round"
                                    d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 012 2v12a2 2 0 01-2 2h-5"
                                ></path>
                            </svg>
                            {{ logoutLoading ? "Cerrando..." : "Cerrar sesión" }}
                        </button>
                    </div>
                </div>
            </section>
            <!-- Productos -->
            <section class="mt-7">
                <div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Mi catálogo
                        </p>
                        <h2 class="mt-1 text-2xl font-black text-gray-700">
                            Mis productos
                        </h2>
                        <p class="mt-1 text-sm text-gray-400">
                            {{ productCountText }}
                        </p>
                    </div>
                    <button
                        type="button"
                        class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#009CC0] sm:w-auto"
                        @click="openAddProduct"
                    >
                        <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" d="M12 5v14M5 12h14"></path>
                        </svg>
                        Añadir producto
                    </button>
                </div>
                <!-- Productos con el mismo estilo limpio del catálogo -->
                <div
                    v-if="products.length"
                    class="grid grid-cols-2 gap-x-2 gap-y-5 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
                >
                    <article
                        v-for="product in products"
                        :key="product.id"
                        class="min-w-0 overflow-hidden bg-transparent"
                    >
                        <button
                            type="button"
                            class="block w-full overflow-hidden rounded-xl bg-gray-100 sm:rounded-2xl"
                            @click="openProductDetail(product)"
                        >
                            <img
                                v-if="product.image"
                                :src="product.image"
                                :alt="product.name"
                                class="aspect-square w-full object-cover"
                            >
                            <div
                                v-else
                                class="flex aspect-square items-center justify-center text-xs font-bold text-gray-400"
                            >
                                Sin fotografía
                            </div>
                        </button>
                        <div class="pt-1.5 sm:px-1 sm:pt-3">
                            <div class="mb-1 flex flex-wrap gap-1">
                                <span
                                    v-for="category in product.categories.slice(0, 1)"
                                    :key="category"
                                    class="text-[9px] font-bold uppercase text-[#00B4D8]"
                                >
                                    {{ category }}
                                </span>
                                <span
                                    v-if="product.categories.length > 1"
                                    class="text-[9px] font-bold text-gray-400"
                                >
                                    +{{ product.categories.length - 1 }}
                                </span>
                            </div>
                            <h3 class="line-clamp-2 min-h-[34px] text-xs font-bold leading-tight text-gray-600 sm:min-h-[40px] sm:text-sm">
                                {{ product.name }}
                            </h3>
                            <div class="mt-1 flex items-center gap-1 text-[10px] sm:text-xs">
                                <span class="text-amber-500">★</span>
                                <span class="font-bold text-gray-600">
                                    {{ Number(product.averageRating).toFixed(1) }}
                                </span>
                                <span class="text-gray-400">
                                    {{ product.reviewCount }} reseñas
                                </span>
                            </div>
                            <div class="mt-2 flex items-center justify-between gap-2">
                                <p class="text-base font-black text-[#4F7180] sm:text-xl">
                                    {{ formatPrice(product.price) }}
                                </p>
                                <span
                                    class="rounded-full px-2 py-1 text-[9px] font-bold sm:text-[10px]"
                                    :class="stockClasses(product.stock)"
                                >
                                    {{ stockText(product.stock) }}
                                </span>
                            </div>
                            <div class="mt-3 grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    class="rounded-xl border border-gray-200 px-2 py-2 text-[10px] font-bold text-gray-500 sm:text-xs"
                                    @click="openProductDetail(product)"
                                >
                                    Ver detalle
                                </button>
                                <button
                                    type="button"
                                    class="rounded-xl bg-[#CAF0F8] px-2 py-2 text-[10px] font-bold text-[#0077B6] sm:text-xs"
                                    @click="openProductEditor(product)"
                                >
                                    Editar
                                </button>
                            </div>
                        </div>
                    </article>
                </div>
                <!-- Sin productos -->
                <div
                    v-else
                    class="rounded-[24px] border border-dashed border-[#90E0EF] bg-white px-5 py-16 text-center"
                >
                    <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#CAF0F8] text-[#0077B6]">
                        <svg class="h-7 w-7" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                            <path d="M4 7l8-4 8 4-8 4-8-4z"></path>
                            <path d="M4 7v10l8 4 8-4V7"></path>
                            <path d="M12 11v10"></path>
                        </svg>
                    </div>
                    <h3 class="mt-4 font-black text-gray-700">
                        Tu catálogo está vacío
                    </h3>
                    <p class="mt-1 text-sm text-gray-400">
                        Publica tu primer producto para comenzar.
                    </p>
                    <button
                        type="button"
                        class="mt-5 rounded-xl bg-[#00B4D8] px-6 py-3 text-sm font-bold text-white"
                        @click="openAddProduct"
                    >
                        Añadir mi primer producto
                    </button>
                </div>
            </section>
        </section>
        <!-- Las novedades institucionales viven en un componente independiente. -->
        <NovedadesEmprendedor
            v-else-if="activeSection === 'novedades'"
        />
    </main>
    <!-- Menú móvil. -->
    <nav class="fixed rounded-t-[28px] inset-x-0 bottom-0 z-50 border-t border-white/20 bg-[#00B4D8] shadow-[0_-6px_20px_rgba(0,0,0,0.12)] lg:hidden">
        <div class="mx-auto grid max-w-lg grid-cols-4">
            <!-- Inicio -->
            <button
                type="button"
                class="flex flex-col items-center gap-1 py-2 text-white"
                :class="activeSection === 'inicio' ? 'bg-white/15' : 'text-white/75'"
                @click="changeSection('inicio')"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M3 11l9-8 9 8"></path>
                    <path d="M5 10v10h14V10"></path>
                </svg>
                <span class="text-[9px] font-bold">
                    Inicio
                </span>
            </button>
            <!-- Inventario -->
            <button
                type="button"
                class="flex flex-col items-center gap-1 py-2 text-white"
                :class="activeSection === 'inventario' ? 'bg-white/15' : 'text-white/75'"
                @click="changeSection('inventario')"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M4 7l8-4 8 4-8 4-8-4z"></path>
                    <path d="M4 7v10l8 4 8-4V7"></path>
                </svg>
                <span class="text-[9px] font-bold">
                    Inventario
                </span>
            </button>
            <!-- Novedades -->
            <button
                type="button"
                class="flex flex-col items-center gap-1 py-2 text-white"
                :class="activeSection === 'novedades' ? 'bg-white/15' : 'text-white/75'"
                @click="changeSection('novedades')"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" d="M18 8a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
                </svg>
                <span class="text-[9px] font-bold">
                    Novedades
                </span>
            </button>
            <!-- Calculadora -->
            <button
                type="button"
                class="flex flex-col items-center gap-1 py-2 text-white"
                :class="activeSection === 'calculadora' ? 'bg-white/15' : 'text-white/75'"
                @click="changeSection('calculadora')"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <rect x="5" y="3" width="14" height="18" rx="2"></rect>
                    <path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"></path>
                </svg>
                <span class="text-[9px] font-bold">
                    Calculadora
                </span>
            </button>
        </div>
    </nav>
    <!-- Seguidores. -->
    <Teleport to="body">
        <div
            v-if="showFollowersModal"
            class="fixed inset-0 z-[130] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
            @click.self="closeFollowersModal"
        >
            <section class="max-h-[85vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[520px] sm:rounded-[28px]">
                <!-- Cabecera -->
                <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Comunidad
                        </p>
                        <h2 class="text-lg font-black text-gray-700">
                            Seguidores
                        </h2>
                        <p class="mt-0.5 text-xs text-gray-400">
                            {{ followerCountText }}
                        </p>
                    </div>
                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                        @click="closeFollowersModal"
                    >
                        ×
                    </button>
                </div>
                <!-- Cargando -->
                <div
                    v-if="followersLoading"
                    class="px-5 py-14 text-center"
                >
                    <div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
                    <p class="mt-3 text-sm font-semibold text-gray-400">
                        Cargando seguidores...
                    </p>
                </div>
                <!-- Sin seguidores -->
                <div
                    v-else-if="!followers.length"
                    class="px-5 py-14 text-center"
                >
                    <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#CAF0F8] text-[#0077B6]">
                        <svg
                            class="h-7 w-7"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            viewBox="0 0 24 24"
                        >
                            <circle cx="9" cy="8" r="3"></circle>
                            <circle cx="17" cy="9" r="2"></circle>
                            <path stroke-linecap="round" d="M3 20a6 6 0 0112 0M14 20a4 4 0 018 0"></path>
                        </svg>
                    </div>
                    <h3 class="mt-4 font-black text-gray-700">
                        Aún no tienes seguidores
                    </h3>
                    <p class="mt-1 text-sm text-gray-400">
                        Aquí aparecerán las personas que sigan tu emprendimiento.
                    </p>
                </div>
                <!-- Lista de seguidores -->
                <div
                    v-else
                    class="divide-y divide-gray-100 px-5 py-2"
                >
                    <div
                        v-for="follower in followers"
                        :key="follower.id"
                        class="flex items-center gap-3 py-3"
                    >
                        <img
                            v-if="follower.avatarUrl"
                            :src="follower.avatarUrl"
                            :alt="follower.fullName"
                            class="h-11 w-11 shrink-0 rounded-full border border-gray-100 object-cover"
                        >
                        <div
                            v-else
                            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#CAF0F8] text-xs font-black text-[#0077B6]"
                        >
                            {{ followerInitials(follower.fullName) }}
                        </div>
                        <div class="min-w-0">
                            <p class="truncate text-sm font-bold text-gray-700">
                                {{ follower.fullName }}
                            </p>
                            <p class="text-xs text-gray-400">
                                Sigue tu emprendimiento
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    </Teleport>
    <!-- Editar perfil. -->
    <Teleport to="body">
        <div
            v-if="showProfileEditor"
            class="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
            @click.self="closeProfileEditor"
        >
            <section class="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[620px] sm:rounded-[28px]">
                <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Mi emprendimiento
                        </p>
                        <h2 class="text-lg font-black text-gray-700">
                            Editar perfil
                        </h2>
                    </div>
                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                        @click="closeProfileEditor"
                    >
                        ×
                    </button>
                </div>
                <form
                    class="space-y-5 p-5 sm:p-7"
                    @submit.prevent="saveProfile"
                >
                    <!-- Foto -->
                    <div>
                        <label class="mb-3 block text-sm font-bold text-gray-600">
                            Foto del emprendimiento
                        </label>
                        <div class="flex flex-col items-center gap-4 sm:flex-row">
                            <img
                                v-if="profileLogoPreview"
                                :src="profileLogoPreview"
                                alt="Foto del emprendimiento"
                                class="h-24 w-24 rounded-full border-4 border-[#CAF0F8] object-cover"
                            >
                            <div
                                v-else
                                class="flex h-24 w-24 items-center justify-center rounded-full bg-[#CAF0F8] text-xl font-black text-[#0077B6]"
                            >
                                {{ entrepreneurInitials }}
                            </div>
                            <label class="cursor-pointer rounded-xl border border-[#00B4D8] px-4 py-2.5 text-sm font-bold text-[#0077B6] hover:bg-[#CAF0F8]">
                                Cambiar foto
                                <input
                                    type="file"
                                    accept="image/*"
                                    class="hidden"
                                    @change="handleProfileLogo"
                                >
                            </label>
                        </div>
                    </div>
                    <!-- Nombre -->
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Nombre del emprendimiento
                        </label>
                        <input
                            v-model="profileForm.businessName"
                            required
                            type="text"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                    </div>
                    <!-- Datos generales de la cuenta, iguales al perfil del cliente. -->
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Correo electrónico
                        </label>
                        <input
                            :value="entrepreneur?.email"
                            disabled
                            type="email"
                            class="w-full cursor-not-allowed rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-gray-400 outline-none"
                        >
                        <p class="mt-1 text-xs text-gray-400">
                            El correo pertenece a tu cuenta de acceso.
                        </p>
                    </div>

                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Teléfono
                        </label>
                        <input
                            v-model="profileForm.phone"
                            type="tel"
                            autocomplete="tel"
                            placeholder="0000 0000"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                    </div>
                    <!-- Descripción -->
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Descripción
                        </label>
                        <textarea
                            v-model="profileForm.description"
                            required
                            rows="4"
                            class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        ></textarea>
                    </div>
                    <!-- Ubicación -->
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Departamento
                            </label>
                            <select
                                v-model="profileForm.department"
                                required
                                class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#00B4D8]"
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
                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Distrito
                            </label>
                            <input
                                v-model="profileForm.district"
                                required
                                type="text"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>
                    </div>
                    <!-- Contraseña -->
                    <div class="border-t border-gray-100 pt-5">
                        <h3 class="font-black text-gray-700">
                            Cambiar contraseña
                        </h3>
                        <p class="mt-1 text-xs text-gray-400">
                            Deja estos campos vacíos si no deseas cambiarla.
                        </p>
                        <div class="mt-4 space-y-3">
                            <input
                                v-model="currentPassword"
                                :type="showCurrentPassword ? 'text' : 'password'"
                                autocomplete="current-password"
                                placeholder="Contraseña actual"
                                class="password-field w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                            <input
                                v-model="newPassword"
                                :type="showNewPassword ? 'text' : 'password'"
                                autocomplete="new-password"
                                placeholder="Nueva contraseña"
                                class="password-field w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                            <input
                                v-model="confirmNewPassword"
                                :type="showConfirmPassword ? 'text' : 'password'"
                                autocomplete="new-password"
                                placeholder="Confirmar nueva contraseña"
                                class="password-field w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>
                    </div>
                    <button
                        type="submit"
                        :disabled="profileSaving"
                        class="w-full rounded-xl bg-[#00B4D8] px-5 py-3 font-bold text-white disabled:opacity-50"
                    >
                        {{ profileSaving ? "Guardando..." : "Guardar cambios" }}
                    </button>
                </form>
            </section>
        </div>
    </Teleport>
    <!-- Crear / editar producto. -->
    <Teleport to="body">
        <div
            v-if="showProductEditor"
            class="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
            @click.self="closeProductEditor"
        >
            <section class="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[700px] sm:rounded-[28px]">
                <div class="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Mi catálogo
                        </p>
                        <h2 class="text-lg font-black text-gray-700">
                            {{ productEditorTitle }}
                        </h2>
                    </div>
                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                        @click="closeProductEditor"
                    >
                        ×
                    </button>
                </div>
                <form
                    class="space-y-5 p-5 sm:p-7"
                    @submit.prevent="saveProduct"
                >
                    <!-- Fotografías -->
                    <div>
                        <label class="block text-sm font-bold text-gray-600">
                            Fotografías
                        </label>
                        <p class="mt-1 text-xs text-gray-400">
                            La primera fotografía será la portada del producto.
                        </p>
                        <div
                            v-if="editorImages.length"
                            class="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4"
                        >
                            <div
                                v-for="(image, index) in editorImages"
                                :key="image.id || image.key"
                                class="relative overflow-hidden rounded-xl bg-gray-100"
                            >
                                <img
                                    :src="image.preview"
                                    alt="Producto"
                                    class="aspect-square w-full object-cover"
                                >
                                <span
                                    v-if="index === 0"
                                    class="absolute bottom-1 left-1 rounded-full bg-[#00B4D8] px-2 py-1 text-[9px] font-bold text-white"
                                >
                                    Portada
                                </span>
                                <div class="absolute right-1 top-1 flex gap-1">
                                    <button
                                        v-if="index !== 0"
                                        type="button"
                                        title="Hacer portada"
                                        class="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#0077B6] shadow"
                                        @click="makeProductImageCover(index)"
                                    >
                                        ★
                                    </button>
                                    <button
                                        type="button"
                                        title="Eliminar"
                                        class="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                                        @click="removeProductImage(index)"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        </div>
                        <label class="mt-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[#90E0EF] bg-[#F7FCFD] px-4 py-5 text-sm font-bold text-[#0077B6] transition hover:bg-[#CAF0F8]">
                            Añadir fotografías
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                class="hidden"
                                @change="handleProductImages"
                            >
                        </label>
                    </div>
                    <!-- Nombre -->
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Nombre del producto
                        </label>
                        <input
                            v-model="productForm.name"
                            required
                            type="text"
                            placeholder="Ejemplo: Muñeco tejido personalizado"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                    </div>
                    <!-- Categorías múltiples -->
                    <div class="relative">
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Categorías
                        </label>
                        <button
                            type="button"
                            class="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm outline-none hover:border-[#00B4D8]"
                            @click="showCategoryDropdown = !showCategoryDropdown"
                        >
                            <span
                                :class="
                                    productForm.categories.length
                                        ? 'text-gray-600'
                                        : 'text-gray-400'
                                "
                            >
                                {{
                                    productForm.categories.length
                                        ? `${productForm.categories.length} categorías seleccionadas`
                                        : "Seleccionar categorías"
                                }}
                            </span>
                            <span class="text-gray-400">
                                ▼
                            </span>
                        </button>
                        <div
                            v-if="showCategoryDropdown"
                            class="absolute left-0 right-0 z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-gray-100 bg-white p-2 shadow-xl"
                        >
                            <button
                                v-for="category in productCategories"
                                :key="category"
                                type="button"
                                class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-[#F1FAFC]"
                                @click="toggleCategory(category)"
                            >
                                <span
                                    class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border"
                                    :class="
                                        isCategorySelected(category)
                                            ? 'border-[#00B4D8] bg-[#00B4D8] text-white'
                                            : 'border-gray-300'
                                    "
                                >
                                    <span v-if="isCategorySelected(category)">
                                        ✓
                                    </span>
                                </span>
                                {{ category }}
                            </button>
                        </div>
                        <!-- Categorías seleccionadas -->
                        <div
                            v-if="productForm.categories.length"
                            class="mt-3 flex flex-wrap gap-2"
                        >
                            <button
                                v-for="category in productForm.categories"
                                :key="category"
                                type="button"
                                class="rounded-full bg-[#CAF0F8] px-3 py-1.5 text-xs font-bold text-[#0077B6]"
                                @click="toggleCategory(category)"
                            >
                                {{ category }} ×
                            </button>
                        </div>
                    </div>
                    <!-- Precio y stock -->
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Precio
                            </label>
                            <input
                                v-model.number="productForm.price"
                                required
                                min="0"
                                step="0.01"
                                type="number"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>
                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Stock
                            </label>
                            <input
                                v-model.number="productForm.stock"
                                required
                                min="0"
                                type="number"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>
                    </div>
                    <!-- Descripción -->
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Descripción
                        </label>
                        <textarea
                            v-model="productForm.description"
                            rows="4"
                            placeholder="Describe tu producto..."
                            class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        ></textarea>
                    </div>
                    <button
                        type="submit"
                        :disabled="productSaving"
                        class="w-full rounded-xl bg-[#00B4D8] px-5 py-3.5 font-bold text-white transition hover:bg-[#009CC0] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {{
                            productSaving
                                ? "Guardando producto..."
                                : productEditorMode === "add"
                                    ? "Publicar producto"
                                    : "Guardar cambios"
                        }}
                    </button>
                </form>
            </section>
        </div>
    </Teleport>
</div>
</template>
<style scoped>
.password-field::-ms-reveal,
.password-field::-ms-clear {
    display: none;
    width: 0;
    height: 0;
}
/* Evita que el texto largo desborde las tarjetas. */
.line-clamp-2 {
    display: -webkit-box;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
}
</style>
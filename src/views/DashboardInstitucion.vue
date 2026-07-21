<script setup>
// Panel principal de instituciones; administra perfil, publicaciones e información de emprendedores.
import {
    ref,
    computed,
    onMounted,
    onBeforeUnmount
} from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../lib/supabaseClient";

const router = useRouter();
const bucketName = "thrive-images";

// Estados generales.
const institution = ref(null);
const posts = ref([]);
const entrepreneurs = ref([]);
const loading = ref(true);
const loadError = ref("");
const activeSection = ref("inicio");
const logoutLoading = ref(false);

// Ventanas del panel.
const showProfileEditor = ref(false);
const showPostEditor = ref(false);
const showPostPreview = ref(false);

// Perfil institucional.
const profileSaving = ref(false);
const profileLogoFile = ref(null);
const profileLogoPreview = ref("");
const profileForm = ref({
    institutionName: "",
    phone: "",
    website: "",
    description: "",
    department: "",
    district: ""
});

// Cambio opcional de contraseña.
const currentPassword = ref("");
const newPassword = ref("");
const confirmNewPassword = ref("");
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

// Publicaciones.
const postSaving = ref(false);
const postEditorMode = ref("add");
const selectedPost = ref(null);
const postForm = ref({
    title: "",
    description: "",
    postType: "noticia",
    location: "",
    externalUrl: "",
    eventDate: "",
    eventEndDate: "",
    deadline: "",
    status: "draft"
});

// Las imágenes nuevas y existentes se mantienen juntas para poder ordenarlas.
const editorImages = ref([]);
const originalPostImages = ref([]);

// Búsqueda de emprendedores.
const entrepreneurSearch = ref("");

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

const postTypes = [
    {
        value: "noticia",
        label: "Noticia"
    },
    {
        value: "taller",
        label: "Taller"
    },
    {
        value: "evento",
        label: "Evento"
    },
    {
        value: "convocatoria",
        label: "Convocatoria"
    },
    {
        value: "oportunidad",
        label: "Oportunidad"
    },
    {
        value: "anuncio",
        label: "Anuncio"
    }
];

const institutionInitials = computed(function () {
    const name =
        institution.value?.institutionName ||
        "Institución";

    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(function (word) {
            return word.charAt(0).toUpperCase();
        })
        .join("");
});

const publishedCount = computed(function () {
    return posts.value.filter(function (post) {
        return post.status === "published";
    }).length;
});

const draftCount = computed(function () {
    return posts.value.filter(function (post) {
        return post.status === "draft";
    }).length;
});

const upcomingCount = computed(function () {
    const now = Date.now();

    return posts.value.filter(function (post) {
        if (
            post.status !== "published" ||
            !post.eventDate
        ) {
            return false;
        }

        return new Date(post.eventDate).getTime() >= now;
    }).length;
});

const filteredEntrepreneurs = computed(function () {
    const search =
        entrepreneurSearch.value
            .trim()
            .toLowerCase();

    if (!search) {
        return entrepreneurs.value;
    }

    return entrepreneurs.value.filter(function (item) {
        const searchable = [
            item.businessName,
            item.department,
            item.district,
            item.description
        ]
            .join(" ")
            .toLowerCase();

        return searchable.includes(search);
    });
});

const postEditorTitle = computed(function () {
    return postEditorMode.value === "add"
        ? "Crear publicación"
        : "Editar publicación";
});

function changeSection(section) {
    activeSection.value = section;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function formatDate(date) {
    if (!date) return "Sin fecha";

    return new Intl.DateTimeFormat(
        "es-SV",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    ).format(new Date(date));
}

function formatDateTime(date) {
    if (!date) return "Sin fecha";

    return new Intl.DateTimeFormat(
        "es-SV",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    ).format(new Date(date));
}

function postTypeLabel(type) {
    return (
        postTypes.find(function (item) {
            return item.value === type;
        })?.label || "Publicación"
    );
}

function statusLabel(status) {
    if (status === "published") {
        return "Publicado";
    }

    if (status === "archived") {
        return "Archivado";
    }

    return "Borrador";
}

function statusClasses(status) {
    if (status === "published") {
        return "bg-green-100 text-green-700";
    }

    if (status === "archived") {
        return "bg-gray-100 text-gray-600";
    }

    return "bg-amber-100 text-amber-700";
}

function toInputDateTime(date) {
    if (!date) return "";

    const value = new Date(date);
    const offset =
        value.getTimezoneOffset() * 60000;

    return new Date(
        value.getTime() - offset
    )
        .toISOString()
        .slice(0, 16);
}

function toIsoDateTime(value) {
    if (!value) return null;

    return new Date(value).toISOString();
}

function cleanFileName(name) {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9.]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getStoragePathFromPublicUrl(url) {
    if (!url) return "";

    const marker =
        `/storage/v1/object/public/${bucketName}/`;

    const index = url.indexOf(marker);

    if (index === -1) {
        return "";
    }

    return decodeURIComponent(
        url.slice(index + marker.length)
    );
}

function createPreview(file) {
    return URL.createObjectURL(file);
}

function revokePreview(image) {
    if (
        image?.kind === "new" &&
        image.previewUrl
    ) {
        URL.revokeObjectURL(
            image.previewUrl
        );
    }
}

async function uploadFile(path, file) {
    const { error } = await supabase.storage
        .from(bucketName)
        .upload(path, file, {
            cacheControl: "3600",
            upsert: false
        });

    if (error) {
        throw error;
    }

    const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(path);

    return {
        path,
        publicUrl:
            data.publicUrl
    };
}

async function deleteStorageFiles(paths) {
    const validPaths =
        paths.filter(Boolean);

    if (!validPaths.length) {
        return;
    }

    const { error } = await supabase.storage
        .from(bucketName)
        .remove(validPaths);

    if (error) {
        throw error;
    }
}

async function uploadInstitutionLogo(userId, file) {
    const extension =
        file.name.split(".").pop() || "jpg";

    const fileName =
        `${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const path =
        `${userId}/institutions/logo/${fileName}`;

    return uploadFile(path, file);
}

async function uploadPostImages(
    userId,
    postId,
    images
) {
    const uploaded = [];

    for (
        let index = 0;
        index < images.length;
        index += 1
    ) {
        const image = images[index];
        const extension =
            image.file.name.split(".").pop() ||
            "jpg";

        const baseName =
            cleanFileName(
                image.file.name.replace(
                    /\.[^.]+$/,
                    ""
                )
            ) || "imagen";

        const fileName =
            `${Date.now()}-${index}-${baseName}-${crypto.randomUUID()}.${extension}`;

        const path =
            `${userId}/institutions/posts/${postId}/${fileName}`;

        const result =
            await uploadFile(
                path,
                image.file
            );

        uploaded.push({
            ...result,
            sortOrder: index
        });
    }

    return uploaded;
}

async function logout() {
    if (logoutLoading.value) return;

    logoutLoading.value = true;

    try {
        const { error } =
            await supabase.auth.signOut({
                scope: "local"
            });

        if (error) {
            throw error;
        }

        closeProfileEditor();
        closePostEditor();
        closePostPreview();
        router.replace("/auth");
    } catch (error) {
        console.error(
            "Error al cerrar sesión:",
            error
        );

        alert(
            "No fue posible cerrar la sesión."
        );
    } finally {
        logoutLoading.value = false;
    }
}

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
                "No se encontró una sesión activa.";
            return;
        }

        const {
            data: profile,
            error: profileError
        } = await supabase
            .from("profiles")
            .select(`
                full_name,
                phone,
                user_type
            `)
            .eq("id", user.id)
            .single();

        if (
            profileError ||
            profile?.user_type !== "institucion"
        ) {
            console.error(
                "Perfil institucional no válido:",
                profileError
            );

            loadError.value =
                "Esta cuenta no tiene acceso al panel institucional.";
            return;
        }

        const {
            data: institutionData,
            error: institutionError
        } = await supabase
            .from("institutions")
            .select(`
                id,
                institution_name,
                description,
                website,
                department,
                district,
                logo_url,
                active,
                created_at
            `)
            .eq("id", user.id)
            .single();

        if (
            institutionError ||
            !institutionData
        ) {
            console.error(
                "Error al cargar la institución:",
                institutionError
            );

            loadError.value =
                "No fue posible cargar el perfil de la institución.";
            return;
        }

        institution.value = {
            id:
                institutionData.id,
            institutionName:
                institutionData.institution_name,
            phone:
                profile.phone || "",
            email:
                user.email || "",
            description:
                institutionData.description || "",
            website:
                institutionData.website || "",
            department:
                institutionData.department || "",
            district:
                institutionData.district || "",
            logoUrl:
                institutionData.logo_url || "",
            active:
                institutionData.active
        };

        await Promise.all([
            loadPosts(user.id),
            loadEntrepreneurs()
        ]);
    } catch (error) {
        console.error(
            "Error al cargar el dashboard institucional:",
            error
        );

        loadError.value =
            "Ocurrió un problema inesperado al cargar el panel.";
    } finally {
        loading.value = false;
    }
}

async function loadPosts(userId) {
    const {
        data: postRows,
        error: postError
    } = await supabase
        .from("institution_posts")
        .select(`
            id,
            institution_id,
            title,
            description,
            post_type,
            location,
            external_url,
            event_date,
            event_end_date,
            deadline,
            status,
            published_at,
            created_at,
            updated_at
        `)
        .eq("institution_id", userId)
        .order("created_at", {
            ascending: false
        });

    if (postError) {
        throw postError;
    }

    if (!postRows?.length) {
        posts.value = [];
        return;
    }

    const postIds =
        postRows.map(function (post) {
            return post.id;
        });

    const {
        data: imageRows,
        error: imageError
    } = await supabase
        .from("institution_post_images")
        .select(`
            id,
            post_id,
            image_url,
            storage_path,
            sort_order
        `)
        .in("post_id", postIds)
        .order("sort_order", {
            ascending: true
        });

    if (imageError) {
        throw imageError;
    }

    posts.value =
        postRows.map(function (post) {
            const imageRecords =
                (imageRows || [])
                    .filter(function (image) {
                        return (
                            image.post_id ===
                            post.id
                        );
                    })
                    .sort(function (a, b) {
                        return (
                            a.sort_order -
                            b.sort_order
                        );
                    })
                    .map(function (image) {
                        return {
                            id: image.id,
                            imageUrl:
                                image.image_url,
                            storagePath:
                                image.storage_path,
                            sortOrder:
                                image.sort_order
                        };
                    });

            return {
                id:
                    post.id,
                institutionId:
                    post.institution_id,
                title:
                    post.title,
                description:
                    post.description,
                postType:
                    post.post_type,
                location:
                    post.location || "",
                externalUrl:
                    post.external_url || "",
                eventDate:
                    post.event_date,
                eventEndDate:
                    post.event_end_date,
                deadline:
                    post.deadline,
                status:
                    post.status,
                publishedAt:
                    post.published_at,
                createdAt:
                    post.created_at,
                updatedAt:
                    post.updated_at,
                imageRecords,
                images:
                    imageRecords.map(
                        function (image) {
                            return image.imageUrl;
                        }
                    ),
                cover:
                    imageRecords[0]?.imageUrl ||
                    ""
            };
        });
}

async function loadEntrepreneurs() {
    const {
        data: entrepreneurRows,
        error: entrepreneurError
    } = await supabase
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

    if (entrepreneurError) {
        throw entrepreneurError;
    }

    if (!entrepreneurRows?.length) {
        entrepreneurs.value = [];
        return;
    }

    const ids =
        entrepreneurRows.map(function (item) {
            return item.id;
        });

    const {
        data: productRows,
        error: productError
    } = await supabase
        .from("products")
        .select(`
            id,
            entrepreneur_id
        `)
        .in("entrepreneur_id", ids)
        .eq("active", true);

    if (productError) {
        console.warn(
            "No se pudo cargar el total de productos:",
            productError
        );
    }

    entrepreneurs.value =
        entrepreneurRows.map(function (item) {
            const productCount =
                (productRows || []).filter(
                    function (product) {
                        return (
                            product.entrepreneur_id ===
                            item.id
                        );
                    }
                ).length;

            return {
                id:
                    item.id,
                businessName:
                    item.business_name,
                description:
                    item.description || "",
                department:
                    item.department || "",
                district:
                    item.district || "",
                logoUrl:
                    item.logo_url || "",
                productCount
            };
        });
}

function clearPasswordFields() {
    currentPassword.value = "";
    newPassword.value = "";
    confirmNewPassword.value = "";
    showCurrentPassword.value = false;
    showNewPassword.value = false;
    showConfirmPassword.value = false;
}

function openProfileEditor() {
    if (!institution.value) return;

    profileForm.value = {
        institutionName:
            institution.value.institutionName ||
            "",
        phone:
            institution.value.phone || "",
        website:
            institution.value.website || "",
        description:
            institution.value.description || "",
        department:
            institution.value.department || "",
        district:
            institution.value.district || ""
    };

    profileLogoFile.value = null;
    profileLogoPreview.value =
        institution.value.logoUrl || "";

    clearPasswordFields();
    showProfileEditor.value = true;
    document.body.style.overflow =
        "hidden";
}

function closeProfileEditor() {
    showProfileEditor.value = false;
    profileLogoFile.value = null;
    profileLogoPreview.value = "";
    clearPasswordFields();
    document.body.style.overflow = "";
}

function handleProfileLogo(event) {
    const file =
        event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert(
            "Selecciona un archivo de imagen válido."
        );

        event.target.value = "";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert(
            "La imagen no puede superar los 5 MB."
        );

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

async function saveProfile() {
    if (
        !institution.value ||
        profileSaving.value
    ) {
        return;
    }

    if (
        !profileForm.value.institutionName.trim()
    ) {
        alert(
            "Escribe el nombre de la institución."
        );
        return;
    }

    profileSaving.value = true;

    try {
        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (
            userError ||
            !user?.email
        ) {
            alert(
                "No fue posible verificar tu cuenta."
            );
            return;
        }

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
                    "Completa los tres campos de contraseña."
                );
                return;
            }

            if (
                newPassword.value.length < 8
            ) {
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

            const {
                error: passwordCheckError
            } = await supabase.auth
                .signInWithPassword({
                    email:
                        user.email,
                    password:
                        currentPassword.value
                });

            if (passwordCheckError) {
                alert(
                    "La contraseña actual es incorrecta."
                );
                return;
            }
        }

        const oldLogoPath =
            getStoragePathFromPublicUrl(
                institution.value.logoUrl
            );

        let logoUrl =
            institution.value.logoUrl ||
            null;

        let uploadedLogo = null;

        if (profileLogoFile.value) {
            uploadedLogo =
                await uploadInstitutionLogo(
                    user.id,
                    profileLogoFile.value
                );

            logoUrl =
                uploadedLogo.publicUrl;
        }

        const {
            data,
            error
        } = await supabase
            .from("institutions")
            .update({
                institution_name:
                    profileForm.value
                        .institutionName
                        .trim(),
                description:
                    profileForm.value
                        .description
                        .trim(),
                website:
                    profileForm.value
                        .website
                        .trim() ||
                    null,
                department:
                    profileForm.value
                        .department ||
                    null,
                district:
                    profileForm.value
                        .district
                        .trim() ||
                    null,
                logo_url:
                    logoUrl
            })
            .eq("id", user.id)
            .select()
            .single();

        if (error) {
            if (uploadedLogo?.path) {
                await deleteStorageFiles([
                    uploadedLogo.path
                ]);
            }

            throw error;
        }

        const {
            error: profileError
        } = await supabase
            .from("profiles")
            .update({
                full_name:
                    profileForm.value
                        .institutionName
                        .trim(),
                phone:
                    profileForm.value
                        .phone
                        .trim()
            })
            .eq("id", user.id);

        if (profileError) {
            throw profileError;
        }

        if (
            uploadedLogo?.path &&
            oldLogoPath &&
            uploadedLogo.path !==
                oldLogoPath
        ) {
            try {
                await deleteStorageFiles([
                    oldLogoPath
                ]);
            } catch (deleteError) {
                console.warn(
                    "No se pudo eliminar el logo anterior:",
                    deleteError
                );
            }
        }

        institution.value = {
            ...institution.value,
            institutionName:
                data.institution_name,
            phone:
                profileForm.value.phone.trim(),
            website:
                data.website || "",
            description:
                data.description || "",
            department:
                data.department || "",
            district:
                data.district || "",
            logoUrl:
                data.logo_url || ""
        };

        if (wantsPasswordChange) {
            const {
                error: passwordError
            } = await supabase.auth
                .updateUser({
                    password:
                        newPassword.value
                });

            if (passwordError) {
                alert(
                    "El perfil se guardó, pero no fue posible cambiar la contraseña."
                );
                return;
            }
        }

        alert(
            "Perfil institucional actualizado."
        );

        closeProfileEditor();
    } catch (error) {
        console.error(
            "Error al guardar el perfil:",
            error
        );

        alert(
            "No fue posible guardar los cambios: " +
            (error.message ||
                "Error inesperado")
        );
    } finally {
        profileSaving.value = false;
    }
}

function resetPostForm() {
    postForm.value = {
        title: "",
        description: "",
        postType: "noticia",
        location: "",
        externalUrl: "",
        eventDate: "",
        eventEndDate: "",
        deadline: "",
        status: "draft"
    };

    editorImages.value.forEach(
        revokePreview
    );

    editorImages.value = [];
    originalPostImages.value = [];
}

function openAddPost() {
    postEditorMode.value = "add";
    selectedPost.value = null;
    resetPostForm();
    showPostEditor.value = true;
    document.body.style.overflow =
        "hidden";
}

function openEditPost(post) {
    postEditorMode.value = "edit";
    selectedPost.value = post;

    postForm.value = {
        title:
            post.title || "",
        description:
            post.description || "",
        postType:
            post.postType || "noticia",
        location:
            post.location || "",
        externalUrl:
            post.externalUrl || "",
        eventDate:
            toInputDateTime(
                post.eventDate
            ),
        eventEndDate:
            toInputDateTime(
                post.eventEndDate
            ),
        deadline:
            toInputDateTime(
                post.deadline
            ),
        status:
            post.status || "draft"
    };

    editorImages.value =
        post.imageRecords.map(
            function (image) {
                return {
                    kind: "existing",
                    id: image.id,
                    imageUrl:
                        image.imageUrl,
                    storagePath:
                        image.storagePath
                };
            }
        );

    originalPostImages.value =
        post.imageRecords.map(
            function (image) {
                return {
                    id: image.id,
                    storagePath:
                        image.storagePath
                };
            }
        );

    showPostEditor.value = true;
    document.body.style.overflow =
        "hidden";
}

function closePostEditor() {
    showPostEditor.value = false;
    selectedPost.value = null;
    resetPostForm();
    document.body.style.overflow = "";
}

function handlePostImages(event) {
    const files =
        Array.from(
            event.target.files || []
        );

    if (!files.length) return;

    const available =
        6 - editorImages.value.length;

    if (available <= 0) {
        alert(
            "Puedes agregar hasta 6 imágenes por publicación."
        );

        event.target.value = "";
        return;
    }

    const accepted =
        files
            .filter(function (file) {
                return (
                    file.type.startsWith(
                        "image/"
                    ) &&
                    file.size <=
                        5 * 1024 * 1024
                );
            })
            .slice(0, available);

    if (
        accepted.length !==
        files.slice(0, available).length
    ) {
        alert(
            "Algunas imágenes no eran válidas o superaban los 5 MB."
        );
    }

    for (const file of accepted) {
        editorImages.value.push({
            kind: "new",
            file,
            previewUrl:
                createPreview(file)
        });
    }

    event.target.value = "";
}

function removeEditorImage(index) {
    const image =
        editorImages.value[index];

    revokePreview(image);

    editorImages.value.splice(
        index,
        1
    );
}

function moveEditorImage(
    index,
    direction
) {
    const newIndex =
        index + direction;

    if (
        newIndex < 0 ||
        newIndex >=
            editorImages.value.length
    ) {
        return;
    }

    const images =
        editorImages.value;

    const current =
        images[index];

    images[index] =
        images[newIndex];

    images[newIndex] =
        current;
}

async function savePost() {
    if (
        !institution.value ||
        postSaving.value
    ) {
        return;
    }

    if (
        !postForm.value.title.trim() ||
        !postForm.value.description.trim()
    ) {
        alert(
            "Escribe el título y la descripción."
        );
        return;
    }

    postSaving.value = true;

    let createdPostId = "";
    let uploadedFiles = [];

    try {
        const payload = {
            institution_id:
                institution.value.id,
            title:
                postForm.value.title.trim(),
            description:
                postForm.value.description.trim(),
            post_type:
                postForm.value.postType,
            location:
                postForm.value.location.trim() ||
                null,
            external_url:
                postForm.value.externalUrl.trim() ||
                null,
            event_date:
                toIsoDateTime(
                    postForm.value.eventDate
                ),
            event_end_date:
                toIsoDateTime(
                    postForm.value.eventEndDate
                ),
            deadline:
                toIsoDateTime(
                    postForm.value.deadline
                ),
            status:
                postForm.value.status,
            published_at:
                postForm.value.status ===
                "published"
                    ? new Date().toISOString()
                    : null
        };

        let postId = "";

        if (
            postEditorMode.value ===
            "add"
        ) {
            const {
                data,
                error
            } = await supabase
                .from("institution_posts")
                .insert(payload)
                .select("id")
                .single();

            if (error) {
                throw error;
            }

            postId = data.id;
            createdPostId = data.id;
        } else {
            postId =
                selectedPost.value.id;

            if (
                postForm.value.status ===
                    "published" &&
                selectedPost.value
                    .status ===
                    "published"
            ) {
                payload.published_at =
                    selectedPost.value
                        .publishedAt;
            }

            const { error } =
                await supabase
                    .from(
                        "institution_posts"
                    )
                    .update(payload)
                    .eq("id", postId)
                    .eq(
                        "institution_id",
                        institution.value.id
                    );

            if (error) {
                throw error;
            }
        }

        const newImages =
            editorImages.value.filter(
                function (image) {
                    return (
                        image.kind === "new"
                    );
                }
            );

        uploadedFiles =
            await uploadPostImages(
                institution.value.id,
                postId,
                newImages
            );

        const insertedByFile =
            new Map();

        for (
            let index = 0;
            index < newImages.length;
            index += 1
        ) {
            insertedByFile.set(
                newImages[index].file,
                uploadedFiles[index]
            );
        }

        const finalImages =
            editorImages.value.map(
                function (image, index) {
                    if (
                        image.kind ===
                        "existing"
                    ) {
                        return {
                            kind:
                                "existing",
                            id:
                                image.id,
                            storagePath:
                                image.storagePath,
                            sortOrder:
                                index
                        };
                    }

                    const uploaded =
                        insertedByFile.get(
                            image.file
                        );

                    return {
                        kind:
                            "new",
                        imageUrl:
                            uploaded.publicUrl,
                        storagePath:
                            uploaded.path,
                        sortOrder:
                            index
                    };
                }
            );

        const newRows =
            finalImages
                .filter(function (image) {
                    return (
                        image.kind ===
                        "new"
                    );
                })
                .map(function (image) {
                    return {
                        post_id:
                            postId,
                        image_url:
                            image.imageUrl,
                        storage_path:
                            image.storagePath,
                        sort_order:
                            image.sortOrder
                    };
                });

        if (newRows.length) {
            const { error } =
                await supabase
                    .from(
                        "institution_post_images"
                    )
                    .insert(newRows);

            if (error) {
                throw error;
            }
        }

        const existingImages =
            finalImages.filter(
                function (image) {
                    return (
                        image.kind ===
                        "existing"
                    );
                }
            );

        for (
            const image of existingImages
        ) {
            const { error } =
                await supabase
                    .from(
                        "institution_post_images"
                    )
                    .update({
                        sort_order:
                            image.sortOrder
                    })
                    .eq("id", image.id);

            if (error) {
                throw error;
            }
        }

        if (
            postEditorMode.value ===
            "edit"
        ) {
            const currentIds =
                new Set(
                    existingImages.map(
                        function (image) {
                            return image.id;
                        }
                    )
                );

            const removedImages =
                originalPostImages.value
                    .filter(
                        function (image) {
                            return !currentIds.has(
                                image.id
                            );
                        }
                    );

            if (
                removedImages.length
            ) {
                const removedIds =
                    removedImages.map(
                        function (image) {
                            return image.id;
                        }
                    );

                const { error } =
                    await supabase
                        .from(
                            "institution_post_images"
                        )
                        .delete()
                        .in(
                            "id",
                            removedIds
                        );

                if (error) {
                    throw error;
                }

                try {
                    await deleteStorageFiles(
                        removedImages.map(
                            function (image) {
                                return (
                                    image.storagePath
                                );
                            }
                        )
                    );
                } catch (deleteError) {
                    console.warn(
                        "No se pudieron eliminar algunos archivos anteriores:",
                        deleteError
                    );
                }
            }
        }

        await loadPosts(
            institution.value.id
        );

        alert(
            postEditorMode.value ===
                "add"
                ? "Publicación creada correctamente."
                : "Publicación actualizada correctamente."
        );

        closePostEditor();
    } catch (error) {
        console.error(
            "Error al guardar la publicación:",
            error
        );

        if (uploadedFiles.length) {
            try {
                await deleteStorageFiles(
                    uploadedFiles.map(
                        function (file) {
                            return file.path;
                        }
                    )
                );
            } catch (cleanupError) {
                console.warn(
                    "No se pudieron limpiar algunas imágenes nuevas:",
                    cleanupError
                );
            }
        }

        if (
            createdPostId &&
            !uploadedFiles.length
        ) {
            try {
                await supabase
                    .from(
                        "institution_posts"
                    )
                    .delete()
                    .eq(
                        "id",
                        createdPostId
                    );
            } catch {
                // El post puede conservarse como borrador si la limpieza falla.
            }
        }

        alert(
            "No fue posible guardar la publicación: " +
            (error.message ||
                "Error inesperado")
        );
    } finally {
        postSaving.value = false;
    }
}

async function deletePost(post) {
    if (!post || postSaving.value) {
        return;
    }

    const confirmed =
        window.confirm(
            `¿Deseas eliminar "${post.title}"?`
        );

    if (!confirmed) return;

    postSaving.value = true;

    try {
        const paths =
            post.imageRecords.map(
                function (image) {
                    return image.storagePath;
                }
            );

        const { error } =
            await supabase
                .from("institution_posts")
                .delete()
                .eq("id", post.id)
                .eq(
                    "institution_id",
                    institution.value.id
                );

        if (error) {
            throw error;
        }

        try {
            await deleteStorageFiles(
                paths
            );
        } catch (storageError) {
            console.warn(
                "La publicación se eliminó, pero algunas imágenes no pudieron borrarse:",
                storageError
            );
        }

        posts.value =
            posts.value.filter(
                function (item) {
                    return (
                        item.id !==
                        post.id
                    );
                }
            );

        alert(
            "Publicación eliminada."
        );
    } catch (error) {
        console.error(
            "Error al eliminar publicación:",
            error
        );

        alert(
            "No fue posible eliminar la publicación."
        );
    } finally {
        postSaving.value = false;
    }
}

function openPostPreview(post) {
    selectedPost.value = post;
    showPostPreview.value = true;
    document.body.style.overflow =
        "hidden";
}

function closePostPreview() {
    showPostPreview.value = false;
    selectedPost.value = null;
    document.body.style.overflow = "";
}

function openEntrepreneurProfile(id) {
    router.push({
        name: "PerfilEmprendedor",
        params: {
            id
        }
    });
}

function handleEscape(event) {
    if (event.key !== "Escape") {
        return;
    }

    if (showPostPreview.value) {
        closePostPreview();
        return;
    }

    if (showPostEditor.value) {
        closePostEditor();
        return;
    }

    if (showProfileEditor.value) {
        closeProfileEditor();
    }
}

onMounted(function () {
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

    editorImages.value.forEach(
        revokePreview
    );

    document.body.style.overflow = "";
});
</script>

<template>
<div class="min-h-screen bg-[#F8FBFC] pb-24 text-gray-700 lg:pb-8">
    <!-- Navegación lateral -->
    <aside class="fixed inset-y-0 left-0 z-40 hidden w-[270px] flex-col bg-[#0077B6] px-5 py-6 text-white lg:flex">
        <div class="flex items-center gap-3 px-2">
            <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl font-black text-[#0077B6]">
                T
            </div>
            <div>
                <p class="text-xl font-black">
                    Thrive
                </p>
                <p class="text-xs font-semibold text-white/65">
                    Panel institucional
                </p>
            </div>
        </div>

        <nav class="mt-10 space-y-2">
            <button
                type="button"
                class="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition"
                :class="activeSection === 'inicio' ? 'bg-white text-[#0077B6]' : 'text-white/80 hover:bg-white/10 hover:text-white'"
                @click="changeSection('inicio')"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 11l9-8 9 8v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"></path>
                </svg>
                Inicio
            </button>

            <button
                type="button"
                class="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition"
                :class="activeSection === 'publicaciones' ? 'bg-white text-[#0077B6]' : 'text-white/80 hover:bg-white/10 hover:text-white'"
                @click="changeSection('publicaciones')"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM7 8h10M7 12h10M7 16h6"></path>
                </svg>
                Publicaciones
            </button>

            <button
                type="button"
                class="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition"
                :class="activeSection === 'emprendedores' ? 'bg-white text-[#0077B6]' : 'text-white/80 hover:bg-white/10 hover:text-white'"
                @click="changeSection('emprendedores')"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"></path>
                </svg>
                Emprendedores
            </button>

            <button
                type="button"
                class="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold transition"
                :class="activeSection === 'perfil' ? 'bg-white text-[#0077B6]' : 'text-white/80 hover:bg-white/10 hover:text-white'"
                @click="changeSection('perfil')"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <circle cx="12" cy="8" r="4"></circle>
                    <path stroke-linecap="round" d="M4 21a8 8 0 0116 0"></path>
                </svg>
                Perfil
            </button>
        </nav>

        <div class="mt-auto">
            <button
                type="button"
                :disabled="logoutLoading"
                class="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/25 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-60"
                @click="logout"
            >
                <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10 17l5-5-5-5M15 12H3M14 4h5a2 2 0 012 2v12a2 2 0 01-2 2h-5"></path>
                </svg>
                {{ logoutLoading ? "Cerrando..." : "Cerrar sesión" }}
            </button>
        </div>
    </aside>

    <!-- Barra superior -->
    <header class="sticky top-0 z-30 bg-[#F8FBFC] lg:ml-[270px]">
        <div class="mx-auto max-w-[1450px] px-3 pt-3 sm:px-5 lg:px-8">
            <div class="flex items-center justify-between gap-3 rounded-[24px] bg-[#00B4D8] px-4 py-3 text-white shadow-sm">
                <div class="flex min-w-0 items-center gap-3">
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/20 font-black">
                        <img
                            v-if="institution?.logoUrl"
                            :src="institution.logoUrl"
                            :alt="institution.institutionName"
                            class="h-full w-full object-cover"
                        >
                        <span v-else>
                            {{ institutionInitials }}
                        </span>
                    </div>
                    <div class="min-w-0">
                        <p class="truncate text-sm font-black">
                            {{ institution?.institutionName || "Panel institucional" }}
                        </p>
                        <p class="truncate text-xs text-white/75">
                            Gestión de oportunidades para emprendedores
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    class="rounded-xl bg-white px-4 py-2 text-xs font-black text-[#0077B6] sm:text-sm"
                    @click="openAddPost"
                >
                    + Crear publicación
                </button>
            </div>
        </div>
    </header>

    <!-- Cargando -->
    <main
        v-if="loading"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center lg:ml-[270px]"
    >
        <div class="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        <p class="mt-4 text-sm font-semibold text-gray-400">
            Cargando panel institucional...
        </p>
    </main>

    <!-- Error -->
    <main
        v-else-if="loadError"
        class="mx-auto max-w-[1450px] px-5 py-24 text-center lg:ml-[270px]"
    >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 font-black text-red-600">
            !
        </div>
        <h1 class="mt-4 text-xl font-black text-gray-700">
            No pudimos cargar el panel
        </h1>
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

    <!-- Contenido -->
    <main
        v-else-if="institution"
        class="mx-auto max-w-[1450px] px-3 py-5 sm:px-5 lg:ml-[270px] lg:px-8"
    >
        <!-- Inicio -->
        <template v-if="activeSection === 'inicio'">
            <section class="overflow-hidden rounded-[28px] bg-white">
                <div class="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Panel institucional
                        </p>
                        <h1 class="mt-2 text-3xl font-black text-gray-700 sm:text-4xl">
                            Bienvenido, {{ institution.institutionName }}
                        </h1>
                        <p class="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
                            Publica talleres, eventos, convocatorias y noticias para apoyar el crecimiento de los emprendimientos registrados en Thrive.
                        </p>
                    </div>

                    <button
                        type="button"
                        class="rounded-2xl bg-[#00B4D8] px-6 py-3 text-sm font-black text-white"
                        @click="openAddPost"
                    >
                        Crear nueva publicación
                    </button>
                </div>
            </section>

            <section class="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
                <article class="rounded-[22px] bg-white p-4 sm:p-5">
                    <p class="text-xs font-bold uppercase tracking-wide text-gray-400">
                        Publicadas
                    </p>
                    <p class="mt-2 text-3xl font-black text-[#0077B6]">
                        {{ publishedCount }}
                    </p>
                </article>

                <article class="rounded-[22px] bg-white p-4 sm:p-5">
                    <p class="text-xs font-bold uppercase tracking-wide text-gray-400">
                        Borradores
                    </p>
                    <p class="mt-2 text-3xl font-black text-amber-500">
                        {{ draftCount }}
                    </p>
                </article>

                <article class="rounded-[22px] bg-white p-4 sm:p-5">
                    <p class="text-xs font-bold uppercase tracking-wide text-gray-400">
                        Próximos eventos
                    </p>
                    <p class="mt-2 text-3xl font-black text-[#00B4D8]">
                        {{ upcomingCount }}
                    </p>
                </article>

                <article class="rounded-[22px] bg-white p-4 sm:p-5">
                    <p class="text-xs font-bold uppercase tracking-wide text-gray-400">
                        Emprendedores
                    </p>
                    <p class="mt-2 text-3xl font-black text-[#4F7180]">
                        {{ entrepreneurs.length }}
                    </p>
                </article>
            </section>

            <section class="mt-7">
                <div class="mb-4 flex items-end justify-between gap-3">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Actividad reciente
                        </p>
                        <h2 class="mt-1 text-2xl font-black text-gray-700">
                            Últimas publicaciones
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="text-sm font-bold text-[#0077B6]"
                        @click="changeSection('publicaciones')"
                    >
                        Ver todas
                    </button>
                </div>

                <div
                    v-if="posts.length"
                    class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                >
                    <article
                        v-for="post in posts.slice(0, 6)"
                        :key="post.id"
                        class="overflow-hidden rounded-[24px] bg-white"
                    >
                        <button
                            type="button"
                            class="block w-full text-left"
                            @click="openPostPreview(post)"
                        >
                            <div class="aspect-[16/9] bg-[#EAF8FB]">
                                <img
                                    v-if="post.cover"
                                    :src="post.cover"
                                    :alt="post.title"
                                    class="h-full w-full object-cover"
                                >
                                <div
                                    v-else
                                    class="flex h-full items-center justify-center text-sm font-bold text-[#00B4D8]"
                                >
                                    {{ postTypeLabel(post.postType) }}
                                </div>
                            </div>

                            <div class="p-4">
                                <div class="flex items-center justify-between gap-2">
                                    <span class="rounded-full bg-[#CAF0F8] px-3 py-1 text-[10px] font-black uppercase text-[#0077B6]">
                                        {{ postTypeLabel(post.postType) }}
                                    </span>
                                    <span
                                        class="rounded-full px-3 py-1 text-[10px] font-black"
                                        :class="statusClasses(post.status)"
                                    >
                                        {{ statusLabel(post.status) }}
                                    </span>
                                </div>

                                <h3 class="mt-3 line-clamp-2 font-black text-gray-700">
                                    {{ post.title }}
                                </h3>

                                <p class="mt-2 text-xs text-gray-400">
                                    {{ formatDate(post.createdAt) }}
                                </p>
                            </div>
                        </button>
                    </article>
                </div>

                <div
                    v-else
                    class="rounded-[24px] bg-white px-5 py-14 text-center"
                >
                    <p class="font-black text-gray-600">
                        Aún no has creado publicaciones.
                    </p>
                    <p class="mt-1 text-sm text-gray-400">
                        Crea la primera oportunidad para los emprendedores.
                    </p>
                    <button
                        type="button"
                        class="mt-5 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white"
                        @click="openAddPost"
                    >
                        Crear publicación
                    </button>
                </div>
            </section>
        </template>

        <!-- Publicaciones -->
        <template v-else-if="activeSection === 'publicaciones'">
            <section>
                <div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Contenido institucional
                        </p>
                        <h1 class="mt-1 text-3xl font-black text-gray-700">
                            Publicaciones
                        </h1>
                        <p class="mt-1 text-sm text-gray-400">
                            {{ posts.length }} publicaciones registradas
                        </p>
                    </div>

                    <button
                        type="button"
                        class="rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-black text-white"
                        @click="openAddPost"
                    >
                        + Crear publicación
                    </button>
                </div>

                <div
                    v-if="posts.length"
                    class="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                >
                    <article
                        v-for="post in posts"
                        :key="post.id"
                        class="overflow-hidden rounded-[24px] bg-white"
                    >
                        <button
                            type="button"
                            class="block w-full text-left"
                            @click="openPostPreview(post)"
                        >
                            <div class="aspect-[16/9] bg-[#EAF8FB]">
                                <img
                                    v-if="post.cover"
                                    :src="post.cover"
                                    :alt="post.title"
                                    class="h-full w-full object-cover"
                                >
                                <div
                                    v-else
                                    class="flex h-full items-center justify-center font-bold text-[#00B4D8]"
                                >
                                    {{ postTypeLabel(post.postType) }}
                                </div>
                            </div>
                        </button>

                        <div class="p-4">
                            <div class="flex items-center justify-between gap-2">
                                <span class="rounded-full bg-[#CAF0F8] px-3 py-1 text-[10px] font-black uppercase text-[#0077B6]">
                                    {{ postTypeLabel(post.postType) }}
                                </span>
                                <span
                                    class="rounded-full px-3 py-1 text-[10px] font-black"
                                    :class="statusClasses(post.status)"
                                >
                                    {{ statusLabel(post.status) }}
                                </span>
                            </div>

                            <h2 class="mt-3 line-clamp-2 font-black text-gray-700">
                                {{ post.title }}
                            </h2>

                            <p class="mt-2 line-clamp-2 text-sm leading-5 text-gray-400">
                                {{ post.description }}
                            </p>

                            <p class="mt-3 text-xs font-semibold text-gray-400">
                                {{ formatDate(post.createdAt) }}
                            </p>

                            <div class="mt-4 grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    class="rounded-xl border border-gray-200 px-2 py-2 text-xs font-bold text-gray-500"
                                    @click="openPostPreview(post)"
                                >
                                    Ver
                                </button>

                                <button
                                    type="button"
                                    class="rounded-xl bg-[#CAF0F8] px-2 py-2 text-xs font-bold text-[#0077B6]"
                                    @click="openEditPost(post)"
                                >
                                    Editar
                                </button>

                                <button
                                    type="button"
                                    class="rounded-xl border border-red-200 px-2 py-2 text-xs font-bold text-red-600"
                                    @click="deletePost(post)"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </article>
                </div>

                <div
                    v-else
                    class="rounded-[24px] bg-white px-5 py-16 text-center"
                >
                    <p class="font-black text-gray-600">
                        No hay publicaciones todavía.
                    </p>
                    <p class="mt-1 text-sm text-gray-400">
                        Las noticias, talleres y eventos aparecerán aquí.
                    </p>
                </div>
            </section>
        </template>

        <!-- Emprendedores -->
        <template v-else-if="activeSection === 'emprendedores'">
            <section>
                <div class="mb-5">
                    <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                        Comunidad Thrive
                    </p>
                    <h1 class="mt-1 text-3xl font-black text-gray-700">
                        Emprendedores
                    </h1>
                    <p class="mt-1 text-sm text-gray-400">
                        Consulta los emprendimientos registrados en la plataforma.
                    </p>
                </div>

                <div class="mb-5 rounded-[22px] bg-white p-3">
                    <div class="flex items-center gap-3 rounded-2xl bg-[#F8FBFC] px-4 py-3">
                        <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
                            <circle cx="11" cy="11" r="7"></circle>
                            <path stroke-linecap="round" d="M20 20l-3.5-3.5"></path>
                        </svg>
                        <input
                            v-model="entrepreneurSearch"
                            type="search"
                            placeholder="Buscar por nombre o ubicación..."
                            class="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
                        >
                    </div>
                </div>

                <div
                    v-if="filteredEntrepreneurs.length"
                    class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                >
                    <article
                        v-for="item in filteredEntrepreneurs"
                        :key="item.id"
                        class="rounded-[24px] bg-white p-5"
                    >
                        <div class="flex items-start gap-4">
                            <div class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#CAF0F8] font-black text-[#0077B6]">
                                <img
                                    v-if="item.logoUrl"
                                    :src="item.logoUrl"
                                    :alt="item.businessName"
                                    class="h-full w-full object-cover"
                                >
                                <span v-else>
                                    {{ item.businessName.charAt(0).toUpperCase() }}
                                </span>
                            </div>

                            <div class="min-w-0 flex-1">
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

                        <p class="mt-4 line-clamp-3 text-sm leading-6 text-gray-400">
                            {{ item.description || "Este emprendimiento todavía no tiene descripción." }}
                        </p>

                        <button
                            type="button"
                            class="mt-4 w-full rounded-xl bg-[#CAF0F8] px-4 py-3 text-sm font-black text-[#0077B6]"
                            @click="openEntrepreneurProfile(item.id)"
                        >
                            Ver emprendimiento
                        </button>
                    </article>
                </div>

                <div
                    v-else
                    class="rounded-[24px] bg-white px-5 py-16 text-center"
                >
                    <p class="font-black text-gray-600">
                        No encontramos emprendimientos.
                    </p>
                    <p class="mt-1 text-sm text-gray-400">
                        Prueba con otro nombre o ubicación.
                    </p>
                </div>
            </section>
        </template>

        <!-- Perfil -->
        <template v-else>
            <section class="rounded-[28px] bg-white p-5 sm:p-7">
                <div class="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
                    <div class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[28px] bg-[#CAF0F8] text-2xl font-black text-[#0077B6]">
                        <img
                            v-if="institution.logoUrl"
                            :src="institution.logoUrl"
                            :alt="institution.institutionName"
                            class="h-full w-full object-cover"
                        >
                        <span v-else>
                            {{ institutionInitials }}
                        </span>
                    </div>

                    <div class="min-w-0 flex-1">
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Perfil institucional
                        </p>
                        <h1 class="mt-1 text-3xl font-black text-gray-700">
                            {{ institution.institutionName }}
                        </h1>
                        <p class="mt-2 text-sm text-gray-400">
                            {{ institution.email }}
                        </p>
                        <p class="mt-1 text-sm text-gray-400">
                            {{ institution.phone || "Teléfono no registrado" }}
                        </p>
                    </div>

                    <button
                        type="button"
                        class="rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-black text-white"
                        @click="openProfileEditor"
                    >
                        Editar perfil
                    </button>
                </div>

                <div class="mt-7 grid gap-4 md:grid-cols-2">
                    <div class="rounded-2xl bg-[#F8FBFC] p-5">
                        <p class="text-xs font-bold uppercase tracking-wide text-gray-400">
                            Descripción
                        </p>
                        <p class="mt-2 whitespace-pre-line text-sm leading-6 text-gray-500">
                            {{ institution.description || "Sin descripción institucional." }}
                        </p>
                    </div>

                    <div class="rounded-2xl bg-[#F8FBFC] p-5">
                        <p class="text-xs font-bold uppercase tracking-wide text-gray-400">
                            Información
                        </p>
                        <p class="mt-2 text-sm text-gray-500">
                            {{ institution.district || institution.department || "Ubicación no registrada" }}
                        </p>
                        <a
                            v-if="institution.website"
                            :href="institution.website"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="mt-2 block truncate text-sm font-bold text-[#0077B6]"
                        >
                            {{ institution.website }}
                        </a>
                    </div>
                </div>

                <button
                    type="button"
                    :disabled="logoutLoading"
                    class="mt-7 w-full rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-bold text-red-600 sm:w-auto"
                    @click="logout"
                >
                    {{ logoutLoading ? "Cerrando..." : "Cerrar sesión" }}
                </button>
            </section>
        </template>
    </main>

    <!-- Navegación móvil -->
    <nav class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 rounded-t-[28px] bg-white px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_30px_rgba(79,113,128,0.12)] lg:hidden">
        <button
            type="button"
            class="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold"
            :class="activeSection === 'inicio' ? 'bg-[#CAF0F8] text-[#0077B6]' : 'text-gray-400'"
            @click="changeSection('inicio')"
        >
            Inicio
        </button>

        <button
            type="button"
            class="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold"
            :class="activeSection === 'publicaciones' ? 'bg-[#CAF0F8] text-[#0077B6]' : 'text-gray-400'"
            @click="changeSection('publicaciones')"
        >
            Publicaciones
        </button>

        <button
            type="button"
            class="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold"
            :class="activeSection === 'emprendedores' ? 'bg-[#CAF0F8] text-[#0077B6]' : 'text-gray-400'"
            @click="changeSection('emprendedores')"
        >
            Emprendedores
        </button>

        <button
            type="button"
            class="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-bold"
            :class="activeSection === 'perfil' ? 'bg-[#CAF0F8] text-[#0077B6]' : 'text-gray-400'"
            @click="changeSection('perfil')"
        >
            Perfil
        </button>
    </nav>

    <!-- Editor de perfil -->
    <Teleport to="body">
        <div
            v-if="showProfileEditor"
            class="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3 sm:p-6"
            @click.self="closeProfileEditor"
        >
            <section class="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-[28px] bg-white">
                <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-wide text-[#00B4D8]">
                            Cuenta institucional
                        </p>
                        <h2 class="text-xl font-black text-gray-700">
                            Editar perfil
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                        @click="closeProfileEditor"
                    >
                        ×
                    </button>
                </div>

                <form class="space-y-5 p-5 sm:p-7" @submit.prevent="saveProfile">
                    <div class="flex flex-col items-center gap-4 sm:flex-row">
                        <div class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[26px] bg-[#CAF0F8] font-black text-[#0077B6]">
                            <img
                                v-if="profileLogoPreview"
                                :src="profileLogoPreview"
                                alt="Vista previa del logo"
                                class="h-full w-full object-cover"
                            >
                            <span v-else>
                                {{ institutionInitials }}
                            </span>
                        </div>

                        <label class="w-full cursor-pointer rounded-2xl border border-dashed border-[#00B4D8] bg-[#F8FBFC] px-4 py-4 text-center text-sm font-bold text-[#0077B6]">
                            Seleccionar logo
                            <input
                                type="file"
                                accept="image/*"
                                class="hidden"
                                @change="handleProfileLogo"
                            >
                        </label>
                    </div>

                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Nombre de la institución
                        </label>
                        <input
                            v-model="profileForm.institutionName"
                            required
                            type="text"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                    </div>

                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Correo electrónico
                        </label>
                        <input
                            :value="institution.email"
                            disabled
                            type="email"
                            class="w-full cursor-not-allowed rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-gray-400"
                        >
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

                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Sitio web
                        </label>
                        <input
                            v-model="profileForm.website"
                            type="url"
                            placeholder="https://..."
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                    </div>

                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Descripción
                        </label>
                        <textarea
                            v-model="profileForm.description"
                            rows="5"
                            class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        ></textarea>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Departamento
                            </label>
                            <select
                                v-model="profileForm.department"
                                class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                                <option value="">
                                    Seleccionar
                                </option>
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
                                type="text"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>
                    </div>

                    <div class="border-t border-gray-100 pt-5">
                        <h3 class="font-black text-gray-700">
                            Cambiar contraseña
                        </h3>
                        <p class="mt-1 text-xs text-gray-400">
                            Deja estos campos vacíos para conservar la contraseña actual.
                        </p>

                        <div class="mt-4 space-y-3">
                            <div class="relative">
                                <input
                                    v-model="currentPassword"
                                    :type="showCurrentPassword ? 'text' : 'password'"
                                    autocomplete="current-password"
                                    placeholder="Contraseña actual"
                                    class="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 outline-none focus:border-[#00B4D8]"
                                >
                                <button
                                    type="button"
                                    class="absolute inset-y-0 right-0 px-4 text-xs font-bold text-gray-400"
                                    @click="showCurrentPassword = !showCurrentPassword"
                                >
                                    Ver
                                </button>
                            </div>

                            <div class="relative">
                                <input
                                    v-model="newPassword"
                                    :type="showNewPassword ? 'text' : 'password'"
                                    autocomplete="new-password"
                                    placeholder="Nueva contraseña"
                                    class="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 outline-none focus:border-[#00B4D8]"
                                >
                                <button
                                    type="button"
                                    class="absolute inset-y-0 right-0 px-4 text-xs font-bold text-gray-400"
                                    @click="showNewPassword = !showNewPassword"
                                >
                                    Ver
                                </button>
                            </div>

                            <div class="relative">
                                <input
                                    v-model="confirmNewPassword"
                                    :type="showConfirmPassword ? 'text' : 'password'"
                                    autocomplete="new-password"
                                    placeholder="Confirmar nueva contraseña"
                                    class="w-full rounded-xl border border-gray-200 px-4 py-3 pr-12 outline-none focus:border-[#00B4D8]"
                                >
                                <button
                                    type="button"
                                    class="absolute inset-y-0 right-0 px-4 text-xs font-bold text-gray-400"
                                    @click="showConfirmPassword = !showConfirmPassword"
                                >
                                    Ver
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        :disabled="profileSaving"
                        class="w-full rounded-xl bg-[#00B4D8] px-5 py-3.5 text-sm font-black text-white disabled:opacity-60"
                    >
                        {{ profileSaving ? "Guardando..." : "Guardar cambios" }}
                    </button>
                </form>
            </section>
        </div>
    </Teleport>

    <!-- Editor de publicación -->
    <Teleport to="body">
        <div
            v-if="showPostEditor"
            class="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3 sm:p-6"
            @click.self="closePostEditor"
        >
            <section class="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-[28px] bg-white">
                <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-wide text-[#00B4D8]">
                            Contenido institucional
                        </p>
                        <h2 class="text-xl font-black text-gray-700">
                            {{ postEditorTitle }}
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                        @click="closePostEditor"
                    >
                        ×
                    </button>
                </div>

                <form class="space-y-5 p-5 sm:p-7" @submit.prevent="savePost">
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Título
                        </label>
                        <input
                            v-model="postForm.title"
                            required
                            maxlength="160"
                            type="text"
                            placeholder="Ejemplo: Taller de marketing digital"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Tipo
                            </label>
                            <select
                                v-model="postForm.postType"
                                class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                                <option
                                    v-for="type in postTypes"
                                    :key="type.value"
                                    :value="type.value"
                                >
                                    {{ type.label }}
                                </option>
                            </select>
                        </div>

                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Estado
                            </label>
                            <select
                                v-model="postForm.status"
                                class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                                <option value="draft">
                                    Borrador
                                </option>
                                <option value="published">
                                    Publicado
                                </option>
                                <option value="archived">
                                    Archivado
                                </option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Descripción
                        </label>
                        <textarea
                            v-model="postForm.description"
                            required
                            rows="7"
                            maxlength="5000"
                            placeholder="Escribe toda la información que necesitan conocer los emprendedores..."
                            class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        ></textarea>
                    </div>

                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Ubicación
                            </label>
                            <input
                                v-model="postForm.location"
                                type="text"
                                placeholder="Lugar del evento o taller"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>

                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Enlace externo
                            </label>
                            <input
                                v-model="postForm.externalUrl"
                                type="url"
                                placeholder="https://..."
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>
                    </div>

                    <div class="grid gap-4 md:grid-cols-3">
                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Inicio del evento
                            </label>
                            <input
                                v-model="postForm.eventDate"
                                type="datetime-local"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>

                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Finalización
                            </label>
                            <input
                                v-model="postForm.eventEndDate"
                                type="datetime-local"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>

                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Fecha límite
                            </label>
                            <input
                                v-model="postForm.deadline"
                                type="datetime-local"
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>
                    </div>

                    <div>
                        <div class="flex items-end justify-between gap-3">
                            <div>
                                <label class="block text-sm font-bold text-gray-600">
                                    Imágenes
                                </label>
                                <p class="mt-1 text-xs text-gray-400">
                                    Máximo 6 imágenes de 5 MB cada una.
                                </p>
                            </div>

                            <label class="cursor-pointer rounded-xl bg-[#CAF0F8] px-4 py-2.5 text-xs font-black text-[#0077B6]">
                                Agregar imágenes
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    class="hidden"
                                    @change="handlePostImages"
                                >
                            </label>
                        </div>

                        <div
                            v-if="editorImages.length"
                            class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"
                        >
                            <div
                                v-for="(image, index) in editorImages"
                                :key="image.id || image.previewUrl"
                                class="overflow-hidden rounded-2xl border border-gray-100 bg-[#F8FBFC]"
                            >
                                <div class="aspect-[4/3]">
                                    <img
                                        :src="image.kind === 'existing' ? image.imageUrl : image.previewUrl"
                                        alt="Imagen de la publicación"
                                        class="h-full w-full object-cover"
                                    >
                                </div>

                                <div class="grid grid-cols-3 gap-1 p-2">
                                    <button
                                        type="button"
                                        class="rounded-lg bg-white py-2 text-xs font-bold text-gray-500"
                                        @click="moveEditorImage(index, -1)"
                                    >
                                        ←
                                    </button>
                                    <button
                                        type="button"
                                        class="rounded-lg bg-white py-2 text-xs font-bold text-gray-500"
                                        @click="moveEditorImage(index, 1)"
                                    >
                                        →
                                    </button>
                                    <button
                                        type="button"
                                        class="rounded-lg bg-red-50 py-2 text-xs font-bold text-red-600"
                                        @click="removeEditorImage(index)"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div
                            v-else
                            class="mt-4 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm font-semibold text-gray-400"
                        >
                            Todavía no has agregado imágenes.
                        </div>
                    </div>

                    <button
                        type="submit"
                        :disabled="postSaving"
                        class="w-full rounded-xl bg-[#00B4D8] px-5 py-3.5 text-sm font-black text-white disabled:opacity-60"
                    >
                        {{ postSaving ? "Guardando..." : postEditorMode === "add" ? "Crear publicación" : "Guardar cambios" }}
                    </button>
                </form>
            </section>
        </div>
    </Teleport>

    <!-- Vista previa de publicación -->
    <Teleport to="body">
        <div
            v-if="showPostPreview && selectedPost"
            class="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-3 sm:p-6"
            @click.self="closePostPreview"
        >
            <section class="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white">
                <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-wide text-[#00B4D8]">
                            Vista previa
                        </p>
                        <h2 class="line-clamp-1 font-black text-gray-700">
                            {{ selectedPost.title }}
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                        @click="closePostPreview"
                    >
                        ×
                    </button>
                </div>

                <div
                    v-if="selectedPost.images.length"
                    class="grid gap-2 p-4 sm:grid-cols-2"
                >
                    <img
                        v-for="image in selectedPost.images"
                        :key="image"
                        :src="image"
                        :alt="selectedPost.title"
                        class="aspect-[16/10] w-full rounded-2xl object-cover"
                    >
                </div>

                <div class="p-5 sm:p-7">
                    <div class="flex flex-wrap gap-2">
                        <span class="rounded-full bg-[#CAF0F8] px-3 py-1 text-xs font-black text-[#0077B6]">
                            {{ postTypeLabel(selectedPost.postType) }}
                        </span>
                        <span
                            class="rounded-full px-3 py-1 text-xs font-black"
                            :class="statusClasses(selectedPost.status)"
                        >
                            {{ statusLabel(selectedPost.status) }}
                        </span>
                    </div>

                    <h2 class="mt-4 text-3xl font-black text-gray-700">
                        {{ selectedPost.title }}
                    </h2>

                    <p class="mt-5 whitespace-pre-line text-sm leading-7 text-gray-500">
                        {{ selectedPost.description }}
                    </p>

                    <div class="mt-6 grid gap-3 sm:grid-cols-2">
                        <div
                            v-if="selectedPost.eventDate"
                            class="rounded-2xl bg-[#F8FBFC] p-4"
                        >
                            <p class="text-xs font-bold uppercase text-gray-400">
                                Fecha
                            </p>
                            <p class="mt-1 text-sm font-bold text-gray-600">
                                {{ formatDateTime(selectedPost.eventDate) }}
                            </p>
                        </div>

                        <div
                            v-if="selectedPost.location"
                            class="rounded-2xl bg-[#F8FBFC] p-4"
                        >
                            <p class="text-xs font-bold uppercase text-gray-400">
                                Ubicación
                            </p>
                            <p class="mt-1 text-sm font-bold text-gray-600">
                                {{ selectedPost.location }}
                            </p>
                        </div>

                        <div
                            v-if="selectedPost.deadline"
                            class="rounded-2xl bg-[#F8FBFC] p-4"
                        >
                            <p class="text-xs font-bold uppercase text-gray-400">
                                Fecha límite
                            </p>
                            <p class="mt-1 text-sm font-bold text-gray-600">
                                {{ formatDateTime(selectedPost.deadline) }}
                            </p>
                        </div>

                        <a
                            v-if="selectedPost.externalUrl"
                            :href="selectedPost.externalUrl"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="flex items-center justify-center rounded-2xl bg-[#00B4D8] p-4 text-sm font-black text-white"
                        >
                            Abrir enlace
                        </a>
                    </div>

                    <div class="mt-6 grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            class="rounded-xl bg-[#CAF0F8] px-4 py-3 text-sm font-black text-[#0077B6]"
                            @click="closePostPreview(); openEditPost(selectedPost)"
                        >
                            Editar
                        </button>

                        <button
                            type="button"
                            class="rounded-xl border border-red-200 px-4 py-3 text-sm font-black text-red-600"
                            @click="closePostPreview(); deletePost(selectedPost)"
                        >
                            Eliminar
                        </button>
                    </div>
                </div>
            </section>
        </div>
    </Teleport>
</div>
</template>

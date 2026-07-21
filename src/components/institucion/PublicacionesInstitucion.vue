<script setup>
// Crea, edita y previsualiza publicaciones institucionales.
import {
    ref,
    computed,
    onMounted,
    onBeforeUnmount
} from "vue";
import { supabase } from "../../lib/supabaseClient";
import {
    uploadInstitutionPostImages,
    deleteInstitutionImages
} from "../../lib/institutionStorage";
import NovedadDetalleModal from "../compartidos/NovedadDetalleModal.vue";

const props = defineProps({
    institution: {
        type: Object,
        required: true
    }
});

const posts = ref([]);
const loading = ref(true);
const loadError = ref("");
const saving = ref(false);
const showEditor = ref(false);
const showPreview = ref(false);
const editorMode = ref("add");
const selectedPost = ref(null);
const editorImages = ref([]);
const originalImages = ref([]);

const form = ref({
    title: "",
    description: "",
    postType: "noticia",
    location: "",
    externalUrl: "",
    eventDate: "",
    eventEndDate: "",
    deadline: "",
    requiresRegistration: false,
    availableSpots: "",
    contactPhone: "",
    status: "draft"
});

const postTypes = [
    ["noticia", "Noticia"],
    ["taller", "Taller"],
    ["evento", "Evento"],
    ["convocatoria", "Convocatoria"],
    ["oportunidad", "Oportunidad"],
    ["anuncio", "Anuncio"]
];

const editorTitle = computed(function () {
    return editorMode.value === "add"
        ? "Crear publicación"
        : "Editar publicación";
});

const previewPost = computed(function () {
    if (!selectedPost.value) {
        return null;
    }

    return {
        ...selectedPost.value,
        institutionName:
            props.institution.institutionName,
        institutionLogo:
            props.institution.logoUrl
    };
});

function typeLabel(type) {
    return (
        postTypes.find(function (item) {
            return item[0] === type;
        })?.[1] ||
        "Publicación"
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

function isInformativeType(type) {
    return [
        "noticia",
        "anuncio"
    ].includes(type);
}

function supportsAttendance(type) {
    return [
        "taller",
        "evento",
        "convocatoria",
        "oportunidad"
    ].includes(type);
}

function formatDate(date) {
    if (!date) return "";

    return new Intl.DateTimeFormat(
        "es-SV",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    ).format(
        new Date(date)
    );
}

function cardDate(post) {
    if (
        isInformativeType(
            post.postType
        )
    ) {
        return "";
    }

    if (post.eventDate) {
        return formatDate(
            post.eventDate
        );
    }

    if (post.deadline) {
        return `Hasta ${formatDate(
            post.deadline
        )}`;
    }

    return formatDate(
        post.createdAt
    );
}

function toInputDateTime(date) {
    if (!date) return "";

    const value =
        new Date(date);

    const offset =
        value.getTimezoneOffset() *
        60000;

    return new Date(
        value.getTime() -
        offset
    )
        .toISOString()
        .slice(0, 16);
}

function toIso(value) {
    return value
        ? new Date(value).toISOString()
        : null;
}

function createLocalPreview(file) {
    return URL.createObjectURL(file);
}

function revokeLocalPreview(image) {
    if (
        image?.kind === "new" &&
        image.preview
    ) {
        URL.revokeObjectURL(
            image.preview
        );
    }
}

function emptyForm() {
    return {
        title: "",
        description: "",
        postType: "noticia",
        location: "",
        externalUrl: "",
        eventDate: "",
        eventEndDate: "",
        deadline: "",
        requiresRegistration: false,
        availableSpots: "",
        contactPhone:
            props.institution.phone ||
            "",
        status: "draft"
    };
}

function resetForm() {
    editorImages.value.forEach(
        revokeLocalPreview
    );

    form.value = emptyForm();
    editorImages.value = [];
    originalImages.value = [];
}

async function loadPosts() {
    loading.value = true;
    loadError.value = "";

    try {
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
                requires_registration,
                available_spots,
                contact_phone,
                status,
                published_at,
                created_at,
                updated_at
            `)
            .eq(
                "institution_id",
                props.institution.id
            )
            .order("created_at", {
                ascending: false
            });

        if (postError) {
            throw postError;
        }

        const rows =
            postRows || [];

        const postIds =
            rows.map(function (post) {
                return post.id;
            });

        let imageRows = [];

        if (postIds.length) {
            const {
                data,
                error
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

            if (error) {
                throw error;
            }

            imageRows =
                data || [];
        }

        posts.value =
            rows.map(function (post) {
                const imageRecords =
                    imageRows
                        .filter(
                            function (image) {
                                return (
                                    image.post_id ===
                                    post.id
                                );
                            }
                        )
                        .map(
                            function (image) {
                                return {
                                    id:
                                        image.id,
                                    imageUrl:
                                        image.image_url,
                                    storagePath:
                                        image.storage_path,
                                    sortOrder:
                                        image.sort_order
                                };
                            }
                        );

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
                    requiresRegistration:
                        post.requires_registration,
                    availableSpots:
                        post.available_spots,
                    contactPhone:
                        post.contact_phone || "",
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
                        imageRecords,
                    cover:
                        imageRecords[0]?.imageUrl ||
                        ""
                };
            });
    } catch (error) {
        console.error(
            "Error al cargar publicaciones:",
            error
        );

        loadError.value =
            "No fue posible cargar las publicaciones.";
    } finally {
        loading.value = false;
    }
}

function openAddPost() {
    editorMode.value = "add";
    selectedPost.value = null;
    resetForm();
    showEditor.value = true;
    document.body.style.overflow =
        "hidden";
}

function openEditPost(post) {
    editorMode.value = "edit";
    selectedPost.value = post;

    form.value = {
        title:
            post.title,
        description:
            post.description,
        postType:
            post.postType,
        location:
            post.location,
        externalUrl:
            post.externalUrl,
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
        requiresRegistration:
            post.requiresRegistration,
        availableSpots:
            post.availableSpots ??
            "",
        contactPhone:
            post.contactPhone ||
            props.institution.phone ||
            "",
        status:
            post.status
    };

    editorImages.value =
        post.imageRecords.map(
            function (image) {
                return {
                    kind: "existing",
                    id:
                        image.id,
                    preview:
                        image.imageUrl,
                    storagePath:
                        image.storagePath
                };
            }
        );

    originalImages.value =
        post.imageRecords.map(
            function (image) {
                return {
                    id:
                        image.id,
                    storagePath:
                        image.storagePath
                };
            }
        );

    showEditor.value = true;
    document.body.style.overflow =
        "hidden";
}

function closeEditor() {
    showEditor.value = false;
    selectedPost.value = null;
    resetForm();
    document.body.style.overflow = "";
}

function openPreview(post) {
    selectedPost.value = post;
    showPreview.value = true;
    document.body.style.overflow =
        "hidden";
}

function closePreview() {
    showPreview.value = false;
    selectedPost.value = null;
    document.body.style.overflow = "";
}

function editFromPreview() {
    const post =
        selectedPost.value;

    showPreview.value = false;

    if (post) {
        openEditPost(post);
    }
}

function deleteFromPreview() {
    const post =
        selectedPost.value;

    showPreview.value = false;
    selectedPost.value = null;
    document.body.style.overflow = "";

    if (post) {
        deletePost(post);
    }
}

function handleImages(event) {
    const files =
        Array.from(
            event.target.files ||
            []
        );

    if (!files.length) {
        return;
    }

    const available =
        6 -
        editorImages.value.length;

    if (available <= 0) {
        alert(
            "Puedes subir hasta 6 imágenes."
        );

        event.target.value = "";
        return;
    }

    const validFiles =
        files
            .filter(
                function (file) {
                    return (
                        file.type.startsWith(
                            "image/"
                        ) &&
                        file.size <=
                        5 * 1024 * 1024
                    );
                }
            )
            .slice(0, available);

    if (
        validFiles.length !==
        files.slice(
            0,
            available
        ).length
    ) {
        alert(
            "Algunas imágenes no eran válidas o superaban los 5 MB."
        );
    }

    validFiles.forEach(
        function (file) {
            editorImages.value.push({
                kind: "new",
                file,
                preview:
                    createLocalPreview(
                        file
                    ),
                key:
                    crypto.randomUUID()
            });
        }
    );

    event.target.value = "";
}

function removeImage(index) {
    revokeLocalPreview(
        editorImages.value[index]
    );

    editorImages.value.splice(
        index,
        1
    );
}

function makeCover(index) {
    if (index <= 0) {
        return;
    }

    const image =
        editorImages.value.splice(
            index,
            1
        )[0];

    editorImages.value.unshift(
        image
    );
}

async function savePost() {
    if (saving.value) {
        return;
    }

    if (
        !form.value.title.trim() ||
        !form.value.description.trim()
    ) {
        alert(
            "Escribe el título y la descripción."
        );
        return;
    }

    const attendancePost =
        supportsAttendance(
            form.value.postType
        );

    if (
        attendancePost &&
        !form.value.contactPhone.trim() &&
        !form.value.externalUrl.trim()
    ) {
        alert(
            "Agrega un WhatsApp de contacto o un enlace para que los emprendedores puedan inscribirse."
        );
        return;
    }

    if (
        form.value.requiresRegistration &&
        (
            form.value.availableSpots === "" ||
            Number(
                form.value.availableSpots
            ) < 0
        )
    ) {
        alert(
            "Escribe una cantidad válida de cupos disponibles."
        );
        return;
    }

    saving.value = true;

    let createdPostId = "";
    let uploaded = [];

    try {
        const informativePost =
            isInformativeType(
                form.value.postType
            );

        const payload = {
            institution_id:
                props.institution.id,
            title:
                form.value.title.trim(),
            description:
                form.value.description.trim(),
            post_type:
                form.value.postType,
            location:
                informativePost
                    ? null
                    : form.value.location.trim() ||
                      null,
            external_url:
                form.value.externalUrl.trim() ||
                null,
            event_date:
                informativePost
                    ? null
                    : toIso(
                        form.value.eventDate
                    ),
            event_end_date:
                informativePost
                    ? null
                    : toIso(
                        form.value.eventEndDate
                    ),
            deadline:
                informativePost
                    ? null
                    : toIso(
                        form.value.deadline
                    ),
            requires_registration:
                informativePost
                    ? false
                    : Boolean(
                        form.value.requiresRegistration
                    ),
            available_spots:
                informativePost ||
                !form.value.requiresRegistration
                    ? null
                    : Number(
                        form.value.availableSpots
                    ),
            contact_phone:
                attendancePost
                    ? form.value.contactPhone.trim() ||
                      null
                    : null,
            status:
                form.value.status,
            published_at:
                form.value.status ===
                "published"
                    ? selectedPost.value?.publishedAt ||
                      new Date().toISOString()
                    : null
        };

        let postId = "";

        if (
            editorMode.value ===
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

            const { error } =
                await supabase
                    .from("institution_posts")
                    .update(payload)
                    .eq("id", postId)
                    .eq(
                        "institution_id",
                        props.institution.id
                    );

            if (error) {
                throw error;
            }
        }

        const newImages =
            editorImages.value.filter(
                function (image) {
                    return (
                        image.kind ===
                        "new"
                    );
                }
            );

        uploaded =
            await uploadInstitutionPostImages(
                props.institution.id,
                postId,
                newImages.map(
                    function (image) {
                        return image.file;
                    }
                )
            );

        const uploadByFile =
            new Map();

        newImages.forEach(
            function (image, index) {
                uploadByFile.set(
                    image.file,
                    uploaded[index]
                );
            }
        );

        const finalImages =
            editorImages.value.map(
                function (
                    image,
                    index
                ) {
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

                    const uploadedImage =
                        uploadByFile.get(
                            image.file
                        );

                    return {
                        kind:
                            "new",
                        imageUrl:
                            uploadedImage.publicUrl,
                        storagePath:
                            uploadedImage.path,
                        sortOrder:
                            index
                    };
                }
            );

        const newRows =
            finalImages
                .filter(
                    function (image) {
                        return (
                            image.kind ===
                            "new"
                        );
                    }
                )
                .map(
                    function (image) {
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
                    }
                );

        if (newRows.length) {
            const { error } =
                await supabase
                    .from("institution_post_images")
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
            const image of
            existingImages
        ) {
            const { error } =
                await supabase
                    .from("institution_post_images")
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
            editorMode.value ===
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

            const removed =
                originalImages.value.filter(
                    function (image) {
                        return !currentIds.has(
                            image.id
                        );
                    }
                );

            if (removed.length) {
                const { error } =
                    await supabase
                        .from("institution_post_images")
                        .delete()
                        .in(
                            "id",
                            removed.map(
                                function (image) {
                                    return image.id;
                                }
                            )
                        );

                if (error) {
                    throw error;
                }

                try {
                    await deleteInstitutionImages(
                        removed.map(
                            function (image) {
                                return (
                                    image.storagePath
                                );
                            }
                        )
                    );
                } catch (storageError) {
                    console.warn(
                        "No se borraron algunas imágenes anteriores:",
                        storageError
                    );
                }
            }
        }

        await loadPosts();

        alert(
            editorMode.value ===
                "add"
                ? "Publicación creada correctamente."
                : "Publicación actualizada correctamente."
        );

        closeEditor();
    } catch (error) {
        console.error(
            "Error al guardar publicación:",
            error
        );

        if (uploaded.length) {
            try {
                await deleteInstitutionImages(
                    uploaded.map(
                        function (image) {
                            return image.path;
                        }
                    )
                );
            } catch (cleanupError) {
                console.warn(
                    "No se limpiaron algunas imágenes nuevas:",
                    cleanupError
                );
            }
        }

        if (createdPostId) {
            await supabase
                .from("institution_posts")
                .delete()
                .eq(
                    "id",
                    createdPostId
                );
        }

        alert(
            "No fue posible guardar la publicación: " +
            (
                error.message ||
                "Error inesperado"
            )
        );
    } finally {
        saving.value = false;
    }
}

async function deletePost(post) {
    if (
        !post ||
        saving.value
    ) {
        return;
    }

    const confirmed =
        window.confirm(
            `¿Deseas eliminar "${post.title}"?`
        );

    if (!confirmed) {
        return;
    }

    saving.value = true;

    try {
        const { error } =
            await supabase
                .from("institution_posts")
                .delete()
                .eq("id", post.id)
                .eq(
                    "institution_id",
                    props.institution.id
                );

        if (error) {
            throw error;
        }

        try {
            await deleteInstitutionImages(
                post.imageRecords.map(
                    function (image) {
                        return (
                            image.storagePath
                        );
                    }
                )
            );
        } catch (storageError) {
            console.warn(
                "La publicación se eliminó, pero algunas imágenes quedaron en Storage:",
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
        saving.value = false;
    }
}

function handleEscape(event) {
    if (event.key !== "Escape") {
        return;
    }

    if (showPreview.value) {
        closePreview();
        return;
    }

    if (showEditor.value) {
        closeEditor();
    }
}

onMounted(function () {
    resetForm();
    loadPosts();

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
        revokeLocalPreview
    );

    document.body.style.overflow = "";
});
</script>

<template>
<section>
    <div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
            <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                Contenido institucional
            </p>
            <h1 class="mt-1 text-2xl font-black text-gray-700 sm:text-3xl">
                Publicaciones
            </h1>
            <p class="mt-1 text-sm text-gray-400">
                Crea contenido y revisa exactamente cómo lo verá el emprendedor.
            </p>
        </div>

        <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00B4D8] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#009CC0] sm:w-auto"
            @click="openAddPost"
        >
            <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" d="M12 5v14M5 12h14"></path>
            </svg>
            Crear publicación
        </button>
    </div>

    <div
        v-if="loading"
        class="rounded-[24px] bg-white px-5 py-20 text-center shadow-sm"
    >
        <div class="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#CAF0F8] border-t-[#00B4D8]"></div>
        <p class="mt-4 text-sm font-semibold text-gray-400">
            Cargando publicaciones...
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
            @click="loadPosts"
        >
            Intentar nuevamente
        </button>
    </div>

    <div
        v-else-if="posts.length"
        class="grid grid-cols-2 gap-x-2 gap-y-6 sm:gap-4 md:grid-cols-3 xl:grid-cols-4"
    >
        <article
            v-for="post in posts"
            :key="post.id"
            class="group min-w-0 overflow-hidden"
        >
            <button
                type="button"
                class="relative block w-full overflow-hidden rounded-2xl bg-[#EAF9FC] text-left shadow-sm"
                @click="openPreview(post)"
            >
                <img
                    v-if="post.cover"
                    :src="post.cover"
                    :alt="post.title"
                    class="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                >

                <div
                    v-else
                    class="flex aspect-square items-center justify-center bg-gradient-to-br from-[#CAF0F8] to-[#EAF9FC] text-xs font-black text-[#0077B6]"
                >
                    {{ typeLabel(post.postType) }}
                </div>

                <span class="absolute left-2 top-2 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black uppercase text-[#0077B6] shadow-sm">
                    {{ typeLabel(post.postType) }}
                </span>

                <span
                    v-if="post.imageRecords.length > 1"
                    class="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-[9px] font-bold text-white"
                >
                    {{ post.imageRecords.length }} imágenes
                </span>
            </button>

            <div class="pt-3 sm:px-1">
                <div class="flex items-center justify-between gap-2">
                    <span
                        class="rounded-full px-2.5 py-1 text-[9px] font-black"
                        :class="statusClasses(post.status)"
                    >
                        {{ statusLabel(post.status) }}
                    </span>

                    <span
                        v-if="post.requiresRegistration && post.availableSpots !== null"
                        class="text-[9px] font-black"
                        :class="Number(post.availableSpots) > 0 ? 'text-green-600' : 'text-red-600'"
                    >
                        {{ Number(post.availableSpots) > 0 ? `${post.availableSpots} cupos` : "Sin cupos" }}
                    </span>
                </div>

                <h2 class="mt-2 line-clamp-2 min-h-[34px] text-xs font-black leading-tight text-gray-600 sm:min-h-[40px] sm:text-sm">
                    {{ post.title }}
                </h2>

                <!-- Noticias y anuncios no muestran la fecha de creación. -->
                <p
                    v-if="cardDate(post)"
                    class="mt-2 text-[10px] font-semibold text-gray-400 sm:text-xs"
                >
                    {{ cardDate(post) }}
                </p>

                <div class="mt-3 grid grid-cols-3 gap-2">
                    <button
                        type="button"
                        class="rounded-xl border border-[#00B4D8] px-2 py-2 text-[10px] font-black text-[#0077B6] sm:text-[10px]"
                        @click="openPreview(post)"
                    >
                        Vista
                    </button>

                    <button
                        type="button"
                        class="rounded-xl bg-[#CAF0F8] px-2 py-2 text-[10px] font-bold text-[#0077B6] sm:text-xs"
                        @click="openEditPost(post)"
                    >
                        Editar
                    </button>

                    <button
                        type="button"
                        class="rounded-xl border border-red-200 px-2 py-2 text-[10px] font-bold text-red-600 sm:text-xs"
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
        class="rounded-[24px] border border-dashed border-[#90E0EF] bg-white px-5 py-16 text-center"
    >
        <h3 class="font-black text-gray-700">
            Aún no tienes publicaciones
        </h3>
        <p class="mt-1 text-sm text-gray-400">
            Publica una noticia, taller o evento para los emprendedores.
        </p>
        <button
            type="button"
            class="mt-5 rounded-xl bg-[#00B4D8] px-6 py-3 text-sm font-bold text-white"
            @click="openAddPost"
        >
            Crear publicación
        </button>
    </div>

    <!-- Crear o editar publicación. -->
    <Teleport to="body">
        <div
            v-if="showEditor"
            class="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
            @click.self="closeEditor"
        >
            <section class="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[720px] sm:rounded-[28px]">
                <div class="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                    <div>
                        <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                            Contenido institucional
                        </p>
                        <h2 class="text-lg font-black text-gray-700">
                            {{ editorTitle }}
                        </h2>
                    </div>

                    <button
                        type="button"
                        class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                        @click="closeEditor"
                    >
                        ×
                    </button>
                </div>

                <form
                    class="space-y-5 p-5 sm:p-7"
                    @submit.prevent="savePost"
                >
                    <!-- Imágenes -->
                    <div>
                        <label class="block text-sm font-bold text-gray-600">
                            Imágenes
                        </label>
                        <p class="mt-1 text-xs text-gray-400">
                            La primera será la portada. El emprendedor podrá desplazarse entre todas.
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
                                    alt="Publicación"
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
                                        @click="makeCover(index)"
                                    >
                                        ★
                                    </button>

                                    <button
                                        type="button"
                                        title="Eliminar"
                                        class="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                                        @click="removeImage(index)"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        </div>

                        <label class="mt-4 flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-[#90E0EF] bg-[#F7FCFD] px-4 py-5 text-sm font-bold text-[#0077B6] transition hover:bg-[#CAF0F8]">
                            Añadir imágenes
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                class="hidden"
                                @change="handleImages"
                            >
                        </label>
                    </div>

                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Título
                        </label>
                        <input
                            v-model="form.title"
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
                                v-model="form.postType"
                                class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                                <option
                                    v-for="type in postTypes"
                                    :key="type[0]"
                                    :value="type[0]"
                                >
                                    {{ type[1] }}
                                </option>
                            </select>
                        </div>

                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Estado
                            </label>
                            <select
                                v-model="form.status"
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
                            v-model="form.description"
                            required
                            rows="6"
                            maxlength="5000"
                            placeholder="Escribe toda la información importante..."
                            class="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        ></textarea>
                    </div>

                    <!-- Estos datos no aparecen para noticias ni anuncios. -->
                    <template v-if="!isInformativeType(form.postType)">
                        <div class="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                    Ubicación
                                </label>
                                <input
                                    v-model="form.location"
                                    type="text"
                                    placeholder="Lugar del taller o evento"
                                    class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                                >
                            </div>

                            <div>
                                <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                    WhatsApp de contacto
                                </label>
                                <input
                                    v-model="form.contactPhone"
                                    type="tel"
                                    placeholder="Ejemplo: 7000 0000"
                                    class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                                >
                            </div>
                        </div>

                        <div>
                            <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                Enlace externo o de inscripción
                            </label>
                            <input
                                v-model="form.externalUrl"
                                type="url"
                                placeholder="https://..."
                                class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            >
                        </div>

                        <div class="grid gap-4 md:grid-cols-3">
                            <div>
                                <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                    Inicio
                                </label>
                                <input
                                    v-model="form.eventDate"
                                    type="datetime-local"
                                    class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                                >
                            </div>

                            <div>
                                <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                    Finalización
                                </label>
                                <input
                                    v-model="form.eventEndDate"
                                    type="datetime-local"
                                    class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                                >
                            </div>

                            <div>
                                <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                    Fecha límite
                                </label>
                                <input
                                    v-model="form.deadline"
                                    type="datetime-local"
                                    class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                                >
                            </div>
                        </div>

                        <!-- Cupos -->
                        <div class="rounded-2xl bg-[#F8FBFC] p-4 sm:p-5">
                            <label class="flex cursor-pointer items-start gap-3">
                                <input
                                    v-model="form.requiresRegistration"
                                    type="checkbox"
                                    class="mt-1 h-4 w-4 accent-[#00B4D8]"
                                >
                                <span>
                                    <span class="block text-sm font-black text-gray-700">
                                        Esta actividad requiere inscripción o tiene cupos
                                    </span>
                                    <span class="mt-1 block text-xs leading-5 text-gray-400">
                                        Actívalo para mostrarle al emprendedor cuántos cupos quedan.
                                    </span>
                                </span>
                            </label>

                            <div
                                v-if="form.requiresRegistration"
                                class="mt-4"
                            >
                                <label class="mb-1.5 block text-sm font-bold text-gray-600">
                                    Cupos disponibles
                                </label>
                                <input
                                    v-model.number="form.availableSpots"
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="Ejemplo: 30"
                                    class="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#00B4D8]"
                                >
                            </div>
                        </div>
                    </template>

                    <!-- Noticias y anuncios sí pueden tener un enlace informativo. -->
                    <div v-else>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Enlace externo opcional
                        </label>
                        <input
                            v-model="form.externalUrl"
                            type="url"
                            placeholder="https://..."
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        >
                    </div>

                    <button
                        type="submit"
                        :disabled="saving"
                        class="w-full rounded-xl bg-[#00B4D8] px-5 py-3 font-bold text-white disabled:opacity-50"
                    >
                        {{ saving ? "Guardando..." : editorMode === "add" ? "Crear publicación" : "Guardar cambios" }}
                    </button>
                </form>
            </section>
        </div>
    </Teleport>

    <!-- La misma visualización que recibe el emprendedor. -->
    <NovedadDetalleModal
        :show="showPreview"
        :post="previewPost"
        :can-manage="true"
        @close="closePreview"
        @edit="editFromPreview"
        @delete="deleteFromPreview"
    />
</section>
</template>
import { supabase } from "./supabaseClient";
// Nombre del bucket donde guardamos las imágenes de Thrive.
const BUCKET_NAME = "thrive-images";
// Obtiene la extensión original de una imagen.
function getFileExtension(file) {
    const parts = file.name.split(".");
    if (parts.length < 2) {
        return "jpg";
    }
    return parts.pop().toLowerCase();
}
// Genera un nombre único para cada imagen.
function createUniqueFileName(file) {
    const extension = getFileExtension(file);
    const randomId =
        typeof crypto !== "undefined" &&
        crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${randomId}.${extension}`;
}
// Valida que el archivo sea una imagen y no supere 5 MB.
function validateImage(file) {
    if (!file) {
        throw new Error(
            "No se seleccionó ninguna imagen."
        );
    }
    if (!file.type.startsWith("image/")) {
        throw new Error(
            "El archivo seleccionado debe ser una imagen."
        );
    }
    const maxSize =
        5 * 1024 * 1024;
    if (file.size > maxSize) {
        throw new Error(
            "La imagen no puede superar los 5 MB."
        );
    }
}
// ===============================
// FOTO DE PERFIL DEL CLIENTE
// ===============================
export async function uploadProfileImage(
    userId,
    file
) {
    validateImage(file);
    const fileName =
        createUniqueFileName(file);
    const filePath =
        `${userId}/profile/${fileName}`;
    const { error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .upload(
            filePath,
            file,
            {
                cacheControl: "3600",
                upsert: false
            }
        );
    if (error) {
        throw error;
    }
    const { data } = supabase
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);
    return {
        path: filePath,
        publicUrl: data.publicUrl
    };
}
// ===============================
// FOTO DEL EMPRENDIMIENTO
// ===============================
export async function uploadEntrepreneurLogo(
    userId,
    file
) {
    validateImage(file);
    const fileName =
        createUniqueFileName(file);
    const filePath =
        `${userId}/entrepreneur/${fileName}`;
    const { error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .upload(
            filePath,
            file,
            {
                cacheControl: "3600",
                upsert: false
            }
        );
    if (error) {
        throw error;
    }
    const { data } = supabase
        .storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);
    return {
        path: filePath,
        publicUrl: data.publicUrl
    };
}
// ===============================
// IMÁGENES DE PRODUCTOS
// ===============================
export async function uploadProductImages(
    userId,
    productId,
    files
) {
    const uploadedImages = [];
    /*
        Recorremos todas las imágenes seleccionadas
        y las subimos una por una.
    */
    for (const file of files) {
        validateImage(file);
        const fileName =
            createUniqueFileName(file);
        const filePath =
            `${userId}/products/${productId}/${fileName}`;
        const { error } = await supabase
            .storage
            .from(BUCKET_NAME)
            .upload(
                filePath,
                file,
                {
                    cacheControl: "3600",
                    upsert: false
                }
            );
        if (error) {
            throw error;
        }
        /*
            Como nuestro bucket es público,
            obtenemos la URL que utilizaremos
            para mostrar la fotografía.
        */
        const { data } = supabase
            .storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);
        uploadedImages.push({
            path: filePath,
            publicUrl: data.publicUrl
        });
    }
    return uploadedImages;
}
// ===============================
// ELIMINAR UNA IMAGEN
// ===============================
export async function deleteImage(
    filePath
) {
    if (!filePath) {
        return;
    }
    const { error } = await supabase
        .storage
        .from(BUCKET_NAME)
        .remove([
            filePath
        ]);
    if (error) {
        throw error;
    }
}
// Obtiene la ruta interna de Storage utilizando una URL pública.
// Esto nos permite eliminar una fotografía antigua aunque
// solamente tengamos guardada su URL en la base de datos.
export function getStoragePathFromPublicUrl(publicUrl) {
    if (!publicUrl) {
        return null;
    }
    const marker =
        `/storage/v1/object/public/${BUCKET_NAME}/`;
    const markerIndex =
        publicUrl.indexOf(marker);
    if (markerIndex === -1) {
        return null;
    }
    const encodedPath =
        publicUrl.slice(
            markerIndex + marker.length
        );
    try {
        return decodeURIComponent(encodedPath);
    } catch {
        return encodedPath;
    }
}

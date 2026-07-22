// Funciones de Storage usadas únicamente por el panel institucional.
import { supabase } from "./supabaseClient";
const bucketName = "thrive-images";
function cleanFileName(name) {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9.]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
function extensionFromFile(file) {
    return file.name.split(".").pop()?.toLowerCase() || "jpg";
}
async function uploadFile(path, file) {
    const { error } = await supabase.storage
        .from(bucketName)
        .upload(path, file, {
            cacheControl: "3600",
            upsert: false
        });
    if (error) throw error;
    const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(path);
    return {
        path,
        publicUrl: data.publicUrl
    };
}
export function getInstitutionStoragePath(publicUrl) {
    if (!publicUrl) return "";
    const marker =
        `/storage/v1/object/public/${bucketName}/`;
    const index = publicUrl.indexOf(marker);
    if (index === -1) return "";
    return decodeURIComponent(
        publicUrl.slice(index + marker.length)
    );
}
export async function uploadInstitutionLogo(userId, file) {
    const fileName =
        `${Date.now()}-${crypto.randomUUID()}.${extensionFromFile(file)}`;
    const path =
        `${userId}/institutions/logo/${fileName}`;
    return uploadFile(path, file);
}
export async function uploadInstitutionPostImages(
    userId,
    postId,
    files
) {
    const uploaded = [];
    for (
        let index = 0;
        index < files.length;
        index += 1
    ) {
        const file = files[index];
        const name =
            cleanFileName(
                file.name.replace(/\.[^.]+$/, "")
            ) || "imagen";
        const fileName =
            `${Date.now()}-${index}-${name}-${crypto.randomUUID()}.${extensionFromFile(file)}`;
        const path =
            `${userId}/institutions/posts/${postId}/${fileName}`;
        uploaded.push(
            await uploadFile(path, file)
        );
    }
    return uploaded;
}
export async function deleteInstitutionImages(paths) {
    const validPaths = paths.filter(Boolean);
    if (!validPaths.length) return;
    const { error } = await supabase.storage
        .from(bucketName)
        .remove(validPaths);
    if (error) throw error;
}

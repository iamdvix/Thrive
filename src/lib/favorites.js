import { supabase } from "./supabaseClient";

export async function loadMyFavoriteProductIds() {
    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();
    if (userError || !user) return [];
    const { data, error } = await supabase
        .from("product_favorites")
        .select("product_id")
        .eq("user_id", user.id);
    if (error) throw error;
    return (data || []).map(function (row) {
        return row.product_id;
    });
}

export async function setProductFavorite(productId, shouldFavorite) {
    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();
    if (userError || !user) {
        throw new Error("No se encontró una sesión activa.");
    }
    if (shouldFavorite) {
        const { error } = await supabase
            .from("product_favorites")
            .upsert(
                {
                    user_id: user.id,
                    product_id: productId
                },
                {
                    onConflict: "user_id,product_id"
                }
            );
        if (error) throw error;
        return true;
    }
    const { error } = await supabase
        .from("product_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);
    if (error) throw error;
    return false;
}

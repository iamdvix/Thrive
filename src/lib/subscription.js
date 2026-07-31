import { supabase } from "./supabaseClient";

export function subscriptionIsActive(subscription) {
    if (!subscription) return false;
    if (subscription.status !== "active") return false;
    if (!subscription.expiresAt) return true;
    return new Date(subscription.expiresAt).getTime() > Date.now();
}

export function subscriptionStatusLabel(status) {
    const labels = {
        active: "Plan activo",
        pending: "Pago pendiente",
        past_due: "Pago pendiente",
        canceled: "Plan cancelado",
        inactive: "Sin suscripción"
    };
    return labels[status] || "Sin suscripción";
}

export async function startSubscriptionCheckout() {
    const { data, error } = await supabase.functions.invoke(
        "create-subscription-checkout"
    );
    if (error) throw error;
    if (!data?.url) {
        throw new Error(
            "No se recibió el enlace de pago. Revisa la configuración de Stripe en Supabase."
        );
    }
    window.location.assign(data.url);
}

import { supabase } from "./supabaseClient";

export function subscriptionIsActive(subscription) {
    if (!subscription) return false;
    if (subscription.status !== "active") return false;
    if (!subscription.expiresAt) return true;

    return (
        new Date(
            subscription.expiresAt
        ).getTime() >
        Date.now()
    );
}

export function subscriptionStatusLabel(status) {
    const labels = {
        active: "Plan activo",
        pending: "Pago pendiente",
        past_due: "Pago pendiente",
        canceled: "Plan cancelado",
        inactive: "Sin suscripción"
    };

    return (
        labels[status] ||
        "Sin suscripción"
    );
}

// Activa el plan de demostración desde una función segura de Supabase.
// Ningún dato de tarjeta se envía ni se almacena.
export async function activateDemoSubscription() {
    const { data, error } = await supabase.rpc(
        "activate_demo_subscription"
    );

    if (error) {
        throw error;
    }

    const result =
        Array.isArray(data)
            ? data[0]
            : data;

    if (!result) {
        throw new Error(
            "Supabase no devolvió la información del plan."
        );
    }

    return {
        status:
            result.status ||
            "active",
        price:
            Number(
                result.price
            ) || 4.99,
        startedAt:
            result.started_at ||
            null,
        expiresAt:
            result.expires_at ||
            null
    };
}

// Se conserva este nombre para evitar errores en código antiguo.
// La nueva versión ya no depende de Stripe ni de Edge Functions.
export async function startSubscriptionCheckout() {
    return activateDemoSubscription();
}

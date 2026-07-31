<script setup>
// Formulario de pago exclusivamente demostrativo.
// Valida una tarjeta de prueba, pero no guarda ni envía sus datos.
import {
    ref,
    watch
} from "vue";

const props = defineProps({
    show: {
        type: Boolean,
        default: false
    },
    loading: {
        type: Boolean,
        default: false
    },
    price: {
        type: Number,
        default: 4.99
    }
});

const emit = defineEmits([
    "close",
    "confirm"
]);

const cardholder = ref("");
const cardNumber = ref("");
const expiry = ref("");
const cvc = ref("");
const accepted = ref(false);

watch(
    function () {
        return props.show;
    },
    function (show) {
        if (!show) {
            resetForm();
        }
    }
);

function onlyDigits(value) {
    return String(
        value || ""
    ).replace(/\D/g, "");
}

function formatCardNumber(event) {
    const digits =
        onlyDigits(
            event.target.value
        ).slice(0, 16);

    cardNumber.value =
        digits.replace(
            /(\d{4})(?=\d)/g,
            "$1 "
        );
}

function formatExpiry(event) {
    const digits =
        onlyDigits(
            event.target.value
        ).slice(0, 4);

    expiry.value =
        digits.length > 2
            ? `${digits.slice(0, 2)}/${digits.slice(2)}`
            : digits;
}

function formatCvc(event) {
    cvc.value =
        onlyDigits(
            event.target.value
        ).slice(0, 3);
}

function useTestCard() {
    cardholder.value =
        "Cuenta de demostración";
    cardNumber.value =
        "4242 4242 4242 4242";
    expiry.value =
        "12/30";
    cvc.value =
        "123";
    accepted.value =
        true;
}

function resetForm() {
    cardholder.value = "";
    cardNumber.value = "";
    expiry.value = "";
    cvc.value = "";
    accepted.value = false;
}

function closeModal() {
    if (props.loading) return;
    emit("close");
}

function validateExpiry() {
    const match =
        expiry.value.match(
            /^(\d{2})\/(\d{2})$/
        );

    if (!match) {
        return false;
    }

    const month =
        Number(match[1]);
    const year =
        2000 +
        Number(match[2]);

    if (
        month < 1 ||
        month > 12
    ) {
        return false;
    }

    const expiration =
        new Date(
            year,
            month,
            0,
            23,
            59,
            59
        );

    return (
        expiration.getTime() >
        Date.now()
    );
}

function submitPayment() {
    if (props.loading) return;

    if (!cardholder.value.trim()) {
        alert(
            "Escribe el nombre del titular."
        );
        return;
    }

    if (
        onlyDigits(
            cardNumber.value
        ) !==
        "4242424242424242"
    ) {
        alert(
            "Para esta demostración utiliza la tarjeta 4242 4242 4242 4242."
        );
        return;
    }

    if (!validateExpiry()) {
        alert(
            "Escribe una fecha válida en formato MM/AA."
        );
        return;
    }

    if (cvc.value !== "123") {
        alert(
            "Para esta demostración utiliza el CVC 123."
        );
        return;
    }

    if (!accepted.value) {
        alert(
            "Debes confirmar que comprendes que se trata de una demostración."
        );
        return;
    }

    emit("confirm");
}
</script>

<template>
<Teleport to="body">
    <div
        v-if="show"
        class="fixed inset-0 z-[150] flex items-end justify-center bg-black/55 sm:items-center sm:p-5"
        @click.self="closeModal"
    >
        <section class="max-h-[95vh] w-full overflow-y-auto rounded-t-[30px] bg-white sm:max-w-[620px] sm:rounded-[30px]">
            <div class="sticky top-0 z-20 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                <div>
                    <p class="text-xs font-black uppercase tracking-[0.12em] text-[#00B4D8]">
                        Modo demostración
                    </p>

                    <h2 class="text-xl font-black text-gray-700">
                        Activar plan Thrive
                    </h2>
                </div>

                <button
                    type="button"
                    aria-label="Cerrar"
                    class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                    @click="closeModal"
                >
                    ×
                </button>
            </div>

            <form
                class="space-y-5 p-5 sm:p-7"
                @submit.prevent="submitPayment"
            >
                <div class="overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0077B6] to-[#00B4D8] p-5 text-white shadow-sm">
                    <p class="text-xs font-black uppercase tracking-[0.12em] text-white/75">
                        Suscripción mensual
                    </p>

                    <div class="mt-3 flex items-end gap-2">
                        <span class="text-4xl font-black">
                            ${{ Number(price).toFixed(2) }}
                        </span>

                        <span class="pb-1 text-sm font-bold text-white/75">
                            al mes
                        </span>
                    </div>

                    <p class="mt-3 text-sm leading-6 text-white/80">
                        Esta pantalla simula el pago para la presentación del proyecto. No se realizará ningún cobro real.
                    </p>
                </div>

                <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p class="text-sm font-black text-amber-800">
                        Tarjeta de prueba
                    </p>

                    <p class="mt-1 text-xs leading-5 text-amber-700">
                        Usa 4242 4242 4242 4242, cualquier fecha futura y CVC 123. Los datos solamente se validan en tu navegador.
                    </p>

                    <button
                        type="button"
                        class="mt-3 rounded-xl bg-white px-4 py-2 text-xs font-black text-amber-700 shadow-sm"
                        @click="useTestCard"
                    >
                        Completar datos de prueba
                    </button>
                </div>

                <div>
                    <label class="mb-1.5 block text-sm font-bold text-gray-600">
                        Nombre del titular
                    </label>

                    <input
                        v-model="cardholder"
                        type="text"
                        autocomplete="off"
                        placeholder="Nombre completo"
                        class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                    >
                </div>

                <div>
                    <label class="mb-1.5 block text-sm font-bold text-gray-600">
                        Número de tarjeta
                    </label>

                    <input
                        :value="cardNumber"
                        type="text"
                        inputmode="numeric"
                        autocomplete="off"
                        placeholder="4242 4242 4242 4242"
                        class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                        @input="formatCardNumber"
                    >
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            Vencimiento
                        </label>

                        <input
                            :value="expiry"
                            type="text"
                            inputmode="numeric"
                            autocomplete="off"
                            placeholder="MM/AA"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            @input="formatExpiry"
                        >
                    </div>

                    <div>
                        <label class="mb-1.5 block text-sm font-bold text-gray-600">
                            CVC
                        </label>

                        <input
                            :value="cvc"
                            type="password"
                            inputmode="numeric"
                            autocomplete="off"
                            placeholder="123"
                            class="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#00B4D8]"
                            @input="formatCvc"
                        >
                    </div>
                </div>

                <label class="flex cursor-pointer items-start gap-3 rounded-2xl bg-[#F8FBFC] p-4">
                    <input
                        v-model="accepted"
                        type="checkbox"
                        class="mt-1 h-4 w-4 accent-[#00B4D8]"
                    >

                    <span class="text-xs leading-5 text-gray-500">
                        Comprendo que este formulario es una demostración académica, que no se procesará dinero real y que no debo ingresar datos de una tarjeta verdadera.
                    </span>
                </label>

                <button
                    type="submit"
                    :disabled="loading"
                    class="w-full rounded-xl bg-[#00B4D8] px-5 py-3.5 font-black text-white transition hover:bg-[#009CC0] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {{ loading ? "Activando plan..." : "Confirmar suscripción de prueba" }}
                </button>
            </form>
        </section>
    </div>
</Teleport>
</template>

<script setup>
const props = defineProps({
    show: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        default: "cliente"
    }
});
const emit = defineEmits(["close", "accept"]);
</script>

<template>
<Teleport to="body">
    <div
        v-if="show"
        class="fixed inset-0 z-[160] flex items-end justify-center bg-black/60 sm:items-center sm:p-5"
        @click.self="emit('close')"
    >
        <section class="max-h-[94vh] w-full overflow-y-auto rounded-t-[28px] bg-white sm:max-w-[760px] sm:rounded-[28px]">
            <div class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
                <div>
                    <p class="text-xs font-bold uppercase tracking-[0.12em] text-[#00B4D8]">
                        Registro en Thrive
                    </p>
                    <h2 class="text-lg font-black text-gray-700">
                        Términos, privacidad y responsabilidades
                    </h2>
                </div>
                <button
                    type="button"
                    class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500"
                    @click="emit('close')"
                >
                    ×
                </button>
            </div>
            <div class="space-y-6 p-5 text-sm leading-6 text-gray-500 sm:p-7">
                <section>
                    <h3 class="font-black text-gray-700">1. Función de Thrive</h3>
                    <p class="mt-2">
                        Thrive es una plataforma tecnológica que facilita la visibilidad y el contacto entre clientes, emprendimientos e instituciones. Thrive no fabrica, vende, entrega ni garantiza los productos publicados y no actúa como banco, aseguradora, empresa de envíos ni representante legal de los usuarios.
                    </p>
                </section>
                <section>
                    <h3 class="font-black text-gray-700">2. Transacciones y contacto</h3>
                    <p class="mt-2">
                        Los precios, disponibilidad, pagos, entregas, cambios, devoluciones y acuerdos se coordinan directamente entre el cliente y el emprendimiento. Cada usuario debe revisar la información y conservar evidencia de sus acuerdos antes de realizar pagos o entregar productos.
                    </p>
                </section>
                <section v-if="role === 'cliente'">
                    <h3 class="font-black text-gray-700">3. Responsabilidades del cliente</h3>
                    <p class="mt-2">
                        El cliente se compromete a utilizar información verdadera, comunicarse con respeto, verificar los datos del emprendimiento y no utilizar la plataforma para fraude, acoso, suplantación o actividades ilegales. Las reseñas deben reflejar experiencias reales y no contener información ofensiva o engañosa.
                    </p>
                </section>
                <section v-else>
                    <h3 class="font-black text-gray-700">3. Responsabilidades del emprendimiento</h3>
                    <p class="mt-2">
                        El emprendimiento es responsable de que sus productos, fotografías, precios, existencias, descripciones y datos de contacto sean verdaderos. También es responsable de la calidad, legalidad, propiedad intelectual, impuestos, permisos, entregas y atención de reclamos relacionados con su actividad.
                    </p>
                </section>
                <section v-if="role === 'emprendedor'">
                    <h3 class="font-black text-gray-700">4. Plan de suscripción</h3>
                    <p class="mt-2">
                        Las herramientas completas para publicar y administrar productos requieren un plan mensual de $4.99. La renovación es recurrente hasta que se cancele. La cancelación evita renovaciones futuras, pero no elimina inmediatamente el acceso ya pagado durante el periodo vigente. Thrive no garantiza ventas, ganancias ni crecimiento por contratar el plan.
                    </p>
                </section>
                <section>
                    <h3 class="font-black text-gray-700">{{ role === 'emprendedor' ? '5' : '4' }}. Privacidad</h3>
                    <p class="mt-2">
                        Thrive puede guardar datos de cuenta, perfil, productos, favoritos, seguimientos, reseñas y actividad necesaria para operar y proteger la plataforma. Los datos se utilizan para autenticación, funcionamiento, soporte, seguridad y mejora del servicio. Las credenciales y los datos completos de tarjeta no deben guardarse directamente en la base de datos de Thrive.
                    </p>
                </section>
                <section>
                    <h3 class="font-black text-gray-700">{{ role === 'emprendedor' ? '6' : '5' }}. Contenido y seguridad</h3>
                    <p class="mt-2">
                        Thrive puede retirar contenido, suspender cuentas o limitar funciones cuando detecte fraude, datos falsos, infracciones, abuso, contenido ilegal o riesgos para otros usuarios. Los usuarios deben proteger su contraseña y avisar si sospechan que otra persona accedió a su cuenta.
                    </p>
                </section>
                <div class="rounded-2xl bg-[#EAF9FC] p-4 text-xs leading-5 text-[#4F7180]">
                    Este texto es una base funcional para el proyecto y debe ser revisado por un profesional legal antes de utilizar Thrive comercialmente.
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        class="rounded-xl border border-gray-200 px-5 py-3 font-bold text-gray-500"
                        @click="emit('close')"
                    >
                        Cerrar
                    </button>
                    <button
                        type="button"
                        class="rounded-xl bg-[#00B4D8] px-5 py-3 font-bold text-white"
                        @click="emit('accept')"
                    >
                        Entiendo y acepto
                    </button>
                </div>
            </div>
        </section>
    </div>
</Teleport>
</template>

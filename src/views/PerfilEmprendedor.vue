<script setup>
// Página principal de Thrive; controla el carrusel y las interacciones visuales del landing.
import { ref, onMounted, onBeforeUnmount } from "vue";
// Imágenes utilizadas por el carrusel móvil.
// Al estar dentro del script, Vite necesita que las importemos.
import workshop4 from "../assets/img/workshop4.jpg";
import llaveros from "../assets/img/llaveros.jpg";
import giraP from "../assets/img/giraP.jpeg";
import tulips from "../assets/img/Tulips.jpeg";
import spiderMan from "../assets/img/spiderMan.jpeg";
import floresn from "../assets/img/floresn.jpeg";
// Imágenes que recorrerá el carrusel.
const mobileImages = [
    workshop4,
    llaveros,
    giraP,
    tulips,
    spiderMan
];
// Vue controla directamente las dos imágenes utilizadas para el efecto de transición.
const imageOneSrc = ref(floresn);
const imageTwoSrc = ref(llaveros);
const imageOneVisible = ref(true);
const imageTwoVisible = ref(false);
const currentIndex = ref(0);
const visibleImage = ref(1);
let sliderInterval = null;
let changing = false;
// Espera a que una imagen esté lista antes de mostrarla.
function waitForImage(src) {
    return new Promise(function (resolve) {
        const image = new Image();
        image.onload = resolve;
        image.onerror = resolve;
        image.src = src;
        if (image.complete) {
            resolve();
        }
    });
}
// Cambia la imagen usando las dos capas del carrusel.
async function changeImage(nextIndex) {
    if (changing || nextIndex === currentIndex.value) return;
    changing = true;
    const nextSource = mobileImages[nextIndex];
    if (visibleImage.value === 1) {
        imageTwoSrc.value = nextSource;
        await waitForImage(nextSource);
        imageTwoVisible.value = true;
        imageOneVisible.value = false;
        visibleImage.value = 2;
    } else {
        imageOneSrc.value = nextSource;
        await waitForImage(nextSource);
        imageOneVisible.value = true;
        imageTwoVisible.value = false;
        visibleImage.value = 1;
    }
    currentIndex.value = nextIndex;
    // Evita otro cambio mientras termina la transición.
    setTimeout(function () {
        changing = false;
    }, 1050);
}
// Permite cambiar manualmente desde los indicadores.
function selectImage(index) {
    changeImage(index);
    restartSlider();
}
// Avanza a la siguiente imagen.
function nextImage() {
    const next = (currentIndex.value + 1) % mobileImages.length;
    changeImage(next);
}
// Inicia el carrusel automático.
function startSlider() {
    stopSlider();
    sliderInterval = setInterval(nextImage, 5000);
}
// Detiene el carrusel.
function stopSlider() {
    if (sliderInterval !== null) {
        clearInterval(sliderInterval);
        sliderInterval = null;
    }
}
// Reinicia el tiempo del carrusel.
function restartSlider() {
    stopSlider();
    startSlider();
}
// Pausa el carrusel cuando el usuario cambia de pestaña.
function handleVisibilityChange() {
    if (document.hidden) {
        stopSlider();
    } else {
        restartSlider();
    }
}
// Se ejecuta cuando Home.vue aparece en pantalla.
onMounted(function () {
    // Precargamos las imágenes para que los cambios sean más fluidos.
    mobileImages.forEach(function (src) {
        const image = new Image();
        image.src = src;
    });
    document.addEventListener(
        "visibilitychange",
        handleVisibilityChange
    );
    startSlider();
});
// Se ejecuta cuando el usuario abandona esta vista.
onBeforeUnmount(function () {
    stopSlider();
    document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
    );
});
</script>
<template>
    <!-- Reemplaza al body que teníamos anteriormente -->
    <div class="min-h-screen overflow-x-hidden bg-[#eafaff] font-sans text-[#0077B6]">
        <!-- Barra de navegación -->
        <header class="fixed inset-x-0 top-0 z-50 border-b border-white/40 bg-[#00B4D8]/95 shadow-lg backdrop-blur-xl">
            <nav class="mx-auto flex h-[76px] w-full max-w-[1500px] items-center justify-between px-5 sm:px-8 lg:px-12">
                <!-- Logo -->
                <a href="#inicio" class="flex items-center">
                    <img
                        src="../assets/img/logo.png"
                        alt="Logo Thrive"
                        class="h-14 w-auto object-contain"
                    >
                </a>
                <!-- Navegación de escritorio -->
                <div class="hidden items-center gap-3 md:flex lg:gap-5">
                    <a
                        href="#inicio"
                        class="rounded-xl bg-white/15 px-5 py-3 text-base font-bold text-white hover:bg-white/25 lg:text-[17px]"
                    >
                        Inicio
                    </a>
                    <!-- Esta será la futura página Productos.vue -->
                    <RouterLink
                        to="/productos"
                        class="rounded-xl px-5 py-3 text-base font-bold text-white/90 hover:bg-white/15 hover:text-white lg:text-[17px]"
                    >
                        Productos
                    </RouterLink>
                    <a
                        href="#beneficios"
                        class="rounded-xl px-5 py-3 text-base font-bold text-white/90 hover:bg-white/15 hover:text-white lg:text-[17px]"
                    >
                        Beneficios
                    </a>
                    <a
                        href="#contacto"
                        class="rounded-xl px-5 py-3 text-base font-bold text-white/90 hover:bg-white/15 hover:text-white lg:text-[17px]"
                    >
                        Contacto
                    </a>
                </div>
                <!-- Acceso a la futura vista Auth.vue -->
                <RouterLink
                    to="/auth"
                    class="rounded-full bg-white px-6 py-3 text-sm font-extrabold text-[#0077B6] shadow-md hover:bg-[#CAF0F8] sm:text-base"
                >
                    Comenzar
                </RouterLink>
            </nav>
        </header>
        <!-- Contenido principal -->
        <main
            id="inicio"
            class="relative min-h-screen pt-[76px]"
        >
            <!-- VERSIÓN PARA CELULAR -->
            <section class="relative block min-h-[calc(100vh-76px)] overflow-hidden md:hidden">
                <!-- Carrusel móvil -->
                <div class="absolute inset-0 overflow-hidden bg-white">
                    <img
                        :src="imageOneSrc"
                        alt="Producto destacado"
                        class="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-in-out"
                        :class="imageOneVisible ? 'opacity-100' : 'opacity-0'"
                    >
                    <img
                        :src="imageTwoSrc"
                        alt="Producto destacado"
                        class="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-in-out"
                        :class="imageTwoVisible ? 'opacity-100' : 'opacity-0'"
                    >
                </div>
                <!-- Contenido sobre el carrusel -->
                <div class="relative z-20 flex min-h-[calc(100vh-76px)] flex-col px-5 pb-8 pt-7">
                    <div class="flex justify-center">
                        <div class="rounded-full border border-white/40 bg-black/45 px-5 py-2 text-center text-xs font-bold uppercase tracking-[0.15em] text-white backdrop-blur-md">
                            Hecho por emprendedores
                        </div>
                    </div>
                    <!-- Empuja la tarjeta hacia la parte inferior -->
                    <div class="flex-1"></div>
                    <!-- Tarjeta principal -->
                    <div class="w-full max-w-md rounded-[28px] border border-white/20 bg-black/60 p-6 shadow-2xl backdrop-blur-md">
                        <p class="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-[#90E0EF]">
                            Comunidad emprendedora
                        </p>
                        <h1 class="text-4xl font-black text-white">
                            Haz crecer tu
                            <span class="text-[#90E0EF]">
                                emprendimiento.
                            </span>
                        </h1>
                        <p class="mt-4 text-base text-white/85">
                            Descubre nuevos productos, conecta con otros emprendedores y encuentra oportunidades para seguir creciendo.
                        </p>
                        <!-- Acciones principales -->
                        <div class="mt-7 flex flex-col gap-3">
                            <RouterLink
                                to="/auth"
                                class="w-full rounded-2xl bg-[#00B4D8] px-6 py-4 text-center text-base font-extrabold text-white hover:bg-[#0077B6]"
                            >
                                Comenzar
                            </RouterLink>
                            <RouterLink
                                to="/productos"
                                class="w-full rounded-2xl border border-[#90E0EF]/60 bg-white/5 px-6 py-4 text-center text-base font-bold text-[#CAF0F8] hover:bg-white/10"
                            >
                                Explorar productos
                            </RouterLink>
                        </div>
                        <!-- Indicadores creados directamente con Vue -->
                        <div class="mt-6 flex items-center justify-center gap-2">
                            <button
                                v-for="(_, index) in mobileImages"
                                :key="index"
                                type="button"
                                :aria-label="'Imagen ' + (index + 1)"
                                :class="
                                    index === currentIndex
                                        ? 'h-2 w-8 rounded-full bg-[#00B4D8]'
                                        : 'h-2 w-2 rounded-full bg-[#90E0EF]'
                                "
                                @click="selectImage(index)"
                            ></button>
                        </div>
                    </div>
                </div>
            </section>
            <!-- VERSIÓN PARA ESCRITORIO -->
            <section class="relative hidden min-h-[calc(100vh-76px)] md:block">
                <!-- Galería principal -->
                <div class="absolute inset-0 z-0 flex overflow-hidden bg-white">
                    <!-- Producto 1 -->
                    <article class="group relative h-full min-w-0 flex-1 cursor-pointer overflow-hidden transition-[flex] duration-700 ease-in-out hover:z-20 hover:flex-[3]">
                        <img
                            src="../assets/img/floresn.jpeg"
                            alt="Arreglos florales"
                            class="h-full w-full object-cover object-center brightness-[0.88] contrast-[0.92] saturate-[0.82] transition-[filter,transform] duration-700 ease-in-out group-hover:scale-[1.03] group-hover:brightness-100 group-hover:contrast-100 group-hover:saturate-100"
                        >
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-6 pb-7 pt-20 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                            <span class="text-xs font-bold uppercase tracking-[0.15em] text-[#90E0EF]">
                                Artesanía
                            </span>
                            <h3 class="mt-1 text-2xl font-bold text-white">
                                Flores únicas
                            </h3>
                        </div>
                    </article>
                    <!-- Producto 2 -->
                    <article class="group relative h-full min-w-0 flex-1 cursor-pointer overflow-hidden transition-[flex] duration-700 ease-in-out hover:z-20 hover:flex-[3]">
                        <img
                            src="../assets/img/llaveros.jpg"
                            alt="Llaveros artesanales"
                            class="h-full w-full object-cover object-center brightness-[0.88] contrast-[0.92] saturate-[0.82] transition-[filter,transform] duration-700 ease-in-out group-hover:scale-[1.03] group-hover:brightness-100 group-hover:contrast-100 group-hover:saturate-100"
                        >
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-6 pb-7 pt-20 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                            <span class="text-xs font-bold uppercase tracking-[0.15em] text-[#90E0EF]">
                                Accesorios
                            </span>
                            <h3 class="mt-1 text-2xl font-bold text-white">
                                Detalles personales
                            </h3>
                        </div>
                    </article>
                    <!-- Producto 3 -->
                    <article class="group relative h-full min-w-0 flex-1 cursor-pointer overflow-hidden transition-[flex] duration-700 ease-in-out hover:z-20 hover:flex-[3]">
                        <img
                            src="../assets/img/giraP.jpeg"
                            alt="Girasoles artesanales"
                            class="h-full w-full object-cover object-center brightness-[0.88] contrast-[0.92] saturate-[0.82] transition-[filter,transform] duration-700 ease-in-out group-hover:scale-[1.03] group-hover:brightness-100 group-hover:contrast-100 group-hover:saturate-100"
                        >
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-6 pb-7 pt-20 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                            <span class="text-xs font-bold uppercase tracking-[0.15em] text-[#90E0EF]">
                                Creatividad
                            </span>
                            <h3 class="mt-1 text-2xl font-bold text-white">
                                Ideas que florecen
                            </h3>
                        </div>
                    </article>
                    <!-- Producto 4 -->
                    <article class="group relative h-full min-w-0 flex-1 cursor-pointer overflow-hidden transition-[flex] duration-700 ease-in-out hover:z-20 hover:flex-[3]">
                        <img
                            src="../assets/img/Tulips.jpeg"
                            alt="Tulipanes artesanales"
                            class="h-full w-full object-cover object-center brightness-[0.88] contrast-[0.92] saturate-[0.82] transition-[filter,transform] duration-700 ease-in-out group-hover:scale-[1.03] group-hover:brightness-100 group-hover:contrast-100 group-hover:saturate-100"
                        >
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-6 pb-7 pt-20 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                            <span class="text-xs font-bold uppercase tracking-[0.15em] text-[#90E0EF]">
                                Decoración
                            </span>
                            <h3 class="mt-1 text-2xl font-bold text-white">
                                Diseños especiales
                            </h3>
                        </div>
                    </article>
                    <!-- Producto 5 -->
                    <article class="group relative h-full min-w-0 flex-1 cursor-pointer overflow-hidden transition-[flex] duration-700 ease-in-out hover:z-20 hover:flex-[3]">
                        <img
                            src="../assets/img/spiderMan.jpeg"
                            alt="Producto personalizado"
                            class="h-full w-full object-cover object-center brightness-[0.88] contrast-[0.92] saturate-[0.82] transition-[filter,transform] duration-700 ease-in-out group-hover:scale-[1.03] group-hover:brightness-100 group-hover:contrast-100 group-hover:saturate-100"
                        >
                        <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-6 pb-7 pt-20 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                            <span class="text-xs font-bold uppercase tracking-[0.15em] text-[#90E0EF]">
                                Personalización
                            </span>
                            <h3 class="mt-1 text-2xl font-bold text-white">
                                Diseños con identidad
                            </h3>
                        </div>
                    </article>
                </div>
                <!-- Tarjeta principal sobre la galería -->
                <div class="pointer-events-none relative z-30 mx-auto flex min-h-[calc(100vh-76px)] w-full max-w-[1500px] items-center px-8 lg:px-12">
                    <div class="pointer-events-auto w-full max-w-[640px] rounded-[32px] border border-white/20 bg-black/60 p-9 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-md lg:p-11">
                        <p class="text-xs font-bold uppercase tracking-[0.18em] text-[#90E0EF]">
                            Comunidad emprendedora
                        </p>
                        <h1 class="mt-5 max-w-[560px] text-5xl font-black leading-[1.05] tracking-tight text-white lg:text-[56px]">
                            Haz crecer tu
                            <span class="text-[#90E0EF]">
                                emprendimiento.
                            </span>
                        </h1>
                        <p class="mt-5 max-w-[520px] text-lg leading-relaxed text-white/85">
                            Descubre productos, conecta con otros emprendedores y encuentra nuevas oportunidades para tu proyecto.
                        </p>
                        <!-- Acciones -->
                        <div class="mt-8 flex flex-wrap gap-4">
                            <RouterLink
                                to="/auth"
                                class="rounded-2xl bg-[#00B4D8] px-8 py-4 text-base font-extrabold text-white hover:bg-[#0077B6]"
                            >
                                Comenzar
                            </RouterLink>
                            <RouterLink
                                to="/productos"
                                class="rounded-2xl border border-[#90E0EF]/60 bg-white/5 px-8 py-4 text-base font-bold text-[#CAF0F8] hover:bg-white/10"
                            >
                                Explorar productos
                            </RouterLink>
                        </div>
                    </div>
                </div>
            </section>
        </main>
        <!-- BENEFICIOS -->
        <section
            id="beneficios"
            class="border-t border-[#00B4D8]/20 bg-white px-6 py-20 sm:px-8 lg:px-12"
        >
            <div class="mx-auto max-w-[1300px]">
                <!-- Introducción -->
                <div class="max-w-2xl">
                    <p class="text-sm font-bold uppercase tracking-[0.16em] text-[#00B4D8]">
                        Todo en un solo lugar
                    </p>
                    <h2 class="mt-3 text-3xl font-black tracking-tight text-[#0077B6] sm:text-5xl">
                        Herramientas para tu emprendimiento
                    </h2>
                    <p class="mt-4 text-base leading-relaxed text-gray-600">
                        Publica tus productos, descubre nuevas ideas y conecta con personas que también están construyendo sus proyectos.
                    </p>
                </div>
                <!-- Tarjetas informativas -->
                <div class="mt-12 grid gap-6 md:grid-cols-3">
                    <!-- Venta -->
                    <article class="overflow-hidden rounded-[26px] border border-[#90E0EF] bg-[#eafaff] shadow-lg">
                        <img
                            src="../assets/img/workshop2.jpg"
                            alt="Productos de emprendimientos"
                            class="h-48 w-full object-cover"
                        >
                        <div class="p-7">
                            <h3 class="text-xl font-black text-[#0077B6]">
                                Vende tus productos
                            </h3>
                            <p class="mt-3 leading-relaxed text-[#075985]">
                                Publica tu emprendimiento y permite que más personas conozcan los productos que ofreces.
                            </p>
                        </div>
                    </article>
                    <!-- Aprendizaje -->
                    <article class="overflow-hidden rounded-[26px] border border-[#90E0EF] bg-[#eafaff] shadow-lg">
                        <img
                            src="../assets/img/workshop4.jpg"
                            alt="Aprendizaje para emprendedores"
                            class="h-48 w-full object-cover"
                        >
                        <div class="p-7">
                            <h3 class="text-xl font-black text-[#0077B6]">
                                Aprende y mejora
                            </h3>
                            <p class="mt-3 leading-relaxed text-[#075985]">
                                Encuentra contenido y recursos que pueden ayudarte a mejorar diferentes áreas de tu emprendimiento.
                            </p>
                        </div>
                    </article>
                    <!-- Comunidad -->
                    <article class="overflow-hidden rounded-[26px] border border-[#90E0EF] bg-[#eafaff] shadow-lg">
                        <img
                            src="../assets/img/workshop6.jpg"
                            alt="Comunidad de emprendedores"
                            class="h-48 w-full object-cover"
                        >
                        <div class="p-7">
                            <h3 class="text-xl font-black text-[#0077B6]">
                                Conecta con otros
                            </h3>
                            <p class="mt-3 leading-relaxed text-[#075985]">
                                Descubre otros emprendimientos y encuentra personas con las que puedas compartir nuevas oportunidades.
                            </p>
                        </div>
                    </article>
                </div>
            </div>
        </section>
        <!-- Pie de página -->
        <footer
            id="contacto"
            class="border-t border-white/20 bg-[#0077B6] px-6 py-8 sm:px-8 lg:px-12"
        >
            <div class="mx-auto flex max-w-[1300px] flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
                <img
                    src="../assets/img/logo.png"
                    alt="Logo Thrive"
                    class="h-12 w-auto object-contain"
                >
                <p class="text-sm text-[#CAF0F8]">
                    © 2026 Thrive. Todos los derechos reservados.
                </p>
            </div>
        </footer>
    </div>
</template>

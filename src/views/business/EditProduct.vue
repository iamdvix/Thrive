<script setup>
// Abre la edición de un producto concreto usando su identificador de la ruta.
import { computed } from "vue";
import { useRoute } from "vue-router";
import BusinessPanel from "../../components/business/BusinessPanel.vue";
const route = useRoute();
const productId = computed(function () {
    return String(route.params.id || "");
});
</script>
<template>
    <BusinessPanel screen="edit-product" :product-id="productId" />
</template>

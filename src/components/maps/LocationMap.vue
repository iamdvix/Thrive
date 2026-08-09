<script setup>
// Mapa de lectura para perfiles y directorio de ubicaciones.
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const props = defineProps({
    locations: { type: Array, default: () => [] },
    height: { type: String, default: "420px" }
});
const emit = defineEmits(["select"]);
const mapEl = ref(null);
let map = null;
let markersLayer = null;

function valid(point) {
    return Number.isFinite(Number(point?.latitude)) && Number.isFinite(Number(point?.longitude));
}
function markerIcon(primary) {
    return L.divIcon({
        className: "thrive-map-marker-wrap",
        html: `<div style="width:${primary ? 34 : 28}px;height:${primary ? 34 : 28}px;border-radius:9999px;background:#00B4D8;border:4px solid white;box-shadow:0 5px 16px rgba(0,119,182,.35);display:flex;align-items:center;justify-content:center"><div style="width:8px;height:8px;border-radius:9999px;background:white"></div></div>`,
        iconSize: [primary ? 34 : 28, primary ? 34 : 28],
        iconAnchor: [primary ? 17 : 14, primary ? 17 : 14]
    });
}
function renderMarkers() {
    if (!map) return;
    if (markersLayer) markersLayer.remove();
    markersLayer = L.layerGroup().addTo(map);
    const points = props.locations.filter(valid);
    const bounds = [];
    points.forEach((point) => {
        const latlng = [Number(point.latitude), Number(point.longitude)];
        const marker = L.marker(latlng, { icon: markerIcon(Boolean(point.isPrimary)) }).addTo(markersLayer);
        marker.bindTooltip(point.businessName || point.name || "Emprendimiento", { direction: "top", offset: [0, -12] });
        marker.on("click", () => emit("select", point));
        bounds.push(latlng);
    });
    if (bounds.length === 1) map.setView(bounds[0], 15);
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
    if (!bounds.length) map.setView([13.72, -89.2], 8);
    setTimeout(() => map?.invalidateSize(), 50);
}
onMounted(async () => {
    await nextTick();
    map = L.map(mapEl.value, { zoomControl: true, scrollWheelZoom: true }).setView([13.72, -89.2], 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    renderMarkers();
});
watch(() => props.locations, renderMarkers, { deep: true });
onBeforeUnmount(() => { map?.remove(); map = null; });
</script>
<template>
    <div ref="mapEl" class="w-full overflow-hidden rounded-[24px] bg-[#EAF9FC]" :style="{ height }"></div>
</template>
<style>
.thrive-map-marker-wrap{background:transparent;border:0}.leaflet-container{font-family:inherit}.leaflet-control-attribution{font-size:9px}
</style>

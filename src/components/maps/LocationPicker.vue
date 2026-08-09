<script setup>
// Selector de ubicación exacta. Clic en el mapa o arrastra el punto.
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
const props = defineProps({ latitude: { type: Number, default: null }, longitude: { type: Number, default: null } });
const emit = defineEmits(["update:latitude", "update:longitude"]);
const mapEl = ref(null);
let map = null;
let marker = null;
const icon = L.divIcon({ className: "thrive-picker-marker", html: '<div style="width:34px;height:34px;border-radius:9999px;background:#00B4D8;border:5px solid white;box-shadow:0 6px 18px rgba(0,119,182,.38)"></div>', iconSize: [34,34], iconAnchor: [17,17] });
function hasPoint() { return Number.isFinite(Number(props.latitude)) && Number.isFinite(Number(props.longitude)); }
function setPoint(lat, lng, move = false) {
    if (!map) return;
    if (!marker) {
        marker = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
        marker.on("dragend", () => {
            const p = marker.getLatLng();
            emit("update:latitude", Number(p.lat.toFixed(7)));
            emit("update:longitude", Number(p.lng.toFixed(7)));
        });
    } else marker.setLatLng([lat, lng]);
    if (move) map.setView([lat, lng], Math.max(map.getZoom(), 15));
}
onMounted(async () => {
    await nextTick();
    map = L.map(mapEl.value).setView(hasPoint() ? [props.latitude, props.longitude] : [13.72, -89.2], hasPoint() ? 15 : 8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
    map.on("click", (event) => {
        const lat = Number(event.latlng.lat.toFixed(7));
        const lng = Number(event.latlng.lng.toFixed(7));
        emit("update:latitude", lat);
        emit("update:longitude", lng);
        setPoint(lat, lng);
    });
    if (hasPoint()) setPoint(Number(props.latitude), Number(props.longitude));
    setTimeout(() => map?.invalidateSize(), 50);
});
watch(() => [props.latitude, props.longitude], ([lat, lng]) => {
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) setPoint(Number(lat), Number(lng));
});
onBeforeUnmount(() => { map?.remove(); map = null; });
</script>
<template>
    <div>
        <div ref="mapEl" class="h-[340px] w-full overflow-hidden rounded-[22px] border border-[#90E0EF]/50 bg-[#EAF9FC]"></div>
        <p class="mt-2 text-xs leading-5 text-gray-400">Toca el mapa para colocar el punto exacto o arrastra el marcador.</p>
    </div>
</template>
<style>.thrive-picker-marker{background:transparent;border:0}</style>

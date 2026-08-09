<script setup>
// Mapa reutilizable. Los marcadores toman la forma y los colores de Thrive sin recargar la vista.
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const props=defineProps({locations:{type:Array,default:()=>[]},height:{type:String,default:"420px"}});
const emit=defineEmits(["select"]);
const mapEl=ref(null);
let map=null,markersLayer=null;

function valid(point){return Number.isFinite(Number(point?.latitude))&&Number.isFinite(Number(point?.longitude));}
function markerIcon(primary){
    const size=primary?38:32;
    return L.divIcon({
        className:"thrive-map-marker-wrap",
        html:`<div class="thrive-map-pin ${primary?"is-primary":""}"><span></span></div>`,
        iconSize:[size,size+8],
        iconAnchor:[size/2,size+5],
        tooltipAnchor:[0,-size]
    });
}
function renderMarkers(){
    if(!map)return;
    if(markersLayer)markersLayer.remove();
    markersLayer=L.layerGroup().addTo(map);
    const points=props.locations.filter(valid),bounds=[];
    points.forEach(point=>{
        const latlng=[Number(point.latitude),Number(point.longitude)];
        const marker=L.marker(latlng,{icon:markerIcon(Boolean(point.isPrimary))}).addTo(markersLayer);
        marker.bindTooltip(point.businessName||point.name||"Emprendimiento",{direction:"top",offset:[0,-8],className:"thrive-map-tooltip"});
        marker.on("click",()=>emit("select",point));
        bounds.push(latlng);
    });
    if(bounds.length===1)map.setView(bounds[0],15);
    else if(bounds.length>1)map.fitBounds(bounds,{padding:[35,35],maxZoom:15});
    else map.setView([13.72,-89.2],8);
    setTimeout(()=>map?.invalidateSize(),50);
}
onMounted(async()=>{
    await nextTick();
    map=L.map(mapEl.value,{zoomControl:true,scrollWheelZoom:true}).setView([13.72,-89.2],8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    renderMarkers();
});
watch(()=>props.locations,renderMarkers,{deep:true});
onBeforeUnmount(()=>{map?.remove();map=null;});
</script>

<template>
    <div ref="mapEl" class="w-full overflow-hidden rounded-[18px] bg-[#EAF9FC]" :style="{height}"></div>
</template>

<style>
.thrive-map-marker-wrap{background:transparent;border:0}.thrive-map-pin{position:relative;width:32px;height:32px;border:3px solid #fff;border-radius:50% 50% 50% 8px;background:#00B4D8;box-shadow:0 5px 14px rgba(0,119,182,.28);transform:rotate(-45deg)}.thrive-map-pin.is-primary{width:38px;height:38px;background:#0077B6}.thrive-map-pin span{position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:9999px;background:#fff;transform:translate(-50%,-50%)}.leaflet-container{font-family:inherit}.leaflet-control-attribution{font-size:9px}.thrive-map-tooltip{border:0!important;border-radius:10px!important;box-shadow:0 5px 15px rgba(0,0,0,.12)!important;color:#4b5563!important;font-size:11px!important;font-weight:700!important}
</style>

<script setup>
// Mapa reutilizable. Por defecto deja libre el scroll de la página y solo captura gestos cuando el usuario lo activa.
import {nextTick,onBeforeUnmount,onMounted,ref,watch} from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const props=defineProps({locations:{type:Array,default:()=>[]},height:{type:String,default:"420px"}});
const emit=defineEmits(["select"]);
const mapEl=ref(null),interactionEnabled=ref(false);
let map=null,markersLayer=null,resizeObserver=null;

function valid(point){return Number.isFinite(Number(point?.latitude))&&Number.isFinite(Number(point?.longitude));}
function markerIcon(primary){
    const size=primary?38:32;
    return L.divIcon({className:"thrive-map-marker-wrap",html:`<div class="thrive-map-pin ${primary?"is-primary":""}"><span></span></div>`,iconSize:[size,size+8],iconAnchor:[size/2,size+5],tooltipAnchor:[0,-size]});
}
function refresh(){if(!map)return;requestAnimationFrame(()=>map?.invalidateSize({pan:false}));}
function setInteraction(enabled){
    interactionEnabled.value=enabled;
    if(!map)return;
    const action=enabled?"enable":"disable";
    map.dragging?.[action]();
    map.touchZoom?.[action]();
    map.doubleClickZoom?.[action]();
    map.boxZoom?.[action]();
    map.keyboard?.[action]();
    // La rueda nunca hace zoom: así siempre puede desplazar la página.
    map.scrollWheelZoom?.disable();
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
    setTimeout(refresh,60);
}

onMounted(async()=>{
    await nextTick();
    if(!mapEl.value)return;
    map=L.map(mapEl.value,{zoomControl:true,scrollWheelZoom:false,dragging:false,touchZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false}).setView([13.72,-89.2],8);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);
    resizeObserver=new ResizeObserver(refresh);
    resizeObserver.observe(mapEl.value);
    window.addEventListener("resize",refresh);
    renderMarkers();
});
watch(()=>props.locations,renderMarkers,{deep:true});
onBeforeUnmount(()=>{
    resizeObserver?.disconnect();
    window.removeEventListener("resize",refresh);
    map?.remove();
    map=null;
});
</script>

<template>
<div class="thrive-map-shell" :class="{'is-interacting':interactionEnabled}" :style="{height}">
    <div ref="mapEl" class="thrive-scroll-map h-full w-full"></div>
    <button type="button" class="thrive-map-mode" @click.stop="setInteraction(!interactionEnabled)">
        {{ interactionEnabled?'Listo':'Mover mapa' }}
    </button>
</div>
</template>

<style>
.thrive-map-shell{position:relative;width:100%;overflow:hidden;border-radius:18px;background:#eaf9fc;overscroll-behavior:auto;touch-action:pan-y}
.thrive-map-shell.is-interacting{touch-action:none}
.thrive-scroll-map.leaflet-container{position:relative!important;width:100%;height:100%;touch-action:pan-y;overscroll-behavior:auto}
.thrive-map-shell.is-interacting .thrive-scroll-map.leaflet-container{touch-action:none}
.thrive-map-mode{position:absolute;right:12px;top:12px;z-index:700;border:1px solid rgba(0,180,216,.24);border-radius:9999px;background:rgba(255,255,255,.96);padding:8px 12px;color:#0077b6;font-size:11px;font-weight:900;box-shadow:0 4px 14px rgba(0,0,0,.08)}
.thrive-map-marker-wrap{background:transparent;border:0}.thrive-map-pin{position:relative;width:32px;height:32px;border:3px solid #fff;border-radius:50% 50% 50% 8px;background:#00b4d8;box-shadow:0 5px 14px rgba(0,119,182,.28);transform:rotate(-45deg)}.thrive-map-pin.is-primary{width:38px;height:38px;background:#0077b6}.thrive-map-pin span{position:absolute;left:50%;top:50%;width:8px;height:8px;border-radius:9999px;background:#fff;transform:translate(-50%,-50%)}.leaflet-container{font-family:inherit}.leaflet-control-attribution{font-size:9px}.thrive-map-tooltip{border:0!important;border-radius:10px!important;box-shadow:0 5px 15px rgba(0,0,0,.12)!important;color:#4b5563!important;font-size:11px!important;font-weight:700!important}
</style>

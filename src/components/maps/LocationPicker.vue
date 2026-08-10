<script setup>
// Selector de ubicación exacta. El mapa no bloquea el scroll del formulario ni del celular.
import {nextTick,onBeforeUnmount,onMounted,ref,watch} from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const props=defineProps({latitude:{type:Number,default:null},longitude:{type:Number,default:null}});
const emit=defineEmits(["update:latitude","update:longitude"]);
const mapEl=ref(null),mapReady=ref(false);
let map=null,marker=null,resizeObserver=null,refreshTimer=null;
const icon=L.divIcon({className:"thrive-picker-marker",html:'<div class="thrive-picker-dot"></div>',iconSize:[36,36],iconAnchor:[18,18]});

function hasPoint(){return Number.isFinite(Number(props.latitude))&&Number.isFinite(Number(props.longitude));}
function refresh(){if(!map)return;requestAnimationFrame(()=>map?.invalidateSize({pan:false}));}
function setPoint(lat,lng,move=false){
    if(!map)return;
    if(!marker){
        marker=L.marker([lat,lng],{icon,draggable:true}).addTo(map);
        marker.on("dragend",()=>{const point=marker.getLatLng();emit("update:latitude",Number(point.lat.toFixed(7)));emit("update:longitude",Number(point.lng.toFixed(7)));});
    }else marker.setLatLng([lat,lng]);
    if(move)map.setView([lat,lng],Math.max(map.getZoom(),15));
}
function useMyLocation(){
    if(!navigator.geolocation)return alert("Tu navegador no permite obtener la ubicación.");
    navigator.geolocation.getCurrentPosition(position=>{
        const lat=Number(position.coords.latitude.toFixed(7)),lng=Number(position.coords.longitude.toFixed(7));
        emit("update:latitude",lat);emit("update:longitude",lng);setPoint(lat,lng,true);refresh();
    },()=>alert("No pudimos obtener tu ubicación. Puedes tocar el mapa para colocar el punto."),{enableHighAccuracy:true,timeout:8000});
}
async function initMap(){
    await nextTick();
    if(!mapEl.value||map)return;
    const center=hasPoint()?[Number(props.latitude),Number(props.longitude)]:[13.72,-89.2];
    // La rueda queda libre para desplazar el formulario; el zoom sigue disponible con + y -.
    map=L.map(mapEl.value,{zoomControl:true,scrollWheelZoom:false}).setView(center,hasPoint()?15:8);
    const tiles=L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
    tiles.once("load",()=>mapReady.value=true);
    map.whenReady(()=>{mapReady.value=true;refresh();});
    map.on("click",event=>{
        const lat=Number(event.latlng.lat.toFixed(7)),lng=Number(event.latlng.lng.toFixed(7));
        emit("update:latitude",lat);emit("update:longitude",lng);setPoint(lat,lng);
    });
    if(hasPoint())setPoint(Number(props.latitude),Number(props.longitude));
    resizeObserver=new ResizeObserver(refresh);
    resizeObserver.observe(mapEl.value);
    window.addEventListener("resize",refresh);
    [80,250,600].forEach(delay=>setTimeout(refresh,delay));
}

onMounted(()=>{refreshTimer=setTimeout(initMap,60);});
watch(()=>[props.latitude,props.longitude],([lat,lng])=>{if(Number.isFinite(Number(lat))&&Number.isFinite(Number(lng)))setPoint(Number(lat),Number(lng));});
onBeforeUnmount(()=>{
    clearTimeout(refreshTimer);
    resizeObserver?.disconnect();
    window.removeEventListener("resize",refresh);
    map?.remove();
    map=null;marker=null;
});
</script>

<template>
<div class="min-w-0">
    <div class="mb-2 flex items-center justify-between gap-3"><p class="text-xs font-bold text-gray-500">Marca la entrada o punto exacto del local</p><button type="button" class="shrink-0 rounded-full bg-[#EAF9FC] px-3 py-1.5 text-[10px] font-black text-[#0077B6]" @click="useMyLocation">Usar mi ubicación</button></div>
    <div class="relative w-full overflow-hidden rounded-[22px] border border-[#90E0EF]/50 bg-[#EAF9FC]" style="height:340px;min-height:340px">
        <div ref="mapEl" class="thrive-picker-map absolute inset-0 h-full w-full"></div>
        <div v-if="!mapReady" class="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center bg-[#EAF9FC]"><div class="text-center"><div class="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-white border-t-[#00B4D8]"></div><p class="mt-3 text-xs font-bold text-[#0077B6]">Cargando mapa...</p></div></div>
    </div>
    <p class="mt-2 text-xs leading-5 text-gray-400">Toca el mapa para colocar el punto o arrastra el marcador para ajustarlo. Usa + y − para acercar o alejar.</p>
</div>
</template>

<style>
.thrive-picker-map.leaflet-container{touch-action:pan-y}.thrive-picker-marker{background:transparent!important;border:0!important;touch-action:none!important}.thrive-picker-dot{width:36px;height:36px;border-radius:9999px;background:#00B4D8;border:5px solid #fff;box-shadow:0 6px 18px rgba(0,119,182,.38)}
</style>

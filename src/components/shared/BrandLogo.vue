<script setup>
// Un solo componente mantiene todos los logos cuadrados y sin deformarlos.
import {computed} from "vue";
const props=defineProps({src:{type:String,default:""},alt:{type:String,default:"Logo"},name:{type:String,default:"Thrive"},size:{type:String,default:"md"}});
const initials=computed(()=>String(props.name||"TH").trim().split(/\s+/).slice(0,2).map(word=>word[0]?.toUpperCase()).join(""));
</script>

<template>
<div class="brand-logo" :class="`brand-logo--${size}`">
    <img v-if="src" :src="src" :alt="alt" class="brand-logo__image">
    <span v-else class="brand-logo__fallback">{{ initials }}</span>
</div>
</template>

<style scoped>
.brand-logo{display:flex;aspect-ratio:1/1;flex-shrink:0;align-items:center;justify-content:center;overflow:hidden;border:1px solid #caf0f8;background:#fff;box-sizing:border-box}
/* El logo llega hasta el marco. contain conserva su proporción y evita deformarlo. */
.brand-logo__image{display:block;width:100%;height:100%;padding:0;object-fit:contain;object-position:center;transform:scale(1.035);transform-origin:center}
.brand-logo__fallback{display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#eaf9fc;color:#0077b6;font-weight:900}
.brand-logo--xs{width:38px;border-radius:11px}.brand-logo--xs .brand-logo__fallback{font-size:9px}
.brand-logo--sm{width:46px;border-radius:13px}.brand-logo--sm .brand-logo__fallback{font-size:10px}
.brand-logo--md{width:60px;border-radius:16px}.brand-logo--md .brand-logo__fallback{font-size:12px}
.brand-logo--lg{width:78px;border-radius:19px}.brand-logo--lg .brand-logo__fallback{font-size:14px}
.brand-logo--profile{width:112px;border:3px solid #caf0f8;border-radius:24px}.brand-logo--profile .brand-logo__fallback{font-size:19px}
@media(min-width:640px){.brand-logo--lg{width:84px}.brand-logo--profile{width:120px}}
</style>

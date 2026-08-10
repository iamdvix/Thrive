<script setup>
// Los logos de marca se muestran en un espacio horizontal para no aplastarlos ni recortarlos.
import { computed } from "vue";
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
.brand-logo{display:flex;flex-shrink:0;align-items:center;justify-content:center;overflow:hidden;border:1px solid #caf0f8;background:#fff;box-sizing:border-box}
.brand-logo__image{display:block;width:100%;height:100%;max-width:none;object-fit:contain;object-position:center}
.brand-logo__fallback{display:flex;width:100%;height:100%;align-items:center;justify-content:center;background:#eaf9fc;color:#0077b6;font-weight:900}
.brand-logo--xs{width:52px;height:34px;border-radius:10px}.brand-logo--xs .brand-logo__fallback{font-size:10px}
.brand-logo--sm{width:64px;height:42px;border-radius:12px}.brand-logo--sm .brand-logo__fallback{font-size:11px}
.brand-logo--md{width:82px;height:54px;border-radius:14px}.brand-logo--md .brand-logo__fallback{font-size:13px}
.brand-logo--lg{width:104px;height:68px;border-radius:17px}.brand-logo--lg .brand-logo__fallback{font-size:16px}
.brand-logo--profile{width:132px;height:86px;border:3px solid #caf0f8;border-radius:22px}.brand-logo--profile .brand-logo__fallback{font-size:20px}
@media(min-width:640px){.brand-logo--profile{width:156px;height:100px}.brand-logo--lg{width:116px;height:76px}}
</style>

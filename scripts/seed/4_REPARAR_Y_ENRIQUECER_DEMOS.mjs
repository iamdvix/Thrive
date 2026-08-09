// Repara las 20 cuentas demo y las adapta a la nueva estructura de Thrive.
// Ejecutar desde la raíz del proyecto con:
// node --env-file=.env.local scripts/seed/4_REPARAR_Y_ENRIQUECER_DEMOS.mjs
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url));
const url=process.env.SUPABASE_URL;const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!secret)throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
const supabase=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const entrepreneurs=JSON.parse(await fs.readFile(path.join(here,"emprendedores.json"),"utf8"));
const paymentSets=[["Efectivo","Transferencia"],["Efectivo","Tarjeta","Transferencia"],["Efectivo"],["Efectivo","Transferencia"]];
const serviceSets=[["Retiro en local","Entrega a domicilio"],["Pedidos personalizados","Envíos nacionales"],["Retiro en local","Pedidos personalizados"],["Entrega a domicilio","Envíos nacionales"]];
async function allUsers(){const users=[];for(let page=1;;page++){const{data,error}=await supabase.auth.admin.listUsers({page,perPage:100});if(error)throw error;users.push(...(data.users||[]));if((data.users||[]).length<100)break;}return users;}
async function ensureBucket(){const{data}=await supabase.storage.listBuckets();if(!(data||[]).some(b=>b.id==="business-logos")){const{error}=await supabase.storage.createBucket("business-logos",{public:true});if(error)throw error;}}
async function logoUrl(item,userId){const file=await fs.readFile(path.join(here,"logos",item.logo_file));const storagePath=`demo/${userId}/${item.logo_file}`;const{error}=await supabase.storage.from("business-logos").upload(storagePath,file,{contentType:"image/svg+xml",upsert:true});if(error)throw error;return supabase.storage.from("business-logos").getPublicUrl(storagePath).data.publicUrl;}
async function upsertHours(locationId){await supabase.from("entrepreneur_location_hours").delete().eq("location_id",locationId);const rows=Array.from({length:7},(_,weekday)=>({location_id:locationId,weekday,is_closed:weekday===6,open_time:weekday===6?null:(weekday===5?"09:00":"08:00"),close_time:weekday===6?null:(weekday===5?"14:00":"18:00")}));const{error}=await supabase.from("entrepreneur_location_hours").insert(rows);if(error)throw error;}
await ensureBucket();const users=await allUsers();let done=0;
for(let index=0;index<entrepreneurs.length;index++){
    const item=entrepreneurs[index];const user=users.find(u=>u.email?.toLowerCase()===item.email.toLowerCase());if(!user){console.log(`- No encontrado: ${item.email}`);continue;}
    const logo=await logoUrl(item,user.id);
    // Limpia cualquier Display name heredado sin tocar el correo ni otros datos de Auth.
    const metadata={...(user.user_metadata||{}),full_name:null,display_name:null,name:null};
    const{error:authError}=await supabase.auth.admin.updateUserById(user.id,{user_metadata:metadata});if(authError)throw authError;
    const{error:pErr}=await supabase.from("profiles").upsert({id:user.id,full_name:null,phone:item.phone,user_type:"emprendedor",avatar_url:logo},{onConflict:"id"});if(pErr)throw pErr;
    const{error:bErr}=await supabase.from("entrepreneurs").update({business_name:item.business_name,description:item.description,department:item.department,district:item.district,logo_url:logo,payment_methods:paymentSets[index%paymentSets.length],service_tags:serviceSets[index%serviceSets.length]}).eq("id",user.id);if(bErr)throw bErr;
    // Reutiliza el primer local demo si existe; si no, lo crea.
    const{data:existing}=await supabase.from("entrepreneur_locations").select("id").eq("entrepreneur_id",user.id).order("created_at").limit(1).maybeSingle();
    let locationId=existing?.id;
    const payload={entrepreneur_id:user.id,name:"Local principal",address:`Zona central de ${item.district}, ${item.department} · ubicación de demostración`,latitude:Number(item.latitude),longitude:Number(item.longitude),is_primary:true,active:true};
    await supabase.from("entrepreneur_locations").update({is_primary:false}).eq("entrepreneur_id",user.id).eq("is_primary",true);
    if(locationId){const{error}=await supabase.from("entrepreneur_locations").update(payload).eq("id",locationId);if(error)throw error;}else{const{data,error}=await supabase.from("entrepreneur_locations").insert(payload).select("id").single();if(error)throw error;locationId=data.id;}
    await upsertHours(locationId);done++;console.log(`✓ ${item.business_name} | logo + perfil + local + horario`);
}
console.log(`\nListos: ${done}/${entrepreneurs.length}`);

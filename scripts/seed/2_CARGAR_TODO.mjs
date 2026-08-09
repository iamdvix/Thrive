import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\nFaltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env\n');
  process.exit(1);
}

// La service role se usa solo desde este script local.
// Nunca debe colocarse dentro de src/, Vue o variables VITE_*.
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

const entrepreneurs = JSON.parse(
  await readFile(join(__dirname, 'emprendedores.json'), 'utf8')
);

async function prepararBucket() {
  const { data: bucket } = await supabase.storage.getBucket('business-logos');

  if (!bucket) {
    const { error } = await supabase.storage.createBucket('business-logos', {
      public: true,
      allowedMimeTypes: ['image/svg+xml'],
      fileSizeLimit: '1MB'
    });

    if (error) throw new Error(`No se pudo crear el bucket: ${error.message}`);
    return;
  }

  if (!bucket.public) {
    const { error } = await supabase.storage.updateBucket('business-logos', {
      public: true,
      allowedMimeTypes: ['image/svg+xml'],
      fileSizeLimit: '1MB'
    });

    if (error) throw new Error(`No se pudo hacer público el bucket: ${error.message}`);
  }
}

async function cargarUsuariosExistentes() {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });

  if (error) throw new Error(`No se pudieron leer los usuarios: ${error.message}`);

  return new Map(
    data.users
      .filter(user => user.email)
      .map(user => [user.email.toLowerCase(), user])
  );
}

async function obtenerOCrearUsuario(item, usuariosExistentes) {
  const email = item.email.toLowerCase();

  if (usuariosExistentes.has(email)) {
    return usuariosExistentes.get(email);
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: item.email,
    password: item.password,
    email_confirm: true,
    user_metadata: {
      full_name: item.full_name,
      user_type: 'emprendedor'
    }
  });

  if (error) throw new Error(`Auth: ${error.message}`);

  usuariosExistentes.set(email, data.user);
  return data.user;
}

async function subirLogo(userId, item) {
  const localPath = join(__dirname, 'logos', item.logo_file);
  const logo = await readFile(localPath);
  const storagePath = `${userId}/${item.logo_file}`;

  const { error } = await supabase.storage
    .from('business-logos')
    .upload(storagePath, logo, {
      contentType: 'image/svg+xml',
      cacheControl: '3600',
      upsert: true
    });

  if (error) throw new Error(`Storage: ${error.message}`);

  const { data } = supabase.storage
    .from('business-logos')
    .getPublicUrl(storagePath);

  return data.publicUrl;
}

async function guardarProfile(userId, item, logoUrl) {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      full_name: item.full_name,
      phone: item.phone,
      user_type: 'emprendedor',
      avatar_url: logoUrl
    }, {
      onConflict: 'id'
    });

  if (error) throw new Error(`profiles: ${error.message}`);
}

async function guardarEntrepreneur(userId, item, logoUrl) {
  const { error } = await supabase
    .from('entrepreneurs')
    .upsert({
      id: userId,
      business_name: item.business_name,
      description: item.description,
      department: item.department,
      district: item.district,
      logo_url: logoUrl,
      latitude: item.latitude,
      longitude: item.longitude
    }, {
      onConflict: 'id'
    });

  if (error) throw new Error(`entrepreneurs: ${error.message}`);
}

console.log('\nTHRIVE | Carga automática de 20 emprendedores\n');

await prepararBucket();
const usuariosExistentes = await cargarUsuariosExistentes();

let correctos = 0;
let errores = 0;

for (let i = 0; i < entrepreneurs.length; i++) {
  const item = entrepreneurs[i];

  try {
    const user = await obtenerOCrearUsuario(item, usuariosExistentes);
    const logoUrl = await subirLogo(user.id, item);

    // Primero se actualiza profiles y luego la información comercial.
    await guardarProfile(user.id, item, logoUrl);
    await guardarEntrepreneur(user.id, item, logoUrl);

    correctos++;
    console.log(
      `✓ ${String(i + 1).padStart(2, '0')}/20 | ${item.business_name} | ${item.district}, ${item.department}`
    );
  } catch (error) {
    errores++;
    console.error(
      `✗ ${String(i + 1).padStart(2, '0')}/20 | ${item.business_name} | ${error.message}`
    );
  }
}

console.log('\n--------------------------------------------');
console.log(`Creados/actualizados correctamente: ${correctos}`);
console.log(`Errores: ${errores}`);
console.log('--------------------------------------------\n');

if (errores > 0) process.exitCode = 1;

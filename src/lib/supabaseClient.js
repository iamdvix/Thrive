// Importamos la función necesaria para conectar nuestra aplicación con Supabase.
import { createClient } from '@supabase/supabase-js'

// Obtenemos los datos de conexión que guardamos en .env.local.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Creamos y exportamos la conexión para poder usarla en el login, registro y demás páginas.
export const supabase = createClient(supabaseUrl, supabasePublishableKey)
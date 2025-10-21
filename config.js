// config.js - lee desde variables de entorno, NO hardcodea credenciales
window.SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
window.SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
  console.warn("⚠️ Supabase credentials not configured. Using CSV fallback.");
}

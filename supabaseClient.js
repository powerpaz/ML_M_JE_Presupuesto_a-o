// supabaseClient.js — navegador
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
export const supabase = window.SUPABASE_URL && window.SUPABASE_ANON_KEY
  ? createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  : null;
export const hasSupabase = () => !!supabase;
export async function fetchInstituciones({ zona=null, nivel=null, anio=null, limit=10000 }={}){
  if(!supabase) return { data:null, error:new Error("Supabase no inicializado") };
  let q = supabase.from("instituciones").select("*").limit(limit);
  if(zona) q = q.eq("ZONA", zona);
  if(nivel) q = q.eq("NIVEL_DE_EDUCACION", nivel);
  if(anio) q = q.eq("AUX_ANIO_DOTACION", anio);
  return await q;
}

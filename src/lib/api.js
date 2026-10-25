import { demoBackend } from './demoBackend.js';
import { makeSupabaseBackend } from './supabaseBackend.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Live once Supabase keys are set; otherwise a browser-only demo.
export const api = url && key ? makeSupabaseBackend(url, key) : demoBackend;

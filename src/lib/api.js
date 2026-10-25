import { demoBackend } from './demoBackend.js';
import { makeSupabaseBackend } from './supabaseBackend.js';

// Accept the URL with or without a trailing "/rest/v1/" (as shown on Supabase's Data API page).
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Live once Supabase keys are set; otherwise a browser-only demo.
export const api = url && key ? makeSupabaseBackend(url, key) : demoBackend;

/* Supabase client - KANTIN UIMSYA PUTRA
   Isi SUPABASE_URL dan SUPABASE_ANON_KEY dari project Supabase PUTRA.
   JANGAN masukkan service_role key di frontend. */
(function () {
  'use strict';
  const SUPABASE_URL = 'https://caotqidtzccugtomtpsx.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_8o9BQgrJ62emURiuzXstTg_xkXOWJD3';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase JS belum dimuat.');
    return;
  }
  if (SUPABASE_URL.includes('YOUR-PUTRA') || SUPABASE_ANON_KEY.includes('YOUR_PUTRA')) {
    console.warn('Supabase PUTRA belum dikonfigurasi. Edit supabase.js.');
  }
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage }
  });
})();

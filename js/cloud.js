// ── Supabase account, programs, and state sync ────────────────────────────
// The client is the CDN UMD global (see index.html); there is no bundler.
import { data, setData, defaults, store, today, onSave } from './state.js';
import { toast } from './ui.js';

const config = window.SUPABASE_CONFIG || {};
export const cloudEnabled = Boolean(config.url && config.publishableKey && window.supabase);
export const supabase = cloudEnabled
  ? window.supabase.createClient(config.url, config.publishableKey)
  : null;

export const session = {
  user: null,
  profile: null,
  program: null,
  programs: [],
  booted: false,
};

let handlers = {};
export function configureCloud(h) { handlers = h }

/* ── Auth ──────────────────────────────────────────────────────────────── */

export async function signUp(email, password, name) {
  return supabase.auth.signUp({ email, password, options: { data: { display_name: name || '' } } });
}
export async function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}
export async function signOut() {
  await supabase.auth.signOut();
  session.user = null; session.profile = null; session.program = null; session.programs = [];
  session.booted = false;
  handlers.onSignedOut?.();
}

/* ── Session bootstrap ─────────────────────────────────────────────────── */

export async function startCloudSession(user) {
  if (!user) return;
  session.user = user;

  const [{ data: programs, error }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('training_programs').select('*').eq('user_id', user.id).eq('archived', false).order('created_at'),
    supabase.from('training_profiles').select('*').eq('user_id', user.id).maybeSingle(),
  ]);
  if (error || profileError) { handlers.onAuthError?.((error || profileError).message); return }

  session.programs = programs || [];
  session.profile = profile || null;

  // No program yet, or onboarding never finished -> hand over to the stepper.
  if (!session.programs.length || !profile?.onboarded_at) {
    handlers.onNeedsOnboarding?.(user, profile);
    return;
  }

  session.program = session.programs.find(p => p.id === profile.active_program_id) || session.programs[0];
  await loadActiveProgram();
  session.booted = true;
  handlers.onReady?.();
}

export async function loadActiveProgram() {
  const { data: state, error } = await supabase
    .from('training_program_state').select('state_data')
    .eq('program_id', session.program.id).maybeSingle();
  if (error) throw new Error(error.message);
  const saved = state?.state_data || {};
  setData({
    ...defaults(saved),
    start: session.program.start_date,
    custom: session.program.program_data?.custom || [],
  });
}

export async function bootCloud() {
  if (!cloudEnabled) { handlers.onReady?.(); return }
  const { data: s } = await supabase.auth.getSession();
  if (s.session) await startCloudSession(s.session.user);
  else handlers.onSignedOut?.();

  supabase.auth.onAuthStateChange((_e, next) => {
    if (next?.user && !session.user) startCloudSession(next.user);
    if (!next?.user && session.user) {
      session.user = null; session.booted = false;
      handlers.onSignedOut?.();
    }
  });
}

/* ── Programs ──────────────────────────────────────────────────────────── */

export async function refreshPrograms() {
  const { data: latest, error } = await supabase
    .from('training_programs').select('*')
    .eq('user_id', session.user.id).eq('archived', false).order('created_at');
  if (error) throw new Error(error.message);
  session.programs = latest || [];
  return session.programs;
}

export async function createProgram({ name, start, goal, custom = [] }) {
  const { data: created, error } = await supabase.from('training_programs')
    .insert({ user_id: session.user.id, name, start_date: start, goal: goal || null, program_data: { custom } })
    .select().single();
  if (error) throw new Error(error.message);
  session.programs.push(created);
  session.program = created;
  await supabase.from('training_profiles')
    .upsert({ user_id: session.user.id, active_program_id: created.id, default_start_date: start });
  return created;
}

export async function switchProgram(id) {
  if (session.program && id === session.program.id) return;
  await uploadCloudState();
  session.program = session.programs.find(p => p.id === id);
  await supabase.from('training_profiles').upsert({
    user_id: session.user.id, active_program_id: id, default_start_date: session.program.start_date,
  });
  await loadActiveProgram();
}

/* ── State sync ────────────────────────────────────────────────────────── */

let saveTimer = null;

export function scheduleCloudSave() {
  if (!session.booted || !session.user || !session.program) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(uploadCloudState, 650);
}

export async function uploadCloudState() {
  if (!session.user || !session.program) return;
  const state = { ...data };
  // Keep an in-progress session as well. This is what lets a workout, its
  // stopwatch, and a rest countdown survive closing/reopening the app.
  delete state.tab;
  const now = new Date().toISOString();
  const [a, b] = await Promise.all([
    supabase.from('training_program_state')
      .upsert({ program_id: session.program.id, user_id: session.user.id, state_data: state, updated_at: now }),
    supabase.from('training_programs')
      .update({ start_date: data.start, program_data: { custom: data.custom || [] }, updated_at: now })
      .eq('id', session.program.id),
  ]);
  if (a.error || b.error) {
    console.error('Cloud save failed', a.error || b.error);
    toast('บันทึกขึ้นคลาวด์ไม่สำเร็จ ข้อมูลยังอยู่ในเครื่องนี้');
    return false;
  }
  return true;
}

onSave(scheduleCloudSave);

/* ── Profile ───────────────────────────────────────────────────────────── */

export const HANDLE_RE = /^[a-z0-9_]{3,24}$/;

export async function loadProfile() {
  const { data: profile } = await supabase.from('training_profiles')
    .select('*').eq('user_id', session.user.id).maybeSingle();
  session.profile = profile || null;
  return profile;
}

export async function saveProfile(patch) {
  const { error } = await supabase.from('training_profiles')
    .upsert({ user_id: session.user.id, ...patch });
  if (error) throw new Error(error.message);
  session.profile = { ...(session.profile || {}), ...patch };
  return session.profile;
}

export async function completeOnboarding(patch) {
  return saveProfile({ ...patch, onboarded_at: new Date().toISOString(), default_start_date: data.start || today() });
}

export { store };

// ── Friends: shared progress and live presence ────────────────────────────
// Friends see a summary row and a coarse "doing this right now" status.
// They never see set data, loads, body measurements, or your email — those
// stay in training_program_state, which is owner-only at the RLS level.
import { supabase, cloudEnabled, session } from './cloud.js';
import { summary as buildSummary } from './stats.js';
import { onSave } from './state.js';

export const LIVE_WINDOW_MS = 3 * 60 * 1000;

const sharing = () => session.profile?.share_progress !== false;

/* ── Publishing ────────────────────────────────────────────────────────── */

let summaryTimer = null;

export function scheduleSummary() {
  if (!cloudEnabled || !session.booted || !session.user) return;
  clearTimeout(summaryTimer);
  summaryTimer = setTimeout(publishSummary, 900);
}

export async function publishSummary() {
  if (!cloudEnabled || !session.user) return;
  if (!sharing()) return;
  const row = buildSummary(session.program?.name);
  const { error } = await supabase.from('training_progress_summary')
    .upsert({ user_id: session.user.id, ...row, updated_at: new Date().toISOString() });
  if (error) console.warn('summary publish failed', error.message);
}

/** Wipe the shared row when the user turns sharing off. */
export async function clearShared() {
  if (!cloudEnabled || !session.user) return;
  await Promise.all([
    supabase.from('training_progress_summary').delete().eq('user_id', session.user.id),
    supabase.from('training_activity').delete().eq('user_id', session.user.id),
  ]);
}

let heartbeat = null;
let currentActivity = null;

/**
 * publishActivity({ status:'in_session', session_name:'Upper A', exercise_name:'Pull-up', set_index:3, set_total:4 })
 * status: 'idle' | 'in_session' | 'resting'
 */
export async function publishActivity(patch) {
  if (!cloudEnabled || !session.user) return;
  if (!sharing()) return;
  currentActivity = { status: 'idle', ...currentActivity, ...patch };
  if (currentActivity.status !== 'idle' && !currentActivity.started_at) {
    currentActivity.started_at = new Date().toISOString();
  }
  if (currentActivity.status === 'idle') currentActivity.started_at = null;

  const { error } = await supabase.from('training_activity').upsert({
    user_id: session.user.id,
    status: currentActivity.status,
    session_name: currentActivity.session_name || null,
    exercise_name: currentActivity.exercise_name || null,
    set_index: currentActivity.set_index ?? null,
    set_total: currentActivity.set_total ?? null,
    started_at: currentActivity.started_at,
    last_seen_at: new Date().toISOString(),
  });
  if (error) console.warn('activity publish failed', error.message);

  currentActivity.status === 'idle' ? stopHeartbeat() : startHeartbeat();
}

function startHeartbeat() {
  if (heartbeat) return;
  heartbeat = setInterval(() => {
    if (document.hidden) return;
    publishActivity({});
  }, 45000);
}
export function stopHeartbeat() { clearInterval(heartbeat); heartbeat = null }
export const goIdle = () => publishActivity({ status: 'idle', session_name: null, exercise_name: null, set_index: null, set_total: null });

onSave(scheduleSummary);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentActivity && currentActivity.status !== 'idle') publishActivity({});
});

/* ── Reading ───────────────────────────────────────────────────────────── */

export const isLive = activity =>
  Boolean(activity && activity.status !== 'idle' &&
    Date.now() - new Date(activity.last_seen_at).getTime() < LIVE_WINDOW_MS);

export async function friendIds() {
  const { data: links, error } = await supabase.from('training_friendships').select('*')
    .or(`requester_id.eq.${session.user.id},addressee_id.eq.${session.user.id}`);
  if (error) throw new Error(error.message);
  const all = links || [];
  const accepted = all.filter(f => f.status === 'accepted');
  return {
    links: all,
    accepted,
    ids: accepted.map(f => (f.requester_id === session.user.id ? f.addressee_id : f.requester_id)),
    incoming: all.filter(f => f.status === 'pending' && f.addressee_id === session.user.id),
    outgoing: all.filter(f => f.status === 'pending' && f.requester_id === session.user.id),
  };
}

/** Friends with their profile, shared summary, and live activity, plus the
 *  incoming requests resolved to real names so nobody accepts blind. */
export async function loadFriends() {
  const { accepted, ids, incoming, outgoing } = await friendIds();
  const requesterIds = incoming.map(f => f.requester_id);
  const lookupIds = [...new Set([...ids, ...requesterIds])];

  let profiles = [], summaries = [], activities = [];
  if (lookupIds.length) {
    const [p, s, a] = await Promise.all([
      supabase.from('training_profiles').select('user_id,display_name,handle,bio').in('user_id', lookupIds),
      ids.length ? supabase.from('training_progress_summary').select('*').in('user_id', ids) : { data: [] },
      ids.length ? supabase.from('training_activity').select('*').in('user_id', ids) : { data: [] },
    ]);
    profiles = p.data || []; summaries = s.data || []; activities = a.data || [];
  }
  const byId = (arr, k = 'user_id') => Object.fromEntries(arr.map(x => [x[k], x]));
  const P = byId(profiles), S = byId(summaries), A = byId(activities);
  const linkFor = id => accepted.find(f => f.requester_id === id || f.addressee_id === id);

  return {
    friends: ids.map(id => ({
      id,
      profile: P[id] || { user_id: id, display_name: null, handle: null },
      summary: S[id] || null,
      activity: A[id] || null,
      live: isLive(A[id]),
      friendshipId: linkFor(id)?.id,
    })).sort((a, b) => Number(b.live) - Number(a.live)),
    incoming: incoming.map(f => ({ ...f, profile: P[f.requester_id] || null })),
    outgoing,
  };
}

export async function searchProfiles(q) {
  const { data, error } = await supabase.from('training_profiles')
    .select('user_id,display_name,handle,bio')
    .ilike('handle', `%${q}%`).eq('is_profile_public', true)
    .neq('user_id', session.user.id).limit(10);
  if (error) throw new Error(error.message);
  return data || [];
}

export async function sendFriendRequest(id) {
  const { error } = await supabase.from('training_friendships')
    .insert({ requester_id: session.user.id, addressee_id: id });
  if (error) throw new Error(/duplicate/i.test(error.message) ? 'ส่งคำขอไปแล้ว' : error.message);
}
export async function acceptFriend(id) {
  const { error } = await supabase.from('training_friendships')
    .update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}
/** Also used to cancel an outgoing request and to remove an existing friend. */
export async function removeFriendship(id) {
  const { error } = await supabase.from('training_friendships').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/* ── Realtime ──────────────────────────────────────────────────────────── */

let channel = null, poll = null;

/** Push live status changes to `onChange`; poll as a fallback if the socket
 *  never reaches SUBSCRIBED (blocked network, realtime not enabled). */
export function watchFriends(onChange) {
  unwatchFriends();
  if (!cloudEnabled) return;
  channel = supabase.channel('friend-activity')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'training_activity' }, () => onChange())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'training_progress_summary' }, () => onChange())
    .subscribe(status => {
      if (status === 'SUBSCRIBED') { clearInterval(poll); poll = null }
      else if (!poll) poll = setInterval(onChange, 60000);
    });
  // Live badges age out on their own, so refresh periodically regardless.
  if (!poll) poll = setInterval(onChange, 60000);
}

export function unwatchFriends() {
  if (channel) { supabase.removeChannel(channel); channel = null }
  clearInterval(poll); poll = null;
}

/* ── Ranking ───────────────────────────────────────────────────────────── */

/** Accepted friends' shared summaries, for the leaderboard. Friends who have
 *  turned sharing off simply have no row and are ranked last. */
export async function loadRanking() {
  const { ids } = await friendIds();
  if (!ids.length) return { profiles: [], summaries: [] };
  const [p, s] = await Promise.all([
    supabase.from('training_profiles').select('user_id,display_name,handle').in('user_id', ids),
    supabase.from('training_progress_summary').select('*').in('user_id', ids),
  ]);
  return { profiles: p.data || [], summaries: s.data || [] };
}

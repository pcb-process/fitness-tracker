// Entry point: wiring only. Screens render, actions.js dispatches, cloud.js
// syncs, sky.js paints. Nothing here knows how any individual screen works.
import { data, save, onSave, $ } from './state.js';
import { bindActions, register } from './actions.js';
import { setRenderer, go } from './router.js';
import { mountSky, refreshSky } from './sky.js';
import { configureCloud, bootCloud } from './cloud.js';
import { publishSummary } from './social.js';
import * as ui from './ui.js';

import { homeScreen } from './screens/home.js';
import { planScreen } from './screens/plan.js';
import { logScreen } from './screens/log.js';
import { sessionScreen, activeSessionBar } from './screens/session.js';
import { dashboardScreen, dashboardMount } from './screens/dashboard.js';
import { settingsScreen } from './screens/settings.js';
import { friendsScreen, friendsMount, friendsUnmount } from './screens/friends.js';
import { rankingScreen, rankingMount, rankingUnmount } from './screens/ranking.js';
import { authView } from './screens/auth.js';
import { startOnboarding } from './screens/onboarding.js';
import './screens/body.js';

const SCREENS = {
  home: { view: homeScreen },
  dashboard: { view: dashboardScreen, mount: dashboardMount },
  plan: { view: planScreen },
  log: { view: logScreen },
  session: { view: sessionScreen },
  more: { view: settingsScreen },
  friends: { view: friendsScreen, mount: friendsMount, unmount: friendsUnmount },
  ranking: { view: rankingScreen, mount: rankingMount, unmount: rankingUnmount },
};

let mounted = null;

function render() {
  const screen = SCREENS[data.tab] || SCREENS.home;
  if (mounted && mounted !== screen) mounted.unmount?.();
  $('#app').innerHTML = screen.view() + (data.tab === 'session' ? '' : activeSessionBar());
  window.scrollTo({ top: 0 });
  mounted = screen;
  screen.mount?.();
}

setRenderer(render);
bindActions();

register({
  go: ({ tab }) => go(tab),
  closeModal: () => ui.closeModal(),
});

onSave(refreshSky);
mountSky();

configureCloud({
  onReady: () => { render(); publishSummary() },
  onSignedOut: () => { mounted?.unmount?.(); mounted = null; authView() },
  onNeedsOnboarding: (user, profile) => startOnboarding(user, profile),
  onAuthError: message => authView(message),
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

// Leaving the tab mid-session should not strand a stale "live" badge; the
// heartbeat in social.js stops on its own, and friends age it out after 3 min.
addEventListener('pagehide', () => save());
// Background tabs can be suspended before pagehide. Saving when the page is
// hidden gives the cloud sync a chance to finish while the app is still alive.
addEventListener('visibilitychange', () => { if (document.hidden) save() });

// When Supabase is not configured, bootCloud() calls onReady immediately and
// the app runs entirely on localStorage.
bootCloud();

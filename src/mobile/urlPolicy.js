// What the app does when the page wants to load a new address with a full page
// load. Instagram's in-page navigation never comes here; the filter handles that.
//
// Returns one of:
//   { action: 'allow' }                    load it in the app
//   { action: 'block', toggle }            show the Blocked screen instead
//   { action: 'redirect', toggle, to }     load `to` (a path on instagram.com) instead
//   { action: 'external', url }            open in the phone's browser / mail / phone app
//   { action: 'ignore' }                   do nothing (e.g. "open in the Instagram app" links)

import { decide, homeRedirect } from '../filter/routes.js';

const INSTAGRAM = new Set(['instagram.com', 'www.instagram.com']);
const LINK_SHIMS = new Set(['l.instagram.com', 'l.facebook.com', 'lm.facebook.com']);
const OUTSIDE_SCHEMES = new Set(['mailto:', 'tel:', 'sms:']);

function isInstagramSubdomain(host) {
  return host.endsWith('.instagram.com');
}

// Facebook pages used by "Log in with Facebook" stay inside the app.
function isFacebook(host) {
  return host === 'facebook.com' || host.endsWith('.facebook.com');
}

export function decideUrl(rawUrl, { fromPath, settings }) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (e) {
    return { action: 'ignore' };
  }
  if (url.protocol === 'about:' || url.protocol === 'data:' || url.protocol === 'blob:') return { action: 'allow' };
  if (OUTSIDE_SCHEMES.has(url.protocol)) return { action: 'external', url: rawUrl };
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { action: 'ignore' }; // intent:, instagram:, market: ...

  const host = url.hostname.toLowerCase();
  if (LINK_SHIMS.has(host)) {
    // Instagram's link redirector: open the real destination outside the app.
    const target = url.searchParams.get('u');
    return target ? { action: 'external', url: target } : { action: 'ignore' };
  }
  if (INSTAGRAM.has(host)) {
    const home = homeRedirect(url.pathname, url.search, settings);
    if (home) return { action: 'redirect', toggle: 'followingFeed', to: home };
    return decide(url.pathname, fromPath, settings);
  }
  if (isInstagramSubdomain(host) || isFacebook(host)) return { action: 'allow' };
  return { action: 'external', url: rawUrl };
}

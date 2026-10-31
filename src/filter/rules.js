// Let Me Wonder: filter rules.
//
// When Instagram changes its site, this is usually the only file to edit.
// It holds data only (page addresses, CSS selectors, label texts), no logic.
// README.md, section "Updating the filter", explains each part.

export const RULES_VERSION = '2026.10.31g';

// The switches in settings. `default` is the setting until you change it.
// `blocked` is the message on the Blocked screen when this switch stops a page.
// `covered` is the small label on a post this switch hides in a feed.
// The switches are locked with a code (lock.js), except those marked `free`, which turn
// nothing back on.
export const TOGGLES = [
  { id: 'reelsTab', label: 'Reels tab and Reels pages', default: true, blocked: 'Reels are switched off.' },
  // Off by default: reels from people you follow stay in the feed (suggested ones are
  // hidden by "suggested"). Turn on to hide every reel in the home feed.
  { id: 'feedReels', label: 'Reels in the home feed, also from people you follow', default: false, blocked: 'Reels are switched off.', covered: 'Reel hidden' },
  { id: 'explore', label: 'Explore grid', default: true, blocked: 'Explore is switched off. Searching for accounts still works.' },
  { id: 'suggested', label: 'Suggested posts and accounts', default: true, blocked: 'Suggestions are switched off.', covered: 'Suggestion hidden' },
  { id: 'ads', label: 'Ads and sponsored posts', default: true, blocked: 'Ads are switched off.', covered: 'Ad hidden' },
  { id: 'reelSwipe', label: 'Swiping to the next reel', default: true, blocked: 'You watched the reel you opened. Moving on to other reels is switched off.' },
  // A test, off by default: hidden posts become a small box instead of keeping their size,
  // and Instagram is asked to measure the feed again. If it doesn't, the feed jumps.
  { id: 'smallCovers', label: 'Small boxes for hidden posts (test: the feed may jump)', default: false, free: true },
  // Instagram's page says it can't be zoomed (maximum-scale=1); this lets two fingers zoom it.
  { id: 'pinchZoom', label: 'Pinch to zoom photos and stories', default: true, free: true },
];

// Kinds of page, recognised by the address path (the part after instagram.com).
// Other rules use these names to apply only on some pages. First match wins.
export const PAGES = [
  { name: 'home', path: '^/$' },
  { name: 'explore', path: '^/explore/?$' },
  { name: 'search', path: '^/explore/search(/|$)' },
  { name: 'reel', path: '^/(?:[^/]+/)?reels?/[^/]+/?$' },
  { name: 'post', path: '^/(?:[^/]+/)?p/[^/]+' },
  { name: 'direct', path: '^/direct(/|$)' },
  // Making a post or a story (on the web: /create/..., and /stories/create/ for stories).
  // The filter stays out of the way there: no labels, no settings button, Instagram's zoom.
  { name: 'create', path: '^/(?:stories/)?create(/|$)' },
  { name: 'stories', path: '^/stories(/|$)' },
  { name: 'login', path: '^/(accounts/(login|emailsignup|password|onetap)|challenge)(/|$)' },
];

// Pages that are blocked or sent elsewhere. First match wins.
//   block:    show the Blocked screen instead.
//   redirect: open `to` instead ($1 = the part in brackets).
//             With onlyWhenTapped, only when you tap a link yourself; if
//             Instagram moves there on its own, the page is blocked instead.
export const ROUTES = [
  { path: '^/reels/?$', toggle: 'reelsTab', action: 'block' }, // the Reels tab
  { path: '^/reels/audio/', toggle: 'reelsTab', action: 'block' }, // "more reels with this sound"
  // A link into the swipeable reels feed (e.g. in a DM) opens just that one reel.
  { path: '^/reels/([^/]+)/?$', toggle: 'reelsTab', action: 'redirect', to: '/reel/$1/', onlyWhenTapped: true },
  { path: '^/[^/]+/reels/?$', toggle: 'reelsTab', action: 'block' }, // the Reels tab on a profile
  { path: '^/explore/(tags|locations)/', toggle: 'explore', action: 'block' }, // hashtag and place grids
  { path: '^/explore/people/', toggle: 'suggested', action: 'block' }, // "Discover people"
];

// Endless swipe: while watching one reel (for example one sent in DMs),
// moving to a *different* reel is blocked. The brackets must capture the reel id.
export const REEL_SWIPE = { toggle: 'reelSwipe', path: '^/(?:[^/]+/)?reels?/([^/]+)/?$' };

// Hidden with CSS alone: instant, nothing flashes on screen.
// `page` limits a rule to one kind of page (see PAGES). One selector per line.
// `cover` keeps the item's size and covers it (its contents invisible, a small label
// on it) instead of removing it, for posts in a feed. Instagram's feed keeps only the
// posts near the screen and the measured room of the others: a post that shrank after
// being measured makes the whole feed jump back. `invisible` keeps the size too, for
// small things that can sit inside a feed (just invisible, and can't be tapped).
export const CSS_RULES = [
  { toggle: 'reelsTab', css: ['a[href$="/reels/"]'] }, // Reels tab, also on profiles
  {
    toggle: 'feedReels',
    page: 'home',
    cover: true,
    css: ['article:has(a[href*="/reel/"])', 'article:has(a[href^="/reels/audio/"])'], // reel posts in the feed
  },
  { toggle: 'explore', page: 'explore', css: ['a[href*="/p/"]', 'a[href*="/reel/"]'] }, // Explore grid tiles; the search box stays
  { toggle: 'suggested', invisible: true, css: ['a[href^="/explore/people/"]'] }, // "See all" suggested people
];

// Labels Instagram puts on unwanted items, in several languages.
// Matching ignores capital letters, extra spaces, final dots and ’ vs '.
// To support another language, add its wording to the lists.
export const LABELS = {
  sponsored: ['Sponsored', 'Sponsorizzato', 'Sponsorizzata', 'Publicidad', 'Patrocinado', 'Sponsorisé', 'Gesponsert', 'Gesponsord'],
  suggestedForYou: [
    'Suggested for you', 'Suggeriti per te', 'Suggerimenti per te', 'Consigli per te', 'Sugerencias para ti',
    'Sugeridos para ti', 'Sugestões para você', 'Suggestions pour vous', 'Vorschläge für dich',
  ],
  suggestedPosts: [
    'Suggested posts', 'Post suggeriti', 'Publicaciones sugeridas', 'Publicações sugeridas',
    'Publications suggérées', 'Vorgeschlagene Beiträge',
  ],
  suggestedReels: ['Suggested reels', 'Reel suggeriti', 'Reels suggeriti', 'Reels sugeridos'],
  caughtUp: ["You're all caught up", 'Sei in pari', 'Hai visualizzato tutto', 'Ya estás al día', 'Você está em dia', 'Vous êtes à jour'],
};

// What to hide when a label is found:
//   post:  the post that contains the label (nothing if it's not inside a post)
//   block: the whole block around the label, e.g. a "Suggested for you" carousel.
//          If the label is a heading on its own, the list under it goes too.
//   after: every post after the label in the same feed (the label itself stays)
//   story: on a story page, the story is skipped (an ad between stories), see STORIES
export const LABEL_RULES = [
  { label: 'sponsored', toggle: 'ads', hide: ['post', 'story'] },
  { label: 'suggestedForYou', toggle: 'suggested', hide: ['block'] },
  { label: 'suggestedPosts', toggle: 'suggested', hide: ['block', 'after'] },
  { label: 'suggestedReels', toggle: 'suggested', hide: ['block'] },
  { label: 'caughtUp', toggle: 'suggested', hide: ['after'] },
];

// Ads between stories are skipped with Instagram's own "next" control in the story
// viewer, found by its label (or, if there's none, the right-arrow key). Never with the
// ad's own buttons. Going back through stories (a tap on the left of the screen, a swipe
// to the right, the left-arrow key), an ad is skipped backwards instead: with the
// "previous" control next to the "next" one, or the left-arrow key.
export const STORIES = {
  nextLabels: ['Next', 'Avanti', 'Siguiente', 'Suivant', 'Weiter', 'Próximo', 'Volgende', 'Avançar'],
  previousLabels: ['Previous', 'Back', 'Indietro', 'Precedente', 'Anterior', 'Atrás', 'Précédent', 'Retour', 'Zurück', 'Vorige', 'Terug', 'Voltar'],
};

// Label rules are skipped on these pages (a friend could write "Sponsored" in a DM; "Suggeriti
// per te" while making a post is people to tag, not a suggestion).
export const LABEL_SKIP_PAGES = ['direct', 'login', 'create'];

// How the Android app introduces itself to Instagram: as normal mobile Chrome, so
// Instagram serves its regular mobile site. Update the Chrome number now and then.
export const APP_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';

// How Instagram's page is built, used to find "the post" or "the block" around a label.
export const STRUCTURE = {
  post: 'article', // one post in a feed
  content: 'article, a[href*="/p/"], a[href*="/reel/"]', // other content: a block never grows to include it
  heading: 'h1, h2, h3, h4, h5, h6, [role="heading"]', // a block never grows to include another heading
  boundary: 'main, [role="main"], nav, header, [role="dialog"], body', // a block never grows past or around these
  interactive: 'a, button, [role="button"], [role="link"], input', // a block without these is "just a heading"
  maxLevels: 8, // how many levels up a block can grow from its label
};

// A tiny fake of Instagram's mobile site, used only by the tests.
// It reproduces the *signals* the filter relies on (link addresses, <article>
// posts, labels in several languages, a single-page router that changes the
// address without reloading). It is not Instagram's code or layout.
(function () {
  const params = new URLSearchParams(location.search);
  const lang = params.get('hl') || 'en';
  const words = {
    en: { suggested: 'Suggested for you', carousel: 'Suggested for you', caughtUp: 'You’re all caught up' },
    it: { suggested: 'Suggeriti per te', carousel: 'Consigli per te', caughtUp: 'Sei in pari' },
    es: { suggested: 'Sugerencias para ti', carousel: 'Sugerencias para ti', caughtUp: 'Ya estás al día' },
  }[lang];

  // As seen on the real site (Italian, Oct 2026): a story tray of buttons described
  // "Storia di <name>, vista", and a "Consigli per te" carousel of accounts.
  const storyTray = `
    <div class="stories" data-fx="stories">
      <a href="/stories/friend_one/">friend_one</a>
      ${['story_anna', 'storybob', 'story_carla']
        .map((n) => `<div role="button" aria-label="Storia di ${n}, vista"><span>${n}</span></div>`)
        .join('')}
    </div>`;
  const carousel = (fx) => `
    <div data-fx="${fx}">
      <div><div><span>${words.carousel}</span></div><a href="/explore/people/" data-fx="${fx}-see-all">Mostra tutto</a></div>
      <ul>
        <li><a href="/mario_r/"><img alt="Foto di mario_r" src="data:,"></a><span>Mario Rossi</span>
          <span>Follower: claudia.mangia</span><div role="button">Segui</div></li>
        <li><a href="/luisa_b/"><img alt="" src="data:,"></a><span>Luisa Bianchi</span><div role="button">Segui</div></li>
      </ul>
    </div>`;

  const post = (fx, user, link, extra) => `
    <article data-fx="${fx}">
      <div class="post-head"><a href="/${user}/">${user}</a>${extra || ''}</div>
      <div><img alt="Photo by ${user}" src="data:,"></div>
      <section><button aria-label="Like">♡</button><button aria-label="Comment">💬</button></section>
      <a href="${link}">2 hours ago</a>
      <div><span>${user}</span> <span>A caption long enough to be left out of reports, about a lovely day at the beach with friends.</span></div>
    </article>`;

  const views = {
    home: () => `
      <main role="main"><div class="feed">
        ${storyTray}
        <div class="list">
          ${post('post-normal', 'friend_one', '/friend_one/p/AAA/')}
          <article data-fx="post-reel">
            <div class="post-head"><a href="/friend_two/">friend_two</a></div>
            <video muted playsinline></video>
            <a href="/friend_two/reel/RRR/">1 hour ago</a>
            <a href="/reels/audio/123/">Original audio</a>
          </article>
          ${carousel('suggested-carousel')}
          ${post('ad-en', 'shop_brand', '/p/ADEN/', '<span>Sponsored</span>')}
          <div data-fx="suggested-accounts">
            <div><span>${words.suggested}</span><a href="/explore/people/" data-fx="see-all">See all</a></div>
            <div><div><a href="/sugg_one/">sugg_one</a><button>Follow</button></div><div><a href="/sugg_two/">sugg_two</a><button>Follow</button></div></div>
          </div>
          ${post('suggested-post', 'stranger', '/p/SUG/', `<div><span>${words.suggested}</span></div><button>Follow</button>`)}
          ${post('ad-it', 'negozio', '/p/ADIT/', '<span><span>Sponsoriz</span><span>zato</span></span>')}
          ${post('ad-es', 'tienda', '/p/ADES/', '<a href="https://www.facebook.com/ads/about/"><span>Publicidad</span></a>')}
          ${post('post-normal-2', 'friend_three', '/p/BBB/')}
          ${post('ad-textchange', 'late_brand', '/p/ADTC/', '<span class="late-label">​</span>')}
          <div data-fx="caught-up"><div><span>${words.caughtUp}</span><span>You've seen all new posts from the past 3 days.</span></div></div>
          <div data-fx="suggested-heading"><h2>Suggested posts</h2></div>
          ${post('after-1', 'random_account', '/p/S1/')}
        </div>
      </div></main>`,
    explore: () => `
      <main role="main">
        <div><input type="search" placeholder="Search" data-fx="search-box"><a href="/explore/search/" data-fx="search-link">Search</a></div>
        <div data-fx="explore-grid"><div>
          <a href="/p/E1/" data-fx="tile-1"><img alt="" src="data:,"></a>
          <a href="/reel/E2/" data-fx="tile-2"><img alt="" src="data:,"></a>
        </div></div>
      </main>`,
    search: () => `
      <main role="main">
        <input type="search" placeholder="Search" data-fx="search-box">
        <div><a href="/someone/" data-fx="result-user">someone</a><a href="/explore/tags/cats/" data-fx="result-tag">#cats</a></div>
      </main>`,
    reels: () => `
      <main role="main"><div data-fx="reels-feed"><video muted playsinline data-fx="reels-video"></video><a href="/reels/R2/">Next</a></div></main>`,
    reel: (id) => `
      <main role="main"><article data-fx="reel-article" data-id="${id}">
        <video muted playsinline data-fx="reel-video"></video>
        <a href="/friend_one/">friend_one</a>
        <a href="/reel/NEXT1/" data-fx="next-reel-link">Next reel</a>
      </article></main>`,
    inbox: () => `
      <main role="main"><div><a href="/direct/t/123/" data-fx="thread-link">friend_one</a></div></main>`,
    thread: () => `
      <main role="main"><div data-fx="dm-thread">
        <div><span data-fx="dm-sponsored-text">Sponsored</span></div>
        <div data-fx="dm-msg"><span>see you at 8 tonight</span></div>
        <div data-fx="dm-reel"><a href="/reel/DM1/" data-fx="dm-reel-link">Reel from friend_one</a></div>
        <div><a href="/reels/DM3/" data-fx="dm-reels-feed-link">Another reel, linked into the reels feed</a></div>
        <div data-fx="dm-video" style="width:70%"><video muted playsinline style="display:block;width:100%;height:55vh;background:#333"></video></div>
        <textarea data-fx="composer" placeholder="Message..."></textarea>
      </div></main>`,
    login: () => `
      <main role="main"><form data-fx="login-form">
        <input name="username" aria-label="Phone number, username, or email" data-fx="username">
        <input type="password" name="password" aria-label="Password" data-fx="password">
        <button type="submit">Log in</button>
      </form></main>`,
    profile: (user) => `
      <main role="main"><div>
        <header data-fx="profile-header"><h2>${user}</h2><span>Friend One</span></header>
        <div data-fx="profile-suggested"><div><span>${words.suggested}</span></div><div><a href="/sugg_two/">sugg_two</a><button>Follow</button></div></div>
        <div data-fx="profile-tabs">
          <a href="/${user}/" data-fx="tab-posts">Posts</a>
          <a href="/${user}/reels/" data-fx="tab-reels">Reels</a>
          <a href="/${user}/tagged/" data-fx="tab-tagged">Tagged</a>
        </div>
        <div data-fx="profile-grid"><a href="/p/P1/"><img alt="" src="data:,"></a><a href="/reel/P2/"><img alt="" src="data:,"></a></div>
      </div></main>`,
    // Notifications, as on the real site: sections with headings, then a heading on its
    // own ("Suggeriti per te") with the suggestions list as the next block.
    notifications: () => `
      <main role="main"><div><div class="list" data-fx="notif-list">
        <div data-fx="notif-yesterday"><div role="heading"><span>Ieri</span></div>
          <div><a href="/friend_one/">friend_one</a><span>ha messo Mi piace alla tua storia.</span></div></div>
        <div data-fx="notif-week"><hr><div role="heading"><span>Questa settimana</span></div>
          <div><a href="/friend_two/">friend_two</a><span>ha iniziato a seguirti.</span><button>Segui già</button></div></div>
        <div data-fx="notif-sugg-heading"><h4>${words.suggested}</h4></div>
      </div></div></main>`,
    // An endless feed, like Instagram's: a spinner at the end loads the next batch when
    // it comes into view (IntersectionObserver). Most batches are suggestions, which
    // the filter hides; a friend's post only arrives in the third batch.
    endless: () => `
      <main role="main"><div class="feed">
        <div class="list" data-fx="endless-list">
          ${post('first-friend', 'friend_one', '/friend_one/p/F1/')}
        </div>
        <div data-fx="spinner-box"><div role="progressbar" data-fx="spinner"><svg aria-label="Caricamento..."></svg></div></div>
      </div></main>`,
    virtual: () => `<main role="main"><div class="feed"><div class="vlist" data-fx="vlist"></div></div></main>`,
    // Instagram's classic home (&fake=main): the same kind of list, with what the main feed
    // mixes in (see startMainFeed).
    main: () => `<main role="main"><div class="feed">${storyTray}<div class="vlist" data-fx="mlist"></div></div></main>`,
    // Making a post or a story: the photo to crop (pinch to zoom it), the file picker, people
    // to tag under "Suggeriti per te", and Instagram's "Condividi" at the bottom right.
    create: () => `
      <main role="main"><div data-fx="create">
        <div data-fx="crop" style="height:320px;background:#ccc;touch-action:none">photo to post</div>
        <input type="file" accept="image/*,video/*" data-fx="create-file">
        <div data-fx="tag-people"><h4>${words.suggested}</h4>
          <div><a href="/friend_one/">friend_one</a><button>Tagga</button></div></div>
        <div role="button" data-fx="create-share" style="position:fixed;right:8px;bottom:70px">Condividi</div>
      </div></main>`,
    // A reel opened from a DM, as Instagram can show it once its viewer has loaded: a
    // full-screen list you swipe (scroll-snap) on to other reels, and the address stays put.
    // Swiping moves it two ways: the browser's own scrolling, and the viewer's code (a
    // finger lifted 60 px higher than it went down, by touch or by pointer events).
    reelfeed: (id) => `<main role="main">${reelList(id)}</main>`,
    // A reel opened from a DM shown first as a post (the video filling the screen, a comment
    // box), with Instagram's full viewer opening over it a moment later (&viewer=ms, 2 s by
    // default), in a dialog, where you swipe on to other reels.
    reelpost: (id) => `
      <main role="main"><article data-fx="reel-article" data-id="${id}">
        <video muted playsinline data-fx="reel-post-video" style="display:block;width:100%;height:100vh;background:#111"></video>
        <a href="/friend_one/">friend_one</a>
        <textarea data-fx="comment-box" placeholder="Aggiungi un commento..."></textarea>
      </article></main>`,
    other: () => `<main role="main"><p data-fx="other">Some other page</p></main>`,
  };

  function reelList(id) {
    return `<div data-fx="reel-list" style="height:100vh;overflow-y:scroll;scroll-snap-type:y mandatory">
        ${[id, 'NEXT1', 'NEXT2']
          .map(
            (r, i) => `<div data-fx="reel-item-${i}" style="height:100vh;scroll-snap-align:start;position:relative">
              <video muted playsinline data-fx="reel-video-${i}" style="display:block;width:100%;height:90vh;background:#222"></video>
              <a href="/friend_${i}/reel/${r}/">reel ${r}</a>
              <div role="button" aria-label="Mi piace" data-fx="reel-like-${i}" style="position:absolute;right:8px;bottom:40vh;width:44px;height:44px">♡</div>
              <div role="button" aria-label="Condividi" data-fx="reel-share-${i}" style="position:absolute;right:8px;bottom:30vh;width:44px;height:44px">➤</div>
              <button data-fx="reel-comments-${i}" style="position:absolute;right:8px;bottom:12vh">Commenti</button>
              <div data-fx="reel-caption-${i}" style="position:absolute;left:8px;bottom:14vh;max-width:60%;color:#fff">a caption… <span role="button" data-fx="reel-more-${i}" style="display:inline-block;padding:8px">altro</span></div></div>`,
          )
          .join('')}
      </div>`;
  }

  // A feed like Instagram's real one (seen in a 0.3.2 report): only the posts near the
  // screen are in the page, and the room for the others is padding on the list. Each
  // post's height is measured once, when it first appears, and a reel's links arrive a
  // moment after the post itself. Every third post is a reel.
  function startVirtualFeed() {
    const list = view.querySelector('.vlist');
    const COUNT = 30;
    const ESTIMATE = 520; // the height of a post not measured yet
    const MARGIN = 400; // posts this close to the screen are in the page
    const measured = new Map();
    const shown = new Map();
    const heightOf = (i) => measured.get(i) || ESTIMATE;
    const isReel = (i) => i % 3 === 1;
    const make = (i) => {
      const el = document.createElement('article');
      el.dataset.fx = `v${i}`;
      el.innerHTML = `<div class="post-head"><a href="/user${i}/">user${i}</a></div>
        <div style="height:440px;background:#ddd">${isReel(i) ? '<video muted playsinline></video>' : 'photo'}</div>
        <div class="foot" style="height:20px">${isReel(i) ? '' : `<a href="/user${i}/p/V${i}/">1 ora fa</a>`}</div>`;
      if (isReel(i)) {
        setTimeout(() => (el.querySelector('.foot').innerHTML = `<a href="/user${i}/reel/V${i}/">1 ora fa</a>`), 250);
      }
      return el;
    };
    function update() {
      if (!list.isConnected) return window.removeEventListener('scroll', update);
      const origin = list.getBoundingClientRect().top + window.scrollY;
      const from = window.scrollY - MARGIN;
      const to = window.scrollY + window.innerHeight + MARGIN;
      let first = -1;
      let last = -1;
      let y = origin;
      for (let i = 0; i < COUNT; i++) {
        if (y + heightOf(i) > from && y < to) {
          if (first < 0) first = i;
          last = i;
        }
        y += heightOf(i);
      }
      let padTop = 0;
      let padBottom = 0;
      for (let i = 0; i < COUNT; i++) {
        if (i < first) padTop += heightOf(i);
        if (i > last) padBottom += heightOf(i);
      }
      for (const [i, el] of shown) {
        if (i < first || i > last) {
          el.remove();
          shown.delete(i);
        }
      }
      list.style.paddingTop = padTop + 'px';
      list.style.paddingBottom = padBottom + 'px';
      let next = null;
      for (let i = last; i >= first; i--) {
        let el = shown.get(i);
        if (!el) {
          el = make(i);
          shown.set(i, el);
        }
        if (el.parentNode !== list || el.nextSibling !== next) list.insertBefore(el, next);
        if (!measured.has(i)) measured.set(i, el.offsetHeight);
        next = el;
      }
    }
    window.addEventListener('scroll', update, { passive: true });
    // With &remeasure=resize, the list measures its posts again on a resize, like many do.
    if (params.get('remeasure') === 'resize') {
      window.addEventListener('resize', () => {
        for (const [i, el] of shown) measured.set(i, el.offsetHeight);
        update();
      });
    }
    update();
  }

  // Instagram's classic home, as a list like the one above (only nearby items in the page,
  // each item's height measured once, when it first appears). Each item sits in a few
  // wrappers of its own, and the main feed mixes in, besides friends' posts and reels: ads
  // whose "Sponsorizzato" is filled in a moment later, a "Consigli per te" carousel that
  // isn't a post, with its heading deep inside many boxes, as on the real site, and after
  // "Sei in pari", suggested posts. Lists Instagram's "Vedi tutti" for reels too.
  function startMainFeed() {
    const list = view.querySelector('.vlist');
    const COUNT = 40;
    const ESTIMATE = 520;
    const MARGIN = 400;
    const CAUGHT_UP = 24; // the "Sei in pari" item; suggested posts after it
    const measured = new Map();
    const shown = new Map();
    const heightOf = (i) => measured.get(i) || ESTIMATE;
    const deep = (levels, inner) => '<div>'.repeat(levels) + inner + '</div>'.repeat(levels);
    const kind = (i) => {
      if (i === CAUGHT_UP) return 'caughtUp';
      if (i > CAUGHT_UP) return 'suggestedPost';
      return ['post', 'reel', 'ad', 'carousel', 'post'][i % 5];
    };
    const article = (i, head, media, foot) => `<article data-fx="m${i}-post">
        <div class="post-head">${deep(4, `<a href="/user${i}/">user${i}</a>${head}`)}</div>
        <div style="height:440px;background:#ddd">${media}</div>
        <div class="foot" style="height:20px">${foot}</div></article>`;
    const make = (i) => {
      const k = kind(i);
      const el = document.createElement('div');
      el.className = 'item';
      el.dataset.fx = `m${i}`;
      el.dataset.kind = k;
      let inner;
      if (k === 'post') inner = article(i, '', 'photo', `<a href="/user${i}/p/M${i}/">1 ora fa</a>`);
      else if (k === 'reel') inner = article(i, '', '<video muted playsinline></video>', '');
      else if (k === 'ad') inner = article(i, '<span class="late-label">​</span>', 'photo', `<a href="/p/AD${i}/">Scopri di più</a>`);
      else if (k === 'suggestedPost') inner = article(i, `<div><span>${words.suggested}</span></div><button>Segui</button>`, 'photo', `<a href="/stranger${i}/p/S${i}/">1 g</a>`);
      else if (k === 'caughtUp') inner = `<div style="height:160px">${deep(3, `<span>${words.caughtUp}</span>`)}<a href="/?variant=past_posts">Vedi i post precedenti</a></div>`;
      else {
        inner = `<div style="padding:8px 0">
          ${deep(12, `<span>${words.carousel}</span>`)}
          <div style="height:260px;display:flex;gap:8px">${deep(2, `<a href="/sugg${i}/">sugg${i}</a><div role="button">Segui</div>`)}</div>
          <div><a href="/explore/people/">Mostra tutto</a></div>
          <div><a href="/reels/">Vedi altri reel</a></div></div>`;
      }
      el.innerHTML = deep(3, inner);
      if (k === 'reel') {
        setTimeout(() => (el.querySelector('.foot').innerHTML = `<a href="/user${i}/reel/M${i}/">1 ora fa</a>`), 250);
      }
      if (k === 'ad') setTimeout(() => (el.querySelector('.late-label').firstChild.data = 'Sponsorizzato'), 250);
      return el;
    };
    function update() {
      if (!list.isConnected) return window.removeEventListener('scroll', update);
      const origin = list.getBoundingClientRect().top + window.scrollY;
      const from = window.scrollY - MARGIN;
      const to = window.scrollY + window.innerHeight + MARGIN;
      let first = -1;
      let last = -1;
      let y = origin;
      for (let i = 0; i < COUNT; i++) {
        if (y + heightOf(i) > from && y < to) {
          if (first < 0) first = i;
          last = i;
        }
        y += heightOf(i);
      }
      let padTop = 0;
      let padBottom = 0;
      for (let i = 0; i < COUNT; i++) {
        if (i < first) padTop += heightOf(i);
        if (i > last) padBottom += heightOf(i);
      }
      for (const [i, el] of shown) {
        if (i < first || i > last) {
          el.remove();
          shown.delete(i);
        }
      }
      list.style.paddingTop = padTop + 'px';
      list.style.paddingBottom = padBottom + 'px';
      let next = null;
      for (let i = last; i >= first; i--) {
        let el = shown.get(i);
        if (!el) {
          el = make(i);
          shown.set(i, el);
        }
        if (el.parentNode !== list || el.nextSibling !== next) list.insertBefore(el, next);
        if (!measured.has(i)) measured.set(i, el.offsetHeight);
        next = el;
      }
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  const suggestedPost = (n) =>
    post(`sugg-${n}`, `stranger_${n}`, `/stranger_${n}/p/S${n}/`, `<div><span>${words.suggested}</span></div><button>Segui</button>`);
  const batches = [
    [1, 2, 3, 4].map(suggestedPost),
    [5, 6, 7, 8].map(suggestedPost),
    [suggestedPost(9), post('late-friend', 'friend_five', '/friend_five/p/LF/')],
  ];

  // With &slow=1: a slow connection (each batch takes 2.5 s) and a loader that isn't
  // protected against being triggered again while a batch is on its way. Then it asks
  // for the same batch twice, and the same posts show up again further down.
  function startEndlessLoader() {
    const list = view.querySelector('.list');
    const box = view.querySelector('[data-fx="spinner-box"]');
    const slow = params.get('slow') === '1';
    const served = slow ? [batches[0], batches[2]] : batches;
    let next = 0; // the batch to ask for; it only moves on once that batch has arrived
    let loading = false;
    window.fakeLoadsStarted = 0;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting) || (loading && !slow) || next >= served.length) return;
      loading = true;
      window.fakeLoadsStarted++;
      const asked = next;
      setTimeout(() => {
        list.insertAdjacentHTML('beforeend', served[asked].join(''));
        next = asked + 1;
        window.fakeBatchesLoaded = next;
        loading = false;
        if (next >= served.length) box.remove();
      }, slow ? 2500 : 50);
    });
    io.observe(box.firstElementChild);
  }

  function viewFor(path) {
    let m;
    if (path === '/' && params.get('fake') === 'endless') return views.endless();
    if (path === '/' && params.get('fake') === 'virtual') return views.virtual();
    if (path === '/' && params.get('fake') === 'main') return views.main();
    if (path === '/') return views.home();
    if (path === '/notifications/') return views.notifications();
    if (/^\/(stories\/)?create\//.test(path)) return views.create();
    if (path === '/explore/') return views.explore();
    if (path.startsWith('/explore/search/')) return views.search();
    if (path === '/reels/') return views.reels();
    if ((m = path.match(/^\/reel\/([^/]+)\/$/))) {
      if (params.get('fake') === 'reelfeed') return views.reelfeed(m[1]);
      if (params.get('fake') === 'reelpost') return views.reelpost(m[1]);
      return views.reel(m[1]);
    }
    if (path === '/direct/inbox/') return views.inbox();
    if (path.startsWith('/direct/t/')) return views.thread();
    if (path === '/accounts/login/') return views.login();
    if ((m = path.match(/^\/([\w.]+)\/$/))) return views.profile(m[1]);
    return views.other();
  }

  document.getElementById('root').innerHTML = `
    <div class="top" data-fx="topbar">
      <a href="/">Instagram</a>
      <a href="/accounts/activity/" aria-label="Notifications">♥</a>
      <a href="/direct/inbox/" aria-label="Messenger">✉</a>
    </div>
    <div id="view"></div>
    <nav data-fx="nav">
      <a href="/" aria-label="Home" data-fx="nav-home">Home</a>
      <a href="/explore/" aria-label="Search and explore" data-fx="nav-explore">Search</a>
      <a href="/create/select/" aria-label="New post" data-fx="nav-create">New</a>
      <a href="/reels/" aria-label="Reels" data-fx="nav-reels">Reels</a>
      <a href="/me_user/" aria-label="Profile" data-fx="nav-profile">me</a>
    </nav>`;
  const view = document.getElementById('view');

  function render() {
    view.innerHTML = viewFor(location.pathname);
    if (view.querySelector('[data-fx="spinner-box"]')) startEndlessLoader();
    if (view.querySelector('[data-fx="vlist"]')) startVirtualFeed();
    if (view.querySelector('[data-fx="mlist"]')) startMainFeed();
    if (view.querySelector('[data-fx="reel-list"]')) startReelFeed(view.querySelector('[data-fx="reel-list"]'));
    if (view.querySelector('[data-fx="reel-post-video"]')) {
      const id = view.querySelector('[data-fx="reel-article"]').dataset.id;
      setTimeout(() => {
        if (!view.querySelector('[data-fx="reel-post-video"]')) return;
        document.body.insertAdjacentHTML('beforeend', `<div role="dialog" data-fx="reel-viewer" style="position:fixed;inset:0;background:#000">${reelList(id)}</div>`);
        startReelFeed(document.querySelector('[data-fx="reel-viewer"] [data-fx="reel-list"]'));
      }, Number(params.get('viewer') || 2000));
    }
    if (location.pathname === '/notifications/') {
      // The suggestions list arrives a moment after its heading.
      setTimeout(() => {
        view.querySelector('.list').insertAdjacentHTML(
          'beforeend',
          `<div data-fx="notif-sugg-list">
            <div><a href="/sugg_three/">sugg_three</a><span>Follower: claudia.mangia</span><button>Segui</button></div>
            <div><a href="/explore/people/" data-fx="notif-see-all">Vedi tutti i suggerimenti</a></div>
          </div>`,
        );
      }, 60);
    }
    if (location.pathname === '/' && view.querySelector('[data-fx="caught-up"]')) {
      // Things Instagram adds later: more posts while scrolling, labels filled in after loading.
      setTimeout(() => {
        const list = view.querySelector('.list');
        if (!list) return;
        const caughtUp = list.querySelector('[data-fx="caught-up"]');
        caughtUp.insertAdjacentHTML('beforebegin', post('post-late', 'friend_four', '/p/CCC/'));
        caughtUp.insertAdjacentHTML('beforebegin', post('ad-late', 'brand_late', '/p/ADL/', '<span>Sponsored</span>'));
        list.insertAdjacentHTML('beforeend', post('after-late', 'another_stranger', '/p/S2/'));
        const label = list.querySelector('.late-label');
        if (label) label.firstChild.data = 'Sponsored';
      }, 60);
    }
  }

  // With &after=direct or &after=post, 2 s after the reel opens Instagram changes the
  // address (back to the chat, or to the post's address) while the reel stays on screen.
  function startReelFeed(list) {
    const after = { direct: '/direct/t/123/', post: '/p/DM1/' }[params.get('after')];
    if (after) setTimeout(() => history.replaceState({}, '', after + location.search), 2000);
    window.fakeTaps = 0;
    window.fakeCodeSwipes = 0;
    let down = null;
    const next = () => {
      window.fakeCodeSwipes++;
      list.scrollBy(0, window.innerHeight);
    };
    list.addEventListener('touchstart', (e) => (down = e.touches[0].clientY), { passive: true });
    list.addEventListener('touchend', (e) => {
      if (down !== null && down - e.changedTouches[0].clientY > 60) next();
      down = null;
    });
    let pointerDown = null;
    // Like Instagram's viewer opened from a DM: a finger moving up a few pixels, or held
    // still on the reel for 600 ms, opens the reply box with the keyboard.
    let hold = null;
    const openReply = () => {
      if (document.querySelector('[data-fx="reply-box"]')) return;
      window.fakeReplyOpened = true;
      document.body.insertAdjacentHTML(
        'beforeend',
        '<div data-fx="reply" style="position:fixed;left:0;right:0;bottom:0;background:#fff"><textarea data-fx="reply-box"></textarea></div>',
      );
      document.querySelector('[data-fx="reply-box"]').focus();
    };
    const stopHold = () => {
      clearTimeout(hold);
      hold = null;
    };
    list.addEventListener('pointerdown', (e) => {
      pointerDown = e.clientY;
      stopHold();
      hold = setTimeout(openReply, 600);
    });
    list.addEventListener('pointermove', (e) => {
      if (pointerDown === null) return;
      if (Math.abs(e.clientY - pointerDown) > 4) stopHold();
      if (pointerDown - e.clientY > 5) openReply();
    });
    list.addEventListener('pointercancel', () => {
      stopHold();
      pointerDown = null;
    });
    list.addEventListener('pointerup', (e) => {
      stopHold();
      if (pointerDown !== null && pointerDown - e.clientY > 60) next();
      pointerDown = null;
    });
    window.fakeLikes = 0;
    window.fakeDoubleTaps = 0;
    list.addEventListener('dblclick', (e) => e.target.tagName === 'VIDEO' && window.fakeDoubleTaps++);
    list.addEventListener('click', (e) => {
      const fx = (e.target.closest('[data-fx]') || e.target).dataset.fx || '';
      if (e.target.tagName === 'VIDEO') window.fakeTaps++;
      if (fx.startsWith('reel-like')) window.fakeLikes++;
      if (fx.startsWith('reel-more')) window.fakeCaptionOpen = true;
      if (fx.startsWith('reel-share')) {
        // The people to send it to, in a sheet you scroll; "Invia" sends and closes it.
        document.body.insertAdjacentHTML(
          'beforeend',
          `<div role="dialog" data-fx="share-sheet" style="position:fixed;left:0;right:0;bottom:0;height:50vh;overflow-y:auto;background:#fff">
            ${Array.from({ length: 20 }, (_, i) => `<div style="height:56px">contact ${i} <button data-fx="share-send-${i}">Invia</button></div>`).join('')}</div>`,
        );
        const sheet = document.querySelector('[data-fx="share-sheet"]');
        sheet.addEventListener('click', (ev) => {
          const send = ev.target.closest('button');
          if (!send) return;
          window.fakeSent = send.dataset.fx;
          sheet.remove();
        });
      }
      if (!fx.startsWith('reel-comments')) return;
      // Comments open in a sheet over the reel, where you scroll the comments and write one.
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div role="dialog" data-fx="comments-sheet" style="position:fixed;left:0;right:0;bottom:0;height:60vh;overflow-y:scroll;background:#fff">
          <textarea data-fx="comment-box" placeholder="Aggiungi un commento..." style="display:block;width:90%;height:40px"></textarea>
          ${Array.from({ length: 30 }, (_, i) => `<p style="height:60px">comment ${i}</p>`).join('')}</div>`,
      );
    });
  }

  function navigate(path) {
    history.pushState({}, '', path);
    render();
  }

  // Like Instagram: links change the address without reloading the page.
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (url.origin !== location.origin) return;
    e.preventDefault();
    navigate(url.pathname + url.search);
  });
  // Stories open over the feed, which stays in the page, where it was, underneath.
  function openStory() {
    history.pushState({}, '', '/stories/friend_one/111/');
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div role="dialog" data-fx="story-viewer" style="position:fixed;inset:0;background:#000"><video muted playsinline></video></div>',
    );
  }

  // Stories in a row, with an ad between two friends' stories, as Instagram's viewer on a
  // computer has them: tap zones (left third: back, the rest: next), "Indietro" / "Avanti"
  // controls at the sides, and the arrow keys. With &storynext=none there are no controls,
  // only the tap zones and the keys. The ad has the advertiser, "Sponsorizzato" and its own
  // link. The phone's viewer is openPhoneStories() below.
  const storyList = [
    { path: '/stories/friend_one/111/', who: 'friend_one' },
    { path: '/stories/shop_brand/999/', who: 'shop_brand', ad: true },
    { path: '/stories/friend_two/222/', who: 'friend_two' },
  ];

  function openStories(start) {
    let at = start;
    history.pushState({}, '', storyList[at].path);
    const controls =
      params.get('storynext') === 'none'
        ? ''
        : `<div role="button" aria-label="Indietro" data-fx="story-prev" style="position:absolute;left:4px;top:50%;width:24px;height:24px"><svg aria-label="Indietro"></svg></div>
          <div role="button" aria-label="Avanti" data-fx="story-next" style="position:absolute;right:4px;top:50%;width:24px;height:24px"><svg aria-label="Avanti"></svg></div>`;
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div role="dialog" data-fx="story-viewer" style="position:fixed;inset:0;background:#000;color:#fff">
        <div data-fx="story-content"></div>
        <div data-fx="story-left" style="position:absolute;left:0;top:20%;width:33%;height:60%"></div>
        <div data-fx="story-right" style="position:absolute;right:0;top:20%;width:67%;height:60%"></div>
        ${controls}
      </div>`,
    );
    const viewer = document.querySelector('[data-fx="story-viewer"]');
    const show = () => {
      const story = storyList[at];
      viewer.querySelector('[data-fx="story-content"]').innerHTML =
        `<div><a href="/${story.who}/">${story.who}</a><span>${story.ad ? 'Sponsorizzato' : '3 h'}</span></div>` +
        '<video muted playsinline></video>' +
        (story.ad ? '<a href="https://shop.example/buy" data-fx="story-cta">Scopri di più</a>' : '');
      const cta = viewer.querySelector('[data-fx="story-cta"]');
      if (cta) cta.addEventListener('click', () => (window.fakeCtaTapped = true));
      window.fakeStory = story.who;
    };
    const go = (step) => {
      if (!viewer.isConnected || at + step < 0 || at + step >= storyList.length) return;
      at += step;
      window.fakeStoryMoves++;
      window.fakeStoryTrail.push(storyList[at].who);
      history.replaceState({}, '', storyList[at].path);
      show();
    };
    window.fakeStoryMoves = 0;
    window.fakeStoryTrail = [storyList[at].who];
    show();
    viewer.querySelector('[data-fx="story-left"]').addEventListener('click', () => go(-1));
    viewer.querySelector('[data-fx="story-right"]').addEventListener('click', () => go(1));
    for (const [fx, step] of [['story-prev', -1], ['story-next', 1]]) {
      const control = viewer.querySelector(`[data-fx="${fx}"]`);
      if (control) control.addEventListener('click', () => go(step));
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    });
  }

  // Instagram's story viewer on a phone, as its own code builds it (PolarisMobileStories,
  // PolarisMobileStoryEventZone, read on instagram.com, Nov 2026). The parts that matter:
  // - One "reel" (a person's stories, or an ad) on screen at a time, in a <section> with a
  //   <header>. Changing reel, the old one slides out while the new one slides in, both in
  //   the page for 300 ms. The address is /stories/<name>/<item>/, also for an ad.
  // - The tap zone: a div role=button over the story with four empty, unlabelled buttons,
  //   two on the left (previous part) and two on the right (next part). No "Next" label,
  //   and no arrow keys on a phone (those are the computer's viewer).
  // - A finger down pauses the story; lifted, it plays again. Held 200 ms or more, it was a
  //   pause: the touchend is cancelled, so there's no click and no next story.
  // - A swipe counts only if it took 500 ms at most: sideways over 50 px (and under 100 px
  //   up or down) changes reel, up opens the ad's link (or the reply box), down closes.
  //   There's no touchcancel handler: a touch the browser calls off leaves its start behind.
  // With &prerender=1 the next reel is also drawn, just off the right edge of the screen.
  const phoneReels = [
    { who: 'friend_one', items: ['111', '112'] },
    { who: 'shop_brand', ad: true, items: ['901', '902'] },
    { who: 'friend_two', items: ['222'] },
  ];

  function openPhoneStories(startReel) {
    let reel = startReel || 0;
    let item = 0;
    let section = null;
    const trail = [];
    const fx = { moves: 0, pausedByOthers: 0, ctaOpened: 0, replyOpened: 0, ignoredTaps: 0, trail };
    window.fakePhone = fx;
    let ownPause = false;
    // Every pause of a story's video that isn't the viewer's own (a finger down) is counted.
    const realPause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function () {
      if (!ownPause && this.closest('[data-fx="story-page"]')) fx.pausedByOthers++;
      return realPause.call(this);
    };
    const pathOf = () => `/stories/${phoneReels[reel].who}/${phoneReels[reel].items[item]}/`;
    history.pushState({}, '', pathOf());
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div data-fx="story-page" style="position:fixed;inset:0;background:#000;color:#fff;overflow:hidden"></div>',
    );
    const pageEl = document.querySelector('[data-fx="story-page"]');
    const state = { touchStart: null, x: 0, y: 0, pauseStart: null };
    const video = () => section && section.querySelector('video');
    const play = () => {
      const v = video();
      if (v) v.play().catch(() => {});
    };
    const pause = () => {
      const v = video();
      if (!v || v.paused) return;
      ownPause = true;
      v.pause();
      ownPause = false;
    };
    const note = () => {
      trail.push(`${phoneReels[reel].who}/${phoneReels[reel].items[item]}`);
      window.fakeStory = phoneReels[reel].who;
    };

    function build(at, offset) {
      const r = phoneReels[at];
      pageEl.insertAdjacentHTML(
        'beforeend',
        `<section data-fx="reel-${r.who}" style="position:absolute;inset:0;transition:transform 300ms linear;transform:translateX(${offset}%)">
          <header style="position:absolute;top:10px;left:10px;z-index:2"><a href="/${r.who}/">${r.who}</a> <span>${r.ad ? 'Sponsorizzato' : '3 h'}</span></header>
          <video muted playsinline style="position:absolute;inset:0;width:100%;height:100%"></video>
          <div role="button" tabindex="0" data-fx="zone" style="position:absolute;inset:0">
            <button data-fx="zone-prev" style="position:absolute;left:0;top:0;width:15%;height:100%;border:0;background:none"></button>
            <button data-fx="zone-prev-2" style="position:absolute;left:15%;top:15%;width:15%;height:70%;border:0;background:none"></button>
            <button data-fx="zone-next" style="position:absolute;right:0;top:0;width:15%;height:100%;border:0;background:none"></button>
            <button data-fx="zone-next-2" style="position:absolute;right:15%;top:15%;width:55%;height:70%;border:0;background:none"></button>
          </div>
          ${r.ad ? '<a href="https://shop.example/buy" data-fx="story-cta" style="position:absolute;bottom:20px;left:30%;z-index:2">Scopri di più</a>' : ''}
        </section>`,
      );
      return pageEl.lastElementChild;
    }

    function wire(s) {
      const zone = s.querySelector('[data-fx="zone"]');
      zone.addEventListener('touchstart', (e) => {
        if (state.touchStart == null) {
          state.touchStart = Date.now();
          state.x = e.touches[0].clientX;
          state.y = e.touches[0].clientY;
        }
        pause();
        if (state.pauseStart == null) state.pauseStart = Date.now();
      });
      zone.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
          if (state.pauseStart != null) {
            play();
            if (Date.now() - state.pauseStart >= 200) {
              const t = e.changedTouches[0];
              if (Math.abs(t.clientX - state.x) < 10 && Math.abs(t.clientY - state.y) < 10) fx.ignoredTaps++; // a tap, not a swipe
              e.stopPropagation();
              e.preventDefault();
            }
          }
          state.pauseStart = null;
        }
        if (state.touchStart == null) return;
        const took = Date.now() - state.touchStart;
        const dx = e.changedTouches[0].clientX - state.x;
        const dy = e.changedTouches[0].clientY - state.y;
        state.touchStart = null;
        if (took > 500) return;
        if (Math.abs(dy) > 50 && Math.abs(dx) < 100) {
          if (dy < 0) phoneReels[reel].ad ? fx.ctaOpened++ : fx.replyOpened++;
          else history.back();
        } else if (Math.abs(dy) < 100) {
          if (dx < -50) toReel(1);
          else if (dx > 50) toReel(-1);
        }
      });
      for (const b of s.querySelectorAll('[data-fx^="zone-prev"]')) b.addEventListener('click', () => step(-1));
      for (const b of s.querySelectorAll('[data-fx^="zone-next"]')) b.addEventListener('click', () => step(1));
      const cta = s.querySelector('[data-fx="story-cta"]');
      if (cta) cta.addEventListener('click', () => (window.fakeCtaTapped = true));
    }

    function prerender() {
      for (const old of pageEl.querySelectorAll('[data-fx="prerendered"]')) old.remove();
      if (params.get('prerender') !== '1' || reel + 1 >= phoneReels.length) return;
      const next = build(reel + 1, 100);
      next.setAttribute('data-fx', 'prerendered');
      next.style.transition = 'none';
    }

    function show(direction) {
      const old = section;
      section = build(reel, direction ? direction * 100 : 0);
      wire(section);
      if (old) {
        old.getBoundingClientRect(); // start the slide from where they are
        section.getBoundingClientRect();
        old.style.transform = `translateX(${-direction * 100}%)`;
        section.style.transform = 'translateX(0%)';
        setTimeout(() => old.remove(), 300);
      }
      prerender();
      play();
    }

    function toReel(dir) {
      const next = reel + dir;
      if (!pageEl.isConnected || next < 0 || next >= phoneReels.length) return;
      reel = next;
      item = dir > 0 ? 0 : phoneReels[reel].items.length - 1;
      fx.moves++;
      history.replaceState({}, '', pathOf());
      note();
      show(dir);
    }

    // Next or previous part of this reel, or on to the next or previous reel.
    function step(dir) {
      if (!pageEl.isConnected) return;
      const next = item + dir;
      if (next < 0 || next >= phoneReels[reel].items.length) return toReel(dir);
      item = next;
      fx.moves++;
      history.replaceState({}, '', pathOf());
      note();
      const v = video();
      if (v) v.setAttribute('data-item', phoneReels[reel].items[item]); // the same header, another part
      play();
    }

    note();
    show(0);
  }

  window.addEventListener('popstate', () => {
    const story = document.querySelector('[data-fx="story-viewer"], [data-fx="story-page"]');
    if (story) story.remove();
    else render();
  });
  window.fake = {
    navigate, openStory, openStories: () => openStories(0), openStoryAd: () => openStories(1),
    openPhoneStories: (reel) => openPhoneStories(reel),
  };
  render();
})();

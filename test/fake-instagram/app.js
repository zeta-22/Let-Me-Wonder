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
    other: () => `<main role="main"><p data-fx="other">Some other page</p></main>`,
  };

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
    if (path === '/') return views.home();
    if (path === '/notifications/') return views.notifications();
    if (path === '/explore/') return views.explore();
    if (path.startsWith('/explore/search/')) return views.search();
    if (path === '/reels/') return views.reels();
    if ((m = path.match(/^\/reel\/([^/]+)\/$/))) return views.reel(m[1]);
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
  window.addEventListener('popstate', render);
  window.fake = { navigate };
  render();
})();

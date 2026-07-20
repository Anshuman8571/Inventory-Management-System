// In-app navigation layer. Solves two problems reported in the field:
//
// 1. Swiping from the phone's screen edge (or tapping the browser/hardware back
//    button) exited the whole app instead of stepping back one screen — because
//    the app never touched the History API. Every screen was just an innerHTML
//    swap, so from the browser's point of view there was only ever one "page."
// 2. There was no consistent Back / Home affordance — a few screens had their own
//    ad hoc "Back" button wired to a hardcoded destination (e.g. Dashboard's
//    "Back to Scanning", which isn't actually where the user came from).
//
// Approach: keep an in-memory stack describing how to re-render each screen the
// user has visited. Every screen transition pairs a stack push with a
// history.pushState() call, used purely as a signal — the actual content lives in
// memory, not in history.state. That way swipe-back, the hardware/browser back
// button, and the header's own Back icon all funnel through the same `popstate`
// handler, so they behave identically.
//
// Usage (replaces calling a screen's render function directly):
//   Nav.push(window.renderDashboard, [container], { title: 'Inventory Dashboard' });
//   Nav.reset(window.renderHomeScreen, [container, role], { title: 'Main Menu', showHome: false });
// Back navigation (from a screen's own "Back" button, if it wants one) should just
// call history.back() so it goes through the same popstate path as swipe-back.

(function () {
  const stack = []; // { render, args, title, showBack, showHome }
  let headerEl = null;

  function getContentRoot() {
    return document.querySelector('.card');
  }

  function ensureHeader() {
    if (headerEl) return;
    const contentRoot = getContentRoot();
    if (!contentRoot || !contentRoot.parentNode) return;

    headerEl = document.createElement('div');
    headerEl.id = 'nav-header';
    headerEl.className = 'nav-header';
    headerEl.innerHTML = `
      <button type="button" id="nav-back-btn" class="nav-icon-btn" aria-label="Back">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <span id="nav-title" class="nav-title"></span>
      <button type="button" id="nav-home-btn" class="nav-icon-btn" aria-label="Home">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M4 11.5L12 4l8 7.5M6 10v9h5v-5h2v5h5v-9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    `;
    contentRoot.parentNode.insertBefore(headerEl, contentRoot);

    headerEl.querySelector('#nav-back-btn').addEventListener('click', () => {
      if (stack.length > 1) history.back();
    });
    headerEl.querySelector('#nav-home-btn').addEventListener('click', () => {
      goHome();
    });
  }

  function updateHeader() {
    if (!headerEl) return;
    const top = stack[stack.length - 1];
    const backBtn = headerEl.querySelector('#nav-back-btn');
    const homeBtn = headerEl.querySelector('#nav-home-btn');
    const titleEl = headerEl.querySelector('#nav-title');

    const showBack = !!top && top.showBack && stack.length > 1;
    const showHome = !!top && top.showHome;

    // Most screens are transactional (scan a sticker, confirm a qty) and are
    // deliberately narrow/phone-width. A few (like the dashboard's cross-tab
    // table) are read-heavy and genuinely benefit from more room — this just
    // toggles a body class those screens' CSS can key off, it doesn't force a
    // fixed width so it still degrades to a normal scrollable table on a phone.
    document.body.classList.toggle('wide-screen', !!(top && top.wide));

    if (!showBack && !showHome) {
      headerEl.style.display = 'none';
      return;
    }

    headerEl.style.display = 'flex';
    backBtn.style.visibility = showBack ? 'visible' : 'hidden';
    homeBtn.style.visibility = showHome ? 'visible' : 'hidden';
    titleEl.textContent = (top && top.title) || '';
  }

  // Push a new screen onto the nav stack (the normal case — user is drilling
  // further into a flow: category -> capture -> confirm, etc).
  function push(renderFn, args = [], opts = {}) {
    ensureHeader();
    stack.push({
      render: renderFn,
      args,
      title: opts.title || '',
      showBack: opts.showBack !== false,
      showHome: opts.showHome !== false,
      wide: !!opts.wide,
    });
    history.pushState({ navDepth: stack.length }, '');
    renderFn(...args);
    updateHeader();
  }

  // Replace the entire stack with a single new root screen. Use this when the
  // previous screens genuinely shouldn't be reachable via Back anymore — e.g.
  // after login (don't let Back return to the login form), or after a
  // flow finishes submitting (don't let Back resubmit a confirm card).
  function reset(renderFn, args = [], opts = {}) {
    ensureHeader();
    stack.length = 0;
    stack.push({
      render: renderFn,
      args,
      title: opts.title || '',
      showBack: false,
      showHome: opts.showHome !== false,
    });
    history.pushState({ navDepth: 1 }, '');
    renderFn(...args);
    updateHeader();
  }

  function goHome() {
    if (!window.renderHomeScreen) return;
    const role = window.api ? window.api.getRole() : null;
    reset(window.renderHomeScreen, [getContentRoot(), role], {
      title: 'Main Menu',
      showHome: false,
    });
  }

  window.addEventListener('popstate', () => {
    if (stack.length > 1) {
      stack.pop();
      const top = stack[stack.length - 1];
      top.render(...top.args);
      updateHeader();
    }
    // If only the root screen (Home) is left, let the browser's own back
    // navigation proceed from here — that's the correct point for a swipe or
    // back-press to actually exit/minimize the app rather than get "stuck."
  });

  window.Nav = { push, reset, goHome };
})();
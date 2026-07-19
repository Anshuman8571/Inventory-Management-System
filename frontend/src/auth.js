// Login screen logic. Kept deliberately simple — no client-side routing library,
// since this app has only a handful of screens (see rules.md: avoid unneeded complexity).

(function () {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');

  function showError(message) {
    errorEl.textContent = message;
    errorEl.classList.add('visible');
  }

  function clearError() {
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }

  // If a valid session already exists, skip the login form entirely.
  async function checkExistingSession() {
    if (!window.api.getToken()) return;
    try {
      const { user } = await window.api.apiRequest('/auth/me');
      window.api.setRole(user.role);
      redirectForRole(user.role);
    } catch (e) {
      // Token invalid/expired — clear it and let the user log in again.
      window.api.clearToken();
    }
  }

  // This is a single-page app (see architecture.md) — screens swap in place rather
  // than navigating to separate HTML files. Role is passed through so the home menu
  // can show/hide owner-only items (e.g. Reports) without a separate owner screen.
  function redirectForRole(role) {
    const card = document.querySelector('.card');
    if (window.renderHomeScreen) {
      window.Nav.reset(window.renderHomeScreen, [card, role], {
        title: 'Main Menu',
        showHome: false,
      });
    } else {
      window.Nav.reset(window.startScanFlow, [card, { flowType: 'take_out' }], {
        title: 'Take-Out',
        showHome: false,
      });
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
      const { token, user } = await window.api.apiRequest('/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      window.api.setToken(token);
      window.api.setRole(user.role);
      redirectForRole(user.role);
    } catch (err) {
      showError(err.message || 'Login failed. Please try again.');
    }
  });

  checkExistingSession();
})();
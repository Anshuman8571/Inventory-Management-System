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
      redirectForRole(user.role);
    } catch (e) {
      // Token invalid/expired — clear it and let the user log in again.
      window.api.clearToken();
    }
  }

  // This is a single-page app (see architecture.md) — screens swap in place rather
  // than navigating to separate HTML files. Owner view (Phase 6) will branch here too;
  // for now both roles land on the same Take-Out scan flow.
  function redirectForRole(role) {
    const card = document.querySelector('.card');
    if (window.renderHomeScreen) {
      window.renderHomeScreen(card);
    } else {
      window.startScanFlow(card, { flowType: 'take_out' });
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
      redirectForRole(user.role);
    } catch (err) {
      showError(err.message || 'Login failed. Please try again.');
    }
  });

  checkExistingSession();
})();

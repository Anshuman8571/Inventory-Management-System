// Single shared fetch wrapper — every screen's API calls go through this file.
// Centralizes: base URL, attaching the auth token, and consistent error parsing.

const API_BASE = window.API_BASE_URL || ''; // same-origin by default; override if needed

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('role');
}

// Stored alongside the token purely for UI decisions (e.g. showing/hiding the Reports
// button) — actual access control is always enforced server-side via requireRole, this
// is just so the UI doesn't show buttons a user's role can't use.
function getRole() {
  return localStorage.getItem('role');
}

function setRole(role) {
  localStorage.setItem('role', role);
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    // fetch() throws (rather than resolving with a bad status) when there's no
    // connection at all — give a message that actually explains what happened,
    // instead of the raw "Failed to fetch" browsers produce.
    const offlineErr = new Error(
      navigator.onLine === false
        ? "You're offline. Reconnect to continue — some screens may still show your last saved data."
        : 'Could not reach the server. Please check your connection and try again.'
    );
    offlineErr.code = 'NETWORK_ERROR';
    throw offlineErr;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Backend always returns { error: { message, code } } on failure (see errorHandler.js)
    const message = data?.error?.message || 'Something went wrong. Please try again.';
    const error = new Error(message);
    error.code = data?.error?.code;
    error.status = response.status;
    throw error;
  }

  return data;
}

window.api = { apiRequest, getToken, setToken, clearToken, getRole, setRole };
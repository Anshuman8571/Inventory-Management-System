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
}

async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

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

window.api = { apiRequest, getToken, setToken, clearToken };

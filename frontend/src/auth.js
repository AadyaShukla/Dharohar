/**
 * Authentication storage and session management for Dharohar frontend.
 * Stores token and user profile in localStorage wrapped in try/catch.
 */

const TOKEN_KEY = 'dharohar_token';
const USER_KEY = 'dharohar_user';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (err) {
    console.error('Failed to retrieve auth token from localStorage', err);
    return null;
  }
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('Failed to retrieve user from localStorage', err);
    return null;
  }
}

export function setSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (err) {
    console.error('Failed to store session in localStorage', err);
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (err) {
    console.error('Failed to clear session from localStorage', err);
  }
}

export function notifySessionExpired(message = 'Session expired, please log in again.') {
  clearSession();
  window.dispatchEvent(
    new CustomEvent('dharohar:auth_expired', {
      detail: { message },
    })
  );
}

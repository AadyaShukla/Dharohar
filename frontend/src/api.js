/**
 * API client for Dharohar FastAPI backend (http://localhost:8000).
 * Attaches Authorization Bearer token from localStorage.
 * Handles 401 session expirations and surfaces backend error messages cleanly.
 */

import { getToken, notifySessionExpired, setSession } from './auth';

const BASE_URL = 'http://localhost:8000';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // 401 on protected routes triggers session clear and redirect to login
      if (
        response.status === 401 &&
        !endpoint.startsWith('/auth/')
      ) {
        notifySessionExpired('Session expired, please log in again.');
      }

      const message =
        data.detail || data.message || `Error ${response.status}: Request failed`;
      const err = new Error(typeof message === 'object' ? JSON.stringify(message) : message);
      err.status = response.status;
      err.data = data;
      throw err;
    }
    return data;
  } catch (err) {
    if (err.name === 'TypeError' && err.message.toLowerCase().includes('fetch')) {
      throw new Error(
        `Cannot connect to backend server at ${BASE_URL}. Ensure the FastAPI server is running.`
      );
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Authentication Endpoints
// ---------------------------------------------------------------------------

export async function createSession(idToken) {
  return request('/auth/session', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken }),
  });
}

export async function registerUser({
  idToken,
  name,
  role,
  language = 'hi',
  termsVersion = '1.0',
  privacyVersion = '1.0',
  organization_name,
  org_type,
  gst_number,
  work_email,
}) {
  return request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      id_token: idToken,
      name,
      role,
      language,
      terms_version: termsVersion,
      privacy_version: privacyVersion,
      organization_name,
      org_type,
      gst_number,
      work_email,
    }),
  });
}

export async function logoutUser() {
  try {
    return await request('/auth/logout', {
      method: 'POST',
    });
  } catch (err) {
    console.warn('Backend logout notification failed:', err);
    return { status: 'ok' };
  }
}

export async function requestOtp(phone) {
  return request('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(phone, otp) {
  return request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  });
}

export async function getMe() {
  return request('/auth/me');
}

// ---------------------------------------------------------------------------
// Bookings & Negotiations
// ---------------------------------------------------------------------------

export async function createBooking(payload) {
  return request('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function negotiate(bookingId) {
  return request(`/bookings/${bookingId}/negotiate`, {
    method: 'POST',
  });
}

export async function getBooking(bookingId) {
  return request(`/bookings/${bookingId}`);
}

export async function getBookings() {
  return request('/bookings');
}

export async function organizerApproveChange(bookingId, payload = {}) {
  return request(`/bookings/${bookingId}/organizer-approve-change`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function artistApprove(bookingId, artistId) {
  return request(`/bookings/${bookingId}/artist/${artistId}/approve`, {
    method: 'POST',
  });
}

export async function artistDecline(bookingId, artistId) {
  return request(`/bookings/${bookingId}/artist/${artistId}/decline`, {
    method: 'POST',
  });
}

// ---------------------------------------------------------------------------
// Escrow & Payments
// ---------------------------------------------------------------------------

export async function getPublicConfig() {
  return request('/config');
}

export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      resolve(true);
      return;
    }
    const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existingScript) {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function createPaymentOrder(bookingId) {
  return request(`/bookings/${bookingId}/payment/order`, {
    method: 'POST',
  });
}

export async function verifyPaymentSignature(bookingId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  return request(`/bookings/${bookingId}/payment/verify`, {
    method: 'POST',
    body: JSON.stringify({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    }),
  });
}

export async function pay(bookingId) {
  return request(`/bookings/${bookingId}/pay`, {
    method: 'POST',
  });
}

export async function payout(bookingId, payload = {}) {
  const query = payload.early_approval ? '?early_approval=true' : '';
  return request(`/bookings/${bookingId}/payout${query}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function advanceTime(bookingId) {
  const query = bookingId ? `?booking_id=${bookingId}` : '';
  return request(`/demo/advance-time${query}`, {
    method: 'POST',
  });
}

export async function failNextPayout() {
  return request('/demo/fail-next-payout', {
    method: 'POST',
  });
}

export async function artistAcknowledge(bookingId, confirmed) {
  return request(`/bookings/${bookingId}/artist-acknowledge`, {
    method: 'POST',
    body: JSON.stringify({ confirmed }),
  });
}

export async function nonReceiptClaim(bookingId) {
  return request(`/bookings/${bookingId}/non-receipt-claim`, {
    method: 'POST',
  });
}

export async function getTrustPay(bookingId) {
  return request(`/bookings/${bookingId}/trustpay`);
}

export async function getAudit(bookingId) {
  return request(`/bookings/${bookingId}/audit`);
}

// ---------------------------------------------------------------------------
// Seed & Demo Admin
// ---------------------------------------------------------------------------

export async function getArtists() {
  return request('/artists');
}

export async function seed() {
  return request('/seed', {
    method: 'POST',
  });
}

export async function runDemoScenario() {
  return request('/demo/run-scenario', {
    method: 'POST',
  });
}

export async function setLlmProvider(provider) {
  return request('/demo/set-provider', {
    method: 'POST',
    body: JSON.stringify({ provider }),
  });
}

export async function getLlmProvider() {
  return request('/demo/provider');
}

// ---------------------------------------------------------------------------
// Real User Artist Management, Media Uploads & Reviews
// ---------------------------------------------------------------------------

export async function getMyArtistProfile() {
  return request('/artists/me/profile');
}

export async function createArtistProfile(payload) {
  return request('/artists/profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateMyArtistProfile(payload) {
  return request('/artists/me/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateMyArtistRules(payload) {
  return request('/artists/me/rules', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateMyAvailability(payload) {
  return request('/artists/me/availability', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function updateMyPayout(payload) {
  return request('/artists/me/payout', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function getLivePrompt() {
  return request('/artists/live-prompt');
}

export async function uploadAuditionVideo(formData) {
  const url = `${BASE_URL}/artists/upload-audition`;
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to upload audition video');
  }
  return data;
}

export async function uploadPortfolioPhoto(formData) {
  const url = `${BASE_URL}/artists/upload-photo`;
  const token = getToken();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || 'Failed to upload photo');
  }
  return data;
}

export async function submitArtistForReview() {
  return request('/artists/me/submit-for-review', {
    method: 'POST',
  });
}

export async function getControlledArtForms() {
  return request('/artists/forms');
}

export async function getCoordinatorArtists() {
  return request('/coordinator/artists');
}

export async function submitCoordinatorVouch(artistId, notes) {
  return request(`/artists/${artistId}/vouch`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function getArtistVouches(artistId) {
  return request(`/artists/${artistId}/vouches`);
}

export async function getOperatorReviewQueue() {
  return request('/operator/review-queue');
}

export async function reviewArtistSubmission(artistId, action, reason = '') {
  return request(`/operator/artists/${artistId}/review`, {
    method: 'POST',
    body: JSON.stringify({ action, reason }),
  });
}

// ---------------------------------------------------------------------------
// Organizer Discovery, Profiles & Standby Lifecycle Management
// ---------------------------------------------------------------------------

export async function searchArtists(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      params.append(key, String(val));
    }
  });
  const queryString = params.toString();
  return request(`/artists/search${queryString ? `?${queryString}` : ''}`);
}

export async function getArtistPublicProfile(artistId) {
  return request(`/artists/${artistId}`);
}

export async function getOrganizerProfile() {
  return request('/organizer/profile');
}

export async function updateOrganizerProfile(payload) {
  return request('/organizer/profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyOrganizerProfile(identifier) {
  return request(`/operator/organizers/${identifier}/verify`, {
    method: 'POST',
  });
}

export async function getOperatorOrganizers(verificationStatus = '') {
  const query = verificationStatus ? `?verification_status=${verificationStatus}` : '';
  return request(`/operator/organizers${query}`);
}

export async function checkBookingExpiry(bookingId, force = false) {
  const query = force ? '?force=true' : '';
  return request(`/bookings/${bookingId}/check-expiry${query}`, {
    method: 'POST',
  });
}

export async function reconfirmStandby(bookingId, force = false) {
  const query = force ? '?force=true' : '';
  return request(`/bookings/${bookingId}/reconfirm-standby${query}`, {
    method: 'POST',
  });
}

// ---------------------------------------------------------------------------
// Voice Notes & Rule Proposals
// ---------------------------------------------------------------------------

export async function uploadVoiceNote(file) {
  const formData = new FormData();
  formData.append('file', file);
  const token = getToken();
  const response = await fetch(`${BASE_URL}/artists/me/voice-note`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || 'Voice note upload failed');
  }
  return data;
}

export async function confirmVoiceProposal(proposalId, confirm = true) {
  return request('/artists/me/rules/confirm-voice-proposal', {
    method: 'POST',
    body: JSON.stringify({ proposal_id: proposalId, confirm }),
  });
}

// ---------------------------------------------------------------------------
// Notifications & Preferences
// ---------------------------------------------------------------------------

export async function getMyNotifications() {
  return request('/notifications/me');
}

export async function updateNotificationPreference(preference, email = null) {
  return request('/users/me/notification-preference', {
    method: 'PATCH',
    body: JSON.stringify({ preference, email }),
  });
}

export async function getOperatorFailedNotifications() {
  return request('/operator/notifications/failed');
}

export async function retryFailedNotification(notificationId) {
  return request(`/operator/notifications/${notificationId}/retry`, {
    method: 'POST',
  });
}

export async function verifyActionLink(token) {
  return request(`/api/actions/verify?token=${encodeURIComponent(token)}`, {
    method: 'POST',
  });
}

export async function quickLoginAs(phone) {
  let resOtp;
  try {
    resOtp = await requestOtp(phone);
  } catch (err) {
    if (err.status === 404 || String(err.message).includes('404')) {
      await seed();
      resOtp = await requestOtp(phone);
    } else {
      throw err;
    }
  }
  const code = resOtp.demo_otp || '123456';
  const verifyRes = await verifyOtp(phone, code);
  setSession(verifyRes.access_token, verifyRes.user);
  return verifyRes.user;
}




import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Shared & Role Guards
import RoleGuard from './components/shared/RoleGuard';

// Views
import LandingView from './views/LandingView';
import LoginView from './views/LoginView';
import UnauthorizedView from './views/UnauthorizedView';

// Organizer Portal
import OrganizerShell from './portals/organizer/OrganizerShell';
import OrganizerDashboard from './portals/organizer/OrganizerDashboard';
import OrganizerSearch from './portals/organizer/OrganizerSearch';
import OrganizerArtistProfile from './portals/organizer/OrganizerArtistProfile';
import OrganizerNegotiation from './portals/organizer/OrganizerNegotiation';
import OrganizerBookings from './portals/organizer/OrganizerBookings';
import OrganizerPayment from './portals/organizer/OrganizerPayment';
import OrganizerDisputes from './portals/organizer/OrganizerDisputes';
import OrganizerAudit from './portals/organizer/OrganizerAudit';

// Artist Portal
import ArtistShell from './portals/artist/ArtistShell';
import ArtistHome from './portals/artist/ArtistHome';
import ArtistOffers from './portals/artist/ArtistOffers';
import ArtistRules from './portals/artist/ArtistRules';
import ArtistCalendar from './portals/artist/ArtistCalendar';
import ArtistEarnings from './portals/artist/ArtistEarnings';
import ArtistProfile from './portals/artist/ArtistProfile';
import ArtistStatement from './portals/artist/ArtistStatement';

// Operator Portal
import OperatorShell from './portals/operator/OperatorShell';
import OperatorReviewQueue from './components/OperatorReviewQueue';
import CoordinatorVouchPanel from './components/CoordinatorVouchPanel';
import OperatorNotifications from './portals/operator/OperatorNotifications';
import DemoControlCenter from './components/DemoControlCenter';

export default function App() {
  // Listen for 401 Session Expiration custom event from api.js
  useEffect(() => {
    function handleSessionExpired() {
      window.location.href = '/login?expired=true';
    }
    window.addEventListener('dharohar:auth_expired', handleSessionExpired);
    return () => window.removeEventListener('dharohar:auth_expired', handleSessionExpired);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Shared Routes */}
        <Route path="/" element={<LandingView />} />
        <Route path="/login" element={<LoginView />} />
        <Route path="/register" element={<LoginView />} />
        <Route path="/unauthorized" element={<UnauthorizedView />} />

        {/* 1) /organizer/* Portal (Desktop-First, Organizer Only) */}
        <Route
          path="/organizer"
          element={
            <RoleGuard allowedRoles={['ORGANIZER']}>
              <OrganizerShell />
            </RoleGuard>
          }
        >
          <Route index element={<OrganizerDashboard />} />
          <Route path="search" element={<OrganizerSearch />} />
          <Route path="artists/:id" element={<OrganizerArtistProfile />} />
          <Route path="negotiate" element={<OrganizerNegotiation />} />
          <Route path="bookings" element={<OrganizerBookings />} />
          <Route path="payment" element={<OrganizerPayment />} />
          <Route path="disputes" element={<OrganizerDisputes />} />
          <Route path="audit" element={<OrganizerAudit />} />
        </Route>

        {/* 2) /artist/* Portal (Mobile-First, Artist Only) */}
        <Route
          path="/artist"
          element={
            <RoleGuard allowedRoles={['ARTIST']}>
              <ArtistShell />
            </RoleGuard>
          }
        >
          <Route index element={<ArtistHome />} />
          <Route path="offers" element={<ArtistOffers />} />
          <Route path="rules" element={<ArtistRules />} />
          <Route path="calendar" element={<ArtistCalendar />} />
          <Route path="earnings" element={<ArtistEarnings />} />
          <Route path="profile" element={<ArtistProfile />} />
          <Route path="statement" element={<ArtistStatement />} />
        </Route>

        {/* 3) /operator/* Portal (Operator & Coordinator Only) */}
        <Route
          path="/operator"
          element={
            <RoleGuard allowedRoles={['OPERATOR', 'COORDINATOR']}>
              <OperatorShell />
            </RoleGuard>
          }
        >
          <Route index element={<OperatorReviewQueue />} />
          <Route path="vouch" element={<CoordinatorVouchPanel />} />
          <Route path="notifications" element={<OperatorNotifications />} />
          <Route path="demo" element={<DemoControlCenter />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

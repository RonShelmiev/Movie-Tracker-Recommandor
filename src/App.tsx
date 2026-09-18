import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Browse } from './screens/Browse';
import { Dashboard } from './screens/Dashboard';
import { FilmDetail } from './screens/FilmDetail';
import { FirstRun } from './screens/FirstRun';
import { ForYou } from './screens/ForYou';
import { SearchResults } from './screens/SearchResults';
import { Seen } from './screens/Seen';
import { Settings } from './screens/Settings';
import { ToSee } from './screens/ToSee';
import { useStore } from './lib/store';

export function App() {
  const { state } = useStore();
  const location = useLocation();

  // A brand new library goes to onboarding, but only until it has been dismissed once.
  const needsOnboarding = !state.onboarded && state.log.length === 0;
  if (needsOnboarding && location.pathname !== '/welcome') {
    return <Navigate to="/welcome" replace />;
  }

  return (
    <Routes>
      {/* Onboarded already? /welcome is a dead end — send them home. */}
      <Route path="/welcome" element={needsOnboarding ? <FirstRun /> : <Navigate to="/" replace />} />
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="browse" element={<Browse />} />
        <Route path="film/:id" element={<FilmDetail />} />
        <Route path="to-see" element={<ToSee />} />
        <Route path="seen" element={<Seen />} />
        <Route path="for-you" element={<ForYou />} />
        <Route path="search" element={<SearchResults />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

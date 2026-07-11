/**
 * App — Root component with routing shell, ThemeProvider, AuthProvider, and NetworkProvider.
 *
 * Validates: Requirements 3.1, 3.2, 21.3, 21.6
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './theme';
import { AuthProvider } from './context/AuthContext';
import { NetworkProvider } from './context/NetworkContext';
import { Layout } from './components/Layout';
import { OfflineBanner } from './components/OfflineBanner';
import { SyncIndicator } from './components/SyncIndicator';
import { useSyncOnReconnect } from './hooks/useSyncOnReconnect';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';
import { ForgotPassword } from './pages/ForgotPassword';
import { ParentRegistration } from './pages/ParentRegistration';
import { LearnerRegistration } from './pages/LearnerRegistration';
import { ChapterCreation } from './pages/ChapterCreation';
import { ChapterExplanation } from './pages/ChapterExplanation';
import { LearnerDashboard } from './pages/LearnerDashboard';
import { ParentDashboard } from './pages/ParentDashboard';
import { PageCapture } from './pages/PageCapture';
import { TranscriptEditor } from './pages/TranscriptEditor';
import { RevisionQuiz } from './pages/RevisionQuiz';
import { GrammarExercise } from './pages/GrammarExercise';
import { ChapterQA } from './pages/ChapterQA';
import { PronunciationPractice } from './pages/PronunciationPractice';
import { ParentSettings } from './pages/ParentSettings';
import { ManageLearners } from './pages/ManageLearners';

/** API server base URL — injected via environment config. */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function NotFoundPage() {
  return (
    <div className="card">
      <h2>Page Not Found</h2>
      <p>The page you are looking for does not exist.</p>
    </div>
  );
}

/**
 * Inner component that uses the sync hook.
 * Must be inside NetworkProvider for context access.
 */
function AppContent() {
  const syncState = useSyncOnReconnect(API_BASE_URL);

  return (
    <BrowserRouter>
      <OfflineBanner />
      <SyncIndicator syncState={syncState} />
      <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<ParentRegistration />} />
        <Route path="/register/learner" element={<LearnerRegistration />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/parent/dashboard" element={<ParentDashboard />} />
        <Route path="/parent/settings" element={<ParentSettings />} />
        <Route path="/parent/manage-learners" element={<ManageLearners />} />
        <Route path="/learner/dashboard" element={<LearnerDashboard />} />
        <Route path="/learner/chapter/create" element={<ChapterCreation />} />
        <Route path="/learner/chapter/:id/pages" element={<PageCapture />} />
        <Route path="/learner/chapter/:id/transcript" element={<TranscriptEditor />} />
        <Route path="/learner/chapter/:id/explanation" element={<ChapterExplanation />} />
        <Route path="/learner/chapter/:id/revision" element={<RevisionQuiz />} />
        <Route path="/learner/chapter/:id/exercise" element={<GrammarExercise />} />
        <Route path="/learner/chapter/:id/qa" element={<ChapterQA />} />
        <Route path="/learner/chapter/:id/pronunciation" element={<PronunciationPractice />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NetworkProvider>
          <AppContent />
        </NetworkProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

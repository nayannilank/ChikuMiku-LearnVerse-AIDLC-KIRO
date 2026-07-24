/**
 * App — Root component with routing shell, ThemeProvider, AuthProvider, and NetworkProvider.
 *
 * Validates: Requirements 3.1, 3.2, 21.3, 21.6
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './theme';
import { AuthProvider } from './context/AuthContext';
import { NetworkProvider } from './context/NetworkContext';
import { OfflineBanner } from './components/OfflineBanner';
import { SyncIndicator } from './components/SyncIndicator';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppHeader } from './components/AppHeader';
import { useSyncOnReconnect } from './hooks/useSyncOnReconnect';

// Pages
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { ParentRegistration } from './pages/auth/ParentRegistration';
import { LearnerRegistration } from './pages/auth/LearnerRegistration';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { ParentDashboard } from './pages/dashboard/ParentDashboard';
import { LearnerDashboard } from './pages/dashboard/LearnerDashboard';
import { SelectSubjectBook } from './pages/content/SelectSubjectBook';
import { PageCapture } from './pages/content/PageCapture';
import { TextRecognition } from './pages/content/TextRecognition';
import { ChapterExplanation } from './pages/content/ChapterExplanation';
import { PronunciationPractice } from './pages/learning/PronunciationPractice';
import { GrammarExercise } from './pages/learning/GrammarExercise';
import { ComprehensionQA } from './pages/learning/ComprehensionQA';
import { RevisionQuiz } from './pages/learning/RevisionQuiz';
import { ParentProfile } from './pages/settings/ParentProfile';
import { ManageLearners } from './pages/settings/ManageLearners';

/** API server base URL — injected via environment config. */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function NotFoundPage() {
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
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
      <Routes>
        {/* Landing has its own navbar — no AppHeader */}
        <Route path="/" element={<LandingPage />} />

        {/* All other routes get the shared AppHeader */}
        <Route path="/login" element={<><AppHeader /><LoginPage /></>} />
        <Route path="/register/parent" element={<><AppHeader /><ParentRegistration /></>} />
        <Route path="/forgot-password" element={<><AppHeader /><ForgotPassword /></>} />

        {/* Parent Routes */}
        <Route path="/parent/dashboard" element={<ProtectedRoute allowedRoles={['parent']}><AppHeader /><ParentDashboard /></ProtectedRoute>} />
        <Route path="/parent/profile" element={<ProtectedRoute allowedRoles={['parent']}><AppHeader /><ParentProfile /></ProtectedRoute>} />
        <Route path="/parent/settings" element={<ProtectedRoute allowedRoles={['parent']}><AppHeader /><ParentProfile /></ProtectedRoute>} />
        <Route path="/parent/manage-learners" element={<ProtectedRoute allowedRoles={['parent']}><AppHeader /><ManageLearners /></ProtectedRoute>} />
        <Route path="/register/learner" element={<ProtectedRoute allowedRoles={['parent']}><AppHeader /><LearnerRegistration /></ProtectedRoute>} />

        {/* Learner Routes */}
        <Route path="/learner/dashboard" element={<ProtectedRoute allowedRoles={['learner']}><AppHeader /><LearnerDashboard /></ProtectedRoute>} />

        {/* Content Ingestion */}
        <Route path="/content/add-chapter" element={<ProtectedRoute><AppHeader /><SelectSubjectBook /></ProtectedRoute>} />
        <Route path="/content/capture" element={<ProtectedRoute><AppHeader /><PageCapture /></ProtectedRoute>} />
        <Route path="/content/ocr" element={<ProtectedRoute><AppHeader /><TextRecognition /></ProtectedRoute>} />
        <Route path="/content/explain" element={<ProtectedRoute><AppHeader /><ChapterExplanation /></ProtectedRoute>} />

        {/* Learning Modes */}
        <Route path="/learn/pronunciation" element={<ProtectedRoute><AppHeader /><PronunciationPractice /></ProtectedRoute>} />
        <Route path="/learn/grammar" element={<ProtectedRoute><AppHeader /><GrammarExercise /></ProtectedRoute>} />
        <Route path="/learn/comprehension" element={<ProtectedRoute><AppHeader /><ComprehensionQA /></ProtectedRoute>} />
        <Route path="/learn/revision" element={<ProtectedRoute><AppHeader /><RevisionQuiz /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="/404" element={<><AppHeader /><NotFoundPage /></>} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
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

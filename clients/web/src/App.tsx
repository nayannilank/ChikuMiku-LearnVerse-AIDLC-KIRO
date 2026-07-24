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
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register/parent" element={<ParentRegistration />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Parent Routes */}
        <Route path="/parent/dashboard" element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
        <Route path="/parent/profile" element={<ProtectedRoute allowedRoles={['parent']}><ParentProfile /></ProtectedRoute>} />
        <Route path="/parent/settings" element={<ProtectedRoute allowedRoles={['parent']}><ParentProfile /></ProtectedRoute>} />
        <Route path="/parent/manage-learners" element={<ProtectedRoute allowedRoles={['parent']}><ManageLearners /></ProtectedRoute>} />
        <Route path="/register/learner" element={<ProtectedRoute allowedRoles={['parent']}><LearnerRegistration /></ProtectedRoute>} />

        {/* Learner Routes */}
        <Route path="/learner/dashboard" element={<ProtectedRoute allowedRoles={['learner']}><LearnerDashboard /></ProtectedRoute>} />

        {/* Content Ingestion */}
        <Route path="/content/add-chapter" element={<ProtectedRoute><SelectSubjectBook /></ProtectedRoute>} />
        <Route path="/content/capture" element={<ProtectedRoute><PageCapture /></ProtectedRoute>} />
        <Route path="/content/ocr" element={<ProtectedRoute><TextRecognition /></ProtectedRoute>} />
        <Route path="/content/explain" element={<ProtectedRoute><ChapterExplanation /></ProtectedRoute>} />

        {/* Learning Modes */}
        <Route path="/learn/pronunciation" element={<ProtectedRoute><PronunciationPractice /></ProtectedRoute>} />
        <Route path="/learn/grammar" element={<ProtectedRoute><GrammarExercise /></ProtectedRoute>} />
        <Route path="/learn/comprehension" element={<ProtectedRoute><ComprehensionQA /></ProtectedRoute>} />
        <Route path="/learn/revision" element={<ProtectedRoute><RevisionQuiz /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="/404" element={<NotFoundPage />} />
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

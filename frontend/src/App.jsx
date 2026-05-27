import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import RegisterSchool from './pages/RegisterSchool';
import Login from './pages/Login';
import Dashboard, { DashboardHome } from './pages/Dashboard';
import Users from './pages/Users';
import SubjectsPage from './pages/SubjectsPage';
import AssessmentsPage from './pages/AssessmentsPage';
import StudentsPage from './pages/StudentsPage';
import MarkEntryPage from './pages/MarkEntryPage';
import ResultsPage from './pages/ResultsPage';
import ReportCardsPage from './pages/ReportCardsPage';
import ClassesPage from './pages/ClassesPage';
import SchoolSettingsPage from './pages/SchoolSettingsPage';
import StudentSubjectsPage from './pages/StudentSubjectsPage';
import AssignmentsPage from './pages/AssignmentsPage';
import GradeConfigPage from './pages/GradeConfigPage';
import StaffResultsPage from './pages/StaffResultsPage';
import ProfilePage from './pages/ProfilePage';
import ContactPage from './pages/ContactPage';
import FeedbackPage from './pages/FeedbackPage';
import PendingVerification from './pages/PendingVerification';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register-school" element={<RegisterSchool />} />
          <Route path="/pending-verification" element={<PendingVerification />} />

          {/* Protected layout */}
          <Route
            path="/:schoolSlug"
            element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
          >
            <Route path="dashboard"    element={<DashboardHome />} />
            <Route path="classes"      element={<ProtectedRoute allowedRoles={['ADMIN']}><ClassesPage /></ProtectedRoute>} />
            <Route path="subjects"     element={<ProtectedRoute allowedRoles={['ADMIN']}><SubjectsPage /></ProtectedRoute>} />
            <Route path="assessments"  element={<ProtectedRoute allowedRoles={['ADMIN']}><AssessmentsPage /></ProtectedRoute>} />
            <Route path="students"     element={<ProtectedRoute allowedRoles={['ADMIN']}><StudentsPage /></ProtectedRoute>} />
            <Route path="users"        element={<ProtectedRoute allowedRoles={['ADMIN']}><Users /></ProtectedRoute>} />
            <Route path="marks"        element={<MarkEntryPage />} />
            <Route path="staff-results" element={<StaffResultsPage />} />
            <Route path="results"      element={<ProtectedRoute allowedRoles={['ADMIN']}><ResultsPage /></ProtectedRoute>} />
            <Route path="report-cards" element={<ProtectedRoute allowedRoles={['ADMIN']}><ReportCardsPage /></ProtectedRoute>} />
            <Route path="settings"     element={<ProtectedRoute allowedRoles={['ADMIN']}><SchoolSettingsPage /></ProtectedRoute>} />
            <Route path="assignments"  element={<ProtectedRoute allowedRoles={['ADMIN']}><AssignmentsPage /></ProtectedRoute>} />
            <Route path="student-subjects" element={<ProtectedRoute allowedRoles={['ADMIN']}><StudentSubjectsPage /></ProtectedRoute>} />
            <Route path="grade-config"     element={<ProtectedRoute allowedRoles={['ADMIN']}><GradeConfigPage /></ProtectedRoute>} />
            <Route path="profile"           element={<ProfilePage />} />
            <Route path="contact"           element={<ContactPage />} />
            <Route path="feedback"          element={<FeedbackPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;


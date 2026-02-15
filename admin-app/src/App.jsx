import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { VideoQueueProvider } from "./context/VideoQueueContext";
import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./components/DashboardLayout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PlaylistsPage from "./pages/PlaylistsPage";
import PlaylistDetailsPage from "./pages/PlaylistDetailsPage";
import QueuePage from "./pages/QueuePage";
import VideosPage from "./pages/VideosPage";
import UsersPage from "./pages/UsersPage";
import SettingsPage from "./pages/SettingsPage";


function App() {
  return (
    <AuthProvider>
      <VideoQueueProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/playlists" element={<PlaylistsPage />} />
                <Route path="/playlists/:id" element={<PlaylistDetailsPage />} />
                <Route path="/videos" element={<VideosPage />} />
                <Route path="/queue" element={<QueuePage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </VideoQueueProvider>
    </AuthProvider>
  );
}

export default App;

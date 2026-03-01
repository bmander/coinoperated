import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import './App.css'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import TaskBoard from './pages/TaskBoard'
import TaskDetail from './pages/TaskDetail'
import SubmitTask from './pages/SubmitTask'
import SignIn from './pages/SignIn'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import PatronProfile from './pages/PatronProfile'
import RequireAdmin from './components/RequireAdmin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<TaskBoard />} />
            <Route path="/tasks/:taskId" element={<TaskDetail />} />
            <Route path="/patrons/:patronId" element={<PatronProfile />} />
            <Route element={<RequireAuth />}>
              <Route path="/tasks/new" element={<SubmitTask />} />
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>
            <Route path="/signin" element={<SignIn />} />
            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

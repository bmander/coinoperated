import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import './App.css'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import TaskBoard from './pages/TaskBoard'
import TaskDetail from './pages/TaskDetail'
import SignIn from './pages/SignIn'
import Admin from './pages/Admin'
import RequireAdmin from './components/RequireAdmin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<TaskBoard />} />
            <Route path="/tasks/:taskId" element={<TaskDetail />} />
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

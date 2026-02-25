import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import './App.css'
import Layout from './components/Layout'
import TaskBoard from './pages/TaskBoard'
import TaskDetail from './pages/TaskDetail'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<TaskBoard />} />
          <Route path="/tasks/:taskId" element={<TaskDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

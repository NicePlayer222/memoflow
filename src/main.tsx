import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startQueue } from './ai/runtime'
import './index.css'

startQueue()
createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
)

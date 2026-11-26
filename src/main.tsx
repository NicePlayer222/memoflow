import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startQueue } from './ai/runtime'
import './index.css'
import './responsive.css'

class WorkspaceBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' }
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
  render() {
    if (this.state.error) return <main className="empty-state" role="alert">
      <h1>工作台未能加载</h1><p>{this.state.error}</p>
      <button className="outline" onClick={() => location.reload()}>重新加载</button>
    </main>
    return this.props.children
  }
}

startQueue()
createRoot(document.getElementById('root')!).render(
  <StrictMode><WorkspaceBoundary><App /></WorkspaceBoundary></StrictMode>,
)

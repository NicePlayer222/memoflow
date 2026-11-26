import { useState } from 'react'
import { configureQueue } from '../ai/runtime'
import { defaultsFor, loadSettings, PRESETS, type PresetId } from '../ai/settings'
import { Dialog } from './Dialog'

export function SettingsDialog({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  const [settings, setSettings] = useState(loadSettings)
  const [error, setError] = useState('')

  function changePreset(preset: PresetId) {
    setSettings({ ...defaultsFor(preset), concurrency: settings.concurrency })
    setError('')
  }

  function changeEndpoint(baseUrl: string) {
    const sameOrigin = URL.canParse(settings.baseUrl) && URL.canParse(baseUrl)
      && new URL(settings.baseUrl).origin === new URL(baseUrl).origin
    setSettings({ ...settings, baseUrl, apiKey: sameOrigin ? settings.apiKey : '' })
  }

  return (
    <Dialog title="设置" onClose={onClose}>
      <form onSubmit={event => {
        event.preventDefault()
        try {
          configureQueue(settings)
          notify('设置已保存。')
          onClose()
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }}>
        <label className="mf-field">AI 提供方
          <select value={settings.preset} onChange={event => changePreset(event.target.value as PresetId)}>
            {Object.entries(PRESETS).map(([id, preset]) => <option value={id} key={id}>{preset.label}</option>)}
          </select>
        </label>
        {settings.preset !== 'mock' && <>
          <label className="mf-field">API 基础地址
            <input type="url" required spellCheck={false} value={settings.baseUrl}
              onChange={event => changeEndpoint(event.target.value)} />
          </label>
          <label className="mf-field">模型名称
            <input required spellCheck={false} value={settings.model}
              onChange={event => setSettings({ ...settings, model: event.target.value })} />
          </label>
          <label className="mf-field">API Key
            <input type="password" autoComplete="off" spellCheck={false} value={settings.apiKey}
              onChange={event => setSettings({ ...settings, apiKey: event.target.value })} />
          </label>
          <p className="mf-hint">密钥保存在当前浏览器。整理时，条目内容会发送到上方的 API 地址。</p>
        </>}
        <label className="mf-field">并发数
          <select value={settings.concurrency} onChange={event => setSettings({ ...settings, concurrency: Number(event.target.value) })}>
            {[1, 2, 3, 4, 5].map(value => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
        {error && <p role="alert" className="mf-form-error">{error}</p>}
        <div className="mf-dialog-actions">
          <button type="button" className="mf-action" onClick={onClose}>取消</button>
          <button type="submit" className="mf-action mf-confirm">保存设置</button>
        </div>
      </form>
    </Dialog>
  )
}

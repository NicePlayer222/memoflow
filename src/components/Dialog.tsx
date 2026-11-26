import { useId, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import './dialogs.css'

export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useLayoutEffect(() => {
    const dialog = ref.current!
    const trigger = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true })
    }
  }, [])

  function wrapTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return
    const controls = event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, [tabindex]',
    )
    const tabbable = [...controls].filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length)
    const first = tabbable.at(0)
    const last = tabbable.at(-1)
    const destination = event.shiftKey
      ? document.activeElement === first && last
      : document.activeElement === last && first
    if (destination) {
      event.preventDefault()
      destination.focus()
    }
  }

  return (
    <dialog ref={ref} className="mf-dialog" aria-labelledby={titleId}
      onKeyDown={wrapTab}
      onCancel={event => { event.preventDefault(); onClose() }}>
      <header className="mf-dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="mf-dialog-close" onClick={onClose} aria-label="关闭弹窗">
          <X size={18} />
        </button>
      </header>
      <div className="mf-dialog-body">{children}</div>
    </dialog>
  )
}

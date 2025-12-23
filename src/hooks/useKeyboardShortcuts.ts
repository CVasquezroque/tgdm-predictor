import { useEffect } from 'react'

interface Options {
  onTogglePlay: () => void
  onJumpBackward?: () => void
  onJumpForward?: () => void
  onJumpBackwardPrecise?: () => void
  onJumpForwardPrecise?: () => void
}

export function useKeyboardShortcuts({
  onTogglePlay,
  onJumpBackward,
  onJumpForward,
  onJumpBackwardPrecise,
  onJumpForwardPrecise,
}: Options) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input field
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return

      if (e.key === ' ') {
        e.preventDefault()
        onTogglePlay()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (e.altKey) {
          onJumpBackwardPrecise?.()
        } else {
          onJumpBackward?.()
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (e.altKey) {
          onJumpForwardPrecise?.()
        } else {
          onJumpForward?.()
        }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    onJumpBackward,
    onJumpBackwardPrecise,
    onJumpForward,
    onJumpForwardPrecise,
    onTogglePlay,
  ])
}


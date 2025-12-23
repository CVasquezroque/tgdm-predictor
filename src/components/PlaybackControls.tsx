import { formatTime } from '../utils/time'

const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

interface Props {
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
  isMuted: boolean
  onTogglePlay: () => void
  onToggleMute: () => void
  onChangeSpeed: (rate: number) => void
  onJumpBackward?: () => void
  onJumpForward?: () => void
}

export function PlaybackControls({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  isMuted,
  onTogglePlay,
  onToggleMute,
  onChangeSpeed,
  onJumpBackward,
  onJumpForward,
}: Props) {
  return (
    <div className="controls">
      <div className="controls-left">
        <button onClick={onTogglePlay} title={isPlaying ? 'Pausar (Espacio)' : 'Reproducir (Espacio)'}>
          {isPlaying ? (
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          )}
          {isPlaying ? 'Pausa' : 'Reproducir'}
        </button>
        <button onClick={() => onJumpBackward?.()} title="Retroceder 2s (←)">
          <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="11,19 2,12 11,5" />
            <polygon points="22,19 13,12 22,5" />
          </svg>
          -2s
        </button>
        <button onClick={() => onJumpForward?.()} title="Avanzar 2s (→)">
          <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="13,19 22,12 13,5" />
            <polygon points="2,19 11,12 2,5" />
          </svg>
          +2s
        </button>
        <div className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
      <div className="controls-right">
        <button onClick={onToggleMute} className="secondary" title={isMuted ? 'Activar audio' : 'Silenciar'}>
          {isMuted ? (
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" />
              <path d="M19.07,4.93a10,10,0,0,1,0,14.14" />
              <path d="M15.54,8.46a5,5,0,0,1,0,7.07" />
            </svg>
          )}
        </button>
        <label className="speed-label">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
          <select value={playbackRate} onChange={(e) => onChangeSpeed(Number(e.target.value))}>
            {SPEED_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}


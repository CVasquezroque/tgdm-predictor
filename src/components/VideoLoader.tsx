import type { ChangeEvent } from 'react'

interface Props {
  onVideoSelected: (file: File) => void
  disabled?: boolean
}

export function VideoLoader({ onVideoSelected, disabled }: Props) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onVideoSelected(file)
    }
  }

  return (
    <label className={`file-picker ${disabled ? 'disabled' : ''}`}>
      <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17,8 12,3 7,8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <span>Cargar video local</span>
      <input
        type="file"
        accept="video/*"
        onChange={handleChange}
        disabled={disabled}
      />
    </label>
  )
}


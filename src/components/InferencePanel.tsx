import type { InferenceJob } from '../types'

interface Props {
  videoId: string | null
  job: InferenceJob | null
  isUploading: boolean
  onStartInference: () => void
  onCancelJob?: () => void
}

export function InferencePanel({
  videoId,
  job,
  isUploading,
  onStartInference,
}: Props) {
  const isIdle = !job || job.status === 'completed' || job.status === 'failed'
  const isProcessing = job?.status === 'processing' || job?.status === 'pending'

  const getStatusColor = () => {
    if (!job) return 'var(--neutral-400)'
    switch (job.status) {
      case 'pending':
        return 'var(--info)'
      case 'processing':
        return 'var(--primary)'
      case 'completed':
        return 'var(--success)'
      case 'failed':
        return 'var(--error)'
      default:
        return 'var(--neutral-400)'
    }
  }

  const getStatusText = () => {
    if (isUploading) return 'Subiendo video al servidor...'
    if (!job) return 'Listo para analizar'
    switch (job.status) {
      case 'pending':
        return 'En cola...'
      case 'processing':
        return job.message || 'Procesando...'
      case 'completed':
        return 'Análisis completado'
      case 'failed':
        return job.error || 'Error en el análisis'
      default:
        return 'Estado desconocido'
    }
  }

  return (
    <div className="inference-panel">
      <div className="inference-header">
        <h3>
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Inferencia
        </h3>
        {videoId && (
          <span className="video-id-badge">ID: {videoId.slice(0, 8)}...</span>
        )}
      </div>

      <div className="inference-status">
        <div className="status-indicator" style={{ backgroundColor: getStatusColor() }} />
        <span className="status-text">{getStatusText()}</span>
      </div>

      {isProcessing && job && (
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <span className="progress-text">{job.progress.toFixed(0)}%</span>
        </div>
      )}

      {job?.status === 'failed' && job.error && (
        <div className="error-message">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {job.error}
        </div>
      )}

      <button
        className="inference-btn"
        onClick={onStartInference}
        disabled={!videoId || isUploading || isProcessing}
      >
        {isUploading ? (
          <>
            <svg className="icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Subiendo...
          </>
        ) : isProcessing ? (
          <>
            <svg className="icon spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Analizando...
          </>
        ) : (
          <>
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5,3 19,12 5,21" fill="currentColor" />
            </svg>
            Ejecutar Inferencia
          </>
        )}
      </button>

      {!videoId && (
        <p className="hint-text">Carga un video para comenzar el análisis.</p>
      )}
    </div>
  )
}


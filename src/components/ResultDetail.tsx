import type { Prediction } from '../types'
import { BEHAVIOR_BY_ID } from '../constants/behaviors'

interface Props {
  prediction: Prediction | null
  onClose: () => void
  onJumpToSegment?: (start: number) => void
}

function getScoreLabel(pred: number): string {
  switch (pred) {
    case 0:
      return 'Bajo'
    case 1:
      return 'Medio'
    case 2:
      return 'Alto'
    default:
      return 'N/A'
  }
}

export function ResultDetail({ prediction, onClose, onJumpToSegment }: Props) {
  if (!prediction) return null

  const behavior = BEHAVIOR_BY_ID[prediction.behaviorId]
  if (!behavior) return null

  return (
    <>
      <div className="detail-backdrop" onClick={onClose} />
      <div className="detail-drawer" role="dialog" aria-modal="true">
        <div className="detail-header">
          <div className="detail-title">
            <span
              className="behavior-dot large"
              style={{ backgroundColor: behavior.color }}
            />
            <div>
              <h3>{behavior.name}</h3>
              <span className="behavior-id">{prediction.behaviorId}</span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="detail-body">
          <div className="detail-scores">
            <div className="score-card">
              <span className="score-label">Puntuación</span>
              <span className={`score-value score-${prediction.pred}`}>
                {prediction.pred}
              </span>
              <span className="score-name">{getScoreLabel(prediction.pred)}</span>
            </div>
            <div className="score-card">
              <span className="score-label">Confianza</span>
              <span className="score-value confidence">
                {(prediction.confidence * 100).toFixed(1)}%
              </span>
              <div className="confidence-bar">
                <div
                  className="confidence-fill"
                  style={{ width: `${prediction.confidence * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rubric-section">
            <h4>Criterio de Evaluación</h4>
            <div className="rubric-text">
              <p>{prediction.rubricText}</p>
            </div>
          </div>

          <div className="all-criteria">
            <h4>Todos los Criterios</h4>
            <div className="criteria-list">
              {[0, 1, 2].map((score) => (
                <div
                  key={score}
                  className={`criteria-item ${score === prediction.pred ? 'active' : ''}`}
                >
                  <span className={`criteria-score score-${score}`}>{score}</span>
                  <span className="criteria-text">
                    {behavior.labels[score as 0 | 1 | 2]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {prediction.segmentStart !== undefined && prediction.segmentEnd !== undefined && (
            <div className="segment-section">
              <h4>Segmento del Video</h4>
              <div className="segment-info">
                <span>
                  {prediction.segmentStart.toFixed(2)}s - {prediction.segmentEnd.toFixed(2)}s
                </span>
                {onJumpToSegment && (
                  <button
                    className="jump-btn"
                    onClick={() => onJumpToSegment(prediction.segmentStart!)}
                  >
                    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5,3 19,12 5,21" fill="currentColor" />
                    </svg>
                    Ir al segmento
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}


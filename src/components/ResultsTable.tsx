import type { Prediction, BehaviorId } from '../types'
import { BEHAVIOR_BY_ID, BEHAVIOR_CATEGORIES } from '../constants/behaviors'

interface Props {
  predictions: Prediction[]
  onSelectPrediction: (prediction: Prediction) => void
  selectedBehaviorId?: BehaviorId | null
}

function getScoreClass(pred: number): string {
  switch (pred) {
    case 0:
      return 'score-low'
    case 1:
      return 'score-mid'
    case 2:
      return 'score-high'
    default:
      return ''
  }
}

function getConfidenceClass(conf: number): string {
  if (conf >= 0.8) return 'conf-high'
  if (conf >= 0.5) return 'conf-mid'
  return 'conf-low'
}

export function ResultsTable({ predictions, onSelectPrediction, selectedBehaviorId }: Props) {
  if (predictions.length === 0) {
    return (
      <div className="results-empty">
        <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
        <p>No hay resultados aún.</p>
        <span>Ejecuta la inferencia para ver las predicciones.</span>
      </div>
    )
  }

  // Group predictions by category
  const grouped = predictions.reduce(
    (acc, pred) => {
      const behavior = BEHAVIOR_BY_ID[pred.behaviorId]
      if (behavior) {
        const cat = behavior.category
        if (!acc[cat]) acc[cat] = []
        acc[cat].push(pred)
      }
      return acc
    },
    {} as Record<string, Prediction[]>,
  )

  const categoryOrder = ['locomotor', 'ballSkills', 'balance']

  return (
    <div className="results-table-container">
      {categoryOrder.map((catKey) => {
        const preds = grouped[catKey]
        if (!preds || preds.length === 0) return null
        const categoryName = BEHAVIOR_CATEGORIES[catKey as keyof typeof BEHAVIOR_CATEGORIES]

        return (
          <div key={catKey} className="results-category">
            <h4 className="category-header">{categoryName}</h4>
            <table className="results-table">
              <thead>
                <tr>
                  <th>Comportamiento</th>
                  <th>Puntuación</th>
                  <th>Confianza</th>
                </tr>
              </thead>
              <tbody>
                {preds.map((pred) => {
                  const behavior = BEHAVIOR_BY_ID[pred.behaviorId]
                  const isSelected = selectedBehaviorId === pred.behaviorId
                  return (
                    <tr
                      key={pred.behaviorId}
                      className={`result-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => onSelectPrediction(pred)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onSelectPrediction(pred)
                        }
                      }}
                    >
                      <td className="behavior-cell">
                        <span
                          className="behavior-dot"
                          style={{ backgroundColor: behavior?.color }}
                        />
                        <span className="behavior-name">{behavior?.name || pred.behaviorId}</span>
                      </td>
                      <td>
                        <span className={`score-badge ${getScoreClass(pred.pred)}`}>
                          {pred.pred}
                        </span>
                      </td>
                      <td>
                        <span className={`confidence-badge ${getConfidenceClass(pred.confidence)}`}>
                          {(pred.confidence * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}

      <div className="results-summary">
        <div className="summary-item">
          <span className="summary-label">Total evaluado:</span>
          <span className="summary-value">{predictions.length} comportamientos</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Promedio:</span>
          <span className="summary-value">
            {(predictions.reduce((sum, p) => sum + p.pred, 0) / predictions.length).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  )
}


import { useEffect, useRef, useState } from 'react'
import './App.css'
import { InputLoader } from './components/InputLoader'
import { VideoPlayer } from './components/VideoPlayer'
import { PlaybackControls } from './components/PlaybackControls'
import { Timeline } from './components/Timeline'
import { ShortcutsHelp } from './components/ShortcutsHelp'
import { SkeletonViewer } from './components/SkeletonViewer'
import type { Prediction, VideoMeta, BehaviorId, InputType, InferenceJob } from './types'
import { BEHAVIORS, BEHAVIOR_BY_ID } from './constants/behaviors'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useThumbnailGenerator } from './hooks/useThumbnailGenerator'
import { formatTime } from './utils/time'
import { exportPredictionsToCsv } from './utils/csvExport'
import { exportPredictionsToJson } from './utils/jsonExport'

const API_BASE = '/api'

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Input state
  const [inputType, setInputType] = useState<InputType>('video')
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null)
  const [skeletonData, setSkeletonData] = useState<unknown | null>(null)
  const [skeletonFileName, setSkeletonFileName] = useState<string | null>(null)

  // Video player state
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [isMuted, setIsMuted] = useState(true)
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const [pendingSeek, setPendingSeek] = useState<number | null>(null)

  // Inference state
  const [selectedBehavior, setSelectedBehavior] = useState<BehaviorId>('A01')
  const [uploadedInputId, setUploadedInputId] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [job, setJob] = useState<InferenceJob | null>(null)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const { previewUrl, previewTime, requestPreview } = useThumbnailGenerator(videoSrc)
  const pollingRef = useRef<number | null>(null)

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  // Upload video to backend
  const uploadVideo = async (file: File): Promise<string | null> => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_BASE}/videos`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Error uploading video: ${res.status}`)
      }

      const data = await res.json()
      setUploadedInputId(data.video_id)
      setVideoMeta((m) => m ? { ...m, fps: data.fps, videoId: data.video_id } : m)
      setStatus('Video subido correctamente')
      return data.video_id
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error uploading video'
      setStatus(`Error: ${message}`)
      return null
    } finally {
      setIsUploading(false)
    }
  }

  // Upload skeleton to backend
  const uploadSkeleton = async (file: File, data: unknown): Promise<string | null> => {
    setIsUploading(true)
    try {
      const res = await fetch(`${API_BASE}/skeletons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          data: data,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Error uploading skeleton: ${res.status}`)
      }

      const result = await res.json()
      setUploadedInputId(result.skeleton_id)
      setStatus('Skeleton subido correctamente')
      return result.skeleton_id
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error uploading skeleton'
      setStatus(`Error: ${message}`)
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const handleVideoSelected = async (file: File) => {
    // Revoke previous object URL
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc)
    }

    // Reset state
    setInputType('video')
    setPrediction(null)
    setUploadedInputId(null)
    setJob(null)
    setSkeletonData(null)
    setSkeletonFileName(null)

    // Create local preview URL
    const src = URL.createObjectURL(file)
    setVideoSrc(src)
    setVideoFile(file)
    setVideoMeta({ fileName: file.name, filePath: file.name, duration: 0 })
    setIsVideoLoading(true)
    setDuration(0)
    setIsPlaying(false)
    setCurrentTime(0)

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }

    // Upload to backend
    await uploadVideo(file)
  }

  const handleSkeletonSelected = async (file: File, data: unknown) => {
    // Revoke previous video URL if any
    if (videoSrc) {
      URL.revokeObjectURL(videoSrc)
    }

    // Reset state
    setInputType('skeleton')
    setPrediction(null)
    setUploadedInputId(null)
    setJob(null)
    setVideoSrc(null)
    setVideoFile(null)
    setVideoMeta(null)

    setSkeletonData(data)
    setSkeletonFileName(file.name)

    // Upload to backend
    await uploadSkeleton(file, data)
  }

  const pollJobStatus = (jobId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`${API_BASE}/jobs/${jobId}`)
        if (!res.ok) return

        const data = await res.json()
        setJob((prev) => prev ? {
          ...prev,
          status: data.status,
          progress: data.progress,
          message: data.message,
          error: data.error,
        } : null)

        if (data.status === 'completed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          // Fetch results
          const resultsRes = await fetch(`${API_BASE}/jobs/${jobId}/results`)
          if (resultsRes.ok) {
            const results = await resultsRes.json()
            const behavior = BEHAVIOR_BY_ID[results.prediction.behavior_id as BehaviorId]
            setPrediction({
              behaviorId: results.prediction.behavior_id,
              pred: results.prediction.pred,
              confidence: results.prediction.confidence,
              rubricText: results.prediction.rubric_text,
              rubricTextEs: results.prediction.rubric_text_es,
            })
            setStatus(`Análisis completado: ${behavior?.nameEs || behavior?.name}`)
          }
        } else if (data.status === 'failed') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          setStatus(`Error: ${data.error || 'Inference failed'}`)
        }
      } catch (err) {
        console.error('Error polling job:', err)
      }
    }

    // Initial poll
    void poll()
    // Start interval
    pollingRef.current = window.setInterval(poll, 1000)
  }

  const handleStartInference = async () => {
    if (!uploadedInputId) {
      // Need to upload first
      if (inputType === 'video' && videoFile) {
        const id = await uploadVideo(videoFile)
        if (!id) return
        setUploadedInputId(id)
      } else if (inputType === 'skeleton' && skeletonData) {
        // Already uploaded on selection
        return
      }
    }

    try {
      const res = await fetch(`${API_BASE}/infer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_id: uploadedInputId,
          input_type: inputType,
          behavior_id: selectedBehavior,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.detail || `Error starting inference: ${res.status}`)
      }

      const data = await res.json()
      setJob({
        jobId: data.job_id,
        inputId: uploadedInputId!,
        inputType,
        behaviorId: selectedBehavior,
        status: 'pending',
        progress: 0,
        message: 'Iniciando análisis...',
        createdAt: new Date().toISOString(),
      })
      setPrediction(null)

      // Start polling
      pollJobStatus(data.job_id)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error starting inference'
      setStatus(`Error: ${message}`)
    }
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      void video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const handleSeek = (time: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = time
    setCurrentTime(time)
    setPendingSeek(time)
  }

  const jump = (delta: number) => {
    if (!videoRef.current) return
    const next = Math.min(Math.max(0, currentTime + delta), duration || currentTime)
    videoRef.current.currentTime = next
    setCurrentTime(next)
  }

  const jumpPrecise = (delta: number) => {
    if (!videoRef.current) return
    const next = Math.min(Math.max(0, currentTime + delta), duration || currentTime)
    videoRef.current.currentTime = next
    setCurrentTime(next)
  }

  useKeyboardShortcuts({
    onTogglePlay: togglePlay,
    onJumpBackward: () => jump(-2),
    onJumpForward: () => jump(2),
    onJumpBackwardPrecise: () => jumpPrecise(-0.04),
    onJumpForwardPrecise: () => jumpPrecise(0.04),
  })

  const canExport = prediction !== null
  const isProcessing = job?.status === 'processing' || job?.status === 'pending'
  const hasInput = uploadedInputId !== null

  // Status message timeout
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(null), 4000)
    return () => clearTimeout(t)
  }, [status])

  // Pending seek cleanup
  useEffect(() => {
    if (pendingSeek === null) return
    const t = setTimeout(() => setPendingSeek(null), 100)
    return () => clearTimeout(t)
  }, [pendingSeek])

  // Cleanup video URL on unmount
  useEffect(() => {
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc)
      }
    }
  }, [videoSrc])

  const selectedBehaviorDef = BEHAVIOR_BY_ID[selectedBehavior]

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-logo">
            <svg viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="22" fill="url(#grad1)" />
              <path
                d="M16 18c0-2 1-3 3-3h10c2 0 3 1 3 3v12c0 2-1 3-3 3H19c-2 0-3-1-3-3V18z"
                fill="white"
                fillOpacity="0.9"
              />
              <polygon points="21,20 21,28 28,24" fill="url(#grad1)" />
              <defs>
                <linearGradient id="grad1" x1="0" y1="0" x2="48" y2="48">
                  <stop offset="0%" stopColor="#6F2DA8" />
                  <stop offset="100%" stopColor="#A375D1" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="brand-text">
            <h1>DIANA Inference Tool</h1>
            <p>Predicción de habilidades motoras</p>
          </div>
        </div>
        <div className="header-actions">
          <InputLoader
            onVideoSelected={handleVideoSelected}
            onSkeletonSelected={handleSkeletonSelected}
            disabled={isUploading || isProcessing}
          />
          {canExport && (
            <div className="export-buttons">
              <button
                onClick={() => {
                  if (prediction && (videoMeta || skeletonFileName)) {
                    const meta = videoMeta || { fileName: skeletonFileName!, filePath: skeletonFileName!, duration: 0 }
                    exportPredictionsToCsv([prediction], meta, null)
                  }
                }}
                title="Exportar a CSV"
              >
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7,10 12,15 17,10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                CSV
              </button>
              <button
                onClick={() => {
                  if (prediction && (videoMeta || skeletonFileName)) {
                    const meta = videoMeta || { fileName: skeletonFileName!, filePath: skeletonFileName!, duration: 0 }
                    exportPredictionsToJson([prediction], meta, null)
                  }
                }}
                title="Exportar a JSON"
              >
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7,10 12,15 17,10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                JSON
              </button>
            </div>
          )}
        </div>
      </header>

      <ShortcutsHelp />

      <main className="layout">
        {/* Left: Input Preview */}
        <section className="player-section">
          {inputType === 'video' ? (
            <>
              <VideoPlayer
                src={videoSrc}
                videoRef={videoRef}
                isPlaying={isPlaying}
                playbackRate={playbackRate}
                isMuted={isMuted}
                isLoading={isVideoLoading}
                seekTo={pendingSeek ?? undefined}
                onDuration={(d) => {
                  setDuration(d)
                  setVideoMeta((m) => (m ? { ...m, duration: d } : m))
                  setIsVideoLoading(false)
                }}
                onTimeUpdate={(t) => setCurrentTime(t)}
                onEnded={() => setIsPlaying(false)}
                onPlayStateChange={(playing) => setIsPlaying(playing)}
              />
              {videoSrc && (
                <>
                  <PlaybackControls
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    playbackRate={playbackRate}
                    isMuted={isMuted}
                    onTogglePlay={togglePlay}
                    onToggleMute={() => setIsMuted((m) => !m)}
                    onChangeSpeed={(r) => setPlaybackRate(r)}
                    onJumpBackward={() => jump(-2)}
                    onJumpForward={() => jump(2)}
                  />
                  <Timeline
                    duration={duration}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    onRequestPreview={requestPreview}
                    previewUrl={previewUrl}
                    previewTime={previewTime}
                  />
                </>
              )}
              {videoMeta && (
                <div className="input-info">
                  <span><strong>Archivo:</strong> {videoMeta.fileName}</span>
                  <span><strong>Duración:</strong> {formatTime(duration)}</span>
                </div>
              )}
            </>
          ) : (
            <>
              {skeletonData ? (
                <SkeletonViewer data={skeletonData} fps={30} />
              ) : (
                <div className="skeleton-preview">
                  <div className="skeleton-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="12" cy="4" r="2.5" />
                      <line x1="12" y1="6.5" x2="12" y2="14" />
                      <line x1="7" y1="9" x2="17" y2="9" />
                      <line x1="12" y1="14" x2="7" y2="22" />
                      <line x1="12" y1="14" x2="17" y2="22" />
                    </svg>
                  </div>
                  <div className="skeleton-info">
                    <span className="skeleton-hint">Carga un archivo JSON con skeleton points</span>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Right: Behavior Selection + Inference */}
        <section className="side-panel">
          {/* Behavior Selector */}
          <div className="panel-card">
            <div className="panel-header">
              <h3>Comportamiento a Evaluar</h3>
            </div>
            <div className="behavior-selector">
              <select
                value={selectedBehavior}
                onChange={(e) => setSelectedBehavior(e.target.value as BehaviorId)}
                disabled={isProcessing}
              >
                {BEHAVIORS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id}: {b.nameEs || b.name}
                  </option>
                ))}
              </select>
              {selectedBehaviorDef && (
                <div className="behavior-preview">
                  <span
                    className="behavior-dot"
                    style={{ backgroundColor: selectedBehaviorDef.color }}
                  />
                  <span className="behavior-name">{selectedBehaviorDef.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Inference Control */}
          <div className="panel-card">
            <div className="panel-header">
              <h3>Inferencia</h3>
              {uploadedInputId && (
                <span className="input-id-badge">
                  {inputType === 'video' ? '🎬' : '🦴'} {uploadedInputId.slice(0, 8)}...
                </span>
              )}
            </div>

            {/* Progress */}
            {isProcessing && job && (
              <div className="inference-progress">
                <div className="progress-container">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${job.progress}%` }} />
                  </div>
                  <span className="progress-text">{job.progress.toFixed(0)}%</span>
                </div>
                <span className="progress-message">{job.message}</span>
              </div>
            )}

            {/* Error */}
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
              onClick={handleStartInference}
              disabled={!hasInput || isUploading || isProcessing}
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

            {!hasInput && (
              <p className="hint-text">Carga un video o skeleton para comenzar.</p>
            )}
          </div>

          {/* Result */}
          {prediction && (
            <div className="panel-card result-card">
              <div className="panel-header">
                <h3>Resultado</h3>
                <span className={`score-badge large score-${prediction.pred}`}>
                  {prediction.pred}
                </span>
              </div>

              <div className="result-content">
                <div className="result-behavior">
                  <span
                    className="behavior-dot"
                    style={{ backgroundColor: selectedBehaviorDef?.color }}
                  />
                  <div>
                    <span className="behavior-id">{prediction.behaviorId}</span>
                    <span className="behavior-name">{selectedBehaviorDef?.nameEs || selectedBehaviorDef?.name}</span>
                  </div>
                </div>

                <div className="result-confidence">
                  <span className="conf-label">Confianza</span>
                  <div className="conf-bar">
                    <div className="conf-fill" style={{ width: `${prediction.confidence * 100}%` }} />
                  </div>
                  <span className="conf-value">{(prediction.confidence * 100).toFixed(1)}%</span>
                </div>

                <div className="result-rubric">
                  <h4>Criterio</h4>
                  <p>{prediction.rubricTextEs || prediction.rubricText}</p>
                </div>

                <div className="result-all-criteria">
                  <h4>Todos los Criterios</h4>
                  <div className="criteria-list">
                    {[0, 1, 2].map((score) => (
                      <div
                        key={score}
                        className={`criteria-item ${score === prediction.pred ? 'active' : ''}`}
                      >
                        <span className={`criteria-score score-${score}`}>{score}</span>
                        <span className="criteria-text">
                          {selectedBehaviorDef?.labelsEs?.[score as 0 | 1 | 2] ||
                            selectedBehaviorDef?.labels[score as 0 | 1 | 2]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Toast */}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {status && (
          <div className={`toast ${status.startsWith('Error') ? 'toast-error' : ''}`}>
            <span>{status}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default App

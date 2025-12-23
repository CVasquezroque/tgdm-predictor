import { useEffect, useRef, useState, useCallback } from 'react'

// OpenPose Body 25 skeleton connections
// Each pair represents [from, to] keypoint indices
const POSE_CONNECTIONS = [
    // Head
    [0, 1],   // Nose -> Neck
    [0, 15],  // Nose -> REye
    [0, 16],  // Nose -> LEye
    [15, 17], // REye -> REar
    [16, 18], // LEye -> LEar
    // Upper body
    [1, 2],   // Neck -> RShoulder
    [2, 3],   // RShoulder -> RElbow
    [3, 4],   // RElbow -> RWrist
    [1, 5],   // Neck -> LShoulder
    [5, 6],   // LShoulder -> LElbow
    [6, 7],   // LElbow -> LWrist
    // Torso
    [1, 8],   // Neck -> MidHip
    // Lower body right
    [8, 9],   // MidHip -> RHip
    [9, 10],  // RHip -> RKnee
    [10, 11], // RKnee -> RAnkle
    [11, 22], // RAnkle -> RBigToe
    [11, 24], // RAnkle -> RHeel
    [22, 23], // RBigToe -> RSmallToe
    // Lower body left
    [8, 12],  // MidHip -> LHip
    [12, 13], // LHip -> LKnee
    [13, 14], // LKnee -> LAnkle
    [14, 19], // LAnkle -> LBigToe
    [14, 21], // LAnkle -> LHeel
    [19, 20], // LBigToe -> LSmallToe
]

// Colors for different body parts
const JOINT_COLORS = {
    head: '#FF6B6B',
    arm: '#4ECDC4',
    torso: '#FFE66D',
    leg: '#95E1D3',
}

interface SkeletonFrame {
    frame_index: number
    skeleton: Array<{
        pose: number[]
        score: number[]
    }>
}

interface OpenPoseData {
    data: SkeletonFrame[]
}

interface Props {
    data: OpenPoseData | unknown
    fps?: number
}

export function SkeletonViewer({ data, fps = 30 }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const animationRef = useRef<number | null>(null)
    const lastFrameTimeRef = useRef<number>(0)

    const [isPlaying, setIsPlaying] = useState(false)
    const [currentFrame, setCurrentFrame] = useState(0)
    const [frames, setFrames] = useState<SkeletonFrame[]>([])

    // Parse and validate data
    useEffect(() => {
        try {
            const openPoseData = data as OpenPoseData
            if (openPoseData?.data && Array.isArray(openPoseData.data)) {
                setFrames(openPoseData.data)
                setCurrentFrame(0)
            }
        } catch {
            console.error('Invalid skeleton data format')
        }
    }, [data])

    // Get canvas bounds from first frame
    const getBounds = useCallback(() => {
        if (frames.length === 0) return { minX: 0, maxX: 800, minY: 0, maxY: 600 }

        let minX = Infinity, maxX = -Infinity
        let minY = Infinity, maxY = -Infinity

        // Sample a few frames to get bounds
        const sampleFrames = [0, Math.floor(frames.length / 2), frames.length - 1]
        for (const idx of sampleFrames) {
            const frame = frames[idx]
            if (!frame?.skeleton) continue

            for (const person of frame.skeleton) {
                const pose = person.pose
                for (let i = 0; i < pose.length; i += 2) {
                    const x = pose[i]
                    const y = pose[i + 1]
                    if (x !== 0 || y !== 0) {
                        minX = Math.min(minX, x)
                        maxX = Math.max(maxX, x)
                        minY = Math.min(minY, y)
                        maxY = Math.max(maxY, y)
                    }
                }
            }
        }

        // Add padding
        const padX = (maxX - minX) * 0.1
        const padY = (maxY - minY) * 0.1

        return {
            minX: minX - padX,
            maxX: maxX + padX,
            minY: minY - padY,
            maxY: maxY + padY,
        }
    }, [frames])

    // Draw frame
    const drawFrame = useCallback((frameIdx: number) => {
        const canvas = canvasRef.current
        if (!canvas || frames.length === 0) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const frame = frames[frameIdx]
        if (!frame?.skeleton) return

        const bounds = getBounds()
        const scaleX = canvas.width / (bounds.maxX - bounds.minX)
        const scaleY = canvas.height / (bounds.maxY - bounds.minY)
        const scale = Math.min(scaleX, scaleY) * 0.9

        const offsetX = (canvas.width - (bounds.maxX - bounds.minX) * scale) / 2
        const offsetY = (canvas.height - (bounds.maxY - bounds.minY) * scale) / 2

        const transform = (x: number, y: number): [number, number] => [
            (x - bounds.minX) * scale + offsetX,
            (y - bounds.minY) * scale + offsetY,
        ]

        // Clear canvas
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        // Draw each person
        for (const person of frame.skeleton) {
            const pose = person.pose
            const scores = person.score

            // Draw bones
            ctx.lineWidth = 3
            ctx.lineCap = 'round'

            for (const [from, to] of POSE_CONNECTIONS) {
                const fromX = pose[from * 2]
                const fromY = pose[from * 2 + 1]
                const toX = pose[to * 2]
                const toY = pose[to * 2 + 1]

                // Skip if any point is missing
                if ((fromX === 0 && fromY === 0) || (toX === 0 && toY === 0)) continue

                // Skip if confidence is too low
                const conf = Math.min(scores[from] || 0, scores[to] || 0)
                if (conf < 0.1) continue

                const [x1, y1] = transform(fromX, fromY)
                const [x2, y2] = transform(toX, toY)

                // Determine color based on body part
                let color = JOINT_COLORS.torso
                if (from <= 18 && from >= 15) color = JOINT_COLORS.head
                else if ((from >= 2 && from <= 7)) color = JOINT_COLORS.arm
                else if (from >= 9) color = JOINT_COLORS.leg

                ctx.strokeStyle = color
                ctx.globalAlpha = Math.max(0.3, conf)
                ctx.beginPath()
                ctx.moveTo(x1, y1)
                ctx.lineTo(x2, y2)
                ctx.stroke()
            }

            // Draw joints
            ctx.globalAlpha = 1
            for (let i = 0; i < 25; i++) {
                const x = pose[i * 2]
                const y = pose[i * 2 + 1]
                const conf = scores[i] || 0

                if (x === 0 && y === 0) continue
                if (conf < 0.1) continue

                const [tx, ty] = transform(x, y)

                // Color based on body part
                let color = JOINT_COLORS.torso
                if (i === 0 || (i >= 15 && i <= 18)) color = JOINT_COLORS.head
                else if (i >= 2 && i <= 7) color = JOINT_COLORS.arm
                else if (i >= 9 && i <= 14 || i >= 19) color = JOINT_COLORS.leg

                ctx.fillStyle = color
                ctx.beginPath()
                ctx.arc(tx, ty, 4 + conf * 2, 0, Math.PI * 2)
                ctx.fill()
            }
        }

        // Draw frame info
        ctx.globalAlpha = 1
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
        ctx.font = '12px monospace'
        ctx.fillText(`Frame: ${frameIdx + 1} / ${frames.length}`, 10, 20)
    }, [frames, getBounds])

    // Animation loop
    useEffect(() => {
        if (!isPlaying || frames.length === 0) return

        const frameTime = 1000 / fps

        const animate = (timestamp: number) => {
            if (timestamp - lastFrameTimeRef.current >= frameTime) {
                lastFrameTimeRef.current = timestamp
                setCurrentFrame((prev) => {
                    const next = prev + 1
                    if (next >= frames.length) {
                        setIsPlaying(false)
                        return frames.length - 1
                    }
                    return next
                })
            }
            animationRef.current = requestAnimationFrame(animate)
        }

        animationRef.current = requestAnimationFrame(animate)

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current)
            }
        }
    }, [isPlaying, frames.length, fps])

    // Draw current frame
    useEffect(() => {
        drawFrame(currentFrame)
    }, [currentFrame, drawFrame])

    const togglePlay = () => {
        if (currentFrame >= frames.length - 1) {
            setCurrentFrame(0)
        }
        setIsPlaying(!isPlaying)
    }

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const frame = parseInt(e.target.value, 10)
        setCurrentFrame(frame)
        setIsPlaying(false)
    }

    if (frames.length === 0) {
        return (
            <div className="skeleton-viewer skeleton-viewer--empty">
                <p>No se encontraron frames de skeleton</p>
            </div>
        )
    }

    return (
        <div className="skeleton-viewer">
            <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="skeleton-canvas"
            />
            <div className="skeleton-controls">
                <button
                    className="skeleton-play-btn"
                    onClick={togglePlay}
                    title={isPlaying ? 'Pausar' : 'Reproducir'}
                >
                    {isPlaying ? (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <rect x="6" y="4" width="4" height="16" />
                            <rect x="14" y="4" width="4" height="16" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5,3 19,12 5,21" />
                        </svg>
                    )}
                </button>
                <input
                    type="range"
                    min={0}
                    max={frames.length - 1}
                    value={currentFrame}
                    onChange={handleSeek}
                    className="skeleton-slider"
                />
                <span className="skeleton-frame-info">
                    {currentFrame + 1} / {frames.length}
                </span>
            </div>
        </div>
    )
}

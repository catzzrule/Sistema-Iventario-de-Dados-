import { useEffect, useRef } from 'react'

export function AetherFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let animationFrameId: number
    const mouse = { x: -1000, y: -1000 }

    interface Particle {
      x: number
      y: number
      vx: number
      vy: number
      size: number
    }

    let particles: Particle[] = []

    const initCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      // Set canvas pixel buffer matching CSS display size
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)

      // Reset transform & scale to prevent elliptical stretching
      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.max(40, Math.min(75, Math.floor((width * height) / 14000)))
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        size: Math.random() * 1.5 + 1.8 // Perfect round dots
      }))
    }

    const render = () => {
      const rect = canvas.getBoundingClientRect()
      const width = rect.width
      const height = rect.height

      context.clearRect(0, 0, width, height)

      for (const p of particles) {
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const dist = Math.hypot(dx, dy)

        if (dist < 120) {
          p.vx += (dx / Math.max(dist, 1)) * 0.012
          p.vy += (dy / Math.max(dist, 1)) * 0.012
        }

        p.vx *= 0.99
        p.vy *= 0.99
        p.x += p.vx
        p.y += p.vy

        if (p.x < -10 || p.x > width + 10) p.vx *= -1
        if (p.y < -10 || p.y > height + 10) p.vy *= -1

        context.beginPath()
        context.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        context.fillStyle = 'rgba(52, 211, 153, 0.75)'
        context.fill()
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)

          if (d < 120) {
            context.beginPath()
            context.moveTo(a.x, a.y)
            context.lineTo(b.x, b.y)
            const alpha = 0.22 * (1 - d / 120)
            context.strokeStyle = `rgba(45, 212, 191, ${alpha})`
            context.lineWidth = 1
            context.stroke()
          }
        }
      }

      animationFrameId = requestAnimationFrame(render)
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }

    initCanvas()
    render()

    window.addEventListener('resize', initCanvas)
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', initCanvas)
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  return <canvas ref={canvasRef} className="aether-flow" aria-hidden="true" />
}

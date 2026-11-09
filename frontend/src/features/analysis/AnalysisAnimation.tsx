import { useEffect, useRef, useState } from 'react'
import { IconMusicalnoteDoubleLine } from '@karrotmarket/react-monochrome-icon'
import type { Rive } from '@rive-app/canvas-lite'

/** Download the renderer only during analysis. Failure never blocks the result. */
export default function AnalysisAnimation() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let disposed = false
    let player: Rive | undefined
    let observer: ResizeObserver | undefined
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const playback = () => {
      if (document.hidden || media.matches) player?.pause()
      else player?.play()
    }
    const fail = () => { if (!disposed) setReady(false) }
    // Bundle WASM locally; no third-party CDN requests during loading.
    Promise.all([import('@rive-app/canvas-lite'), import('@rive-app/canvas-lite/rive.wasm?url')]).then(([runtime, wasm]) => {
      if (disposed || !canvas.current) return
      runtime.RuntimeLoader.setWasmUrl(wasm.default)
      runtime.RuntimeLoader.setWasmFallbackUrl(null)
      player = new runtime.Rive({
        src: '/animations/loading-documents.riv', canvas: canvas.current, artboard: 'Loading',
        stateMachines: 'State Machine 1', autoplay: !media.matches && !document.hidden,
        layout: new runtime.Layout({ fit: runtime.Fit.Contain, alignment: runtime.Alignment.Center }),
        onLoad: () => {
          if (disposed) return
          player?.resizeDrawingSurfaceToCanvas(Math.min(window.devicePixelRatio, 2))
          setReady(true)
          playback()
        },
        onLoadError: fail,
      })
      observer = new ResizeObserver(() => player?.resizeDrawingSurfaceToCanvas(Math.min(window.devicePixelRatio, 2)))
      observer.observe(canvas.current)
    }).catch(fail)
    media.addEventListener('change', playback)
    document.addEventListener('visibilitychange', playback)
    return () => {
      disposed = true
      observer?.disconnect()
      media.removeEventListener('change', playback)
      document.removeEventListener('visibilitychange', playback)
      player?.cleanup()
    }
  }, [])
  return <div className="analysis-animation" data-ready={ready} aria-hidden="true">
    <canvas ref={canvas} width={480} height={480} />
    {!ready && <IconMusicalnoteDoubleLine className="analysis-animation-fallback" />}
  </div>
}

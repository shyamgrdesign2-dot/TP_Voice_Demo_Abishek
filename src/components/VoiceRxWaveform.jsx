import {useEffect, useRef} from 'react'

const COLORS = [
	[124, 58, 237],
	[79, 70, 229],
	[192, 38, 211]
]

const SHUFFLE = [1, 3, 0, 4, 2]

function range(count) {
	return Array.from({length: count}, (_, index) => index)
}

function drawIdleLine(ctx, width, height, tick) {
	const midpoint = height / 2
	const pad = Math.min(16, width * 0.06)
	const gradient = ctx.createLinearGradient(pad, midpoint, width - pad, midpoint)
	gradient.addColorStop(0, 'rgba(124, 58, 237, 0.85)')
	gradient.addColorStop(0.5, 'rgba(79, 70, 229, 0.85)')
	gradient.addColorStop(1, 'rgba(192, 38, 211, 0.85)')
	
	ctx.strokeStyle = gradient
	ctx.lineWidth = 1
	ctx.lineCap = 'round'
	ctx.globalCompositeOperation = 'source-over'
	ctx.shadowBlur = 0
	ctx.beginPath()
	ctx.moveTo(pad, midpoint + Math.sin(tick * 1.8) * 0.75)
	ctx.lineTo(width - pad, midpoint + Math.cos(tick * 1.4) * 0.75)
	ctx.stroke()
}

function pickFrequency(channel, index, freqs) {
	return freqs[2 * channel + SHUFFLE[index] * 6] ?? 0
}

function drawChannel(ctx, channel, width, height, freqs) {
	const color = COLORS[channel]
	const gradient = ctx.createLinearGradient(0, 0, width, 0)
	gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`)
	gradient.addColorStop(0.2, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.28)`)
	gradient.addColorStop(0.8, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.28)`)
	gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`)
	
	ctx.fillStyle = gradient
	ctx.shadowColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.3)`
	ctx.shadowBlur = 36
	ctx.globalCompositeOperation = 'lighter'
	
	const midpoint = height / 2
	const offset = (width - 15 * 50) / 2
	const x = range(15).map((index) => offset + channel * 35 + index * 50)
	const y = range(5).map((index) => {
		const scale = ((3 - Math.abs(2 - index)) / 3) * 0.34
		return Math.max(0, midpoint - scale * pickFrequency(channel, index, freqs))
	})
	const fullHeight = 2 * midpoint
	
	ctx.beginPath()
	ctx.moveTo(0, midpoint)
	ctx.lineTo(x[0], midpoint + 1)
	ctx.bezierCurveTo(x[1], midpoint + 1, x[2], y[0], x[3], y[0])
	ctx.bezierCurveTo(x[4], y[0], x[4], y[1], x[5], y[1])
	ctx.bezierCurveTo(x[6], y[1], x[6], y[2], x[7], y[2])
	ctx.bezierCurveTo(x[8], y[2], x[8], y[3], x[9], y[3])
	ctx.bezierCurveTo(x[10], y[3], x[10], y[4], x[11], y[4])
	ctx.bezierCurveTo(x[12], y[4], x[12], midpoint, x[13], midpoint)
	ctx.lineTo(width, midpoint + 1)
	ctx.lineTo(x[13], midpoint - 1)
	ctx.bezierCurveTo(x[12], midpoint, x[12], fullHeight - y[4], x[11], fullHeight - y[4])
	ctx.bezierCurveTo(x[10], fullHeight - y[4], x[10], fullHeight - y[3], x[9], fullHeight - y[3])
	ctx.bezierCurveTo(x[8], fullHeight - y[3], x[8], fullHeight - y[2], x[7], fullHeight - y[2])
	ctx.bezierCurveTo(x[6], fullHeight - y[2], x[6], fullHeight - y[1], x[5], fullHeight - y[1])
	ctx.bezierCurveTo(x[4], fullHeight - y[1], x[4], fullHeight - y[0], x[3], fullHeight - y[0])
	ctx.bezierCurveTo(x[2], fullHeight - y[0], x[1], midpoint, x[0], midpoint)
	ctx.lineTo(0, midpoint)
	ctx.fill()
}

export function VoiceRxWaveform({stream, paused = false}) {
	const containerRef = useRef(null)
	const canvasRef = useRef(null)
	const audioContextRef = useRef(null)
	const analyserRef = useRef(null)
	const freqsRef = useRef(null)
	const sourceRef = useRef(null)
	const pausedRef = useRef(paused)
	const dimensionsRef = useRef({width: 240, height: 58})
	
	useEffect(() => {
		pausedRef.current = paused
	}, [paused])
	
	useEffect(() => {
		const element = containerRef.current
		if (!element || typeof ResizeObserver === 'undefined') {
			return
		}
		
		const update = () => {
			const rect = element.getBoundingClientRect()
			dimensionsRef.current = {
				width: Math.max(120, Math.floor(rect.width)),
				height: Math.max(44, Math.floor(rect.height))
			}
		}
		
		update()
		const observer = new ResizeObserver(update)
		observer.observe(element)
		return () => observer.disconnect()
	}, [])
	
	useEffect(() => {
		sourceRef.current?.disconnect()
		void audioContextRef.current?.close().catch(() => {})
		sourceRef.current = null
		audioContextRef.current = null
		analyserRef.current = null
		freqsRef.current = null
		
		if (!stream) {
			return
		}
		
		try {
			const audioContext = new AudioContext()
			const analyser = audioContext.createAnalyser()
			analyser.smoothingTimeConstant = 0.65
			analyser.fftSize = 256
			analyser.minDecibels = -60
			analyser.maxDecibels = 0
			const source = audioContext.createMediaStreamSource(stream)
			source.connect(analyser)
			audioContextRef.current = audioContext
			analyserRef.current = analyser
			freqsRef.current = new Uint8Array(analyser.frequencyBinCount)
			sourceRef.current = source
		}
		catch {
			// The idle line still renders if WebAudio is unavailable.
		}
		
		return () => {
			sourceRef.current?.disconnect()
			void audioContextRef.current?.close().catch(() => {})
		}
	}, [stream])
	
	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) {
			return undefined
		}
		
		let frameId = 0
		const draw = (timeMs) => {
			const context = canvas.getContext('2d')
			if (!context) {
				frameId = requestAnimationFrame(draw)
				return
			}
			
			const {width, height} = dimensionsRef.current
			const dpr = Math.min(window.devicePixelRatio || 1, 2)
			canvas.width = Math.floor(width * dpr)
			canvas.height = Math.floor(height * dpr)
			context.setTransform(dpr, 0, 0, dpr, 0, 0)
			context.clearRect(0, 0, width, height)
			
			const analyser = analyserRef.current
			const freqs = freqsRef.current
			if (stream && analyser && freqs && !pausedRef.current) {
				analyser.getByteFrequencyData(freqs)
				if (freqs.some((value) => value > 0)) {
					drawChannel(context, 0, width, height, freqs)
					drawChannel(context, 1, width, height, freqs)
					drawChannel(context, 2, width, height, freqs)
				}
				else {
					drawIdleLine(context, width, height, timeMs / 1000)
				}
			}
			else {
				drawIdleLine(context, width, height, timeMs / 1000)
			}
			
			frameId = requestAnimationFrame(draw)
		}
		
		frameId = requestAnimationFrame(draw)
		return () => cancelAnimationFrame(frameId)
	}, [stream])
	
	return (
		<div ref={containerRef} className='voicerx-waveform' aria-hidden>
			<canvas ref={canvasRef} className='h-full w-full'/>
		</div>
	)
}

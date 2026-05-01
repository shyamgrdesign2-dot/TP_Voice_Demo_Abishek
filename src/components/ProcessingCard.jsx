import {useEffect, useRef, useState} from 'react'

const CAPTION_PHRASES = [
	'Structuring your transcript',
	'Capturing the clinical data',
	'Drafting the TP EMR',
	'Mapping ICD-11 codes',
	'Drafting SOAP notes',
	'Almost ready'
]

function CaptionCarousel() {
	const [idx, setIdx] = useState(0)
	useEffect(() => {
		const id = window.setInterval(() => setIdx((i) => (i + 1) % CAPTION_PHRASES.length), 2000)
		return () => window.clearInterval(id)
	}, [])
	return (
		<div className='vrx-caption-stage flex w-full items-center justify-center px-[2px] py-[3px] text-[14px] font-semibold leading-[1.4]' style={{color: 'var(--tp-slate-600)'}}>
			<span
				key={idx}
				className='vrx-process-caption vrx-caption-slide whitespace-nowrap'
				style={{
					backgroundImage: 'linear-gradient(100deg, #45455c 0%, #45455c 32%, #D565EA 46%, #673AAC 50%, #1A1994 54%, #45455c 68%, #45455c 100%)',
					backgroundSize: '200% 100%',
					WebkitBackgroundClip: 'text',
					backgroundClip: 'text',
					color: 'transparent',
					display: 'inline-block',
					paddingBottom: 2
				}}
			>
				{CAPTION_PHRASES[idx]}…
			</span>
		</div>
	)
}

function ShineBorderRotate() {
	return (
		<div
			className='pointer-events-none absolute inset-0 size-full overflow-hidden rounded-[inherit]'
			style={{
				background: 'rgba(226, 226, 234, 0.95)',
				WebkitMask: 'linear-gradient(#fff 0 0) content-box exclude, linear-gradient(#fff 0 0)',
				mask: 'linear-gradient(#fff 0 0) content-box exclude, linear-gradient(#fff 0 0)',
				padding: '1.5px'
			}}
		>
			<span
				aria-hidden='true'
				className='vrx-shine-rotate absolute inset-[-50%] block rounded-full'
				style={{
					backgroundImage: 'conic-gradient(transparent 0deg, transparent 270deg, #D565EA, #673AAC, #1A1994 320deg, transparent 360deg)',
					willChange: 'transform'
				}}
			/>
		</div>
	)
}

/**
 * Shimmer transcript — renders each word with a staggered vrx-dt-word
 * reveal animation so the text appears to "write itself" with a blur-in.
 */
function ShimmerTranscript({text}) {
	if (!text?.trim()) {
		return (
			<p className='px-[6px] py-[4px] text-[14px] italic leading-[1.75]' style={{color: 'var(--tp-slate-400)'}}>
				Capturing your consultation…
			</p>
		)
	}
	const cleaned = text.replace(/\b(Doctor|Patient)\s*:\s*/gi, '').replace(/\n+/g, ' ').trim()
	const words = cleaned.split(/\s+/).filter(Boolean)
	return (
		<p className='whitespace-pre-wrap px-[6px] py-[4px] text-[14px] italic leading-[1.75]' style={{color: 'var(--tp-slate-600)'}}>
			<span className='vrx-dt-word vrx-dt-word--quote' aria-hidden='true'>"</span>
			{words.map((word, i) => (
				<span key={`${i}-${word}`} aria-hidden='true'>
					<span
						className='vrx-dt-word inline-block'
						style={{animationDelay: `${i * 35}ms`}}
					>
						{word}
					</span>
					{i < words.length - 1 ? ' ' : null}
				</span>
			))}
			<span className='vrx-dt-word' style={{animationDelay: `${words.length * 35}ms`}} aria-hidden='true'>"</span>
		</p>
	)
}

export function ProcessingCard({transcript}) {
	const scrollRef = useRef(null)

	// Slow auto-scroll: 24px/sec, pause 1.4s at bottom, smooth-scroll back to top.
	useEffect(() => {
		if (typeof window === 'undefined') return
		if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
		const el = scrollRef.current
		if (!el) return

		let raf = 0
		let last = performance.now()
		let pausedUntil = 0
		const PX_PER_SEC = 24

		const tick = (now) => {
			if (now < pausedUntil) {
				last = now
				raf = requestAnimationFrame(tick)
				return
			}
			const dt = (now - last) / 1000
			last = now
			const max = el.scrollHeight - el.clientHeight
			if (max > 8) {
				const next = el.scrollTop + PX_PER_SEC * dt
				if (next >= max) {
					el.scrollTop = max
					pausedUntil = now + 1400
					window.setTimeout(() => {
						scrollRef.current?.scrollTo({top: 0, behavior: 'smooth'})
					}, 1400)
				} else {
					el.scrollTop = next
				}
			}
			raf = requestAnimationFrame(tick)
		}
		raf = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(raf)
	}, [])

	return (
		<div className='relative flex min-h-0 flex-1 flex-col'>
			<div className='vrx-transcript-zone-in relative flex min-h-0 flex-1 flex-col items-stretch justify-center gap-[14px] px-[24px] pt-[40px] pb-[16px]'>
				<div className='mx-auto flex w-full max-w-[540px] min-h-0 flex-col gap-[10px]'>
					{/* Shiner card — max 80px, wraps to content if less */}
					<div
						className='vrx-shiner-enter relative flex w-full flex-col overflow-hidden rounded-[16px]'
						style={{
							background: 'rgba(250, 250, 251, 0.6)',
							boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
							maxHeight: 80
						}}
					>
						<ShineBorderRotate/>
						<div ref={scrollRef} className='relative flex-1 overflow-y-auto p-[14px]' style={{scrollbarWidth: 'none'}}>
							<ShimmerTranscript text={transcript}/>
						</div>
					</div>
				</div>

				<div className='vrx-shiner-loader mx-auto flex flex-col items-center gap-[10px]'>
					<CaptionCarousel/>
					<div className='vrx-progress-track relative h-[5px] w-[240px] overflow-hidden rounded-full'>
						<span aria-hidden='true' className='vrx-progress-fill absolute inset-y-0 left-0 block w-full rounded-full' style={{background: 'linear-gradient(90deg, #D565EA 0%, #673AAC 50%, #1A1994 100%)'}}/>
						<span aria-hidden='true' className='vrx-progress-sheen absolute inset-y-0 left-0 block w-[40%] rounded-full'/>
					</div>
				</div>
			</div>
		</div>
	)
}

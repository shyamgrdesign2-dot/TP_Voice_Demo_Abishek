import {ChevronDown, ChevronUp, Mic, Square, MicOff} from 'lucide-react'
import {MicrophoneSlash} from 'iconsax-reactjs'
import {useEffect, useRef, useState} from 'react'
import {VoiceRxSiriWaveform} from './VoiceRxSiriWaveform.jsx'
import {VoiceRxIcon} from './voice-consult-icons.jsx'
import {Tooltip} from './Tooltip.jsx'

function formatElapsed(ms) {
	const total = Math.max(0, Math.floor(ms / 1000))
	const m = String(Math.floor(total / 60)).padStart(2, '0')
	const s = String(total % 60).padStart(2, '0')
	return `${m}:${s}`
}

function useRecordingTimer(active) {
	const [ms, setMs] = useState(0)
	const startRef = useRef(0)
	useEffect(() => {
		if (!active) {
			startRef.current = 0
			return
		}
		startRef.current = Date.now() - ms
		const id = window.setInterval(() => setMs(Date.now() - startRef.current), 250)
		return () => window.clearInterval(id)
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [active])
	return ms
}

/** Muted mic icon — user-provided SVG from the reference design system */
function MicMutedIcon() {
	return (
		<svg width='24' height='24' viewBox='0 0 24 24' fill='currentColor' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
			<g clipPath='url(#vrx-mic-mute-clip)'>
				<path d='M16.4201 6.41965V7.57965L9.14008 14.8596C8.18008 13.9896 7.58008 12.7096 7.58008 11.3396V6.41965C7.58008 4.35965 8.98008 2.64965 10.8801 2.15965C11.0701 2.10965 11.2501 2.26965 11.2501 2.45965V3.99965C11.2501 4.40965 11.5901 4.74965 12.0001 4.74965C12.4101 4.74965 12.7501 4.40965 12.7501 3.99965V2.45965C12.7501 2.26965 12.9301 2.10965 13.1201 2.15965C15.0201 2.64965 16.4201 4.35965 16.4201 6.41965Z'/>
				<path d='M19.81 9.81012V11.4001C19.81 15.4701 16.68 18.8201 12.7 19.1701V21.3001C12.7 21.6901 12.39 22.0001 12 22.0001C11.61 22.0001 11.3 21.6901 11.3 21.3001V19.1701C10.21 19.0701 9.18001 18.7501 8.26001 18.2401L9.29001 17.2101C10.11 17.5901 11.03 17.8101 12 17.8101C15.54 17.8101 18.42 14.9301 18.42 11.4001V9.81012C18.42 9.43012 18.73 9.12012 19.12 9.12012C19.5 9.12012 19.81 9.43012 19.81 9.81012Z'/>
				<path d='M16.42 10.0801V11.5301C16.42 14.1101 14.2 16.1801 11.56 15.9301C11.28 15.9001 11 15.8501 10.74 15.7601L16.42 10.0801Z'/>
				<path d='M21.7701 2.22988C21.4701 1.92988 20.9801 1.92988 20.6801 2.22988L7.23012 15.6799C6.20012 14.5499 5.58012 13.0499 5.58012 11.3999V9.80988C5.58012 9.42988 5.27012 9.11988 4.88012 9.11988C4.50012 9.11988 4.19012 9.42988 4.19012 9.80988V11.3999C4.19012 13.4299 4.97012 15.2799 6.24012 16.6699L2.22012 20.6899C1.92012 20.9899 1.92012 21.4799 2.22012 21.7799C2.38012 21.9199 2.57012 21.9999 2.77012 21.9999C2.97012 21.9999 3.16012 21.9199 3.31012 21.7699L21.7701 3.30988C22.0801 3.00988 22.0801 2.52988 21.7701 2.22988Z'/>
			</g>
			<defs>
				<clipPath id='vrx-mic-mute-clip'>
					<rect width='24' height='24' fill='white'/>
				</clipPath>
			</defs>
		</svg>
	)
}

/** Unmuted mic icon — from the reference design system */
function MicOnIcon() {
	return (
		<svg width='24' height='24' viewBox='0 0 24 24' fill='currentColor' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
			<path d='M19.12 9.12c-.39 0-.7.31-.7.7v1.58c0 3.54-2.88 6.42-6.42 6.42s-6.42-2.88-6.42-6.42V9.81c0-.39-.31-.7-.7-.7-.39 0-.7.31-.7.7v1.58c0 4.07 3.13 7.42 7.12 7.78v2.13c0 .39.31.7.7.7.39 0 .7-.31.7-.7v-2.13c3.98-.35 7.12-3.71 7.12-7.78V9.81a.707.707 0 0 0-.7-.69Z'/>
			<path d='M12 2c-2.44 0-4.42 1.98-4.42 4.42v5.12c0 2.44 1.98 4.42 4.42 4.42s4.42-1.98 4.42-4.42V6.42C16.42 3.98 14.44 2 12 2Zm1.31 6.95c-.07.26-.3.43-.56.43-.05 0-.1-.01-.15-.02-.39-.11-.8-.11-1.19 0-.32.09-.63-.1-.71-.41-.09-.31.1-.63.41-.71.59-.16 1.21-.16 1.8 0 .3.08.48.4.4.71Zm.53-1.94c-.09.24-.31.38-.55.38-.07 0-.14-.01-.2-.03-.69-.26-1.47-.26-2.17 0-.3.11-.63-.05-.74-.35-.11-.3.05-.63.35-.74.97-.35 2.03-.35 3 0 .3.11.46.44.31.74Z'/>
		</svg>
	)
}

export function DictationView({
	mode,
	transcript,
	isMicOn,
	micStream,
	micOptions,
	selectedMic,
	setSelectedMic,
	onToggleMic,
	onCancel,
	onSubmit,
	canSubmit,
	isSubmitting,
	error
}) {
	const elapsed = useRecordingTimer(isMicOn)
	const [showMicMenu, setShowMicMenu] = useState(false)
	const micMenuRef = useRef(null)
	const scrollRef = useRef(null)

	useEffect(() => {
		if (!showMicMenu) return
		const handler = (e) => {
			if (!micMenuRef.current?.contains(e.target)) setShowMicMenu(false)
		}
		window.addEventListener('mousedown', handler)
		return () => window.removeEventListener('mousedown', handler)
	}, [showMicMenu])

	useEffect(() => {
		const el = scrollRef.current
		if (!el) return
		el.scrollTo({top: el.scrollHeight, behavior: 'smooth'})
	}, [transcript])

	const hasTranscript = Boolean(transcript?.trim())

	// Speech Recognition Effect
	useEffect(() => {
		if (!isMicOn) {
			if (window.recognition) {
				window.recognition.stop()
			}
			return
		}

		const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
		if (!SpeechRecognition) {
			console.warn('Speech recognition not supported in this browser.')
			return
		}

		const recognition = new SpeechRecognition()
		window.recognition = recognition
		recognition.continuous = true
		recognition.interimResults = true
		recognition.lang = 'en-US'

		let baseTranscript = transcript || ''

		recognition.onresult = (event) => {
			let interimTranscript = ''
			let currentFinal = ''

			for (let i = event.resultIndex; i < event.results.length; ++i) {
				if (event.results[i].isFinal) {
					currentFinal += event.results[i][0].transcript
				} else {
					interimTranscript += event.results[i][0].transcript
				}
			}
			
			if (currentFinal) {
				baseTranscript += (baseTranscript && currentFinal.trim() ? ' ' : '') + currentFinal.trim()
			}
			
			const displayTranscript = baseTranscript + (interimTranscript ? (baseTranscript ? ' ' : '') + interimTranscript : '')
			setTranscript(displayTranscript)
		}

		recognition.onerror = (event) => {
			console.error('Speech recognition error:', event.error)
		}

		recognition.onend = () => {
			if (isMicOn && window.recognition === recognition) {
				try {
					recognition.start()
				} catch (e) {
					console.error('Failed to restart recognition:', e)
				}
			}
		}

		try {
			recognition.start()
		} catch (e) {
			console.error('Failed to start recognition:', e)
		}

		return () => {
			recognition.onend = null
			recognition.stop()
			window.recognition = null
		}
	}, [isMicOn])

	return (
		<div className='vrx-active-shell font-sans'>
			{/* Transcript area — no duplicate top header; TopBar handles mode heading */}
			<div className='relative flex min-h-0 flex-1 flex-col'>
				<div className='relative flex min-h-0 flex-1 flex-col items-center justify-center px-[24px] pt-[20px]'>
					<div
						className='pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[60px]'
						aria-hidden='true'
						style={{background: 'linear-gradient(to top, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0) 100%)'}}
					/>
					<div className='vrx-scroll w-full overflow-y-auto transition-[filter,opacity] duration-300' ref={scrollRef} style={{scrollbarWidth: 'none', maxHeight: 320}}>
						{hasTranscript ? (
							<div className='flex flex-col items-center text-center' style={{animation: 'vrxTextIn 420ms ease-out both'}}>
								<p className='whitespace-pre-wrap break-words font-normal text-[20px] leading-[1.75] tracking-[-0.01em]' style={{color: 'var(--tp-slate-400)'}}>
									{transcript}
									{isMicOn ? <span className='vrx-caret' aria-hidden='true'/> : null}
								</p>
							</div>
						) : (
							<div className='flex flex-col items-center justify-center text-center' style={{animation: 'vrxTextIn 420ms ease-out both'}}>
								<p className='font-light text-[16px] leading-[1.6]' style={{color: 'rgba(162, 162, 168, 0.6)'}}>
									{isMicOn ? 'Listening...' : 'Start speaking, you\'ll see the transcript here'}
								</p>
							</div>
						)}
					</div>
				</div>

				{/* Bottom block — Siri waveform, controls, listening status card */}
				<div className='vrx-bottom-block-active'>
					{error ? (
						<div className='mx-auto mb-2 flex max-w-[480px] items-start gap-2 rounded-[10px] border px-3 py-2 text-[12px]' style={{borderColor: 'var(--tp-warning-200, #FDE68A)', background: 'var(--tp-warning-50, #FFFBEB)', color: 'var(--tp-warning-700, #B45309)'}}>
							<span>⚠</span>
							<div className='flex-1'>
								<div className='font-semibold'>{error.title}</div>
								<div style={{color: 'var(--tp-slate-600)'}}>{error.message}</div>
							</div>
						</div>
					) : null}

					<div className='relative mx-auto' style={{maxWidth: 540, marginTop: 28, marginBottom: 14}}>
						<div className='flex min-w-0 flex-1 gap-0 py-1 sm:px-2 relative px-0 opacity-75 h-[56px] min-h-[56px]' aria-hidden='true'>
							<VoiceRxSiriWaveform stream={micStream} paused={!isMicOn}/>
						</div>
					</div>

					<div className='relative z-10 flex items-center justify-center gap-[14px] pb-[24px] pt-[14px]'>
						{/* Close (red) */}
						<Tooltip label='End consultation'>
							<button
								type='button'
								aria-label='End voice consultation'
								onClick={onCancel}
								className='vrx-lg-btn vrx-close-btn group relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] transition-transform active:scale-[0.94]'
							>
								<span className='vrx-lg-surface' aria-hidden='true'/>
								<span className='vrx-lg-sheen' aria-hidden='true'/>
								<svg width='24' height='24' viewBox='0 0 24 24' fill='none' className='relative text-[#DC2626] transition-colors'>
									<path d='M18 6L6 18' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
									<path d='M6 6L18 18' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
								</svg>
							</button>
						</Tooltip>

						<span className='vrx-cta-divider' aria-hidden='true'/>

						{/* Mic + chevron device picker */}
						<div className='flex items-center gap-[12px]'>
							<div className='relative' ref={micMenuRef}>
								<div className="vrx-lg-btn relative flex h-[42px] items-stretch overflow-hidden rounded-full transition-opacity">
									<span className="vrx-lg-surface" aria-hidden="true"></span>
									<span className="vrx-lg-sheen" aria-hidden="true"></span>
									<button 
										type="button" 
										aria-label={isMicOn ? "Mute microphone" : "Start microphone"} 
										aria-pressed={isMicOn}
										onClick={onToggleMic}
										className={`relative flex h-full w-[44px] items-center justify-center transition-transform active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-60 ${
											!isMicOn ? 'text-tp-warning-700' : 'text-tp-slate-500'
										}`}
									>
										<span className="relative inline-flex h-[24px] w-[24px] items-center justify-center">
											{!isMicOn ? (
												<MicrophoneSlash size="24" variant="Bulk" color="currentColor" />
											) : (
												<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
													<path opacity="0.4" d="M19.12 9.12c-.39 0-.7.31-.7.7v1.58c0 3.54-2.88 6.42-6.42 6.42s-6.42-2.88-6.42-6.42V9.81c0-.39-.31-.7-.7-.7-.39 0-.7.31-.7.7v1.58c0 4.07 3.13 7.42 7.12 7.78v2.13c0 .39.31.7.7.7.39 0 .7-.31.7-.7v-2.13c3.98-.35 7.12-3.71 7.12-7.78V9.81a.707.707 0 0 0-.7-.69Z"></path>
													<path d="M12 2c-2.44 0-4.42 1.98-4.42 4.42v5.12c0 2.44 1.98 4.42 4.42 4.42s4.42-1.98 4.42-4.42V6.42C16.42 3.98 14.44 2 12 2Zm1.31 6.95c-.07.26-.3.43-.56.43-.05 0-.1-.01-.15-.02-.39-.11-.8-.11-1.19 0-.32.09-.63-.1-.71-.41-.09-.31.1-.63.41-.71.59-.16 1.21-.16 1.8 0 .3.08.48.4.4.71Zm.53-1.94c-.09.24-.31.38-.55.38-.07 0-.14-.01-.2-.03-.69-.26-1.47-.26-2.17 0-.3.11-.63-.05-.74-.35-.11-.3.05-.63.35-.74.97-.35 2.03-.35 3 0 .3.11.46.44.31.74Z"></path>
												</svg>
											)}
										</span>
									</button>
									<div className="vrx-lg-divider" aria-hidden="true"></div>
									<button 
										type="button" 
										aria-label="Choose microphone" 
										onClick={() => setShowMicMenu(!showMicMenu)}
										className="relative flex h-full w-[28px] items-center justify-center text-tp-slate-500 transition-transform hover:text-tp-slate-700 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
									>
										<ChevronDown className={`h-4 w-4 transition-transform duration-200 ${showMicMenu ? 'rotate-180' : ''}`} />
									</button>
								</div>

								{showMicMenu ? (
									<div className='absolute bottom-[calc(100%+8px)] left-0 w-[240px] rounded-[14px] bg-white p-[6px] shadow-[0_8px_30px_rgba(15,23,42,0.12)] border border-tp-slate-200 origin-bottom-left animate-in fade-in slide-in-from-bottom-2 duration-100 z-50 text-left'>
										<div className='px-2 py-[6px] text-[10px] font-semibold uppercase tracking-wider text-tp-slate-400'>
											Available Microphones
										</div>
										<div className='max-h-[200px] overflow-y-auto'>
											{micOptions.map(mic => (
												<button
													key={mic.deviceId}
													type='button'
													className={`flex w-full items-center gap-[8px] rounded-[8px] px-[10px] py-[8px] text-[13px] transition-colors text-left ${mic.deviceId === selectedMic ? 'bg-tp-blue-50 text-tp-blue-700 font-medium' : 'text-tp-slate-700 hover:bg-tp-slate-50'}`}
													onClick={() => {
														setSelectedMic(mic.deviceId)
														setShowMicMenu(false)
													}}
												>
													<Mic className='h-[14px] w-[14px] shrink-0' />
													<span className='truncate'>{mic.label || 'Default Microphone'}</span>
												</button>
											))}
											{micOptions.length === 0 && (
												<div className='px-2 py-2 text-[12px] text-tp-slate-500'>No microphones found</div>
											)}
										</div>
									</div>
								) : null}
							</div>
						</div>

						<span className='vrx-cta-divider' aria-hidden='true'/>

						{/* Submit hero — gradient pill with sheen sweep */}
						<Tooltip label='Submit consultation'>
							<button
								type='button'
								aria-label='Submit consultation'
								onClick={onSubmit}
								disabled={isSubmitting}
								className={`vrx-submit-hero group relative flex h-[42px] items-center gap-[8px] overflow-hidden rounded-[12px] pl-[18px] pr-[22px] text-white transition-transform ${isSubmitting ? 'vrx-submit-dim cursor-not-allowed' : 'active:scale-[0.98]'}`}
							>
								<span className='vrx-submit-gradient absolute inset-0 rounded-[inherit]' aria-hidden='true'/>
								<span
									className='pointer-events-none absolute inset-x-0 top-0 h-[55%] rounded-[inherit]'
									aria-hidden='true'
									style={{background: 'linear-gradient(rgba(255, 255, 255, 0.32) 0%, rgba(255, 255, 255, 0) 100%)'}}
								/>
								{!isSubmitting ? <span className='vrx-submit-sheen pointer-events-none absolute inset-y-0 left-0 z-0 w-[40%]' aria-hidden='true'/> : null}
								<span className='relative z-[1] flex items-center gap-[8px]'>
									{isSubmitting ? (
										<svg className="animate-spin h-[20px] w-[20px] text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
											<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
											<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
									) : (
										<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
									)}
									<span className='font-semibold tracking-[0.2px] text-[14px]'>{isSubmitting ? 'Processing...' : 'Submit'}</span>
								</span>
							</button>
						</Tooltip>
					</div>

					{/* Listening status card — always anchored at bottom */}
					<div className='flex items-end justify-center pt-[8px]'>
						<div
							className={`vrx-status-card relative inline-flex items-center gap-[8px] rounded-t-[12px] rounded-b-none pl-[12px] pr-[14px] pt-[7px] pb-[10px] backdrop-blur-[10px] transition-all duration-200 ${!isMicOn ? 'vrx-status-card--paused' : ''}`}
							role='status'
							aria-live='polite'
							style={{background: 'rgba(255, 255, 255, 0.6)'}}
						>
							<span className='relative inline-flex h-[10px] w-[10px] items-center justify-center'>
								<span className='absolute inset-0 rounded-full' style={{background: isMicOn ? '#fb7185' : '#facc15'}}/>
								{isMicOn ? <span className='absolute inset-0 rounded-full' style={{background: 'rgba(251,113,133,0.55)', animation: 'vrxRecRing 1.8s ease-out infinite'}}/> : null}
							</span>
							<span className='text-[14px] font-medium tracking-[-0.05px] leading-none tabular-nums' style={{color: 'var(--tp-slate-600)'}}>
								{isMicOn ? 'Listening' : 'Paused'}
								<span className='ml-[6px] font-normal' style={{color: 'var(--tp-slate-400)'}}>({formatElapsed(elapsed)})</span>
							</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

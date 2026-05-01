import {useEffect, useState} from 'react'
import {Clock, Trash2, X} from 'lucide-react'

function formatDate(iso) {
	try {
		const d = new Date(iso)
		return d.toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'}) +
			' · ' + d.toLocaleTimeString('en-IN', {hour: '2-digit', minute: '2-digit'})
	} catch {
		return iso
	}
}

export function SessionHistoryPanel({open, onClose, onLoadSession}) {
	const [isMounted, setIsMounted] = useState(open)
	const [isVisible, setIsVisible] = useState(open)
	const [sessions, setSessions] = useState([])

	useEffect(() => {
		if (open) {
			setIsMounted(true)
			const raw = window.localStorage.getItem('voicerx-sessions')
			setSessions(raw ? JSON.parse(raw) : [])
			const frameId = window.requestAnimationFrame(() => setIsVisible(true))
			return () => window.cancelAnimationFrame(frameId)
		}
		setIsVisible(false)
		const t = window.setTimeout(() => setIsMounted(false), 300)
		return () => window.clearTimeout(t)
	}, [open])

	useEffect(() => {
		if (!isMounted) return
		const onKey = (e) => { if (e.key === 'Escape') onClose() }
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [isMounted, onClose])

	function handleDelete(id) {
		const next = sessions.filter((s) => s.id !== id)
		setSessions(next)
		window.localStorage.setItem('voicerx-sessions', JSON.stringify(next))
	}

	if (!isMounted) return null

	return (
		<>
			{/* Dimming backdrop */}
			<div
				aria-hidden
				onClick={onClose}
				className={`fixed inset-0 z-[100] bg-black/30 backdrop-blur-[2px] transition-opacity duration-200 ${isVisible ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
			/>

			{/* Slide-in panel */}
			<aside
				role='dialog'
				aria-label='Session history'
				aria-hidden={!isVisible}
				className={`fixed right-0 top-0 z-[101] flex h-full w-[420px] max-w-[94vw] flex-col bg-white shadow-[-12px_0_40px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${isVisible ? 'translate-x-0' : 'translate-x-full'}`}
			>
				<header className='flex h-[56px] shrink-0 items-center gap-3 border-b px-[16px]' style={{borderColor: 'var(--tp-slate-100)'}}>
					<button
						type='button'
						onClick={onClose}
						aria-label='Close history'
						className='flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] transition-colors hover:bg-[#f1f1f5] active:scale-[0.96]'
						style={{color: 'var(--tp-slate-700)'}}
					>
						<X className='h-5 w-5'/>
					</button>
					<span aria-hidden className='h-[24px] w-px shrink-0' style={{background: 'var(--tp-slate-200)'}}/>
					<div className='flex items-center gap-2'>
						<Clock className='h-[18px] w-[18px]' style={{color: 'var(--tp-violet-500)'}}/>
						<h3 className='truncate text-[16px] font-semibold tracking-[-0.1px]' style={{color: 'var(--tp-slate-800)'}}>Session History</h3>
					</div>
				</header>

				<div className='min-h-0 flex-1 overflow-y-auto px-[16px] py-[12px]'>
					{sessions.length === 0 ? (
						<div className='flex flex-col items-center justify-center py-16 text-center'>
							<Clock className='h-10 w-10 mb-3' style={{color: 'var(--tp-slate-300)'}}/>
							<p className='text-[14px] font-medium' style={{color: 'var(--tp-slate-500)'}}>No sessions yet</p>
							<p className='text-[12px] mt-1' style={{color: 'var(--tp-slate-400)'}}>Completed consultations will appear here</p>
						</div>
					) : (
						<div className='flex flex-col gap-[8px]'>
							{sessions.map((s) => (
								<button
									key={s.id}
									type='button'
									onClick={() => onLoadSession(s)}
									className='group relative flex flex-col gap-[4px] rounded-[12px] border p-[12px] text-left transition-all hover:shadow-sm active:scale-[0.995]'
									style={{borderColor: 'var(--tp-slate-100)', background: 'var(--tp-slate-50, #fafafa)'}}
								>
									<div className='flex items-center justify-between w-full'>
										<span className='inline-flex items-center gap-[6px]'>
											<span className='rounded-[6px] px-[6px] py-[2px] text-[11px] font-semibold' style={{
												background: s.mode === 'dictate' ? 'rgba(103,58,172,0.08)' : 'rgba(75,74,213,0.08)',
												color: s.mode === 'dictate' ? 'var(--tp-violet-600)' : 'var(--tp-blue-600)'
											}}>
												{s.mode === 'dictate' ? 'Dictation' : 'Conversation'}
											</span>
										</span>
										<button
											type='button'
											onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
											className='opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-[6px] transition-all hover:bg-red-50'
											style={{color: 'var(--tp-error-500)'}}
											aria-label='Delete session'
										>
											<Trash2 className='h-3.5 w-3.5'/>
										</button>
									</div>
									<span className='text-[12px]' style={{color: 'var(--tp-slate-400)'}}>{formatDate(s.date)}</span>
									<p className='text-[13px] leading-[1.5] line-clamp-2 mt-[2px]' style={{color: 'var(--tp-slate-600)'}}>
										{s.transcriptPreview || 'No transcript'}
									</p>
								</button>
							))}
						</div>
					)}
				</div>
			</aside>
		</>
	)
}

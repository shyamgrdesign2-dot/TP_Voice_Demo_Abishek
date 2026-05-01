import {ChevronLeft, Clock, LogOut, AlertTriangle, User, ChevronDown} from 'lucide-react'
import {useState, useRef, useEffect} from 'react'
import {Tooltip} from './Tooltip.jsx'
import {getModeLabel} from './ModePickerSheet.jsx'

export function TopBar({sessionStatus, onLogout, onSessionHistory, onBack, activeMode, title}) {
	const statusLabel =
		sessionStatus === 'ready' ? 'Connected'
		: sessionStatus === 'error' ? 'Disconnected'
		: 'Connecting'

	const statusDotClass =
		sessionStatus === 'ready' ? 'tp-status-dot-ready'
		: sessionStatus === 'error' ? 'tp-status-dot-error'
		: 'tp-status-dot-connecting'

	const modeLabel = activeMode === 'dictate' ? 'Dictation Mode'
		: activeMode === 'conversation' ? 'Conversation Mode'
		: null

	const [showProfileMenu, setShowProfileMenu] = useState(false)
	const menuRef = useRef(null)

	useEffect(() => {
		if (!showProfileMenu) return
		const handler = (e) => {
			if (!menuRef.current?.contains(e.target)) setShowProfileMenu(false)
		}
		window.addEventListener('mousedown', handler)
		return () => window.removeEventListener('mousedown', handler)
	}, [showProfileMenu])

	return (
		<div className='pointer-events-none sticky top-0 z-30'>
			<div className='relative z-20'>
				<div className='relative flex items-center justify-between px-[14px]' style={{height: 56, background: 'transparent'}}>
					<div className='pointer-events-auto relative z-10 flex items-center gap-[8px]'>
						{/* Mode-aware heading or custom Title */}
						{title ? (
							<span
								className='vrx-mode-heading relative flex items-center gap-[8px] rounded-[10px] px-[8px] py-[6px]'
								style={{animation: 'vrxChipIn 320ms cubic-bezier(0.16, 1, 0.3, 1) both'}}
							>
								{onBack && (
									<button
										type='button'
										aria-label='Go back'
										onClick={onBack}
										className='relative inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center bg-transparent transition-colors active:scale-[0.92]'
										style={{color: 'var(--tp-slate-700)'}}
									>
										<ChevronLeft className='h-4 w-4'/>
									</button>
								)}
								<span className='text-[14px] font-semibold leading-none' style={{color: 'var(--tp-slate-700)', letterSpacing: '0.1px'}}>{title}</span>
							</span>
						) : modeLabel ? (
							<span
								className='vrx-mode-heading relative flex items-center gap-[4px] rounded-[10px] px-[8px] py-[6px]'
								style={{animation: 'vrxChipIn 320ms cubic-bezier(0.16, 1, 0.3, 1) both'}}
							>
								{onBack && (
									<button
										type='button'
										aria-label='Go back'
										onClick={onBack}
										className='relative inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center bg-transparent transition-colors active:scale-[0.92]'
										style={{color: 'var(--tp-slate-700)'}}
									>
										<ChevronLeft className='h-4 w-4'/>
									</button>
								)}
								<span className='text-[14px] font-semibold leading-none' style={{color: 'var(--tp-slate-700)', letterSpacing: '0.1px'}}>{modeLabel}</span>
							</span>
						) : (
							<span className='vrx-agent-brand-tag relative flex items-center gap-[8px] rounded-[10px] p-[6px] pr-[8px]'>
								<span className='relative inline-flex h-[24px] w-[24px] shrink-0 items-center justify-center overflow-hidden' aria-hidden='true' style={{borderRadius: 8}}>
									<img alt='' draggable={false} className='absolute inset-0 h-full w-full object-cover' src='/icons/dr-agent/agent-bg.svg'/>
									<img alt='' draggable={false} className='relative z-10' width='14' height='14' src='/icons/dr-agent/agent-spark.svg'/>
								</span>
								<span className='text-[14px] font-semibold leading-none' style={{color: 'var(--tp-slate-700)', letterSpacing: '0.1px'}}>VoiceRx</span>
							</span>
						)}
					</div>

					<div className='pointer-events-auto flex items-center gap-[10px]'>
						<span className='vrx-status-pill hidden sm:flex' style={{background: sessionStatus === 'ready' ? 'var(--tp-success-50, #ECFDF5)' : undefined}}>
							<span className={`tp-status-dot ${statusDotClass}`}/>
							<span>{statusLabel}</span>
						</span>
						
						<Tooltip label='Session history'>
							<button
								type='button'
								className='bg-[#f1f1f5] content-stretch flex h-[42px] w-[42px] items-center justify-center relative rounded-[10px] shrink-0 transition-colors hover:bg-[#e9e9ef]'
								onClick={onSessionHistory}
								aria-label='Session history'
							>
								<Clock className='h-[20px] w-[20px] text-[#454551]'/>
							</button>
						</Tooltip>
						
						<div className='relative' ref={menuRef}>
							<Tooltip label='User Profile'>
								<button
									type='button'
									className='bg-[#f1f1f5] relative rounded-[1250px] shrink-0 h-[40px] w-[40px] transition-colors hover:bg-[#e9e9ef]'
									onClick={() => setShowProfileMenu(v => !v)}
									aria-label='User Profile'
								>
									<div className="absolute left-[8.57px] top-[8.57px] h-[22.857px] w-[22.857px]" aria-hidden="true">
										<svg xmlns="http://www.w3.org/2000/svg" width="22.857" height="22.857" viewBox="0 0 24 24" fill="none">
											<path opacity=".4" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" fill="#545460"></path>
											<path d="M12 14.5c-5.01 0-9.09 3.36-9.09 7.5 0 .28.22.5.5.5h17.18c.28 0 .5-.22.5-.5 0-4.14-4.08-7.5-9.09-7.5Z" fill="#545460"></path>
										</svg>
									</div>
								</button>
							</Tooltip>
							
							{showProfileMenu ? (
								<div className='absolute right-0 top-full mt-[8px] w-[220px] rounded-[14px] bg-white p-[6px] shadow-[0_8px_30px_rgba(15,23,42,0.12)] border border-tp-slate-200 origin-top-right animate-in fade-in zoom-in-95 duration-100 z-50'>
									<div className='flex items-center gap-[10px] p-[10px] mb-[4px] bg-tp-slate-50 rounded-[10px]'>
										<div className='flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[8px] bg-tp-blue-100 text-tp-blue-700 font-bold'>
											Dr
										</div>
										<div className='min-w-0'>
											<div className='text-[14px] font-semibold text-tp-slate-800 truncate'>Dr. Admin</div>
											<div className='text-[12px] text-tp-slate-500 truncate'>admin@tpclinic.com</div>
										</div>
									</div>
									<div className='h-px bg-tp-slate-100 my-[2px]'/>
									<button
										type='button'
										className='flex w-full items-center gap-[8px] rounded-[8px] px-[10px] py-[8px] text-[13px] font-medium text-tp-error-600 transition-colors hover:bg-red-50 text-left'
										onClick={() => {
											setShowProfileMenu(false)
											onLogout()
										}}
									>
										<LogOut className='h-[16px] w-[16px]'/>
										Log out
									</button>
								</div>
							) : null}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export function ErrorBanner({kind, message, onRetry, onDismiss}) {
	if (!kind) return null
	return (
		<div className='vrx-error-banner'>
			<AlertTriangle className='h-4 w-4 shrink-0' style={{color: 'var(--tp-warning-600, #D97706)'}}/>
			<div className='min-w-0 flex-1'>
				<div className='text-[12px] font-semibold' style={{color: 'var(--tp-slate-800)'}}>{kind}</div>
				<div className='text-[12px] leading-[1.5]' style={{color: 'var(--tp-slate-600)'}}>{message}</div>
			</div>
			<div className='flex shrink-0 gap-1'>
				{onRetry ? <button type='button' className='vrx-error-btn' onClick={onRetry}>Retry</button> : null}
				{onDismiss ? <button type='button' className='vrx-error-btn' onClick={onDismiss}>Dismiss</button> : null}
			</div>
		</div>
	)
}

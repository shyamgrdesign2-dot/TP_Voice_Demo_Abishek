import {useId, useState} from 'react'
import {Info} from 'lucide-react'
import {VoiceConsultKindIcon, VoiceRxIcon} from './voice-consult-icons.jsx'

const SHEET_LABELS = {
	ambient_consultation: 'Conversation Mode',
	dictation_consultation: 'Dictation Mode'
}

function HeaderCloseIcon({size = 24, color = 'currentColor'}) {
	return (
		<svg width={size} height={size} viewBox='0 0 24 24' fill={color} xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>
			<path d='M16.19 2H7.81C4.17 2 2 4.17 2 7.81V16.18C2 19.83 4.17 22 7.81 22H16.18C19.82 22 21.99 19.83 21.99 16.19V7.81C22 4.17 19.83 2 16.19 2ZM15.36 14.3C15.65 14.59 15.65 15.07 15.36 15.36C15.21 15.51 15.02 15.58 14.83 15.58C14.64 15.58 14.45 15.51 14.3 15.36L12 13.06L9.7 15.36C9.55 15.51 9.36 15.58 9.17 15.58C8.98 15.58 8.79 15.51 8.64 15.36C8.35 15.07 8.35 14.59 8.64 14.3L10.94 12L8.64 9.7C8.35 9.41 8.35 8.93 8.64 8.64C8.93 8.35 9.41 8.35 9.7 8.64L12 10.94L14.3 8.64C14.59 8.35 15.07 8.35 15.36 8.64C15.65 8.93 15.65 9.41 15.36 9.7L13.06 12L15.36 14.3Z' fill={color}/>
		</svg>
	)
}

const CONSULT_OPTIONS = [
	{value: 'ambient_consultation', description: 'Captures the live doctor-patient conversation in real time.'},
	{value: 'dictation_consultation', description: 'Captures only your narrated clinical notes.'}
]

export function ModePickerSheet({open, onPick, onClose}) {
	const [selected, setSelected] = useState('ambient_consultation')
	const [consent, setConsent] = useState(true)
	const uid = useId()

	if (!open) return null

	const canStart = consent
	const startLabel = selected === 'ambient_consultation' ? 'Start conversation' : 'Start dictation'

	return (
		<div className='absolute inset-0 z-[100] flex flex-col justify-end'>
			<div
				className='absolute inset-0'
				onClick={onClose}
				style={{background: 'rgba(15,23,42,0.45)', animation: 'docFadeIn 150ms ease-out'}}
			/>

			<div
				className='relative z-10 mx-auto flex h-auto w-full max-w-[460px] flex-col overflow-hidden rounded-t-[20px] bg-white pb-6 shadow-2xl'
				style={{animation: 'docSlideUp 220ms cubic-bezier(0.22,1,0.36,1)'}}
			>
				<div className='flex justify-center pt-[8px] pb-[4px]'>
					<span className='h-[4px] w-[40px] rounded-full' style={{background: 'var(--tp-slate-200)'}} aria-hidden='true'/>
				</div>

				<div className='flex items-start justify-between border-b px-[16px] pb-[12px] pt-[8px]' style={{borderColor: 'var(--tp-slate-100)'}}>
					<div className='min-w-0'>
						<h3 className='inline-flex items-center gap-1.5 text-[16px] font-semibold leading-tight' style={{color: 'var(--tp-slate-900)'}}>
							Choose a consultation mode
							<span
								tabIndex={0}
								className='inline-flex h-5 w-5 items-center justify-center rounded-full align-middle'
								style={{color: 'var(--tp-slate-400)'}}
								title='Conversation captures the live doctor-patient discussion. Dictation captures only your narrated notes.'
								aria-label='Consultation mode information'
							>
								<Info className='h-[13px] w-[13px]' strokeWidth={2.2}/>
							</span>
						</h3>
					</div>
					<button
						type='button'
						onClick={onClose}
						aria-label='Close'
						className='-mt-[2px] flex items-center justify-center transition-colors active:scale-[0.95]'
						style={{color: 'var(--tp-slate-700)'}}
					>
						<HeaderCloseIcon size={26} color='currentColor'/>
					</button>
				</div>

				<div className='flex flex-col gap-[10px] px-[16px] pt-[12px]'>
					{CONSULT_OPTIONS.map((opt) => {
						const isSelected = selected === opt.value
						const showConsent = opt.value === 'ambient_consultation' && isSelected
						return (
							<div
								key={opt.value}
								className={`vrx-option-card overflow-hidden rounded-[14px] transition-[background] duration-200 ${isSelected ? 'vrx-option-card--selected' : 'vrx-option-card--idle'}`}
							>
								<div
									role='button'
									tabIndex={0}
									onClick={() => setSelected(opt.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault()
											setSelected(opt.value)
										}
									}}
									aria-pressed={isSelected}
									className='flex w-full cursor-pointer items-center gap-0 px-[12px] py-[10px] text-left'
								>
									<span className={`vrx-option-tile ${isSelected ? 'vrx-option-tile--selected' : ''}`} aria-hidden='true'>
										<VoiceConsultKindIcon kind={opt.value} size={28} gradientId={`${uid}-${opt.value}-grad`}/>
									</span>

									<span className='ml-[12px] min-w-0 flex-1'>
										<span
											className={`block text-[14px] leading-tight transition-colors ${isSelected ? 'font-semibold' : 'font-medium'}`}
											style={{color: isSelected ? 'var(--tp-blue-600)' : 'var(--tp-slate-700)'}}
										>
											{SHEET_LABELS[opt.value]}
										</span>
									</span>

									<span
										className='flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-colors'
										style={{
											border: `1.5px solid ${isSelected ? 'var(--tp-blue-500)' : 'var(--tp-slate-300)'}`
										}}
										aria-hidden='true'
									>
										{isSelected ? <span className='h-[8px] w-[8px] rounded-full' style={{background: 'var(--tp-blue-500)'}}/> : null}
									</span>
								</div>

								{showConsent ? (
									<label
										onClick={(e) => e.stopPropagation()}
										className='vrx-consent-pill mx-[12px] mb-[12px] mt-[6px] flex cursor-pointer items-center gap-[8px] rounded-[10px] px-[10px] py-[8px] text-left'
										style={{animation: 'docFadeIn 180ms ease-out'}}
									>
										<span className='relative flex h-[16px] w-[16px] shrink-0 items-center justify-center'>
											<input
												type='checkbox'
												checked={consent}
												onChange={(e) => setConsent(e.target.checked)}
												onClick={(e) => e.stopPropagation()}
												className='peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0'
												aria-label='Patient consent'
											/>
											<span
												className='pointer-events-none flex h-[16px] w-[16px] items-center justify-center rounded-[4px] transition-colors'
												style={{
													border: `1.5px solid ${consent ? 'var(--tp-blue-500)' : 'var(--tp-blue-300)'}`,
													background: consent ? 'var(--tp-blue-500)' : '#fff'
												}}
											>
												{consent ? (
													<svg width='10' height='10' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
														<path d='M20 6L9 17L4 12' stroke='#FFFFFF' strokeWidth={3} strokeLinecap='round' strokeLinejoin='round'/>
													</svg>
												) : null}
											</span>
										</span>
										<span className='min-w-0 flex-1 text-[12px] leading-[1.4]' style={{color: 'var(--tp-blue-700)'}}>
											Patient consents to this session being recorded.
										</span>
									</label>
								) : null}
							</div>
						)
					})}
				</div>

				<div className='px-[16px] pb-[16px] pt-[12px]'>
					<button
						type='button'
						onClick={() => canStart && onPick(selected === 'ambient_consultation' ? 'conversation' : 'dictate')}
						disabled={!canStart}
						aria-label={startLabel}
						className={`vrx-ai-cta relative flex w-full items-center justify-center gap-[10px] overflow-hidden rounded-[12px] px-[18px] transition-all ${canStart ? 'text-white hover:brightness-105 active:scale-[0.98]' : 'cursor-not-allowed'}`}
						style={{
							height: 48,
							background: canStart
								? 'linear-gradient(135deg, #D565EA 0%, #673AAC 50%, #1A1994 100%)'
								: 'var(--tp-slate-100)',
							color: canStart ? '#fff' : 'var(--tp-slate-400)',
							boxShadow: canStart
								? '0 8px 22px -10px rgba(103, 58, 172, 0.55), 0 2px 6px -3px rgba(26, 25, 148, 0.35), inset 0 1px 0 rgba(255,255,255,0.32)'
								: undefined
						}}
					>
						{canStart ? (
							<span aria-hidden='true' className='vrx-ai-cta-sheen pointer-events-none absolute inset-y-0 left-0 z-0 w-[40%]'/>
						) : null}
						<VoiceRxIcon size={24} color={canStart ? '#FFFFFF' : '#94A3B8'} className='relative z-[1] shrink-0'/>
						<span className='relative z-[1] text-[14px] font-semibold tracking-[0.2px]'>{startLabel}</span>
					</button>
				</div>
			</div>
		</div>
	)
}

export function getModeLabel(modeId) {
	if (modeId === 'conversation') return 'Conversation Mode'
	return 'Dictation Mode'
}

function VoiceRxIcon({size = 32, color = '#FFFFFF', className = ''}) {
	return (
		<svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
			<path d="M6.2865 17.7156C5.75939 17.7156 5.32227 17.2785 5.32227 16.7514V11.236C5.32227 10.7088 5.75939 10.2717 6.2865 10.2717C6.81362 10.2717 7.25074 10.7088 7.25074 11.236V16.7514C7.25074 17.2914 6.81362 17.7156 6.2865 17.7156Z" fill={color}/>
			<path d="M10.1434 19.5539C9.61632 19.5539 9.1792 19.1168 9.1792 18.5897V9.41015C9.1792 8.88303 9.61632 8.44591 10.1434 8.44591C10.6706 8.44591 11.1077 8.88303 11.1077 9.41015V18.5897C11.1077 19.1297 10.6706 19.5539 10.1434 19.5539Z" fill={color}/>
			<path d="M14.0004 21.3924C13.4733 21.3924 13.0361 20.9553 13.0361 20.4281V7.57166C13.0361 7.04454 13.4733 6.60742 14.0004 6.60742C14.5275 6.60742 14.9646 7.04454 14.9646 7.57166V20.4281C14.9646 20.9553 14.5275 21.3924 14.0004 21.3924Z" fill={color}/>
			<path d="M17.8574 19.5539C17.3303 19.5539 16.8932 19.1168 16.8932 18.5897V9.41015C16.8932 8.88303 17.3303 8.44591 17.8574 8.44591C18.3845 8.44591 18.8216 8.88303 18.8216 9.41015V18.5897C18.8216 19.1297 18.3845 19.5539 17.8574 19.5539Z" fill={color}/>
			<path d="M21.7142 17.7156C21.1871 17.7156 20.75 17.2785 20.75 16.7514V11.236C20.75 10.7088 21.1871 10.2717 21.7142 10.2717C22.2414 10.2717 22.6785 10.7088 22.6785 11.236V16.7514C22.6785 17.2914 22.2414 17.7156 21.7142 17.7156Z" fill={color}/>
		</svg>
	)
}

function greeting() {
	const h = new Date().getHours()
	if (h < 12) return 'Good morning'
	if (h < 17) return 'Good afternoon'
	return 'Good evening'
}

export function WelcomeView({onStart}) {
	return (
		<div className='vrx-welcome-zone'>
			<div className='flex flex-1 flex-col items-center justify-center w-full'>
				<div className='relative z-[1] mb-[24px]'>
					<span
						className='pointer-events-none select-none relative inline-flex items-center justify-center overflow-hidden'
						style={{width: 76, height: 76, borderRadius: 20}}
						aria-hidden='true'
					>
						<div className='absolute inset-0 bg-white' style={{borderRadius: 20}}/>
						<div
							className='absolute inset-0'
							style={{
								backgroundImage: 'url(/icons/dr-agent/chat-bg.gif)',
								backgroundSize: 'cover',
								backgroundPosition: 'center',
								borderRadius: 20,
								opacity: 0.32
							}}
						/>
						<img
							src='/icons/dr-agent/agent-spark.svg'
							width={52}
							height={52}
							alt=''
							className='relative z-10 vrx-empty-spark-rotate'
							draggable={false}
						/>
					</span>
				</div>

				<h2 className='relative z-[1] font-display text-[28px] sm:text-[32px] font-semibold text-center leading-[1.18] tracking-tight' style={{color: 'var(--tp-slate-800, #2C2C35)'}}>
					{greeting()}, Doctor!
				</h2>
				<p
					className='relative z-[1] mt-[14px] max-w-[440px] text-[16px] sm:text-[17px] text-center leading-[1.55]'
					style={{color: 'var(--tp-slate-500, #717179)'}}
				>
					Start your consultation by{' '}
					<span className='font-semibold' style={{color: 'var(--tp-slate-700, #454551)'}}>dictating</span>
					{' '}or having a{' '}
					<span className='font-semibold' style={{color: 'var(--tp-slate-700, #454551)'}}>natural conversation</span>
					{' '}with the patient.
				</p>

				<div className='relative z-[1] mt-[44px] w-full max-w-[360px]'>
					<button
						type='button'
						onClick={onStart}
						className='vrx-ai-cta relative flex w-full items-center justify-center gap-[10px] h-[52px] overflow-hidden rounded-[14px] px-[18px] text-[15px] font-bold tracking-wide text-white transition-all hover:brightness-105 active:scale-[0.98]'
						style={{
							background: 'linear-gradient(135deg, #D565EA 0%, #673AAC 55%, #1A1994 100%)',
							boxShadow: '0 14px 36px -16px rgba(103, 58, 172, 0.65), inset 0 1px 0 rgba(255,255,255,0.32)'
						}}
					>
						<span aria-hidden='true' className='vrx-ai-cta-sheen pointer-events-none absolute inset-y-0 left-0 z-0 w-[40%]'/>
						<VoiceRxIcon size={28} className='relative z-[1]'/>
						<span className='relative z-[1]'>Start with Voice</span>
					</button>
				</div>
			</div>
		</div>
	)
}

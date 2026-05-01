import {ShieldCheck} from 'lucide-react'

export function LoginView({
	username,
	password,
	error,
	demoUsername,
	demoPassword,
	setUsername,
	setPassword,
	onSubmit
}) {
	return (
		<main className='tp-login-shell'>
			<section className='tp-login-card'>
				<div className='tp-login-mark'>
					<ShieldCheck className='h-6 w-6'/>
				</div>

				<div>
					<div className='text-xs font-semibold uppercase tracking-wider' style={{color: 'var(--tp-blue-600)'}}>
						Tatva Practise
					</div>
					<h1 className='mt-2 font-display text-3xl font-semibold' style={{color: 'var(--tp-slate-900)'}}>
						Welcome back
					</h1>
					<p className='mt-2 text-sm' style={{color: 'var(--tp-slate-500)'}}>
						Sign in to continue to VoiceRx.
					</p>
				</div>

				<form className='mt-7 space-y-4' onSubmit={onSubmit}>
					<div>
						<label className='tp-label'>Username</label>
						<input
							className='tp-input'
							value={username}
							autoComplete='username'
							placeholder='Enter username'
							onChange={(event) => setUsername(event.target.value)}
						/>
					</div>

					<div>
						<label className='tp-label'>Password</label>
						<input
							className='tp-input'
							type='password'
							value={password}
							autoComplete='current-password'
							placeholder='Enter password'
							onChange={(event) => setPassword(event.target.value)}
						/>
					</div>

					{error ? <div className='tp-login-error'>{error}</div> : null}

					<button type='submit' className='tp-btn-primary w-full !py-3'>
						Sign in
					</button>
				</form>

				<div className='tp-login-demo'>
					<div>Demo username: <strong>{demoUsername}</strong></div>
					<div>Demo password: <strong>{demoPassword}</strong></div>
				</div>
			</section>
		</main>
	)
}

import {ActivityHandling, EndSensitivity, StartSensitivity, ThinkingLevel} from '@google/genai'
import {startTransition, useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {LoginView} from './components/LoginView.jsx'
import {TopBar, ErrorBanner} from './components/TopBar.jsx'
import {WelcomeView} from './components/WelcomeView.jsx'
import {ModePickerSheet} from './components/ModePickerSheet.jsx'
import {DictationView} from './components/DictationView.jsx'
import {ProcessingCard} from './components/ProcessingCard.jsx'
import {ResultsView} from './components/ResultsView.jsx'
import {SessionHistoryPanel} from './components/SessionHistoryPanel.jsx'

import {AudioPlayer, AudioRecorder} from './lib/audio.js'
import {processClinicalTranscript} from './lib/clinical-processing.js'
import {generateEphemeralToken} from './lib/ephemeral-token.js'
import {connectLiveSession} from './lib/gemini-live.js'
import {executeToolCalls} from './lib/tools.js'
import {DEFAULT_SYSTEM_PROMPT} from './systemPrompt.js'

const DEFAULT_SETTINGS = {
	systemInstructions: DEFAULT_SYSTEM_PROMPT,
	voiceName: 'Aoede',
	temperature: 1,
	thinkingLevel: ThinkingLevel.HIGH,
	enableGrounding: false,
	enableInputTranscription: true,
	enableOutputTranscription: false,
	disableActivityDetection: false,
	silenceDurationMs: 250,
	prefixPaddingMs: 200,
	startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
	endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
	activityHandling: ActivityHandling.START_OF_ACTIVITY_INTERRUPTS,
	volume: 0
}

const AUTH_STORAGE_KEY = 'voicerx-authenticated'
const DUMMY_CREDENTIALS = {username: 'admin', password: 'password123'}

function readStoredAuth() {
	if (typeof window === 'undefined') return false
	return window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
}

function createMessageId() {
	return typeof crypto !== 'undefined' && crypto.randomUUID
		? crypto.randomUUID()
		: `m-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function App() {
	const [isAuthenticated, setIsAuthenticated] = useState(readStoredAuth)
	const [loginUsername, setLoginUsername] = useState('')
	const [loginPassword, setLoginPassword] = useState('')
	const [loginError, setLoginError] = useState('')

	// view: 'welcome' | 'dictating' | 'processing' | 'results'
	const [view, setView] = useState('welcome')
	const [showModePicker, setShowModePicker] = useState(false)
	const [mode, setMode] = useState('dictate')

	// session state
	const [status, setStatus] = useState('disconnected') // disconnected | connecting | connected | error
	const [statusDetail, setStatusDetail] = useState('')
	const [isSessionReady, setIsSessionReady] = useState(false)

	// transcript
	const [transcript, setTranscript] = useState('')
	const transcriptRef = useRef('')

	// mic
	const [micOptions, setMicOptions] = useState([])
	const [selectedMic, setSelectedMic] = useState('')
	const [isMicOn, setIsMicOn] = useState(false)
	const [micStream, setMicStream] = useState(null)
	const [micError, setMicError] = useState(null) // { title, message }
	const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)

	// clinical pipeline
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [clinicalResults, setClinicalResults] = useState(null)
	const [activeResultTab, setActiveResultTab] = useState('soap')
	const [showSessionHistory, setShowSessionHistory] = useState(false)
	const [activeHistoryItem, setActiveHistoryItem] = useState(null)

	const sessionRef = useRef(null)
	const recorderRef = useRef(null)
	const audioPlayerRef = useRef(null)
	const settingsRef = useRef(DEFAULT_SETTINGS)
	const closeRequestedRef = useRef(false)
	const previousClinicalContextRef = useRef({})
	const tokenRef = useRef('')

	// ──────────── persist auth ────────────
	useEffect(() => {
		if (typeof window === 'undefined') return
		if (isAuthenticated) {
			window.localStorage.setItem(AUTH_STORAGE_KEY, 'true')
		} else {
			window.localStorage.removeItem(AUTH_STORAGE_KEY)
		}
	}, [isAuthenticated])

	useEffect(() => {
		transcriptRef.current = transcript
	}, [transcript])

	// Online/offline detection
	useEffect(() => {
		if (typeof window === 'undefined') return
		const onOnline = () => setIsOnline(true)
		const onOffline = () => setIsOnline(false)
		window.addEventListener('online', onOnline)
		window.addEventListener('offline', onOffline)
		return () => {
			window.removeEventListener('online', onOnline)
			window.removeEventListener('offline', onOffline)
		}
	}, [])

	// ──────────── helpers ────────────
	const appendTranscript = useCallback((text, finalized) => {
		startTransition(() => {
			setTranscript((current) => {
				if (!finalized) {
					// Stream — replace last partial chunk if still being assembled
					return (current ?? '') + text
				}
				return (current ?? '') + text
			})
		})
	}, [])

	const ensureAudioPlayer = useCallback(async () => {
		if (!audioPlayerRef.current) {
			audioPlayerRef.current = new AudioPlayer()
		}
		await audioPlayerRef.current.init()
		audioPlayerRef.current.setVolume(settingsRef.current.volume / 100)
		return audioPlayerRef.current
	}, [])

	function handleSessionMessage(message) {
		const currentSession = sessionRef.current
		const content = message.serverContent

		if (message.setupComplete) {
			setIsSessionReady(true)
			setStatusDetail('Session ready.')
		}

		if (message.toolCall?.functionCalls?.length) {
			const responses = executeToolCalls(message.toolCall.functionCalls)
			currentSession?.sendToolResponse({functionResponses: responses})
		}

		if (!content) return

		if (content.inputTranscription?.text) {
			appendTranscript(content.inputTranscription.text, content.inputTranscription.finished)
		}

		if (content.modelTurn?.parts) {
			for (const part of content.modelTurn.parts) {
				if (part.inlineData?.mimeType?.startsWith('audio/')) {
					ensureAudioPlayer()
						.then((player) => player.play(part.inlineData.data))
						.catch(() => {})
				}
			}
		}

		if (content.interrupted) {
			audioPlayerRef.current?.interrupt()
		}
	}

	const teardownMedia = useCallback(() => {
		recorderRef.current?.stop()
		recorderRef.current = null
		setMicStream(null)
		setIsMicOn(false)
	}, [])

	const teardownSession = useCallback(() => {
		closeRequestedRef.current = true
		teardownMedia()
		if (sessionRef.current) {
			sessionRef.current.close()
			sessionRef.current = null
		}
		setIsSessionReady(false)
	}, [teardownMedia])

	const connectSession = useCallback(async () => {
		if (status === 'connecting' || status === 'connected') return
		closeRequestedRef.current = false
		setStatus('connecting')
		setStatusDetail('Connecting to live session…')

		try {
			let token = tokenRef.current
			if (!token?.startsWith('auth_tokens/')) {
				const generated = await generateEphemeralToken()
				token = generated.name
				tokenRef.current = token
			}
			await ensureAudioPlayer()

			const {session} = await connectLiveSession({
				apiKey: token,
				settings: settingsRef.current,
				callbacks: {
					onopen: () => {
						setStatus('connected')
						setStatusDetail('Socket open. Waiting for setup…')
					},
					onmessage: handleSessionMessage,
					onerror: (event) => {
						const msg = event?.message || event?.error?.message || 'Connection error'
						setStatus('error')
						setStatusDetail(msg)
					},
					onclose: (event) => {
						teardownMedia()
						sessionRef.current = null
						setIsSessionReady(false)
						if (closeRequestedRef.current || event?.code === 1000) {
							setStatus('disconnected')
							setStatusDetail('Session closed.')
							return
						}
						setStatus('error')
						setStatusDetail(event?.reason || 'Session closed unexpectedly.')
					}
				}
			})

			sessionRef.current = session
		} catch (error) {
			setStatus('error')
			setStatusDetail(error.message || 'Connect failed.')
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ensureAudioPlayer, status, teardownMedia])

	// ──────────── auto-connect on login ────────────
	useEffect(() => {
		if (!isAuthenticated) return
		void connectSession()
		return () => {
			teardownSession()
			audioPlayerRef.current?.destroy()
			audioPlayerRef.current = null
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isAuthenticated])

	// ──────────── enumerate mics (after permission) ────────────
	const refreshDevices = useCallback(async () => {
		if (!navigator.mediaDevices?.enumerateDevices) return
		try {
			const devices = await navigator.mediaDevices.enumerateDevices()
			setMicOptions(devices.filter((d) => d.kind === 'audioinput'))
		} catch (_e) { /* noop */ }
	}, [])

	// ──────────── mic control ────────────
	const startMic = useCallback(async () => {
		if (!sessionRef.current || !isSessionReady) return false
		try {
			if (settingsRef.current.disableActivityDetection) {
				sessionRef.current.sendRealtimeInput({activityStart: {}})
			}
			const recorder = new AudioRecorder({
				onChunk: (audioBlob) => {
					sessionRef.current?.sendRealtimeInput({audio: audioBlob})
				}
			})
			await recorder.start(selectedMic || undefined)
			recorderRef.current = recorder
			setMicStream(recorder.mediaStream)
			setIsMicOn(true)
			setMicError(null)
			void refreshDevices()
			return true
		} catch (error) {
			const isPermission = /permission|denied|NotAllowed/i.test(error?.name + ' ' + error?.message)
			const isNoDevice = /NotFound|no device|NotReadable/i.test(error?.name + ' ' + error?.message)
			setMicError({
				title: isPermission
					? 'Microphone access blocked'
					: isNoDevice
						? 'No microphone detected'
						: 'Microphone unavailable',
				message: isPermission
					? 'Please allow microphone access in your browser. Submit is paused until the mic is working again — your transcript so far is safe.'
					: isNoDevice
						? 'Plug in a microphone or check your input device. Then tap the mic to retry.'
						: error.message
			})
			setStatusDetail(`Microphone failed: ${error.message}`)
			return false
		}
	}, [isSessionReady, selectedMic, refreshDevices])

	const stopMic = useCallback(() => {
		if (!recorderRef.current) return
		recorderRef.current.stop()
		recorderRef.current = null
		setMicStream(null)
		setIsMicOn(false)
		if (sessionRef.current) {
			if (settingsRef.current.disableActivityDetection) {
				sessionRef.current.sendRealtimeInput({activityEnd: {}})
			} else {
				sessionRef.current.sendRealtimeInput({audioStreamEnd: true})
			}
		}
	}, [])

	const toggleMic = useCallback(() => {
		if (isMicOn) stopMic()
		else void startMic()
	}, [isMicOn, startMic, stopMic])

	// ──────────── flow controls ────────────
	const goToWelcome = useCallback(() => {
		stopMic()
		setView('welcome')
		setTranscript('')
		setClinicalResults(null)
		setActiveResultTab('soap')
		setMicError(null)
		previousClinicalContextRef.current = {}
		// Re-establish session if dropped
		if (status !== 'connected' && status !== 'connecting') {
			void connectSession()
		}
	}, [connectSession, status, stopMic])

	const handleStart = () => {
		if (status === 'error') {
			void connectSession()
		}
		setShowModePicker(true)
	}

	const handlePickMode = async (modeId) => {
		setMode(modeId)
		setShowModePicker(false)
		setTranscript('')
		setView('dictating')
		// Wait for session ready, then auto-start mic
		if (isSessionReady) {
			await startMic()
		}
	}

	// auto-start mic when entering dictating view if session becomes ready
	useEffect(() => {
		if (view !== 'dictating') return
		if (!isSessionReady) return
		if (isMicOn) return
		if (recorderRef.current) return
		void startMic()
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [view, isSessionReady])

	const handleCancelDictation = () => {
		stopMic()
		setView('welcome')
		setTranscript('')
	}

	const handleSubmit = async () => {
		stopMic()
		const text = transcriptRef.current.trim()
		if (!text) {
			return
		}
		
		setIsSubmitting(true)
		// Simulated wait time for finalizing transcript as requested
		await new Promise(resolve => window.setTimeout(resolve, 800))
		setIsSubmitting(false)

		// Show transcript + shimmer; wait for ALL THREE before switching to results.
		setView('processing')
		setActiveResultTab('soap')
		setClinicalResults({
			soap: {name: 'soap', status: 'pending'},
			icd: {name: 'icd', status: 'pending'},
			digitization: {name: 'digitization', status: 'pending'}
		})
		try {
			const results = await processClinicalTranscript({
				transcription: text,
				previousContext: previousClinicalContextRef.current,
				onResult: (tab, result) => {
					if (tab === 'digitization' && result.status === 'fulfilled') {
						previousClinicalContextRef.current = result.data
					}
					setClinicalResults((current) => ({
						...(current || {}),
						[tab]: result
					}))
				}
			})
			setClinicalResults(results)
			setView('results')
			// Save session to history
			try {
				const sessions = JSON.parse(window.localStorage.getItem('voicerx-sessions') || '[]')
				sessions.unshift({
					id: createMessageId(),
					mode,
					date: new Date().toISOString(),
					transcriptPreview: text.slice(0, 200),
					transcript: text,
					clinicalResults: results
				})
				if (sessions.length > 20) sessions.length = 20
				window.localStorage.setItem('voicerx-sessions', JSON.stringify(sessions))
			} catch {}
		} catch (error) {
			setStatusDetail(`Processing failed: ${error.message}`)
			setView('results')
		}
	}

	const completedTabs = useMemo(() => {
		if (!clinicalResults) return []
		return ['soap', 'icd', 'digitization'].filter(
			(t) => clinicalResults[t]?.status === 'fulfilled' || clinicalResults[t]?.status === 'rejected'
		)
	}, [clinicalResults])

	// ──────────── login ────────────
	function handleLogin(event) {
		event.preventDefault()
		if (
			loginUsername.trim() === DUMMY_CREDENTIALS.username &&
			loginPassword === DUMMY_CREDENTIALS.password
		) {
			setLoginError('')
			setLoginPassword('')
			setIsAuthenticated(true)
			setView('welcome')
			return
		}
		setLoginError('Invalid username or password.')
	}

	function handleLogout() {
		teardownSession()
		setIsAuthenticated(false)
		setLoginUsername('')
		setLoginPassword('')
		setView('welcome')
		setTranscript('')
		setClinicalResults(null)
	}

	// ──────────── render ────────────
	if (!isAuthenticated) {
		return (
			<LoginView
				username={loginUsername}
				password={loginPassword}
				error={loginError}
				demoUsername={DUMMY_CREDENTIALS.username}
				demoPassword={DUMMY_CREDENTIALS.password}
				setUsername={setLoginUsername}
				setPassword={setLoginPassword}
				onSubmit={handleLogin}
			/>
		)
	}

	const sessionStatus = isSessionReady ? 'ready' : status === 'error' ? 'error' : 'connecting'

	const handleHistoryBack = () => {
		setActiveHistoryItem(null)
		setView('welcome')
	}

	return (
		<div className='voicerx-shell'>
			<div className='voicerx-aura' aria-hidden='true'/>

			<TopBar
				sessionStatus={sessionStatus}
				onLogout={handleLogout}
				onBack={activeHistoryItem ? handleHistoryBack : view === 'dictating' ? handleCancelDictation : undefined}
				onSessionHistory={() => setShowSessionHistory(true)}
				activeMode={view === 'dictating' || view === 'processing' ? (mode === 'dictate' ? 'dictate' : 'conversation') : null}
				title={activeHistoryItem ? activeHistoryItem.date ? new Date(activeHistoryItem.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) + ' - Consultation' : 'Conversation History' : undefined}
			/>

			{!isOnline ? (
				<div className='px-4 pt-1'>
					<ErrorBanner
						kind='No internet connection'
						message='Submission and live transcription pause until you reconnect. Already-spoken text is safe.'
					/>
				</div>
			) : null}

			{view === 'welcome' ? (
				<WelcomeView
					sessionStatus={sessionStatus}
					onStart={handleStart}
				/>
			) : view === 'dictating' ? (
				<DictationView
					mode={mode}
					transcript={transcript}
					isMicOn={isMicOn}
					micStream={micStream}
					micOptions={micOptions}
					selectedMic={selectedMic}
					setSelectedMic={setSelectedMic}
					onToggleMic={toggleMic}
					onCancel={handleCancelDictation}
					onSubmit={handleSubmit}
					canSubmit={isSessionReady && isOnline}
					isSubmitting={isSubmitting}
					error={micError || (!isOnline ? {title: 'No internet connection', message: 'Reconnect to continue dictating.'} : null)}
				/>
			) : view === 'processing' ? (
				<ProcessingCard transcript={transcript} completedTabs={completedTabs}/>
			) : (
				<ResultsView
					clinicalResults={clinicalResults}
					transcript={transcript}
					activeTab={activeResultTab}
					setActiveTab={setActiveResultTab}
					onNewSession={goToWelcome}
					isPastSession={!!activeHistoryItem}
				/>
			)}

			<ModePickerSheet
				open={showModePicker}
				onPick={handlePickMode}
				onClose={() => setShowModePicker(false)}
			/>

			<SessionHistoryPanel
				open={showSessionHistory}
				onClose={() => setShowSessionHistory(false)}
				onLoadSession={(session) => {
					setShowSessionHistory(false)
					setActiveHistoryItem(session)
					setTranscript(session.transcript || '')
					setClinicalResults(session.clinicalResults || null)
					setActiveResultTab('soap')
					setView('results')
				}}
			/>
		</div>
	)
}

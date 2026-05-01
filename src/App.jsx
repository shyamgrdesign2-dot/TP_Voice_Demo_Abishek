import {ActivityHandling, EndSensitivity, StartSensitivity, ThinkingLevel} from '@google/genai'
import {
  Bot,
  Camera,
  CameraOff,
  ChevronRight,
  CheckCircle2,
  FileText,
  LockKeyhole,
  LogOut,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  ScreenShare,
  ScreenShareOff,
  Send,
  Settings2,
  Sparkles
} from 'lucide-react'
import {startTransition, useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {VoiceRxWaveform} from './components/VoiceRxWaveform.jsx'
import {AudioPlayer, AudioRecorder} from './lib/audio.js'
import {processClinicalTranscript} from './lib/clinical-processing.js'
import {generateEphemeralToken} from './lib/ephemeral-token.js'
import {
  ACTIVITY_HANDLING_OPTIONS,
  connectLiveSession,
  END_SENSITIVITY_OPTIONS,
  FIXED_MODEL_ID,
  formatSetupPayload,
  START_SENSITIVITY_OPTIONS,
  VOICE_OPTIONS
} from './lib/gemini-live.js'
import {executeToolCalls, HEALTH_TOOL_NAMES} from './lib/tools.js'
import {CameraStreamer, ScreenStreamer} from './lib/video.js'
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

const INITIAL_MESSAGES = [
	{
		id: 'welcome',
		kind: 'system',
		text: 'Connect to Gemini Live, then start talking.'
	}
]

const STATUS_COPY = {
	disconnected: 'Disconnected',
	connecting: 'Connecting',
	connected: 'Connected',
	error: 'Error'
}

const NAV_ITEMS = [
	{path: '/', label: 'Playground', icon: Bot},
	{path: '/system', label: 'System', icon: Sparkles},
	{path: '/settings', label: 'Settings', icon: Settings2}
]
const LIVE_TOKEN_STORAGE_KEY = 'goals-live-ephemeral-token'
const AUTH_STORAGE_KEY = 'goals-authenticated'
const DUMMY_CREDENTIALS = {
	username: 'admin',
	password: 'password123'
}

function readStoredLiveToken() {
	if (typeof window === 'undefined') {
		return ''
	}
	
	return window.localStorage.getItem(LIVE_TOKEN_STORAGE_KEY) || ''
}

function readStoredAuth() {
	if (typeof window === 'undefined') {
		return false
	}
	
	return window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
}

function createMessage(kind, text) {
	return {
		id:
			typeof crypto !== 'undefined' && crypto.randomUUID
				? crypto.randomUUID()
				: `${kind}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
		kind,
		text
	}
}

function classNames(...values) {
	return values.filter(Boolean).join(' ')
}

function formatTimestamp() {
	return new Date().toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	})
}

function readPathname() {
	if (typeof window === 'undefined') {
		return '/'
	}
	
	const pathname = window.location.pathname
	return pathname === '/settings' || pathname === '/system' || pathname === '/login'
		? pathname
		: '/'
}

export default function App() {
	const [pathname, setPathname] = useState(readPathname)
	const [isAuthenticated, setIsAuthenticated] = useState(readStoredAuth)
	const [loginUsername, setLoginUsername] = useState('')
	const [loginPassword, setLoginPassword] = useState('')
	const [loginError, setLoginError] = useState('')
	const [settings, setSettings] = useState(DEFAULT_SETTINGS)
	const [liveApiKey, setLiveApiKey] = useState(readStoredLiveToken)
	const [voiceTextInput, setVoiceTextInput] = useState('')
	const [status, setStatus] = useState('disconnected')
	const [statusDetail, setStatusDetail] = useState(() =>
		readStoredLiveToken()
			? 'Ready to connect.'
			: 'Generate a token to start a Live session.'
	)
	const [chatInput, setChatInput] = useState('')
	const [messages, setMessages] = useState(INITIAL_MESSAGES)
	const [debugLines, setDebugLines] = useState(['Ready to connect.'])
	const [micOptions, setMicOptions] = useState([])
	const [cameraOptions, setCameraOptions] = useState([])
	const [selectedMic, setSelectedMic] = useState('')
	const [selectedCamera, setSelectedCamera] = useState('')
	const [isSessionReady, setIsSessionReady] = useState(false)
	const [isMicOn, setIsMicOn] = useState(false)
	const [isCameraOn, setIsCameraOn] = useState(false)
	const [isScreenOn, setIsScreenOn] = useState(false)
	const [micStream, setMicStream] = useState(null)
	const [previewTitle, setPreviewTitle] = useState('No live visual stream')
	const [previewStream, setPreviewStream] = useState(null)
	const [digitizeState, setDigitizeState] = useState('idle')
	const [clinicalResults, setClinicalResults] = useState(null)
	const [clinicalTab, setClinicalTab] = useState('transcript')
	
	const previewRef = useRef(null)
	const conversationFeedRef = useRef(null)
	const sessionRef = useRef(null)
	const recorderRef = useRef(null)
	const audioPlayerRef = useRef(null)
	const cameraRef = useRef(null)
	const screenRef = useRef(null)
	const settingsRef = useRef(settings)
	const closeRequestedRef = useRef(false)
	const previousClinicalContextRef = useRef({})
	const transcriptTextRef = useRef('')
	
	useEffect(() => {
		settingsRef.current = settings
	}, [settings])
	
	useEffect(() => {
		if (typeof window === 'undefined') {
			return
		}
		
		if (isAuthenticated) {
			window.localStorage.setItem(AUTH_STORAGE_KEY, 'true')
			return
		}
		
		window.localStorage.removeItem(AUTH_STORAGE_KEY)
	}, [isAuthenticated])
	
	useEffect(() => {
		if (typeof window === 'undefined') {
			return
		}
		
		if (!isAuthenticated && pathname !== '/login') {
			window.history.replaceState({}, '', '/login')
			return
		}
		
		if (isAuthenticated && pathname === '/login') {
			window.history.replaceState({}, '', '/')
		}
	}, [isAuthenticated, pathname])
	
	useEffect(() => {
		if (typeof window === 'undefined') {
			return
		}
		
		if (liveApiKey?.startsWith('auth_tokens/')) {
			window.localStorage.setItem(LIVE_TOKEN_STORAGE_KEY, liveApiKey)
			return
		}
		
		window.localStorage.removeItem(LIVE_TOKEN_STORAGE_KEY)
	}, [liveApiKey])
	
	useEffect(() => {
		const handlePopState = () => {
			setPathname(readPathname())
		}
		
		window.addEventListener('popstate', handlePopState)
		return () => {
			window.removeEventListener('popstate', handlePopState)
		}
	}, [])
	
	const groundingDisablesTools = settings.enableGrounding
	const hasLiveToken = liveApiKey.startsWith('auth_tokens/')
	const canConnect = status !== 'connecting' && status !== 'connected'
	const canDisconnect = status === 'connecting' || status === 'connected'
	const isConnected = status === 'connected'
	const canInteract = isConnected && isSessionReady
	const routePath = isAuthenticated && pathname === '/login' ? '/' : pathname
	const isPlayground = routePath === '/'
	
	useEffect(() => {
		if (!isPlayground || !conversationFeedRef.current) {
			return
		}
		
		const frameId = window.requestAnimationFrame(() => {
			conversationFeedRef.current?.scrollTo({
				top: conversationFeedRef.current.scrollHeight,
				behavior: 'smooth'
			})
		})
		
		return () => {
			window.cancelAnimationFrame(frameId)
		}
	}, [isPlayground, messages])
	
	const messageCount = useMemo(() => messages.length, [messages])
	const transcriptText = useMemo(
		() =>
			messages
					.filter((message) =>
						message.kind === 'user-transcript' ||
						message.kind === 'user'
					)
				.map((message) => message.text.trim())
				.filter(Boolean)
				.join('\n'),
			[messages]
	)
	
	useEffect(() => {
		transcriptTextRef.current = transcriptText
	}, [transcriptText])
	
	const setupJson = useMemo(
		() => JSON.stringify(formatSetupPayload(settings), null, 2),
		[settings]
	)
	
	const addDebugLine = useCallback((line) => {
		const stamped = `[${formatTimestamp()}] ${line}`
		startTransition(() => {
			setDebugLines((current) => [...current.slice(-23), stamped])
		})
	}, [])

	const handleStageWheel = useCallback((event) => {
		const feed = conversationFeedRef.current
		
		if (!feed) {
			return
		}
		
		const target = event.target
		if (target instanceof Node && feed.contains(target)) {
			return
		}
		
		if (feed.scrollHeight <= feed.clientHeight) {
			return
		}
		
		event.preventDefault()
		feed.scrollBy({
			top: event.deltaY,
			left: event.deltaX,
			behavior: 'auto'
		})
	}, [])
	
	const addMessage = useCallback((kind, text, {append = false} = {}) => {
		startTransition(() => {
			setMessages((current) => {
				if (
					append &&
					current.length > 0 &&
					current[current.length - 1].kind === kind
				) {
					const next = current.slice()
					next[next.length - 1] = {
						...next[next.length - 1],
						text: `${next[next.length - 1].text}${text}`
					}
					return next
				}
				
				return [...current, createMessage(kind, text)]
			})
		})
	}, [])
	
	const refreshDevices = useCallback(async () => {
		if (!navigator.mediaDevices?.enumerateDevices) {
			return
		}
		
		try {
			const devices = await navigator.mediaDevices.enumerateDevices()
			setMicOptions(devices.filter((device) => device.kind === 'audioinput'))
			setCameraOptions(devices.filter((device) => device.kind === 'videoinput'))
		}
		catch (error) {
			addDebugLine(`Device enumeration failed: ${error.message}`)
		}
	}, [addDebugLine])
	
	const attachPreview = useCallback((stream, label) => {
		setPreviewStream(stream)
		setPreviewTitle(label)
	}, [])
	
	const clearPreview = useCallback(() => {
		setPreviewStream(null)
		setPreviewTitle('No live visual stream')
	}, [])
	
	const syncPreview = useCallback(() => {
		if (screenRef.current?.stream) {
			attachPreview(screenRef.current.stream, 'Screen preview')
			return
		}
		
		if (cameraRef.current?.stream) {
			attachPreview(cameraRef.current.stream, 'Camera preview')
			return
		}
		
		clearPreview()
	}, [attachPreview, clearPreview])
	
	useEffect(() => {
		const previewElement = previewRef.current
		
		if (!previewElement) {
			return
		}
		
		previewElement.srcObject = previewStream
		
		if (!previewStream) {
			return
		}
		
		previewElement.play().catch((error) => {
			addDebugLine(`Preview playback failed: ${error.message}`)
		})
		
		return () => {
			if (previewElement.srcObject === previewStream) {
				previewElement.srcObject = null
			}
		}
	}, [addDebugLine, previewStream])
	
	async function ensureAudioPlayer() {
		if (!audioPlayerRef.current) {
			audioPlayerRef.current = new AudioPlayer()
		}
		
		await audioPlayerRef.current.init()
		audioPlayerRef.current.setVolume(settingsRef.current.volume / 100)
		return audioPlayerRef.current
	}
	
	function handleSessionMessage(message) {
		const currentSession = sessionRef.current
		const content = message.serverContent
		
		if (message.setupComplete) {
			const sessionId = message.setupComplete.sessionId || 'unknown'
			setIsSessionReady(true)
			addDebugLine(`Setup complete. Session id: ${sessionId}`)
			addMessage('system', 'Live session ready.')
			setStatusDetail('Session ready. Voice and text input are enabled.')
		}
		
		if (message.toolCall?.functionCalls?.length) {
			const responses = executeToolCalls(message.toolCall.functionCalls)
			
			message.toolCall.functionCalls.forEach((functionCall, index) => {
				addDebugLine(
					`Tool call: ${functionCall.name}(${JSON.stringify(
						functionCall.args ?? functionCall.arguments ?? {}
					)})`
				)
				addMessage(
					'tool',
					`Tool ${responses[index].name} returned ${JSON.stringify(
						responses[index].response
					)}`
				)
			})
			
			currentSession?.sendToolResponse({functionResponses: responses})
		}
		
		if (message.toolCallCancellation?.ids?.length) {
			addDebugLine(
				`Tool call cancellation received for ids: ${message.toolCallCancellation.ids.join(', ')}`
			)
			addMessage('system', 'Tool execution cancelled by the model.')
		}
		
		if (!content) {
			return
		}
		
		if (content.inputTranscription?.text) {
			addMessage('user-transcript', content.inputTranscription.text, {
				append: !content.inputTranscription.finished
			})
		}
		
		if (content.outputTranscription?.text) {
			addMessage('assistant-transcript', content.outputTranscription.text, {
				append: !content.outputTranscription.finished
			})
		}
		
		for (const part of content.modelTurn?.parts || []) {
			if (part.text) {
				addMessage('assistant', part.text)
			}
			
			if (part.inlineData?.mimeType?.startsWith('audio/')) {
				ensureAudioPlayer()
					.then((player) => player.play(part.inlineData.data))
					.catch((error) => {
						addDebugLine(`Audio playback failed: ${error.message}`)
					})
			}
		}
		
		if (content.interrupted) {
			addDebugLine('Generation interrupted.')
			audioPlayerRef.current?.interrupt()
			addMessage('system', 'Assistant output interrupted.')
		}
		
		if (content.turnComplete) {
			const reason = content.turnCompleteReason || 'TURN_COMPLETE_REASON_UNSPECIFIED'
			addDebugLine(`Turn complete. Reason: ${reason}`)
		}
	}
	
	async function connect() {
		if (!canConnect) {
			return
		}
		
		closeRequestedRef.current = false
		setStatus('connecting')
		setIsSessionReady(false)
		setStatusDetail('Connecting to Gemini Live...')
		addDebugLine(`Opening Live session for ${FIXED_MODEL_ID}`)
		
		try {
			const token = hasLiveToken ? liveApiKey : await refreshEphemeralToken({silent: true})
			await ensureAudioPlayer()
			
			const {session} = await connectLiveSession({
				apiKey: token,
				settings: settingsRef.current,
				callbacks: {
					onopen: () => {
						setStatus('connected')
						setStatusDetail('Socket open. Waiting for session setup...')
						addDebugLine('WebSocket open. Waiting for setupComplete.')
					},
					onmessage: handleSessionMessage,
					onerror: (event) => {
						const nextMessage =
							event?.message || event?.error?.message || 'Connection error'
						setStatus('error')
						setStatusDetail(nextMessage)
						addDebugLine(`Socket error: ${nextMessage}`)
						addMessage('system', `Connection error: ${nextMessage}`)
					},
					onclose: (event) => {
						const closeDetail = event?.reason
							? `code=${event.code} reason=${event.reason}`
							: `code=${event?.code ?? 'unknown'}`
						const tokenExpiredForNewSessions =
							event?.reason?.includes('new_session_expire_time deadline exceeded')
						
						addDebugLine(`WebSocket closed. ${closeDetail}`)
						teardownMedia()
						sessionRef.current = null
						setIsSessionReady(false)
						
						if (closeRequestedRef.current || event?.code === 1000) {
							setStatus('disconnected')
							setStatusDetail('Session closed.')
							return
						}
						
						setStatus('error')
						if (tokenExpiredForNewSessions) {
							setStatusDetail('Ephemeral token expired for new sessions.')
							addMessage(
								'system',
								'Ephemeral token expired for new sessions. Use the Generate New Token button, then connect again.'
							)
							return
						}
						
						setStatusDetail(`Session closed unexpectedly. ${closeDetail}`)
						addMessage('system', `Connection closed unexpectedly. ${closeDetail}`)
					}
				}
			})
			
			sessionRef.current = session
		}
		catch (error) {
			setStatus('error')
			setStatusDetail(error.message)
			addDebugLine(`Connect failed: ${error.message}`)
			addMessage('system', `Connect failed: ${error.message}`)
		}
	}
	
	async function refreshEphemeralToken({silent = false} = {}) {
		setStatusDetail('Generating fresh ephemeral token...')
		addDebugLine(silent ? 'Generating a fresh ephemeral token before connect.' : 'Generating a fresh ephemeral token from the UI.')
		
		try {
			const token = await generateEphemeralToken()
			setLiveApiKey(token.name)
			if (!silent) {
				setStatus('disconnected')
				setStatusDetail('Fresh token ready. Connect again.')
			}
			addDebugLine('Fresh ephemeral token generated successfully.')
			if (!silent) {
				addMessage('system', 'Fresh ephemeral token generated. You can connect again now.')
			}
			return token.name
		}
		catch (error) {
			setStatus('error')
			setStatusDetail(`Token generation failed: ${error.message}`)
			addDebugLine(`Token generation failed: ${error.message}`)
			addMessage('system', `Token generation failed: ${error.message}`)
			throw error
		}
	}
	
	const teardownMedia = useCallback(() => {
		recorderRef.current?.stop()
		recorderRef.current = null
		setMicStream(null)
		cameraRef.current?.stop()
		cameraRef.current = null
		screenRef.current?.stop()
		screenRef.current = null
		setIsMicOn(false)
		setIsCameraOn(false)
		setIsScreenOn(false)
		clearPreview()
	}, [clearPreview])
	
	const teardownSession = useCallback(() => {
		closeRequestedRef.current = true
		teardownMedia()
		
		if (sessionRef.current) {
			sessionRef.current.close()
			sessionRef.current = null
		}
		
		setIsSessionReady(false)
	}, [teardownMedia])
	
	useEffect(() => {
		if (!isAuthenticated) {
			return
		}
		
		const refreshTimeoutId = window.setTimeout(() => {
			void refreshDevices()
		}, 0)
		
		const handleDeviceChange = () => {
			void refreshDevices()
		}
		
		navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange)
		
		return () => {
			window.clearTimeout(refreshTimeoutId)
			navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange)
			teardownSession()
			audioPlayerRef.current?.destroy()
		}
	}, [isAuthenticated, refreshDevices, teardownSession])
	
	function disconnect() {
		if (!canDisconnect) {
			return
		}
		
		closeRequestedRef.current = true
		addDebugLine('Disconnect requested by user.')
		setStatusDetail('Disconnecting...')
		teardownSession()
		setStatus('disconnected')
		setStatusDetail('Disconnected.')
	}
	
	async function toggleMic() {
		if (!canInteract || !sessionRef.current) {
			addMessage('system', 'Wait for session setup before turning on the microphone.')
			return
		}
		
		if (isMicOn) {
			recorderRef.current?.stop()
			recorderRef.current = null
			setMicStream(null)
			
			if (settingsRef.current.disableActivityDetection) {
				sessionRef.current.sendRealtimeInput({activityEnd: {}})
			}
			else {
				sessionRef.current.sendRealtimeInput({audioStreamEnd: true})
			}
			
			setIsMicOn(false)
			addDebugLine('Microphone stopped.')
			addMessage('system', 'Microphone off.')
			return
		}
		
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
			addDebugLine('Microphone streaming at 16 kHz PCM.')
			addMessage('system', 'Microphone on.')
			await refreshDevices()
		}
		catch (error) {
			addDebugLine(`Microphone failed: ${error.message}`)
			addMessage('system', `Microphone failed: ${error.message}`)
		}
	}
	
	async function toggleCamera() {
		if (!canInteract || !sessionRef.current) {
			addMessage('system', 'Wait for session setup before turning on the camera.')
			return
		}
		
		if (isCameraOn) {
			cameraRef.current?.stop()
			cameraRef.current = null
			setIsCameraOn(false)
			addDebugLine('Camera stream stopped.')
			addMessage('system', 'Camera off.')
			syncPreview()
			
			return
		}
		
		try {
			const streamer = new CameraStreamer({
				onFrame: (videoBlob) => {
					sessionRef.current?.sendRealtimeInput({video: videoBlob})
				}
			})
			
			const stream = await streamer.start({
				deviceId: selectedCamera || undefined,
				fps: 1,
				width: 640,
				height: 480
			})
			
			cameraRef.current = streamer
			setIsCameraOn(true)
			attachPreview(stream, 'Camera preview')
			addDebugLine('Camera streaming at 1 FPS.')
			addMessage('system', 'Camera on.')
			await refreshDevices()
		}
		catch (error) {
			addDebugLine(`Camera failed: ${error.message}`)
			addMessage('system', `Camera failed: ${error.message}`)
		}
	}
	
	async function toggleScreen() {
		if (!canInteract || !sessionRef.current) {
			addMessage('system', 'Wait for session setup before sharing the screen.')
			return
		}
		
		if (isScreenOn) {
			screenRef.current?.stop()
			screenRef.current = null
			setIsScreenOn(false)
			addDebugLine('Screen sharing stopped.')
			addMessage('system', 'Screen share off.')
			syncPreview()
			
			return
		}
		
		try {
			const streamer = new ScreenStreamer({
				onFrame: (videoBlob) => {
					sessionRef.current?.sendRealtimeInput({video: videoBlob})
				},
				onEnded: () => {
					setIsScreenOn(false)
					addDebugLine('Screen sharing ended by the browser.')
					screenRef.current = null
					syncPreview()
				}
			})
			
			const stream = await streamer.start({fps: 0.5, width: 1280, height: 720})
			screenRef.current = streamer
			setIsScreenOn(true)
			attachPreview(stream, 'Screen preview')
			addDebugLine('Screen sharing streaming at 0.5 FPS.')
			addMessage('system', 'Screen share on.')
		}
		catch (error) {
			addDebugLine(`Screen share failed: ${error.message}`)
			addMessage('system', `Screen share failed: ${error.message}`)
		}
	}
	
	function sendTextMessage() {
		const nextMessage = chatInput.trim()
		
		if (!nextMessage) {
			return
		}
		
		if (!canInteract || !sessionRef.current) {
			addMessage('system', 'Wait for session setup before sending a text message.')
			return
		}
		
		sessionRef.current.sendRealtimeInput({text: nextMessage})
		addDebugLine(`Realtime text sent: ${nextMessage}`)
		addMessage('user', nextMessage)
		setChatInput('')
	}
	
	function updateSetting(key, value) {
		setSettings((current) => ({
			...current,
			[key]: value
		}))
	}
	
	function navigate(nextPath) {
		if (!isAuthenticated) {
			window.history.replaceState({}, '', '/login')
			return
		}
		
		if (nextPath === routePath) {
			return
		}
		
		window.history.pushState({}, '', nextPath)
		setPathname(nextPath)
	}
	
	function handleLogin(event) {
		event.preventDefault()
		
		if (
			loginUsername.trim() === DUMMY_CREDENTIALS.username &&
			loginPassword === DUMMY_CREDENTIALS.password
		) {
			setLoginError('')
			setLoginPassword('')
			setIsAuthenticated(true)
			window.history.replaceState({}, '', '/')
			setPathname('/')
			return
		}
		
		setLoginError('Invalid username or password.')
	}
	
	function handleLogout() {
		if (canDisconnect) {
			disconnect()
		}
		else {
			teardownSession()
		}
		
		setIsAuthenticated(false)
		setLoginUsername('')
		setLoginPassword('')
		setLoginError('')
		window.history.replaceState({}, '', '/login')
		setPathname('/login')
	}
	
	async function submitToDigitizePipeline(transcriptOverride) {
		const transcript = (transcriptOverride ?? transcriptTextRef.current).trim()
		
		if (!transcript) {
			setDigitizeState('empty')
			window.setTimeout(() => setDigitizeState('idle'), 2400)
			return
		}
		
		setDigitizeState('processing')
		setClinicalResults({
			soap: {name: 'soap', status: 'pending'},
			icd: {name: 'icd', status: 'pending'},
			digitization: {name: 'digitization', status: 'pending'}
		})
		setClinicalTab('soap')
		addDebugLine(`Clinical processing started with ${transcript.length} transcript characters.`)
		
		try {
			const results = await processClinicalTranscript({
				transcription: transcript,
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
			setDigitizeState('complete')
			addDebugLine('Clinical processing completed.')
			addMessage('system', 'VoiceRx transcript processed for Digitization, ICD, and SOAP.')
			window.setTimeout(() => setDigitizeState('idle'), 3200)
		}
		catch (error) {
			setDigitizeState('error')
			addDebugLine(`Clinical processing failed: ${error.message}`)
			addMessage('system', `Clinical processing failed: ${error.message}`)
		}
	}
	
	function submitVoiceTextInput() {
		const text = voiceTextInput.trim()
		
		if (!text) {
			return
		}
		
		addMessage('user', text)
		setVoiceTextInput('')
		setClinicalTab('transcript')
		addDebugLine(`Manual transcript text added: ${text}`)
		void submitToDigitizePipeline(text)
	}
	
	async function stopVoiceAndSubmit() {
		if (isMicOn) {
			await toggleMic()
		}
		
		window.setTimeout(() => {
			void submitToDigitizePipeline()
		}, 700)
	}
	
	if (!isAuthenticated) {
		return (
			<LoginView
				username={loginUsername}
				password={loginPassword}
				error={loginError}
				setUsername={setLoginUsername}
				setPassword={setLoginPassword}
				onSubmit={handleLogin}
			/>
		)
	}
	
	if (isPlayground) {
		return (
			<VoiceRxFullscreenView
				canConnect={canConnect}
				canDisconnect={canDisconnect}
				canInteract={canInteract}
				hasLiveToken={hasLiveToken}
				connect={connect}
				disconnect={disconnect}
				toggleMic={toggleMic}
				isMicOn={isMicOn}
				micStream={micStream}
				status={status}
				statusDetail={statusDetail}
				isSessionReady={isSessionReady}
				transcript={transcriptText}
				digitizeState={digitizeState}
				clinicalResults={clinicalResults}
				clinicalTab={clinicalTab}
				setClinicalTab={setClinicalTab}
				textInput={voiceTextInput}
				setTextInput={setVoiceTextInput}
				onTextSubmit={submitVoiceTextInput}
				onSubmit={submitToDigitizePipeline}
				onStopVoiceSubmit={stopVoiceAndSubmit}
				onLogout={handleLogout}
				onSettings={() => navigate('/settings')}
			/>
		)
	}
	
	return (
		<div className='studio-shell'>
			<aside className='studio-sidebar'>
				<div className='space-y-6'>
					<div className='sidebar-panel space-y-1'>
						<div className='text-sm text-slate-500'>Gemini 3.1 Flash Live Preview</div>
					</div>
					
					<nav className='space-y-1.5'>
						{NAV_ITEMS.map((item) => (
							<SidebarLink
								key={item.path}
								icon={item.icon}
								label={item.label}
								active={routePath === item.path}
								onClick={() => navigate(item.path)}
							/>
						))}
					</nav>
				</div>
				
				<div className='space-y-3 text-sm text-slate-500'>
					<div className='sidebar-panel rounded-2xl border border-white/8 bg-white/[0.03] p-4'>
						<div className='text-xs uppercase tracking-[0.24em] text-slate-500'>Tool</div>
						<div className='mt-2 text-slate-200'>
							{groundingDisablesTools ? 'Grounding only' : `${HEALTH_TOOL_NAMES.length} local tools`}
						</div>
						{groundingDisablesTools ? null : (
							<div className='mt-2 space-y-1 text-xs leading-5 text-slate-500'>
								{HEALTH_TOOL_NAMES.map((toolName) => (
									<div key={toolName} className='break-all text-sm'>
										{toolName}
									</div>
								))}
							</div>
						)}
					</div>
					<div className='sidebar-panel rounded-2xl border border-white/8 bg-white/[0.03] p-4'>
						<div className='text-xs uppercase tracking-[0.24em] text-slate-500'>Messages</div>
						<div className='mt-2 text-slate-200'>{messageCount}</div>
					</div>
				</div>
			</aside>
			
			<main className='studio-main'>
				<div className='studio-topbar'>
					<div className='flex items-center gap-3'>
						<div>
							<div className='text-2xl font-semibold text-white'>
								{routePath === '/' ? 'Health Coach' : routePath === '/settings' ? 'Run settings' : 'System'}
							</div>
							<div className='text-xs text-slate-500'>
								{routePath === '/'
									? ''
									: routePath === '/settings'
										? 'Live session controls'
										: 'Assistant instructions'}
							</div>
						</div>
					</div>
					
					<div className='flex items-center gap-3'>
						{!hasLiveToken ? (
							<button
								type='button'
								className='run-button'
								onClick={refreshEphemeralToken}
							>
								Generate Token
							</button>
						) : (
							<button
								type='button'
								className='run-button'
								onClick={canDisconnect ? disconnect : connect}
								disabled={!canConnect && !canDisconnect}
							>
								{canDisconnect ? 'Disconnect' : 'Connect'}
							</button>
						)}
						{hasLiveToken && status === 'error' ? (
							<button
								type='button'
								className='run-button'
								onClick={refreshEphemeralToken}
							>
								Generate New Token
							</button>
						) : null}
						<StatusPill
							status={status}
							ready={isSessionReady}
							detail={statusDetail}
						/>
						<button
							type='button'
							className='icon-button'
							onClick={handleLogout}
							title='Log out'
						>
							<LogOut className='h-4 w-4'/>
						</button>
					</div>
				</div>
				
				{isPlayground ? (
					<PlaygroundView
						canConnect={canConnect}
						canDisconnect={canDisconnect}
						canInteract={canInteract}
						hasLiveToken={hasLiveToken}
						connect={connect}
						disconnect={disconnect}
						toggleMic={toggleMic}
						toggleCamera={toggleCamera}
						toggleScreen={toggleScreen}
						isMicOn={isMicOn}
						isCameraOn={isCameraOn}
						isScreenOn={isScreenOn}
						messages={messages}
						chatInput={chatInput}
						setChatInput={setChatInput}
						sendTextMessage={sendTextMessage}
						conversationFeedRef={conversationFeedRef}
						handleStageWheel={handleStageWheel}
						previewRef={previewRef}
						previewStream={previewStream}
						previewTitle={previewTitle}
					/>
				) : routePath === '/settings' ? (
					<SettingsView
						settings={settings}
						updateSetting={updateSetting}
						selectedMic={selectedMic}
						setSelectedMic={setSelectedMic}
						micOptions={micOptions}
						selectedCamera={selectedCamera}
						setSelectedCamera={setSelectedCamera}
						cameraOptions={cameraOptions}
						debugLines={debugLines}
						setupJson={setupJson}
					/>
				) : (
					<SystemView
						systemInstructions={settings.systemInstructions}
						setSystemInstructions={(value) => updateSetting('systemInstructions', value)}
						resetSystemInstructions={() =>
							updateSetting('systemInstructions', DEFAULT_SYSTEM_PROMPT)
						}
					/>
				)}
			</main>
		</div>
	)
}

function LoginView({
	                   username,
	                   password,
	                   error,
	                   setUsername,
	                   setPassword,
	                   onSubmit
                   }) {
	return (
		<main className='login-shell'>
			<section className='login-card'>
				<div className='login-mark'>
					<LockKeyhole className='h-5 w-5'/>
				</div>
				<div>
					<div className='text-xs uppercase tracking-[0.24em] text-slate-500'>
						Secure access
					</div>
					<h1 className='mt-3 font-display text-4xl text-white'>
						Sign in to Health Coach
					</h1>
					<p className='mt-3 text-sm leading-6 text-slate-400'>
						Use the demo credentials to open the playground, system prompt, and settings pages.
					</p>
				</div>
				
				<form className='mt-8 space-y-4' onSubmit={onSubmit}>
					<Field label='Username'>
						<input
							className='settings-input'
							value={username}
							autoComplete='username'
							placeholder={DUMMY_CREDENTIALS.username}
							onChange={(event) => setUsername(event.target.value)}
						/>
					</Field>
					
					<Field label='Password'>
						<input
							className='settings-input'
							type='password'
							value={password}
							autoComplete='current-password'
							placeholder={DUMMY_CREDENTIALS.password}
							onChange={(event) => setPassword(event.target.value)}
						/>
					</Field>
					
					{error ? (
						<div className='login-error'>{error}</div>
					) : null}
					
					<button type='submit' className='login-button'>
						Sign in
					</button>
				</form>
				
				<div className='login-demo'>
					<div>Demo username: {DUMMY_CREDENTIALS.username}</div>
					<div>Demo password: {DUMMY_CREDENTIALS.password}</div>
				</div>
			</section>
		</main>
	)
}

function VoiceRxFullscreenView({
	                               canConnect,
	                               canDisconnect,
	                               canInteract,
	                               hasLiveToken,
	                               connect,
	                               disconnect,
	                               toggleMic,
	                               isMicOn,
	                               micStream,
	                               status,
	                               statusDetail,
	                               isSessionReady,
	                               transcript,
	                               digitizeState,
	                               clinicalResults,
	                               clinicalTab,
	                               setClinicalTab,
	                               textInput,
	                               setTextInput,
	                               onTextSubmit,
	                               onSubmit,
	                               onStopVoiceSubmit,
	                               onLogout,
	                               onSettings
                               }) {
	const hasTranscript = transcript.trim().length > 0
	const listening = canInteract && isMicOn
	const statusLabel = !hasLiveToken
		? 'Token required'
		: status === 'connecting'
			? 'Connecting'
			: listening
				? 'Listening'
				: isSessionReady
					? 'Ready'
					: status === 'error'
						? 'Attention needed'
						: 'Idle'
	const submitLabel = digitizeState === 'processing'
		? 'Processing'
		: digitizeState === 'complete'
			? 'Done'
			: digitizeState === 'empty'
				? 'No transcript'
				: digitizeState === 'error'
					? 'Retry'
					: 'Submit'
	const tabs = [
		{id: 'transcript', label: 'Transcript'},
		{id: 'soap', label: 'SOAP'},
		{id: 'icd', label: 'ICD'},
		{id: 'digitization', label: 'Digitization'}
	]
	
	return (
		<main className='voicerx-shell'>
			<div className='voicerx-aura' aria-hidden/>
			
			<header className='voicerx-topbar'>
				<div className='voicerx-mode-pill'>
					<span className='voicerx-back-mark'>
						<ChevronRight className='h-4 w-4 rotate-180'/>
					</span>
					<span>Dictation Mode</span>
				</div>
				
				<div className='voicerx-top-actions'>
					<button type='button' className='voicerx-ghost-button' onClick={onSettings}>
						Settings
					</button>
					<button type='button' className='voicerx-icon-button' onClick={onLogout} title='Log out'>
						<LogOut className='h-4 w-4'/>
					</button>
				</div>
			</header>
			
			<section className='voicerx-stage'>
				<div className='voicerx-title-block'>
					<div className='voicerx-brand'>
						<VoiceRxGlyph/>
						<span>VoiceRx</span>
					</div>
					<h1>Clinical voice capture</h1>
					<p>{statusDetail}</p>
				</div>
				
				<div className='voicerx-output-card'>
					<div className='voicerx-tabs'>
						{tabs.map((tab) => (
							<button
								key={tab.id}
								type='button'
								className={classNames('voicerx-tab', clinicalTab === tab.id && 'voicerx-tab-active')}
								onClick={() => setClinicalTab(tab.id)}
							>
								{tab.label}
							</button>
						))}
					</div>
					
				<div className='voicerx-transcript-frame'>
					<div className='voicerx-transcript-fade-top' aria-hidden/>
					<div className='voicerx-transcript-fade-bottom' aria-hidden/>
					{clinicalTab === 'transcript' && hasTranscript ? (
						<p className='voicerx-transcript-text'>
							{transcript}
							{listening ? <span className='voicerx-caret' aria-hidden/> : null}
						</p>
					) : clinicalTab === 'transcript' ? (
						<div className='voicerx-empty-copy'>
							<FileText className='h-11 w-11'/>
							<p>
								Start the Live session and speak. The realtime Gemini transcript will appear here.
							</p>
						</div>
					) : (
						<ClinicalResultPanel
							tab={clinicalTab}
							result={clinicalResults?.[clinicalTab]}
						/>
					)}
				</div>
				</div>
			</section>
			
				<footer className='voicerx-control-zone'>
					<div className='voicerx-text-composer'>
						<input
							className='voicerx-text-input'
							value={textInput}
							placeholder='Type clinical note instead of speaking...'
							onChange={(event) => setTextInput(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === 'Enter') {
									onTextSubmit()
								}
							}}
						/>
						<button
							type='button'
							className='voicerx-text-send'
							onClick={onTextSubmit}
							disabled={!textInput.trim()}
						>
							Add to Transcript
						</button>
					</div>
					
					<VoiceRxWaveform stream={micStream} paused={!listening}/>
					
						<div className='voicerx-controls'>
							<button
								type='button'
								className='voicerx-session-button'
								onClick={canDisconnect ? disconnect : connect}
								disabled={!canConnect && !canDisconnect}
								title={canDisconnect ? 'Disconnect' : 'Connect'}
							>
								{canDisconnect ? 'Disconnect' : 'Connect'}
							</button>
					
					<div className='voicerx-divider' aria-hidden/>
					
					<button
						type='button'
						className={classNames('voicerx-mic-button', isMicOn && 'voicerx-mic-button-active')}
						onClick={toggleMic}
						disabled={!canInteract}
					>
						{isMicOn ? <Mic className='h-5 w-5'/> : <MicOff className='h-5 w-5'/>}
					</button>
					
					<div className='voicerx-divider' aria-hidden/>
					
						{isMicOn ? (
							<button
								type='button'
								className='voicerx-stop-process-button'
								onClick={onStopVoiceSubmit}
								disabled={digitizeState === 'processing'}
							>
								<PhoneOff className='h-5 w-5'/>
								Stop & Process
							</button>
						) : (
							<button
								type='button'
								className={classNames(
									'voicerx-submit-button',
									digitizeState === 'complete' && 'voicerx-submit-button-complete'
								)}
								onClick={onSubmit}
								disabled={!hasTranscript || digitizeState === 'processing'}
							>
								{digitizeState === 'complete' ? <CheckCircle2 className='h-5 w-5'/> : null}
								{submitLabel}
							</button>
						)}
				</div>
				
				<div className='voicerx-status-card' role='status'>
					<span className={classNames('voicerx-status-dot', listening && 'voicerx-status-dot-live')}/>
					<span>{statusLabel}</span>
				</div>
			</footer>
		</main>
	)
}

function VoiceRxGlyph() {
	return (
		<svg width='18' height='15' viewBox='0 0 18 15' fill='none' aria-hidden>
			<path d='M.96 11.1A.96.96 0 0 1 0 10.14V4.63a.96.96 0 0 1 1.93 0v5.51a.96.96 0 0 1-.97.97Z' fill='currentColor'/>
			<path d='M4.82 12.95a.96.96 0 0 1-.96-.97V2.8a.96.96 0 0 1 1.93 0v9.18a.96.96 0 0 1-.97.97Z' fill='currentColor'/>
			<path d='M8.68 14.79a.96.96 0 0 1-.97-.97V.96a.96.96 0 0 1 1.93 0v12.86a.96.96 0 0 1-.96.97Z' fill='currentColor'/>
			<path d='M12.53 12.95a.96.96 0 0 1-.96-.97V2.8a.96.96 0 0 1 1.93 0v9.18a.96.96 0 0 1-.97.97Z' fill='currentColor'/>
			<path d='M16.39 11.1a.96.96 0 0 1-.96-.96V4.63a.96.96 0 0 1 1.93 0v5.51a.96.96 0 0 1-.97.97Z' fill='currentColor'/>
		</svg>
	)
}

function ClinicalResultPanel({tab, result}) {
	if (result?.status === 'pending') {
		return (
			<div className='voicerx-result-state'>
				<span className='voicerx-spinner' aria-hidden/>
				<p>Processing {tabLabel(tab)}...</p>
			</div>
		)
	}
	
	if (!result) {
		return (
			<div className='voicerx-result-state'>
				<FileText className='h-10 w-10'/>
				<p>Submit the transcript to generate {tabLabel(tab)} details.</p>
			</div>
		)
	}
	
	if (result.status === 'rejected') {
		return (
			<div className='voicerx-result-error'>
				<div className='font-semibold'>{tabLabel(tab)} unavailable</div>
				<p>{result.error}</p>
			</div>
		)
	}
	
	if (tab === 'soap') {
		return <SoapResult data={result.data}/>
	}
	
	return <StructuredResult data={result.data}/>
}

function tabLabel(tab) {
	return {
		digitization: 'Digitization',
		icd: 'ICD',
		soap: 'SOAP'
	}[tab] || 'Transcript'
}

function StructuredResult({data}) {
	if (!data || typeof data !== 'object') {
		return <pre className='voicerx-result-json'>{JSON.stringify(data, null, 2)}</pre>
	}
	
	return (
		<div className='voicerx-result-grid'>
			{Object.entries(data).map(([key, value]) => (
				<section key={key} className='voicerx-result-section'>
					<h3>{formatResultKey(key)}</h3>
					<ResultValue value={value}/>
				</section>
			))}
		</div>
	)
}

function ResultValue({value}) {
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return <p className='voicerx-muted'>Not documented</p>
		}
		
		return (
			<div className='space-y-2'>
				{value.map((item, index) => (
					<div key={`${index}-${JSON.stringify(item).slice(0, 24)}`} className='voicerx-result-item'>
						<ResultValue value={item}/>
					</div>
				))}
			</div>
		)
	}
	
	if (value && typeof value === 'object') {
		const entries = Object.entries(value).filter(([, entryValue]) => {
			if (Array.isArray(entryValue)) {
				return entryValue.length > 0
			}
			return entryValue !== '' && entryValue !== null && entryValue !== undefined
		})
		
		if (entries.length === 0) {
			return <p className='voicerx-muted'>Not documented</p>
		}
		
		return (
			<div className='voicerx-kv-list'>
				{entries.map(([key, entryValue]) => (
					<div key={key} className='voicerx-kv-row'>
						<span>{formatResultKey(key)}</span>
						<div><ResultValue value={entryValue}/></div>
					</div>
				))}
			</div>
		)
	}
	
	if (value === '' || value === null || value === undefined) {
		return <p className='voicerx-muted'>Not documented</p>
	}
	
	return <p className='voicerx-result-text'>{String(value)}</p>
}

function SoapResult({data}) {
	const sections = ['subjective', 'objective', 'assessment', 'plan']
	
	return (
		<div className='voicerx-result-grid'>
			{sections.map((section) => (
				<section key={section} className='voicerx-result-section'>
					<h3>{formatResultKey(section)}</h3>
					<p className='voicerx-result-text whitespace-pre-wrap'>
						{rtfToReadableText(data?.[section]) || 'Not documented'}
					</p>
				</section>
			))}
		</div>
	)
}

function rtfToReadableText(value) {
	if (!value) {
		return ''
	}
	
	return String(value)
		.replace(/\\'[0-9a-fA-F]{2}/g, '')
		.replace(/\\bullet/g, '•')
		.replace(/\\par[d]?/g, '\n')
		.replace(/\\[a-zA-Z]+-?\d* ?/g, '')
		.replace(/[{}]/g, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
}

function formatResultKey(key) {
	return key
		.replace(/([A-Z])/g, ' $1')
		.replace(/[_-]+/g, ' ')
		.replace(/^./, (letter) => letter.toUpperCase())
}

function PlaygroundView({
	                        canConnect,
	                        canDisconnect,
	                        canInteract,
	                        hasLiveToken,
	                        connect,
	                        disconnect,
	                        toggleMic,
	                        toggleCamera,
	                        toggleScreen,
	                        isMicOn,
	                        isCameraOn,
	                        isScreenOn,
	                        messages,
	                        chatInput,
	                        setChatInput,
	                        sendTextMessage,
	                        conversationFeedRef,
	                        handleStageWheel,
	                        previewRef,
	                        previewStream,
	                        previewTitle
                        }) {
	const showFeed = messages.length > 1
	const showPreview = Boolean(previewStream)
	
	return (
		<div className='playground-layout'>
			<section className='playground-stage' onWheel={showFeed ? handleStageWheel : undefined}>
				{showFeed ? (
					<div className='conversation-shell'>
						<div ref={conversationFeedRef} className='conversation-feed'>
							{messages.map((message) => (
								<ChatBubble key={message.id} message={message}/>
							))}
						</div>
					</div>
				) : (
					<div className='playground-empty'>
						<h1 className='font-display text-5xl tracking-tight text-white'>
							Talk to Gemini live
						</h1>
						<div className='mt-6 flex flex-wrap items-center justify-center gap-3'>
							<StageButton
								label={canDisconnect ? 'Disconnect' : 'Connect'}
								onClick={canDisconnect ? disconnect : connect}
								active={canDisconnect}
								disabled={!canConnect && !canDisconnect}
								icon={
									canDisconnect ? (
										<PhoneOff className='h-4 w-4'/>
									) : (
										<PhoneCall className='h-4 w-4'/>
									)
								}
							/>
							<StageButton
								label={isMicOn ? 'Stop Voice Input' : 'Start Voice Input'}
								onClick={toggleMic}
								active={isMicOn}
								disabled={!canInteract}
								icon={isMicOn ? <Mic className='h-4 w-4'/> : <MicOff className='h-4 w-4'/>}
							/>
							<StageButton
								label={isCameraOn ? 'Stop Webcam' : 'Webcam'}
								onClick={toggleCamera}
								active={isCameraOn}
								disabled={!canInteract}
								icon={isCameraOn ? <Camera className='h-4 w-4'/> : <CameraOff className='h-4 w-4'/>}
							/>
							<StageButton
								label={isScreenOn ? 'Stop Share' : 'Share Screen'}
								onClick={toggleScreen}
								active={isScreenOn}
								disabled={!canInteract}
								icon={isScreenOn ? <ScreenShare className='h-4 w-4'/> : <ScreenShareOff className='h-4 w-4'/>}
							/>
						</div>
						<div className='playground-hint'>
							{canInteract
								? 'Session ready. Start speaking or type below.'
								: hasLiveToken
									? 'Connect first before starting voice input.'
									: 'Generate a token first, then connect.'}
						</div>
					</div>
				)}
				
				{showPreview ? (
					<div className='stage-preview-frame'>
						<div className='preview-frame-label'>{previewTitle}</div>
						<video
							ref={previewRef}
							autoPlay
							playsInline
							muted
							className='h-full w-full object-cover'
						/>
					</div>
				) : null}
			</section>
			
			<div className='composer-shell'>
				<div className='composer-inner'>
					<input
						className='composer-input'
						value={chatInput}
						disabled={!canInteract}
						placeholder={
							canInteract
								? 'Start typing a prompt'
								: hasLiveToken
									? 'Connect and wait for session setup'
									: 'Generate a token, then connect'
						}
						onChange={(event) => setChatInput(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								sendTextMessage()
							}
						}}
					/>
					
					<div className='composer-toolbar'>
						<div className='flex items-center gap-2'>
							<RoundIconButton
								onClick={toggleMic}
								disabled={!canInteract}
								title='Talk'
								icon={isMicOn ? <Mic className='h-4 w-4'/> : <MicOff className='h-4 w-4'/>}
							/>
							<RoundIconButton
								onClick={toggleCamera}
								disabled={!canInteract}
								title='Webcam'
								icon={isCameraOn ? <Camera className='h-4 w-4'/> : <CameraOff className='h-4 w-4'/>}
							/>
							<RoundIconButton
								onClick={toggleScreen}
								disabled={!canInteract}
								title='Screen'
								icon={isScreenOn ? <ScreenShare className='h-4 w-4'/> : <ScreenShareOff className='h-4 w-4'/>}
							/>
							<button
								type='button'
								className='run-button'
								onClick={sendTextMessage}
								disabled={!canInteract}
							>
								Send
								<Send className='h-4 w-4'/>
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

function SettingsView({
	                      settings,
	                      updateSetting,
	                      selectedMic,
	                      setSelectedMic,
	                      micOptions,
	                      selectedCamera,
	                      setSelectedCamera,
	                      cameraOptions,
	                      debugLines,
	                      setupJson
                      }) {
	return (
		<div className='settings-layout'>
			<section className='settings-column'>
				<SettingsCard
					title='Model'
					body={
						<>
							<div className='settings-value-card'>
								<div className='text-sm font-medium text-white'>{FIXED_MODEL_ID}</div>
								<div className='mt-1 text-xs leading-6 text-slate-500'>
									Low-latency audio-to-audio model with transcription and multimodal support.
								</div>
							</div>
						</>
					}
				/>
				
				<SettingsCard
					title='Voice'
					body={
						<Field label='Voice'>
							<select
								className='settings-input'
								value={settings.voiceName}
								onChange={(event) => updateSetting('voiceName', event.target.value)}
							>
								{VOICE_OPTIONS.map((voice) => (
									<option key={voice} value={voice}>
										{voice}
									</option>
								))}
							</select>
						</Field>
					}
				/>
				
				<SettingsCard
					title='Input devices'
					body={
						<div className='space-y-4'>
							<Field label='Microphone'>
								<select
									className='settings-input'
									value={selectedMic}
									onChange={(event) => setSelectedMic(event.target.value)}
								>
									<option value=''>Default microphone</option>
									{micOptions.map((device) => (
										<option key={device.deviceId} value={device.deviceId}>
											{device.label || `Microphone ${device.deviceId.slice(0, 6)}`}
										</option>
									))}
								</select>
							</Field>
							<Field label='Camera'>
								<select
									className='settings-input'
									value={selectedCamera}
									onChange={(event) => setSelectedCamera(event.target.value)}
								>
									<option value=''>Default camera</option>
									{cameraOptions.map((device) => (
										<option key={device.deviceId} value={device.deviceId}>
											{device.label || `Camera ${device.deviceId.slice(0, 6)}`}
										</option>
									))}
								</select>
							</Field>
						</div>
					}
				/>
			</section>
			
			<section className='settings-column'>
				<SettingsCard
					title='Transcription'
					body={
						<div className='space-y-3'>
							<InlineToggle
								label='Enable input transcription'
								checked={settings.enableInputTranscription}
								onChange={(event) =>
									updateSetting('enableInputTranscription', event.target.checked)
								}
							/>
							<InlineToggle
								label='Enable output transcription'
								checked={settings.enableOutputTranscription}
								onChange={(event) =>
									updateSetting('enableOutputTranscription', event.target.checked)
								}
							/>
						</div>
					}
				/>
				
				<SettingsCard
					title='Session Context'
					body={
						<div className='space-y-4'>
							<RangeField
								label={`Temperature ${settings.temperature.toFixed(1)}`}
								min={0.1}
								max={2}
								step={0.1}
								value={settings.temperature}
								className='settings-slider'
								onChange={(event) =>
									updateSetting('temperature', Number(event.target.value))
								}
							/>
							<RangeField
								label={`Output volume ${settings.volume}%`}
								min={0}
								max={100}
								step={1}
								value={settings.volume}
								className='settings-slider'
								onChange={(event) =>
									updateSetting('volume', Number(event.target.value))
								}
							/>
							<InlineToggle
								label='Enable Google grounding'
								checked={settings.enableGrounding}
								onChange={(event) =>
									updateSetting('enableGrounding', event.target.checked)
								}
							/>
						</div>
					}
				/>
				
				<SettingsCard
					title='VAD'
					body={
						<div className='space-y-4'>
							<InlineToggle
								label='Disable automatic activity detection'
								checked={settings.disableActivityDetection}
								onChange={(event) =>
									updateSetting('disableActivityDetection', event.target.checked)
								}
							/>
							<div className='grid gap-4 md:grid-cols-2'>
								<Field label='Silence duration (ms)'>
									<input
										className='settings-input'
										type='number'
										min='500'
										max='10000'
										step='100'
										value={settings.silenceDurationMs}
										onChange={(event) =>
											updateSetting('silenceDurationMs', Number(event.target.value))
										}
									/>
								</Field>
								<Field label='Prefix padding (ms)'>
									<input
										className='settings-input'
										type='number'
										min='0'
										max='2000'
										step='100'
										value={settings.prefixPaddingMs}
										onChange={(event) =>
											updateSetting('prefixPaddingMs', Number(event.target.value))
										}
									/>
								</Field>
								<Field label='End sensitivity'>
									<select
										className='settings-input'
										value={settings.endOfSpeechSensitivity}
										onChange={(event) =>
											updateSetting('endOfSpeechSensitivity', event.target.value)
										}
									>
										{END_SENSITIVITY_OPTIONS.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</Field>
								<Field label='Start sensitivity'>
									<select
										className='settings-input'
										value={settings.startOfSpeechSensitivity}
										onChange={(event) =>
											updateSetting('startOfSpeechSensitivity', event.target.value)
										}
									>
										{START_SENSITIVITY_OPTIONS.map((option) => (
											<option key={option.value} value={option.value}>
												{option.label}
											</option>
										))}
									</select>
								</Field>
							</div>
							<Field label='Activity handling'>
								<select
									className='settings-input'
									value={settings.activityHandling}
									onChange={(event) =>
										updateSetting('activityHandling', event.target.value)
									}
								>
									{ACTIVITY_HANDLING_OPTIONS.map((option) => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</Field>
						</div>
					}
				/>
			</section>
			
			<section className='settings-column'>
				<SettingsCard
					title='Debug'
					body={
						<div className='debug-panel'>
							{debugLines.map((line) => (
								<div key={line} className='debug-line'>
									{line}
								</div>
							))}
						</div>
					}
				/>
				
				<SettingsCard
					title='Setup JSON'
					body={<pre className='settings-code'>{setupJson}</pre>}
				/>
			</section>
		</div>
	)
}

function SystemView({
	                    systemInstructions,
	                    setSystemInstructions,
	                    resetSystemInstructions
                    }) {
	return (
		<div className='system-layout'>
			<section className='system-editor-card'>
				<div className='mb-6'>
					<div className='flex flex-wrap items-start justify-between gap-4'>
						<div>
							<div className='text-xs uppercase tracking-[0.24em] text-slate-500'>
								System instructions
							</div>
							<h1 className='mt-3 font-display text-4xl text-white'>
								Define how Gemini should behave.
							</h1>
							<p className='mt-3 max-w-3xl text-sm leading-7 text-slate-400'>
								Keep this focused on tone, style, safety, and tool behavior. This page is
								intentionally separate from the playground so the main chat stays clean.
							</p>
						</div>
						
						<button
							type='button'
							className='run-button'
							onClick={resetSystemInstructions}
						>
							Restore default prompt
						</button>
					</div>
				</div>
				
				<textarea
					className='system-editor'
					value={systemInstructions}
					onChange={(event) => setSystemInstructions(event.target.value)}
				/>
			</section>
		</div>
	)
}

function SidebarLink({icon, label, active, onClick}) {
	const IconComponent = icon
	
	return (
		<button
			type='button'
			className={classNames('sidebar-link', active && 'sidebar-link-active')}
			onClick={onClick}
			title={label}
		>
			<div className='flex items-center gap-3'>
				<IconComponent className='h-4 w-4'/>
				<span className='sidebar-link-label'>{label}</span>
			</div>
			<ChevronRight className='h-4 w-4 text-slate-600 transition-opacity duration-200'/>
		</button>
	)
}

function StatusPill({status, ready, detail}) {
	return (
		<div
			className={classNames(
				'status-pill',
				ready && 'status-pill-ready',
				status === 'error' && 'status-pill-error'
			)}
		>
			<span className='h-2 w-2 rounded-full bg-current'/>
			<span>{detail}</span>
		</div>
	)
}

function StageButton({label, onClick, active, disabled, icon}) {
	return (
		<button
			type='button'
			onClick={onClick}
			disabled={disabled}
			className={classNames('stage-button', active && 'stage-button-active')}
		>
			{icon}
			{label}
		</button>
	)
}

function RoundIconButton({onClick, disabled, title, icon}) {
	return (
		<button type='button' className='round-icon-button' onClick={onClick} disabled={disabled} title={title}>
			{icon}
		</button>
	)
}

function SettingsCard({title, body}) {
	return (
		<section className='settings-card'>
			<div className='mb-4 text-sm font-semibold text-white'>{title}</div>
			{body}
		</section>
	)
}

function Field({label, children}) {
	return (
		<label className='space-y-2 text-sm text-slate-300'>
			<div>{label}</div>
			{children}
		</label>
	)
}

function RangeField({label, className, ...props}) {
	return (
		<label className='space-y-2 text-sm text-slate-300'>
			<div>{label}</div>
			<input type='range' className={classNames('slider', className)} {...props} />
		</label>
	)
}

function InlineToggle({label, checked, onChange}) {
	return (
		<label className='inline-toggle'>
			<span>{label}</span>
			<input type='checkbox' className='h-4 w-4 accent-slate-200' checked={checked} onChange={onChange}/>
		</label>
	)
}

function ChatBubble({message}) {
	const [isExpanded, setIsExpanded] = useState(false)
	const bubbleClass = {
		user: 'chat-bubble-user',
		assistant: 'chat-bubble-assistant',
		system: 'chat-bubble-system',
		tool: 'chat-bubble-tool',
		'user-transcript': 'chat-bubble-user-transcript',
		'assistant-transcript': 'chat-bubble-assistant-transcript'
	}[message.kind]
	
	const label = {
		user: 'You',
		assistant: 'Gemini',
		system: 'System',
		tool: 'Tool',
		'user-transcript': 'You, transcribed',
		'assistant-transcript': 'Gemini, transcribed'
	}[message.kind]
	
	const toolSummary = (() => {
		if (message.kind !== 'tool') {
			return null
		}
		
		const match = message.text.match(/^Tool\s+([a-z_]+)\s+returned/i)
		if (match) {
			return `${match[1]} result`
		}
		
		return 'Tool result'
	})()
	
	return (
		<article className={classNames('chat-bubble', bubbleClass)}>
			<div className='mb-2 text-[10px] uppercase tracking-[0.2em] text-white/45'>{label}</div>
			{message.kind === 'tool' ? (
				<div className='space-y-3'>
					<button
						type='button'
						className='flex w-full items-center justify-between gap-4 py-1 text-left text-sm text-white/90 transition hover:text-white'
						onClick={() => setIsExpanded((current) => !current)}
					>
						<span>{toolSummary}</span>
						<span className='text-xs uppercase tracking-[0.16em] text-white/50'>
              {isExpanded ? 'Collapse' : 'Expand'}
            </span>
					</button>
					
					{isExpanded ? (
						<pre className='whitespace-pre-wrap break-all text-sm leading-6'>
              {message.text}
            </pre>
					) : null}
				</div>
			) : (
				<div className='whitespace-pre-wrap text-base leading-6'>{message.text}</div>
			)}
		</article>
	)
}

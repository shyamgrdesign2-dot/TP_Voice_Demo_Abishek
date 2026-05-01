import {ClipboardCopy, Printer, LogOut, Check, AlertCircle, Copy} from 'lucide-react'
import {Microphone2, DocumentText, DocumentCode, DocumentFilter} from 'iconsax-reactjs'
import {useEffect, useMemo, useState} from 'react'
import {RichEditor} from './RichEditor.jsx'
import {digitizationToHtml, icdToHtml, soapToHtml} from '../lib/result-formatters.js'

const TABS = [
	{id: 'transcript', label: 'Transcript'},
	{id: 'soap', label: 'SOAP Notes'},
	{id: 'icd', label: 'ICD Codes'},
	{id: 'digitization', label: 'Clinical Notes'}
]

function TabIcon({id, active}) {
	if (id === 'transcript') return <Microphone2 size={15} variant={active ? "Bulk" : "Linear"} color="currentColor" />
	if (id === 'soap') return <DocumentText size={15} variant={active ? "Bulk" : "Linear"} color="currentColor" />
	if (id === 'icd') return <DocumentCode size={15} variant={active ? "Bulk" : "Linear"} color="currentColor" />
	if (id === 'digitization') return <DocumentFilter size={15} variant={active ? "Bulk" : "Linear"} color="currentColor" />
	return null
}

function escapeHtml(value) {
	if (value == null) return ''
	return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function transcriptToHtml(text) {
	if (!text?.trim()) return '<p><em>No transcript captured.</em></p>'
	return text
		.split(/\n{2,}/)
		.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
		.join('')
}

function htmlFromResult(tab, result, transcript) {
	if (tab === 'transcript') return transcriptToHtml(transcript)
	if (!result || result.status === 'pending') return null
	if (result.status === 'rejected') return null
	if (tab === 'soap') return soapToHtml(result.data)
	if (tab === 'icd') return icdToHtml(result.data)
	if (tab === 'digitization') return digitizationToHtml(result.data)
	return ''
}

function htmlToText(html) {
	const tmp = document.createElement('div')
	tmp.innerHTML = html ?? ''
	return tmp.innerText.trim()
}

export function ResultsView({clinicalResults, transcript, activeTab, setActiveTab, onNewSession, isPastSession}) {
	const [editedHtml, setEditedHtml] = useState({transcript: '', soap: '', icd: '', digitization: ''})
	const [toast, setToast] = useState('')

	useEffect(() => {
		setEditedHtml((current) => {
			const next = {...current}
			let changed = false
			if (!current.transcript) {
				next.transcript = transcriptToHtml(transcript)
				changed = true
			}
			for (const id of ['soap', 'icd', 'digitization']) {
				const result = clinicalResults?.[id]
				if (!result || result.status !== 'fulfilled') continue
				if (!current[id]) {
					next[id] = htmlFromResult(id, result, transcript) ?? ''
					changed = true
				}
			}
			return changed ? next : current
		})
	}, [clinicalResults, transcript])

	const activeResult = activeTab === 'transcript' ? {status: 'fulfilled'} : clinicalResults?.[activeTab]
	const isPending = activeTab !== 'transcript' && (!activeResult || activeResult.status === 'pending')
	const isError = activeResult?.status === 'rejected'

	const showToast = (msg) => {
		setToast(msg)
		window.setTimeout(() => setToast(''), 1800)
	}

	function handleCopy() {
		const text = htmlToText(editedHtml[activeTab])
		if (!text) return
		navigator.clipboard?.writeText(text).then(
			() => showToast('Copied to clipboard'),
			() => showToast('Copy failed')
		)
	}

	const tabState = useMemo(() => {
		const map = {transcript: 'fulfilled'}
		for (const id of ['soap', 'icd', 'digitization']) {
			const r = clinicalResults?.[id]
			map[id] = !r ? 'pending' : r.status === 'pending' ? 'pending' : r.status
		}
		return map
	}, [clinicalResults])

	return (
		<>
			<section className='vrx-results-zone bg-tp-slate-100 border-b border-tp-slate-200'>
				<div className='px-4 pt-4 pb-2'>
					<div className="vrx-cn-tabs flex h-[44px] w-full items-stretch gap-[4px] overflow-x-auto rounded-[14px] bg-tp-slate-100 p-[5px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.04)'}}>
						{TABS.map((tab) => {
							const state = tabState[tab.id]
							const active = activeTab === tab.id
							
							const baseClass = "flex-1 flex items-center justify-center gap-[6px] whitespace-nowrap rounded-[10px] px-[10px] text-[13px] font-semibold tracking-tight transition-all duration-200"
							const activeClass = "bg-white text-tp-blue-600 shadow-[0_1px_3px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)]"
							const inactiveClass = "text-tp-slate-600 bg-tp-slate-50 hover:bg-white/50 hover:text-tp-slate-900"
							
							return (
								<button
									key={tab.id}
									type='button'
									className={`${baseClass} ${active ? activeClass : inactiveClass}`}
									onClick={() => setActiveTab(tab.id)}
								>
									<TabIcon id={tab.id} active={active} />
									<span>{tab.label}</span>
									{state === 'fulfilled' ? (
										<Check className='ml-1 inline-block h-3 w-3' style={{color: 'var(--tp-success-600)'}}/>
									) : state === 'rejected' ? (
										<AlertCircle className='ml-1 inline-block h-3 w-3' style={{color: 'var(--tp-error-600)'}}/>
									) : null}
								</button>
							)
						})}
					</div>
				</div>

				<div className='vrx-result-panel flex min-h-0 flex-1 flex-col'>
					{isError ? (
						<div className='p-6'>
							<div className='rounded-xl border px-4 py-3 text-sm' style={{borderColor: 'var(--tp-error-100)', background: 'var(--tp-error-50)', color: 'var(--tp-error-700)'}}>
								<strong>Couldn't generate this section.</strong>
								<div className='mt-1'>{activeResult.error || 'Unknown error.'}</div>
							</div>
						</div>
					) : activeTab === 'transcript' ? (
						<div className='min-h-0 flex-1 overflow-y-auto px-6 py-5 text-sm leading-7 text-tp-slate-500 pointer-events-none select-none' style={{backgroundColor: '#F1F5F9', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'}}>
							<div dangerouslySetInnerHTML={{__html: editedHtml[activeTab] || '<p><em>No transcript.</em></p>'}} />
						</div>
					) : (
						<RichEditor
							html={editedHtml[activeTab]}
							onChange={(html) => setEditedHtml((current) => ({...current, [activeTab]: html}))}
						/>
					)}
				</div>

				{/* Bottom action bar */}
				<div className='flex items-center justify-between border-t px-4 py-4' style={{borderColor: 'var(--tp-slate-200)'}}>
					<div className='flex flex-1 justify-center items-center gap-[12px]'>
						{activeTab !== 'transcript' ? (
							<>
								<button type='button' className='tp-btn-primary min-w-[140px] justify-center' disabled={isPending || isError} onClick={handleCopy}>
									{toast === 'Copied' ? <Check className='h-4 w-4'/> : <Copy className='h-4 w-4'/>}
									<span>{toast === 'Copied' ? 'Copied' : `Copy ${TABS.find(t => t.id === activeTab)?.label}`}</span>
								</button>
								<button type='button' className='tp-btn-primary min-w-[140px] justify-center' disabled={isPending || isError} onClick={() => window.print()}>
									<Printer className='h-4 w-4'/>
									<span>{`Print ${TABS.find(t => t.id === activeTab)?.label}`}</span>
								</button>
							</>
						) : (
							<span className='text-[13px] text-tp-slate-400 font-medium'>Transcript is read-only</span>
						)}
					</div>
					{!isPastSession && (
						<button
							type='button'
							className='absolute right-4 flex h-[38px] items-center justify-center gap-[6px] rounded-[10px] px-[14px] text-[13px] font-semibold transition-all hover:bg-[#FEE2E2] active:scale-[0.96] ring-1 ring-inset ring-red-500/10'
							style={{color: 'var(--tp-error-600, #DC2626)', backgroundColor: '#FEF2F2'}}
							onClick={onNewSession}
						>
							<LogOut className='h-4 w-4'/>
							<span>End session</span>
						</button>
					)}
				</div>
			</section>

			{/* Hidden Print Layer */}
			<div className="hidden print:block absolute inset-0 bg-white z-[9999]">
				<article className="flex w-full flex-col bg-white" style={{aspectRatio: '210 / 297'}}>
					<header className="mb-[14px] rounded-[6px] px-[10px] py-[8px]" style={{background: 'rgba(241, 241, 245, 0.6)'}}>
						<div className="flex items-start justify-between gap-[12px]">
							<div className="flex items-start gap-[12px]">
								<div className="flex h-[64px] w-[64px] items-center justify-center rounded-[8px] bg-tp-blue-50 text-tp-blue-600">
									<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 12h4"></path><path d="M10 8h4"></path><path d="M14 21v-3a2 2 0 0 0-4 0v3"></path><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"></path><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"></path></svg>
								</div>
								<div>
									<p className="text-[16px] font-semibold leading-[20px] text-tp-blue-700">TP Clinic</p>
									<p className="text-[12px] font-medium leading-[16px] text-tp-slate-700">Dr. Umesh Aggarwal, MBBS, MD</p>
									<p className="text-[10px] leading-[14px] text-tp-slate-600">Reg. ID: KMC-2342342 | +91 78945 61230</p>
									<p className="text-[10px] leading-[14px] text-tp-slate-600">K9 Sardar Bungalow, Prahladnagar, Ahmedabad</p>
								</div>
							</div>
						</div>
					</header>
					<div className="h-px w-full bg-tp-slate-300" aria-hidden="true"></div>
					<section className="py-[8px]">
						<div className="flex items-start justify-between gap-[24px]">
							<div className="flex min-w-0 flex-1 flex-col gap-[2px]">
								<p className="text-[12px] leading-[16px] text-tp-slate-700"><span className="font-semibold text-tp-slate-900">Patient Name:</span> Ramesh Kumar</p>
								<p className="text-[12px] leading-[16px] text-tp-slate-700"><span className="font-semibold text-tp-slate-900">Age/Gender:</span> 76 Years, Male</p>
								<p className="text-[12px] leading-[16px] text-tp-slate-700"><span className="font-semibold text-tp-slate-900">Address:</span> Prahladnagar, Ahmedabad</p>
							</div>
							<div className="flex shrink-0 flex-col gap-[2px] text-right">
								<p className="text-[12px] leading-[16px] text-tp-slate-700"><span className="font-semibold text-tp-slate-900">Patient ID:</span> apt-ramesh-ckd</p>
								<p className="text-[12px] leading-[16px] text-tp-slate-700"><span className="font-semibold text-tp-slate-900">Date:</span> 01 May 2026</p>
							</div>
						</div>
					</section>
					<div className="h-px w-full bg-tp-slate-300" aria-hidden="true"></div>
					<div className="flex-1 overflow-hidden">
						<div className="flex flex-col gap-[10px] py-[8px]">
							<div className='font-semibold text-[14px] mt-2 mb-1'>{TABS.find(t => t.id === activeTab)?.label || activeTab}</div>
							<div className='tp-print-content text-[12px]' dangerouslySetInnerHTML={{__html: editedHtml[activeTab] || '<p><em>No content.</em></p>'}} />
						</div>
					</div>
					<div className="h-px w-full bg-tp-slate-300" aria-hidden="true"></div>
					<footer className="pt-[10px]">
						<p className="text-right text-[10px] leading-[14px] text-tp-slate-500">support@tpclinic.com | www.tpclinic.com</p>
					</footer>
				</article>
			</div>

			{toast ? <div className='tp-toast'>{toast}</div> : null}
		</>
	)
}

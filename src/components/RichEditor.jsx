import {Bold, Heading1, Heading2, Italic, List, ListOrdered, Type} from 'lucide-react'
import {useEffect, useRef} from 'react'
import {Tooltip} from './Tooltip.jsx'

function exec(command, value) {
	document.execCommand(command, false, value)
}

export function RichEditor({html, onChange, placeholder = 'Edit notes…'}) {
	const ref = useRef(null)
	const lastHtmlRef = useRef(html ?? '')

	useEffect(() => {
		const el = ref.current
		if (!el) return
		// Only update DOM when external html differs from what user is typing.
		if ((html ?? '') !== lastHtmlRef.current) {
			el.innerHTML = html ?? ''
			lastHtmlRef.current = html ?? ''
		}
	}, [html])

	function handleInput() {
		const el = ref.current
		if (!el) return
		lastHtmlRef.current = el.innerHTML
		onChange?.(el.innerHTML)
	}

	function applyFormat(command, value) {
		exec(command, value)
		// trigger change after format
		const el = ref.current
		if (el) {
			lastHtmlRef.current = el.innerHTML
			onChange?.(el.innerHTML)
		}
	}

	return (
		<div className='tp-rich-editor-wrap flex min-h-0 flex-1 flex-col'>
			<div className='tp-rich-toolbar border-b px-4 py-1.5' style={{borderColor: 'var(--tp-slate-200)'}}>
				<Tooltip label='Heading 1'>
					<button type='button' onClick={() => applyFormat('formatBlock', 'H1')}>
						<Heading1 className='h-4 w-4'/>
					</button>
				</Tooltip>
				<Tooltip label='Heading 2'>
					<button type='button' onClick={() => applyFormat('formatBlock', 'H2')}>
						<Heading2 className='h-4 w-4'/>
					</button>
				</Tooltip>
				<Tooltip label='Paragraph'>
					<button type='button' onClick={() => applyFormat('formatBlock', 'P')}>
						<Type className='h-4 w-4'/>
					</button>
				</Tooltip>
				<span className='mx-1 h-5 w-px' style={{background: 'var(--tp-slate-200)'}}/>
				<Tooltip label='Bold'>
					<button type='button' onClick={() => applyFormat('bold')}>
						<Bold className='h-4 w-4'/>
					</button>
				</Tooltip>
				<Tooltip label='Italic'>
					<button type='button' onClick={() => applyFormat('italic')}>
						<Italic className='h-4 w-4'/>
					</button>
				</Tooltip>
				<span className='mx-1 h-5 w-px' style={{background: 'var(--tp-slate-200)'}}/>
				<Tooltip label='Bullet list'>
					<button type='button' onClick={() => applyFormat('insertUnorderedList')}>
						<List className='h-4 w-4'/>
					</button>
				</Tooltip>
				<Tooltip label='Numbered list'>
					<button type='button' onClick={() => applyFormat('insertOrderedList')}>
						<ListOrdered className='h-4 w-4'/>
					</button>
				</Tooltip>
			</div>
			<div
				ref={ref}
				className='tp-rich-editor'
				contentEditable
				suppressContentEditableWarning
				data-placeholder={placeholder}
				onInput={handleInput}
				spellCheck
			/>
		</div>
	)
}

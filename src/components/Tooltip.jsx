import {useRef, useState} from 'react'

/**
 * TP-style tooltip — dark pill with arrow, shows instantly on hover.
 * Usage: <Tooltip label="Session history"><button>...</button></Tooltip>
 */
export function Tooltip({label, children, side = 'bottom'}) {
	const [show, setShow] = useState(false)
	const [pos, setPos] = useState({x: 0, y: 0})
	const triggerRef = useRef(null)

	function handleEnter() {
		const el = triggerRef.current
		if (!el) return
		const rect = el.getBoundingClientRect()
		if (side === 'bottom') {
			setPos({x: rect.left + rect.width / 2, y: rect.bottom + 6})
		} else {
			setPos({x: rect.left + rect.width / 2, y: rect.top - 6})
		}
		setShow(true)
	}

	return (
		<span
			ref={triggerRef}
			className='inline-flex'
			onMouseEnter={handleEnter}
			onMouseLeave={() => setShow(false)}
			onFocus={handleEnter}
			onBlur={() => setShow(false)}
		>
			{children}
			{show && label ? (
				<span
					className='tp-tooltip'
					style={{
						position: 'fixed',
						left: pos.x,
						top: side === 'bottom' ? pos.y : undefined,
						bottom: side === 'top' ? `calc(100vh - ${pos.y}px)` : undefined,
						transform: 'translateX(-50%)',
						zIndex: 9999
					}}
					role='tooltip'
				>
					{label}
					<span className={`tp-tooltip-arrow ${side === 'top' ? 'tp-tooltip-arrow--top' : ''}`} aria-hidden='true'/>
				</span>
			) : null}
		</span>
	)
}

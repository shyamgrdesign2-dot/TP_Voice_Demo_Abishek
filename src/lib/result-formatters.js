function escapeHtml(value) {
	if (value == null) return ''
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
}

// Strip RTF control words while preserving plain text. Falls back to escaping
// the raw string when no RTF markers are present.
function rtfToHtml(rtf) {
	if (!rtf) return ''
	if (typeof rtf !== 'string') return ''

	const looksLikeRtf = rtf.trim().startsWith('{\\rtf') || rtf.includes('\\par') || rtf.includes('\\b ')
	if (!looksLikeRtf) {
		// Treat newlines as paragraph breaks.
		return rtf
			.split(/\n{2,}/)
			.map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br/>')}</p>`)
			.join('')
	}

	// Naive RTF stripper: remove groups, control words, and braces.
	const cleaned = rtf
		.replace(/\\par[d]?\b/g, '\n')
		.replace(/\\line\b/g, '\n')
		.replace(/\\(?:[a-zA-Z]+-?\d* ?|[^a-zA-Z])/g, '')
		.replace(/[{}]/g, '')
		.trim()

	return cleaned
		.split(/\n{2,}/)
		.map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br/>')}</p>`)
		.join('')
}

export function soapToHtml(data) {
	if (!data) return ''
	const sections = [
		{key: 'subjective', label: 'Subjective'},
		{key: 'objective', label: 'Objective'},
		{key: 'assessment', label: 'Assessment'},
		{key: 'plan', label: 'Plan'}
	]
	return sections
		.map(({key, label}) => {
			const body = rtfToHtml(data[key]) || '<p><em>Not mentioned.</em></p>'
			return `<h2>${label}</h2>${body}`
		})
		.join('')
}

export function icdToHtml(data) {
	if (!data?.symptoms?.length) return '<p><em>No symptoms with ICD codes were extracted.</em></p>'
	return data.symptoms
		.map((sym) => {
			const coding = (sym.icd11Coding ?? [])
				.map(
					(code) =>
						`<li><strong>${escapeHtml(code.code)}</strong> — ${escapeHtml(code.displayName)}${
							code.type ? ` <em>(${escapeHtml(code.type)})</em>` : ''
						}</li>`
				)
				.join('')
			const meta = []
			if (sym.duration) meta.push(`Duration: ${escapeHtml(sym.duration)}`)
			if (sym.severity) meta.push(`Severity: ${escapeHtml(sym.severity)}`)
			if (sym.notes) meta.push(`Notes: ${escapeHtml(sym.notes)}`)
			return `
				<h3>${escapeHtml(sym.name || 'Symptom')}</h3>
				${meta.length ? `<p>${meta.join(' · ')}</p>` : ''}
				${coding ? `<ul>${coding}</ul>` : '<p><em>No ICD-11 codes returned.</em></p>'}
			`
		})
		.join('')
}

function kvList(label, obj, keyOrder) {
	const keys = keyOrder ?? Object.keys(obj || {})
	const rows = keys
		.map((k) => {
			const v = obj?.[k]
			if (v == null || v === '') return ''
			return `<li><strong>${escapeHtml(humanize(k))}:</strong> ${escapeHtml(v)}</li>`
		})
		.filter(Boolean)
		.join('')
	if (!rows) return ''
	return `<h3>${label}</h3><ul>${rows}</ul>`
}

function humanize(key) {
	return key
		.replace(/([A-Z])/g, ' $1')
		.replace(/^./, (c) => c.toUpperCase())
		.trim()
}

function arraySection(label, arr, formatter) {
	if (!arr?.length) return ''
	const items = arr.map((it) => `<li>${formatter(it)}</li>`).join('')
	return `<h3>${label}</h3><ul>${items}</ul>`
}

export function digitizationToHtml(data) {
	if (!data) return ''
	const out = []

	if (data.patientDetails) {
		out.push(kvList('Patient Details', data.patientDetails, ['name', 'age', 'gender', 'bloodGroup', 'notes']))
	}
	if (data.vitalsAndBodyComposition) {
		out.push(kvList('Vitals & Body Composition', data.vitalsAndBodyComposition))
	}

	out.push(
		arraySection('Symptoms', data.symptoms, (s) => {
			const meta = [s.duration, s.severity, s.notes].filter(Boolean).map(escapeHtml).join(' · ')
			return `<strong>${escapeHtml(s.name || '')}</strong>${meta ? ` — ${meta}` : ''}`
		})
	)

	out.push(
		arraySection('Examinations', data.examinations, (e) => {
			return `<strong>${escapeHtml(e.name || '')}</strong>${e.notes ? ` — ${escapeHtml(e.notes)}` : ''}`
		})
	)

	out.push(
		arraySection('Diagnosis', data.diagnosis, (d) => {
			const meta = [d.status, d.since, d.notes].filter(Boolean).map(escapeHtml).join(' · ')
			return `<strong>${escapeHtml(d.name || '')}</strong>${meta ? ` — ${meta}` : ''}`
		})
	)

	out.push(
		arraySection('Medications', data.medications, (m) => {
			const meta = [m.dosage, m.frequency, m.schedule, m.duration, m.notes]
				.filter(Boolean)
				.map(escapeHtml)
				.join(' · ')
			return `<strong>${escapeHtml(m.name || '')}</strong>${meta ? ` — ${meta}` : ''}`
		})
	)

	out.push(
		arraySection('Medical History', data.medicalHistory, (h) => {
			const meta = [h.type, h.duration, h.relation, h.notes].filter(Boolean).map(escapeHtml).join(' · ')
			return `<strong>${escapeHtml(h.name || '')}</strong>${meta ? ` — ${meta}` : ''}`
		})
	)

	out.push(
		arraySection('Lab Investigations', data.labInvestigation, (l) => {
			const meta = [l.instruction, l.notes].filter(Boolean).map(escapeHtml).join(' · ')
			return `<strong>${escapeHtml(l.name || '')}</strong>${meta ? ` — ${meta}` : ''}`
		})
	)

	if (data.advice?.length) {
		const items = data.advice.map((a) => `<li>${escapeHtml(a)}</li>`).join('')
		out.push(`<h3>Advice</h3><ul>${items}</ul>`)
	}

	if (data.followUp) {
		out.push(`<h3>Follow-up</h3><p>${escapeHtml(data.followUp)}</p>`)
	}

	if (data.others?.length) {
		const items = data.others.map((o) => `<li>${escapeHtml(o)}</li>`).join('')
		out.push(`<h3>Other Notes</h3><ul>${items}</ul>`)
	}

	const html = out.filter(Boolean).join('')
	return html || '<p><em>No data extracted.</em></p>'
}

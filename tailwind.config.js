/** @type {import('tailwindcss').Config} */
export default {
	content: [
		'./index.html',
		'./src/**/*.{js,ts,jsx,tsx}'
	],
	theme: {
		extend: {
			colors: {
				'tp-slate-50': 'var(--tp-slate-50)',
				'tp-slate-100': 'var(--tp-slate-100)',
				'tp-slate-200': 'var(--tp-slate-200)',
				'tp-slate-300': 'var(--tp-slate-300)',
				'tp-slate-400': 'var(--tp-slate-400)',
				'tp-slate-500': 'var(--tp-slate-500)',
				'tp-slate-600': 'var(--tp-slate-600)',
				'tp-slate-700': 'var(--tp-slate-700)',
				'tp-slate-800': 'var(--tp-slate-800)',
				'tp-slate-900': 'var(--tp-slate-900)',
				'tp-blue-50': 'var(--tp-blue-50)',
				'tp-blue-600': 'var(--tp-blue-600)',
				'tp-blue-700': 'var(--tp-blue-700)',
				'tp-error-50': 'var(--tp-error-50)',
				'tp-error-100': 'var(--tp-error-100)',
				'tp-error-600': 'var(--tp-error-600)',
				'tp-error-700': 'var(--tp-error-700)',
			}
		}
	},
	plugins: []
}

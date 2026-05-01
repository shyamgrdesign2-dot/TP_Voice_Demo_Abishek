const VOICE_EXTRACT_API_URL =
	import.meta.env.VITE_VOICE_EXTRACT_API_URL?.trim() ||
	'https://pm-ai-pipeline-uat.tatvacare.in/api/voice-extract'
const VOICE_EXTRACT_BEARER_TOKEN = import.meta.env.VITE_VOICE_EXTRACT_BEARER_TOKEN?.trim()

function getBasePayload({text, fields, previousContext = {}}) {
	return {
		document_type: 'audio_prescription',
		url_wise_breakdown: false,
		files: [],
		previous_context: previousContext,
		fields,
		options: {confidence_threshold: 0.7},
		force_sarvam: false,
		text
	}
}

export function getDigitizationFields() {
	return {
		patientDetails: {
			type: 'object',
			description: 'Extract patient details only if explicitly mentioned in the conversation. Do not infer, expand, or paraphrase any information. Copy exactly as written and leave fields empty if not present.',
			properties: {
				name: {type: 'string', description: 'Patient name exactly as written. Do not expand, paraphrase, or infer. Leave empty if not present.'},
				age: {type: 'string', description: 'Patient age exactly as written. Do not infer or reformat. Leave empty if not present.'},
				gender: {type: 'string', description: 'Patient gender (Male/Female) exactly as written. Do not infer. Leave empty if not present.'},
				bloodGroup: {type: 'string', description: 'Blood group exactly as written. Do not infer. Leave empty if not present.'},
				notes: {type: 'string', description: 'Any other patient information, copied exactly as written. Do not add or infer.'}
			}
		},
		vitalsAndBodyComposition: {
			type: 'object',
			description: 'Extract vital signs and body measurements exactly as written, but remove any units from the output. Always prioritize the explicitly labeled "Vitals" section in the current document as the authoritative and most recent source.',
			properties: {
				temperature: {type: 'string'},
				pulse: {type: 'string'},
				respiratoryRate: {type: 'string'},
				bloodPressure: {type: 'string'},
				systolic: {type: 'string'},
				diastolic: {type: 'string'},
				spo2: {type: 'string'},
				randomBloodSugar: {type: 'string'},
				height: {type: 'string'},
				weight: {type: 'string'},
				headCircumference: {type: 'string'},
				waistCircumference: {type: 'string'},
				bmi: {type: 'string'},
				bmr: {type: 'string'},
				bsa: {type: 'string'},
				fib4: {type: 'string'},
				generalRBS: {type: 'string'}
			}
		},
		symptoms: {
			type: 'array',
			description: 'ALL symptoms mentioned, including negative findings like no fever. Copy each symptom exactly as written.',
			items: {
				type: 'object',
				properties: {
					name: {type: 'string'},
					duration: {type: 'string'},
					severity: {type: 'string'},
					notes: {type: 'string'}
				}
			}
		},
		examinations: {
			type: 'array',
			description: 'Clinical examination findings from O/E section, exactly as written.',
			items: {
				type: 'object',
				properties: {
					name: {type: 'string'},
					notes: {type: 'string'}
				}
			}
		},
		diagnosis: {
			type: 'array',
			description: 'All diagnoses mentioned, exactly as written.',
			items: {
				type: 'object',
				required: ['name'],
				properties: {
					name: {type: 'string'},
					since: {type: 'string'},
					status: {type: 'string', enum: ['Ruled out', 'Suspected', 'Confirmed']},
					notes: {type: 'string'}
				}
			}
		},
		medications: {
			type: 'array',
			description: 'ONLY include medicines that are newly prescribed in this current consultation.',
			items: {
				type: 'object',
				properties: {
					name: {type: 'string'},
					frequency: {type: 'string'},
					dosage: {type: 'string'},
					schedule: {type: 'string'},
					duration: {description: 'Duration must ONLY be in one of the following formats: <number> Days, <number> Weeks, <number> Months, <number> Years.'},
					notes: {type: 'string'},
					quantity: {type: 'number'}
				}
			}
		},
		medicalHistory: {
			type: 'array',
			description: 'Medical history including allergies, lifestyle, chronic diseases, past surgeries, family history, and long-term medicines.',
			items: {
				type: 'object',
				properties: {
					name: {type: 'string'},
					type: {type: 'string'},
					duration: {type: 'string'},
					relation: {type: 'string'},
					enable: {type: 'string'},
					notes: {type: 'string'}
				}
			}
		},
		advice: {type: 'array', items: {type: 'string'}},
		labInvestigation: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: {type: 'string'},
					instruction: {type: 'string'},
					notes: {type: 'string'}
				}
			}
		},
		followUp: {type: 'string'},
		others: {type: 'array', items: {type: 'string'}}
	}
}

export function getSoapFields() {
	return {
		type: 'object',
		description: 'Extract SOAP (Subjective, Objective, Assessment, Plan) details only if explicitly mentioned in the transcription. Do not infer, summarize, or paraphrase. Copy exactly as written. Each field MUST be returned as a valid RTF formatted string.',
		properties: {
			subjective: {type: 'string', description: 'Return ONLY a valid RTF string representing patient-reported symptoms exactly as written.'},
			objective: {type: 'string', description: 'Return ONLY a valid RTF string for objective findings.'},
			assessment: {type: 'string', description: 'Return ONLY a valid RTF string for assessment.'},
			plan: {type: 'string', description: 'Return ONLY a valid RTF string for plan.'}
		}
	}
}

export function getIcdFields() {
	return {
		type: 'object',
		description: 'Extract ICD-11 classified symptoms only if explicitly mentioned in the transcription.',
		properties: {
			symptoms: {
				type: 'array',
				description: 'ALL symptoms mentioned, including negative findings. Copy each symptom exactly as written.',
				items: {
					type: 'object',
					properties: {
						name: {type: 'string'},
						duration: {type: 'string'},
						severity: {type: 'string'},
						notes: {type: 'string'},
						icd11Coding: {
							type: 'array',
							description: 'Assign ICD-11 codes using medical expertise.',
							minItems: 2,
							maxItems: 3,
							items: {
								type: 'object',
								properties: {
									code: {type: 'string'},
									displayName: {type: 'string'},
									type: {type: 'string'}
								}
							}
						}
					}
				}
			}
		}
	}
}

function extractDocumentData(responseJson, name) {
	const data = responseJson?.data?.documents?.[0]?.data
	if (!data) {
		throw new Error(`${name} API returned no document data.`)
	}
	return data
}

async function callVoiceExtractApi({name, payload}) {
	if (!VOICE_EXTRACT_BEARER_TOKEN) {
		throw new Error('Missing VITE_VOICE_EXTRACT_BEARER_TOKEN. Add it to .env and restart Vite.')
	}
	
	const response = await fetch(VOICE_EXTRACT_API_URL, {
		method: 'POST',
		headers: {
			Authorization: VOICE_EXTRACT_BEARER_TOKEN.startsWith('Bearer ')
				? VOICE_EXTRACT_BEARER_TOKEN
				: `Bearer ${VOICE_EXTRACT_BEARER_TOKEN}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(payload)
	})
	
	if (!response.ok) {
		const detail = await response.text().catch(() => '')
		throw new Error(`${name} API failed (${response.status}). ${detail}`.trim())
	}
	
	return extractDocumentData(await response.json(), name)
}

function runModule({tab, name, payload, onResult}) {
	return callVoiceExtractApi({name, payload})
		.then((data) => {
			onResult?.(tab, {name: tab, status: 'fulfilled', data})
			return {name: tab, status: 'fulfilled', data}
		})
		.catch((error) => {
			const result = {name: tab, status: 'rejected', error: error.message}
			onResult?.(tab, result)
			return result
		})
}

export async function processClinicalTranscript({transcription, previousContext = {}, onResult}) {
	const modules = [
		runModule({
			tab: 'soap',
			name: 'SOAP',
			payload: getBasePayload({
				text: transcription,
				fields: getSoapFields(),
				previousContext: {}
			}),
			onResult
		}),
		runModule({
			tab: 'icd',
			name: 'ICD',
			payload: getBasePayload({
				text: transcription,
				fields: getIcdFields(),
				previousContext: {}
			}),
			onResult
		}),
		runModule({
			tab: 'digitization',
			name: 'Digitization',
			payload: getBasePayload({
				text: transcription,
				fields: getDigitizationFields(),
				previousContext
			}),
			onResult
		})
	]
	const [soap, icd, digitization] = await Promise.all(modules)
	return {soap, icd, digitization}
}

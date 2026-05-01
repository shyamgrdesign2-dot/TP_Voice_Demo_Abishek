import {FileState, GoogleGenAI} from '@google/genai'

const API_KEY = import.meta.env.VITE_API_KEY?.trim()
const FILE_API_VERSION = 'v1beta'
const FILE_READY_TIMEOUT_MS = 60_000
const FILE_READY_POLL_MS = 1_000

const SUPPORTED_DOCUMENT_MIME_TYPES = new Set([
	'application/pdf',
	'text/plain',
	'text/markdown',
	'text/csv',
	'application/json',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
])

const SUPPORTED_DOCUMENT_EXTENSIONS = new Set([
	'.pdf',
	'.txt',
	'.md',
	'.markdown',
	'.csv',
	'.json',
	'.doc',
	'.docx'
])

export const FILE_UPLOAD_ACCEPT =
	'.pdf,.txt,.md,.markdown,.csv,.json,.doc,.docx,image/*'

function getFilesClient() {
	if (!API_KEY) {
		throw new Error('Missing VITE_API_KEY. Set it in the project .env file.')
	}

	return new GoogleGenAI({
		apiKey: API_KEY,
		apiVersion: FILE_API_VERSION
	})
}

function wait(delayMs) {
	return new Promise((resolve) => {
		window.setTimeout(resolve, delayMs)
	})
}

function getFileExtension(name) {
	const normalized = name.toLowerCase()
	const lastDotIndex = normalized.lastIndexOf('.')

	return lastDotIndex >= 0 ? normalized.slice(lastDotIndex) : ''
}

function buildFileError(fileRecord, fallbackMessage) {
	if (fileRecord?.error?.message) {
		return fileRecord.error.message
	}

	return fallbackMessage
}

export function supportsQueuedFile(file) {
	if (!(file instanceof File)) {
		return false
	}

	if (file.type.startsWith('image/')) {
		return true
	}

	if (SUPPORTED_DOCUMENT_MIME_TYPES.has(file.type)) {
		return true
	}

	return SUPPORTED_DOCUMENT_EXTENSIONS.has(getFileExtension(file.name))
}

export async function uploadQueuedFile(file, {onStatusChange} = {}) {
	if (!supportsQueuedFile(file)) {
		throw new Error(
			'Only document files and images are supported for session grounding.'
		)
	}

	onStatusChange?.('uploading')
	const ai = getFilesClient()
	const uploadedFile = await ai.files.upload({
		file,
		config: {
			mimeType: file.type || undefined,
			displayName: file.name
		}
	})

	if (!uploadedFile.name) {
		throw new Error('File upload did not return a file resource name.')
	}

	let currentFile = uploadedFile
	if (currentFile.state === FileState.FAILED) {
		throw new Error(buildFileError(currentFile, 'File processing failed.'))
	}

	if (currentFile.state !== FileState.ACTIVE) {
		onStatusChange?.('processing')
		const deadline = Date.now() + FILE_READY_TIMEOUT_MS

		while (Date.now() < deadline) {
			await wait(FILE_READY_POLL_MS)
			currentFile = await ai.files.get({name: uploadedFile.name})

			if (currentFile.state === FileState.ACTIVE) {
				break
			}

			if (currentFile.state === FileState.FAILED) {
				throw new Error(buildFileError(currentFile, 'File processing failed.'))
			}
		}

		if (currentFile.state !== FileState.ACTIVE) {
			throw new Error('Timed out waiting for the uploaded file to become ready.')
		}
	}

	if (!currentFile.uri || !currentFile.mimeType) {
		throw new Error('Uploaded file is missing a URI or MIME type.')
	}

	return {
		name: currentFile.name,
		uri: currentFile.uri,
		mimeType: currentFile.mimeType,
		displayName: currentFile.displayName || file.name
	}
}

import { normalize } from "./format.js";
export const LEGACY_DOCUMENT_KEY = "app-anatomy:diagram";
export const LEGACY_BACKUP_KEY = "app-anatomy:backup-v0";
export const DOCUMENT_INDEX_KEY = "app-anatomy:document-index";
export const ACTIVE_DOCUMENT_KEY = "app-anatomy:active-document";
export const DOCUMENT_KEY_PREFIX = "app-anatomy:document:";
const SAFE_DOCUMENT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const DOCUMENT_RESERVATION = '{"reserved":true}';
export function documentKey(id) {
    if (!SAFE_DOCUMENT_ID.test(id))
        throw new Error("invalid document id");
    return `${DOCUMENT_KEY_PREFIX}${id}`;
}
export function isSafeDocumentId(id) {
    return SAFE_DOCUMENT_ID.test(id);
}
export function documentIdExists(storage, id) {
    return storage.getItem(documentKey(id)) !== null;
}
/**
 * Claims an unused document key without replacing existing bytes. The
 * reservation is deliberately not a valid diagram, so index recovery ignores
 * an abandoned claim. A successful persist replaces it with the document.
 */
export function reserveDocumentId(storage, id) {
    const key = documentKey(id);
    if (storage.getItem(key) !== null)
        return false;
    storage.setItem(key, DOCUMENT_RESERVATION);
    return true;
}
function validSummary(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return false;
    const summary = value;
    return (typeof summary.id === "string" &&
        SAFE_DOCUMENT_ID.test(summary.id) &&
        typeof summary.title === "string" &&
        typeof summary.updatedAt === "string");
}
function readIndex(storage) {
    const raw = storage.getItem(DOCUMENT_INDEX_KEY);
    if (!raw)
        return { valid: false, documents: [] };
    try {
        const parsed = JSON.parse(raw);
        if (parsed.version !== 1 || !Array.isArray(parsed.documents)) {
            return { valid: false, documents: [] };
        }
        const seen = new Set();
        const documents = [];
        for (const summary of parsed.documents) {
            if (!validSummary(summary) || seen.has(summary.id)) {
                return { valid: false, documents: [] };
            }
            seen.add(summary.id);
            documents.push(summary);
        }
        return { valid: true, documents };
    }
    catch {
        return { valid: false, documents: [] };
    }
}
function summaryFromFile(id, file) {
    return {
        id,
        title: file.meta.title,
        updatedAt: file.meta.savedAt ?? "",
    };
}
export function readDocumentResult(storage, id) {
    const raw = storage.getItem(documentKey(id));
    if (!raw)
        return { file: null, warnings: [], errors: [] };
    const result = normalize(raw);
    return {
        file: result.ok && result.sourceVersion === 1 ? result.file : null,
        warnings: result.warnings,
        errors: result.errors,
    };
}
/** Compatibility wrapper for callers that do not yet surface read warnings. */
export function readDocument(storage, id) {
    return readDocumentResult(storage, id).file;
}
function scanDocuments(storage) {
    const documents = new Map();
    for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key?.startsWith(DOCUMENT_KEY_PREFIX))
            continue;
        const id = key.slice(DOCUMENT_KEY_PREFIX.length);
        if (!SAFE_DOCUMENT_ID.test(id))
            continue;
        const file = readDocument(storage, id);
        if (file)
            documents.set(id, summaryFromFile(id, file));
    }
    return [...documents.values()];
}
function indexedDocuments(storage) {
    const indexed = readIndex(storage);
    if (indexed.valid)
        return indexed.documents;
    const documents = scanDocuments(storage);
    try {
        const repaired = { version: 1, documents };
        storage.setItem(DOCUMENT_INDEX_KEY, JSON.stringify(repaired));
    }
    catch {
        // Recovery remains usable in memory when storage is read-only or full.
    }
    return documents;
}
export function readRegistry(storage) {
    const documents = indexedDocuments(storage);
    const ids = new Set(documents.map(({ id }) => id));
    const active = storage.getItem(ACTIVE_DOCUMENT_KEY);
    return {
        documents,
        activeDocumentId: active !== null && ids.has(active) ? active : documents[0]?.id ?? null,
    };
}
export function persistDocument(storage, id, file) {
    const key = documentKey(id);
    const documents = indexedDocuments(storage).filter((entry) => entry.id !== id);
    const summary = summaryFromFile(id, file);
    documents.push(summary);
    const index = { version: 1, documents };
    const documentBytes = JSON.stringify(file);
    const indexBytes = JSON.stringify(index);
    // A missing index is the recovery marker. If either subsequent write fails,
    // the next registry read rebuilds from the document keys instead of trusting
    // a stale index that could hide or resurrect a partial operation.
    storage.removeItem(DOCUMENT_INDEX_KEY);
    storage.setItem(key, documentBytes);
    storage.setItem(DOCUMENT_INDEX_KEY, indexBytes);
}
export function setActiveDocument(storage, id) {
    documentKey(id);
    storage.setItem(ACTIVE_DOCUMENT_KEY, id);
}
export function deleteStoredDocument(storage, id) {
    const key = documentKey(id);
    const documents = indexedDocuments(storage).filter((entry) => entry.id !== id);
    const index = { version: 1, documents };
    const indexBytes = JSON.stringify(index);
    storage.removeItem(DOCUMENT_INDEX_KEY);
    storage.removeItem(key);
    storage.setItem(DOCUMENT_INDEX_KEY, indexBytes);
}
export function migrateLegacyDocument(storage, id, fallbackTitle) {
    const raw = storage.getItem(LEGACY_DOCUMENT_KEY);
    if (!raw)
        return { file: null, id: null, backupFailed: false, persistenceFailed: false };
    const result = normalize(raw);
    if (!result.ok)
        return { file: null, id: null, backupFailed: false, persistenceFailed: false };
    const file = {
        ...result.file,
        meta: {
            ...result.file.meta,
            title: result.file.meta.title.trim() || fallbackTitle,
            savedAt: result.file.meta.savedAt ?? new Date().toISOString(),
        },
    };
    let backupFailed = false;
    let backupReady = !result.migrated || storage.getItem(LEGACY_BACKUP_KEY) !== null;
    if (result.migrated && !backupReady) {
        try {
            // Store the source string itself: parsing and re-stringifying would lose
            // whitespace, key order, and other exact source bytes.
            storage.setItem(LEGACY_BACKUP_KEY, raw);
            backupReady = true;
        }
        catch {
            backupFailed = true;
        }
    }
    try {
        persistDocument(storage, id, file);
        setActiveDocument(storage, id);
        if (backupReady)
            storage.removeItem(LEGACY_DOCUMENT_KEY);
        return { file, id, backupFailed, persistenceFailed: false };
    }
    catch {
        return { file, id, backupFailed, persistenceFailed: true };
    }
}

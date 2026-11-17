import type { Draft } from './types'

// Data stays in this browser's IndexedDB. Nothing is sent over the network.
const DB_NAME = 'ai-workspace'
const STORE = 'drafts'
const KEY = 'current'

export type SavedDraft = Draft & { savedAt: string }

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = action(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result as T)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export function loadDraft(): Promise<SavedDraft | undefined> {
  return run('readonly', (store) => store.get(KEY))
}

export async function saveDraft(draft: Draft): Promise<SavedDraft> {
  const saved: SavedDraft = { ...draft, savedAt: new Date().toISOString() }
  await run('readwrite', (store) => store.put(saved, KEY))
  return saved
}

export async function clearDraft(): Promise<void> {
  await run('readwrite', (store) => store.delete(KEY))
}

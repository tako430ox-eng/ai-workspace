import type { Draft, Task } from './types'

// Data stays in this browser's IndexedDB. Nothing is sent over the network.
const DB_NAME = 'ai-workspace'
const DB_VERSION = 2
const DRAFTS = 'drafts' // v1: single draft under 'current'. Kept, never deleted.
const TASKS = 'tasks' // v2: one record per task, keyed by id.
const LEGACY_KEY = 'current'
export const MIGRATED_TASK_ID = 'migrated-draft'

type LegacyDraft = Draft & { savedAt?: string }

// Runs inside the version-change transaction, so the copy and the version
// bump commit together: if anything throws, the DB stays at v1 untouched.
function upgrade(db: IDBDatabase, tx: IDBTransaction, oldVersion: number) {
  if (oldVersion < 1) db.createObjectStore(DRAFTS)
  if (oldVersion < 2) {
    const tasks = db.createObjectStore(TASKS, { keyPath: 'id' })
    if (oldVersion === 1) {
      const req = tx.objectStore(DRAFTS).get(LEGACY_KEY)
      req.onsuccess = () => {
        const legacy = req.result as LegacyDraft | undefined
        if (!legacy) return
        const when = legacy.savedAt ?? new Date().toISOString()
        const task: Task = {
          title: legacy.title ?? '',
          purpose: legacy.purpose ?? '',
          context: legacy.context ?? '',
          question: legacy.question ?? '',
          id: MIGRATED_TASK_ID,
          status: '未着手',
          nextAction: '',
          memo: '',
          createdAt: when,
          updatedAt: when,
        }
        tasks.add(task)
      }
    }
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (event) => upgrade(req.result, req.transaction!, event.oldVersion)
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
    // Resolve only when the whole transaction commits: a request can succeed
    // and the transaction still abort (e.g. storage quota), losing the write.
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(TASKS, mode)
      const req = action(tx.objectStore(TASKS))
      tx.oncomplete = () => resolve(req.result as T)
      tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'))
    })
  } finally {
    db.close()
  }
}

// Newest first.
export async function listTasks(): Promise<Task[]> {
  const tasks = await run<Task[]>('readonly', (store) => store.getAll())
  return tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function saveTask(task: Task): Promise<Task> {
  const saved: Task = { ...task, updatedAt: new Date().toISOString() }
  await run('readwrite', (store) => store.put(saved))
  return saved
}

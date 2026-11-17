import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MIGRATED_TASK_ID, listTasks, saveTask } from './storage'
import { newTask, type Draft, type Task } from './types'

const legacyDraft: Draft & { savedAt: string } = {
  title: '【テスト】架空の旧下書き',
  purpose: '架空の目的',
  context: '架空の前提',
  question: '架空の質問',
  savedAt: '2026-11-17T13:23:28.000Z',
}

function task(title: string, extra: Partial<Task> = {}): Task {
  return { ...newTask(), title, ...extra }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Recreates what the previous app version (DB v1) left on the device.
function createV1Database(draft?: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ai-workspace', 1)
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore('drafts')
      if (draft) store.put(draft, 'current')
    }
    req.onsuccess = () => {
      req.result.close()
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

// Opens at whatever version exists, to inspect the raw database.
async function inspect() {
  const db = await request(indexedDB.open('ai-workspace'))
  try {
    const version = db.version
    const legacy = await request(db.transaction('drafts').objectStore('drafts').get('current'))
    return { version, legacy }
  } finally {
    db.close()
  }
}

function abortOn(method: 'put' | 'add', when: 'before' | 'after-success') {
  const original = IDBObjectStore.prototype[method]
  vi.spyOn(IDBObjectStore.prototype, method).mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore['put']>
  ) {
    if (when === 'before') {
      this.transaction.abort()
      return undefined as unknown as IDBRequest<IDBValidKey>
    }
    const req = original.apply(this, args)
    req.addEventListener('success', () => this.transaction.abort())
    return req
  })
}

beforeEach(() => {
  // A fresh in-memory database for every test.
  vi.stubGlobal('indexedDB', new IDBFactory())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('tasks', () => {
  it('returns an empty list when nothing has been saved', async () => {
    await expect(listTasks()).resolves.toEqual([])
  })

  it('loads what was saved, including status, with a new updatedAt', async () => {
    const original = task('架空の作業', { status: '保留', nextAction: '架空の次の一手', memo: '架空のメモ' })
    const saved = await saveTask(original)
    expect(saved).toMatchObject({ ...original, updatedAt: expect.any(String) })
    await expect(listTasks()).resolves.toEqual([saved])
  })

  it('keeps two tasks separate when one is changed', async () => {
    const a = await saveTask(task('架空の作業A', { purpose: 'A の目的' }))
    const b = await saveTask(task('架空の作業B', { purpose: 'B の目的' }))
    await saveTask({ ...a, title: '架空の作業A(改名)', purpose: 'A の新しい目的', status: '依頼済み' })

    const tasks = await listTasks()
    expect(tasks).toHaveLength(2)
    expect(tasks.find((t) => t.id === b.id)).toEqual(b)
    expect(tasks.find((t) => t.id === a.id)).toMatchObject({
      title: '架空の作業A(改名)',
      purpose: 'A の新しい目的',
      status: '依頼済み',
    })
  })

  it('reports failure when the transaction aborts after the write request succeeded', async () => {
    const first = await saveTask(task('架空の作業'))

    abortOn('put', 'after-success')
    await expect(saveTask({ ...first, title: '保存されないはずの名前' })).rejects.toThrow()

    vi.restoreAllMocks()
    // The aborted write must not have replaced the earlier save.
    await expect(listTasks()).resolves.toEqual([first])
  })
})

describe('migration from the v1 single draft', () => {
  it('turns the old draft into one task and keeps the old data', async () => {
    await createV1Database(legacyDraft)

    const tasks = await listTasks()
    expect(tasks).toEqual([
      {
        id: MIGRATED_TASK_ID,
        title: legacyDraft.title,
        purpose: legacyDraft.purpose,
        context: legacyDraft.context,
        question: legacyDraft.question,
        status: '未着手',
        nextAction: '',
        memo: '',
        createdAt: legacyDraft.savedAt,
        updatedAt: legacyDraft.savedAt,
      },
    ])
    await expect(inspect()).resolves.toEqual({ version: 2, legacy: legacyDraft })
  })

  it('does not duplicate the old draft when opened again', async () => {
    await createV1Database(legacyDraft)
    await listTasks()
    await saveTask(task('架空の新しい作業'))
    await listTasks()

    const tasks = await listTasks()
    expect(tasks).toHaveLength(2)
    expect(tasks.filter((t) => t.id === MIGRATED_TASK_ID)).toHaveLength(1)
  })

  it('creates no task when v1 had no saved draft', async () => {
    await createV1Database()
    await expect(listTasks()).resolves.toEqual([])
  })

  it('leaves the v1 database untouched when the migration fails, and can retry', async () => {
    await createV1Database(legacyDraft)

    abortOn('add', 'before')
    await expect(listTasks()).rejects.toThrow()
    vi.restoreAllMocks()

    await expect(inspect()).resolves.toEqual({ version: 1, legacy: legacyDraft })
    // The next start migrates normally.
    await expect(listTasks()).resolves.toHaveLength(1)
  })
})

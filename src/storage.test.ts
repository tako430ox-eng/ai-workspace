import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDraft, loadDraft, saveDraft } from './storage'
import type { Draft } from './types'

const draft: Draft = {
  title: '【テスト】架空の作業',
  purpose: '架空の目的',
  context: '架空の前提',
  question: '架空の質問',
}

beforeEach(() => {
  // A fresh in-memory database for every test.
  vi.stubGlobal('indexedDB', new IDBFactory())
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('storage', () => {
  it('returns undefined when nothing has been saved', async () => {
    await expect(loadDraft()).resolves.toBeUndefined()
  })

  it('loads what was saved, with a timestamp', async () => {
    const saved = await saveDraft(draft)
    expect(saved).toMatchObject(draft)
    expect(Number.isNaN(Date.parse(saved.savedAt))).toBe(false)
    await expect(loadDraft()).resolves.toEqual(saved)
  })

  it('overwrites the previous save', async () => {
    await saveDraft(draft)
    const second = await saveDraft({ ...draft, question: '別の架空の質問' })
    await expect(loadDraft()).resolves.toEqual(second)
  })

  it('clears the saved draft', async () => {
    await saveDraft(draft)
    await clearDraft()
    await expect(loadDraft()).resolves.toBeUndefined()
  })

  it('reports failure when the transaction aborts after the write request succeeded', async () => {
    const first = await saveDraft(draft)

    // Let put() succeed, then abort the transaction before it commits.
    const originalPut = IDBObjectStore.prototype.put
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<IDBObjectStore['put']>
    ) {
      const req = originalPut.apply(this, args)
      req.addEventListener('success', () => this.transaction.abort())
      return req
    })

    await expect(saveDraft({ ...draft, question: '保存されないはずの質問' })).rejects.toThrow()

    vi.restoreAllMocks()
    // The aborted write must not have replaced the earlier save.
    await expect(loadDraft()).resolves.toEqual(first)
  })
})

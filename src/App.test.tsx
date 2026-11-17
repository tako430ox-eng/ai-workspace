// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  vi.stubGlobal('indexedDB', new IDBFactory())
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// Unmount and mount again, as a page reload would.
async function startApp() {
  cleanup()
  render(<App />)
  await screen.findByRole('heading', { name: '作業一覧' })
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function click(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

async function save() {
  click('保存')
  await screen.findByText(/保存しました/)
}

async function createTask(title: string, purpose: string) {
  click('新規作成')
  type('作業名(必須)', title)
  type('目的', purpose)
  await save()
  click('← 一覧へ')
  await screen.findByRole('heading', { name: '作業一覧' })
}

function taskButtons() {
  return within(screen.getByRole('list')).getAllByRole('button')
}

// Lets put() succeed, then aborts before commit, like a quota failure.
function failNextSave() {
  const originalPut = IDBObjectStore.prototype.put
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    ...args: Parameters<IDBObjectStore['put']>
  ) {
    const req = originalPut.apply(this, args)
    req.addEventListener('success', () => this.transaction.abort())
    return req
  })
}

describe('App', () => {
  it('shows no input until the first load finishes', async () => {
    render(<App />)
    expect(screen.getByText('読み込み中…')).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
    await screen.findByRole('heading', { name: '作業一覧' })
  })

  it('keeps two tasks separate and restores them after a reload', async () => {
    await startApp()
    await createTask('架空の作業A', 'A の目的')
    await createTask('架空の作業B', 'B の目的')
    expect(taskButtons()).toHaveLength(2)

    click(/架空の作業A/)
    type('目的', 'A の新しい目的')
    fireEvent.change(screen.getByLabelText('状態'), { target: { value: '保留' } })
    type('次の一手', '架空の次の一手')
    await save()

    await startApp()
    expect(taskButtons()).toHaveLength(2)

    click(/架空の作業B/)
    expect((screen.getByLabelText('目的') as HTMLTextAreaElement).value).toBe('B の目的')
    expect((screen.getByLabelText('状態') as HTMLSelectElement).value).toBe('未着手')
    click('← 一覧へ')

    click(/架空の作業A/)
    expect((screen.getByLabelText('目的') as HTMLTextAreaElement).value).toBe('A の新しい目的')
    expect((screen.getByLabelText('状態') as HTMLSelectElement).value).toBe('保留')
    expect((screen.getByLabelText('次の一手') as HTMLTextAreaElement).value).toBe('架空の次の一手')
  })

  it('keeps the same task when it is renamed', async () => {
    await startApp()
    await createTask('架空の旧名', '目的')
    click(/架空の旧名/)
    type('作業名(必須)', '架空の新名')
    await save()
    click('← 一覧へ')

    expect(taskButtons()).toHaveLength(1)
    expect(screen.getByText('架空の新名')).toBeTruthy()
  })

  it('requires a task name before saving', async () => {
    await startApp()
    click('新規作成')
    type('目的', '名前なしの目的')
    click('保存')
    expect(await screen.findByText('作業名を入力してください。')).toBeTruthy()
    expect(screen.queryByText(/保存しました/)).toBeNull()
  })

  it('asks before leaving with unsaved changes: cancel, discard, save', async () => {
    await startApp()
    click('新規作成')
    type('作業名(必須)', '架空の未保存作業')

    click('← 一覧へ')
    expect(screen.getByRole('dialog')).toBeTruthy()
    click('キャンセル')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect((screen.getByLabelText('作業名(必須)') as HTMLInputElement).value).toBe('架空の未保存作業')

    click('← 一覧へ')
    click('破棄して移動')
    await screen.findByRole('heading', { name: '作業一覧' })
    expect(screen.queryByRole('list')).toBeNull()

    click('新規作成')
    type('作業名(必須)', '架空の保存する作業')
    click('← 一覧へ')
    click('保存して移動')
    await screen.findByRole('heading', { name: '作業一覧' })
    expect(taskButtons()).toHaveLength(1)
    expect(screen.getByText('架空の保存する作業')).toBeTruthy()
  })

  it('keeps the input and does not report success when saving fails', async () => {
    await startApp()
    click('新規作成')
    type('作業名(必須)', '架空の作業')

    failNextSave()
    click('保存')
    expect(await screen.findByText('保存に失敗しました。入力内容は残っています。')).toBeTruthy()
    expect(screen.queryByText(/保存しました/)).toBeNull()
    expect((screen.getByLabelText('作業名(必須)') as HTMLInputElement).value).toBe('架空の作業')

    // Saving from the leave dialog must not navigate away either. The failure
    // message is already on screen, so wait for the save to settle instead.
    const putCalls = vi.mocked(IDBObjectStore.prototype.put).mock.calls.length
    click('← 一覧へ')
    click('保存して移動')
    await waitFor(() =>
      expect(vi.mocked(IDBObjectStore.prototype.put).mock.calls.length).toBe(putCalls + 1),
    )
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.queryByRole('heading', { name: '作業一覧' })).toBeNull()
    expect(screen.getByText('保存に失敗しました。入力内容は残っています。')).toBeTruthy()
    expect((screen.getByLabelText('作業名(必須)') as HTMLInputElement).value).toBe('架空の作業')

    vi.restoreAllMocks()
    await startApp()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('copies the request text without changing the status', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await startApp()
    click('新規作成')
    type('作業名(必須)', '架空の作業')
    type('今回聞きたいこと', '架空の質問')

    click('依頼文をコピー')
    expect(await screen.findByText('依頼文をコピーしました。')).toBeTruthy()
    expect(writeText).toHaveBeenCalledWith('# 依頼:架空の作業\n\n## 今回聞きたいこと\n架空の質問')
    expect((screen.getByLabelText('状態') as HTMLSelectElement).value).toBe('未着手')

    await save()
    click('← 一覧へ')
    expect(screen.getByText('未着手')).toBeTruthy()
  })

  it('offers manual copy when the clipboard is refused', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await startApp()
    click('新規作成')
    type('作業名(必須)', '架空の作業')

    click('依頼文をコピー')
    expect(
      await screen.findByText('自動コピーできませんでした。下の依頼文を長押しで選択してコピーしてください。'),
    ).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('依頼文'))
  })
})

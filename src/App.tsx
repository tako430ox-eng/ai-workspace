import { useEffect, useRef, useState } from 'react'
import { copyText } from './clipboard'
import { buildRequestText } from './prompt'
import { clearDraft, loadDraft, saveDraft } from './storage'
import { emptyDraft, type Draft } from './types'
import './App.css'

// Fictional sample so testing never needs real conversations.
const sampleDraft: Draft = {
  title: '【テスト】架空の買い物メモアプリ',
  purpose: '架空の買い物メモアプリの画面案を考えたい(テスト用の例です)。',
  context: 'スマホで片手操作できること。費用はかけない。',
  question: '最初に作るべき画面を3つ挙げてください。',
}

const fields: { key: keyof Draft; label: string; rows: number }[] = [
  { key: 'title', label: '作業名', rows: 1 },
  { key: 'purpose', label: '目的', rows: 3 },
  { key: 'context', label: '前提・制約', rows: 3 },
  { key: 'question', label: '今回聞きたいこと', rows: 4 },
]

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP')
}

function App() {
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [savedAt, setSavedAt] = useState<string>()
  const [message, setMessage] = useState('')
  const [copyFailed, setCopyFailed] = useState(false)
  const previewRef = useRef<HTMLTextAreaElement>(null)

  const requestText = buildRequestText(draft)

  useEffect(() => {
    loadDraft()
      .then((saved) => {
        if (!saved) return
        const { savedAt, ...rest } = saved
        setDraft(rest)
        setSavedAt(savedAt)
        setMessage(`前回保存した内容を読み込みました(${formatTime(savedAt)})`)
      })
      .catch(() => setMessage('端末内の保存データを読み込めませんでした。'))
  }, [])

  function update(key: keyof Draft, value: string) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleCopy() {
    if (!requestText) {
      setMessage('依頼文が空です。先に入力してください。')
      return
    }
    const ok = await copyText(requestText)
    setCopyFailed(!ok)
    if (ok) {
      setMessage('依頼文をコピーしました。')
    } else {
      setMessage('自動コピーできませんでした。下の依頼文を長押しで選択してコピーしてください。')
      previewRef.current?.focus()
      previewRef.current?.select()
    }
  }

  async function handleSave() {
    try {
      const saved = await saveDraft(draft)
      setSavedAt(saved.savedAt)
      setMessage(`端末内に保存しました(${formatTime(saved.savedAt)})`)
    } catch {
      setMessage('保存に失敗しました。')
    }
  }

  async function handleClear() {
    if (!window.confirm('この端末に保存した内容を消します。よろしいですか?')) return
    try {
      await clearDraft()
      setDraft(emptyDraft)
      setSavedAt(undefined)
      setMessage('保存した内容を消しました。')
    } catch {
      setMessage('消去に失敗しました。')
    }
  }

  return (
    <main>
      <h1>AI作業メモ(試作)</h1>
      <p className="note">
        APIキー・パスワード・個人情報は入力しないでください。
        試すときは「架空の例を入れる」を使ってください。
      </p>

      <section className="card">
        {fields.map(({ key, label, rows }) => (
          <label key={key}>
            <span>{label}</span>
            {rows === 1 ? (
              <input value={draft[key]} onChange={(e) => update(key, e.target.value)} />
            ) : (
              <textarea rows={rows} value={draft[key]} onChange={(e) => update(key, e.target.value)} />
            )}
          </label>
        ))}
        <button type="button" className="secondary" onClick={() => setDraft(sampleDraft)}>
          架空の例を入れる
        </button>
      </section>

      <section className="card">
        <h2>依頼文</h2>
        <textarea
          ref={previewRef}
          className={copyFailed ? 'preview highlight' : 'preview'}
          rows={8}
          readOnly
          value={requestText}
          placeholder="上に入力すると、ここに依頼文ができます。"
        />
        <div className="actions">
          <button type="button" onClick={handleCopy}>依頼文をコピー</button>
          <button type="button" onClick={handleSave}>端末に保存</button>
          <button type="button" className="danger" onClick={handleClear}>保存を消す</button>
        </div>
        <p className="status" role="status">{message}</p>
        <p className="meta">
          {savedAt ? `最終保存:${formatTime(savedAt)}` : 'まだ保存していません'}
        </p>
      </section>
    </main>
  )
}

export default App

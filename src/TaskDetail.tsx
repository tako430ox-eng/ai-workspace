import { useRef, useState } from 'react'
import { copyText } from './clipboard'
import { buildRequestText } from './prompt'
import { taskStatuses, type Draft, type Task, type TaskStatus } from './types'

// Fictional sample so testing never needs real conversations.
const sampleDraft: Draft = {
  title: '【テスト】架空の買い物メモアプリ',
  purpose: '架空の買い物メモアプリの画面案を考えたい(テスト用の例です)。',
  context: 'スマホで片手操作できること。費用はかけない。',
  question: '最初に作るべき画面を3つ挙げてください。',
}

type TextField = 'title' | 'purpose' | 'context' | 'question' | 'nextAction' | 'memo'

const requestFields: { key: TextField; label: string; rows: number }[] = [
  { key: 'title', label: '作業名(必須)', rows: 1 },
  { key: 'purpose', label: '目的', rows: 3 },
  { key: 'context', label: '前提・制約', rows: 3 },
  { key: 'question', label: '今回聞きたいこと', rows: 4 },
]

const trackingFields: { key: TextField; label: string; rows: number }[] = [
  { key: 'nextAction', label: '次の一手', rows: 2 },
  { key: 'memo', label: 'メモ', rows: 4 },
]

type Props = {
  task: Task
  isNew: boolean
  dirty: boolean
  saving: boolean
  message: string
  onChange: (task: Task) => void
  onSave: () => void
  onBack: () => void
  onMessage: (message: string) => void
}

export function TaskDetail({ task, isNew, dirty, saving, message, onChange, onSave, onBack, onMessage }: Props) {
  const [copyFailed, setCopyFailed] = useState(false)
  const previewRef = useRef<HTMLTextAreaElement>(null)
  const requestText = buildRequestText(task)

  function update(key: TextField, value: string) {
    onChange({ ...task, [key]: value })
  }

  async function handleCopy() {
    if (!requestText) {
      onMessage('依頼文が空です。先に入力してください。')
      return
    }
    const ok = await copyText(requestText)
    setCopyFailed(!ok)
    if (ok) {
      onMessage('依頼文をコピーしました。')
    } else {
      onMessage('自動コピーできませんでした。下の依頼文を長押しで選択してコピーしてください。')
      previewRef.current?.focus()
      previewRef.current?.select()
    }
  }

  function renderField({ key, label, rows }: { key: TextField; label: string; rows: number }) {
    return (
      <label key={key}>
        <span>{label}</span>
        {rows === 1 ? (
          <input value={task[key]} onChange={(e) => update(key, e.target.value)} />
        ) : (
          <textarea rows={rows} value={task[key]} onChange={(e) => update(key, e.target.value)} />
        )}
      </label>
    )
  }

  return (
    <section>
      <div className="list-header">
        <button type="button" className="secondary" onClick={onBack} disabled={saving}>
          ← 一覧へ
        </button>
        <span className="meta">{isNew ? '新しい作業(未保存)' : dirty ? '未保存の変更あり' : '保存済み'}</span>
      </div>

      <section className="card">
        {requestFields.map(renderField)}
        <button
          type="button"
          className="secondary"
          onClick={() => onChange({ ...task, ...sampleDraft })}
        >
          架空の例を入れる
        </button>
      </section>

      <section className="card">
        <label>
          <span>状態</span>
          <select
            value={task.status}
            onChange={(e) => onChange({ ...task, status: e.target.value as TaskStatus })}
          >
            {taskStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        {trackingFields.map(renderField)}
      </section>

      <section className="card">
        <h2>依頼文</h2>
        <textarea
          ref={previewRef}
          aria-label="依頼文"
          className={copyFailed ? 'preview highlight' : 'preview'}
          rows={8}
          readOnly
          value={requestText}
          placeholder="上に入力すると、ここに依頼文ができます。"
        />
        <div className="actions">
          <button type="button" onClick={handleCopy}>依頼文をコピー</button>
          <button type="button" onClick={onSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
        <p className="status" role="status">{message}</p>
        {!isNew && (
          <p className="meta">最終保存:{new Date(task.updatedAt).toLocaleString('ja-JP')}</p>
        )}
      </section>
    </section>
  )
}

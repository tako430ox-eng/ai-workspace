import { useEffect, useState } from 'react'
import { listTasks, saveTask } from './storage'
import { TaskDetail } from './TaskDetail'
import { TaskList } from './TaskList'
import { newTask, type Task } from './types'
import './App.css'

// Where the user wants to go next: back to the list, or into a task.
type Destination = { kind: 'list' } | { kind: 'task'; task: Task; isNew: boolean }

type Editing = { saved: Task; draft: Task; isNew: boolean }

const editableKeys = ['title', 'purpose', 'context', 'question', 'status', 'nextAction', 'memo'] as const

function hasChanges({ saved, draft }: Editing): boolean {
  return editableKeys.some((key) => saved[key] !== draft[key])
}

function App() {
  // undefined while the first load is running, so nothing can be edited
  // (and overwritten by late-arriving data) before it finishes.
  const [tasks, setTasks] = useState<Task[]>()
  const [loadError, setLoadError] = useState(false)
  const [editing, setEditing] = useState<Editing>()
  const [pending, setPending] = useState<Destination>()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    listTasks()
      .then(setTasks)
      .catch(() => setLoadError(true))
  }, [])

  const dirty = editing ? hasChanges(editing) : false

  function go(destination: Destination) {
    setPending(undefined)
    setMessage('')
    if (destination.kind === 'list') {
      setEditing(undefined)
    } else {
      const { task, isNew } = destination
      setEditing({ saved: task, draft: task, isNew })
    }
  }

  function navigate(destination: Destination) {
    if (dirty) setPending(destination)
    else go(destination)
  }

  // Returns true only after the task is really stored.
  async function save(): Promise<boolean> {
    if (!editing) return false
    if (!editing.draft.title.trim()) {
      setMessage('作業名を入力してください。')
      return false
    }
    setSaving(true)
    try {
      const saved = await saveTask(editing.draft)
      setTasks((current = []) =>
        [saved, ...current.filter((t) => t.id !== saved.id)],
      )
      setEditing({ saved, draft: saved, isNew: false })
      setMessage(`保存しました(${new Date(saved.updatedAt).toLocaleString('ja-JP')})`)
      return true
    } catch {
      setMessage('保存に失敗しました。入力内容は残っています。')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function saveAndGo() {
    if (!pending) return
    const destination = pending
    setPending(undefined)
    if (await save()) go(destination)
  }

  let body
  if (loadError) {
    body = <p className="status">端末内の保存データを読み込めませんでした。ページを再読み込みしてください。</p>
  } else if (!tasks) {
    body = <p className="meta">読み込み中…</p>
  } else if (editing) {
    body = (
      <TaskDetail
        task={editing.draft}
        isNew={editing.isNew}
        dirty={dirty}
        saving={saving}
        message={message}
        onChange={(draft) => setEditing({ ...editing, draft })}
        onSave={save}
        onBack={() => navigate({ kind: 'list' })}
        onMessage={setMessage}
      />
    )
  } else {
    body = (
      <TaskList
        tasks={tasks}
        onOpen={(task) => navigate({ kind: 'task', task, isNew: false })}
        onCreate={() => navigate({ kind: 'task', task: newTask(), isNew: true })}
      />
    )
  }

  return (
    <main>
      <h1>AI作業メモ(試作)</h1>
      <p className="note">
        APIキー・パスワード・個人情報は入力しないでください。
        試すときは「架空の例を入れる」を使ってください。
      </p>
      {body}
      {pending && (
        <div className="dialog-backdrop">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="unsaved-title">
            <h2 id="unsaved-title">保存していない変更があります</h2>
            <p>移動する前に、変更をどうしますか?</p>
            <div className="actions">
              <button type="button" onClick={saveAndGo}>保存して移動</button>
              <button type="button" className="danger" onClick={() => go(pending)}>破棄して移動</button>
              <button type="button" className="secondary" onClick={() => setPending(undefined)}>キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App

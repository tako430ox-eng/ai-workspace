import type { Task } from './types'

const PURPOSE_PREVIEW_LENGTH = 40

function shorten(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > PURPOSE_PREVIEW_LENGTH
    ? `${oneLine.slice(0, PURPOSE_PREVIEW_LENGTH)}…`
    : oneLine
}

type Props = {
  tasks: Task[]
  onOpen: (task: Task) => void
  onCreate: () => void
}

export function TaskList({ tasks, onOpen, onCreate }: Props) {
  return (
    <section>
      <div className="list-header">
        <h2>作業一覧</h2>
        <button type="button" onClick={onCreate}>新規作成</button>
      </div>
      {tasks.length === 0 ? (
        <p className="meta">まだ作業がありません。「新規作成」から始めてください。</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <li key={task.id}>
              <button type="button" className="task-item" onClick={() => onOpen(task)}>
                <span className="task-title">{task.title || '(無題)'}</span>
                <span className="badge">{task.status}</span>
                {task.purpose.trim() && <span className="task-purpose">{shorten(task.purpose)}</span>}
                <span className="task-next">
                  次の一手:{task.nextAction.trim() ? shorten(task.nextAction) : '未設定'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

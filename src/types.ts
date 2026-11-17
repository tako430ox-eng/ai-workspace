export type Draft = {
  title: string
  purpose: string
  context: string
  question: string
}

export const emptyDraft: Draft = {
  title: '',
  purpose: '',
  context: '',
  question: '',
}

export const taskStatuses = ['未着手', '依頼済み', '回答保存済み', '確認済み', '保留'] as const

export type TaskStatus = (typeof taskStatuses)[number]

// One unit of work. `id` never changes, so renaming keeps the same task.
export type Task = Draft & {
  id: string
  status: TaskStatus
  nextAction: string
  memo: string
  createdAt: string
  updatedAt: string
}

export function newTask(): Task {
  const now = new Date().toISOString()
  return {
    ...emptyDraft,
    id: crypto.randomUUID(),
    status: '未着手',
    nextAction: '',
    memo: '',
    createdAt: now,
    updatedAt: now,
  }
}

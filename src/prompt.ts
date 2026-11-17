import type { Draft } from './types'

// Assembles the request text the user pastes into an AI service.
// Empty sections are left out so the text stays short.
export function buildRequestText(draft: Draft): string {
  const sections: string[] = []
  if (draft.title.trim()) sections.push(`# 依頼:${draft.title.trim()}`)
  if (draft.purpose.trim()) sections.push(`## 目的\n${draft.purpose.trim()}`)
  if (draft.context.trim()) sections.push(`## 前提・制約\n${draft.context.trim()}`)
  if (draft.question.trim()) sections.push(`## 今回聞きたいこと\n${draft.question.trim()}`)
  return sections.join('\n\n')
}

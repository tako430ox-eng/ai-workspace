import { describe, expect, it } from 'vitest'
import { buildRequestText } from './prompt'
import { emptyDraft } from './types'

describe('buildRequestText', () => {
  it('includes all four sections in order', () => {
    const text = buildRequestText({
      title: 'テスト作業',
      purpose: '目的の文',
      context: '前提の文',
      question: '質問の文',
    })
    expect(text).toBe(
      '# 依頼:テスト作業\n\n## 目的\n目的の文\n\n## 前提・制約\n前提の文\n\n## 今回聞きたいこと\n質問の文',
    )
  })

  it('leaves out empty and whitespace-only sections', () => {
    const text = buildRequestText({ ...emptyDraft, title: 'テスト作業', context: '   ' })
    expect(text).toBe('# 依頼:テスト作業')
  })

  it('trims surrounding whitespace', () => {
    const text = buildRequestText({ ...emptyDraft, question: '  質問\n' })
    expect(text).toBe('## 今回聞きたいこと\n質問')
  })

  it('returns an empty string for an empty draft', () => {
    expect(buildRequestText(emptyDraft)).toBe('')
  })
})

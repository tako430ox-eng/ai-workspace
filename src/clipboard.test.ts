import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './clipboard'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('copyText', () => {
  it('returns true when the clipboard accepts the text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(copyText('依頼文')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('依頼文')
  })

  it('returns false when permission is denied', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await expect(copyText('依頼文')).resolves.toBe(false)
  })

  it('returns false when the clipboard API is missing', async () => {
    vi.stubGlobal('navigator', {})
    await expect(copyText('依頼文')).resolves.toBe(false)
  })
})

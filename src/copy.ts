import { isNative, nativeCopy } from './native'

/** クリップボードへコピー（アプリ版は Capacitor、ブラウザは Clipboard API、だめなら古い方法） */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (isNative) {
      await nativeCopy(text)
      return true
    }
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

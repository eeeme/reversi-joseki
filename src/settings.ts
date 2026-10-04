// 端末ごとの小さな設定（localStorage。使えない環境では既定値）
const KEY = 'rjoseki.settings'

export interface Settings {
  /** 打てるマスに薄い点を出す */
  showLegal: boolean
}

const DEFAULTS: Settings = { showLegal: true }

export function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* noop */ }
}

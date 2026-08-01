import { execFile } from 'child_process'

export interface WindowInfo {
  x: number
  y: number
  width: number
  height: number
  title: string
}

const PS_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class InkWin32 {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@
$h = [InkWin32]::GetForegroundWindow()
if ($h -eq [IntPtr]::Zero) { exit }
$r = New-Object InkWin32+RECT
if (-not [InkWin32]::GetWindowRect($h, [ref]$r)) { exit }
$len = [InkWin32]::GetWindowTextLength($h)
$sb = New-Object System.Text.StringBuilder ($len + 1)
[InkWin32]::GetWindowText($h, $sb, $sb.Capacity) | Out-Null
Write-Output ("$($r.Left)|$($r.Top)|$($r.Right)|$($r.Bottom)|$sb")
`

/**
 * Get the foreground window's rect + title on Windows.
 * Low frequency only — each call spawns a short PowerShell process.
 * Returns null on non-Windows / failure.
 */
export function getForegroundWindow(): Promise<WindowInfo | null> {
  if (process.platform !== 'win32') return Promise.resolve(null)

  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', PS_SCRIPT],
      { timeout: 4000, windowsHide: true },
      (err, stdout) => {
        if (err || !stdout) return resolve(null)
        const line = stdout.split('\n')[0]?.trim()
        if (!line) return resolve(null)
        const parts = line.split('|')
        if (parts.length < 5) return resolve(null)
        const x = Number(parts[0])
        const y = Number(parts[1])
        const right = Number(parts[2])
        const bottom = Number(parts[3])
        if (![x, y, right, bottom].every(Number.isFinite)) return resolve(null)
        if (right <= x || bottom <= y) return resolve(null)
        resolve({
          x,
          y,
          width: right - x,
          height: bottom - y,
          title: parts.slice(4).join('|').trim()
        })
      }
    )
  })
}

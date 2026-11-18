export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export const btn =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40'

export const btnPrimary = `${btn} bg-violet-600 text-white hover:bg-violet-500`
export const btnGhost = `${btn} border border-white/10 bg-white/5 text-violet-50 hover:bg-white/10`
export const btnDanger = `${btn} bg-rose-600 text-white hover:bg-rose-500`
export const btnGood = `${btn} bg-emerald-600 text-white hover:bg-emerald-500`
export const btnWarn = `${btn} bg-amber-400 text-amber-950 hover:bg-amber-300`

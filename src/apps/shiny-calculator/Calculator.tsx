import { useCallback, useEffect, useReducer } from 'react'

/**
 * Deliberately uses only CSS custom properties from the theme contract (§12),
 * never hardcoded colours — so it re-themes with the rest of the site.
 */

type Op = '+' | '-' | '×' | '÷'

interface State {
  /** What the display shows right now. */
  display: string
  /** Left-hand operand, held while an operator is pending. */
  accumulator: number | null
  pending: Op | null
  /** True when the next digit should replace the display rather than append. */
  overwrite: boolean
  history: string
  error: boolean
}

const INITIAL: State = {
  display: '0',
  accumulator: null,
  pending: null,
  overwrite: true,
  history: '',
  error: false,
}

type Action =
  | { type: 'digit'; value: string }
  | { type: 'dot' }
  | { type: 'op'; value: Op }
  | { type: 'equals' }
  | { type: 'clear' }
  | { type: 'sign' }
  | { type: 'percent' }
  | { type: 'backspace' }

function compute(a: number, op: Op, b: number): number | null {
  switch (op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '×':
      return a * b
    case '÷':
      return b === 0 ? null : a / b
  }
}

/** Trim float noise (0.1 + 0.2) without lying about big numbers. */
function fmt(n: number): string {
  if (!Number.isFinite(n)) return 'Error'
  const r = Math.round(n * 1e12) / 1e12
  if (Math.abs(r) >= 1e15) return r.toExponential(6)
  return String(r)
}

function reducer(state: State, action: Action): State {
  if (state.error && action.type !== 'clear') return state

  switch (action.type) {
    case 'digit': {
      if (state.overwrite) return { ...state, display: action.value, overwrite: false }
      if (state.display === '0') return { ...state, display: action.value }
      if (state.display.replace(/[-.]/g, '').length >= 15) return state
      return { ...state, display: state.display + action.value }
    }

    case 'dot': {
      if (state.overwrite) return { ...state, display: '0.', overwrite: false }
      if (state.display.includes('.')) return state
      return { ...state, display: state.display + '.' }
    }

    case 'sign':
      return {
        ...state,
        display: state.display.startsWith('-')
          ? state.display.slice(1)
          : '-' + state.display,
      }

    case 'percent':
      return { ...state, display: fmt(parseFloat(state.display) / 100), overwrite: true }

    case 'backspace': {
      if (state.overwrite) return state
      const next = state.display.slice(0, -1)
      return { ...state, display: next === '' || next === '-' ? '0' : next }
    }

    case 'op': {
      const current = parseFloat(state.display)
      // Chained operators: fold the pending one first (2 + 3 × → shows 5)
      if (state.pending !== null && state.accumulator !== null && !state.overwrite) {
        const result = compute(state.accumulator, state.pending, current)
        if (result === null) return { ...INITIAL, display: 'Cannot divide by zero', error: true }
        return {
          ...state,
          accumulator: result,
          display: fmt(result),
          pending: action.value,
          overwrite: true,
          history: `${fmt(result)} ${action.value}`,
        }
      }
      return {
        ...state,
        accumulator: current,
        pending: action.value,
        overwrite: true,
        history: `${fmt(current)} ${action.value}`,
      }
    }

    case 'equals': {
      if (state.pending === null || state.accumulator === null) return state
      const current = parseFloat(state.display)
      const result = compute(state.accumulator, state.pending, current)
      if (result === null) return { ...INITIAL, display: 'Cannot divide by zero', error: true }
      return {
        ...INITIAL,
        display: fmt(result),
        history: `${fmt(state.accumulator)} ${state.pending} ${fmt(current)} =`,
      }
    }

    case 'clear':
      return INITIAL
  }
}

const KEYS: Array<{ label: string; action: Action; kind?: 'op' | 'fn' | 'eq'; wide?: boolean }> = [
  { label: 'AC', action: { type: 'clear' }, kind: 'fn' },
  { label: '±', action: { type: 'sign' }, kind: 'fn' },
  { label: '%', action: { type: 'percent' }, kind: 'fn' },
  { label: '÷', action: { type: 'op', value: '÷' }, kind: 'op' },
  { label: '7', action: { type: 'digit', value: '7' } },
  { label: '8', action: { type: 'digit', value: '8' } },
  { label: '9', action: { type: 'digit', value: '9' } },
  { label: '×', action: { type: 'op', value: '×' }, kind: 'op' },
  { label: '4', action: { type: 'digit', value: '4' } },
  { label: '5', action: { type: 'digit', value: '5' } },
  { label: '6', action: { type: 'digit', value: '6' } },
  { label: '-', action: { type: 'op', value: '-' }, kind: 'op' },
  { label: '1', action: { type: 'digit', value: '1' } },
  { label: '2', action: { type: 'digit', value: '2' } },
  { label: '3', action: { type: 'digit', value: '3' } },
  { label: '+', action: { type: 'op', value: '+' }, kind: 'op' },
  { label: '0', action: { type: 'digit', value: '0' }, wide: true },
  { label: '.', action: { type: 'dot' } },
  { label: '=', action: { type: 'equals' }, kind: 'eq' },
]

const KEY_MAP: Record<string, Action> = {
  '0': { type: 'digit', value: '0' },
  '1': { type: 'digit', value: '1' },
  '2': { type: 'digit', value: '2' },
  '3': { type: 'digit', value: '3' },
  '4': { type: 'digit', value: '4' },
  '5': { type: 'digit', value: '5' },
  '6': { type: 'digit', value: '6' },
  '7': { type: 'digit', value: '7' },
  '8': { type: 'digit', value: '8' },
  '9': { type: 'digit', value: '9' },
  '.': { type: 'dot' },
  '+': { type: 'op', value: '+' },
  '-': { type: 'op', value: '-' },
  '*': { type: 'op', value: '×' },
  x: { type: 'op', value: '×' },
  '/': { type: 'op', value: '÷' },
  '%': { type: 'percent' },
  Enter: { type: 'equals' },
  '=': { type: 'equals' },
  Backspace: { type: 'backspace' },
  Escape: { type: 'clear' },
  c: { type: 'clear' },
}

export default function Calculator() {
  const [state, dispatch] = useReducer(reducer, INITIAL)

  const onKey = useCallback((e: KeyboardEvent) => {
    const action = KEY_MAP[e.key]
    if (!action) return
    e.preventDefault()
    dispatch(action)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  return (
    <div className="calc">
      <output className="screen" aria-live="polite">
        <span className="history">{state.history || ' '}</span>
        <span className={`display${state.error ? ' error' : ''}`}>{state.display}</span>
      </output>

      <div className="pad">
        {KEYS.map((k) => (
          <button
            key={k.label}
            type="button"
            className={[k.kind ?? 'num', k.wide ? 'wide' : ''].filter(Boolean).join(' ')}
            onClick={() => dispatch(k.action)}
          >
            {k.label}
          </button>
        ))}
      </div>

      <p className="hint">
        Keyboard: digits, <kbd>+ − * /</kbd>, <kbd>Enter</kbd>, <kbd>Backspace</kbd>,{' '}
        <kbd>Esc</kbd>
      </p>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'

// An edit form over a record that may be refreshed in the background (useQuery).
//
// `base` is the copy of the record the form was taken from. Saves must diff the form
// against `toForm(base)` and send `base.version`: diffing against a newer copy would
// send (and revert) fields someone else changed, under their own version.
//
// The form is (re)seeded from `record` when it is first loaded, when it is another record,
// and when a newer copy arrives while nothing has been edited yet. After a save,
// `rebase(saved)` starts over from the saved record.
export function useRecordForm(record, toForm) {
  const toFormRef = useRef(toForm)
  toFormRef.current = toForm
  const [state, setState] = useState(() => (record ? { base: record, form: toForm(record) } : null))

  useEffect(() => {
    if (!record) return
    setState((s) => {
      if (!s || s.base.id !== record.id) return { base: record, form: toFormRef.current(record) }
      const untouched = JSON.stringify(s.form) === JSON.stringify(toFormRef.current(s.base))
      if (untouched && JSON.stringify(record) !== JSON.stringify(s.base)) return { base: record, form: toFormRef.current(record) }
      return s
    })
  }, [record])

  const setForm = useCallback(
    (next) => setState((s) => s && { ...s, form: typeof next === 'function' ? next(s.form) : next }),
    []
  )
  const rebase = useCallback((saved) => setState({ base: saved, form: toFormRef.current(saved) }), [])

  // Until the effect catches up with another record, show nothing rather than the old form.
  const current = state && record && state.base.id === record.id ? state : null
  return { form: current?.form ?? null, base: current?.base ?? null, setForm, rebase }
}

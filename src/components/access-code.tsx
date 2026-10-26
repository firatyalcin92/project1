import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Notice } from '~/components/ui'
import { redeemAccessCodeFn } from '~/functions/couple'
import { parseError } from '~/lib/errors'

/** "Erişim kodum var": yöneticinin verdiği kodu bu çifte bağlar. */
export function AccessCodeForm({ startOpen = false }: { startOpen?: boolean }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(startOpen)
  const [code, setCode] = useState('')
  const redeem = useMutation({
    mutationFn: () => redeemAccessCodeFn({ data: { code } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['panel'] }),
  })
  if (redeem.isSuccess) {
    return (
      <Notice tone="success" title="Kod tanımlandı">
        {redeem.data.usesLeft} mesele hakkınız var.
      </Notice>
    )
  }
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-semibold text-clay underline-offset-4 hover:underline"
      >
        Erişim kodum var
      </button>
    )
  }
  return (
    <form
      className="space-y-2 text-left"
      onSubmit={(e) => {
        e.preventDefault()
        if (code.trim()) redeem.mutate()
      }}
    >
      <label htmlFor="access-code" className="block text-sm font-semibold text-ink">
        Erişim kodu
      </label>
      <div className="flex gap-2">
        <input
          id="access-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={40}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          placeholder="MSL-XXXX-XXXX-XXXX"
          className="h-12 min-w-0 flex-1 rounded-2xl border border-line-strong bg-surface px-4 font-mono tracking-wider text-ink uppercase focus:border-clay focus:outline-none"
        />
        <Button type="submit" loading={redeem.isPending} disabled={!code.trim()}>
          Kullan
        </Button>
      </div>
      {redeem.isError ? <Notice tone="error">{parseError(redeem.error).message}</Notice> : null}
    </form>
  )
}

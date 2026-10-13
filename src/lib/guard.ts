import { redirect } from '@tanstack/react-router'
import { readMember } from './member-token'

/** Korumalı rotalar ssr:false çalışır; bu kontrol yalnızca tarayıcıda yapılır. */
export function requireMember() {
  if (!readMember()) throw redirect({ to: '/', replace: true })
}

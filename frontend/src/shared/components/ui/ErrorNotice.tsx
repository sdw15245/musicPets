import { Callout } from '@seed-design/react'
import type { ReactNode } from 'react'

export default function ErrorNotice({ children, title, action }: { children: ReactNode; title?: string; action?: ReactNode }) {
  return <Callout.Root tone="critical" role="alert">
    <Callout.Content>
      {title && <Callout.Title asChild><h2>{title}</h2></Callout.Title>}
      <Callout.Description>{children}</Callout.Description>
      {action && <div className="notice-action">{action}</div>}
    </Callout.Content>
  </Callout.Root>
}

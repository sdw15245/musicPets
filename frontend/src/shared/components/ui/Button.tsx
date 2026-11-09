import type { ComponentProps } from 'react'
import { ActionButton } from 'seed-design/ui/action-button'

/** Keep SEED's sizes, states and press feedback; customize brand through tokens only. */
export default function Button(props: ComponentProps<typeof ActionButton>) {
  return <ActionButton variant="neutralWeak" size="medium" {...props} />
}

/**
 * @file ui:snackbar
 * @requires @seed-design/react@^2.0.0 || ^3.0.0
 * Adapted from the official registry: type aliases and a desktop-width region.
 */
import { Snackbar as SeedSnackbar } from '@seed-design/react'
import { IconCheckmarkCircleFill, IconExclamationmarkCircleFill } from '@karrotmarket/react-monochrome-icon'
import { forwardRef } from 'react'

export function SnackbarProvider({ children, ...props }: SeedSnackbar.RootProviderProps) {
  return <SeedSnackbar.RootProvider {...props}>
    {children}
    <SeedSnackbar.Region className="app-snackbar-region"><SeedSnackbar.Renderer /></SeedSnackbar.Region>
  </SeedSnackbar.RootProvider>
}

type SnackbarProps = Omit<SeedSnackbar.RootProps, 'children' | 'asChild'> & { message: string }

export const Snackbar = forwardRef<HTMLDivElement, SnackbarProps>(({ variant = 'default', message, ...props }, ref) => (
  <SeedSnackbar.Root ref={ref} variant={variant} {...props}>
    {variant !== 'default' && <SeedSnackbar.PrefixIcon svg={variant === 'positive' ? <IconCheckmarkCircleFill /> : <IconExclamationmarkCircleFill />} />}
    <SeedSnackbar.Content><SeedSnackbar.Message>{message}</SeedSnackbar.Message></SeedSnackbar.Content>
    <SeedSnackbar.HiddenCloseButton>닫기</SeedSnackbar.HiddenCloseButton>
  </SeedSnackbar.Root>
))
Snackbar.displayName = 'Snackbar'

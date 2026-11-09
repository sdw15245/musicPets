import { useId, type InputHTMLAttributes } from 'react'
import { Chip, RadioGroup } from '@seed-design/react'

// Keep each form/filter independent while using SEED's public radio-chip API.
export function RadioChipGroup({ name, ...props }: Chip.RadioRootProps) {
  const id = useId()
  return <Chip.RadioRoot name={name ?? id} {...props} />
}

type RadioChipProps = Chip.RadioItemProps & {
  inputProps?: InputHTMLAttributes<HTMLInputElement>
}

export function RadioChip({ children, inputProps, ...props }: RadioChipProps) {
  return <Chip.RadioItem {...props}>
    {children}
    <RadioGroup.ItemHiddenInput {...inputProps} />
  </Chip.RadioItem>
}

export function RadioChipLabel(props: Chip.LabelProps) {
  return <Chip.Label {...props} />
}

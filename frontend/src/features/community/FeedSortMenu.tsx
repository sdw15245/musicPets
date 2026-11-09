import { useMenuFocus } from '../../shared/components/ui/useMenuFocus'
import { Menu } from '@seed-design/react'
import { IconCheckmarkLine, IconChevronDownLine } from '@karrotmarket/react-monochrome-icon'
import Button from '../../shared/components/ui/Button'

const options = [
  { value: 'latest', label: '최신글' },
  { value: 'popular', label: '인기글(공감순)' },
] as const

export type FeedSort = typeof options[number]['value']

export default function FeedSortMenu({ value, onChange }: { value: FeedSort; onChange: (value: FeedSort) => void }) {
  const { open, onOpenChange, triggerRef, contentRef } = useMenuFocus()
  const label = options.find(option => option.value === value)!.label
  return <Menu.Root size="responsive" placement="bottom-end" gutter={8} open={open} onOpenChange={onOpenChange}>
    <Menu.Trigger asChild ref={triggerRef}>
      <Button className="community-sort" size="small" variant="ghost" aria-label={`정렬: ${label}`}>
        {label}<IconChevronDownLine size={16} aria-hidden="true" />
      </Button>
    </Menu.Trigger>
    <Menu.Positioner className="community-sort-menu"><Menu.Content ref={contentRef}><Menu.ScrollArea>
      <Menu.Group aria-label="게시글 정렬">
        {options.map(option => <Menu.Item key={option.value} aria-current={value === option.value ? 'true' : undefined} onClick={() => onChange(option.value)}>
          <Menu.ItemBody><Menu.ItemLabel>{option.label}</Menu.ItemLabel></Menu.ItemBody>
          {value === option.value && <IconCheckmarkLine size={16} aria-hidden="true" />}
        </Menu.Item>)}
      </Menu.Group>
    </Menu.ScrollArea></Menu.Content></Menu.Positioner>
  </Menu.Root>
}

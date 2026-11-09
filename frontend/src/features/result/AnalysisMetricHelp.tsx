import { HelpBubble, Icon } from '@seed-design/react'
import { IconILowercaseSerifCircleFill, IconXmarkLine } from '@karrotmarket/react-monochrome-icon'
import Button from '../../shared/components/ui/Button'

export default function AnalysisMetricHelp({ title, description }: { title: string; description: string }) {
  return <HelpBubble.Root autoFocus placement="bottom">
    <HelpBubble.Trigger asChild><Button variant="ghost" size="small" layout="iconOnly" aria-label={title}>
      <Icon svg={<IconILowercaseSerifCircleFill />} />
    </Button></HelpBubble.Trigger>
    <HelpBubble.PositionerPortal>
      <HelpBubble.Content maxWidth="min(300px, calc(100vw - 32px))">
        <HelpBubble.Arrow><HelpBubble.ArrowTip /></HelpBubble.Arrow>
        <HelpBubble.Body><HelpBubble.Title>{title}</HelpBubble.Title><HelpBubble.Description>{description}</HelpBubble.Description></HelpBubble.Body>
        <HelpBubble.CloseButton aria-label="도움말 닫기"><Icon svg={<IconXmarkLine />} /></HelpBubble.CloseButton>
      </HelpBubble.Content>
    </HelpBubble.PositionerPortal>
  </HelpBubble.Root>
}

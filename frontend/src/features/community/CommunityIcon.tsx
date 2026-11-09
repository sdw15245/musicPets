import {
  IconMusicalnoteDoubleLine, IconPlusLine, IconHeartLine, IconHeartFill,
  IconArrowRightLine, IconMagnifyingglassLine, IconXmarkLine, IconGridLine,
  IconSparkle2Line, IconArrowUpRightLine, IconTrashcanLine,
} from '@karrotmarket/react-monochrome-icon'

const icons = {
  music: IconMusicalnoteDoubleLine, plus: IconPlusLine, heart: IconHeartLine,
  heartFilled: IconHeartFill,
  arrow: IconArrowRightLine, search: IconMagnifyingglassLine,
  close: IconXmarkLine, grid: IconGridLine, sparkles: IconSparkle2Line,
  external: IconArrowUpRightLine, trash: IconTrashcanLine,
}
function CommunityIcon({ name }: { name: keyof typeof icons }) {
  const Icon = icons[name]
  return <Icon className="community-icon" aria-hidden="true" />
}

export default CommunityIcon

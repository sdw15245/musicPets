import { useId, useRef, useState, type RefObject } from 'react'
import { Icon, Popover, TextField } from '@seed-design/react'
import { IconMagnifyingglassLine, IconXmarkLine } from '@karrotmarket/react-monochrome-icon'
import Button from '../../shared/components/ui/Button'
import { useRecentSearches } from './useRecentSearches'

interface CommunitySearchProps {
  owner: string | null
  value: string
  inputRef: RefObject<HTMLInputElement | null>
  onValueChange: (value: string) => void
  onSearch: (query: string) => void
}

export default function CommunitySearch({ owner, value, inputRef, onValueChange, onSearch }: CommunitySearchProps) {
  const [open, setOpen] = useState(false)
  const history = useRecentSearches(owner)
  const historyRef = useRef<HTMLDivElement>(null)
  const historyId = useId()
  const showHistory = !!owner && open

  const search = (input: string) => {
    const query = input.trim().replace(/^#+/, '').trim()
    history.add(query)
    onSearch(query)
    setOpen(false)
  }

  return <Popover.Root open={showHistory} onOpenChange={setOpen} autoFocus={false} placement="bottom-start" gutter={8}>
    <Popover.Anchor asChild>
      <form className="community-search" role="search" aria-label="게시글 검색" onSubmit={event => {
        event.preventDefault()
        // Submit what is visible, even while the router is committing the previous search.
        search(inputRef.current?.value ?? value)
      }}>
        <TextField.Root className="community-search-field" size="large" value={value} onValueChange={onValueChange}>
          <TextField.Input ref={inputRef} aria-label="본문 또는 태그 검색" placeholder="글 내용·태그 검색" maxLength={100} autoComplete="off"
            aria-haspopup={owner ? 'dialog' : undefined} aria-expanded={owner ? showHistory : undefined} aria-controls={showHistory ? historyId : undefined}
            onFocus={event => { if (owner && !historyRef.current?.contains(event.relatedTarget)) setOpen(true) }}
            onClick={() => { if (owner) setOpen(true) }}
            onKeyDown={event => { if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault() }} />
          <Button className="community-search-submit" type="submit" size="medium" variant="ghost" layout="iconOnly" color="fg.neutralMuted" aria-label="게시글 검색">
            <Icon size="x6" svg={<IconMagnifyingglassLine />} />
          </Button>
        </TextField.Root>
      </form>
    </Popover.Anchor>
    {owner && <Popover.Positioner className="community-search-positioner">
      <Popover.Content ref={historyRef} id={historyId} className="community-search-history" width="360px" maxWidth="calc(100vw - 32px)">
        <Popover.Header className="community-search-history-heading">
          <Popover.Title>최근 검색어</Popover.Title>
          <Button variant="ghost" size="small" color="fg.neutralMuted" fontWeight="regular" disabled={!history.terms.length} onClick={() => { inputRef.current?.focus(); history.clear() }}>전체 삭제</Button>
        </Popover.Header>
        <Popover.Body paddingX="x5">
          {history.terms.length ? <ul className="community-recent-searches">
            {history.terms.map(term => <li className="community-recent-search" key={term}>
              <Button className="community-recent-search-term" variant="ghost" size="medium" fontWeight="regular" aria-label={`최근 검색어 ${term} 검색`} onClick={() => {
                onValueChange(term)
                inputRef.current?.focus()
                search(term)
              }}><span>{term}</span></Button>
              <Button variant="ghost" size="small" layout="iconOnly" color="fg.neutralMuted" aria-label={`최근 검색어 ${term} 삭제`} onClick={() => { inputRef.current?.focus(); history.remove(term) }}>
                <Icon svg={<IconXmarkLine />} />
              </Button>
            </li>)}
          </ul> : <p className="community-recent-searches-empty">최근 검색어가 없어요.</p>}
        </Popover.Body>
      </Popover.Content>
    </Popover.Positioner>}
  </Popover.Root>
}

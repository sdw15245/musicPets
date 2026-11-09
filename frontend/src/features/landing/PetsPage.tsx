import { characters } from '../../shared/characters'
import { useMe } from '../auth/useAuth'
import PersonalLayout from '../mypage/PersonalLayout'
import MusicListSkeleton from '../../shared/components/ui/MusicListSkeleton'
import RequestErrorNotice from '../../shared/components/ui/RequestErrorNotice'
import Button from '../../shared/components/ui/Button'
import { Badge } from 'seed-design/ui/badge'
import { Link } from 'react-router-dom'

export default function PetsPage() {
  const me = useMe()
  const unlocked = me.data?.unlockedCharacters ?? []
  const met = characters.filter(pet => unlocked.includes(pet.slug) || unlocked.includes(pet.name))
  return <PersonalLayout taste title="만난 펫">
    {me.isPending ? <MusicListSkeleton label="만난 펫을 불러오고 있어요." /> : me.isError ?
      <RequestErrorNotice error={me.error} action={blocked => <Button disabled={blocked} onClick={() => void me.refetch()}>다시 불러오기</Button>}>만난 펫을 불러오지 못했어요.</RequestErrorNotice> : <>
      <div className="pets-overview"><p>{met.length ? `${met.length}마리와 만났어요.` : '첫 음악 펫을 만나보세요.'}</p><Button asChild variant="ghost"><Link to="/analyze">{met.length ? '다시 분석하기' : '음악 취향 분석하기'}</Link></Button></div>
      <ul className="pets-collection">{characters.map(pet => {
        const discovered = met.includes(pet)
        return <li key={pet.slug} className="pet-collection-row">
          <img src={pet.imageUrl} alt="" width={64} height={64} className={discovered ? undefined : 'pet-not-met'} />
          <div><h2>{pet.name}</h2>{discovered
            ? <details className="pet-story"><summary>펫 이야기</summary><p>{pet.story}</p></details>
            : <p>펫을 만나면 이야기가 열려요.</p>}</div>
          <Badge tone={discovered ? 'brand' : 'neutral'} variant="weak">{discovered ? '만난 펫' : '아직 만나기 전'}</Badge>
        </li>
      })}</ul>
    </>}
  </PersonalLayout>
}

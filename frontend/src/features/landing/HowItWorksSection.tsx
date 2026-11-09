import { characters } from '../../shared/characters'
import { IconBarchartSquareLine, IconHeadphoneLine, IconPawprintLine } from '@karrotmarket/react-monochrome-icon'
import SpotifyLogo from '../../shared/components/SpotifyLogo'
import './how-it-works.css'

const steps = [
  { n: 1, t: 'Spotify를 연결해요', d: '최근 4주에 즐겨 들은 곡을\n최대 20곡까지 가져와 분석해요.', icon: IconHeadphoneLine },
  { n: 2, t: '내 취향을 알아봐요', d: '어떤 장르를 즐기는지 살펴보고,\n다음에 들을 곡도 추천받아요.', icon: IconBarchartSquareLine },
  { n: 3, t: '닮은 펫을 만나요', d: '내 음악 취향과\n가장 가까운 펫을 찾아요.', icon: IconPawprintLine },
] as const
const example = characters[0]
const exampleGenres = Object.entries(example.vector).sort((a, b) => b[1] - a[1]).slice(0, 3)

function HowItWorksSection() {
  return (
    <section className="steps-section section-pad">
      <div className="section-shell">
        <div className="section-head">
          <div>
            <div className="section-kicker">이용 방법</div>
            <h2 className="wf-h2">듣던 음악으로<br />나의 펫을 찾는 방법</h2>
          </div>
        </div>

        <ol className="how-flow" aria-label="음악 펫을 만나는 과정">
          {steps.map((s) => {
            const StepIcon = s.icon
            return <li key={s.n} className="how-step">
              <div className="how-step-icon" aria-hidden="true"><StepIcon size={28} /></div>
              <h3>{s.t}</h3>
              <p className="how-step-description">{s.d}</p>
              <div className="how-example">
                {s.n === 1 ? <>
                  <div className="how-example-heading"><SpotifyLogo /><span>청취 기록 예시</span></div>
                  <ul className="how-listening-tracks">
                    <li><strong>Everything</strong><span>검정치마</span></li>
                    <li><strong>Square (2017)</strong><span>백예린</span></li>
                  </ul>
                </> : s.n === 2 ? <>
                  <div className="how-example-heading"><strong>주요 장르</strong><span>분석 예시</span></div>
                  <ul className="how-genre-preview">{exampleGenres.map(([genre, ratio]) => <li key={genre}>
                    <span>{genre}</span><div><span style={{ width: `${ratio * 100}%` }} /></div>
                  </li>)}</ul>
                </> : <>
                  <div className="how-example-heading"><strong>나를 닮은 음악 펫</strong><span>결과 예시</span></div>
                  <div className="how-pet-preview"><img src={example.imageUrl} alt={example.name} width={64} height={64} loading="lazy" />
                    <div><strong>{example.name}</strong></div>
                  </div>
                </>}
              </div>
            </li>
          })}
        </ol>
      </div>
    </section>
  )
}

export default HowItWorksSection

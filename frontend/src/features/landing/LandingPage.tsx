// 랜딩 페이지. Hero/HowItWorks/CharacterPreview/Cta/Footer 섹션을 조립하고 스크롤 네비게이션 처리.
import { useRef } from 'react'
import { useLandingPresentation } from './useLandingPresentation'
import HeroSection from './HeroSection'
import HowItWorksSection from './HowItWorksSection'
import CharacterPreviewSection from './CharacterPreviewSection'
import CtaSection from './CtaSection'
import Footer from './Footer'
import LandingNavbar from './LandingNavbar'
import Reveal from '../../shared/components/Reveal'

function LandingPage() {
  const presentation = useLandingPresentation()
  const introRef = useRef<HTMLDivElement>(null)
  const charactersRef = useRef<HTMLDivElement>(null)

  const scrollTo = (key: 'intro' | 'characters') => {
    const refs = {
      intro: introRef,
      characters: charactersRef,
    }
    refs[key].current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return (
    <div id="top" className="wf remodeled-landing">
      <LandingNavbar onNavigate={scrollTo} />
      <main>
      <div className="music-hero-surface"><HeroSection onNavigate={scrollTo} presentation={presentation} /></div>
      <div id="intro" ref={introRef}>
        <Reveal><HowItWorksSection /></Reveal>
      </div>
      <div id="characters" ref={charactersRef}>
        <Reveal><CharacterPreviewSection /></Reveal>
      </div>
      <Reveal><CtaSection presentation={presentation} /></Reveal>
      </main>
      <Footer />
    </div>
  )
}

export default LandingPage

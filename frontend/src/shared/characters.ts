// 프론트 도감과 백엔드 매칭이 같은 원본을 사용한다.
import characters from '../../../shared/characters.json' with { type: 'json' }

export { characters }

// Stored records keep their original slugs; accept old display names during rollout.
const legacyNames: Record<string, string> = { mochi: '모찌', pip: '핍', bongbong: '봉봉', yuze: '유즈', 'sulk-cat': '삐냥' }

export function resolveCharacter(value: string | null | undefined) {
  return characters.find(pet => pet.slug === value || pet.name === value || legacyNames[pet.slug] === value)
}

// Only generated pet commentary goes through this adapter, never user-authored text.
export function currentCharacterText(text: string) {
  const vowelParticles: Record<string, string> = { '으로': '로', '이라는': '라는', '이라고': '라고', '이라서': '라서', '이랑': '랑', '은': '는', '이': '가', '을': '를', '과': '와' }
  for (const pet of characters) {
    const oldName = legacyNames[pet.slug]
    if (!oldName) continue
    if (['pip', 'bongbong', 'sulk-cat'].includes(pet.slug)) {
      text = text.replace(new RegExp(`${oldName}(으로|이라는|이라고|이라서|이랑|은|이|을|과)(?=$|[^가-힣])`, 'g'),
        (_, particle: string) => pet.name + vowelParticles[particle])
    }
    text = text.replaceAll(oldName, pet.name)
  }
  return text
}

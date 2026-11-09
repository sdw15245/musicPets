import { useState } from 'react'
import { Field, TextField } from '@seed-design/react'
import type { useProfile } from './useProfile'
import Button from '../../shared/components/ui/Button'
import ErrorNotice from '../../shared/components/ui/ErrorNotice'
import { useRequestLimit } from '../../shared/api/useRequestLimit'
import RequestLimitNotice from '../../shared/components/ui/RequestLimitNotice'
import { useSuccessNotice } from '../../shared/components/ui/useSuccessNotice'

export default function ProfileEditor({ profile, onClose }: { profile: ReturnType<typeof useProfile>; onClose: () => void }) {
  const [name, setName] = useState(profile.name)
  const notifySuccess = useSuccessNotice()
  const [error, setError] = useState<unknown>(null)
  const limit = useRequestLimit([error])
  return <form className="profile-editor" onSubmit={async event => {
    event.preventDefault()
    if (!name.trim()) return
    if (profile.saving || limit?.blocked) return
    setError(null)
    try {
      await profile.save(name.trim())
      notifySuccess('프로필을 저장했어요.')
      onClose()
    } catch (cause) { setError(cause) }
  }}>
    <Field.Root>
      <Field.Header><Field.Label>이름</Field.Label></Field.Header>
      <TextField.Root value={name} onValueChange={setName}>
        <TextField.Input maxLength={30} required autoComplete="nickname" autoFocus disabled={profile.saving} />
      </TextField.Root>
      <Field.Footer><Field.Description>처음에는 Spotify 계정 이름이 적용돼요.</Field.Description><Field.CharacterCount current={name.length} max={30} /></Field.Footer>
    </Field.Root>
    <div className="profile-editor-actions">
      <Button type="button" size="small" variant="ghost" disabled={profile.saving} onClick={onClose}>취소</Button>
      <Button type="submit" size="small" variant="brandSolid" loading={profile.saving} disabled={!name.trim() || profile.saving || limit?.blocked}>프로필 저장</Button>
    </div>
    {limit ? <RequestLimitNotice limit={limit} /> : !!error && <ErrorNotice>프로필을 저장하지 못했어요. 잠시 후 다시 시도해주세요.</ErrorNotice>}
  </form>
}

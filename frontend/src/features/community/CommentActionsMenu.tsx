import ActionsMenu from '../../shared/components/ui/ActionsMenu'

export default function CommentActionsMenu({ disabled, onEdit, onDelete }: {
  disabled: boolean
  onEdit: (trigger: HTMLButtonElement) => void
  onDelete: () => void
}) {
  return <ActionsMenu label="댓글 더보기" menuLabel="댓글 관리" disabled={disabled} actions={[
    { label: '댓글 수정', onSelect: onEdit },
    { label: '댓글 삭제', onSelect: onDelete, critical: true, opensDialog: true },
  ]} />
}

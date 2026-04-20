export const useDateFormat = () => {
  const formatDate = (d, opts = { month: 'short', day: 'numeric' }) =>
    d ? new Date(d).toLocaleDateString('zh-CN', opts) : ''
  return { formatDate }
}

const STATUS_MAP = {
  created: { label: '待启动', badge: 'badge-pending' },
  wf01_running: { label: 'WF01运行中', badge: 'badge-running' },
  wf01_done: { label: 'WF01完成', badge: 'badge-done' },
  wf02_running: { label: 'WF02运行中', badge: 'badge-running' },
  wf02_done: { label: 'WF02完成', badge: 'badge-done' },
  wf03_running: { label: 'WF03运行中', badge: 'badge-running' },
  wf03_reviewing: { label: '审核IP档案', badge: 'badge-review' },
  wf03_done: { label: 'IP档案完成', badge: 'badge-done' },
  wf04_running: { label: '大纲对话中', badge: 'badge-running' },
  wf04_reviewing: { label: '审核大纲', badge: 'badge-review' },
  wf04_done: { label: '大纲完成', badge: 'badge-done' },
  wf05_scripting: { label: '剧本生成中', badge: 'badge-running' },
  completed: { label: '已完成', badge: 'badge-done' },
  failed: { label: '失败', badge: 'badge-failed' },
}

export const useProjectStatus = () => ({
  STATUS_MAP,
  statusLabel: (s) => STATUS_MAP[s]?.label || s,
  statusBadgeClass: (s) => STATUS_MAP[s]?.badge || 'badge-pending',
})

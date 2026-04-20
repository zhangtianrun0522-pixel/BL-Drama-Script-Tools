<template>
  <div class="wf-block" :class="{ 'wf-active': running, 'wf-done': wf?.status === 'done' }">
    <div class="wf-header">
      <div class="wf-title-row">
        <span class="dot" :class="dotClass"></span>
        <span class="wf-title">{{ title }}</span>
        <span v-if="wf" class="badge badge-sm" :class="wfBadge">{{ wfLabel }}</span>
      </div>
      <div class="wf-actions">
        <slot name="extra-actions" />
        <template v-if="!hideRunBtn">
          <button v-if="running" class="btn btn-ghost btn-sm" @click="$emit('stop')">
            ⏹ 停止
          </button>
          <button v-else class="btn btn-primary btn-sm" :disabled="!canRun" @click="$emit('run')">
            <span v-if="running" class="spinner"></span>
            ▶ {{ wf?.status === 'done' ? '重新生成' : '开始' }}
          </button>
        </template>
      </div>
    </div>

    <div v-if="running" class="wf-progress">
      <div class="progress-track">
        <div class="progress-fill" :style="progressStyle"></div>
      </div>
      <div class="progress-meta">
        <span class="progress-node">{{ nodeLabel || '运行中…' }}</span>
        <span class="progress-pct">{{ progress > 0 ? progress + '%' : '' }}</span>
      </div>
    </div>

    <div v-if="hasResult" class="wf-result">
      <slot name="result" />
    </div>

    <div v-if="wf?.error_msg && wf.status === 'failed'" class="wf-error">
      <span>⚠ 错误：{{ wf.error_msg }}</span>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  title: String,
  wf: Object,
  canRun: Boolean,
  running: Boolean,
  hideRunBtn: { type: Boolean, default: false },
  progress: { type: Number, default: 0 },      // 0-100
  nodeLabel: { type: String, default: '' },     // 当前节点名
})
defineEmits(['run', 'stop'])
const slots = useSlots()
const hasResult = computed(() => !!slots.result)

const dotClass = computed(() => {
  if (props.running) return 'dot-running'
  if (!props.wf) return 'dot-pending'
  return { done: 'dot-done', failed: 'dot-failed', running: 'dot-running' }[props.wf.status] || 'dot-pending'
})
const wfBadge = computed(() => {
  if (props.running) return 'badge-running'
  if (!props.wf) return 'badge-pending'
  return { done: 'badge-done', failed: 'badge-failed', running: 'badge-running' }[props.wf.status] || 'badge-pending'
})
const progressStyle = computed(() => {
  const pct = props.progress > 0 ? props.progress : 0
  if (pct === 0) return { width: '8%', animation: 'pulse-bar 1.5s ease-in-out infinite' }
  return { width: pct + '%', transition: 'width 0.5s ease', animation: 'none' }
})

const wfLabel = computed(() => {
  if (props.running) return '运行中'
  if (!props.wf) return '未开始'
  return { done: '完成', failed: '失败', running: '运行中', pending: '等待中' }[props.wf.status] || props.wf.status
})
</script>

<style scoped>
.wf-block {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: border-color var(--transition);
}
.wf-active { border-color: rgba(139,92,246,0.4); }
.wf-done { border-color: rgba(34,197,94,0.2); }

.wf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  gap: 12px;
}
.wf-title-row { display: flex; align-items: center; gap: 10px; }
.wf-title { font-size: 14px; font-weight: 600; }
.badge-sm { font-size: 11px; padding: 1px 7px; }
.wf-actions { display: flex; gap: 8px; align-items: center; }

.wf-progress {
  padding: 0 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.progress-track {
  width: 100%;
  height: 4px;
  background: var(--color-border-light);
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-secondary));
  border-radius: 2px;
  min-width: 8%;
}
@keyframes pulse-bar {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.progress-node { font-size: 12px; color: var(--color-primary); }
.progress-pct { font-size: 11px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }

.wf-result {
  padding: 0 20px 20px;
  border-top: 1px solid var(--color-border);
  padding-top: 16px;
}

.wf-error {
  padding: 10px 20px;
  font-size: 13px;
  color: var(--color-danger);
  background: var(--color-danger-bg);
  border-top: 1px solid rgba(239,68,68,0.2);
}
</style>

<template>
  <div class="page fade-in">
    <div class="page-header">
      <div class="header-left">
        <button class="btn btn-ghost btn-sm" @click="$router.push(`/project/${route.params.id}`)">← 返回项目</button>
        <div>
          <h1 class="page-title">剧本管理</h1>
          <p class="page-sub" v-if="project">{{ project.title }} · 共 {{ scripts.length }} 集</p>
        </div>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" :disabled="!selectedIds.length || batchRunning" @click="generateSelected">
          <span v-if="batchRunning" class="spinner"></span>
          批量生成{{ selectedIds.length ? ` (${selectedIds.length}集)` : '' }}
        </button>
        <button class="btn btn-ghost" @click="exportAll('docx')" :disabled="!!exporting">
          <span v-if="exporting === 'docx'" class="spinner"></span>
          导出 Word
        </button>
        <button class="btn btn-ghost" @click="exportAll('pdf')" :disabled="!!exporting">
          <span v-if="exporting === 'pdf'" class="spinner"></span>
          导出 PDF
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading-wrap">
      <span class="spinner" style="width:24px;height:24px;border-width:3px;"></span>
    </div>

    <template v-else>
      <div class="scripts-layout">
        <!-- 左侧列表 -->
        <div class="scripts-list">
          <div class="list-header">
            <label class="check-all">
              <input type="checkbox" :checked="allSelected" @change="toggleAll" />
              全选
            </label>
            <span class="list-stat">{{ doneCount }}/{{ scripts.length }} 已完成</span>
          </div>

          <div
            v-for="s in scripts"
            :key="s.id"
            class="script-item"
            :class="{ 'is-active': activeScript?.id === s.id }"
            @click="selectScript(s)"
          >
            <input type="checkbox" :checked="selectedIds.includes(s.id)" @change.stop="toggleSelect(s.id)" @click.stop />
            <div class="script-item-info">
              <div class="script-ep">第 {{ s.episode_num }} 集</div>
              <div class="script-status">
                <span class="dot" :class="`dot-${s.status}`"></span>
                <span class="status-text">{{ scriptStatusLabel(s.status) }}</span>
                <span v-if="s.rating !== 'unrated'" class="rating-badge">{{ s.rating === 'good' ? '👍' : '👎' }}</span>
              </div>
            </div>
            <div class="script-item-actions" @click.stop>
              <button
                class="btn btn-ghost btn-sm"
                :disabled="runningId === s.id || batchRunning"
                @click="generateOne(s)"
              >
                <span v-if="runningId === s.id" class="spinner"></span>
                {{ s.status === 'done' ? '重生成' : '生成' }}
              </button>
            </div>
          </div>
        </div>

        <!-- 右侧内容区 -->
        <div class="script-panel" v-if="activeScript">
          <div class="panel-header">
            <span class="panel-title">第 {{ activeScript.episode_num }} 集</span>
            <div class="panel-actions">
              <button class="btn btn-success btn-sm" :class="{ active: activeScript.rating === 'good' }" @click="rateScript('good')">👍 好稿</button>
              <button class="btn btn-danger btn-sm" :class="{ active: activeScript.rating === 'bad' }" @click="rateScript('bad')">👎 差稿</button>
              <button class="btn btn-ghost btn-sm" @click="toggleEdit">{{ editMode ? '取消' : '编辑' }}</button>
              <button v-if="editMode" class="btn btn-primary btn-sm" :disabled="saving" @click="saveEdit">
                <span v-if="saving" class="spinner"></span>
                保存
              </button>
            </div>
          </div>

          <div v-if="activeScript.episode_outline" class="outline-ref">
            <div class="outline-ref-title">本集大纲</div>
            <div class="outline-ref-content">{{ activeScript.episode_outline }}</div>
          </div>

          <!-- 生成中 -->
          <div v-if="runningId === activeScript.id" class="stream-wrap">
            <div class="stream-header">
              <span class="dot dot-running"></span>
              <span style="color:var(--color-primary);font-size:13px;">正在生成第 {{ activeScript.episode_num }} 集…</span>
            </div>
            <div class="stream-output">{{ liveOutput || '等待响应…' }}</div>
          </div>

          <template v-else>
            <div v-if="editMode" class="edit-wrap">
              <textarea v-model="editContent" class="textarea" rows="30" style="font-family:monospace;font-size:13px;flex:1;"></textarea>
            </div>
            <div v-else class="script-content stream-output">{{ activeScript.content || '(尚未生成)' }}</div>
          </template>

          <div v-if="activeScript.rating_note" class="rating-note">
            <span class="label" style="margin-bottom:0;margin-right:6px;">评价备注：</span>{{ activeScript.rating_note }}
          </div>
        </div>

        <div v-else class="script-panel empty-state">
          <div class="icon">📝</div>
          <p>点击左侧集数查看剧本</p>
        </div>
      </div>
    </template>

    <!-- 评分备注弹窗 -->
    <div v-if="rateTarget" class="modal-overlay" @click.self="rateTarget = null">
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <span class="modal-title">{{ pendingRating === 'good' ? '👍 标记好稿' : '👎 标记差稿' }}</span>
          <button class="modal-close" @click="rateTarget = null">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="label">备注（可选）</label>
            <input v-model="rateNote" class="input" placeholder="说明理由或指出问题…" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="rateTarget = null">取消</button>
          <button class="btn btn-primary" :disabled="submittingRate" @click="submitRate">
            <span v-if="submittingRate" class="spinner"></span>
            确认
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
import { useUserStore } from '~/stores/user'
import { useToastStore } from '~/stores/toast'

const userStore = useUserStore()
const toast = useToastStore()
const route = useRoute()
const apiBase = useRuntimeConfig().public.apiBase
const headers = useAuthHeaders()
const projectId = route.params.id

const project = ref(null)
const scripts = ref([])
const loading = ref(true)
const activeScript = ref(null)
const selectedIds = ref([])
const batchRunning = ref(false)
const runningId = ref(null)
const liveOutput = ref('')
const editMode = ref(false)
const editContent = ref('')
const saving = ref(false)
const exporting = ref(null)
const rateTarget = ref(null)
const rateNote = ref('')
const pendingRating = ref(null)
const submittingRate = ref(false)

const doneCount = computed(() => scripts.value.filter(s => s.status === 'done').length)
const allSelected = computed(() => scripts.value.length > 0 && selectedIds.value.length === scripts.value.length)

const fetchAll = async () => {
  loading.value = true
  try {
    const [pRes, sRes] = await Promise.all([
      $fetch(`/api/project/${projectId}`, { baseURL: apiBase, headers: headers.value }),
      $fetch(`/api/script/list?projectId=${projectId}`, { baseURL: apiBase, headers: headers.value }),
    ])
    if (pRes.code === 0) project.value = pRes.data
    if (sRes.code === 0) {
      scripts.value = sRes.data
      if (activeScript.value) {
        const r = sRes.data.find(s => s.id === activeScript.value.id)
        if (r) { activeScript.value = r; if (!editMode.value) editContent.value = r.content || '' }
      }
    }
  } catch (e) { toast.error(e.message) }
  finally { loading.value = false }
}

const selectScript = (s) => {
  activeScript.value = s
  editMode.value = false
  editContent.value = s.content || ''
}

const toggleSelect = (id) => {
  const idx = selectedIds.value.indexOf(id)
  if (idx === -1) selectedIds.value.push(id)
  else selectedIds.value.splice(idx, 1)
}
const toggleAll = () => {
  if (allSelected.value) selectedIds.value = []
  else selectedIds.value = scripts.value.map(s => s.id)
}
const toggleEdit = () => {
  editMode.value = !editMode.value
  if (editMode.value) editContent.value = activeScript.value?.content || ''
}

const generateOne = async (s) => {
  runningId.value = s.id
  liveOutput.value = ''
  activeScript.value = s
  try {
    const resp = await fetch(`${apiBase}/api/script/generate`, {
      method: 'POST',
      headers: { ...headers.value, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptId: s.id, projectId, episodeNum: s.episode_num }),
    })
    if (!resp.ok) { toast.error('生成失败'); return }
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (data.event === 'text_chunk') liveOutput.value += (data.data?.text || '')
          if (data.event === 'workflow_finished') {
            const out = data.data?.outputs
            if (out) liveOutput.value = out.script || out.result || out.text || JSON.stringify(out)
          }
        } catch { /* ignore */ }
      }
    }
    await fetchAll()
  } catch (e) { toast.error(e.message) }
  finally { runningId.value = null }
}

const generateSelected = async () => {
  if (!selectedIds.value.length) return
  batchRunning.value = true
  for (const id of [...selectedIds.value]) {
    const s = scripts.value.find(x => x.id === id)
    if (s) await generateOne(s)
  }
  batchRunning.value = false
}

const saveEdit = async () => {
  saving.value = true
  try {
    const res = await $fetch(`/api/script/${activeScript.value.id}`, {
      baseURL: apiBase, method: 'PUT', headers: headers.value,
      body: { content: editContent.value },
    })
    if (res.code === 0) { toast.success('已保存'); editMode.value = false; await fetchAll() }
    else toast.error(res.message)
  } catch (e) { toast.error(e.message) }
  finally { saving.value = false }
}

const rateScript = (r) => {
  pendingRating.value = r
  rateNote.value = activeScript.value?.rating_note || ''
  rateTarget.value = activeScript.value
}

const submitRate = async () => {
  submittingRate.value = true
  try {
    const res = await $fetch(`/api/script/${rateTarget.value.id}/rate`, {
      baseURL: apiBase, method: 'POST', headers: headers.value,
      body: { rating: pendingRating.value, note: rateNote.value },
    })
    if (res.code === 0) { toast.success('评价已保存'); rateTarget.value = null; await fetchAll() }
    else toast.error(res.message)
  } catch (e) { toast.error(e.message) }
  finally { submittingRate.value = false }
}

const exportAll = async (fmt) => {
  exporting.value = fmt
  try {
    const res = await $fetch(`/api/project/${projectId}/export?format=${fmt}`, {
      baseURL: apiBase, headers: headers.value, responseType: 'blob',
    })
    const blob = new Blob([res], {
      type: fmt === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.value?.title || 'scripts'}.${fmt === 'pdf' ? 'pdf' : 'docx'}`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) { toast.error('导出失败：' + e.message) }
  finally { exporting.value = null }
}

const scriptStatusLabel = (s) => ({ pending: '待生成', running: '生成中', done: '已完成', failed: '失败' })[s] || s

onMounted(fetchAll)
</script>

<style scoped>
.page { max-width: 1200px; }
.loading-wrap { display: flex; justify-content: center; padding: 80px; }

.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
.header-left { display: flex; align-items: flex-start; gap: 12px; }
.page-title { font-size: 22px; font-weight: 700; }
.page-sub { color: var(--color-text-muted); font-size: 13px; margin-top: 4px; }
.header-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }

.scripts-layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px; align-items: start; }

.scripts-list {
  background: var(--color-bg-card); border: 1px solid var(--color-border);
  border-radius: var(--radius); overflow: hidden;
}
.list-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--color-border);
  font-size: 13px; color: var(--color-text-secondary); background: var(--color-bg-overlay);
}
.check-all { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.list-stat { color: var(--color-text-muted); font-size: 12px; }

.script-item {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 16px; cursor: pointer;
  border-bottom: 1px solid var(--color-border);
  transition: background var(--transition);
}
.script-item:last-child { border-bottom: none; }
.script-item:hover { background: var(--color-bg-hover); }
.script-item.is-active { background: var(--color-primary-light); border-left: 3px solid var(--color-primary); padding-left: 13px; }
.script-item-info { flex: 1; min-width: 0; }
.script-ep { font-size: 14px; font-weight: 600; }
.script-status { display: flex; align-items: center; gap: 5px; margin-top: 3px; }
.status-text { font-size: 11px; color: var(--color-text-muted); }
.rating-badge { font-size: 12px; }
.script-item-actions { flex-shrink: 0; }

.script-panel {
  background: var(--color-bg-card); border: 1px solid var(--color-border);
  border-radius: var(--radius); overflow: hidden; display: flex; flex-direction: column;
  min-height: 500px;
}
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-overlay);
}
.panel-title { font-size: 15px; font-weight: 600; }
.panel-actions { display: flex; gap: 6px; }

.outline-ref {
  padding: 10px 20px; background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
}
.outline-ref-title { font-size: 11px; color: var(--color-text-muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
.outline-ref-content { font-size: 13px; color: var(--color-text-secondary); line-height: 1.6; max-height: 72px; overflow-y: auto; }

.stream-wrap { padding: 16px 20px; flex: 1; }
.stream-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }

.edit-wrap { padding: 16px 20px; flex: 1; display: flex; flex-direction: column; }
.script-content { padding: 20px; flex: 1; max-height: none !important; }

.rating-note {
  padding: 10px 20px; font-size: 13px; color: var(--color-text-secondary);
  background: var(--color-bg); border-top: 1px solid var(--color-border);
  display: flex; align-items: center;
}
</style>

<template>
  <div class="page fade-in">
    <div class="page-header">
      <div>
        <h1 class="page-title">IP 项目</h1>
        <p class="page-sub">管理所有BL短剧项目的创作进度</p>
      </div>
      <button class="btn btn-primary btn-lg" @click="showCreate = true">
        <span>＋</span> 新建项目
      </button>
    </div>

    <div v-if="loading" class="loading-wrap">
      <span class="spinner" style="width:24px;height:24px;border-width:3px;"></span>
    </div>

    <div v-else-if="projects.length === 0" class="empty-state">
      <div class="icon">🎬</div>
      <p>还没有项目，点击「新建项目」开始创作</p>
    </div>

    <div v-else class="project-grid">
      <div v-for="p in projects" :key="p.id" class="project-card" @click="$router.push(`/project/${p.id}`)">
        <div class="project-card-top">
          <span class="project-title">{{ p.title }}</span>
          <span class="badge" :class="statusBadgeClass(p.status)">{{ statusLabel(p.status) }}</span>
        </div>
        <div class="pipeline">
          <template v-for="(step, i) in pipelineSteps(p.status)" :key="i">
            <div class="pipeline-step" :class="step.state">
              <div class="step-dot"></div>
              <div class="step-name">{{ step.name }}</div>
            </div>
            <div v-if="i < 4" class="pipeline-line" :class="step.state"></div>
          </template>
        </div>
        <div class="project-card-footer">
          <span class="meta">{{ formatDate(p.created_at) }}</span>
          <div class="card-actions" @click.stop>
            <button class="btn btn-ghost btn-sm" @click="$router.push(`/project/${p.id}`)">详情</button>
            <button class="btn btn-danger btn-sm" @click="confirmDelete(p)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建项目弹窗 -->
    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">新建项目</span>
          <button class="modal-close" @click="showCreate = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="label">项目标题 *</label>
            <input v-model="createForm.title" class="input" placeholder="例：少年心动·总裁与实习生" />
          </div>

          <!-- 文件上传区 -->
          <div class="form-group">
            <label class="label">上传文件（PDF / DOCX，可多选）</label>
            <div
              class="upload-zone"
              :class="{ 'drag-over': isDragging, 'is-loading': extracting }"
              @dragenter.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @dragover.prevent
              @drop.prevent="onDrop"
              @click="$refs.fileInput.click()"
            >
              <input ref="fileInput" type="file" multiple accept=".pdf,.docx" style="display:none" @change="onFileChange" />
              <span v-if="extracting" class="spinner" style="width:18px;height:18px;"></span>
              <span v-else>
                <span style="font-size:20px;">📎</span>
                点击或拖拽上传文件
              </span>
              <span style="font-size:12px;color:var(--color-text-muted);margin-top:4px;">支持 PDF、DOCX，可同时上传多份</span>
            </div>

            <!-- 已上传文件列表 -->
            <div v-if="uploadedFiles.length" class="file-list">
              <div v-for="(f, i) in uploadedFiles" :key="i" class="file-item" :class="{ 'has-error': f.error }">
                <span class="file-icon">{{ f.name.endsWith('.pdf') ? '📄' : '📝' }}</span>
                <span class="file-name">{{ f.name }}</span>
                <span v-if="f.error" class="file-err">解析失败</span>
                <span v-else class="file-chars">{{ f.text.length.toLocaleString() }} 字</span>
                <button class="file-remove" @click.stop="removeFile(i)">×</button>
              </div>
            </div>
          </div>

          <div class="form-group">
            <label class="label">原始IP文本 *<span style="color:var(--color-text-muted);font-weight:400;margin-left:6px;">（上传文件后自动填入，也可手动编辑）</span></label>
            <textarea v-model="createForm.original_text" class="textarea" rows="8" placeholder="粘贴原始小说文本、故事梗概，或IP简介…"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showCreate = false">取消</button>
          <button class="btn btn-primary" :disabled="!createForm.title || !createForm.original_text || creating || extracting" @click="handleCreate">
            <span v-if="creating" class="spinner"></span>
            {{ creating ? '创建中...' : '创建项目' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <span class="modal-title">删除项目</span>
          <button class="modal-close" @click="deleteTarget = null">×</button>
        </div>
        <div class="modal-body">
          <p style="color:var(--color-text-secondary);">确定要删除项目 <strong style="color:var(--color-text);">「{{ deleteTarget.title }}」</strong>？此操作不可撤销。</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="deleteTarget = null">取消</button>
          <button class="btn btn-danger" :disabled="deleting" @click="handleDelete">
            <span v-if="deleting" class="spinner"></span>
            确认删除
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
const router = useRouter()
const apiBase = useRuntimeConfig().public.apiBase

const projects = ref([])
const loading = ref(true)
const showCreate = ref(false)
const createForm = reactive({ title: '', original_text: '' })
const creating = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

// 文件上传
const fileInput = ref(null)
const isDragging = ref(false)
const extracting = ref(false)
const uploadedFiles = ref([])  // [{ name, text, error }]

const headers = useAuthHeaders()

const fetchProjects = async () => {
  loading.value = true
  try {
    const res = await $fetch('/api/project', { baseURL: apiBase, headers: headers.value })
    if (res.code === 0) projects.value = res.data
  } catch (e) { toast.error('加载失败：' + e.message) }
  finally { loading.value = false }
}

const extractFiles = async (files) => {
  if (!files.length) return
  extracting.value = true
  try {
    const fd = new FormData()
    for (const f of files) fd.append('files', f)
    const res = await fetch(`${apiBase}/api/upload/extract`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userStore.token}` },
      body: fd,
    })
    const data = await res.json()
    if (data.code === 0) {
      for (const r of data.data) {
        uploadedFiles.value.push(r)
        if (r.text) {
          createForm.original_text = createForm.original_text
            ? createForm.original_text + '\n\n' + r.text
            : r.text
        }
      }
    } else {
      toast.error(data.message || '文件解析失败')
    }
  } catch (e) {
    toast.error('上传失败：' + e.message)
  } finally {
    extracting.value = false
    isDragging.value = false
  }
}

const onFileChange = (e) => extractFiles([...e.target.files])
const onDrop = (e) => extractFiles([...e.dataTransfer.files])
const removeFile = (i) => {
  uploadedFiles.value.splice(i, 1)
  // 重新拼接所有文件文本
  createForm.original_text = uploadedFiles.value.filter(f => f.text).map(f => f.text).join('\n\n')
}

const handleCreate = async () => {
  creating.value = true
  try {
    const res = await $fetch('/api/project', {
      baseURL: apiBase, method: 'POST', headers: headers.value,
      body: { title: createForm.title, original_text: createForm.original_text },
    })
    if (res.code === 0) {
      toast.success('项目已创建')
      showCreate.value = false
      createForm.title = ''; createForm.original_text = ''; uploadedFiles.value = []
      router.push(`/project/${res.data.id}`)
    } else { toast.error(res.message || '创建失败') }
  } catch (e) { toast.error(e.message || '网络错误') }
  finally { creating.value = false }
}

const confirmDelete = (p) => { deleteTarget.value = p }
const handleDelete = async () => {
  deleting.value = true
  try {
    const res = await $fetch(`/api/project/${deleteTarget.value.id}`, {
      baseURL: apiBase, method: 'DELETE', headers: headers.value,
    })
    if (res.code === 0) { toast.success('已删除'); deleteTarget.value = null; await fetchProjects() }
    else { toast.error(res.message || '删除失败') }
  } catch (e) { toast.error(e.message) }
  finally { deleting.value = false }
}

const { statusLabel, statusBadgeClass } = useProjectStatus()

const PIPELINE_NAMES = ['故事拆解', '洗稿方案', 'IP档案', '分集大纲', '剧本生成']
const DONE_THRESHOLDS = ['wf01_done', 'wf02_done', 'wf03_done', 'wf04_done', 'completed']
const RUNNING_STATUSES = [
  ['wf01_running'],
  ['wf02_running'],
  ['wf03_running', 'wf03_reviewing'],
  ['wf04_running', 'wf04_reviewing'],
  ['wf05_scripting'],
]
const ORDER = ['created','wf01_running','wf01_done','wf02_running','wf02_done','wf03_running','wf03_reviewing','wf03_done','wf04_running','wf04_reviewing','wf04_done','wf05_scripting','completed']

const pipelineSteps = (status) => {
  const idx = ORDER.indexOf(status)
  return PIPELINE_NAMES.map((name, i) => {
    const doneIdx = ORDER.indexOf(DONE_THRESHOLDS[i])
    let state = 'idle'
    if (idx >= doneIdx) state = 'done'
    else if (RUNNING_STATUSES[i].includes(status)) state = 'running'
    return { name, state }
  })
}

const { formatDate } = useDateFormat()
onMounted(fetchProjects)
</script>

<style scoped>
.page { max-width: 1100px; }
.page-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 28px; }
.page-title { font-size: 24px; font-weight: 700; }
.page-sub { color: var(--color-text-muted); font-size: 14px; margin-top: 4px; }
.loading-wrap { display: flex; justify-content: center; padding: 80px; }

.project-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }

.project-card {
  background: var(--color-bg-card); border: 1px solid var(--color-border);
  border-radius: var(--radius); padding: 20px; cursor: pointer;
  transition: all var(--transition); display: flex; flex-direction: column; gap: 16px;
}
.project-card:hover {
  border-color: rgba(139,92,246,0.4);
  box-shadow: 0 4px 20px rgba(139,92,246,0.1);
  transform: translateY(-1px);
}
.project-card-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.project-title { font-size: 15px; font-weight: 600; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.pipeline { display: flex; align-items: flex-start; }
.pipeline-step { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.step-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--color-border-light); flex-shrink: 0; }
.pipeline-step.done .step-dot { background: var(--color-success); }
.pipeline-step.running .step-dot { background: var(--color-primary); box-shadow: 0 0 6px var(--color-primary); animation: pulse 1.2s infinite; }
.step-name { font-size: 10px; color: var(--color-text-muted); text-align: center; line-height: 1.3; white-space: nowrap; }
.pipeline-step.done .step-name { color: var(--color-success); }
.pipeline-step.running .step-name { color: var(--color-primary); }
.pipeline-line { flex: 1; height: 2px; background: var(--color-border-light); margin-top: 4px; }
.pipeline-line.done { background: var(--color-success); }
.pipeline-line.running { background: var(--color-primary-light); }

.project-card-footer { display: flex; align-items: center; justify-content: space-between; }
.meta { font-size: 12px; color: var(--color-text-muted); }
.card-actions { display: flex; gap: 6px; }

/* 文件上传 */
.upload-zone {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; padding: 20px; border: 1.5px dashed var(--color-border-light);
  border-radius: var(--radius); cursor: pointer; transition: all var(--transition);
  color: var(--color-text-secondary); font-size: 14px; min-height: 80px;
  background: var(--color-bg-input);
}
.upload-zone:hover, .upload-zone.drag-over {
  border-color: var(--color-primary); background: rgba(139,92,246,0.05);
  color: var(--color-primary);
}
.upload-zone.is-loading { pointer-events: none; opacity: 0.7; }

.file-list { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.file-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 12px;
  background: var(--color-bg-input); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); font-size: 13px;
}
.file-item.has-error { border-color: var(--color-danger); }
.file-icon { flex-shrink: 0; }
.file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-chars { color: var(--color-success); font-size: 12px; flex-shrink: 0; }
.file-err { color: var(--color-danger); font-size: 12px; flex-shrink: 0; }
.file-remove {
  background: none; border: none; color: var(--color-text-muted); cursor: pointer;
  font-size: 16px; padding: 0 2px; line-height: 1; flex-shrink: 0;
}
.file-remove:hover { color: var(--color-danger); }
</style>

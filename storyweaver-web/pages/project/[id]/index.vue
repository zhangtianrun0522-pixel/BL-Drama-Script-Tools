<template>
  <div class="page-shell fade-in">
    <!-- 主内容 -->
    <div class="page-content">
    <div v-if="loading" class="loading-wrap">
      <span class="spinner" style="width:28px;height:28px;border-width:3px;"></span>
    </div>
    <template v-else-if="project">
      <!-- 页头 -->
      <div class="page-header">
        <div class="header-left">
          <button class="btn btn-ghost btn-sm" @click="$router.push('/')">← 返回</button>
          <div>
            <h1 class="page-title">{{ project.title }}</h1>
            <div class="header-meta">
              <span class="badge" :class="statusBadgeClass(project.status)">{{ statusLabel(project.status) }}</span>
              <span class="meta-date">创建于 {{ formatDate(project.created_at) }}</span>
            </div>
          </div>
        </div>
        <button
          v-if="project.status === 'wf04_done' || project.status === 'wf05_scripting' || project.status === 'completed'"
          class="btn btn-ghost"
          @click="$router.push(`/project/${project.id}/scripts`)"
        >
          查看剧本管理 →
        </button>
      </div>

      <!-- 流程面板 -->
      <div class="workflow-container">

        <!-- WF01：故事拆解 -->
        <WorkflowBlock
          title="WF01 · 故事拆解"
          :wf="wf('wf01')"
          :can-run="canRunWf01"
          :running="activeWf === 'wf01'"
          :progress="wfProgress.wf01"
          :node-label="wfNodeLabel.wf01"
          @run="runWf01"
          @stop="stopWf('wf01')"
        >
          <template #extra-actions>
            <button
              v-if="isAdvisorAvailable('wf01')"
              class="btn btn-ghost btn-sm"
              @click="openAdvisor('wf01')"
            >💬 顾问</button>
          </template>
          <template #result>
            <div v-if="wfOutput.wf01" class="md-output" v-html="renderOutput(wfOutput.wf01)"></div>
          </template>
        </WorkflowBlock>

        <!-- WF02：洗稿方案 -->
        <WorkflowBlock
          title="WF02 · 洗稿方案"
          :wf="wf('wf02')"
          :can-run="canRunWf02"
          :running="activeWf === 'wf02'"
          :progress="wfProgress.wf02"
          :node-label="wfNodeLabel.wf02"
          @run="runWf02"
          @stop="stopWf('wf02')"
        >
          <template #extra-actions>
            <button
              v-if="isAdvisorAvailable('wf02')"
              class="btn btn-ghost btn-sm"
              @click="openAdvisor('wf02')"
            >💬 顾问</button>
          </template>
          <template #result>
            <div v-if="wfOutput.wf02" class="md-output" v-html="renderOutput(wfOutput.wf02)"></div>

            <!-- 用户方向确认区 -->
            <div v-if="wf('wf02')?.status === 'done'" class="direction-panel">
              <div class="direction-header">
                <span class="direction-title">✏️ 选择 / 调整洗稿方向</span>
                <span v-if="wf('wf02')?.user_direction" class="badge badge-done">已确认</span>
              </div>
              <p class="direction-hint">从上方方案中选择一个方向，或在此直接输入您的调整意见，确认后才能运行 WF03</p>
              <textarea
                v-model="wf02Direction"
                class="textarea"
                rows="4"
                placeholder="例：选择方向B，将男主改为退役运动员，背景设在上海，去掉绑架情节…"
              ></textarea>
              <div style="display:flex;gap:8px;margin-top:10px;">
                <button
                  class="btn btn-primary"
                  :disabled="!wf02Direction.trim() || confirmingDirection"
                  @click="confirmWf02Direction"
                >
                  <span v-if="confirmingDirection" class="spinner"></span>
                  ✓ 确认此方向，启用 WF03
                </button>
                <span v-if="wf('wf02')?.user_direction" class="confirmed-hint">
                  当前已确认：{{ wf('wf02').user_direction.slice(0, 40) }}{{ wf('wf02').user_direction.length > 40 ? '…' : '' }}
                </span>
              </div>
            </div>
          </template>
        </WorkflowBlock>

        <!-- WF03：IP档案 -->
        <WorkflowBlock
          title="WF03 · 执行洗稿 / IP档案"
          :wf="wf('wf03')"
          :can-run="canRunWf03"
          :running="activeWf === 'wf03'"
          :progress="wfProgress.wf03"
          :node-label="wfNodeLabel.wf03"
          @run="runWf03"
          @stop="stopWf('wf03')"
        >
          <template #extra-actions>
            <button
              v-if="isAdvisorAvailable('wf03')"
              class="btn btn-ghost btn-sm"
              @click="openAdvisor('wf03')"
            >💬 顾问</button>
          </template>
          <template #result>
            <div v-if="archive">
              <div class="review-header">
                <span class="label">IP档案内容</span>
                <span class="badge" :class="archive.review_status === 'approved' ? 'badge-done' : archive.review_status === 'rejected' ? 'badge-failed' : 'badge-review'">
                  {{ archive.review_status === 'approved' ? '已通过' : archive.review_status === 'rejected' ? '已驳回' : '待审核' }}
                </span>
              </div>
              <div class="md-output" style="margin-bottom:12px;" v-html="renderOutput(archive.content)"></div>
              <div v-if="archive.review_status === 'pending'" class="review-actions">
                <div class="form-group">
                  <label class="label">审核备注（可选）</label>
                  <input v-model="archiveNote" class="input" placeholder="填写备注或修改意见…" />
                </div>
                <div style="display:flex;gap:8px;">
                  <button class="btn btn-success" :disabled="reviewing" @click="approveArchive">
                    <span v-if="reviewing === 'approve'" class="spinner"></span>
                    ✓ 通过，进入大纲
                  </button>
                  <button class="btn btn-danger" :disabled="reviewing" @click="rejectArchive">
                    <span v-if="reviewing === 'reject'" class="spinner"></span>
                    ✕ 驳回，重新生成
                  </button>
                </div>
              </div>
            </div>
            <div v-else-if="wfOutput.wf03" class="md-output" v-html="renderOutput(wfOutput.wf03)"></div>
          </template>
        </WorkflowBlock>

        <!-- WF04：分集大纲 (Chatflow) -->
        <WorkflowBlock
          title="WF04 · 分集大纲（对话调整）"
          :wf="wf('wf04')"
          :can-run="canRunWf04"
          :running="activeWf === 'wf04'"
          :progress="wfProgress.wf04"
          :node-label="wfNodeLabel.wf04"
          :hide-run-btn="true"
          @run="null"
        >
          <template #result>
            <!-- 聊天区域 -->
            <div class="chat-area" ref="chatRef">
              <div v-for="(msg, i) in chatMessages" :key="i" class="chat-msg" :class="`msg-${msg.role}`">
                <div class="msg-bubble">{{ msg.message }}</div>
              </div>
              <div v-if="activeWf === 'wf04'" class="chat-msg msg-assistant">
                <div class="msg-bubble typing">
                  <span class="dot-running dot"></span>
                  <span>{{ streamingChat || 'AI正在思考…' }}</span>
                </div>
              </div>
            </div>
            <div class="chat-input-row">
              <input
                v-model="chatInput"
                class="input"
                placeholder="输入指令调整大纲，例如：第3集增加一个误会场景…"
                @keydown.enter.prevent="sendChat"
                :disabled="activeWf === 'wf04' || !canRunWf04"
              />
              <button
                class="btn btn-primary"
                :disabled="!chatInput.trim() || activeWf === 'wf04' || !canRunWf04"
                @click="sendChat"
              >
                发送
              </button>
            </div>

            <!-- 大纲审核 -->
            <div v-if="outline && project.status === 'wf04_reviewing'" class="outline-review">
              <div class="divider"></div>
              <div class="review-header">
                <span class="label">当前大纲版本</span>
                <span class="badge badge-review">待审核</span>
              </div>
              <div class="md-output" style="margin-bottom:12px;" v-html="renderOutput(outline.content)"></div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                <input v-model="outlineNote" class="input" placeholder="审核备注（可选）" style="flex:1;min-width:160px;" />
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                  <label class="label" style="margin-bottom:0;white-space:nowrap;">共</label>
                  <input v-model.number="totalEpisodes" class="input" type="number" min="1" max="200" style="width:72px;" />
                  <label class="label" style="margin-bottom:0;white-space:nowrap;">集</label>
                </div>
                <button class="btn btn-success" :disabled="reviewing" @click="approveOutline">
                  <span v-if="reviewing === 'approve-outline'" class="spinner"></span>
                  ✓ 确认大纲，生成剧本
                </button>
                <button class="btn btn-danger" :disabled="reviewing" @click="rejectOutline">驳回继续调整</button>
              </div>
            </div>
          </template>
          <template #extra-actions>
            <button
              v-if="isAdvisorAvailable('wf04')"
              class="btn btn-ghost btn-sm"
              @click="openAdvisor('wf04')"
            >💬 顾问</button>
            <button
              v-if="canRunWf04"
              class="btn btn-primary"
              :disabled="activeWf === 'wf04'"
              @click="startOutlineChat"
            >
              {{ chatMessages.length ? '继续对话' : '开始大纲对话' }}
            </button>
            <button
              v-if="project.status === 'wf04_running' && outline?.content"
              class="btn btn-warning"
              @click="submitOutlineForReview"
            >
              提交审核
            </button>
          </template>
        </WorkflowBlock>

      </div>
    </template>
    </div><!-- /page-content -->

    <!-- 顾问抽屉 -->
    <Transition name="slide-drawer">
      <div v-if="advisorOpen" class="advisor-drawer">
        <!-- 抽屉头部 -->
        <div class="drawer-header">
          <div class="drawer-title">
            <span class="drawer-icon">💬</span>
            <span>{{ advisorTitle }} · 顾问</span>
          </div>
          <button class="btn btn-ghost btn-sm" @click="closeAdvisor">✕</button>
        </div>

        <!-- 对话历史 -->
        <div class="drawer-body" ref="drawerBodyRef">
          <div v-if="advisorLoading" class="drawer-loading">
            <span class="spinner"></span>
          </div>
          <div v-else-if="advisorMessages.length === 0" class="drawer-empty">
            <p>向顾问提问，获取针对本节点内容的专业建议</p>
          </div>
          <div v-else class="advisor-messages">
            <div
              v-for="(msg, i) in advisorMessages"
              :key="i"
              class="adv-msg"
              :class="`adv-msg-${msg.role}`"
            >
              <div class="adv-bubble" :class="msg.role === 'assistant' ? 'md-output' : ''"
                v-html="msg.role === 'assistant' ? renderOutput(msg.content) : msg.content"
              ></div>
            </div>
          </div>
          <!-- 流式回复占位 -->
          <div v-if="advisorStreaming" class="adv-msg adv-msg-assistant">
            <div class="adv-bubble md-output" v-html="renderOutput(advisorStreamText) || '<em>思考中…</em>'"></div>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="drawer-footer">
          <textarea
            v-model="advisorInput"
            class="textarea advisor-input"
            rows="3"
            placeholder="向顾问提问，例如：这份档案的人设是否存在矛盾？"
            @keydown.enter.prevent="sendAdvisorMessage"
            :disabled="advisorStreaming"
          ></textarea>
          <button
            class="btn btn-primary"
            :disabled="!advisorInput.trim() || advisorStreaming"
            @click="sendAdvisorMessage"
          >
            <span v-if="advisorStreaming" class="spinner"></span>
            发送
          </button>
        </div>
      </div>
    </Transition>
  </div><!-- /page-shell -->
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
import { useUserStore } from '~/stores/user'
import { useToastStore } from '~/stores/toast'
// renderOutput: 解析JSON外壳 + 处理\n + 简单HTML转义
const renderOutput = (raw) => {
  if (!raw) return ''
  let text = raw
  try {
    const p = JSON.parse(raw)
    text = p.answer ?? p.text ?? p.result ?? p.output ?? raw
  } catch {}
  text = text.replace(/\\n/g, '\n')
  // 基础 markdown → HTML（内联，避免外部依赖）
  return text
    .split('\n')
    .map(line => {
      if (/^### /.test(line)) return `<h3>${line.slice(4)}</h3>`
      if (/^## /.test(line)) return `<h2>${line.slice(3)}</h2>`
      if (/^# /.test(line)) return `<h1>${line.slice(2)}</h1>`
      if (/^---+$/.test(line.trim())) return '<hr/>'
      if (/^[\-\*] /.test(line)) return `<li>${line.slice(2)}</li>`
      if (/^\d+\. /.test(line)) return `<li>${line.replace(/^\d+\. /, '')}</li>`
      if (line.trim() === '') return '<br/>'
      return `<p>${line}</p>`
    })
    .join('')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}

const userStore = useUserStore()
const toast = useToastStore()
const route = useRoute()
const router = useRouter()
const apiBase = useRuntimeConfig().public.apiBase
const headers = useAuthHeaders()

const project = ref(null)
const wfResults = ref([])
const archive = ref(null)
const outline = ref(null)
const chatMessages = ref([])
const loading = ref(true)
const activeWf = ref(null)
const wfOutput = reactive({ wf01: '', wf02: '', wf03: '', wf04: '' })
const wfProgress = reactive({ wf01: 0, wf02: 0, wf03: 0, wf04: 0 })
const wfNodeLabel = reactive({ wf01: '', wf02: '', wf03: '', wf04: '' })
const streamingChat = ref('')
const chatInput = ref('')
const chatRef = ref(null)
const archiveNote = ref('')
const outlineNote = ref('')
const totalEpisodes = ref(60)
const reviewing = ref(false)
const wf02Direction = ref('')
const confirmingDirection = ref(false)

// ─── Fetch ───────────────────────────────────────────────────────────────────

const fetchAll = async () => {
  loading.value = true
  try {
    const [pRes, wfRes, archRes, olRes, chatRes] = await Promise.all([
      $fetch(`/api/project/${route.params.id}`, { baseURL: apiBase, headers: headers.value }),
      $fetch(`/api/project/${route.params.id}/workflows`, { baseURL: apiBase, headers: headers.value }),
      $fetch(`/api/project/${route.params.id}/archive`, { baseURL: apiBase, headers: headers.value }),
      $fetch(`/api/project/${route.params.id}/outline`, { baseURL: apiBase, headers: headers.value }),
      $fetch(`/api/project/${route.params.id}/chat-log?workflowNum=wf04`, { baseURL: apiBase, headers: headers.value }),
    ])
    if (pRes.code === 0) project.value = pRes.data
    if (wfRes.code === 0) wfResults.value = wfRes.data || []
    if (archRes.code === 0 && archRes.data) archive.value = archRes.data
    if (olRes.code === 0 && olRes.data) {
      outline.value = olRes.data
      if (olRes.data.total_episodes) totalEpisodes.value = olRes.data.total_episodes
    }
    if (chatRes.code === 0) chatMessages.value = chatRes.data || []

    // 填充已有输出 & 已保存方向
    for (const r of wfResults.value) {
      if (r.output_text) wfOutput[r.workflow_num] = r.output_text
      if (r.workflow_num === 'wf02' && r.user_direction) wf02Direction.value = r.user_direction
    }
  } catch (e) {
    toast.error('加载失败：' + e.message)
  } finally {
    loading.value = false
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const wf = (num) => wfResults.value.find(r => r.workflow_num === num) || null

const canRunWf01 = computed(() => {
  const s = project.value?.status
  return ['created', 'wf01_done', 'failed'].includes(s)
})
const canRunWf02 = computed(() => {
  const s = project.value?.status
  return ['wf01_done', 'wf02_done', 'failed'].includes(s)
})
const canRunWf03 = computed(() => {
  const s = project.value?.status
  return ['wf02_done', 'wf03_reviewing', 'failed'].includes(s) || (s === 'wf03_reviewing' && archive.value?.review_status === 'rejected')
})
const canRunWf04 = computed(() => {
  const s = project.value?.status
  return ['wf03_done', 'wf04_running', 'wf04_reviewing'].includes(s)
})

// ─── Workflow Runners ─────────────────────────────────────────────────────────

const runWorkflowStream = async (wfNum, body) => {
  activeWf.value = wfNum
  wfOutput[wfNum] = ''
  wfProgress[wfNum] = 0
  wfNodeLabel[wfNum] = ''

  // 节点计数用于估算进度
  let nodesDone = 0
  let nodesTotal = 0  // 动态估算，每次 node_started 时 +1

  try {
    const url = `${apiBase}/api/dify/workflow/run`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { ...headers.value, 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowNum: wfNum, projectId: project.value.id, ...body }),
    })
    if (!resp.ok) { toast.error('工作流启动失败'); return }
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
          // 节点进度
          if (data.event === 'node_started') {
            nodesTotal++
            wfNodeLabel[wfNum] = data.data?.title || data.data?.node_type || '处理中'
            wfProgress[wfNum] = Math.min(90, Math.round((nodesDone / Math.max(nodesTotal, 1)) * 90))
          }
          if (data.event === 'node_finished') {
            nodesDone++
            wfProgress[wfNum] = Math.min(90, Math.round((nodesDone / Math.max(nodesTotal, 1)) * 90))
          }
          // Chatflow 文本 (wf01-04)
          if (data.event === 'message' || data.event === 'agent_message') {
            wfOutput[wfNum] += (data.answer || '')
          }
          // message_end = 完成
          if (data.event === 'message_end') {
            wfProgress[wfNum] = 100
            wfNodeLabel[wfNum] = '完成'
          }
          // Workflow 文本 (wf05)
          if (data.event === 'text_chunk') wfOutput[wfNum] += (data.data?.text || '')
          if (data.event === 'workflow_finished') {
            const out = data.data?.outputs
            if (out) wfOutput[wfNum] = out.result || out.text || out.output || JSON.stringify(out)
            wfProgress[wfNum] = 100
            wfNodeLabel[wfNum] = '完成'
          }
        } catch { /* ignore */ }
      }
    }
    await fetchAll()
  } catch (e) {
    toast.error('流式请求失败：' + e.message)
  } finally {
    if (activeWf.value === wfNum) activeWf.value = null
    wfProgress[wfNum] = 0
    wfNodeLabel[wfNum] = ''
  }
}

const stopWf = async (wfNum) => {
  const r = wf(wfNum)
  if (!r?.dify_task_id) { activeWf.value = null; return }
  try {
    await $fetch('/api/dify/workflow/stop', {
      baseURL: apiBase, method: 'POST', headers: headers.value,
      body: { workflowNum: wfNum, taskId: r.dify_task_id },
    })
  } catch { /* ignore */ }
  activeWf.value = null
  await fetchAll()
}

const runWf01 = () => runWorkflowStream('wf01', {})
const runWf02 = () => runWorkflowStream('wf02', {})
const confirmWf02Direction = async () => {
  confirmingDirection.value = true
  try {
    const res = await $fetch(`/api/project/${project.value.id}/wf02-confirm`, {
      baseURL: apiBase, method: 'POST', headers: headers.value,
      body: { direction: wf02Direction.value },
    })
    if (res.code === 0) {
      toast.success('方向已确认，WF03 已解锁')
      await fetchAll()
    } else {
      toast.error(res.message || '确认失败')
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    confirmingDirection.value = false
  }
}

const runWf03 = () => runWorkflowStream('wf03', {})

// ─── WF04 Chat ────────────────────────────────────────────────────────────────

const startOutlineChat = () => {
  // Just enable sending — the chat input will handle initial message
  chatInput.value = chatInput.value || '请帮我生成分集大纲'
}

const sendChat = async () => {
  const q = chatInput.value.trim()
  if (!q || activeWf.value === 'wf04') return
  chatInput.value = ''
  chatMessages.value.push({ role: 'user', message: q })
  scrollChat()
  activeWf.value = 'wf04'
  streamingChat.value = ''
  wfProgress.wf04 = 0
  wfNodeLabel.wf04 = ''
  try {
    const convId = outline.value?.dify_conversation_id || ''
    const url = `${apiBase}/api/dify/chat/send`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { ...headers.value, 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.value.id, query: q, conversationId: convId }),
    })
    if (!resp.ok) { toast.error('发送失败'); return }
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let answer = ''
    let nodesDone = 0, nodesTotal = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (data.event === 'node_started') {
            nodesTotal++
            wfNodeLabel.wf04 = data.data?.title || data.data?.node_type || '处理中'
            wfProgress.wf04 = Math.min(90, Math.round((nodesDone / Math.max(nodesTotal, 1)) * 90))
          }
          if (data.event === 'node_finished') {
            nodesDone++
            wfProgress.wf04 = Math.min(90, Math.round((nodesDone / Math.max(nodesTotal, 1)) * 90))
          }
          if (data.event === 'agent_message' || data.event === 'message') {
            answer += (data.answer || '')
            streamingChat.value = answer
          }
          if (data.event === 'message_end') {
            wfProgress.wf04 = 100
            wfNodeLabel.wf04 = '完成'
          }
        } catch { /* ignore */ }
      }
    }
    if (answer) chatMessages.value.push({ role: 'assistant', message: answer })
    streamingChat.value = ''
    await fetchAll()
    scrollChat()
  } catch (e) {
    toast.error(e.message)
  } finally {
    if (activeWf.value === 'wf04') activeWf.value = null
    wfProgress.wf04 = 0
    wfNodeLabel.wf04 = ''
  }
}

const scrollChat = () => nextTick(() => {
  if (chatRef.value) chatRef.value.scrollTop = chatRef.value.scrollHeight
})

// ─── Reviews ─────────────────────────────────────────────────────────────────

const approveArchive = async () => {
  reviewing.value = 'approve'
  try {
    const res = await $fetch(`/api/project/${project.value.id}/approve-archive`, {
      baseURL: apiBase, method: 'POST', headers: headers.value,
      body: { action: 'approve', note: archiveNote.value },
    })
    if (res.code === 0) { toast.success('IP档案已通过'); await fetchAll() }
    else { toast.error(res.message || '操作失败') }
  } catch (e) { toast.error(e.message) }
  finally { reviewing.value = false }
}

const rejectArchive = async () => {
  reviewing.value = 'reject'
  try {
    const res = await $fetch(`/api/project/${project.value.id}/approve-archive`, {
      baseURL: apiBase, method: 'POST', headers: headers.value,
      body: { action: 'reject', note: archiveNote.value },
    })
    if (res.code === 0) { toast.success('已驳回，可重新生成'); await fetchAll() }
    else { toast.error(res.message || '操作失败') }
  } catch (e) { toast.error(e.message) }
  finally { reviewing.value = false }
}

const submitOutlineForReview = async () => {
  try {
    const res = await $fetch(`/api/project/${project.value.id}/approve-outline`, {
      baseURL: apiBase, method: 'POST', headers: headers.value,
      body: { action: 'submit' },
    })
    if (res.code === 0) { toast.success('已提交审核'); await fetchAll() }
    else toast.error(res.message)
  } catch (e) { toast.error(e.message) }
}

const approveOutline = async () => {
  reviewing.value = 'approve-outline'
  try {
    const res = await $fetch(`/api/project/${project.value.id}/approve-outline`, {
      baseURL: apiBase, method: 'POST', headers: headers.value,
      body: { action: 'approve', note: outlineNote.value, totalEpisodes: totalEpisodes.value },
    })
    if (res.code === 0) {
      toast.success('大纲已确认，请前往剧本管理生成剧本')
      await fetchAll()
      router.push(`/project/${project.value.id}/scripts`)
    } else { toast.error(res.message) }
  } catch (e) { toast.error(e.message) }
  finally { reviewing.value = false }
}

const rejectOutline = async () => {
  try {
    const res = await $fetch(`/api/project/${project.value.id}/approve-outline`, {
      baseURL: apiBase, method: 'POST', headers: headers.value,
      body: { action: 'reject', note: outlineNote.value },
    })
    if (res.code === 0) { toast.success('已驳回，可继续调整'); await fetchAll() }
    else toast.error(res.message)
  } catch (e) { toast.error(e.message) }
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const { statusLabel, statusBadgeClass } = useProjectStatus()
const { formatDate: _fmt } = useDateFormat()
const formatDate = (d) => _fmt(d, { year: 'numeric', month: 'short', day: 'numeric' })

// ─── Advisor Drawer ───────────────────────────────────────────────────────────

const WF_TITLES = {
  wf01: 'WF01 故事拆解',
  wf02: 'WF02 洗稿方案',
  wf03: 'WF03 IP档案',
  wf04: 'WF04 分集大纲',
}
const ADVISOR_STATUSES = ['done', 'reviewing', 'approved']

const advisorOpen       = ref(false)
const advisorWfNum      = ref(null)
const advisorTitle      = computed(() => WF_TITLES[advisorWfNum.value] || '')
const advisorMessages   = ref([])
const advisorLoading    = ref(false)
const advisorStreaming   = ref(false)
const advisorStreamText = ref('')
const advisorInput      = ref('')
const drawerBodyRef     = ref(null)

const isAdvisorAvailable = (wfNum) => {
  const r = wf(wfNum)
  return r && ADVISOR_STATUSES.includes(r.status)
}

const scrollDrawer = () => nextTick(() => {
  if (drawerBodyRef.value) drawerBodyRef.value.scrollTop = drawerBodyRef.value.scrollHeight
})

const openAdvisor = async (wfNum) => {
  advisorWfNum.value = wfNum
  advisorOpen.value = true
  advisorMessages.value = []
  advisorInput.value = ''
  advisorStreamText.value = ''

  const r = wf(wfNum)
  if (!r) return

  advisorLoading.value = true
  try {
    const res = await $fetch(`/api/advisor/${r.id}/history`, { baseURL: apiBase, headers: headers.value })
    if (res.code === 0) advisorMessages.value = res.data || []
  } catch (e) {
    toast.error('加载顾问历史失败：' + e.message)
  } finally {
    advisorLoading.value = false
    scrollDrawer()
  }
}

const closeAdvisor = () => {
  advisorOpen.value = false
  advisorWfNum.value = null
  advisorMessages.value = []
}

const sendAdvisorMessage = async () => {
  const q = advisorInput.value.trim()
  if (!q || advisorStreaming.value) return
  const r = wf(advisorWfNum.value)
  if (!r) return

  advisorInput.value = ''
  advisorMessages.value.push({ role: 'user', content: q })
  scrollDrawer()

  advisorStreaming.value = true
  advisorStreamText.value = ''

  try {
    const url = `${apiBase}/api/advisor/${r.id}/chat`
    const resp = await fetch(url, {
      method: 'POST',
      headers: { ...headers.value, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    })
    if (!resp.ok) { toast.error('顾问请求失败'); return }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let answer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const data = JSON.parse(line.slice(6))
          if (data.event === 'message') {
            answer += (data.answer || '')
            advisorStreamText.value = answer
            scrollDrawer()
          }
          if (data.event === 'message_end') {
            // 流结束
          }
          if (data.event === 'error') {
            toast.error('顾问出错：' + data.message)
          }
        } catch { /* ignore */ }
      }
    }

    if (answer) {
      advisorMessages.value.push({ role: 'assistant', content: answer })
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    advisorStreaming.value = false
    advisorStreamText.value = ''
    scrollDrawer()
  }
}

onMounted(fetchAll)
</script>

<style scoped>
/* ── 整体布局 ── */
.page-shell {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  width: 100%;
}
.page-content {
  flex: 1;
  min-width: 0;
  max-width: 900px;
}

/* ── 顾问抽屉 ── */
.advisor-drawer {
  width: 420px;
  flex-shrink: 0;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
  height: calc(100vh - var(--nav-height) - 56px);
  position: sticky;
  top: calc(var(--nav-height) + 28px);
  overflow: hidden;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}
.drawer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}
.drawer-icon { font-size: 16px; }

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.drawer-loading { display: flex; justify-content: center; padding: 40px; }
.drawer-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
  padding: 20px;
}

.advisor-messages { display: flex; flex-direction: column; gap: 12px; }

.adv-msg { display: flex; }
.adv-msg-user      { justify-content: flex-end; }
.adv-msg-assistant { justify-content: flex-start; }

.adv-bubble {
  max-width: 88%;
  padding: 10px 13px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  line-height: 1.65;
  word-break: break-word;
}
.adv-msg-user .adv-bubble {
  background: var(--color-primary-light);
  border: 1px solid rgba(139,92,246,0.3);
  color: var(--color-text);
  white-space: pre-wrap;
}
.adv-msg-assistant .adv-bubble {
  background: var(--color-bg);
  border: 1px solid var(--color-border-light);
  color: var(--color-text);
}

.drawer-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}
.advisor-input { resize: none; font-size: 13px; }

/* ── 抽屉动画 ── */
.slide-drawer-enter-active,
.slide-drawer-leave-active {
  transition: all 0.25s ease;
}
.slide-drawer-enter-from,
.slide-drawer-leave-to {
  opacity: 0;
  transform: translateX(24px);
}

.loading-wrap { display: flex; justify-content: center; padding: 80px; }

.page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  margin-bottom: 28px; gap: 16px;
}
.header-left { display: flex; align-items: flex-start; gap: 12px; }
.page-title { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
.header-meta { display: flex; align-items: center; gap: 10px; }
.meta-date { font-size: 12px; color: var(--color-text-muted); }

.workflow-container { display: flex; flex-direction: column; gap: 16px; }

/* Chat */
.chat-area {
  background: var(--color-bg); border: 1px solid var(--color-border);
  border-radius: var(--radius-sm); padding: 16px;
  max-height: 400px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 12px;
  margin-bottom: 12px;
}
.chat-msg { display: flex; }
.msg-user { justify-content: flex-end; }
.msg-assistant { justify-content: flex-start; }
.msg-bubble {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.msg-user .msg-bubble { background: var(--color-primary-light); border: 1px solid rgba(139,92,246,0.3); color: var(--color-text); }
.msg-assistant .msg-bubble { background: var(--color-bg-card); border: 1px solid var(--color-border-light); color: var(--color-text); }
.typing { display: flex; align-items: center; gap: 8px; }

.chat-input-row { display: flex; gap: 8px; }

.review-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.review-actions { display: flex; flex-direction: column; gap: 10px; }
.outline-review { margin-top: 20px; }

/* Markdown 渲染输出 */
.md-output {
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--color-text-secondary);
  word-break: break-word;
}
.md-output :deep(h1), .md-output :deep(h2), .md-output :deep(h3) {
  color: var(--color-text);
  font-weight: 600;
  margin: 14px 0 6px;
  line-height: 1.4;
}
.md-output :deep(h1) { font-size: 16px; }
.md-output :deep(h2) { font-size: 15px; border-bottom: 1px solid var(--color-border); padding-bottom: 4px; }
.md-output :deep(h3) { font-size: 14px; color: var(--color-primary); }
.md-output :deep(p) { margin: 6px 0; }
.md-output :deep(ul), .md-output :deep(ol) { padding-left: 20px; margin: 6px 0; }
.md-output :deep(li) { margin: 3px 0; }
.md-output :deep(strong) { color: var(--color-text); font-weight: 600; }
.md-output :deep(em) { color: var(--color-secondary); font-style: italic; }
.md-output :deep(code) {
  background: rgba(139,92,246,0.1);
  color: var(--color-primary);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
  font-family: monospace;
}
.md-output :deep(blockquote) {
  border-left: 3px solid var(--color-primary);
  padding-left: 12px;
  margin: 8px 0;
  color: var(--color-text-muted);
}
.md-output :deep(hr) { border-color: var(--color-border); margin: 12px 0; }

/* WF02 方向确认区 */
.direction-panel {
  margin-top: 16px;
  padding: 16px;
  background: rgba(139,92,246,0.05);
  border: 1px dashed rgba(139,92,246,0.3);
  border-radius: var(--radius);
}
.direction-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.direction-title { font-size: 13px; font-weight: 600; color: var(--color-text); }
.direction-hint { font-size: 12px; color: var(--color-text-muted); margin-bottom: 10px; }
.confirmed-hint { font-size: 12px; color: var(--color-text-muted); align-self: center; }
</style>

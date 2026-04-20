<template>
  <div class="page fade-in">
    <div class="page-header">
      <div>
        <h1 class="page-title">经验库</h1>
        <p class="page-sub">积累项目经验，提炼规律，沉淀为规则</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button
        v-for="tab in TABS"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.label }}
        <span v-if="tab.key === 'proposals' && pendingCount > 0" class="tab-badge">{{ pendingCount }}</span>
        <span v-if="tab.key === 'candidates' && candidateCount > 0" class="tab-badge tab-badge-gold">{{ candidateCount }}</span>
      </button>
    </div>

    <!-- ── Tab 1: 待审核提案 ─────────────────────────────────── -->
    <div v-if="activeTab === 'proposals'">
      <div v-if="loadingProposals" class="loading-wrap">
        <span class="spinner" style="width:24px;height:24px;border-width:3px;"></span>
      </div>
      <div v-else-if="proposals.length === 0" class="empty-state">
        <div class="icon">💡</div>
        <p>暂无待审核经验，完成更多项目节点后自动生成</p>
      </div>
      <div v-else class="item-list">
        <div v-for="p in proposals" :key="p.id" class="item-card">
          <div class="item-header">
            <span class="category-tag" :class="`cat-${categoryClass(p.category)}`">{{ p.category }}</span>
            <span class="item-meta">
              {{ p.project_title || '未知项目' }} · {{ wfLabel(p.workflow_num) }} · {{ formatDate(p.created_at) }}
            </span>
          </div>
          <p class="item-content">{{ p.content }}</p>
          <div class="item-actions">
            <button class="btn btn-success btn-sm" :disabled="processingId === p.id" @click="approveProposal(p)">
              <span v-if="processingId === p.id" class="spinner"></span>
              ✓ 通过
            </button>
            <button class="btn btn-danger btn-sm" :disabled="processingId === p.id" @click="rejectProposal(p)">
              ✕ 拒绝
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Tab 2: 经验池 ─────────────────────────────────────── -->
    <div v-if="activeTab === 'pool'">
      <div v-if="loadingPool" class="loading-wrap">
        <span class="spinner" style="width:24px;height:24px;border-width:3px;"></span>
      </div>
      <div v-else-if="poolEntries.length === 0" class="empty-state">
        <div class="icon">🏊</div>
        <p>经验池暂无内容，审核通过提案后自动进入</p>
      </div>
      <div v-else class="item-list">
        <div
          v-for="e in poolEntries"
          :key="e.id"
          class="item-card"
          :class="{
            'card-promoted': e.promoted_at,
            'card-candidate': e.validation_count >= 3 && !e.promoted_at
          }"
        >
          <div class="item-header">
            <span class="category-tag" :class="`cat-${categoryClass(e.category)}`">{{ e.category }}</span>
            <div class="item-header-right">
              <span class="validate-count">已验证 {{ e.validation_count }} 次</span>
              <span v-if="e.promoted_at" class="badge badge-done">已晋升</span>
              <span v-else-if="e.validation_count >= 3" class="badge badge-candidate">可晋升</span>
            </div>
          </div>
          <p class="item-content">{{ e.content }}</p>
        </div>
      </div>
    </div>

    <!-- ── Tab 3: 晋升候选 ─────────────────────────────────── -->
    <div v-if="activeTab === 'candidates'">
      <div v-if="loadingCandidates" class="loading-wrap">
        <span class="spinner" style="width:24px;height:24px;border-width:3px;"></span>
      </div>
      <div v-else-if="candidates.length === 0" class="empty-state">
        <div class="icon">🏆</div>
        <p>暂无可晋升候选，经验被验证 3 次以上后会出现在这里</p>
      </div>
      <div v-else class="item-list">
        <div v-for="e in candidates" :key="e.id" class="item-card card-candidate">
          <div class="item-header">
            <span class="category-tag" :class="`cat-${categoryClass(e.category)}`">{{ e.category }}</span>
            <div class="item-header-right">
              <span class="validate-count">已验证 {{ e.validation_count }} 次</span>
              <span class="rule-type-hint">→ {{ categoryToRuleType(e.category) === 'screenwriter' ? '编剧规范' : '监制标准' }}</span>
            </div>
          </div>
          <p class="item-content">{{ e.content }}</p>
          <div class="item-actions">
            <button class="btn btn-primary btn-sm" :disabled="processingId === e.id" @click="promote(e)">
              <span v-if="processingId === e.id" class="spinner"></span>
              晋升至规则库
            </button>
            <button class="btn btn-ghost btn-sm" :disabled="processingId === e.id" @click="rejectPromotion(e)">
              暂不晋升
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ middleware: 'auth' })
import { useToastStore } from '~/stores/toast'
import { useApi } from '~/composables/useApi'
import { useDateFormat } from '~/composables/useDateFormat'

const toast = useToastStore()
const { get, post } = useApi()
const { formatDate: _fmt } = useDateFormat()
const formatDate = (d) => _fmt(d, { year: 'numeric', month: 'short', day: 'numeric' })

const TABS = [
  { key: 'proposals', label: '待审核提案' },
  { key: 'pool',      label: '经验池' },
  { key: 'candidates', label: '晋升候选' },
]

const activeTab = ref('proposals')

// ── 数据 ─────────────────────────────────────────────────────
const proposals    = ref([])
const poolEntries  = ref([])
const candidates   = ref([])

const loadingProposals  = ref(false)
const loadingPool       = ref(false)
const loadingCandidates = ref(false)
const processingId      = ref(null)

const pendingCount    = computed(() => proposals.value.length)
const candidateCount  = computed(() => candidates.value.length)

// ── Fetch ─────────────────────────────────────────────────────
const fetchProposals = async () => {
  loadingProposals.value = true
  try {
    const res = await get('/api/experience/proposals')
    if (res.code === 0) proposals.value = res.data || []
  } catch (e) { toast.error('加载失败：' + e.message) }
  finally { loadingProposals.value = false }
}

const fetchPool = async () => {
  loadingPool.value = true
  try {
    const res = await get('/api/experience/pool')
    if (res.code === 0) poolEntries.value = res.data || []
  } catch (e) { toast.error('加载失败：' + e.message) }
  finally { loadingPool.value = false }
}

const fetchCandidates = async () => {
  loadingCandidates.value = true
  try {
    const res = await get('/api/experience/pool/promotion-candidates')
    if (res.code === 0) candidates.value = res.data || []
  } catch (e) { toast.error('加载失败：' + e.message) }
  finally { loadingCandidates.value = false }
}

watch(activeTab, (tab) => {
  if (tab === 'proposals') fetchProposals()
  else if (tab === 'pool') fetchPool()
  else if (tab === 'candidates') fetchCandidates()
}, { immediate: true })

// ── 操作 ─────────────────────────────────────────────────────
const approveProposal = async (p) => {
  processingId.value = p.id
  try {
    const res = await post(`/api/experience/proposals/${p.id}/approve`)
    if (res.code === 0) {
      proposals.value = proposals.value.filter(x => x.id !== p.id)
      toast.success('已通过，写入经验池')
    } else {
      toast.error(res.message || '操作失败')
    }
  } catch (e) { toast.error(e.message) }
  finally { processingId.value = null }
}

const rejectProposal = async (p) => {
  processingId.value = p.id
  try {
    const res = await post(`/api/experience/proposals/${p.id}/reject`)
    if (res.code === 0) {
      proposals.value = proposals.value.filter(x => x.id !== p.id)
      toast.success('已拒绝')
    } else {
      toast.error(res.message || '操作失败')
    }
  } catch (e) { toast.error(e.message) }
  finally { processingId.value = null }
}

const promote = async (e) => {
  processingId.value = e.id
  try {
    const res = await post(`/api/experience/pool/${e.id}/promote`)
    if (res.code === 0) {
      candidates.value = candidates.value.filter(x => x.id !== e.id)
      toast.success('已加入规则库')
    } else {
      toast.error(res.message || '操作失败')
    }
  } catch (err) { toast.error(err.message) }
  finally { processingId.value = null }
}

const rejectPromotion = async (e) => {
  processingId.value = e.id
  try {
    const res = await post(`/api/experience/pool/${e.id}/reject-promotion`)
    if (res.code === 0) {
      candidates.value = candidates.value.filter(x => x.id !== e.id)
      toast.success('已标记为暂不晋升')
    } else {
      toast.error(res.message || '操作失败')
    }
  } catch (err) { toast.error(err.message) }
  finally { processingId.value = null }
}

// ── 工具函数 ──────────────────────────────────────────────────
const WF_LABELS = {
  wf01: 'WF01 故事拆解', wf02: 'WF02 洗稿方案',
  wf03: 'WF03 IP档案', wf04: 'WF04 分集大纲', wf05: 'WF05 剧本',
}
const wfLabel = (num) => WF_LABELS[num] || num || '未知节点'

const categoryClass = (cat) => {
  const map = {
    '人设架构': 'char', '节奏规律': 'rhythm', '剧情结构': 'plot',
    '对白风格': 'dialogue', '改编策略': 'adapt', '世界观': 'world',
  }
  return map[cat] || 'default'
}

const categoryToRuleType = (category) =>
  ['人设架构', '对白风格'].includes(category) ? 'screenwriter' : 'director'
</script>

<style scoped>
.page { max-width: 860px; }

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0;
}
.tab-btn {
  position: relative;
  padding: 8px 18px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition);
  margin-bottom: -1px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.tab-btn:hover { color: var(--color-text); }
.tab-btn.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

.tab-badge {
  background: var(--color-danger);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}
.tab-badge-gold { background: #d97706; }

.loading-wrap { display: flex; justify-content: center; padding: 60px; }

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--color-text-muted);
}
.empty-state .icon { font-size: 36px; margin-bottom: 12px; }
.empty-state p { font-size: 14px; }

.item-list { display: flex; flex-direction: column; gap: 12px; }

.item-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 16px 18px;
  transition: border-color var(--transition);
}
.item-card:hover { border-color: var(--color-border-light); }
.card-candidate { border-color: rgba(217, 119, 6, 0.3); background: rgba(217, 119, 6, 0.03); }
.card-promoted  { border-color: rgba(34, 197, 94, 0.2); opacity: 0.7; }

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 8px;
}
.item-header-right { display: flex; align-items: center; gap: 8px; }

.item-meta {
  font-size: 12px;
  color: var(--color-text-muted);
}
.validate-count { font-size: 12px; color: var(--color-text-muted); }
.rule-type-hint { font-size: 12px; color: var(--color-primary); }

.item-content {
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-text-secondary);
  margin: 0 0 12px;
  word-break: break-word;
}

.item-actions { display: flex; gap: 8px; }

/* category tags */
.category-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}
.cat-char     { background: rgba(139,92,246,0.15); color: #7c3aed; }
.cat-rhythm   { background: rgba(59,130,246,0.15); color: #2563eb; }
.cat-plot     { background: rgba(16,185,129,0.15); color: #059669; }
.cat-dialogue { background: rgba(245,158,11,0.15); color: #d97706; }
.cat-adapt    { background: rgba(239,68,68,0.15);  color: #dc2626; }
.cat-world    { background: rgba(99,102,241,0.15); color: #4f46e5; }
.cat-default  { background: var(--color-bg); color: var(--color-text-muted); }

/* badge extras */
.badge-candidate {
  background: rgba(217,119,6,0.15);
  color: #d97706;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}
</style>

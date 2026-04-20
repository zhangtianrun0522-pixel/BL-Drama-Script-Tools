<template>
  <div class="page fade-in">
    <div class="page-header">
      <div>
        <h1 class="page-title">规则库</h1>
        <p class="page-sub">管理编剧规范和监制审核标准，影响所有剧本生成</p>
      </div>
      <button class="btn btn-primary" @click="openCreate">
        ＋ 新增规则
      </button>
    </div>

    <!-- 分类标签 -->
    <div class="type-tabs">
      <button
        v-for="t in TYPES"
        :key="t.value"
        class="type-tab"
        :class="{ active: activeType === t.value }"
        @click="activeType = t.value"
      >
        {{ t.label }}
        <span class="tab-count">{{ countByType(t.value) }}</span>
      </button>
    </div>

    <div v-if="loading" class="loading-wrap">
      <span class="spinner" style="width:24px;height:24px;border-width:3px;"></span>
    </div>

    <div v-else class="rules-list">
      <div v-if="filteredRules.length === 0" class="empty-state">
        <div class="icon">📋</div>
        <p>暂无规则</p>
      </div>

      <div v-for="r in filteredRules" :key="r.id" class="rule-card" :class="{ 'is-inactive': !r.is_active }">
        <div class="rule-header">
          <div class="rule-meta">
            <span class="rule-type-badge" :class="`type-${r.rule_type}`">
              {{ r.rule_type === 'screenwriter' ? '编剧规范' : '监制标准' }}
            </span>
            <span class="rule-name">{{ r.name }}</span>
            <span class="rule-version">v{{ r.version }}</span>
          </div>
          <div class="rule-actions">
            <button
              class="btn btn-sm"
              :class="r.is_active ? 'btn-warning' : 'btn-success'"
              @click="toggleRule(r)"
              :disabled="toggling === r.id"
            >
              <span v-if="toggling === r.id" class="spinner"></span>
              {{ r.is_active ? '停用' : '启用' }}
            </button>
            <button class="btn btn-ghost btn-sm" @click="openEdit(r)">编辑</button>
            <button class="btn btn-danger btn-sm" @click="confirmDelete(r)">删除</button>
          </div>
        </div>
        <div class="rule-content" :style="expanded[r.id] ? 'max-height:600px;padding-bottom:12px;' : 'max-height:0;'">
          <pre class="rule-text">{{ r.content }}</pre>
        </div>
        <button class="expand-btn" @click="expanded[r.id] = !expanded[r.id]">
          {{ expanded[r.id] ? '收起 ↑' : '展开查看 ↓' }}
        </button>
      </div>
    </div>

    <!-- 创建/编辑弹窗 -->
    <div v-if="showForm" class="modal-overlay" @click.self="showForm = false">
      <div class="modal" style="max-width:640px;">
        <div class="modal-header">
          <span class="modal-title">{{ editTarget ? '编辑规则' : '新增规则' }}</span>
          <button class="modal-close" @click="showForm = false">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="label">规则类型</label>
            <select v-model="form.rule_type" class="select">
              <option value="screenwriter">编剧规范</option>
              <option value="director">监制标准</option>
            </select>
          </div>
          <div class="form-group">
            <label class="label">规则名称 *</label>
            <input v-model="form.name" class="input" placeholder="如：对白格式规范" />
          </div>
          <div class="form-group">
            <label class="label">规则内容 *</label>
            <textarea
              v-model="form.content"
              class="textarea"
              rows="12"
              placeholder="详细描述规则内容，支持多行…"
              style="font-family:monospace;font-size:13px;"
            ></textarea>
          </div>
          <div class="form-group">
            <label class="label">排序权重</label>
            <input v-model.number="form.sort_order" class="input" type="number" placeholder="0" style="width:120px;" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" @click="showForm = false">取消</button>
          <button class="btn btn-primary" :disabled="!form.name || !form.content || submitting" @click="handleSubmit">
            <span v-if="submitting" class="spinner"></span>
            {{ editTarget ? '保存修改' : '创建规则' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 删除确认 -->
    <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
      <div class="modal" style="max-width:400px;">
        <div class="modal-header">
          <span class="modal-title">删除规则</span>
          <button class="modal-close" @click="deleteTarget = null">×</button>
        </div>
        <div class="modal-body">
          <p style="color:var(--color-text-secondary);">确定删除规则 <strong style="color:var(--color-text);">「{{ deleteTarget.name }}」</strong>？</p>
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
const apiBase = useRuntimeConfig().public.apiBase
const headers = useAuthHeaders()

const TYPES = [
  { value: 'all', label: '全部' },
  { value: 'screenwriter', label: '编剧规范' },
  { value: 'director', label: '监制标准' },
]

const rules = ref([])
const loading = ref(true)
const activeType = ref('all')
const expanded = reactive({})
const toggling = ref(null)
const showForm = ref(false)
const editTarget = ref(null)
const form = reactive({ rule_type: 'screenwriter', name: '', content: '', sort_order: 0 })
const submitting = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

const filteredRules = computed(() =>
  activeType.value === 'all' ? rules.value : rules.value.filter(r => r.rule_type === activeType.value)
)
const countByType = (t) => t === 'all' ? rules.value.length : rules.value.filter(r => r.rule_type === t).length

const fetchRules = async () => {
  loading.value = true
  try {
    const res = await $fetch('/api/rules', { baseURL: apiBase, headers: headers.value })
    if (res.code === 0) rules.value = res.data
  } catch (e) { toast.error(e.message) }
  finally { loading.value = false }
}

const toggleRule = async (r) => {
  toggling.value = r.id
  try {
    const res = await $fetch(`/api/rules/${r.id}/toggle`, {
      baseURL: apiBase, method: 'POST', headers: headers.value,
    })
    if (res.code === 0) {
      r.is_active = res.data.is_active
      toast.success(r.is_active ? '已启用' : '已停用')
    }
  } catch (e) { toast.error(e.message) }
  finally { toggling.value = null }
}

const openCreate = () => {
  editTarget.value = null
  form.rule_type = 'screenwriter'
  form.name = ''
  form.content = ''
  form.sort_order = 0
  showForm.value = true
}

const openEdit = (r) => {
  editTarget.value = r
  form.rule_type = r.rule_type
  form.name = r.name
  form.content = r.content
  form.sort_order = r.sort_order
  showForm.value = true
}

const handleSubmit = async () => {
  submitting.value = true
  try {
    let res
    if (editTarget.value) {
      res = await $fetch(`/api/rules/${editTarget.value.id}`, {
        baseURL: apiBase, method: 'PUT', headers: headers.value,
        body: { name: form.name, content: form.content, sort_order: form.sort_order },
      })
    } else {
      res = await $fetch('/api/rules/create', {
        baseURL: apiBase, method: 'POST', headers: headers.value,
        body: { rule_type: form.rule_type, name: form.name, content: form.content, sort_order: form.sort_order },
      })
    }
    if (res.code === 0) {
      toast.success(editTarget.value ? '已更新' : '规则已创建')
      showForm.value = false
      await fetchRules()
    } else { toast.error(res.message) }
  } catch (e) { toast.error(e.message) }
  finally { submitting.value = false }
}

const confirmDelete = (r) => { deleteTarget.value = r }
const handleDelete = async () => {
  deleting.value = true
  try {
    const res = await $fetch(`/api/rules/${deleteTarget.value.id}`, {
      baseURL: apiBase, method: 'DELETE', headers: headers.value,
    })
    if (res.code === 0) { toast.success('已删除'); deleteTarget.value = null; await fetchRules() }
    else toast.error(res.message)
  } catch (e) { toast.error(e.message) }
  finally { deleting.value = false }
}

onMounted(fetchRules)
</script>

<style scoped>
.page { max-width: 900px; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; }
.page-title { font-size: 24px; font-weight: 700; }
.page-sub { color: var(--color-text-muted); font-size: 14px; margin-top: 4px; }
.loading-wrap { display: flex; justify-content: center; padding: 80px; }

/* Type tabs */
.type-tabs { display: flex; gap: 6px; margin-bottom: 20px; }
.type-tab {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: var(--radius-sm);
  font-size: 14px; font-weight: 500;
  background: transparent; color: var(--color-text-secondary);
  border: 1px solid var(--color-border-light);
  cursor: pointer; transition: all var(--transition);
}
.type-tab:hover { background: var(--color-bg-hover); color: var(--color-text); }
.type-tab.active { background: var(--color-primary-light); color: var(--color-primary); border-color: rgba(139,92,246,0.4); }
.tab-count {
  background: var(--color-bg-overlay); color: var(--color-text-muted);
  padding: 1px 6px; border-radius: 100px; font-size: 11px;
}
.type-tab.active .tab-count { background: rgba(139,92,246,0.2); color: var(--color-primary); }

/* Rule cards */
.rules-list { display: flex; flex-direction: column; gap: 12px; }

.rule-card {
  background: var(--color-bg-card); border: 1px solid var(--color-border);
  border-radius: var(--radius); overflow: hidden; transition: border-color var(--transition);
}
.rule-card.is-inactive { opacity: 0.55; }
.rule-card:hover { border-color: var(--color-border-light); }

.rule-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; gap: 12px;
}
.rule-meta { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.rule-type-badge {
  padding: 2px 8px; border-radius: 100px; font-size: 11px; font-weight: 500;
  flex-shrink: 0;
}
.type-screenwriter { background: rgba(56,189,248,0.15); color: var(--color-info); }
.type-director { background: rgba(245,158,11,0.15); color: var(--color-warning); }

.rule-name { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rule-version { font-size: 11px; color: var(--color-text-muted); flex-shrink: 0; }
.rule-actions { display: flex; gap: 6px; flex-shrink: 0; }

.rule-content {
  padding: 0 20px;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
.rule-content.collapsed { max-height: 0; }
.rule-card:not(.is-inactive) .rule-content:not(.collapsed) { max-height: 600px; }

.rule-text {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 13px; line-height: 1.8;
  color: var(--color-text-secondary);
  white-space: pre-wrap; word-break: break-word;
  padding: 12px 0;
}

.expand-btn {
  display: block; width: 100%;
  padding: 8px; text-align: center;
  font-size: 12px; color: var(--color-text-muted);
  background: transparent; border: none; border-top: 1px solid var(--color-border);
  cursor: pointer; transition: all var(--transition);
}
.expand-btn:hover { background: var(--color-bg-hover); color: var(--color-primary); }
</style>

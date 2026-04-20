# 工作流 Prompt 存档

> 生成时间：2026-04-15  
> 说明：wf01~wf05 的 prompt 正文存储在 Dify 平台（按 API Key 区分，不在代码库中）。  
> 本文档记录：① 各工作流的输入变量结构 ② RulesLibrary 现有规则全文 ③ 流转逻辑

---

## 一、工作流概览

| 工作流 | 角色名 | Dify 模式 | API Key（末8位） | 触发方式 |
|--------|--------|-----------|-----------------|---------|
| wf01 | IP分析师 | Chatflow (/chat-messages) | ...w6FLBLO | 手动触发 |
| wf02 | 改编规划师 | Chatflow (/chat-messages) | ...cfXWv0 | 手动触发 |
| wf03 | IP档案执行 | Chatflow (/chat-messages) | ...m17Op | 手动触发 |
| wf04 | 分集大纲 | Chatflow (/chat-messages) | ...wudc | 多轮对话 |
| wf05 | 单集剧本 | Workflow (/workflows/run) | ...pXEs2 | 手动/批量触发 |

---

## 二、各工作流输入变量

### wf01 — IP 故事拆解
**query（固定）**：`"开始"`  
**inputs：**
```json
{
  "ip_doc": "<项目原始文本 IpProject.original_text>"
}
```
**输出**：story_breakdown（故事拆解结构）  
**存储**：WorkflowResult.output_text (workflow_num = 'wf01')

---

### wf02 — 改编洗稿方案
**query（固定）**：`"开始"`  
**inputs：**
```json
{
  "ip_doc": "<项目原始文本>",
  "story_breakdown": "<wf01 输出>"
}
```
**输出**：washing_plan（改编洗稿方案）  
**存储**：WorkflowResult.output_text (workflow_num = 'wf02')

---

### wf03 — IP 档案生成
**query（固定）**：`"开始"`  
**inputs：**
```json
{
  "ip_doc": "<项目原始文本>",
  "story_breakdown": "<wf01 输出>",
  "washing_plan": "<wf02 输出>",
  "user_direction": "<wf02 阶段用户填写的方向指示>"
}
```
**输出**：ip_archive（IP 档案全文）  
**存储**：WorkflowResult + IpArchive.content  
**特殊逻辑**：完成后自动写入 IpArchive，状态置为 `wf03_reviewing`

---

### wf04 — 分集大纲（多轮 Chatflow）
**query**：用户输入的对话消息  
**inputs：**
```json
{
  "ip_doc": "<IpArchive.content，若无则回退到 original_text>"
}
```
**输出**：分集大纲文本  
**存储**：EpisodeOutline.content + ProjectChatLog  
**特殊逻辑**：  
- 保持 conversation_id 实现多轮  
- 从输出中正则解析集数（`共N集 / 第N集`），写入 total_episodes  
- 审核状态初始为 `pending`

---

### wf05 — 单集剧本生成
**mode**：Workflow（非 Chatflow）  
**inputs：**
```json
{
  "ip_doc": "<IpArchive.content 或 original_text>",
  "episode_outline": "<当集大纲 EpisodeScript.episode_outline>",
  "episode_num": "<集号，字符串>",
  "screenwriter_rules": "<RulesLibrary 中所有 rule_type=screenwriter 且 is_active=true 的 content 拼接>",
  "director_rules": "<RulesLibrary 中所有 rule_type=director 且 is_active=true 的 content 拼接>",
  "extra_requirement": "<可选，项目附加需求>"
}
```
**输出**：单集剧本全文  
**存储**：EpisodeScript.content

---

## 三、RulesLibrary 现有规则全文

> 数据库：`data/bl-drama.sqlite` → 表 `rules_library`

### 规则 ID=1｜screenwriter｜剧本格式规范
```
场景标题格式：集次-场次号 时段 内/外 地点（如：1-1 夜 外 某某地点）
人物列表：在场景标题下方列出本场人物
舞台指示：以△开头，描述动作和环境
对白格式：角色名（动作说明）:台词内容
内心独白/画外音：角色名（OS）:内心描述
```

### 规则 ID=2｜director｜监制审核标准
```
1. 人物性格前后一致，符合IP设定
2. 情感节奏张弛有度，每集有钩子
3. 对白简洁有力，符合人物身份
4. 场景转换自然，避免跳跃突兀
5. BL情感线含蓄而有张力，不过度煽情
```

---

## 四、流转状态机（IpProject.status）

```
created
  → wf01_running → wf01_done
  → wf02_running → wf02_done
  → wf03_running → wf03_done → wf03_reviewing
  → wf04_running → wf04_done
  → scripts_generating → completed
```

---

## 五、关于 Dify prompt 正文

wf01~wf05 的 System Prompt / 工作流节点 prompt 存储在 Dify 平台，  
通过各工作流的 API Key 访问（见上表）。  
**要迁移这些 prompt，需要登录 Dify 控制台手动导出，或通过 Dify API 拉取工作流 DSL。**

Dify Base URL 来自环境变量 `DIFY_BASE_URL`（见 `.env.localhost`）。

---

## 六、Dify SSE 响应格式（现有 sse.js 解析逻辑参考）

详见 `src/utils/sse.js` 的 `pipeDifySSE` 函数。  
关键字段：
- `event: message` → `data.answer` 追加到 outputText
- `event: workflow_finished` → `data.data.outputs.text`
- `event: message_end` → 记录 taskId / conversationId
- `event: error` → 写入 error_msg

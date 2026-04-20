'use strict';

/**
 * src/services/llm.js
 * 全局 LLM 调度器
 *
 * 对外接口：
 *   llm.call(role, messages, options?)   → Promise<string>       非流式，返回完整文本
 *   llm.stream(role, messages, options?) → AsyncGenerator<chunk>  流式，每次 yield { text }
 *   llm.reloadConfig()                  → Promise<void>          运行时热更新配置
 *
 * messages 统一用 OpenAI 格式：
 *   [{ role: 'system'|'user'|'assistant', content: string }, ...]
 */

const { OpenAI }     = require('openai');
const Anthropic      = require('@anthropic-ai/sdk');

const TIMEOUT_MS = 120_000;

// ── 配置缓存 ──────────────────────────────────────────────────
let configCache = {}; // role → ModelConfig 行
let cacheLoaded = false;

async function loadConfig() {
  const { ModelConfig } = require('../models');
  const rows = await ModelConfig.findAll({ where: { is_active: true } });
  configCache = {};
  for (const row of rows) configCache[row.role] = row;
  cacheLoaded = true;
  console.log(`[LLM] 已加载 ${rows.length} 个角色配置: ${rows.map(r => r.role).join(', ')}`);
}

async function ensureConfig() {
  if (!cacheLoaded) await loadConfig();
}

async function reloadConfig() {
  cacheLoaded = false;
  await loadConfig();
  console.log('[LLM] 配置已热更新');
}

function getConfig(role) {
  const cfg = configCache[role];
  if (!cfg) throw new Error(`[LLM] 角色未配置或未激活: "${role}"，请检查 ModelConfig 表`);
  return cfg;
}

// ── 客户端工厂 ────────────────────────────────────────────────
function makeOpenAIClient(cfg) {
  const apiKey = process.env[cfg.api_key_env];
  if (!apiKey) throw new Error(`[LLM] 环境变量未设置: ${cfg.api_key_env}`);

  const options = { apiKey, timeout: TIMEOUT_MS };
  if (cfg.provider === 'deepseek') {
    options.baseURL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  }
  return new OpenAI(options);
}

function makeAnthropicClient(cfg) {
  const apiKey = process.env[cfg.api_key_env];
  if (!apiKey) throw new Error(`[LLM] 环境变量未设置: ${cfg.api_key_env}`);
  return new Anthropic({ apiKey, timeout: TIMEOUT_MS });
}

// ── Anthropic 消息格式适配 ────────────────────────────────────
// Anthropic 的 system 是独立参数，messages 不能包含 role=system
function splitSystemMessages(messages) {
  const systemParts = messages.filter(m => m.role === 'system').map(m => m.content);
  const chatMessages = messages.filter(m => m.role !== 'system');
  return {
    system: systemParts.join('\n\n') || undefined,
    messages: chatMessages,
  };
}

// ── 非流式调用 ────────────────────────────────────────────────
async function call(role, messages, options = {}) {
  await ensureConfig();
  const cfg = getConfig(role);

  const callOptions = {
    temperature: options.temperature ?? cfg.temperature,
    max_tokens:  options.max_tokens  ?? cfg.max_tokens,
  };

  try {
    if (cfg.provider === 'anthropic') {
      const client = makeAnthropicClient(cfg);
      const { system, messages: msgs } = splitSystemMessages(messages);
      const res = await client.messages.create({
        model:      cfg.model_name,
        messages:   msgs,
        system,
        max_tokens: callOptions.max_tokens,
        temperature: callOptions.temperature,
      });
      return res.content[0]?.text ?? '';

    } else {
      // deepseek / openai — OpenAI 兼容接口
      const client = makeOpenAIClient(cfg);
      const res = await client.chat.completions.create({
        model:       cfg.model_name,
        messages,
        temperature: callOptions.temperature,
        max_tokens:  callOptions.max_tokens,
      });
      return res.choices[0]?.message?.content ?? '';
    }
  } catch (err) {
    console.error(`[LLM] call(${role}) 失败:`, err.message);
    throw err;
  }
}

// ── 流式调用（AsyncGenerator）────────────────────────────────
// 每次 yield { text: string }
async function* stream(role, messages, options = {}) {
  await ensureConfig();
  const cfg = getConfig(role);

  const callOptions = {
    temperature: options.temperature ?? cfg.temperature,
    max_tokens:  options.max_tokens  ?? cfg.max_tokens,
  };

  try {
    if (cfg.provider === 'anthropic') {
      const client = makeAnthropicClient(cfg);
      const { system, messages: msgs } = splitSystemMessages(messages);

      const st = client.messages.stream({
        model:      cfg.model_name,
        messages:   msgs,
        system,
        max_tokens: callOptions.max_tokens,
        temperature: callOptions.temperature,
      });

      for await (const event of st) {
        if (
          event.type === 'content_block_delta' &&
          event.delta?.type === 'text_delta' &&
          event.delta.text
        ) {
          yield { text: event.delta.text };
        }
      }

    } else {
      // deepseek / openai
      const client = makeOpenAIClient(cfg);
      const st = await client.chat.completions.create({
        model:       cfg.model_name,
        messages,
        temperature: callOptions.temperature,
        max_tokens:  callOptions.max_tokens,
        stream:      true,
      });

      for await (const chunk of st) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) yield { text };
      }
    }
  } catch (err) {
    console.error(`[LLM] stream(${role}) 失败:`, err.message);
    throw err;
  }
}

module.exports = { call, stream, reloadConfig, loadConfig };

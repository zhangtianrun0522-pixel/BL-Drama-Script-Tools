'use strict';

/**
 * src/utils/sse.js
 * 通用 SSE 工具：将 llm.stream() 的 AsyncGenerator 管道到 Express res。
 *
 * 向客户端发送 Dify 兼容格式的事件，前端无需改动：
 *   data: {"event":"message","answer":"<chunk>"}\n\n
 *   data: {"event":"message_end"}\n\n
 *   data: {"event":"error","message":"<msg>"}\n\n
 *
 * onFinish(acc) 在流结束后调用，用于落库。
 * acc = { outputText: string, error: string|null }
 */
function setSseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

async function pipeSSE(res, generator, onFinish) {
  setSseHeaders(res);

  const acc = { outputText: '', error: null };

  try {
    for await (const chunk of generator) {
      acc.outputText += chunk.text;
      res.write(`data: ${JSON.stringify({ event: 'message', answer: chunk.text })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ event: 'message_end' })}\n\n`);
  } catch (err) {
    acc.error = err.message;
    res.write(`data: ${JSON.stringify({ event: 'error', message: err.message })}\n\n`);
  } finally {
    res.end();
    if (onFinish) await onFinish(acc).catch(console.error);
  }
}

module.exports = { pipeSSE, setSseHeaders };

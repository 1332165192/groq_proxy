import { Buffer } from "node:buffer";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return handleOPTIONS();
    }
    const errHandler = (err) => {
      console.error(err);
      return new Response(err.message, fixCors({ status: err.status ?? 500 }));
    };
    try {
      const auth = request.headers.get("Authorization");
      const apiKey = auth?.split(" ")[1];
      if (!apiKey) {
        throw new HttpError("Missing API key", 401);
      }

      const url = new URL(request.url);
      const { pathname } = url;

      // 处理静态文件
      if (pathname === "/" || pathname === "/index.html") {
        return new Response(await Deno.readFile("./src/static/index.html"), {
          headers: { "Content-Type": "text/html" },
        });
      }
      
      if (pathname === "/groq.js") {
        return new Response(await Deno.readFile("./src/static/groq.js"), {
          headers: { "Content-Type": "application/javascript" },
        });
      }

      // API 路由处理
      if (pathname.startsWith("/v1/")) {
        const apiPath = pathname.substring(3); // 移除 "/v1" 前缀
        
        // 简化路由逻辑，移除 assert 检查
        if (apiPath.endsWith("/chat/completions")) {
          if (request.method !== "POST") {
            throw new HttpError("Method not allowed", 405);
          }
          return handleCompletions(await request.json(), apiKey)
            .catch(errHandler);
        }
        
        if (apiPath.endsWith("/models")) {
          if (request.method !== "GET") {
            throw new HttpError("Method not allowed", 405);
          }
          return handleModels(apiKey)
            .catch(errHandler);
        }
      }

      throw new HttpError("404 Not Found", 404);
    } catch (err) {
      return errHandler(err);
    }
  }
};

class HttpError extends Error {
  constructor(message, status) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}

const fixCors = ({ headers, status, statusText }) => {
  headers = new Headers(headers);
  headers.set("Access-Control-Allow-Origin", "*");
  return { headers, status, statusText };
};

const handleOPTIONS = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    }
  });
};

const BASE_URL = "https://api.groq.com/openai/v1";

const makeHeaders = (apiKey) => ({
  "Authorization": `Bearer ${apiKey}`,
  "Content-Type": "application/json"
});

const SUPPORTED_MODELS = [
  "llama2-70b-4096",
  "mixtral-8x7b-32768",
  "gemma-7b-it"
];

const DEFAULT_MODEL = "llama2-70b-4096";

async function handleModels(apiKey) {
  const models = SUPPORTED_MODELS.map(id => ({
    id,
    object: "model",
    created: Date.now(),
    owned_by: "groq",
  }));

  return new Response(JSON.stringify({
    object: "list",
    data: models
  }), fixCors({
    status: 200,
    headers: { "Content-Type": "application/json" }
  }));
}

async function handleCompletions(req, apiKey) {
  const model = req.model || DEFAULT_MODEL;
  if (!SUPPORTED_MODELS.includes(model)) {
    throw new HttpError(`Model ${model} not supported`, 400);
  }

  // 验证必需的请求参数
  if (!Array.isArray(req.messages) || req.messages.length === 0) {
    throw new HttpError("messages array is required", 400);
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: makeHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: req.messages,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.max_tokens,
      stream: req.stream ?? false,
      stop: req.stop,
      top_p: req.top_p ?? 1,
      frequency_penalty: req.frequency_penalty ?? 0,
      presence_penalty: req.presence_penalty ?? 0,
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
    throw new HttpError(error.error?.message || "API request failed", response.status);
  }

  let body = response.body;
  if (response.ok) {
    if (req.stream) {
      // 处理流式响应
      return new Response(body, fixCors({
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
        status: 200
      }));
    } else {
      // 处理非流式响应
      const data = await response.json();
      body = JSON.stringify(data);
      return new Response(body, fixCors({
        headers: { "Content-Type": "application/json" },
        status: 200
      }));
    }
  }

  return new Response(body, fixCors(response));
} 
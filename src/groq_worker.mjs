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
      const url = new URL(request.url);
      const { pathname } = url;

      // 处理静态文件
      if (pathname === "/" || pathname === "/index.html") {
        try {
          const content = await Deno.readTextFile("./src/static/index.html");
          return new Response(content, {
            headers: { 
              "Content-Type": "text/html",
              "Access-Control-Allow-Origin": "*"
            }
          });
        } catch (error) {
          console.error("Error reading index.html:", error);
          throw new HttpError("Failed to load index.html", 500);
        }
      }
      
      if (pathname === "/groq.js") {
        try {
          const content = await Deno.readTextFile("./src/static/groq.js");
          return new Response(content, {
            headers: { 
              "Content-Type": "application/javascript",
              "Access-Control-Allow-Origin": "*"
            }
          });
        } catch (error) {
          console.error("Error reading groq.js:", error);
          throw new HttpError("Failed to load groq.js", 500);
        }
      }

      // API 路由处理
      if (pathname.startsWith("/v1/")) {
        const apiPath = pathname.substring(3); // 移除 "/v1" 前缀
        
        const auth = request.headers.get("Authorization");
        const apiKey = auth?.split(" ")[1];
        if (!apiKey) {
          throw new HttpError("Missing API key", 401);
        }

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

const BASE_URL = "https://api.groq.com/openai/v1";

const makeHeaders = (apiKey) => ({
  "Authorization": `Bearer ${apiKey}`,
  "Content-Type": "application/json"
});

const SUPPORTED_MODELS = [
  {
    id: "llama3-70b-8192",
    name: "LLaMA 3 70B",
    context_window: 8192,
    owned_by: "Meta"
  },
  {
    id: "mixtral-8x7b-32768",
    name: "Mixtral 8x7B",
    context_window: 32768,
    owned_by: "Mistral AI"
  },
  {
    id: "gemma-7b-it",
    name: "Gemma 7B",
    context_window: 8192,
    owned_by: "Google"
  },
  {
    id: "llama-3.1-70b-versatile",
    name: "LLaMA 3.1 70B Versatile",
    context_window: 32768,
    owned_by: "Meta"
  }
];

const DEFAULT_MODEL = "llama3-70b-8192";

async function handleModels(apiKey) {
  // 返回支持的模型列表
  const models = SUPPORTED_MODELS.map(model => ({
    id: model.id,
    object: "model",
    created: Date.now(),
    owned_by: model.owned_by,
    active: true,
    context_window: model.context_window,
    public_apps: null
  }));

  return new Response(JSON.stringify({
    object: "list",
    data: models
  }), fixCors({
    status: 200,
    headers: { 
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600"
    }
  }));
}

async function handleCompletions(req, apiKey) {
  const model = req.model || DEFAULT_MODEL;
  if (!SUPPORTED_MODELS.some(m => m.id === model)) {
    throw new HttpError(`Model ${model} not supported`, 400);
  }

  // 验证必需的请求参数
  if (!Array.isArray(req.messages) || req.messages.length === 0) {
    throw new HttpError("messages array is required", 400);
  }

  // 构建请求体，根据 Groq API 文档支持的参数
  const requestBody = {
    model,
    messages: req.messages,
    temperature: req.temperature ?? 0.7,
    max_tokens: req.max_tokens,
    stream: req.stream ?? false,
    stop: req.stop,
    top_p: req.top_p ?? 1,
    frequency_penalty: req.frequency_penalty ?? 0,
    presence_penalty: req.presence_penalty ?? 0,
    // 新增支持的参数
    max_completion_tokens: req.max_completion_tokens,
    top_k: req.top_k,
    seed: req.seed,
    response_format: req.response_format,
    tools: req.tools,
    tool_choice: req.tool_choice,
    user: req.user
  };

  // 移除未定义的参数
  Object.keys(requestBody).forEach(key => {
    if (requestBody[key] === undefined) {
      delete requestBody[key];
    }
  });

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: makeHeaders(apiKey),
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
    throw new HttpError(error.error?.message || "API request failed", response.status);
  }

  if (req.stream) {
    // 处理流式响应
    return new Response(response.body, fixCors({
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
    return new Response(JSON.stringify(data), fixCors({
      headers: { "Content-Type": "application/json" },
      status: 200
    }));
  }
}

// 添加 OPTIONS 请求处理
const handleOPTIONS = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400", // 24小时缓存预检请求结果
    }
  });
}; 
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
      
      console.log("pathname:", pathname, "request url:", request.url);

      // 处理静态文件
      if (pathname === "/" || pathname === "/login") {
        try {
          const content = await Deno.readTextFile("./src/static/login.html");
          return new Response(content, {
            headers: { 
              "Content-Type": "text/html",
              "Access-Control-Allow-Origin": "*"
            }
          });
        } catch (error) {
          console.error("Error reading login.html:", error);
          throw new HttpError("Failed to load login.html", 500);
        }
      }

      if (pathname === "/index.html") {
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

      if (pathname === "/audio") {
        try {
          const content = await Deno.readTextFile("./src/static/audio.html");
          return new Response(content, {
            headers: { 
              "Content-Type": "text/html",
              "Access-Control-Allow-Origin": "*"
            }
          });
        } catch (error) {
          console.error("Error reading audio.html:", error);
          throw new HttpError("Failed to load audio.html", 500);
        }
      }

      if (pathname === "/audio.js") {
        try {
          const content = await Deno.readTextFile("./src/static/audio.js");
          return new Response(content, {
            headers: { 
              "Content-Type": "application/javascript",
              "Access-Control-Allow-Origin": "*"
            }
          });
        } catch (error) {
          console.error("Error reading audio.js:", error);
          throw new HttpError("Failed to load audio.js", 500);
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

        // 添加音频转写路由
        if (apiPath.endsWith("/audio/transcriptions")) {
          if (request.method !== "POST") {
            throw new HttpError("Method not allowed", 405);
          }
          return handleAudioTranscription(request, apiKey).catch(errHandler);
        }

        // 添加音频翻译路由
        if (apiPath.endsWith("/audio/translations")) {
          if (request.method !== "POST") {
            throw new HttpError("Method not allowed", 405);
          }
          return handleAudioTranslation(request, apiKey).catch(errHandler);
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

// 移除 SUPPORTED_MODELS 常量，因为我们将直接从 API 获取
const DEFAULT_MODEL = "llama3-70b-8192";

async function handleModels(apiKey) {
  try {
    // 直接从 Groq API 获取模型列表
    const response = await fetch(`${BASE_URL}/models`, {
      method: "GET",
      headers: makeHeaders(apiKey)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
      throw new HttpError(error.error?.message || "Failed to fetch models", response.status);
    }

    // 直接返回 API 响应
    const data = await response.json();
    return new Response(JSON.stringify(data), fixCors({
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600"
      }
    }));
  } catch (error) {
    console.error("Error fetching models:", error);
    throw new HttpError(error.message || "Failed to fetch models", 500);
  }
}

async function handleCompletions(req, apiKey) {
  const model = req.model || DEFAULT_MODEL;
  
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

// 添加音频处理函数
async function handleAudioTranscription(request, apiKey) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("file");
    if (!audioFile) {
      throw new HttpError("Audio file is required", 400);
    }

    // 验证文件格式
    const validFormats = ['flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'];
    const fileType = audioFile.type.split('/')[1];
    if (!validFormats.includes(fileType)) {
      throw new HttpError(`Invalid file format. Supported formats: ${validFormats.join(', ')}`, 400);
    }

    // 构建请求参数
    const groqFormData = new FormData();
    groqFormData.append("file", audioFile);
    groqFormData.append("model", "whisper-large-v3"); // 目前只支持这个模型

    // 可选参数
    const optionalParams = {
      language: formData.get("language"),
      prompt: formData.get("prompt"),
      response_format: formData.get("response_format") || "json",
      temperature: formData.get("temperature"),
      timestamp_granularities: formData.getAll("timestamp_granularities")
    };

    // 添加可选参数
    Object.entries(optionalParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => groqFormData.append(key, v));
        } else {
          groqFormData.append(key, value);
        }
      }
    });

    // 发送请求到 Groq API
    const response = await fetch(`${BASE_URL}/audio/transcriptions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        // 不要设置 Content-Type，让浏览器自动设置正确的 boundary
      },
      body: groqFormData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
      throw new HttpError(error.error?.message || "Transcription failed", response.status);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), fixCors({
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    }));
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

async function handleAudioTranslation(request, apiKey) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("file");
    if (!audioFile) {
      throw new HttpError("Audio file is required", 400);
    }

    // 验证文件格式
    const validFormats = ['flac', 'mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'ogg', 'wav', 'webm'];
    const fileType = audioFile.type.split('/')[1];
    if (!validFormats.includes(fileType)) {
      throw new HttpError(`Invalid file format. Supported formats: ${validFormats.join(', ')}`, 400);
    }

    // 构建请求参数
    const groqFormData = new FormData();
    groqFormData.append("file", audioFile);
    groqFormData.append("model", "whisper-large-v3"); // 目前只支持这个模型

    // 可选参数
    const optionalParams = {
      prompt: formData.get("prompt"),
      response_format: formData.get("response_format") || "json",
      temperature: formData.get("temperature")
    };

    // 添加可选参数
    Object.entries(optionalParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        groqFormData.append(key, value);
      }
    });

    // 发送请求到 Groq API
    const response = await fetch(`${BASE_URL}/audio/translations`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        // 不要设置 Content-Type，让浏览器自动设置正确的 boundary
      },
      body: groqFormData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: "Unknown error" } }));
      throw new HttpError(error.error?.message || "Translation failed", response.status);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), fixCors({
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    }));
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
} 
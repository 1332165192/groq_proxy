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
      const assert = (success) => {
        if (!success) {
          throw new HttpError("The specified HTTP method is not allowed for the requested resource", 400);
        }
      };
      const { pathname } = new URL(request.url);
      switch (true) {
        case pathname.endsWith("/chat/completions"):
          assert(request.method === "POST");
          return handleCompletions(await request.json(), apiKey)
            .catch(errHandler);
        case pathname.endsWith("/models"):
          assert(request.method === "GET");
          return handleModels(apiKey)
            .catch(errHandler);
        default:
          throw new HttpError("404 Not Found", 404);
      }
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
      "Access-Control-Allow-Methods": "*",
      "Access-Control-Allow-Headers": "*",
    }
  });
};

const BASE_URL = "https://api.groq.com/openai/v1";

const makeHeaders = (apiKey) => ({
  "Authorization": `Bearer ${apiKey}`,
  "Content-Type": "application/json"
});

// 支持的模型列表
const SUPPORTED_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.3-8b-versatile",
  "mixtral-8x7b-32768",
  "gemma-7b-it"
];

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

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

async function handleCompletions(req, apiKey) {
  const model = req.model || DEFAULT_MODEL;
  if (!SUPPORTED_MODELS.includes(model)) {
    throw new HttpError(`Model ${model} not supported`, 400);
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: makeHeaders(apiKey),
    body: JSON.stringify({
      model,
      messages: req.messages,
      temperature: req.temperature,
      max_tokens: req.max_tokens,
      stream: req.stream,
      stop: req.stop,
      top_p: req.top_p,
      frequency_penalty: req.frequency_penalty,
      presence_penalty: req.presence_penalty,
    })
  });

  let body = response.body;
  if (response.ok) {
    if (req.stream) {
      // 直接转发流式响应
      body = response.body;
    } else {
      // 非流式响应
      const data = await response.json();
      body = JSON.stringify(data);
    }
  }

  return new Response(body, fixCors(response));
} 
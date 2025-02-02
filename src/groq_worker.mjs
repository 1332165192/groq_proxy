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

      if (pathname === "/constant.js") {
        try {
          const content = await Deno.readTextFile("./src/static/constant.js");
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

      if (pathname.startsWith("/openai/v1/")) {
        return handleGroqRequest(request);
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

//处理groq所有请求
async function handleGroqRequest(request) {
  const url = new URL(request.url);
  const { pathname } = url;
  console.log("pathname:", pathname, "request url:",url.toString());

  url.host = "api.groq.com";
  console.log("url.toString():", url.toString());

  const newRequest = new Request(url.toString(), {
    headers: request.headers,
    method: request.method,
    body: request.body,
    redirect: "follow",
  });
  return await fetch(newRequest);
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

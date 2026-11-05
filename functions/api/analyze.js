// Redeploy Cloudflare Pages
const SYSTEM = `你是期貨技術分析助理。分析使用者提供的交易圖表截圖，支援 WTI 原油、黃金、NASDAQ 期貨。
請使用繁體中文，客觀評估趨勢、EMA、RSI、MACD、VWAP、支撐壓力、可能的確認與失效條件。
只能根據截圖中實際可見的資訊分析，不得捏造價格、指標數值或即時行情。
不提供保證獲利的訊號，不替使用者自動下單。
必須回傳有效 JSON，包含：
symbol、timeframe、direction、image_quality、primary_scenario、alternative_scenario、confirmation、invalidation、levels、limitations，以上均為字串；
observations 為字串陣列。
direction 只能是：偏多、偏空、觀望、資料不足。`;

function reply(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export function onRequestGet() {
  return reply({ error: "請使用 POST 上傳圖片" }, 405);
}

export async function onRequestPost({ request, env }) {
  if (!env.OPENAI_API_KEY) {
    return reply({
      error: "後端尚未讀取到 OPENAI_API_KEY，請檢查 Cloudflare Pages 的環境變數"
    }, 503);
  }

  let timeout;
  try {
    const form = await request.formData();

    const file = form.get("image") || form.get("file");
    const symbol = String(form.get("symbol") || "WTI");
    const timeframe = String(form.get("timeframe") || "未指定");

    if (!file || typeof file.arrayBuffer !== "function") {
      return reply({ error: "請先上傳交易圖表截圖" }, 400);
    }

    const allowed = ["image/png", "image/jpeg", "image/webp"];
    if (!allowed.includes(file.type)) {
      return reply({ error: "圖片格式僅支援 JPG、PNG、WebP" }, 400);
    }

    if (file.size > 5 * 1024 * 1024) {
      return reply({ error: "圖片不可超過 5MB" }, 413);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }

    const encoded = btoa(binary);

    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 30000);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-4.1-mini",
        temperature: 0.2,
        max_tokens: 1100,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `使用者選擇商品 ${symbol}、週期 ${timeframe}。請分析附圖。若缺乏關鍵數值，明確說明無法判斷，不要虛構。`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${file.type};base64,${encoded}`,
                  detail: "high"
                }
              }
            ]
          }
        ]
      })
    });

    if (!res.ok) {
      const errors = {
        401: "OpenAI API 金鑰無效",
        429: "OpenAI API 額度不足或請求過多"
      };
      return reply({
        error: errors[res.status] || `AI 服務暫時失敗（HTTP ${res.status}）`
      }, 502);
    }

    const raw = await res.json();
    let analysis;

    try {
      analysis = JSON.parse(raw.choices[0].message.content);
    } catch {
      return reply({ error: "AI 回傳格式無法解析，請重試" }, 502);
    }

    const keys = [
      "symbol", "timeframe", "direction", "image_quality",
      "primary_scenario", "alternative_scenario",
      "confirmation", "invalidation", "levels", "limitations"
    ];

    if (
      !keys.every(k => typeof analysis[k] === "string") ||
      !Array.isArray(analysis.observations) ||
      !analysis.observations.every(x => typeof x === "string") ||
      !["偏多", "偏空", "觀望", "資料不足"].includes(analysis.direction)
    ) {
      return reply({ error: "AI 分析格式不完整，請重試" }, 502);
    }

    return reply({
      analysis,
      analyzed_at: new Date().toISOString()
    });

  } catch (e) {
    return reply({
      error: e.name === "AbortError"
        ? "AI 分析逾時，請重試"
        : "網路或 AI 服務連線失敗"
    }, 502);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 8080);
const ROOT = __dirname;
const TOKEN = process.env.ZR_TOKEN || "";
const KEY = process.env.ZR_KEY || "";
const ORIGIN_WILAYA = Number(process.env.ZR_ORIGIN_WILAYA || 31);
const RATE_API_URL = process.env.ZR_RATE_API_URL || "";
const MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".png":"image/png", ".jpg":"image/jpeg", ".svg":"image/svg+xml" };

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "X-Content-Type-Options":"nosniff", "Referrer-Policy":"strict-origin-when-cross-origin", "Cache-Control":"no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => { raw += chunk; if (raw.length > 20000) { reject(new Error("Request too large")); req.destroy(); } });
    req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch { reject(new Error("Invalid JSON")); } });
    req.on("error", reject);
  });
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/api/health") {
    return send(res, 200, { status:"ok", service:"hind_luxury_veil", rateApiConfigured:Boolean(RATE_API_URL && TOKEN && KEY), note:"Configuration status only; it does not verify courier credentials." });
  }
  if (req.method === "POST" && url.pathname === "/api/rates") {
    try {
      const body = await readJson(req);
      const wilayaCode = Number(body.wilayaCode);
      const deliveryType = body.deliveryType;
      if (!Number.isInteger(wilayaCode) || wilayaCode < 1 || wilayaCode > 69 || !["home","stopdesk"].includes(deliveryType)) {
        return send(res, 400, { message:"ولاية أو طريقة توصيل غير صالحة." });
      }
      if (!RATE_API_URL || !TOKEN || !KEY) {
        return send(res, 503, { message:"لم تُهيأ واجهة التسعير الرسمية بعد. يجب ضبط عنوان API وبيانات حساب التاجر على الخادم." });
      }
      const upstream = await fetch(RATE_API_URL, {
        method:"POST",
        headers:{ "Content-Type":"application/json", "Accept":"application/json", "Authorization":`Bearer ${TOKEN}`, "X-API-Key":KEY },
        body:JSON.stringify({ fromWilaya:ORIGIN_WILAYA, toWilaya:wilayaCode, deliveryType })
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return send(res, 502, { message:"رفض مزود الشحن طلب التسعير. راجع التوثيق وبيانات الحساب." });
      const fee = Number(data.deliveryFee ?? data.price ?? data.total);
      if (!Number.isFinite(fee) || fee < 0) return send(res, 502, { message:"استجابة مزود الشحن لا تحتوي على قيمة سعر مفهومة. يلزم ضبط محوّل API وفق التوثيق الرسمي." });
      return send(res, 200, { deliveryFee:fee, currency:data.currency || "DZD", source:"configured courier API" });
    } catch {
      return send(res, 502, { message:"تعذر الاتصال بمزود التسعير." });
    }
  }
  if (url.pathname.startsWith("/api/")) return send(res, 404, { message:"API endpoint not found" });
  let requested;
  try { requested = decodeURIComponent(url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "")); }
  catch { return send(res, 400, "Bad request", "text/plain; charset=utf-8"); }
  const full = path.resolve(ROOT, requested);
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) return send(res, 403, "Forbidden", "text/plain; charset=utf-8");
  fs.readFile(full, (err, content) => {
    if (err) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    send(res, 200, content, MIME[path.extname(full).toLowerCase()] || "application/octet-stream");
  });
});
server.listen(PORT, "0.0.0.0", () => console.log(`hind_luxury_veil listening on ${PORT}`));

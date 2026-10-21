const http = require("http");
const fs = require("fs");
const path = require("path");
const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.ZR_TOKEN || "";
const KEY = process.env.ZR_KEY || "";
const ORIGIN_WILAYA = Number(process.env.ZR_ORIGIN_WILAYA || 16);
const API_BASE = "https://freeship.dzbuild.com";
const ROOT = __dirname;
const MIME = { ".html":"text/html; charset=utf-8", ".png":"image/png", ".css":"text/css", ".js":"text/javascript", ".txt":"text/plain; charset=utf-8" };
function send(res, status, data, type="application/json; charset=utf-8") { res.writeHead(status,{"Content-Type":type,"Access-Control-Allow-Origin":"*","Cache-Control":"no-store"}); res.end(typeof data === "string" ? data : JSON.stringify(data)); }
function readBody(req) { return new Promise((resolve,reject)=>{let body="";req.on("data",chunk=>{body+=chunk;if(body.length>1e6){reject(new Error("Body too large"));req.destroy();}});req.on("end",()=>{try{resolve(JSON.parse(body||"{}"));}catch(e){reject(e);}});req.on("error",reject);}); }
const server = http.createServer(async (req,res)=>{
 if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type"});return res.end();}
 const url = new URL(req.url,"http://localhost");
 if(req.method==="POST" && url.pathname==="/api/rates"){
  try{
   if(!TOKEN||!KEY)return send(res,503,{message:"أضيفي بيانات API الخاصة بـ ZR Express في متغيرات البيئة على الخادم."});
   const body=await readBody(req);const wilayaCode=Number(body.wilayaCode);const deliveryType=body.deliveryType;
   if(!Number.isInteger(wilayaCode)||wilayaCode<1||wilayaCode>58||!["home","stopdesk"].includes(deliveryType))return send(res,400,{message:"ولاية أو طريقة توصيل غير صالحة."});
   const upstream=await fetch(API_BASE+"/v1/rates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({courier:"zrexpress",credentials:{token:TOKEN,key:KEY},query:{fromWilaya:ORIGIN_WILAYA,toWilaya:wilayaCode,deliveryType:deliveryType==="home"?"home":"stopdesk"}})});
   const data=await upstream.json().catch(()=>({}));
   if(!upstream.ok)return send(res,upstream.status,{message:data?.error?.message||data?.message||"تعذر الحصول على سعر ZR Express."});
   return send(res,200,{deliveryFee:Number(data.deliveryFee??data.total),currency:data.currency||"DZD",source:"ZR Express API"});
  }catch(e){return send(res,502,{message:"تعذر الاتصال بخدمة أسعار ZR Express."});}
 }
 if(req.method==="GET" && url.pathname.startsWith("/api/"))return send(res,404,{message:"API endpoint not found"});
 let file=url.pathname==="/"?"index.html":decodeURIComponent(url.pathname).replace(/^\/+/,"");
 const full=path.resolve(ROOT,file);const relative=path.relative(ROOT,full);if(relative.startsWith(".."+path.sep)||relative===".."||path.isAbsolute(relative))return send(res,403,{message:"Forbidden"});
 fs.readFile(full,(err,buf)=>{if(err)return send(res,404,"Not found","text/plain; charset=utf-8");res.writeHead(200,{"Content-Type":MIME[path.extname(full)]||"application/octet-stream"});res.end(buf);});
});
server.listen(PORT,()=>console.log(`hind_luxury_veil running on port ${PORT}`));

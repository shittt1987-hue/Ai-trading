const SYSTEM = `你是期貨技術圖表截圖分析助手。請使用繁體中文。只能根據圖片中可見資料推論，不可聲稱即時行情、不可捏造價格或指標數值。使用者指定商品與週期可能與截圖不一致，必須指出衝突。不要給保證性預測或勝率。圖像模糊時方向必須為「資料不足」。分析未來3-5根K線的條件式情境，並提出相反情境。只回傳有效JSON，鍵名固定：symbol,timeframe,direction,image_quality,observations,primary_scenario,alternative_scenario,confirmation,invalidation,levels,limitations。其中 observations 為字串陣列，其餘均為字串；direction 只能是 偏多、偏空、觀望、資料不足。`;
const reply=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function onRequestPost({request,env}){
 if(!env.OPENAI_API_KEY)return reply({error:'尚未設定 OPENAI_API_KEY，請到 Cloudflare Pages 設定 Secret。'},503);
 const len=Number(request.headers.get('content-length')||0);if(len>9*1024*1024)return reply({error:'上傳資料過大'},413);
 let form;try{form=await request.formData()}catch{return reply({error:'無法讀取上傳資料'},400)}
 const file=form.get('image'),symbol=form.get('symbol'),timeframe=form.get('timeframe');
 if(!file||typeof file==='string'||!['image/png','image/jpeg','image/webp'].includes(file.type))return reply({error:'請上傳 PNG、JPG 或 WebP 圖片'},400);
 if(file.size>8*1024*1024)return reply({error:'圖片超過 8 MB'},413);
 if(!['WTI','GOLD','NQ'].includes(symbol)||!['1M','5M','15M','1H'].includes(timeframe))return reply({error:'商品或週期不合法'},400);
 const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const encoded=btoa(binary);
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),45000);
 try{
  const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal:controller.signal,headers:{'authorization':`Bearer ${env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1-mini',temperature:0.2,max_tokens:1100,response_format:{type:'json_object'},messages:[{role:'system',content:SYSTEM},{role:'user',content:[{type:'text',text:`使用者選擇商品 ${symbol}、週期 ${timeframe}。請分析附圖。若截圖缺乏關鍵數值，明確說明無法判斷，不要虛構。`},{type:'image_url',image_url:{url:`data:${file.type};base64,${encoded}`,detail:'high'}}]}]})});
  if(!res.ok){return reply({error:res.status===429?'AI 服務額度不足或請求過多':res.status===401?'AI 金鑰無效':'AI 服務暫時失敗（HTTP '+res.status+'）'},502)}
  const raw=await res.json();let a;try{a=JSON.parse(raw.choices[0].message.content)}catch{return reply({error:'AI 回傳格式無法解析，請重試'},502)}
  const keys=['symbol','timeframe','direction','image_quality','primary_scenario','alternative_scenario','confirmation','invalidation','levels','limitations'];
  if(!keys.every(k=>typeof a[k]==='string')||!Array.isArray(a.observations)||!a.observations.every(x=>typeof x==='string')||!['偏多','偏空','觀望','資料不足'].includes(a.direction))return reply({error:'AI 分析格式不完整，請重試'},502);
  return reply({analysis:a,analyzed_at:new Date().toISOString()});
 }catch(e){return reply({error:e.name==='AbortError'?'AI 分析逾時，請重試':'網路或 AI 服務連線失敗'},502)}finally{clearTimeout(timeout)}
}
export function onRequestGet(){return reply({error:'請使用 POST 上傳圖片'},405)}

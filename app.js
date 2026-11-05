const $=id=>document.getElementById(id);const num=id=>{const s=$(id).value.trim();return s===''?NaN:Number(s)};
$('screenshot').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const img=$('preview');img.src=URL.createObjectURL(file);img.hidden=false});
$('symbol').addEventListener('change',()=>{$('tickvalue').value='';$('riskresult').textContent='請依選定合約重新輸入每 tick 價值。'});
$('analyze').addEventListener('click',()=>{const p=num('price'),r=num('rsi'),a=num('ema5'),b=num('ema10'),c=num('ema20'),v=num('vwap');if(![p,r,a,b,c].every(Number.isFinite)||p<=0||r<0||r>100){$('result').textContent='資料不足：請輸入有效的現價、RSI (0–100)、EMA 5/10/20。';return}let up=0,down=0,why=[];if(a>b&&b>c){up+=2;why.push('EMA 5 > 10 > 20：多頭排列')}else if(a<b&&b<c){down+=2;why.push('EMA 5 < 10 < 20：空頭排列')}else why.push('EMA 排列混合：趨勢不明');if(p>c){up++;why.push('現價高於 EMA20')}else if(p<c){down++;why.push('現價低於 EMA20')};if(r>=55&&r<=70){up++;why.push('RSI 55–70：偏多動能')}else if(r>=30&&r<=45){down++;why.push('RSI 30–45：偏空動能')}else if(r>70||r<30)why.push('RSI 位於極端區域：留意反轉與延續兩種可能');if(Number.isFinite(v)){if(p>v){up++;why.push('現價高於 VWAP')}else if(p<v){down++;why.push('現價低於 VWAP')}}const direction=up>=down+2?'偏多':down>=up+2?'偏空':'觀望';$('result').textContent=`${$('symbol').value} · ${$('timeframe').value}\n方向：${direction}（規則式情境，非勝率）\n多頭條件分數：${up}；空頭條件分數：${down}\n\n依據：\n• ${why.join('\n• ')}\n\n未來 3–5 根 K 線：僅能提出條件情境，無法可靠預知走勢。${direction==='偏多'?'若持續站穩 EMA20，偏多情境較完整；跌回 EMA20 下方需重新評估。':direction==='偏空'?'若持續受 EMA20 壓制，偏空情境較完整；突破 EMA20 需重新評估。':'等待 EMA、價格與動能形成一致方向。'}\n\n缺少 K 線高低點與波動率，不提供臆測的進出場價格。截圖尚未經 AI 解析。`});
$('calculate').addEventListener('click',()=>{const cap=num('capital'),pct=num('risk'),tv=num('tickvalue'),ticks=num('stopticks');if(![cap,pct,tv,ticks].every(Number.isFinite)||cap<=0||pct<=0||pct>100||tv<=0||ticks<=0){$('riskresult').textContent='請輸入有效的資金、風險百分比、合約 tick 價值及停損 ticks。';return}const budget=cap*pct/100,per=tv*ticks,contracts=Math.floor(budget/per);$('riskresult').textContent=`\n風險預算：$${budget.toFixed(2)} USD\n每口停損風險：$${per.toFixed(2)} USD\n最多整數口數：${contracts} 口\n預估總停損：$${(contracts*per).toFixed(2)} USD（未計手續費、滑價與跳空）${contracts===0?'\n目前風險預算不足以承擔 1 口，請勿強行進場。':''}`});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});

// 真正的視覺分析只經由同網域 Pages Function 呼叫；前端不保存 API 金鑰。
$('vision').addEventListener('click', async () => {
 const file=$('screenshot').files[0], status=$('visionstatus'), output=$('visionresult');
 if(!file){status.textContent='請先選擇行情截圖。';return;}
 if(!file.type.startsWith('image/')){status.textContent='請選擇圖片。';return;}
 if(file.size>8*1024*1024){status.textContent='圖片不得超過 8 MB，請裁切或壓縮。';return;}
 $('vision').disabled=true;status.textContent='正在辨識圖片，請稍候…';output.textContent='';
 try{
  const body=new FormData();body.append('image',file);body.append('symbol',$('symbol').value);body.append('timeframe',$('timeframe').value);
  const response=await fetch('/api/analyze',{method:'POST',body});
  const data=await response.json().catch(()=>({error:'伺服器回應格式錯誤'}));
  if(!response.ok)throw new Error(data.error||'分析失敗');
  const a=data.analysis;
  output.textContent=`商品：${a.symbol}｜週期：${a.timeframe}
方向：${a.direction}
圖像品質：${a.image_quality}

辨識內容：
${a.observations.map(x=>'• '+x).join('\n')}

主要情境：${a.primary_scenario}
相反情境：${a.alternative_scenario}
確認條件：${a.confirmation}
失效條件：${a.invalidation}
可能區間：${a.levels}
限制：${a.limitations}

分析時間：${data.analyzed_at}
注意：僅根據上傳截圖，不代表即時報價或保證預測。`;
  status.textContent='AI 圖像分析完成。';
 }catch(err){status.textContent='無法完成：'+err.message;}finally{$('vision').disabled=false;}
});

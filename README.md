# WTI Trading AI V3 Vision — iPhone PWA + Cloudflare Pages Function

## 功能
- 真正將截圖上傳至伺服器，再呼叫 OpenAI 視覺模型分析；支援 WTI / GOLD / NQ、1M / 5M / 15M / 1H。
- 保留原有手動 EMA / RSI / VWAP 規則分析與風險計算器；不含模擬交易或真實下單。
- 無 API 金鑰時清楚提示錯誤，不會生成假 AI 結果。

## iPhone 部署（建議 GitHub + Cloudflare Pages）
1. 使用 Safari 登入 GitHub，建立新的私人或公開 repository，將本 ZIP **解壓後的內容**放在 repository 根目錄，包含 `functions/api/analyze.js`（保留資料夾階層）。
2. 登入 Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → 選擇 repository。
3. Framework preset 選 None，Build command 留空，Build output directory 設為 `/`（若介面不接受，使用 `.`）；部署。**注意：不要用 Cloudflare Pages 的直接拖曳上傳方式來部署 Functions；應使用 Git 整合或 Wrangler。**
4. Pages 專案 → Settings → Variables and Secrets（不同介面版本可能在 Settings → Environment variables）新增加密 Secret：`OPENAI_API_KEY`，值為自己的 OpenAI API 金鑰；設定 Production，並重新部署。選用 `OPENAI_MODEL` 可覆寫預設 `gpt-4.1-mini`，需確保模型支援圖片與 JSON 回應。
5. 開啟 `https://你的專案.pages.dev` → 上傳圖片 → 點「使用 AI 分析截圖」。
6. Safari 分享 → 加入主畫面。

## 重要安全與費用
- OpenAI API 使用量依 API 帳戶計費，ChatGPT Plus 訂閱不包含 API 額度。
- 此版本為個人測試 MVP，**尚未提供使用者登入、流量限制或防濫用機制**。部署後若網站公開，任何人可能呼叫你的 API 並產生費用。建議先以 Cloudflare Access 限制訪客、在 OpenAI 平台設定用量預算/警示，正式公開前加上驗證與速率限制。
- 請勿將 API 金鑰放進 GitHub、HTML 或 JavaScript 前端。
- AI 只讀取截圖，不含即時行情，不保證預測正確。截圖會傳送到 OpenAI API，避免上傳帳號、餘額等敏感資訊。
- 本包尚未在你的 Cloudflare 帳號實際部署或用付費 API 進行端到端測試。

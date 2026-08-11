# ⚙️ Setup & Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Replit Setup (Easiest)](#replit-setup-easiest)
3. [Local Development](#local-development)
4. [Vercel Deployment](#vercel-deployment)
5. [Advanced: Docker](#advanced-docker)
6. [API Configuration](#api-configuration)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements
- **Node.js** 16+ (or 18 LTS recommended)
- **npm** 8+
- **Git** (for cloning)
- **Modern browser** (Chrome 90+, Firefox 88+, Safari 14+)

### Required Services
- **Unusual Whales API** account (paid subscription)
  - Sign up: https://unusualwhales.com
  - Plan: Flow Alerts ($99/month or higher)
  - Generate Bearer token in account settings

### Optional Services
- **Google Sheets** (for logging/tracking)
- **Vercel** account (for production hosting)
- **Docker** (for containerized deployment)

---

## Replit Setup (Easiest)

### Step 1: Fork the Project
1. Go to [squeeze-scanner.replit.app](https://squeeze-scanner.replit.app)
2. Click **"Fork"** (top-right)
3. Replit creates a copy in your account

### Step 2: Add Secrets (API Key)
1. Click the **🔒 Secrets** lock icon (left sidebar)
2. **Add Secret:**
   - Key: `VITE_UW_API_KEY`
   - Value: `Bearer YOUR_API_KEY_HERE`
   - Click "Add Secret"

3. (Optional) Add more secrets:
   ```
   VITE_SCAN_INTERVAL=1800000     # 30 min in milliseconds
   VITE_SHEETS_ID=google_sheet_id # For logging
   ```

### Step 3: Run
1. Click **"Run"** (green play button, top-center)
2. Wait for "Listening on..." message
3. Click the **"Open in new tab"** button
4. Your scanner is live! 🎉

### Step 4: Set Up Automatic Scans (Optional)
Replit can auto-run your scanner on a schedule:

1. Go to **Replit Deployments** → Create deployment
2. Choose **"Always On"** for 24/7 scanning
3. Add to your `.replit` config:
   ```
   run = "node index.js"  # or your entry point
   ```

---

## Local Development

### Step 1: Clone Repository
```bash
git clone https://github.com/blazn03-cell/squeeze-scanner.git
cd squeeze-scanner
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Create Environment File
Create `.env.local` in the project root:

```bash
echo "VITE_UW_API_KEY=Bearer YOUR_API_KEY_HERE" > .env.local
```

Or manually create `.env.local`:
```
VITE_UW_API_KEY=Bearer YOUR_API_KEY_HERE
VITE_SCAN_INTERVAL=1800000
VITE_SHEETS_ID=your_sheet_id_optional
```

### Step 4: Run Development Server
```bash
npm run dev
```

Output:
```
  VITE v4.0.0  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

Open http://localhost:5173 in your browser.

### Step 5: Build for Production (Optional)
```bash
npm run build
```

This creates an optimized `dist/` folder for deployment.

---

## Vercel Deployment

### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### Step 2: Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Authorize Vercel to access your repos

### Step 3: Import Project
1. Click **"Add New"** → **"Project"**
2. Select `squeeze-scanner` repo
3. Click **"Import"**

### Step 4: Set Environment Variables
1. Go to **Settings** → **Environment Variables**
2. Add:
   - `VITE_UW_API_KEY` = `Bearer YOUR_API_KEY_HERE`
   - `VITE_SCAN_INTERVAL` = `1800000`
3. Click **"Add"**

### Step 5: Deploy
1. Click **"Deploy"**
2. Wait for build to complete (~2 min)
3. Get your live URL: `https://squeeze-scanner-xxxxx.vercel.app`

### Step 6: Enable Auto-Deploy
- Vercel auto-deploys on every `git push` to `main`
- To disable: **Settings** → **Git** → disable auto-deploy

### Update Vercel with New Changes
```bash
git add .
git commit -m "Feature: add new signal type"
git push origin main
# Vercel deploys automatically
```

---

## Advanced: Docker

### Step 1: Create Dockerfile
Already included in repo. If not, create one:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy code
COPY . .

# Build (if needed)
RUN npm run build 2>/dev/null || true

# Expose port
EXPOSE 3000

# Start
CMD ["npm", "run", "preview"]
```

### Step 2: Build Image
```bash
docker build -t squeeze-scanner:latest .
```

### Step 3: Run Container Locally
```bash
docker run \
  -p 3000:3000 \
  -e VITE_UW_API_KEY="Bearer YOUR_API_KEY" \
  -e VITE_SCAN_INTERVAL=1800000 \
  squeeze-scanner:latest
```

Open http://localhost:3000

### Step 4: Push to Docker Hub (Optional)
```bash
docker login
docker tag squeeze-scanner:latest yourname/squeeze-scanner:latest
docker push yourname/squeeze-scanner:latest
```

### Step 5: Deploy to Cloud (AWS, GCP, etc.)
Example: **AWS ECS**
```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin YOUR_ECR_REPO

docker tag squeeze-scanner:latest YOUR_ECR_REPO/squeeze-scanner:latest
docker push YOUR_ECR_REPO/squeeze-scanner:latest
```

---

## API Configuration

### Unusual Whales API Setup

#### Get Your API Key
1. Log in to [unusualwhales.com](https://unusualwhales.com)
2. Go to **Account Settings** → **API**
3. Click **"Generate Token"**
4. Copy the full Bearer token (starts with `ey...`)

#### Test Your Key
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.unusualwhales.com/api/option-trades/flow-alerts?limit=5
```

You should get JSON results (not 401 Unauthorized).

#### Rate Limits
- **Flow Alerts:** 100 requests/min
- **Dark Pool:** 50 requests/min
- **Market Tide:** 30 requests/min

The scanner respects these limits automatically.

### Endpoints Used

| Endpoint | Purpose | Rate | Used By |
|----------|---------|------|---------|
| `/option-trades/flow-alerts` | Sweep patterns | 100/min | Main scan |
| `/darkpool/recent` | Recent DP activity | 50/min | Initial filter |
| `/market/market-tide` | Macro bias | 30/min | Every scan |
| `/darkpool/{ticker}` | DP history (7d) | 50/min | Top 6 tickers |
| `/stock/{ticker}/greek-exposure` | Gamma bias | 50/min | Top 6 tickers |
| `/stock/{ticker}/ohlc/5m` | OHLC bars | 100/min | Ichimoku calc |

---

## Troubleshooting

### ❌ "API Key Invalid" (401 Unauthorized)

**Cause:** Invalid or expired API key

**Fix:**
```bash
# 1. Verify key format
# Should be: Bearer eyJhbGc...

# 2. Test in isolation
curl -H "Authorization: Bearer YOUR_KEY" \
  https://api.unusualwhales.com/api/market/market-tide

# 3. Check subscription
# Log into unusualwhales.com → ensure Flow Alerts plan is active

# 4. Generate new token
# Account Settings → API → "Generate New Token"
```

### ❌ "CORS Error" in Browser Console

**Cause:** Browser blocking cross-origin request

**Fix:**
- This is expected for browser-based API calls
- Scanner uses Replit/Vercel backend as proxy (if deployed)
- For local dev, enable CORS in config or use proxy

### ❌ "No Tickers Showing" (Blank Results)

**Cause:** 
- Scanner ran outside market hours
- No flow data available yet
- API rate limit hit

**Fix:**
```bash
# 1. Check time (should be 9:30 AM–3:30 PM ET)
# 2. Check console for errors (F12 → Console)
# 3. Wait 5+ min for first scan
# 4. Try manually triggering scan (check for button in UI)
# 5. Check API quota: https://unusualwhales.com/account/api
```

### ❌ "Ichimoku Shows PENDING"

**Cause:** OHLC data not fetched (ticker not in top-12 by premium)

**Fix:**
- Ichimoku only loads for top-12 premium tickers
- Lower volume tickers won't get technical bias
- Verdict will use macro as fallback
- Wait for next scan (30 min) for new tickers

### ❌ "Position Tracker Not Saving"

**Cause:** localStorage disabled or full

**Fix:**
```javascript
// In browser console:
localStorage.clear()  // Clear old data
localStorage.setItem('test', '1')  // Verify it works
```

### ❌ "Replit Crashing / Infinite Loop"

**Cause:** Scan running too frequently

**Fix:**
1. Stop the Replit process (Ctrl+C)
2. Edit `.replit` or `config.js`
3. Increase `VITE_SCAN_INTERVAL` (default 30 min):
   ```
   VITE_SCAN_INTERVAL=1800000  # 30 min in ms
   ```
4. Restart with "Run"

### ❌ "Google Sheets Integration Not Working"

**Cause:** Sheet ID incorrect or sheet not shared

**Fix:**
```bash
# 1. Get correct Sheet ID from URL
# https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit
# Copy the SHEET_ID part only

# 2. Share sheet (link-only access minimum)
# Click "Share" → change to "Anyone with link"

# 3. Test URL in browser
https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit

# 4. Add to config.js:
VITE_SHEETS_ID=YOUR_SHEET_ID
```

---

## Performance Tips

### Optimize Replit
- Use "Always On" deployment (keeps scanner running 24/7)
- Monitor resource usage (Replit has resource limits)
- Upgrade to Replit Core if hitting limits

### Optimize Vercel
- No action needed (auto-optimized)
- Deploy less frequently to avoid hitting edge function limits
- Monitor function execution time in dashboard

### Optimize Local Dev
- Use `npm run dev` (faster rebuilds than `build`)
- Clear `node_modules` and `dist` if corrupted:
  ```bash
  rm -rf node_modules dist
  npm install
  npm run dev
  ```

### Reduce API Calls
- Increase `VITE_SCAN_INTERVAL` to reduce scan frequency
- Limit Ichimoku to top-6 tickers (configured)
- Turn off optional enrichment (Congress, FDA, etc.) if not needed

---

## Monitoring & Logging

### View Replit Logs
1. Click **"Console"** tab (bottom)
2. Scroll through execution logs
3. Look for errors (red text)

### View Vercel Logs
1. Go to Vercel dashboard
2. Select deployment
3. Click **"Logs"** tab
4. Filter by error level if needed

### Local Logs
```bash
# Run with verbose logging
DEBUG=* npm run dev

# Or pipe to file
npm run dev > logs.txt 2>&1
```

---

## Next Steps

✅ Complete setup?

1. **[Read the README](README.md)** — Understand signal types & trading framework
2. **[Run the 13-point checklist](README.md#the-13-point-checklist-before-every-entry)** — Before your first entry
3. **[Paper trade for 1 week](README.md#trading-tips)** — Build intuition before risking real capital
4. **[Join a trading community](README.md#support)** — Share ideas, get feedback

---

## Need Help?

- **Replit Issues?** Check Replit console for errors
- **API Issues?** Visit [unusualwhales.com/api](https://unusualwhales.com/api)
- **Deployment Issues?** Check [Vercel docs](https://vercel.com/docs)
- **Trading Questions?** Open an [issue](https://github.com/blazn03-cell/squeeze-scanner/issues)


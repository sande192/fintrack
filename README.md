# 💰 FinTrack – Indian Personal Finance App

A complete personal finance tracker built for India with 33 features including expense tracking, friend debt management, EMI tracker, bill reminders, SMS import, analytics, dark mode, PIN lock, and more.

---

## 🚀 One-Time GitHub Pages Setup

### Step 1 — Create repo & push code
```bash
# Unzip the downloaded file, then:
cd fintrack
git init
git add .
git commit -m "Initial commit"

# Create a NEW repo on github.com named exactly: fintrack
# Then:
git remote add origin https://github.com/YOUR_USERNAME/fintrack.git
git branch -M main
git push -u origin main
```

### Step 2 — Enable GitHub Pages
1. Go to your repo on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under **Source**, select **GitHub Actions**
4. Click **Save**

### Step 3 — Done! 🎉
GitHub Actions will build and deploy automatically.  
Your app will be live at:
```
https://YOUR_USERNAME.github.io/fintrack/
```

> ⚠️ If your repo is named differently than `fintrack`, edit `vite.config.js` and change `base: '/fintrack/'` to match your repo name.

---

## 🛠 Local Development

```bash
npm install
npm run dev
```

Open http://localhost:5173/fintrack/

---

## ✅ Features (All 33 Implemented)

- 💸 Expense & income tracking with auto-categorization
- 📊 Budget limits per category with progress bars
- 🤝 Friend debt tracking with settle history
- ✂️ Split bill across multiple friends
- 💬 WhatsApp nudge + UPI payment request
- 📋 Recurring bills with due date alerts
- 💳 EMI / loan tracker with progress
- 🪔 Special event budgets (Diwali, trips, etc.)
- 📩 SMS / bank statement parser & importer
- 📈 Analytics: pie chart, 6-month bar chart, payment modes
- 🏆 Financial health score (A/B/C/D grade)
- 🔐 4-digit PIN lock
- 🌙 Dark mode
- 📤 CSV export
- 💰 GST tracking per transaction
- 🔍 Search & filter by category, month, payment mode
- ✏️ Edit any transaction
- 💰 Indian Rupee (₹) formatting

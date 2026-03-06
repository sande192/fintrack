import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════
const CATS = {
  food:          { icon:"🍜", color:"#FF6B35", label:"Food & Dining" },
  mobile:        { icon:"📱", color:"#4F8EF7", label:"Mobile" },
  electricity:   { icon:"⚡", color:"#F5A623", label:"Electricity" },
  rent:          { icon:"🏠", color:"#7B5EFB", label:"Rent" },
  creditcard:    { icon:"💳", color:"#F04E73", label:"Credit Card" },
  transport:     { icon:"🚗", color:"#1CB5E0", label:"Transport" },
  shopping:      { icon:"🛍️", color:"#00C48C", label:"Shopping" },
  health:        { icon:"💊", color:"#E91E63", label:"Health" },
  entertainment: { icon:"🎬", color:"#9C27B0", label:"Entertainment" },
  other:         { icon:"📦", color:"#8E8EA9", label:"Other" },
};

const KEYWORDS = {
  food:          ["swiggy","zomato","restaurant","cafe","dhaba","biryani","pizza","burger","kfc","mcdonalds","dominos"],
  mobile:        ["jio","airtel","vi","bsnl","recharge","prepaid","postpaid"],
  electricity:   ["bescom","msedcl","tneb","electricity","power bill","electric"],
  rent:          ["rent","house rent","pg","flat rent","room rent","landlord"],
  creditcard:    ["hdfc card","icici card","sbi card","credit card","card bill"],
  transport:     ["uber","ola","rapido","auto","metro","petrol","diesel","fuel","irctc","redbus"],
  shopping:      ["amazon","flipkart","myntra","meesho","ajio","zepto","blinkit","bigbasket","dmart"],
  health:        ["apollo","medplus","pharmacy","hospital","doctor","clinic","medicine"],
  entertainment: ["netflix","hotstar","prime","spotify","youtube premium","movie","pvr","inox"],
};

const PAYMENT_MODES = ["UPI","Cash","Credit Card","Debit Card","Net Banking","Cheque","Wallet"];
const INCOME_TYPES  = ["Salary","Freelance","Rental","Dividend","Bonus","Other"];

const uid     = () => Math.random().toString(36).slice(2,10);
const fmt     = (n) => "₹"+Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtC    = (n) => n>=1e7?`₹${(n/1e7).toFixed(1)}Cr`:n>=1e5?`₹${(n/1e5).toFixed(1)}L`:n>=1e3?`₹${(n/1e3).toFixed(1)}K`:fmt(n);
const dateStr = (d) => new Date(d).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"});
const mkStr   = (d) => new Date(d).toLocaleDateString("en-IN",{month:"short",year:"numeric"});

const todayDate = new Date();
const todayD    = todayDate.getDate();
const thisMonth = mkStr(todayDate);

const autoCategory = (title) => {
  const t = (title||"").toLowerCase();
  for (const [cat,words] of Object.entries(KEYWORDS)) {
    if (words.some(w=>t.includes(w))) return cat;
  }
  return "other";
};

const parseSMS = (raw) => {
  const results = [];
  const amtRe   = /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i;
  const debitW  = ["debited","spent","paid","payment","deducted","purchase","withdrawn","charged"];
  const creditW = ["credited","received","refund","cashback","salary"];
  raw.split("\n").forEach(line => {
    const l = line.trim(); if (!l) return;
    const amtM = amtRe.exec(l); if (!amtM) return;
    const amount = parseFloat(amtM[1].replace(/,/g,""));
    if (!amount || amount<1) return;
    const lc = l.toLowerCase();
    const isDebit  = debitW.some(w=>lc.includes(w));
    const isCredit = creditW.some(w=>lc.includes(w));
    if (!isDebit && !isCredit) return;
    let title = "Transaction";
    const atM = l.match(/(?:\bat\b|\bto\b|\bfor\b)\s+([A-Z][A-Za-z0-9 &'.@-]{2,25}?)(?:\s+on|\s+via|\s+ref|\.|,|$)/);
    if (atM) title = atM[1].trim();
    results.push({ id:uid(), title, amount, type:isCredit?"income":"expense",
      category:autoCategory(title), paymentMode:"UPI",
      date:new Date().toISOString(), gst:0, note:"Imported from SMS" });
  });
  return results;
};

const calcHealth = (expenses, friends, bills, budgets, monthlyIncome) => {
  let s = 0;
  const inc = monthlyIncome || expenses.filter(e=>e.type==="income"&&mkStr(e.date)===thisMonth).reduce((a,e)=>a+e.amount,0);
  const exp = expenses.filter(e=>e.type==="expense"&&mkStr(e.date)===thisMonth).reduce((a,e)=>a+e.amount,0);
  if (inc>0) { const r=(inc-exp)/inc; s+=r>=0.3?30:r>=0.2?22:r>=0.1?14:r>=0?6:0; } else s+=12;
  const bE=Object.entries(budgets).filter(([,v])=>v>0);
  if (bE.length) {
    const cs={}; expenses.filter(e=>e.type==="expense"&&mkStr(e.date)===thisMonth).forEach(e=>{cs[e.category]=(cs[e.category]||0)+e.amount;});
    s+=Math.round((bE.filter(([c,l])=>(cs[c]||0)<=l).length/bE.length)*25);
  } else s+=15;
  const owed=friends.reduce((a,f)=>a+f.debts.filter(d=>d.type==="owe").reduce((x,d)=>x+d.amount,0),0);
  const lent=friends.reduce((a,f)=>a+f.debts.filter(d=>d.type==="lent").reduce((x,d)=>x+d.amount,0),0);
  s+=owed===0?25:lent>=owed?18:owed<5000?10:4;
  const od=bills.filter(b=>{const d=b.dueDay-todayD;return d<-3&&d>-30;}).length;
  s+=od===0?20:od===1?12:4;
  return Math.min(100,s);
};
const hGrade = (s) => s>=80?{g:"A",l:"Excellent",c:"#00C48C"}:s>=65?{g:"B",l:"Good",c:"#4F8EF7"}:s>=45?{g:"C",l:"Average",c:"#F5A623"}:{g:"D",l:"Needs Work",c:"#F04E73"};

const exportCSV = (expenses) => {
  const hdr="Date,Title,Category,Type,Amount,Payment Mode,GST,Note\n";
  const rows=expenses.map(e=>`${dateStr(e.date)},"${e.title}",${CATS[e.category]?.label||e.category},${e.type},${e.amount},${e.paymentMode||""},${e.gst||0},"${e.note||""}"`).join("\n");
  const blob=new Blob([hdr+rows],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download="fintrack_expenses.csv"; a.click();
  URL.revokeObjectURL(url);
};

// ═══════════════════════════════════════════════════════════════
//  localStorage STORAGE HOOK  (replaces window.storage)
// ═══════════════════════════════════════════════════════════════
const useStore = (key, init) => {
  const [val, setVal] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : init;
    } catch { return init; }
  });

  const save = useCallback((v) => {
    setVal(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);

  return [val, save];
};

// ═══════════════════════════════════════════════════════════════
//  SEED DATA
// ═══════════════════════════════════════════════════════════════
const mkD = (d) => new Date(Date.now()-d*864e5).toISOString();

const SEED_EXP = [
  {id:uid(),title:"Salary - June",      category:"other",       amount:65000, type:"income",  paymentMode:"Net Banking",date:mkD(1), gst:0,note:"",incomeType:"Salary"},
  {id:uid(),title:"Jio Recharge",       category:"mobile",      amount:999,   type:"expense", paymentMode:"UPI",        date:mkD(2), gst:0,note:""},
  {id:uid(),title:"Swiggy Order",       category:"food",        amount:420,   type:"expense", paymentMode:"UPI",        date:mkD(3), gst:50,note:"Dinner"},
  {id:uid(),title:"BESCOM Electricity", category:"electricity", amount:1240,  type:"expense", paymentMode:"Net Banking",date:mkD(4), gst:0,note:""},
  {id:uid(),title:"Monthly Rent",       category:"rent",        amount:18000, type:"expense", paymentMode:"UPI",        date:mkD(5), gst:0,note:"Whitefield"},
  {id:uid(),title:"HDFC Credit Card",   category:"creditcard",  amount:8450,  type:"expense", paymentMode:"Net Banking",date:mkD(6), gst:0,note:""},
  {id:uid(),title:"Uber - Office",      category:"transport",   amount:180,   type:"expense", paymentMode:"UPI",        date:mkD(7), gst:22,note:""},
  {id:uid(),title:"Amazon Order",       category:"shopping",    amount:2300,  type:"expense", paymentMode:"Credit Card",date:mkD(8), gst:345,note:"Headphones"},
  {id:uid(),title:"Apollo Pharmacy",    category:"health",      amount:560,   type:"expense", paymentMode:"Cash",       date:mkD(9), gst:0,note:""},
  {id:uid(),title:"Netflix",            category:"entertainment",amount:499,  type:"expense", paymentMode:"Credit Card",date:mkD(10),gst:0,note:""},
  {id:uid(),title:"Freelance Project",  category:"other",       amount:15000, type:"income",  paymentMode:"Net Banking",date:mkD(15),gst:0,note:"Web design",incomeType:"Freelance"},
  {id:uid(),title:"Petrol",             category:"transport",   amount:2000,  type:"expense", paymentMode:"Credit Card",date:mkD(18),gst:0,note:""},
  {id:uid(),title:"Salary - May",       category:"other",       amount:65000, type:"income",  paymentMode:"Net Banking",date:mkD(32),gst:0,note:"",incomeType:"Salary"},
  {id:uid(),title:"Dominos Pizza",      category:"food",        amount:680,   type:"expense", paymentMode:"UPI",        date:mkD(33),gst:0,note:""},
];

const SEED_FRIENDS = [
  {id:uid(),name:"Rahul S.", emoji:"👨",color:"#4F8EF7",
   debts:[
     {id:uid(),label:"Punjab Grill dinner",amount:850,type:"lent",date:mkD(5)},
     {id:uid(),label:"Auto fare split",    amount:120,type:"owe", date:mkD(3)},
     {id:uid(),label:"Movie tickets",      amount:600,type:"lent",date:mkD(2)},
     {id:uid(),label:"Grocery split",      amount:450,type:"lent",date:mkD(1)},
   ],
   settled:[{id:uid(),label:"Concert tickets",amount:1500,type:"lent",date:mkD(20),settledOn:mkD(15)}]},
  {id:uid(),name:"Priya M.",emoji:"👩",color:"#F04E73",
   debts:[
     {id:uid(),label:"Concert tickets",amount:1200,type:"lent",date:mkD(8)},
     {id:uid(),label:"Cab to airport",  amount:550, type:"owe", date:mkD(4)},
     {id:uid(),label:"Haldiram lunch",  amount:280, type:"lent",date:mkD(1)},
   ],
   settled:[]},
  {id:uid(),name:"Arjun K.",emoji:"🧑",color:"#00C48C",
   debts:[
     {id:uid(),label:"Goa trip advance",amount:3000,type:"lent",date:mkD(12)},
     {id:uid(),label:"Hotel split",     amount:2500,type:"lent",date:mkD(10)},
   ],
   settled:[{id:uid(),label:"Petrol money",amount:500,type:"lent",date:mkD(30),settledOn:mkD(25)}]},
];

const SEED_BILLS = [
  {id:uid(),name:"Rent",             icon:"🏠",amount:18000,dueDay:1, color:"#7B5EFB",autoLog:true},
  {id:uid(),name:"BESCOM Electricity",icon:"⚡",amount:1240,dueDay:15,color:"#F5A623",autoLog:false},
  {id:uid(),name:"Jio Recharge",     icon:"📱",amount:999,  dueDay:22,color:"#4F8EF7",autoLog:true},
  {id:uid(),name:"HDFC Credit Card", icon:"💳",amount:8450, dueDay:5, color:"#F04E73",autoLog:false},
  {id:uid(),name:"Spotify Premium",  icon:"🎵",amount:119,  dueDay:10,color:"#1DB954",autoLog:true},
];

const SEED_EMIS = [
  {id:uid(),name:"iPhone 15 EMI",icon:"📱",amount:5000, totalMonths:12, paidMonths:4, bank:"HDFC Bank",startDate:mkD(120),color:"#4F8EF7"},
  {id:uid(),name:"Home Loan",    icon:"🏠",amount:22000,totalMonths:240,paidMonths:18,bank:"SBI",      startDate:mkD(540),color:"#7B5EFB"},
];

const SEED_BUDGETS = {
  food:5000,mobile:1500,electricity:2000,rent:20000,
  creditcard:10000,transport:3000,shopping:5000,health:2000,entertainment:1000,other:2000,
};

const SEED_EVENTS = [
  {id:uid(),name:"Diwali Celebration",icon:"🪔",budget:15000,spent:0,
   startDate:mkD(5),endDate:new Date(Date.now()+20*864e5).toISOString(),color:"#F5A623"},
];

const SEED_SETTINGS = {
  pin:"", darkMode:false, monthlyIncome:80000, payday:1, upiId:"", onboarded:false,
};

// ═══════════════════════════════════════════════════════════════
//  CSS (injected once)
// ═══════════════════════════════════════════════════════════════
const CSS = `
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
.app{max-width:430px;margin:0 auto;min-height:100vh;position:relative;overflow-x:hidden;}
.app{background:var(--bg);color:var(--text);font-family:'Nunito',sans-serif;}
.app{--bg:#F0F4FF;--surface:#fff;--card:#fff;--text:#1A1D3B;--text2:#9099B2;--border:#E8ECFF;--input:#F7F9FF;--shadow:rgba(0,0,0,0.08);}
.app.dark{--bg:#0C0E1A;--surface:#131627;--card:#1A1D2E;--text:#E8ECFF;--text2:#5E6589;--border:#252840;--input:#1E2135;--shadow:rgba(0,0,0,0.3);}

.hdr{background:linear-gradient(145deg,#1A1D3B 0%,#2D3164 60%,#1A1D3B 100%);padding:48px 20px 24px;position:relative;overflow:hidden;}
.hdr::before{content:'';position:absolute;top:-60px;right:-50px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(79,142,247,0.22) 0%,transparent 70%);}
.hdr::after{content:'';position:absolute;bottom:-80px;left:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(123,94,251,0.18) 0%,transparent 70%);}
.hdr-top{display:flex;justify-content:space-between;align-items:flex-start;position:relative;z-index:1;}
.hdr-greet{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:3px;}
.hdr-title{font-family:'Playfair Display',serif;font-size:26px;font-weight:800;color:#fff;}
.hdr-title span{color:#F5A623;}
.hdr-actions{display:flex;gap:8px;}
.hdr-btn{width:40px;height:40px;border-radius:14px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;color:#fff;}

.cards-wrap{padding:18px 14px 6px;}
.cards-grid{display:grid;grid-template-columns:1fr 1fr;gap:11px;}
.sum-card{border-radius:18px;padding:16px 14px;position:relative;overflow:hidden;box-shadow:0 8px 24px var(--shadow);transition:transform .15s;}
.sum-card:active{transform:scale(0.97);}
.sum-card::after{content:'';position:absolute;bottom:-20px;right:-20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.1);}
.sc-icon{width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:15px;margin-bottom:10px;}
.sc-amt{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#fff;line-height:1;}
.sc-lbl{font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:rgba(255,255,255,0.72);margin-top:4px;}
.c-blue{background:linear-gradient(135deg,#4F8EF7,#6B73FF);}
.c-amber{background:linear-gradient(135deg,#F5A623,#FF6B35);}
.c-teal{background:linear-gradient(135deg,#00C48C,#00A878);}
.c-rose{background:linear-gradient(135deg,#F04E73,#CC2E57);}

.tab-outer{padding:14px 14px 0;}
.tab-bar{display:flex;background:var(--card);border-radius:16px;padding:4px;box-shadow:0 2px 12px var(--shadow);}
.tab{flex:1;padding:9px 0;text-align:center;font-size:11px;font-weight:800;color:var(--text2);border-radius:12px;cursor:pointer;transition:all .2s;letter-spacing:.3px;}
.tab.active{background:linear-gradient(135deg,#1A1D3B,#2D3164);color:#fff;box-shadow:0 4px 12px rgba(26,29,59,0.3);}

.content{padding:14px 0 100px;}
.sec-hdr{display:flex;justify-content:space-between;align-items:center;padding:4px 16px 10px;}
.sec-title{font-family:'Playfair Display',serif;font-size:19px;font-weight:700;color:var(--text);}
.see-all{font-size:12px;font-weight:800;color:#4F8EF7;cursor:pointer;}
.card{background:var(--card);border-radius:18px;margin:0 14px 12px;box-shadow:0 4px 18px var(--shadow);overflow:hidden;}

.health-card{background:linear-gradient(135deg,#1A1D3B,#2D3164);border-radius:20px;margin:0 14px 14px;padding:20px;position:relative;overflow:hidden;box-shadow:0 8px 28px rgba(26,29,59,0.35);}
.health-card::before{content:'';position:absolute;top:-30px;right:-30px;width:120px;height:120px;border-radius:50%;background:rgba(255,255,255,0.06);}
.health-inner{display:flex;align-items:center;gap:16px;}
.health-circle{width:80px;height:80px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;border:3px solid rgba(255,255,255,0.15);}
.health-grade{font-family:'Playfair Display',serif;font-size:32px;font-weight:800;line-height:1;}
.health-score-num{font-size:11px;color:rgba(255,255,255,0.6);font-weight:700;}
.health-info{flex:1;}
.health-label{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.55);margin-bottom:4px;}
.health-status{font-size:17px;font-weight:800;color:#fff;margin-bottom:8px;}
.health-bar-wrap{background:rgba(255,255,255,0.12);border-radius:20px;height:8px;overflow:hidden;}
.health-bar{height:100%;border-radius:20px;transition:width .8s cubic-bezier(.2,.8,.3,1);}

.budget-item{padding:10px 18px;border-bottom:1px solid var(--border);}
.budget-item:last-child{border-bottom:none;}
.budget-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:7px;}
.budget-cat{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--text);}
.budget-amts{font-size:11px;font-weight:700;color:var(--text2);}
.budget-amts span{color:var(--text);}
.budget-track{height:6px;background:var(--border);border-radius:20px;overflow:hidden;}
.budget-fill{height:100%;border-radius:20px;transition:width .5s;}
.budget-warn{font-size:10px;font-weight:800;color:#F04E73;margin-top:4px;}

.tx-item{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);}
.tx-item:last-child{border-bottom:none;}
.tx-icon{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0;}
.tx-body{flex:1;min-width:0;}
.tx-title{font-size:13px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tx-meta{font-size:10px;color:var(--text2);font-weight:600;margin-top:2px;}
.tx-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;}
.tx-amt{font-size:13px;font-weight:800;}
.tneg{color:#F04E73;}.tpos{color:#00C48C;}
.icn-btn{background:none;border:none;color:var(--text2);font-size:13px;cursor:pointer;padding:2px 5px;border-radius:6px;}
.icn-btn:hover{background:var(--border);}

.search-wrap{padding:0 14px 12px;display:flex;gap:8px;}
.search-box{flex:1;background:var(--card);border:2px solid var(--border);border-radius:14px;padding:11px 14px;font-size:13px;font-family:'Nunito',sans-serif;color:var(--text);outline:none;}
.search-box:focus{border-color:#4F8EF7;}
.filter-scroll{display:flex;gap:6px;overflow-x:auto;padding:0 14px 12px;scrollbar-width:none;}
.filter-scroll::-webkit-scrollbar{display:none;}
.fchip{flex-shrink:0;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:2px solid var(--border);background:var(--card);color:var(--text2);transition:all .15s;}
.fchip.on{background:linear-gradient(135deg,#1A1D3B,#2D3164);color:#fff;border-color:transparent;}

.fr-card{background:var(--card);border-radius:22px;margin:0 14px 14px;overflow:hidden;box-shadow:0 6px 24px var(--shadow);}
.fr-banner{padding:16px 18px 14px;position:relative;overflow:hidden;}
.fr-banner::before{content:'';position:absolute;bottom:-25px;right:-25px;width:90px;height:90px;border-radius:50%;background:rgba(255,255,255,0.12);}
.fr-inner{display:flex;align-items:center;gap:12px;position:relative;z-index:1;}
.fr-av{width:50px;height:50px;border-radius:16px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;border:2px solid rgba(255,255,255,0.25);}
.fr-name{font-size:16px;font-weight:800;color:#fff;}
.fr-netlbl{font-size:10px;color:rgba(255,255,255,0.7);font-weight:700;margin-top:2px;}
.fr-netamt{font-size:14px;font-weight:800;color:#fff;}
.fr-count{margin-left:auto;font-size:11px;font-weight:700;color:rgba(255,255,255,0.6);text-align:right;}
.fr-body{padding:12px 16px 14px;}
.debt-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;background:var(--input);margin-bottom:7px;}
.debt-row:last-child{margin-bottom:0;}
.debt-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.debt-info{flex:1;min-width:0;}
.debt-lbl{font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.debt-dt{font-size:10px;color:var(--text2);font-weight:600;}
.debt-right{display:flex;flex-direction:column;align-items:flex-end;gap:3px;}
.debt-amt{font-size:12px;font-weight:800;}
.settle-btn{background:rgba(0,196,140,0.12);border:1.5px solid rgba(0,196,140,0.3);color:#00A878;border-radius:7px;padding:2px 8px;font-size:10px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;white-space:nowrap;}
.fr-footer{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:0 16px 16px;}
.fr-btn{border:none;border-radius:12px;padding:10px 4px;font-size:11px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;display:flex;flex-direction:column;align-items:center;gap:4px;}
.fr-btn span:first-child{font-size:16px;}
.fr-btn-add{background:var(--input);color:#4F8EF7;border:2px solid var(--border);}
.fr-btn-split{background:rgba(245,166,35,0.1);color:#F5A623;border:2px solid rgba(245,166,35,0.2);}
.fr-btn-view{background:linear-gradient(135deg,#1A1D3B,#2D3164);color:#fff;border:none;}
.more-tag{text-align:center;font-size:11px;font-weight:700;color:var(--text2);padding:4px 0 0;}

.bill-row{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border);}
.bill-row:last-child{border-bottom:none;}
.bill-icon{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
.bill-body{flex:1;}
.bill-name{font-size:13px;font-weight:800;color:var(--text);}
.bill-due{font-size:11px;color:var(--text2);font-weight:600;margin-top:2px;}
.bill-bdg{display:inline-block;font-size:9px;font-weight:800;padding:3px 8px;border-radius:20px;margin-top:4px;letter-spacing:.5px;}
.b-red{background:rgba(240,78,115,0.12);color:#F04E73;}
.b-amber{background:rgba(245,166,35,0.12);color:#F5A623;}
.b-green{background:rgba(0,196,140,0.12);color:#00A878;}
.bill-right{text-align:right;}
.bill-amt{font-size:15px;font-weight:800;color:var(--text);}
.emi-progress{height:5px;background:var(--border);border-radius:10px;overflow:hidden;margin-top:6px;width:100%;}
.emi-fill{height:100%;border-radius:10px;}

.event-card{background:linear-gradient(135deg,#1A1D3B,#2D3164);border-radius:16px;margin:0 14px 12px;padding:16px 18px;box-shadow:0 6px 20px rgba(26,29,59,0.3);}

.analytics-card{background:var(--card);border-radius:18px;margin:0 14px 14px;padding:18px;box-shadow:0 4px 18px var(--shadow);}
.chart-title{font-size:14px;font-weight:800;color:var(--text);margin-bottom:14px;}

.overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);z-index:200;display:flex;align-items:flex-end;justify-content:center;animation:fi .2s;}
@keyframes fi{from{opacity:0}to{opacity:1}}
.modal{background:var(--surface);border-radius:26px 26px 0 0;padding:24px 20px 50px;width:100%;max-width:430px;animation:su .28s cubic-bezier(.2,.8,.3,1);max-height:90vh;overflow-y:auto;}
.modal-full{background:var(--bg);border-radius:26px 26px 0 0;width:100%;max-width:430px;animation:su .28s cubic-bezier(.2,.8,.3,1);max-height:94vh;overflow-y:auto;}
@keyframes su{from{transform:translateY(60px);opacity:0}to{transform:translateY(0);opacity:1}}
.m-handle{width:38px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 20px;}
.m-title{font-family:'Playfair Display',serif;font-size:21px;font-weight:700;color:var(--text);margin-bottom:18px;}
.field{margin-bottom:13px;}
.field label{font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--text2);display:block;margin-bottom:5px;}
.field input,.field select,.field textarea{width:100%;background:var(--input);border:2px solid var(--border);border-radius:13px;padding:12px 14px;color:var(--text);font-size:13px;font-family:'Nunito',sans-serif;font-weight:600;outline:none;transition:border-color .15s;}
.field input:focus,.field select:focus,.field textarea:focus{border-color:#4F8EF7;}
.field select option{background:var(--surface);}
.field textarea{resize:vertical;min-height:60px;}
.type-row{display:flex;gap:8px;margin-bottom:14px;}
.type-btn{flex:1;padding:11px;border-radius:13px;border:2px solid var(--border);background:var(--input);color:var(--text2);font-size:12px;font-weight:800;cursor:pointer;font-family:'Nunito',sans-serif;transition:all .15s;}
.te.on{border-color:#F04E73;background:rgba(240,78,115,0.1);color:#F04E73;}
.ti.on{border-color:#00C48C;background:rgba(0,196,140,0.1);color:#00C48C;}
.tl.on{border-color:#00C48C;background:rgba(0,196,140,0.1);color:#00C48C;}
.to2.on{border-color:#F04E73;background:rgba(240,78,115,0.1);color:#F04E73;}
.cat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:4px;}
.cat-chip{background:var(--input);border:2px solid var(--border);border-radius:12px;padding:9px 4px 7px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;font-size:10px;font-weight:700;color:var(--text2);transition:all .15s;}
.cat-chip span:first-child{font-size:18px;}
.cat-chip.sel{border-color:#4F8EF7;background:rgba(79,142,247,0.1);color:#4F8EF7;}
.sub-btn{width:100%;background:linear-gradient(135deg,#1A1D3B,#2D3164);border:none;color:#fff;font-weight:800;font-size:14px;padding:15px;border-radius:15px;cursor:pointer;font-family:'Nunito',sans-serif;margin-top:10px;box-shadow:0 6px 18px rgba(26,29,59,0.3);}
.sub-btn:active{opacity:.88;}
.sub-btn-sec{width:100%;background:var(--input);border:2px solid var(--border);color:var(--text);font-weight:800;font-size:13px;padding:13px;border-radius:15px;cursor:pointer;font-family:'Nunito',sans-serif;margin-top:8px;}

.vt-hdr{padding:48px 18px 20px;position:relative;}
.vt-close{position:absolute;top:16px;right:16px;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.vt-sum{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 16px;margin-bottom:16px;}
.vt-all-row{display:flex;align-items:center;gap:10px;padding:11px 14px;background:var(--card);border-radius:14px;margin:0 14px 8px;box-shadow:0 2px 10px var(--shadow);}
.vt-section-label{font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:var(--text2);margin:0 14px 10px;padding-top:4px;}

.pin-screen{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(180deg,#1A1D3B 0%,#0C0E1A 100%);padding:40px 30px;}
.pin-title{font-family:'Playfair Display',serif;font-size:26px;font-weight:800;color:#fff;margin-bottom:8px;text-align:center;}
.pin-sub{font-size:13px;color:rgba(255,255,255,0.5);font-weight:600;margin-bottom:40px;text-align:center;}
.pin-dots{display:flex;gap:16px;margin-bottom:40px;}
.pin-dot{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);transition:all .2s;}
.pin-dot.filled{background:#4F8EF7;border-color:#4F8EF7;transform:scale(1.1);}
.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:100%;max-width:280px;}
.pin-key{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:16px;padding:18px;font-size:22px;font-weight:800;color:#fff;cursor:pointer;text-align:center;font-family:'Nunito',sans-serif;transition:all .1s;}
.pin-key:active{background:rgba(79,142,247,0.3);transform:scale(0.94);}
.pin-error{color:#F04E73;font-size:13px;font-weight:700;margin-top:16px;text-align:center;height:20px;}

.onb-screen{min-height:100vh;background:var(--bg);display:flex;flex-direction:column;}
.onb-hdr{background:linear-gradient(145deg,#1A1D3B,#2D3164);padding:60px 24px 30px;text-align:center;}
.onb-title{font-family:'Playfair Display',serif;font-size:26px;font-weight:800;color:#fff;margin-bottom:6px;}
.onb-sub{font-size:13px;color:rgba(255,255,255,0.6);font-weight:600;}
.onb-step{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-bottom:8px;}
.onb-dot{width:8px;height:8px;border-radius:50%;background:var(--border);transition:all .3s;}
.onb-dot.on{background:#4F8EF7;width:24px;border-radius:4px;}

.settings-wrap{position:fixed;inset:0;background:var(--bg);z-index:300;overflow-y:auto;max-width:430px;left:50%;transform:translateX(-50%);animation:su .3s cubic-bezier(.2,.8,.3,1);}
.settings-hdr{background:linear-gradient(145deg,#1A1D3B,#2D3164);padding:52px 18px 24px;display:flex;align-items:center;gap:12px;}
.settings-hdr h1{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:#fff;flex:1;}
.settings-back{width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.settings-section{margin:16px 14px 0;}
.settings-sec-title{font-size:10px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--text2);margin-bottom:8px;}
.settings-row{display:flex;align-items:center;padding:14px 16px;background:var(--card);border-bottom:1px solid var(--border);}
.settings-row:first-of-type{border-radius:16px 16px 0 0;}
.settings-row:last-of-type{border-radius:0 0 16px 16px;border-bottom:none;}
.settings-row:only-of-type{border-radius:16px;}
.settings-icon{font-size:20px;width:30px;flex-shrink:0;}
.settings-label{flex:1;font-size:14px;font-weight:700;color:var(--text);margin-left:10px;}
.settings-value{font-size:13px;font-weight:700;color:var(--text2);}
.toggle{width:44px;height:24px;background:var(--border);border-radius:12px;position:relative;cursor:pointer;transition:background .3s;flex-shrink:0;}
.toggle.on{background:#4F8EF7;}
.toggle-thumb{position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .3s;box-shadow:0 1px 4px rgba(0,0,0,0.2);}
.toggle.on .toggle-thumb{left:23px;}

.fab{position:fixed;bottom:84px;right:calc(50% - 215px + 16px);width:54px;height:54px;border-radius:17px;background:linear-gradient(135deg,#4F8EF7,#7B5EFB);border:none;font-size:26px;cursor:pointer;box-shadow:0 8px 22px rgba(79,142,247,0.45);display:flex;align-items:center;justify-content:center;z-index:50;color:#fff;transition:transform .15s;}
.fab:active{transform:scale(0.9);}
.bnav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:rgba(255,255,255,0.96);backdrop-filter:blur(20px);border-top:1px solid #EAECF5;display:grid;grid-template-columns:repeat(5,1fr);padding:7px 0 20px;z-index:100;box-shadow:0 -4px 24px rgba(0,0,0,0.07);}
.app.dark .bnav{background:rgba(19,22,39,0.97);border-top-color:#252840;}
.nb-btn{display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:4px;}
.nb-icon{font-size:20px;}
.nb-lbl{font-size:9px;font-weight:800;color:#BFC4DC;letter-spacing:.3px;}
.nb-btn.on .nb-lbl{color:#4F8EF7;}
.nb-dot{width:4px;height:4px;border-radius:50%;background:#4F8EF7;opacity:0;margin-top:1px;}
.nb-btn.on .nb-dot{opacity:1;}

.empty-state{text-align:center;padding:40px 20px;color:var(--text2);}
.empty-icon{font-size:46px;display:block;margin-bottom:12px;}
.empty-txt{font-size:13px;font-weight:700;}
.gst-badge{font-size:10px;font-weight:800;background:rgba(79,142,247,0.12);color:#4F8EF7;padding:2px 7px;border-radius:6px;margin-left:4px;}
.alert-banner{background:rgba(240,78,115,0.1);border:1px solid rgba(240,78,115,0.2);border-radius:12px;padding:10px 14px;margin:0 14px 10px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#F04E73;}
.wa-btn{background:rgba(37,211,102,0.12);border:1.5px solid rgba(37,211,102,0.3);border-radius:8px;padding:3px 8px;font-size:10px;font-weight:800;color:#25D366;cursor:pointer;font-family:'Nunito',sans-serif;}
.upi-btn{background:rgba(79,142,247,0.12);border:1.5px solid rgba(79,142,247,0.3);border-radius:8px;padding:3px 8px;font-size:10px;font-weight:800;color:#4F8EF7;cursor:pointer;font-family:'Nunito',sans-serif;}
.forecast-row{display:flex;justify-content:space-between;align-items:center;padding:10px 18px;border-bottom:1px solid var(--border);}
.forecast-row:last-child{border-bottom:none;}
.tag{font-size:10px;font-weight:800;padding:3px 8px;border-radius:20px;}
.tag-inc{background:rgba(0,196,140,0.12);color:#00A878;}
.tag-exp{background:rgba(240,78,115,0.12);color:#F04E73;}
.month-scroll{display:flex;gap:7px;overflow-x:auto;padding:0 14px 12px;scrollbar-width:none;}
.month-scroll::-webkit-scrollbar{display:none;}
.mchip{flex-shrink:0;padding:6px 15px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:2px solid var(--border);background:var(--card);color:var(--text2);transition:all .15s;}
.mchip.on{background:linear-gradient(135deg,#1A1D3B,#2D3164);color:#fff;border-color:transparent;}
.insight-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);}
.insight-row:last-child{border-bottom:none;}
.insight-icon{font-size:22px;width:36px;text-align:center;}
.insight-text{flex:1;font-size:12px;font-weight:600;color:var(--text);}
.insight-badge{font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;}
.ib-up{background:rgba(240,78,115,0.12);color:#F04E73;}
.ib-down{background:rgba(0,196,140,0.12);color:#00A878;}
.ib-neu{background:var(--border);color:var(--text2);}
.sms-area{width:100%;background:var(--input);border:2px dashed var(--border);border-radius:13px;padding:12px 14px;font-size:12px;font-family:'Nunito',sans-serif;color:var(--text);outline:none;min-height:120px;resize:vertical;}
.sms-area:focus{border-color:#4F8EF7;}
.parsed-item{display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--input);border-radius:10px;margin-bottom:6px;}
.split-friend-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);}
.split-friend-row:last-child{border-bottom:none;}
.split-chk{width:20px;height:20px;border-radius:6px;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;flex-shrink:0;}
.split-chk.chk{background:#4F8EF7;border-color:#4F8EF7;color:#fff;}
`;

if (!document.getElementById("ft-css")) {
  const s = document.createElement("style");
  s.id = "ft-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [tab,          setTab]          = useState(0);
  const [screen,       setScreen]       = useState("loading");
  const [modal,        setModal]        = useState(null);
  const [selFriend,    setSelFriend]    = useState(null);
  const [viewFriend,   setViewFriend]   = useState(null);
  const [editExp,      setEditExp]      = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const [expenses, setExpenses] = useStore("ft_exp_v4",   SEED_EXP);
  const [friends,  setFriends]  = useStore("ft_fri_v4",   SEED_FRIENDS);
  const [bills,    setBills]    = useStore("ft_bil_v4",   SEED_BILLS);
  const [emis,     setEmis]     = useStore("ft_emi_v4",   SEED_EMIS);
  const [budgets,  setBudgets]  = useStore("ft_bud_v4",   SEED_BUDGETS);
  const [events,   setEvents]   = useStore("ft_evt_v4",   SEED_EVENTS);
  const [settings, setSettings] = useStore("ft_set_v4",   SEED_SETTINGS);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      if (!settings.onboarded) { setScreen("onboarding"); return; }
      if (settings.pin)        { setScreen("pin-verify"); } else { setScreen("app"); }
    }, 600);
    return () => clearTimeout(t);
  }, [settings.onboarded, settings.pin]);

  const handlePinKey = (key) => {
    if (key === "del") { setPinInput(p => p.slice(0,-1)); setPinError(""); return; }
    const next = pinInput + key;
    setPinInput(next);
    if (next.length === 4) {
      if (screen === "pin-setup") {
        setSettings(s => ({...s, pin: next, onboarded: true}));
        setTimeout(() => { setPinInput(""); setScreen("app"); }, 300);
      } else {
        if (next === settings.pin) { setPinInput(""); setScreen("app"); }
        else { setPinError("Wrong PIN. Try again."); setTimeout(() => { setPinInput(""); setPinError(""); }, 800); }
      }
    }
  };

  const saveAddExp  = (e) => setExpenses(p => [{...e, id:uid(), date:new Date().toISOString()}, ...p]);
  const delExpense  = (id)=> setExpenses(p => p.filter(x => x.id !== id));
  const editExpense = (e) => setExpenses(p => p.map(x => x.id === e.id ? e : x));
  const addFriend   = (f) => setFriends(p  => [...p, {...f, id:uid(), debts:[], settled:[]}]);
  const addDebt     = (fid,d) => setFriends(p => p.map(f => f.id===fid ? {...f, debts:[{...d,id:uid(),date:new Date().toISOString()},...f.debts]} : f));
  const settleDebt  = (fid,did) => setFriends(p => p.map(f => {
    if (f.id !== fid) return f;
    const d = f.debts.find(x => x.id === did);
    return {...f, debts:f.debts.filter(x=>x.id!==did), settled:[{...d,settledOn:new Date().toISOString(),...(f.settled||[])},...(f.settled||[])]};
  }));
  const addSplitDebts = (fids, label, total) => {
    const share = Math.round(total/fids.length*100)/100;
    fids.forEach(fid => addDebt(fid, {label, amount:share, type:"lent"}));
  };
  const addBill   = (b) => setBills(p  => [...p, {...b, id:uid()}]);
  const delBill   = (id)=> setBills(p  => p.filter(x=>x.id!==id));
  const addEmi    = (e) => setEmis(p   => [...p, {...e, id:uid()}]);
  const delEmi    = (id)=> setEmis(p   => p.filter(x=>x.id!==id));
  const addEvent  = (e) => setEvents(p => [...p, {...e, id:uid(), spent:0}]);
  const delEvent  = (id)=> setEvents(p => p.filter(x=>x.id!==id));

  const thisMonthExp  = useMemo(() => expenses.filter(e => e.type==="expense" && mkStr(e.date)===thisMonth), [expenses]);
  const totalExpense  = thisMonthExp.reduce((s,e) => s+e.amount, 0);
  const totalIncome   = useMemo(() => expenses.filter(e=>e.type==="income"&&mkStr(e.date)===thisMonth).reduce((s,e)=>s+e.amount,0), [expenses]);
  const toReceive     = friends.reduce((s,f)=>s+Math.max(f.debts.reduce((a,d)=>a+(d.type==="lent"?d.amount:-d.amount),0),0),0);
  const toPay         = friends.reduce((s,f)=>s+Math.max(-f.debts.reduce((a,d)=>a+(d.type==="lent"?d.amount:-d.amount),0),0),0);
  const pending       = bills.reduce((s,b)=>{const d=b.dueDay-todayD;return s+(d>=0&&d<=5?b.amount:0);},0);
  const healthScore   = calcHealth(expenses,friends,bills,budgets,settings.monthlyIncome);
  const hg            = hGrade(healthScore);

  const liveViewFriend = viewFriend ? friends.find(f=>f.id===viewFriend.id)||viewFriend : null;

  if (screen==="loading") return (
    <div style={{minHeight:"100vh",background:"linear-gradient(180deg,#1A1D3B,#0C0E1A)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontSize:60,marginBottom:16}}>💰</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:800,color:"#fff"}}>Fin<span style={{color:"#F5A623"}}>Track</span></div>
      <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",fontWeight:600,marginTop:8}}>Loading your finances...</div>
    </div>
  );

  if (screen==="pin-setup"||screen==="pin-verify")
    return <PinScreen mode={screen} pinInput={pinInput} pinError={pinError} onKey={handlePinKey}
      onSkip={screen==="pin-setup"?()=>{setSettings(s=>({...s,onboarded:true}));setScreen("app");}:null}/>;

  if (screen==="onboarding")
    return <Onboarding onDone={(income)=>{setSettings(s=>({...s,monthlyIncome:income,onboarded:true}));setScreen("pin-setup");}}/>;

  return (
    <div className={`app${settings.darkMode?" dark":""}`}>
      {/* Header */}
      <div className="hdr">
        <div className="hdr-top">
          <div>
            <div className="hdr-greet">{todayDate.toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</div>
            <div className="hdr-title">Fin<span>Track</span></div>
          </div>
          <div className="hdr-actions">
            <div className="hdr-btn" onClick={()=>setModal("sms")}>📩</div>
            <div className="hdr-btn" onClick={()=>setShowSettings(true)}>⚙️</div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="cards-wrap">
        <div className="cards-grid">
          {[
            {cls:"c-blue", icon:"👛", amt:totalExpense, lbl:"This Month Spent"},
            {cls:"c-amber",icon:"⚠️", amt:pending,      lbl:"Pending Bills"},
            {cls:"c-teal", icon:"⬇️", amt:toReceive,    lbl:"To Receive"},
            {cls:"c-rose", icon:"⬆️", amt:toPay,        lbl:"You Owe"},
          ].map(c=>(
            <div key={c.lbl} className={`sum-card ${c.cls}`}>
              <div className="sc-icon">{c.icon}</div>
              <div className="sc-amt">{fmtC(c.amt)}</div>
              <div className="sc-lbl">{c.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="tab-outer">
        <div className="tab-bar">
          {["Home","Expenses","Friends","Bills","Analytics"].map((t,i)=>(
            <div key={t} className={`tab${tab===i?" active":""}`} onClick={()=>setTab(i)}>{t}</div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="content">
        {tab===0&&<DashboardTab expenses={expenses} friends={friends} bills={bills} budgets={budgets} events={events} healthScore={healthScore} hg={hg} totalIncome={totalIncome} totalExpense={totalExpense} settings={settings} setTab={setTab} setModal={setModal} onDelEvent={delEvent}/>}
        {tab===1&&<ExpensesTab expenses={expenses} onDel={delExpense} onEdit={(e)=>{setEditExp(e);setModal("edit-exp");}}/>}
        {tab===2&&<FriendsTab friends={friends} onSettle={settleDebt} onAddDebt={(f)=>{setSelFriend(f);setModal("debt");}} onViewAll={(f)=>setViewFriend(f)} onSplit={(f)=>{setSelFriend(f);setModal("split");}}/>}
        {tab===3&&<BillsEMITab bills={bills} emis={emis} onDelBill={delBill} onDelEmi={delEmi} setModal={setModal}/>}
        {tab===4&&<AnalyticsTab expenses={expenses} budgets={budgets} settings={settings}/>}
      </div>

      <button className="fab" onClick={()=>{if(tab===0||tab===1)setModal("expense");else if(tab===2)setModal("friend");else if(tab===3)setModal("bill");else setModal("expense");}}>+</button>

      <div className="bnav">
        {[{icon:"🏠",lbl:"Home"},{icon:"💸",lbl:"Expenses"},{icon:"🤝",lbl:"Friends"},{icon:"📋",lbl:"Bills"},{icon:"📊",lbl:"Analytics"}].map((n,i)=>(
          <div key={n.lbl} className={`nb-btn${tab===i?" on":""}`} onClick={()=>setTab(i)}>
            <div className="nb-icon">{n.icon}</div>
            <div className="nb-lbl">{n.lbl}</div>
            <div className="nb-dot"/>
          </div>
        ))}
      </div>

      {modal==="expense"  && <ExpenseModal  onClose={()=>setModal(null)} onSave={saveAddExp}/>}
      {modal==="edit-exp" && editExp && <ExpenseModal onClose={()=>{setModal(null);setEditExp(null);}} onSave={editExpense} initial={editExp} isEdit/>}
      {modal==="friend"   && <FriendModal   onClose={()=>setModal(null)} onSave={addFriend}/>}
      {modal==="debt"     && selFriend && <DebtModal friend={selFriend} onClose={()=>{setModal(null);setSelFriend(null);}} onSave={(d)=>addDebt(selFriend.id,d)}/>}
      {modal==="split"    && selFriend && <SplitModal friends={friends} anchor={selFriend} onClose={()=>{setModal(null);setSelFriend(null);}} onSave={addSplitDebts}/>}
      {modal==="bill"     && <BillModal    onClose={()=>setModal(null)} onSave={addBill}/>}
      {modal==="emi"      && <EMIModal     onClose={()=>setModal(null)} onSave={addEmi}/>}
      {modal==="event"    && <EventModal   onClose={()=>setModal(null)} onSave={addEvent}/>}
      {modal==="budget"   && <BudgetModal  budgets={budgets} onClose={()=>setModal(null)} onSave={setBudgets}/>}
      {modal==="sms"      && <SMSModal     onClose={()=>setModal(null)} onImport={(txns)=>{txns.forEach(t=>saveAddExp(t));setModal(null);}}/>}
      {liveViewFriend     && <ViewFriendModal friend={liveViewFriend} onClose={()=>setViewFriend(null)} onSettle={settleDebt} onAddDebt={()=>{setSelFriend(liveViewFriend);setModal("debt");setViewFriend(null);}} settings={settings}/>}
      {showSettings       && <SettingsScreen settings={settings} setSettings={setSettings} budgets={budgets} onBudget={()=>setModal("budget")} expenses={expenses} onClose={()=>setShowSettings(false)} onPinChange={()=>{setShowSettings(false);setScreen("pin-setup");}}/>}
    </div>
  );
}

// ── PIN ───────────────────────────────────────────────────────
function PinScreen({mode,pinInput,pinError,onKey,onSkip}){
  const keys=["1","2","3","4","5","6","7","8","9","","0","del"];
  return(
    <div className="pin-screen">
      <div style={{fontSize:40,marginBottom:16}}>🔐</div>
      <div className="pin-title">{mode==="pin-setup"?"Set Your PIN":"Enter PIN"}</div>
      <div className="pin-sub">{mode==="pin-setup"?"Secure your financial data":"Verify your identity"}</div>
      <div className="pin-dots">
        {[0,1,2,3].map(i=><div key={i} className={`pin-dot${i<pinInput.length?" filled":""}`}/>)}
      </div>
      <div className="pin-pad">
        {keys.map((k,i)=>k===""?<div key={i}/>:
          <div key={i} className="pin-key" onClick={()=>onKey(k)}>{k==="del"?"⌫":k}</div>
        )}
      </div>
      <div className="pin-error">{pinError}</div>
      {onSkip&&<div onClick={onSkip} style={{marginTop:12,color:"rgba(255,255,255,0.4)",fontSize:13,fontWeight:700,cursor:"pointer",textDecoration:"underline"}}>Skip for now</div>}
    </div>
  );
}

// ── ONBOARDING ────────────────────────────────────────────────
function Onboarding({onDone}){
  const [step,setStep]=useState(0);
  const [income,setIncome]=useState("65000");
  const steps=[
    {title:"Welcome to FinTrack",sub:"All-in-one Indian personal finance"},
    {title:"Your Monthly Income",sub:"We'll track your savings rate"},
    {title:"You're all set! 🎉",sub:"Start tracking your finances"},
  ];
  const s=steps[step];
  return(
    <div className="onb-screen">
      <div className="onb-hdr">
        <div className="onb-step">Step {step+1} of {steps.length}</div>
        <div className="onb-title">{s.title}</div>
        <div className="onb-sub">{s.sub}</div>
      </div>
      <div style={{flex:1,padding:"28px 20px"}}>
        {step===0&&["💸 Track all expenses","🤝 Manage friend debts","📋 Bill & EMI reminders","📊 Smart analytics","🏆 Financial health score"].map(f=>(
          <div key={f} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 0",borderBottom:"1px solid var(--border)",fontSize:15,fontWeight:700,color:"var(--text)"}}>
            <span style={{fontSize:22}}>{f.split(" ")[0]}</span>{f.slice(f.indexOf(" ")+1)}
          </div>
        ))}
        {step===1&&(
          <div className="field" style={{marginTop:20}}>
            <label>Monthly Take-home (₹)</label>
            <input type="number" value={income} onChange={e=>setIncome(e.target.value)} placeholder="65000"/>
          </div>
        )}
        {step===2&&<div style={{textAlign:"center",paddingTop:30}}><div style={{fontSize:70}}>🎉</div><div style={{fontSize:16,fontWeight:800,color:"var(--text)",marginTop:16}}>Income set to {fmt(parseFloat(income)||65000)}</div></div>}
      </div>
      <div style={{padding:"0 20px 40px"}}>
        <button className="sub-btn" onClick={()=>step<steps.length-1?setStep(s=>s+1):onDone(parseFloat(income)||65000)}>
          {step===steps.length-1?"Get Started →":"Continue →"}
        </button>
        <div style={{display:"flex",justifyContent:"center",gap:8,paddingTop:16}}>
          {steps.map((_,i)=><div key={i} className={`onb-dot${step===i?" on":""}`}/>)}
        </div>
      </div>
    </div>
  );
}

// ── SHARED TX ROW ─────────────────────────────────────────────
function TxRow({e,onDel,onEdit}){
  const cat=CATS[e.category]||CATS.other;
  return(
    <div className="tx-item">
      <div className="tx-icon" style={{background:cat.color+"18"}}>{cat.icon}</div>
      <div className="tx-body">
        <div className="tx-title">{e.title}{e.gst>0&&<span className="gst-badge">GST ₹{e.gst}</span>}</div>
        <div className="tx-meta">{cat.label} · {e.paymentMode||"UPI"} · {dateStr(e.date)}</div>
      </div>
      <div className="tx-right">
        <div className={`tx-amt ${e.type==="expense"?"tneg":"tpos"}`}>{e.type==="expense"?"-":"+"}{fmt(e.amount)}</div>
        <div style={{display:"flex",gap:2}}>
          {onEdit&&<button className="icn-btn" onClick={()=>onEdit(e)}>✏️</button>}
          {onDel&&<button className="icn-btn" onClick={()=>onDel(e.id)}>✕</button>}
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────
function DashboardTab({expenses,friends,bills,budgets,events,healthScore,hg,totalIncome,totalExpense,settings,setTab,setModal,onDelEvent}){
  const catSpend={};
  expenses.filter(e=>e.type==="expense"&&mkStr(e.date)===thisMonth).forEach(e=>{catSpend[e.category]=(catSpend[e.category]||0)+e.amount;});
  const daysInMonth=new Date(todayDate.getFullYear(),todayDate.getMonth()+1,0).getDate();
  const dailyAvg=totalExpense/(todayD||1);
  const forecast=Math.round(dailyAvg*daysInMonth);
  const savingsRate=totalIncome>0?Math.max(0,Math.round(((totalIncome-totalExpense)/totalIncome)*100)):0;
  const dueSoon=bills.filter(b=>{const d=b.dueDay-todayD;return d>=0&&d<=3;});
  const overBudget=Object.entries(budgets).filter(([c,l])=>l>0&&(catSpend[c]||0)>l);

  return(<>
    {dueSoon.map(b=>(
      <div key={b.id} className="alert-banner">⚠️ {b.name} due in {b.dueDay-todayD===0?"today!":b.dueDay-todayD+"d"} · {fmt(b.amount)}</div>
    ))}
    {overBudget.map(([c])=>(
      <div key={c} className="alert-banner">🔴 {CATS[c]?.label} budget exceeded!</div>
    ))}

    <div className="health-card">
      <div className="health-inner">
        <div className="health-circle">
          <div className="health-grade" style={{color:hg.c}}>{hg.g}</div>
          <div className="health-score-num">{healthScore}/100</div>
        </div>
        <div className="health-info">
          <div className="health-label">Financial Health</div>
          <div className="health-status" style={{color:hg.c}}>{hg.l}</div>
          <div className="health-bar-wrap"><div className="health-bar" style={{width:`${healthScore}%`,background:hg.c}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:700}}>Savings: {savingsRate}%</span>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.5)",fontWeight:700}}>Forecast: {fmtC(forecast)}</span>
          </div>
        </div>
      </div>
    </div>

    <div className="sec-hdr"><div className="sec-title">This Month</div></div>
    <div className="card">
      {[
        {label:"Income",val:fmt(totalIncome),tag:"inc"},
        {label:"Spent so far",val:fmt(totalExpense),tag:"exp"},
        {label:"Month forecast",val:fmt(forecast),tag:forecast>totalIncome?"exp":"inc"},
        {label:"Savings rate",val:`${savingsRate}%`,tag:savingsRate>=20?"inc":"exp"},
      ].map(r=>(
        <div key={r.label} className="forecast-row">
          <span style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{r.label}</span>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:14,fontWeight:800,color:"var(--text)"}}>{r.val}</span>
            <span className={`tag tag-${r.tag}`}>{r.tag==="inc"?"✓":"!"}</span>
          </div>
        </div>
      ))}
    </div>

    <div className="sec-hdr"><div className="sec-title">Budget</div><span className="see-all" onClick={()=>setModal("budget")}>Edit →</span></div>
    <div className="card">
      {Object.entries(budgets).filter(([,l])=>l>0).slice(0,5).map(([cat,limit])=>{
        const spent=catSpend[cat]||0;
        const pct=Math.min(100,Math.round(spent/limit*100));
        const over=spent>limit;
        return(
          <div key={cat} className="budget-item">
            <div className="budget-row">
              <div className="budget-cat"><span>{CATS[cat]?.icon}</span>{CATS[cat]?.label}</div>
              <div className="budget-amts"><span>{fmt(spent)}</span> / {fmtC(limit)}</div>
            </div>
            <div className="budget-track"><div className="budget-fill" style={{width:`${pct}%`,background:over?"#F04E73":pct>80?"#F5A623":"#00C48C"}}/></div>
            {over&&<div className="budget-warn">⚠ Over by {fmt(spent-limit)}</div>}
          </div>
        );
      })}
      {Object.values(budgets).every(v=>!v)&&<div className="empty-state" style={{padding:"20px"}}><span className="empty-icon">📊</span><div className="empty-txt">Tap Edit to set budgets</div></div>}
    </div>

    {events.length>0&&<>
      <div className="sec-hdr"><div className="sec-title">Special Events</div><span className="see-all" onClick={()=>setModal("event")}>+ Add</span></div>
      {events.map(ev=>{
        const pct=Math.min(100,Math.round((ev.spent/ev.budget)*100));
        return(
          <div key={ev.id} className="event-card">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:"#fff"}}>{ev.icon} {ev.name}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.6)",marginTop:2}}>Budget: {fmt(ev.budget)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:18,fontWeight:800,color:"#F5A623"}}>{fmt(ev.spent)}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.5)",marginTop:2}}>spent</div>
              </div>
            </div>
            <div style={{background:"rgba(255,255,255,0.12)",borderRadius:10,height:7,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#F5A623,#F04E73)",borderRadius:10}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:8}}>
              <span style={{fontSize:10,color:"rgba(255,255,255,0.5)",fontWeight:700}}>{pct}% used</span>
              <span onClick={()=>onDelEvent(ev.id)} style={{fontSize:11,color:"rgba(255,255,255,0.35)",cursor:"pointer"}}>✕ Remove</span>
            </div>
          </div>
        );
      })}
    </>}

    <div className="sec-hdr"><div className="sec-title">Quick Actions</div></div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"0 14px 14px"}}>
      {[
        {bg:"rgba(79,142,247,0.1)",icon:"➕",color:"#4F8EF7",lbl:"Add Expense",fn:()=>setModal("expense")},
        {bg:"rgba(0,196,140,0.1)",icon:"🤝",color:"#00C48C",lbl:"Friends",fn:()=>setTab(2)},
        {bg:"rgba(245,166,35,0.1)",icon:"🪔",color:"#F5A623",lbl:"Event Budget",fn:()=>setModal("event")},
        {bg:"rgba(240,78,115,0.1)",icon:"📩",color:"#F04E73",lbl:"Import SMS",fn:()=>setModal("sms")},
      ].map(a=>(
        <div key={a.lbl} onClick={a.fn} style={{background:a.bg,borderRadius:16,padding:"18px 14px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,cursor:"pointer"}}>
          <div style={{fontSize:28}}>{a.icon}</div>
          <div style={{fontSize:13,fontWeight:800,color:a.color}}>{a.lbl}</div>
        </div>
      ))}
    </div>

    <div className="sec-hdr"><div className="sec-title">Recent</div><span className="see-all" onClick={()=>setTab(1)}>See all →</span></div>
    <div className="card">
      {expenses.slice(0,5).map(e=><TxRow key={e.id} e={e}/>)}
      {!expenses.length&&<div className="empty-state"><span className="empty-icon">🌱</span><div className="empty-txt">No transactions yet</div></div>}
    </div>
  </>);
}

// ── EXPENSES TAB ──────────────────────────────────────────────
function ExpensesTab({expenses,onDel,onEdit}){
  const [search,setSearch]=useState("");
  const [selMonth,setSelMonth]=useState(thisMonth);
  const [selCat,setSelCat]=useState("all");
  const [selMode,setSelMode]=useState("all");
  const months=useMemo(()=>{const s=new Set();expenses.forEach(e=>s.add(mkStr(e.date)));return [...s];},[expenses]);
  const filtered=useMemo(()=>expenses.filter(e=>{
    if(selMonth&&mkStr(e.date)!==selMonth)return false;
    if(selCat!=="all"&&e.category!==selCat)return false;
    if(selMode!=="all"&&e.paymentMode!==selMode)return false;
    if(search&&!e.title.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  }),[expenses,selMonth,selCat,selMode,search]);
  const totExp=filtered.filter(e=>e.type==="expense").reduce((s,e)=>s+e.amount,0);
  const totInc=filtered.filter(e=>e.type==="income").reduce((s,e)=>s+e.amount,0);
  const totalGst=filtered.reduce((s,e)=>s+(e.gst||0),0);
  return(<>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,padding:"4px 14px 12px"}}>
      {[{bg:"rgba(0,196,140,0.1)",color:"#00C48C",lbl:"Income",val:fmt(totInc)},
        {bg:"rgba(240,78,115,0.1)",color:"#F04E73",lbl:"Spent",val:fmt(totExp)},
        {bg:"rgba(79,142,247,0.1)",color:"#4F8EF7",lbl:"GST Paid",val:fmt(totalGst)},
      ].map(s=>(
        <div key={s.lbl} style={{background:s.bg,borderRadius:14,padding:"12px"}}>
          <div style={{fontSize:10,fontWeight:800,letterSpacing:1,textTransform:"uppercase",color:s.color}}>{s.lbl}</div>
          <div style={{fontSize:15,fontWeight:800,color:s.color,marginTop:4}}>{s.val}</div>
        </div>
      ))}
    </div>
    <div className="month-scroll">{months.map(m=><div key={m} className={`mchip${selMonth===m?" on":""}`} onClick={()=>setSelMonth(selMonth===m?"":m)}>{m}</div>)}</div>
    <div className="search-wrap"><input className="search-box" placeholder="🔍 Search transactions..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <div className="filter-scroll">
      {[{v:"all",l:"All Categories"},...Object.entries(CATS).map(([k,v])=>({v:k,l:v.icon+" "+v.label.split(" ")[0]}))].map(f=>(
        <div key={f.v} className={`fchip${selCat===f.v?" on":""}`} onClick={()=>setSelCat(f.v)}>{f.l}</div>
      ))}
    </div>
    <div className="filter-scroll" style={{paddingBottom:2}}>
      {[{v:"all",l:"All Modes"},...PAYMENT_MODES.map(m=>({v:m,l:m}))].map(f=>(
        <div key={f.v} className={`fchip${selMode===f.v?" on":""}`} onClick={()=>setSelMode(f.v)}>{f.l}</div>
      ))}
    </div>
    <div className="card" style={{marginTop:10}}>
      {filtered.length===0&&<div className="empty-state"><span className="empty-icon">🔍</span><div className="empty-txt">No transactions found</div></div>}
      {filtered.map(e=><TxRow key={e.id} e={e} onDel={onDel} onEdit={onEdit}/>)}
    </div>
  </>);
}

// ── FRIENDS TAB ───────────────────────────────────────────────
function FriendsTab({friends,onSettle,onAddDebt,onViewAll,onSplit}){
  if(!friends.length)return<div className="empty-state" style={{marginTop:40}}><span className="empty-icon">🤝</span><div className="empty-txt">Add a friend to track money</div></div>;
  return(
    <div style={{paddingTop:8}}>
      {friends.map(f=>{
        const net=f.debts.reduce((a,d)=>a+(d.type==="lent"?d.amount:-d.amount),0);
        const recent=f.debts.slice(0,3);
        const grad=`linear-gradient(135deg,${f.color}DD,${f.color}88)`;
        return(
          <div key={f.id} className="fr-card">
            <div className="fr-banner" style={{background:grad}}>
              <div className="fr-inner">
                <div className="fr-av">{f.emoji}</div>
                <div>
                  <div className="fr-name">{f.name}</div>
                  <div className="fr-netlbl">{net>=0?"They owe you":"You owe them"}</div>
                  <div className="fr-netamt">{fmt(Math.abs(net))}</div>
                </div>
                <div className="fr-count"><div>{f.debts.length} active</div><div>{(f.settled||[]).length} settled</div></div>
              </div>
            </div>
            <div className="fr-body">
              {!recent.length&&<div style={{textAlign:"center",padding:"10px 0",fontSize:12,fontWeight:800,color:"#00A878"}}>All settled up 🎉</div>}
              {recent.map(d=>(
                <div key={d.id} className="debt-row">
                  <div className="debt-dot" style={{background:d.type==="lent"?"#00C48C":"#F04E73"}}/>
                  <div className="debt-info"><div className="debt-lbl">{d.label}</div><div className="debt-dt">{dateStr(d.date)}</div></div>
                  <div className="debt-right">
                    <div className={`debt-amt ${d.type==="lent"?"tpos":"tneg"}`}>{d.type==="lent"?"+":"-"}{fmt(d.amount)}</div>
                    <button className="settle-btn" onClick={()=>onSettle(f.id,d.id)}>✓ Settle</button>
                  </div>
                </div>
              ))}
              {f.debts.length>3&&<div className="more-tag">+{f.debts.length-3} more transaction{f.debts.length-3>1?"s":""}</div>}
            </div>
            <div className="fr-footer">
              <button className="fr-btn fr-btn-add" onClick={()=>onAddDebt(f)}><span>➕</span>Add Txn</button>
              <button className="fr-btn fr-btn-split" onClick={()=>onSplit(f)}><span>✂️</span>Split Bill</button>
              <button className="fr-btn fr-btn-view" onClick={()=>onViewAll(f)}><span>📄</span>View All</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── VIEW FRIEND MODAL ─────────────────────────────────────────
function ViewFriendModal({friend,onClose,onSettle,onAddDebt,settings}){
  const [showSettled,setShowSettled]=useState(false);
  const net=friend.debts.reduce((a,d)=>a+(d.type==="lent"?d.amount:-d.amount),0);
  const lent=friend.debts.filter(d=>d.type==="lent").reduce((a,d)=>a+d.amount,0);
  const owed=friend.debts.filter(d=>d.type==="owe").reduce((a,d)=>a+d.amount,0);
  const grad=`linear-gradient(135deg,${friend.color}DD,${friend.color}88)`;
  const sendWA=()=>{ const msg=encodeURIComponent(`Hey ${friend.name}! 👋\nReminder: you owe me ${fmt(net)} 🙏\n- Sent via FinTrack`); window.open(`https://wa.me/?text=${msg}`,"_blank"); };
  const sendUPI=()=>{ window.open(`upi://pay?pa=${settings.upiId||"fintrack@upi"}&pn=FinTrack&am=${Math.abs(net).toFixed(2)}&cu=INR&tn=Settlement`); };
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-full">
        <div className="vt-hdr" style={{background:grad}}>
          <button className="vt-close" onClick={onClose}>✕</button>
          <div style={{fontSize:44,marginBottom:10}}>{friend.emoji}</div>
          <div style={{fontSize:22,fontWeight:800,color:"#fff",fontFamily:"'Playfair Display',serif"}}>{friend.name}</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.7)",fontWeight:700,marginTop:4}}>{net>=0?`They owe you ${fmt(net)}`:`You owe ${fmt(-net)}`}</div>
          {net>0&&<div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
            <button className="wa-btn" onClick={sendWA}>💬 WhatsApp Nudge</button>
            <button className="upi-btn" onClick={sendUPI}>💳 UPI Request</button>
          </div>}
        </div>
        <div style={{paddingTop:16,paddingBottom:40}}>
          <div className="vt-sum">
            <div style={{borderRadius:14,padding:"12px 14px",background:"rgba(0,196,140,0.1)"}}>
              <div style={{fontSize:10,fontWeight:800,letterSpacing:1,textTransform:"uppercase",color:"#00A878"}}>You Lent</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#00C48C",marginTop:4}}>{fmt(lent)}</div>
            </div>
            <div style={{borderRadius:14,padding:"12px 14px",background:"rgba(240,78,115,0.1)"}}>
              <div style={{fontSize:10,fontWeight:800,letterSpacing:1,textTransform:"uppercase",color:"#F04E73"}}>You Owe</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#F04E73",marginTop:4}}>{fmt(owed)}</div>
            </div>
          </div>
          <div className="vt-section-label">Active ({friend.debts.length})</div>
          {!friend.debts.length&&<div className="empty-state"><span className="empty-icon">🎉</span><div className="empty-txt">All settled up!</div></div>}
          {friend.debts.map(d=>(
            <div key={d.id} className="vt-all-row">
              <div style={{width:38,height:38,borderRadius:12,background:d.type==="lent"?"rgba(0,196,140,0.12)":"rgba(240,78,115,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{d.type==="lent"?"💵":"🙏"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.label}</div>
                <div style={{fontSize:10,color:"var(--text2)",fontWeight:600,marginTop:2}}>{dateStr(d.date)}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                <div style={{fontSize:14,fontWeight:800,color:d.type==="lent"?"#00C48C":"#F04E73"}}>{d.type==="lent"?"+":"-"}{fmt(d.amount)}</div>
                <button className="settle-btn" onClick={()=>onSettle(friend.id,d.id)}>✓ Settle</button>
              </div>
            </div>
          ))}
          {(friend.settled||[]).length>0&&<>
            <div className="vt-section-label" style={{marginTop:12,display:"flex",justifyContent:"space-between",paddingRight:14}}>
              <span>Settled ({(friend.settled||[]).length})</span>
              <span style={{color:"#4F8EF7",cursor:"pointer"}} onClick={()=>setShowSettled(!showSettled)}>{showSettled?"Hide":"Show"}</span>
            </div>
            {showSettled&&(friend.settled||[]).map((d,i)=>(
              <div key={i} className="vt-all-row" style={{opacity:0.6}}>
                <div style={{width:38,height:38,borderRadius:12,background:"rgba(0,196,140,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>✅</div>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{d.label}</div><div style={{fontSize:10,color:"var(--text2)",fontWeight:600,marginTop:2}}>Settled {d.settledOn?dateStr(d.settledOn):""}</div></div>
                <div style={{fontSize:14,fontWeight:800,color:"var(--text2)"}}>{fmt(d.amount)}</div>
              </div>
            ))}
          </>}
          <div style={{padding:"16px 14px 0"}}><button className="sub-btn" onClick={()=>{onAddDebt();}}>➕ Add New Transaction</button></div>
        </div>
      </div>
    </div>
  );
}

// ── BILLS & EMI TAB ───────────────────────────────────────────
function BillsEMITab({bills,emis,onDelBill,onDelEmi,setModal}){
  const [viewTab,setViewTab]=useState("bills");
  const billTotal=bills.reduce((s,b)=>s+b.amount,0);
  const emiTotal=emis.reduce((s,e)=>s+e.amount,0);
  return(<>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,padding:"4px 14px 14px"}}>
      <div style={{background:"linear-gradient(135deg,#1A1D3B,#2D3164)",borderRadius:16,padding:"14px 16px",boxShadow:"0 6px 18px rgba(26,29,59,0.3)"}}>
        <div style={{fontSize:10,fontWeight:800,letterSpacing:1,textTransform:"uppercase",color:"rgba(255,255,255,0.6)"}}>Monthly Bills</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#fff",marginTop:4}}>{fmt(billTotal)}</div>
      </div>
      <div style={{background:"linear-gradient(135deg,#F04E73,#CC2E57)",borderRadius:16,padding:"14px 16px",boxShadow:"0 6px 18px rgba(240,78,115,0.3)"}}>
        <div style={{fontSize:10,fontWeight:800,letterSpacing:1,textTransform:"uppercase",color:"rgba(255,255,255,0.6)"}}>Monthly EMIs</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,color:"#fff",marginTop:4}}>{fmt(emiTotal)}</div>
      </div>
    </div>
    <div style={{display:"flex",gap:8,padding:"0 14px 14px"}}>
      {["bills","emis"].map(t=>(
        <button key={t} onClick={()=>setViewTab(t)} style={{flex:1,padding:"9px",borderRadius:12,border:"2px solid var(--border)",background:viewTab===t?"linear-gradient(135deg,#1A1D3B,#2D3164)":"var(--card)",color:viewTab===t?"#fff":"var(--text2)",fontWeight:800,fontSize:12,cursor:"pointer",fontFamily:"'Nunito',sans-serif"}}>
          {t==="bills"?"📋 Bills":"💳 EMIs"}
        </button>
      ))}
    </div>
    {viewTab==="bills"&&(
      <>
        <div className="card">
          {!bills.length&&<div className="empty-state"><span className="empty-icon">📋</span><div className="empty-txt">No bills tracked</div></div>}
          {bills.map(b=>{
            let d=b.dueDay-todayD;if(d<0)d+=31;
            const ord=["st","nd","rd"][((b.dueDay+90)%100-10)%10-1]||"th";
            return(
              <div key={b.id} className="bill-row">
                <div className="bill-icon" style={{background:b.color+"18"}}>{b.icon}</div>
                <div className="bill-body">
                  <div className="bill-name">{b.name}</div>
                  <div className="bill-due">Due {b.dueDay}{ord} monthly{b.autoLog?" · Auto-logged":""}</div>
                  <div className={`bill-bdg ${d===0?"b-red":d<=3?"b-amber":"b-green"}`}>{d===0?"🔴 Today":d<=3?`🟡 ${d}d left`:`🟢 In ${d} days`}</div>
                </div>
                <div className="bill-right">
                  <div className="bill-amt">{fmt(b.amount)}</div>
                  <button className="icn-btn" onClick={()=>onDelBill(b.id)} style={{marginTop:4}}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{padding:"0 14px"}}><button className="sub-btn" onClick={()=>setModal("emi")} style={{background:"linear-gradient(135deg,#F04E73,#CC2E57)",boxShadow:"0 6px 18px rgba(240,78,115,0.3)"}}>+ Add EMI / Loan</button></div>
      </>
    )}
    {viewTab==="emis"&&(
      <div className="card">
        {!emis.length&&<div className="empty-state"><span className="empty-icon">💳</span><div className="empty-txt">No EMIs tracked</div></div>}
        {emis.map(e=>{
          const rem=e.totalMonths-e.paidMonths;
          const pct=Math.round((e.paidMonths/e.totalMonths)*100);
          const endDate=new Date(new Date(e.startDate).getTime()+e.totalMonths*30*864e5);
          return(
            <div key={e.id} className="bill-row" style={{flexDirection:"column",alignItems:"flex-start",gap:8}}>
              <div style={{display:"flex",alignItems:"center",gap:12,width:"100%"}}>
                <div className="bill-icon" style={{background:e.color+"18"}}>{e.icon}</div>
                <div style={{flex:1}}>
                  <div className="bill-name">{e.name}</div>
                  <div className="bill-due">{e.bank} · Ends {dateStr(endDate.toISOString())}</div>
                </div>
                <div className="bill-right">
                  <div className="bill-amt">{fmt(e.amount)}/mo</div>
                  <button className="icn-btn" onClick={()=>onDelEmi(e.id)} style={{marginTop:4}}>✕</button>
                </div>
              </div>
              <div style={{width:"100%",paddingLeft:58}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:11,fontWeight:700,color:"var(--text2)"}}>{e.paidMonths}/{e.totalMonths} paid · {rem} left</span>
                  <span style={{fontSize:11,fontWeight:800,color:e.color}}>{pct}%</span>
                </div>
                <div className="emi-progress"><div className="emi-fill" style={{width:`${pct}%`,background:e.color}}/></div>
                <div style={{fontSize:10,fontWeight:700,color:"var(--text2)",marginTop:4}}>Remaining: {fmt(e.amount*rem)}</div>
              </div>
            </div>
          );
        })}
      </div>
    )}
  </>);
}

// ── ANALYTICS TAB ─────────────────────────────────────────────
const CHART_COLORS=["#4F8EF7","#F04E73","#F5A623","#00C48C","#7B5EFB","#FF6B35","#1CB5E0","#E91E63","#9C27B0","#8E8EA9"];

function AnalyticsTab({expenses,budgets,settings}){
  const [selMonth,setSelMonth]=useState(thisMonth);
  const months=useMemo(()=>{const s=new Set();expenses.forEach(e=>s.add(mkStr(e.date)));return [...s];},[expenses]);
  const filtered=expenses.filter(e=>e.type==="expense"&&(!selMonth||mkStr(e.date)===selMonth));
  const catMap={};
  filtered.forEach(e=>{catMap[e.category]=(catMap[e.category]||0)+e.amount;});
  const pieData=Object.entries(catMap).map(([k,v])=>({name:CATS[k]?.label||k,value:v,icon:CATS[k]?.icon})).sort((a,b)=>b.value-a.value);
  const barData=useMemo(()=>{
    const result=[];
    for(let i=5;i>=0;i--){
      const d=new Date(todayDate.getFullYear(),todayDate.getMonth()-i,1);
      const mk=mkStr(d);
      result.push({
        month:d.toLocaleDateString("en-IN",{month:"short"}),
        Expense:Math.round(expenses.filter(e=>e.type==="expense"&&mkStr(e.date)===mk).reduce((s,e)=>s+e.amount,0)),
        Income:Math.round(expenses.filter(e=>e.type==="income"&&mkStr(e.date)===mk).reduce((s,e)=>s+e.amount,0)),
      });
    }
    return result;
  },[expenses]);
  const modeMap={};
  filtered.forEach(e=>{modeMap[e.paymentMode||"UPI"]=(modeMap[e.paymentMode||"UPI"]||0)+e.amount;});
  const modeData=Object.entries(modeMap).sort((a,b)=>b[1]-a[1]);
  const modeTotal=modeData.reduce((s,[,v])=>s+v,0);
  const prevMonth=mkStr(new Date(todayDate.getFullYear(),todayDate.getMonth()-1,1));
  const curSpend=expenses.filter(e=>e.type==="expense"&&mkStr(e.date)===thisMonth).reduce((s,e)=>s+e.amount,0);
  const prevSpend=expenses.filter(e=>e.type==="expense"&&mkStr(e.date)===prevMonth).reduce((s,e)=>s+e.amount,0);
  const change=prevSpend>0?Math.round(((curSpend-prevSpend)/prevSpend)*100):0;
  const totalGst=filtered.reduce((s,e)=>s+(e.gst||0),0);
  return(<>
    <div className="month-scroll">{months.map(m=><div key={m} className={`mchip${selMonth===m?" on":""}`} onClick={()=>setSelMonth(selMonth===m?"":m)}>{m}</div>)}</div>
    <div className="analytics-card">
      <div className="chart-title">Smart Insights</div>
      {[
        {icon:"📈",text:`vs last month: ${Math.abs(change)}% ${change>0?"increase":"decrease"} in spending`,badge:change>0?"up":"down"},
        {icon:"💰",text:`GST paid this period: ${fmt(totalGst)}`,badge:"neu"},
        {icon:"🏆",text:`Top category: ${pieData[0]?.name||"N/A"} — ${fmt(pieData[0]?.value||0)}`,badge:"neu"},
        {icon:"💳",text:`Most used payment: ${modeData[0]?.[0]||"UPI"} (${modeData[0]?fmt(modeData[0][1]):"₹0"})`,badge:"neu"},
      ].map((ins,i)=>(
        <div key={i} className="insight-row">
          <div className="insight-icon">{ins.icon}</div>
          <div className="insight-text">{ins.text}</div>
          <div className={`insight-badge ib-${ins.badge}`}>{ins.badge==="up"?"↑":ins.badge==="down"?"↓":"•"}</div>
        </div>
      ))}
    </div>
    {pieData.length>0&&(
      <div className="analytics-card">
        <div className="chart-title">Category Breakdown</div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
              {pieData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
            </Pie>
            <Tooltip formatter={(v)=>fmt(v)} contentStyle={{borderRadius:10,fontFamily:"Nunito",fontSize:12}}/>
          </PieChart>
        </ResponsiveContainer>
        <div style={{display:"flex",flexWrap:"wrap",gap:"6px 14px",marginTop:8}}>
          {pieData.map((d,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,color:"var(--text)"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:CHART_COLORS[i%CHART_COLORS.length],flexShrink:0}}/>
              {d.icon} {d.name}
            </div>
          ))}
        </div>
      </div>
    )}
    <div className="analytics-card">
      <div className="chart-title">6-Month Trend</div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={barData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
          <XAxis dataKey="month" tick={{fontSize:11,fontFamily:"Nunito",fill:"var(--text2)"}} axisLine={false} tickLine={false}/>
          <YAxis tick={{fontSize:10,fontFamily:"Nunito",fill:"var(--text2)"}} axisLine={false} tickLine={false} tickFormatter={fmtC} width={48}/>
          <Tooltip formatter={(v)=>fmt(v)} contentStyle={{borderRadius:10,fontFamily:"Nunito",fontSize:12}}/>
          <Bar dataKey="Income" fill="#00C48C" radius={[4,4,0,0]}/>
          <Bar dataKey="Expense" fill="#F04E73" radius={[4,4,0,0]}/>
        </BarChart>
      </ResponsiveContainer>
      <div style={{display:"flex",gap:16,marginTop:8,justifyContent:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,color:"#00C48C"}}><div style={{width:10,height:10,borderRadius:3,background:"#00C48C"}}/>Income</div>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,color:"#F04E73"}}><div style={{width:10,height:10,borderRadius:3,background:"#F04E73"}}/>Expense</div>
      </div>
    </div>
    {modeData.length>0&&(
      <div className="analytics-card">
        <div className="chart-title">Payment Modes</div>
        {modeData.map(([mode,amt])=>(
          <div key={mode} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:12,fontWeight:700,color:"var(--text)"}}>{mode}</span>
              <span style={{fontSize:12,fontWeight:800,color:"var(--text)"}}>{fmt(amt)} · {Math.round(amt/modeTotal*100)}%</span>
            </div>
            <div style={{height:6,background:"var(--border)",borderRadius:10,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${Math.round(amt/modeTotal*100)}%`,background:"linear-gradient(90deg,#4F8EF7,#7B5EFB)",borderRadius:10}}/>
            </div>
          </div>
        ))}
      </div>
    )}
  </>);
}

// ── SETTINGS ──────────────────────────────────────────────────
function SettingsScreen({settings,setSettings,budgets,onBudget,expenses,onClose,onPinChange}){
  const upd=(k,v)=>setSettings(s=>({...s,[k]:v}));
  return(
    <div className="settings-wrap">
      <div className="settings-hdr">
        <button className="settings-back" onClick={onClose}>←</button>
        <h1>Settings</h1>
      </div>
      <div style={{padding:"20px 0 80px"}}>
        <div className="settings-section">
          <div className="settings-sec-title">Profile</div>
          <div className="settings-row">
            <span className="settings-icon">💰</span>
            <span className="settings-label">Monthly Income</span>
            <input type="number" value={settings.monthlyIncome} onChange={e=>upd("monthlyIncome",parseFloat(e.target.value)||0)}
              style={{background:"var(--input)",border:"2px solid var(--border)",borderRadius:10,padding:"6px 10px",fontSize:13,fontWeight:700,color:"var(--text)",outline:"none",width:110,fontFamily:"Nunito",textAlign:"right"}}/>
          </div>
          <div className="settings-row">
            <span className="settings-icon">📱</span>
            <span className="settings-label">UPI ID</span>
            <input value={settings.upiId||""} onChange={e=>upd("upiId",e.target.value)} placeholder="name@upi"
              style={{background:"var(--input)",border:"2px solid var(--border)",borderRadius:10,padding:"6px 10px",fontSize:12,fontWeight:700,color:"var(--text)",outline:"none",width:130,fontFamily:"Nunito",textAlign:"right"}}/>
          </div>
          <div className="settings-row" style={{borderRadius:"0 0 16px 16px",borderBottom:"none"}}>
            <span className="settings-icon">📅</span>
            <span className="settings-label">Payday (date)</span>
            <input type="number" min="1" max="31" value={settings.payday||1} onChange={e=>upd("payday",parseInt(e.target.value)||1)}
              style={{background:"var(--input)",border:"2px solid var(--border)",borderRadius:10,padding:"6px 10px",fontSize:13,fontWeight:700,color:"var(--text)",outline:"none",width:60,fontFamily:"Nunito",textAlign:"right"}}/>
          </div>
        </div>
        <div className="settings-section">
          <div className="settings-sec-title">Preferences</div>
          <div className="settings-row">
            <span className="settings-icon">🌙</span>
            <span className="settings-label">Dark Mode</span>
            <div className={`toggle${settings.darkMode?" on":""}`} onClick={()=>upd("darkMode",!settings.darkMode)}><div className="toggle-thumb"/></div>
          </div>
          <div className="settings-row" style={{borderRadius:"0 0 16px 16px",borderBottom:"none"}}>
            <span className="settings-icon">🔐</span>
            <span className="settings-label">App PIN {settings.pin?"(Active)":"(Not set)"}</span>
            <button onClick={onPinChange} style={{background:"rgba(79,142,247,0.12)",border:"1.5px solid rgba(79,142,247,0.3)",borderRadius:10,padding:"6px 12px",fontSize:11,fontWeight:800,color:"#4F8EF7",cursor:"pointer",fontFamily:"Nunito"}}>
              {settings.pin?"Change":"Set PIN"}
            </button>
          </div>
        </div>
        <div className="settings-section">
          <div className="settings-sec-title">Data</div>
          <div className="settings-row" onClick={onBudget} style={{cursor:"pointer"}}>
            <span className="settings-icon">📊</span>
            <span className="settings-label">Manage Budgets</span>
            <span className="settings-value">→</span>
          </div>
          <div className="settings-row" style={{borderRadius:"0 0 16px 16px",borderBottom:"none",cursor:"pointer"}} onClick={()=>exportCSV(expenses)}>
            <span className="settings-icon">📤</span>
            <span className="settings-label">Export to CSV</span>
            <span className="settings-value">Download</span>
          </div>
        </div>
        <div className="settings-section">
          <div className="settings-sec-title">About</div>
          <div className="settings-row" style={{borderRadius:16,borderBottom:"none"}}>
            <span className="settings-icon">ℹ️</span>
            <span className="settings-label">FinTrack v2.0</span>
            <span className="settings-value">All 33 features ✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MODALS ────────────────────────────────────────────────────
function ExpenseModal({onClose,onSave,initial,isEdit}){
  const [type,setType]=useState(initial?.type||"expense");
  const [title,setTitle]=useState(initial?.title||"");
  const [amount,setAmount]=useState(initial?.amount||"");
  const [category,setCategory]=useState(initial?.category||"food");
  const [paymentMode,setPaymentMode]=useState(initial?.paymentMode||"UPI");
  const [gst,setGst]=useState(initial?.gst||"");
  const [note,setNote]=useState(initial?.note||"");
  const [incomeType,setIncomeType]=useState(initial?.incomeType||"Salary");
  const handleTitle=(v)=>{setTitle(v);if(!isEdit)setCategory(autoCategory(v));};
  const save=()=>{if(!title||!amount)return;onSave({...(initial||{}),title,amount:parseFloat(amount),type,category,paymentMode,gst:parseFloat(gst)||0,note,incomeType});onClose();};
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="m-handle"/>
        <div className="m-title">{isEdit?"Edit Transaction":"New Transaction"}</div>
        <div className="type-row">
          <button className={`type-btn te${type==="expense"?" on":""}`} onClick={()=>setType("expense")}>💸 Expense</button>
          <button className={`type-btn ti${type==="income"?" on":""}`} onClick={()=>setType("income")}>💰 Income</button>
        </div>
        <div className="field"><label>Title (auto-categorizes)</label><input placeholder="Swiggy, Jio, BESCOM..." value={title} onChange={e=>handleTitle(e.target.value)}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div className="field"><label>Amount (₹)</label><input type="number" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
          <div className="field"><label>GST (₹)</label><input type="number" placeholder="0" value={gst} onChange={e=>setGst(e.target.value)}/></div>
        </div>
        {type==="income"&&<div className="field"><label>Income Type</label><select value={incomeType} onChange={e=>setIncomeType(e.target.value)}>{INCOME_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>}
        {type==="expense"&&<div className="field"><label>Category</label><div className="cat-grid">{Object.entries(CATS).map(([k,v])=><div key={k} className={`cat-chip${category===k?" sel":""}`} onClick={()=>setCategory(k)}><span>{v.icon}</span><span>{v.label.split(" ")[0]}</span></div>)}</div></div>}
        <div className="field"><label>Payment Mode</label><select value={paymentMode} onChange={e=>setPaymentMode(e.target.value)}>{PAYMENT_MODES.map(m=><option key={m}>{m}</option>)}</select></div>
        <div className="field"><label>Note</label><textarea placeholder="Optional..." value={note} onChange={e=>setNote(e.target.value)} rows={2}/></div>
        <button className="sub-btn" onClick={save}>{isEdit?"Save Changes":"Add Transaction"}</button>
      </div>
    </div>
  );
}

function FriendModal({onClose,onSave}){
  const [name,setName]=useState("");
  const COLORS=["#4F8EF7","#F04E73","#00C48C","#F5A623","#7B5EFB","#FF6B35"];
  const EMOJIS=["👤","👩","👨","🧑","👧","👦","🧑‍💼","👩‍💼"];
  const [color,setColor]=useState(COLORS[0]);
  const [emoji,setEmoji]=useState(EMOJIS[0]);
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="m-handle"/>
        <div className="m-title">Add Friend</div>
        <div className="field"><label>Name</label><input placeholder="Friend's name" value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="field"><label>Avatar</label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{EMOJIS.map(em=><div key={em} onClick={()=>setEmoji(em)} style={{width:42,height:42,borderRadius:"50%",background:color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,cursor:"pointer",border:emoji===em?`2.5px solid ${color}`:"2.5px solid var(--border)"}}>{em}</div>)}</div></div>
        <div className="field"><label>Color</label><div style={{display:"flex",gap:10}}>{COLORS.map(c=><div key={c} onClick={()=>setColor(c)} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:color===c?"3px solid var(--text)":"3px solid transparent"}}/>)}</div></div>
        <button className="sub-btn" onClick={()=>{if(!name)return;onSave({name,color,emoji});onClose();}}>Add Friend</button>
      </div>
    </div>
  );
}

function DebtModal({friend,onClose,onSave}){
  const [label,setLabel]=useState("");
  const [amount,setAmount]=useState("");
  const [type,setType]=useState("lent");
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="m-handle"/>
        <div className="m-title">Log with {friend.name}</div>
        <div className="type-row">
          <button className={`type-btn tl${type==="lent"?" on":""}`} onClick={()=>setType("lent")}>💵 I Lent</button>
          <button className={`type-btn to2${type==="owe"?" on":""}`} onClick={()=>setType("owe")}>🙏 I Owe</button>
        </div>
        <div className="field"><label>What for?</label><input placeholder="Dinner, auto, movie..." value={label} onChange={e=>setLabel(e.target.value)}/></div>
        <div className="field"><label>Amount (₹)</label><input type="number" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
        <button className="sub-btn" onClick={()=>{if(!label||!amount)return;onSave({label,amount:parseFloat(amount),type});onClose();}}>Save</button>
      </div>
    </div>
  );
}

function SplitModal({friends,onClose,onSave}){
  const [label,setLabel]=useState("");
  const [total,setTotal]=useState("");
  const [selected,setSelected]=useState([]);
  const toggle=(id)=>setSelected(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  const share=selected.length>0?Math.round((parseFloat(total)||0)/selected.length*100)/100:0;
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="m-handle"/>
        <div className="m-title">Split Bill</div>
        <div className="field"><label>What for?</label><input placeholder="Goa trip, dinner..." value={label} onChange={e=>setLabel(e.target.value)}/></div>
        <div className="field"><label>Total Amount (₹)</label><input type="number" placeholder="0.00" value={total} onChange={e=>setTotal(e.target.value)}/></div>
        <div className="field">
          <label>Split with</label>
          {friends.map(f=>(
            <div key={f.id} className="split-friend-row">
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                <div style={{width:36,height:36,borderRadius:12,background:f.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{f.emoji}</div>
                <div><div style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{f.name}</div><div style={{fontSize:11,color:"var(--text2)",fontWeight:600}}>Share: {fmt(share)}</div></div>
              </div>
              <div className={`split-chk${selected.includes(f.id)?" chk":""}`} onClick={()=>toggle(f.id)}>{selected.includes(f.id)?"✓":""}</div>
            </div>
          ))}
        </div>
        <div style={{background:"rgba(79,142,247,0.08)",borderRadius:12,padding:"12px 14px",marginBottom:10,fontSize:13,fontWeight:700,color:"#4F8EF7",textAlign:"center"}}>
          {selected.length} friends · Each owes {fmt(share)}
        </div>
        <button className="sub-btn" onClick={()=>{if(!label||!total||!selected.length)return;onSave(selected,label,parseFloat(total));onClose();}}>Split & Log</button>
      </div>
    </div>
  );
}

function BillModal({onClose,onSave}){
  const [name,setName]=useState("");
  const [amount,setAmount]=useState("");
  const [dueDay,setDueDay]=useState("1");
  const [icon,setIcon]=useState("💳");
  const [color,setColor]=useState("#4F8EF7");
  const [autoLog,setAutoLog]=useState(false);
  const ICONS=["💳","🏠","⚡","💧","📡","🎵","📱","🏥","🚗","📺","🌐","💼"];
  const COLORS=["#4F8EF7","#00C48C","#7B5EFB","#F5A623","#F04E73","#FF6B35"];
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="m-handle"/>
        <div className="m-title">Add Recurring Bill</div>
        <div className="field"><label>Icon</label><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{ICONS.map(ic=><div key={ic} onClick={()=>setIcon(ic)} style={{width:40,height:40,borderRadius:12,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,cursor:"pointer",border:icon===ic?`2px solid ${color}`:"2px solid var(--border)"}}>{ic}</div>)}</div></div>
        <div className="field"><label>Bill Name</label><input placeholder="Rent, BESCOM, Netflix..." value={name} onChange={e=>setName(e.target.value)}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div className="field"><label>Amount (₹)</label><input type="number" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
          <div className="field"><label>Due Day</label><input type="number" min="1" max="31" value={dueDay} onChange={e=>setDueDay(e.target.value)}/></div>
        </div>
        <div className="field"><label>Color</label><div style={{display:"flex",gap:8}}>{COLORS.map(c=><div key={c} onClick={()=>setColor(c)} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:color===c?"3px solid var(--text)":"3px solid transparent"}}/>)}</div></div>
        <div style={{display:"flex",alignItems:"center",background:"var(--input)",border:"2px solid var(--border)",borderRadius:13,padding:"12px 14px",marginBottom:12,cursor:"pointer"}} onClick={()=>setAutoLog(!autoLog)}>
          <span style={{flex:1,fontSize:13,fontWeight:700,color:"var(--text)"}}>🔄 Auto-log as expense</span>
          <div className={`toggle${autoLog?" on":""}`}><div className="toggle-thumb"/></div>
        </div>
        <button className="sub-btn" onClick={()=>{if(!name||!amount)return;onSave({name,amount:parseFloat(amount),dueDay:parseInt(dueDay),icon,color,autoLog});onClose();}}>Add Bill</button>
      </div>
    </div>
  );
}

function EMIModal({onClose,onSave}){
  const [name,setName]=useState("");
  const [amount,setAmount]=useState("");
  const [totalMonths,setTotalMonths]=useState("12");
  const [paidMonths,setPaidMonths]=useState("0");
  const [bank,setBank]=useState("");
  const [icon,setIcon]=useState("💳");
  const [color,setColor]=useState("#F04E73");
  const ICONS=["💳","📱","🏠","🚗","🖥️","📷","🛒","💎"];
  const BANKS=["HDFC Bank","ICICI Bank","SBI","Axis Bank","Kotak","Yes Bank","IDFC","IndusInd","Other"];
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="m-handle"/>
        <div className="m-title">Add EMI / Loan</div>
        <div className="field"><label>Icon</label><div style={{display:"flex",gap:7}}>{ICONS.map(ic=><div key={ic} onClick={()=>setIcon(ic)} style={{width:38,height:38,borderRadius:11,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,cursor:"pointer",border:icon===ic?`2px solid ${color}`:"2px solid var(--border)"}}>{ic}</div>)}</div></div>
        <div className="field"><label>EMI Name</label><input placeholder="iPhone 15, Home Loan..." value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="field"><label>Bank / Lender</label><select value={bank} onChange={e=>setBank(e.target.value)}><option value="">Select bank...</option>{BANKS.map(b=><option key={b}>{b}</option>)}</select></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          <div className="field"><label>Monthly (₹)</label><input type="number" placeholder="0" value={amount} onChange={e=>setAmount(e.target.value)}/></div>
          <div className="field"><label>Total Months</label><input type="number" placeholder="12" value={totalMonths} onChange={e=>setTotalMonths(e.target.value)}/></div>
          <div className="field"><label>Paid Months</label><input type="number" placeholder="0" value={paidMonths} onChange={e=>setPaidMonths(e.target.value)}/></div>
        </div>
        <div style={{background:"rgba(240,78,115,0.08)",borderRadius:12,padding:"10px 14px",marginBottom:10,fontSize:13,fontWeight:700,color:"#F04E73",textAlign:"center"}}>
          Total: {fmt((parseFloat(amount)||0)*parseInt(totalMonths||0))} · Remaining: {fmt((parseFloat(amount)||0)*(parseInt(totalMonths||0)-parseInt(paidMonths||0)))}
        </div>
        <button className="sub-btn" onClick={()=>{if(!name||!amount)return;onSave({name,amount:parseFloat(amount),totalMonths:parseInt(totalMonths),paidMonths:parseInt(paidMonths),bank,icon,color,startDate:new Date().toISOString()});onClose();}}>Add EMI</button>
      </div>
    </div>
  );
}

function EventModal({onClose,onSave}){
  const [name,setName]=useState("");
  const [budget,setBudget]=useState("");
  const [icon,setIcon]=useState("🎉");
  const [color,setColor]=useState("#F5A623");
  const [endDate,setEndDate]=useState(new Date(Date.now()+30*864e5).toISOString().slice(0,10));
  const ICONS=["🎉","🪔","💒","🏖️","✈️","🎂","🛍️","🎓","🏆","🎊"];
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="m-handle"/>
        <div className="m-title">Special Event Budget</div>
        <div className="field"><label>Icon</label><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{ICONS.map(ic=><div key={ic} onClick={()=>setIcon(ic)} style={{width:38,height:38,borderRadius:11,background:color+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,cursor:"pointer",border:icon===ic?`2px solid ${color}`:"2px solid var(--border)"}}>{ic}</div>)}</div></div>
        <div className="field"><label>Event Name</label><input placeholder="Diwali, Wedding, Trip..." value={name} onChange={e=>setName(e.target.value)}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div className="field"><label>Budget (₹)</label><input type="number" placeholder="15000" value={budget} onChange={e=>setBudget(e.target.value)}/></div>
          <div className="field"><label>End Date</label><input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></div>
        </div>
        <button className="sub-btn" onClick={()=>{if(!name||!budget)return;onSave({name,budget:parseFloat(budget),icon,color,startDate:new Date().toISOString(),endDate:new Date(endDate).toISOString()});onClose();}}>Create Event</button>
      </div>
    </div>
  );
}

function BudgetModal({budgets,onClose,onSave}){
  const [local,setLocal]=useState({...budgets});
  const upd=(k,v)=>setLocal(p=>({...p,[k]:parseFloat(v)||0}));
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="m-handle"/>
        <div className="m-title">Monthly Budgets</div>
        {Object.entries(CATS).map(([k,v])=>(
          <div key={k} className="field">
            <label>{v.icon} {v.label}</label>
            <input type="number" placeholder="0 = no limit" value={local[k]||""} onChange={e=>upd(k,e.target.value)}/>
          </div>
        ))}
        <button className="sub-btn" onClick={()=>{onSave(local);onClose();}}>Save Budgets</button>
      </div>
    </div>
  );
}

function SMSModal({onClose,onImport}){
  const [raw,setRaw]=useState("");
  const [parsed,setParsed]=useState([]);
  const [step,setStep]=useState("input");
  const parse=()=>{const r=parseSMS(raw);setParsed(r);setStep(r.length?"confirm":"empty");};
  return(
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="m-handle"/>
        <div className="m-title">📩 Import from SMS</div>
        {step==="input"&&<>
          <div style={{fontSize:13,fontWeight:600,color:"var(--text2)",marginBottom:12,lineHeight:1.5}}>Paste bank SMS messages. FinTrack auto-detects debits, credits & merchants.</div>
          <textarea className="sms-area" placeholder={"Your a/c XXXX debited for Rs.420 at Swiggy on 15-Jun\nINR 65,000 credited - Salary\nUPI: Rs.180 debited for Uber"} value={raw} onChange={e=>setRaw(e.target.value)} rows={8}/>
          <button className="sub-btn" onClick={parse} style={{marginTop:12}}>Parse Messages</button>
        </>}
        {step==="empty"&&<div className="empty-state"><span className="empty-icon">🔍</span><div className="empty-txt">No transactions detected.<br/>Try more SMS lines.</div><button className="sub-btn-sec" onClick={()=>setStep("input")} style={{marginTop:12}}>← Try Again</button></div>}
        {step==="confirm"&&<>
          <div style={{fontSize:13,fontWeight:700,color:"var(--text2)",marginBottom:12}}>{parsed.length} transactions found:</div>
          {parsed.map((t,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:"var(--input)",borderRadius:10,marginBottom:6}}>
              <div><div style={{fontSize:12,fontWeight:700,color:"var(--text)"}}>{t.title}</div><div style={{fontSize:10,color:"var(--text2)",fontWeight:600,marginTop:2}}>{CATS[t.category]?.icon} {CATS[t.category]?.label}</div></div>
              <div style={{fontSize:12,fontWeight:800,color:t.type==="expense"?"#F04E73":"#00C48C"}}>{t.type==="expense"?"-":"+"}{fmt(t.amount)}</div>
            </div>
          ))}
          <button className="sub-btn" onClick={()=>onImport(parsed)} style={{marginTop:12}}>Import All ({parsed.length})</button>
          <button className="sub-btn-sec" onClick={()=>setStep("input")}>← Edit</button>
        </>}
      </div>
    </div>
  );
}

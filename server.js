const path = require('path');
const fs = require('fs');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5056;
const PUBLIC_DIR = __dirname;
const DB_PATH = path.join(__dirname, 'tickets.db');

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

// Ensure DB and table
const db = new sqlite3.Database(DB_PATH);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    type TEXT,
    target TEXT,
    date TEXT,
    tickets INTEGER,
    pay TEXT,
    price REAL,
    status TEXT DEFAULT 'Confirmed',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT,
    bookingId TEXT,
    serviceType TEXT,
    platform TEXT,
    rating INTEGER,
    message TEXT,
    date TEXT,
    location TEXT,
    sentiment TEXT,
    confidence REAL,
    category TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS reset_tokens (
    id TEXT PRIMARY KEY,
    email TEXT,
    token TEXT,
    expires_at TEXT,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
});

// Best-effort add columns for existing DBs
db.run(`ALTER TABLE feedback ADD COLUMN confidence REAL`, ()=>{});
db.run(`ALTER TABLE feedback ADD COLUMN category TEXT`, ()=>{});

function makeId(){ return 'TKT' + Math.random().toString(36).slice(2,8).toUpperCase(); }
function makeFeedbackId(){ return 'FDB' + Math.random().toString(36).slice(2,8).toUpperCase(); }
function makeToken(){ return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2); }

// Mailer (Ethereal test account)
let mailerReady=false, transporter=null; let etherealPreviewBase='';
async function getTransporter(){
  if(mailerReady && transporter) return transporter;
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
  mailerReady=true; return transporter;
}

// API: create booking
app.post('/api/book', (req, res) => {
  const p = req.body || {};
  const id = p.id || makeId();
  const stmt = db.prepare(`INSERT INTO bookings (id,name,email,type,target,date,tickets,pay,price,status)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  stmt.run(
    id,
    p.name || '',
    p.email || '',
    p.type || '',
    p.target || '',
    p.date || '',
    Number(p.tickets||1),
    p.pay || '',
    Number(p.price||0),
    'Confirmed',
    (err)=>{
      if(err){ console.error(err); return res.status(500).json({ok:false,error:'db'}); }
      res.json({ok:true,id});
    }
  );
});

// API: list tickets (optional email filter)
app.get('/api/tickets', (req, res) => {
  const { email } = req.query;
  const sql = email ? `SELECT * FROM bookings WHERE email = ? ORDER BY created_at DESC` : `SELECT * FROM bookings ORDER BY created_at DESC`;
  const params = email ? [email] : [];
  db.all(sql, params, (err, rows) => {
    if(err){ console.error(err); return res.status(500).json({ok:false}); }
    res.json({ok:true, tickets: rows});
  });
});

// API: cancel ticket
app.patch('/api/tickets/:id/cancel', (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE bookings SET status='Canceled' WHERE id=?`, [id], function(err){
    if(err){ console.error(err); return res.status(500).json({ok:false}); }
    res.json({ok:true, updated: this.changes});
  });
});

// API: admin summary
app.get('/api/summary', (req, res) => {
  db.all(`SELECT * FROM bookings`, [], (err, rows)=>{
    if(err){ console.error(err); return res.status(500).json({ok:false}); }
    const total = rows.length;
    const revenue = rows.reduce((a,b)=>a+Number(b.price||0),0);
    const byType = rows.reduce((m,t)=>{m[t.type]=(m[t.type]||0)+1;return m;},{});
    const byDay = rows.reduce((m,t)=>{m[t.date]=(m[t.date]||0)+1;return m;},{});
    const byMonth = rows.reduce((m,t)=>{const k=(t.date||'').slice(0,7); if(!k) return m; m[k]=(m[k]||0)+Number(t.price||0); return m;},{});
    res.json({ok:true, total, revenue, byType, byDay, byMonth, rows});
  });
});

// --- Feedback APIs ---
function detectSentiment(msg=''){
  const s = (msg||'').toLowerCase();
  const pos = ['good','great','excellent','love','nice','amazing','smooth','fast','easy','helpful','responsive','quick'];
  const neg = ['bad','poor','terrible','slow','hate','issue','problem','bug','worst','crash','delay'];
  let score=0; pos.forEach(w=>{ if(s.includes(w)) score+=1; }); neg.forEach(w=>{ if(s.includes(w)) score-=1; });
  const label = score>0 ? 'Positive' : score<0 ? 'Negative' : 'Neutral';
  const max=6; const conf = Math.min(0.99, Math.max(0.5, Math.abs(score)/max + (label==='Neutral'?0.05:0))); // 0.5..0.99
  return { label, confidence: Number(conf.toFixed(2)) };
}

function categorize(msg=''){
  const s=(msg||'').toLowerCase();
  const cats={
    UI:['ui','interface','design','layout','button','color','screen'],
    Performance:['slow','lag','performance','speed','loading','crash'],
    Support:['support','help','agent','call','response','service'],
    Features:['feature','option','add','missing','would like','request']
  };
  let best='Other', hits=0;
  Object.entries(cats).forEach(([k,words])=>{ const c=words.reduce((a,w)=>a+(s.includes(w)?1:0),0); if(c>hits){hits=c; best=k;} });
  return best;
}

app.post('/api/feedback', (req,res)=>{
  const p = req.body||{};
  const id = p.id || makeFeedbackId();
  const sent = p.sentiment ? {label:p.sentiment, confidence: p.confidence||0.9} : detectSentiment(p.message||'');
  const category = p.category || categorize(p.message||'');
  const stmt = db.prepare(`INSERT INTO feedback (id,name,email,bookingId,serviceType,platform,rating,message,date,location,sentiment,confidence,category)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  stmt.run(
    id,
    p.name||'',
    p.email||'',
    p.bookingId||'',
    p.serviceType||'',
    p.platform||'',
    Number(p.rating||0),
    p.message||'',
    p.date||'',
    p.location||'',
    sent.label,
    Number(sent.confidence||0),
    category,
    (err)=>{
      if(err){ console.error(err); return res.status(500).json({ok:false,error:'db'}); }
      res.json({ok:true, id, sentiment: sent.label, confidence: sent.confidence, category});
    }
  );
});

app.get('/api/feedback', (req,res)=>{
  const { email } = req.query;
  const sql = email ? `SELECT * FROM feedback WHERE email = ? ORDER BY created_at DESC` : `SELECT * FROM feedback ORDER BY created_at DESC`;
  const params = email ? [email] : [];
  db.all(sql, params, (err, rows)=>{
    if(err){ console.error(err); return res.status(500).json({ok:false}); }
    res.json({ok:true, feedback: rows});
  });
});

app.get('/api/feedback-summary', (req,res)=>{
  db.all(`SELECT * FROM feedback`, [], (err, rows)=>{
    if(err){ console.error(err); return res.status(500).json({ok:false}); }
    const total = rows.length;
    const avgRating = total? (rows.reduce((a,b)=>a+Number(b.rating||0),0)/total).toFixed(2):0;
    const sentiments = rows.reduce((m,t)=>{m[t.sentiment]=(m[t.sentiment]||0)+1; return m;},{Positive:0,Negative:0,Neutral:0});
    const avgConfidence = total? Number((rows.reduce((a,b)=>a+Number(b.confidence||0),0)/total).toFixed(2)) : 0;
    const byServiceAvg = rows.reduce((m,t)=>{const k=t.serviceType||'Other'; m[k]=m[k]||{sum:0,count:0}; m[k].sum+=Number(t.rating||0); m[k].count++; return m;},{});
    const byService = Object.fromEntries(Object.entries(byServiceAvg).map(([k,v])=>[k, v.count? (v.sum/v.count).toFixed(2):0]));
    const byCategory = rows.reduce((m,t)=>{const k=t.category||'Other'; m[k]=(m[k]||0)+1; return m;},{});
    const trend = rows.reduce((m,t)=>{const d=(t.date||'').slice(0,10); if(!d) return m; m[d]=(m[d]||0)+1; return m;},{});
    res.json({ok:true, total, avgRating:Number(avgRating), avgConfidence, sentiments, byService, byCategory, trend, rows});
  });
});

// --- Auth: Password reset via email (Ethereal test) ---
app.post('/api/auth/request-reset', async (req,res)=>{
  try{
    const email=(req.body?.email||'').trim();
    if(!email) return res.status(400).json({ok:false,error:'email_required'});
    const token=makeToken();
    const id='RST'+Math.random().toString(36).slice(2,10);
    const expiresAt=new Date(Date.now()+60*60*1000).toISOString(); // 1 hour
    const stmt=db.prepare(`INSERT INTO reset_tokens (id,email,token,expires_at,used) VALUES (?,?,?,?,0)`);
    stmt.run(id,email,token,expiresAt,(err)=>{
      if(err){ console.error(err); return res.status(500).json({ok:false}); }
      (async()=>{
        const link=`http://localhost:${PORT}/reset.html?token=${encodeURIComponent(token)}`;
        try{
          const t=await getTransporter();
          const info=await t.sendMail({
            from:'Smart Feedback <no-reply@example.com>',
            to: email,
            subject:'Password Reset Request',
            html:`<p>You requested a password reset.</p><p>Click the link below to set a new password:</p><p><a href="${link}">${link}</a></p><p>This link expires in 1 hour.</p>`
          });
          const previewUrl=require('nodemailer').getTestMessageUrl(info);
          res.json({ok:true, previewUrl, link});
        }catch(e){
          // If SMTP is unavailable, still succeed and return the reset link
          console.error('Email send failed, returning link instead:', e?.message||e);
          res.json({ok:true, link});
        }
      })();
    });
  }catch(err){ console.error(err); res.status(500).json({ok:false}); }
});

app.post('/api/auth/reset', (req,res)=>{
  const token=(req.body?.token||'').trim();
  if(!token) return res.status(400).json({ok:false,error:'token_required'});
  db.get(`SELECT * FROM reset_tokens WHERE token=?`, [token], (err,row)=>{
    if(err){ console.error(err); return res.status(500).json({ok:false}); }
    if(!row) return res.status(400).json({ok:false,error:'invalid_token'});
    if(Number(row.used)) return res.status(400).json({ok:false,error:'used_token'});
    if(new Date(row.expires_at).getTime() < Date.now()) return res.status(400).json({ok:false,error:'expired_token'});
    db.run(`UPDATE reset_tokens SET used=1 WHERE id=?`, [row.id], (e2)=>{
      if(e2){ console.error(e2); return res.status(500).json({ok:false}); }
      res.json({ok:true, email: row.email});
    });
  });
});

// Fallback to index for convenience (optional)
app.get('/', (req,res)=> res.sendFile(path.join(PUBLIC_DIR,'index.html')));

app.listen(PORT, ()=>{
  console.log(`SmartTicket server running at http://localhost:${PORT}`);
});

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'exam.db');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    verified INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    correct INTEGER NOT NULL,
    total INTEGER NOT NULL,
    ts INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    expires INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    expires INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

function authMiddleware(req, res, next){
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if(!token) return res.status(401).json({error:'unauthorized'});
  try{
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  }catch(e){
    return res.status(401).json({error:'invalid_token'});
  }
}

const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 50 });
const loginLimiter = rateLimit({ windowMs: 15*60*1000, max: 10 });

function strongPassword(pw){
  return typeof pw==='string' && pw.length>=8 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
}

app.post('/api/register', authLimiter, (req,res)=>{
  const {name,email,password} = req.body || {};
  if(!name || !email || !password) return res.status(400).json({error:'missing_fields'});
  if(!strongPassword(password)) return res.status(400).json({error:'weak_password'});
  const hash = bcrypt.hashSync(password, 10);
  const now = Date.now();
  db.run('INSERT INTO users (name,email,password_hash,created_at) VALUES (?,?,?,?)', [name,email,hash,now], function(err){
    if(err) return res.status(400).json({error:'email_in_use'});
    const user = {id:this.lastID, name, email, verified:0};
    const token = jwt.sign(user, JWT_SECRET, {expiresIn:'7d'});
    const vtoken = jwt.sign({uid:user.id, type:'verify'}, JWT_SECRET, {expiresIn:'2d'});
    const exp = Date.now() + 2*24*60*60*1000;
    db.run('INSERT INTO email_verifications (user_id, token, expires) VALUES (?,?,?)',[user.id, vtoken, exp]);
    res.json({user, token, verify_link: `/verify.html?token=${vtoken}`});
  });
});

app.post('/api/request_verification', authMiddleware, (req,res)=>{
  const vtoken = jwt.sign({uid:req.user.id, type:'verify'}, JWT_SECRET, {expiresIn:'2d'});
  const exp = Date.now() + 2*24*60*60*1000;
  db.run('INSERT INTO email_verifications (user_id, token, expires) VALUES (?,?,?)',[req.user.id, vtoken, exp], ()=>{
    res.json({verify_link: `/verify.html?token=${vtoken}`});
  });
});

app.post('/api/verify', (req,res)=>{
  const { token } = req.body || {};
  if(!token) return res.status(400).json({error:'missing_token'});
  let payload; try{ payload = jwt.verify(token, JWT_SECRET); }catch(e){ return res.status(400).json({error:'invalid_token'}); }
  if(payload.type!=='verify') return res.status(400).json({error:'invalid_token'});
  db.get('SELECT user_id, expires FROM email_verifications WHERE token=?',[token], (err,row)=>{
    if(err || !row) return res.status(400).json({error:'invalid_token'});
    if(row.expires < Date.now()) return res.status(400).json({error:'expired'});
    db.run('UPDATE users SET verified=1 WHERE id=?',[row.user_id], (e)=>{
      if(e) return res.status(500).json({error:'db_error'});
      db.run('DELETE FROM email_verifications WHERE token=?',[token]);
      res.json({ok:true});
    });
  });
});

app.post('/api/forgot', authLimiter, (req,res)=>{
  const { email } = req.body || {};
  if(!email) return res.status(400).json({error:'missing_email'});
  db.get('SELECT id FROM users WHERE email=?',[email], (err,row)=>{
    if(err || !row) return res.json({ok:true});
    const rtoken = jwt.sign({uid:row.id, type:'reset'}, JWT_SECRET, {expiresIn:'1h'});
    const exp = Date.now() + 60*60*1000;
    db.run('INSERT INTO password_resets (user_id, token, expires) VALUES (?,?,?)',[row.id, rtoken, exp], ()=>{
      res.json({reset_link: `/reset.html?token=${rtoken}`});
    });
  });
});

app.post('/api/reset_password', authLimiter, (req,res)=>{
  const { token, new_password } = req.body || {};
  if(!token || !new_password) return res.status(400).json({error:'missing_fields'});
  if(!strongPassword(new_password)) return res.status(400).json({error:'weak_password'});
  let payload; try{ payload = jwt.verify(token, JWT_SECRET); }catch(e){ return res.status(400).json({error:'invalid_token'}); }
  if(payload.type!=='reset') return res.status(400).json({error:'invalid_token'});
  db.get('SELECT user_id, expires FROM password_resets WHERE token=?',[token], (err,row)=>{
    if(err || !row) return res.status(400).json({error:'invalid_token'});
    if(row.expires < Date.now()) return res.status(400).json({error:'expired'});
    const hash = bcrypt.hashSync(new_password, 10);
    db.run('UPDATE users SET password_hash=? WHERE id=?',[hash, row.user_id], (e)=>{
      if(e) return res.status(500).json({error:'db_error'});
      db.run('DELETE FROM password_resets WHERE token=?',[token]);
      res.json({ok:true});
    });
  });
});

app.post('/api/login', loginLimiter, (req,res)=>{
  const {email,password} = req.body || {};
  if(!email || !password) return res.status(400).json({error:'missing_fields'});
  db.get('SELECT * FROM users WHERE email = ?', [email], (err,row)=>{
    if(err || !row) return res.status(401).json({error:'invalid_credentials'});
    const ok = bcrypt.compareSync(password, row.password_hash);
    if(!ok) return res.status(401).json({error:'invalid_credentials'});
    const user = {id:row.id, name:row.name, email:row.email, verified:row.verified||0};
    const token = jwt.sign(user, JWT_SECRET, {expiresIn:'7d'});
    res.json({user, token});
  });
});

app.get('/api/me', authMiddleware, (req,res)=>{
  res.json({user:req.user});
});

app.post('/api/change_password', authMiddleware, authLimiter, (req,res)=>{
  const { old_password, new_password } = req.body || {};
  if(!old_password || !new_password) return res.status(400).json({error:'missing_fields'});
  if(!strongPassword(new_password)) return res.status(400).json({error:'weak_password'});
  db.get('SELECT password_hash FROM users WHERE id=?',[req.user.id], (err,row)=>{
    if(err || !row) return res.status(500).json({error:'db_error'});
    const ok = bcrypt.compareSync(old_password, row.password_hash);
    if(!ok) return res.status(401).json({error:'invalid_old_password'});
    const hash = bcrypt.hashSync(new_password, 10);
    db.run('UPDATE users SET password_hash=? WHERE id=?',[hash, req.user.id], (e)=>{
      if(e) return res.status(500).json({error:'db_error'});
      res.json({ok:true});
    });
  });
});

app.post('/api/attempts', authMiddleware, (req,res)=>{
  const {correct,total,ts} = req.body || {};
  if(typeof correct!== 'number' || typeof total!== 'number') return res.status(400).json({error:'invalid_body'});
  const when = typeof ts === 'number' ? ts : Date.now();
  db.run('INSERT INTO attempts (user_id,correct,total,ts) VALUES (?,?,?,?)', [req.user.id, correct, total, when], function(err){
    if(err) return res.status(500).json({error:'db_error'});
    res.json({id:this.lastID, correct, total, ts: when});
  });
});

app.get('/api/attempts', authMiddleware, (req,res)=>{
  const range = (req.query.range||'all').toLowerCase();
  let since = 0;
  if(range==='week') since = Date.now() - 7*24*60*60*1000;
  db.all('SELECT id,correct,total,ts FROM attempts WHERE user_id=? AND ts >= ? ORDER BY ts DESC', [req.user.id, since], (err, rows)=>{
    if(err) return res.status(500).json({error:'db_error'});
    res.json({attempts: rows});
  });
});

app.get('/api/eligibility', authMiddleware, (req,res)=>{
  const since = Date.now() - 7*24*60*60*1000;
  db.all('SELECT correct,total FROM attempts WHERE user_id=? AND ts >= ?', [req.user.id, since], (err, rows)=>{
    if(err) return res.status(500).json({error:'db_error'});
    let avg = 0; let n = rows.length;
    if(n>0){
      const sum = rows.reduce((acc,r)=> acc + (r.correct/r.total)*100, 0);
      avg = Math.round(sum / n);
    }
    const eligible = n>=3 && avg>=80;
    res.json({eligible, average: avg, attempts: n});
  });
});

app.listen(PORT, ()=>{
  console.log(`Server running on http://localhost:${PORT}`);
});

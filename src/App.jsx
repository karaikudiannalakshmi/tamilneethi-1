import { useState, useEffect, useCallback } from 'react';
import { db } from './firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { AC_VERSES, KV_VERSES, MU_VERSES, NAL_VERSES } from './data';
import { NATARAJA } from './nataraja';

// ── Sources config ──
const SOURCES = [
  {
    id:'aathichudi', ta:'ஆத்திசூடி', en:'Aathichudi', author:'ஔவையார் (Avvaiyar)', icon:'🌺',
    desc:'ஔவையார் இயற்றிய 109 ஒற்றை வரி நீதி மொழிகள் — அகர வரிசையில் அமைந்தவை.',
    subs:[
      {id:'ac_uir', ta:'உயிர் வருக்கம் (1–13)',  en:'Vowel Series 1–13'},
      {id:'ac_ka',  ta:'க வருக்கம் (14–43)',     en:'Ka Series 14–43'},
      {id:'ac_sa',  ta:'ச–ஞ வருக்கம் (44–53)',   en:'Sa–Nya Series 44–53'},
      {id:'ac_ta',  ta:'த–ந வருக்கம் (54–75)',   en:'Ta–Na Series 54–75'},
      {id:'ac_pa',  ta:'ப–ம வருக்கம் (76–97)',   en:'Pa–Ma Series 76–97'},
      {id:'ac_va',  ta:'வ–ஒ வருக்கம் (98–109)',  en:'Va–O Series 98–109'},
    ]
  },
  {
    id:'kondraivendum', ta:'கொன்றை வேந்தன்', en:'Kondrai Venthan', author:'ஔவையார் (Avvaiyar)', icon:'🌿',
    desc:'ஔவையார் இயற்றிய 91 நீதி மொழிகள் — அகர வரிசையில் அமைந்தவை.',
    subs:[
      {id:'kv_uir',  ta:'உயிர் வருக்கம் (1–13)', en:'Vowel Series 1–13'},
      {id:'kv_ka',   ta:'க வருக்கம் (14–25)',    en:'Ka Series 14–25'},
      {id:'kv_sa',   ta:'ச வருக்கம் (26–36)',    en:'Sa Series 26–36'},
      {id:'kv_ta',   ta:'த வருக்கம் (37–47)',    en:'Ta Series 37–47'},
      {id:'kv_na',   ta:'ந வருக்கம் (48–58)',    en:'Na Series 48–58'},
      {id:'kv_pa',   ta:'ப வருக்கம் (59–69)',    en:'Pa Series 59–69'},
      {id:'kv_ma',   ta:'ம–வ வருக்கம் (70–89)',  en:'Ma–Va Series 70–89'},
      {id:'kv_last', ta:'ஒ–ஓ வருக்கம் (90–91)', en:'O–Oo Series 90–91'},
    ]
  },
  {
    id:'muthurai', ta:'மூதுரை', en:'Muthurai', author:'ஔவையார் (Avvaiyar)', icon:'🦚',
    desc:'ஔவையார் இயற்றிய 30 வெண்பாக்கள் — பழமொழிகளும் உவமைகளும் நிறைந்தவை.',
    subs:[
      {id:'mu_1', ta:'பாடல்கள் 1–10',  en:'Verses 1–10'},
      {id:'mu_2', ta:'பாடல்கள் 11–20', en:'Verses 11–20'},
      {id:'mu_3', ta:'பாடல்கள் 21–30', en:'Verses 21–30'},
    ]
  },
  {
    id:'naladiyar', ta:'நாலடியார்', en:'Naladiyar', author:'சமண முனிவர்கள்', icon:'📿',
    desc:'சமண முனிவர்களால் இயற்றப்பட்ட 400 வெண்பாக்கள் — நான்கு பிரிவுகளாக அமைந்தவை.',
    subs:[
      {id:'nal_aram1', ta:'அறவியல் — துறவு (1–40)',      en:'Virtue — Renunciation 1–40'},
      {id:'nal_aram2', ta:'அறவியல் — இல்லறம் (41–100)',  en:'Virtue — Householder 41–100'},
      {id:'nal_por1',  ta:'பொருளியல் — அரசியல் (101–160)',en:'Wealth — Polity 101–160'},
      {id:'nal_por2',  ta:'பொருளியல் — நட்பு (161–200)', en:'Wealth — Friendship 161–200'},
      {id:'nal_inb',   ta:'இன்பவியல் (201–300)',         en:'Love — Inbam 201–300'},
      {id:'nal_veedu', ta:'துறவறவியல் (301–400)',        en:'Renunciation 301–400'},
    ]
  },
];

// ── Build books from verse arrays ──
function buildBooks() {
  const books = [];
  const add = (arr, srcId) => arr.forEach(v => {
    const [num, subId, ta, en, poem] = v;
    books.push({ id:`${srcId}_${num}`, num, ta, en:en||'', poem:poem||'', source:srcId, sub:subId, url:'' });
  });
  add(AC_VERSES, 'aathichudi');
  add(KV_VERSES, 'kondraivendum');
  add(MU_VERSES, 'muthurai');
  add(NAL_VERSES, 'naladiyar');
  return books;
}

const BASE_BOOKS = buildBooks();
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'Koviloor@07';

export default function App() {
  const [urls, setUrls]             = useState({});
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState('all');
  const [query, setQuery]           = useState('');
  const [adminOpen, setAdminOpen]   = useState(false);
  const [adminSrc, setAdminSrc]     = useState(SOURCES[0].id);
  const [saving, setSaving]         = useState({});
  const [notice, setNotice]         = useState(null);
  const [expandedPoem, setExpandedPoem] = useState(null);

  // Load URLs from Firestore
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(collection(db, 'tn_urls'));
        const map = {};
        snap.forEach(d => { map[d.id] = d.data().url || ''; });
        setUrls(map);
      } catch(e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  // Merge base books with Firestore URLs
  const books = BASE_BOOKS.map(b => ({ ...b, url: urls[b.id] || '' }));

  function showNotice(msg, type='success') {
    setNotice({ msg, type });
    setTimeout(() => setNotice(null), 4000);
  }

  async function saveUrl(bookId, url) {
    setSaving(s => ({ ...s, [bookId]: true }));
    try {
      await setDoc(doc(db, 'tn_urls', bookId), { url: url.trim(), updatedAt: new Date().toISOString() });
      setUrls(u => ({ ...u, [bookId]: url.trim() }));
      showNotice('✓ சேமிக்கப்பட்டது! உடனே live ஆகும்.', 'success');
    } catch(e) {
      showNotice('பிழை: ' + e.message, 'error');
    }
    setSaving(s => ({ ...s, [bookId]: false }));
  }

  function openAdmin() {
    const pwd = prompt('கடவுச்சொல் / Password:');
    if (pwd !== ADMIN_PASSWORD) { alert('தவறான கடவுச்சொல்.'); return; }
    setAdminOpen(true);
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'Tiro Tamil, serif', fontSize:20, color:'#7A1414' }}>
      📚 நூலகம் திறக்கிறது…
    </div>
  );

  return (
    <div style={{ fontFamily:'Inter, sans-serif', background:'#FAF6ED', minHeight:'100vh', color:'#1A1208' }}>

      {/* NOTICE */}
      {notice && (
        <div style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', background:notice.type==='success'?'#2E7D32':'#c0392b', color:'#fff', padding:'12px 24px', borderRadius:8, zIndex:9999, fontFamily:'Inter', fontSize:14, boxShadow:'0 4px 16px rgba(0,0,0,.2)' }}>
          {notice.msg}
        </div>
      )}

      {/* HEADER */}
      <header style={{ background:'#7A1414', color:'#fff', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 1px,transparent 40px),repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 1px,transparent 1px,transparent 40px)', pointerEvents:'none' }} />
        <div style={{ position:'relative', maxWidth:1100, margin:'0 auto', padding:'40px 24px 32px', display:'flex', alignItems:'center', justifyContent:'center', gap:24, flexWrap:'wrap', textAlign:'center' }}>
          <img src={NATARAJA} alt="நடராஜர்" style={{ height:80, objectFit:'contain', filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }} />
          <div>
            <div style={{ fontFamily:'Tiro Tamil, serif', fontSize:'clamp(12px,2vw,14px)', color:'rgba(255,220,100,.9)', letterSpacing:'0.06em', marginBottom:6 }}>கோவிலூர் மடாலயம் வழங்கும்</div>
            <div style={{ fontFamily:'Tiro Tamil, serif', fontSize:'clamp(22px,4vw,34px)', color:'#FFE8A0', lineHeight:1.3 }}>தமிழ் நீதிக்கதைகள் நூலகம்</div>
            <div style={{ fontFamily:'Lora, serif', fontSize:'clamp(13px,2vw,17px)', fontStyle:'italic', color:'rgba(255,255,255,.7)', marginTop:6 }}>Tamil Moral Stories — A Digital Flipbook Library</div>
            <div style={{ margin:'14px auto 0', color:'#B8860B', fontSize:18, letterSpacing:8, opacity:.8 }}>❖ ❖ ❖</div>
          </div>
          <img src={NATARAJA} alt="" aria-hidden style={{ height:80, objectFit:'contain', filter:'drop-shadow(0 2px 8px rgba(0,0,0,0.5))', transform:'scaleX(-1)' }} />
        </div>
      </header>

      {/* INVITATION BOX — Koviloor Madalayam Letterhead */}
      <div style={{ background:'#FAF6ED', padding:'32px 24px 40px' }}>
        <div style={{
          maxWidth:780, margin:'0 auto',
          border:'3px solid #8B6914',
          borderRadius:8,
          overflow:'hidden',
          boxShadow:'0 4px 24px rgba(0,0,0,0.12)',
          fontFamily:'Tiro Tamil, serif',
        }}>

          {/* ── LETTERHEAD ── */}
          <div style={{ background:'#FFFBF0', borderBottom:'2px solid #8B6914', padding:'16px 24px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              {/* Left — Address */}
              <div style={{ flex:1, minWidth:180 }}>
                <div style={{ fontSize:20, fontWeight:700, color:'#7A1414', fontFamily:'Georgia, serif', lineHeight:1.3 }}>Koviloor Madalayam</div>
                <div style={{ fontSize:14, fontWeight:700, color:'#B8860B', fontFamily:'Georgia, serif' }}>Koviloor – 630 307</div>
                <div style={{ fontSize:12.5, color:'#3D3320', marginTop:4, lineHeight:1.6 }}>Madurai Road, Koviloor<br/>Sivagangai Dist</div>
              </div>
              {/* Centre — Nataraja + Sivamayam */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ fontSize:11, color:'#B8860B', letterSpacing:2, fontFamily:'Georgia, serif' }}>Sivamayam</div>
                <img src={NATARAJA} alt="நடராஜர்" style={{ height:64, objectFit:'contain', filter:'drop-shadow(0 2px 6px rgba(0,0,0,0.3))' }} />
              </div>
              {/* Right — Contact + Swamigal */}
              <div style={{ flex:1, minWidth:180, textAlign:'right' }}>
                <div style={{ fontSize:12.5, color:'#3D3320', lineHeight:1.8 }}>
                  <div>📞 97893 36720, 94433 35312</div>
                  <div>✉ sinaiyar@gmail.com</div>
                </div>
                <div style={{ marginTop:8, fontSize:13, color:'#7A1414', lineHeight:1.5, fontStyle:'italic' }}>
                  Sri La Sri<br/>
                  <strong>Narayana Gnana Desiga Swamigal</strong><br/>
                  <span style={{ fontSize:11, color:'#6B5C40' }}>Madathipathy</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── GOLD DIVIDER ── */}
          <div style={{ height:4, background:'linear-gradient(90deg, #8B6914, #D4A017, #8B6914)' }} />

          {/* ── BODY ── */}
          <div style={{ background:'#FFFDF7', padding:'28px 32px' }}>

            {/* Date */}
            <div style={{ textAlign:'right', fontSize:12, color:'#6B5C40', marginBottom:16, fontFamily:'Georgia, serif' }}>
              29 June 2026
            </div>

            {/* Greeting */}
            <div style={{ fontSize:22, color:'#7A1414', marginBottom:20, fontWeight:400 }}>
              அன்புடையீர், வணக்கம்.
            </div>

            {/* Paragraphs */}
            <div style={{ fontSize:15, color:'#2C1810', lineHeight:2, display:'flex', flexDirection:'column', gap:14 }}>
              <p style={{margin:0}}>இன்றைய பள்ளிக் கல்வியில், சிறுவர்களின் உள்ளத்தில் அறநெறி விதைக்கும் பாடங்கள் பெருமளவில் மறைந்து வருகின்றன.</p>

              <p style={{margin:0}}>ஒரு காலத்தில் <strong style={{color:'#7A1414'}}>ஆத்திச்சூடி, கொன்றைவேந்தன், ஆசாரக்கோவை, மூதுரை, நாலடியார்</strong> போன்ற அறநெறி நூல்கள் பள்ளிப் பாடங்களாக இருந்து, சிறுவயதிலிருந்தே ஒழுக்கம், பண்பு, அன்பு, இரக்கம், பெரியோர் மரியாதை போன்ற உயரிய பண்புகளை இயல்பாக வளர்த்தன.</p>

              <p style={{margin:0}}>இன்று அந்த வாய்ப்பு குறைந்து வருவதால், அந்த அறநெறிச் செல்வங்களை மீண்டும் இளம் தலைமுறையிடம் கொண்டு சேர்க்க வேண்டும் என்பது நமது விருப்பமாக உள்ளது.</p>

              <p style={{margin:0}}>அந்த எண்ணத்தின் அடிப்படையில், சிறுவர்கள் ஆர்வத்துடன் படிக்கும் வகையில், இந்த அறநெறி நூல்களை <strong style={{color:'#7A1414'}}>படக்கதை (Illustrated Story)</strong> வடிவில் வழங்கும் முயற்சியைத் தொடங்கியுள்ளோம்.</p>

              <p style={{margin:0}}>இது ஒரு தொடர்ச்சியான பணி. தினந்தோறும் புதிய கதைகள் சேர்க்கப்படும். பின்னர் <strong style={{color:'#7A1414'}}>கொன்றைவேந்தன், ஆசாரக்கோவை, மூதுரை, நாலடியார்</strong> உள்ளிட்ட பல அறநெறி நூல்களும் இதே வடிவில் வெளியிடப்படும்.</p>
            </div>

            {/* CTA box */}
            <div style={{ margin:'24px 0', background:'#7A1414', borderRadius:6, padding:'12px 20px', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:20 }}>📖</span>
              <span style={{ fontSize:15, color:'#FFE8A0', fontFamily:'Tiro Tamil, serif' }}>இந்த அறநெறிக் கதைகளைப் படிக்க</span>
            </div>

            {/* URL box */}
            <div style={{ background:'#FFF9E6', border:'2px solid #B8860B', borderRadius:6, padding:'12px 20px', textAlign:'center', marginBottom:24 }}>
              <a href="https://tamilneethi.vercel.app/" target="_blank" rel="noopener"
                style={{ fontSize:17, color:'#0066CC', fontFamily:'Georgia, serif', fontWeight:700, textDecoration:'underline' }}>
                https://tamilneethi.vercel.app/
              </a>
            </div>

            {/* Bullet points */}
            <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:24 }}>
              {[
                { icon:'👨‍👩‍👧‍👦', text:'தாங்கள் அறிந்துள்ள குழந்தைகள், மாணவர்கள், பெற்றோர், ஆசிரியர்கள் அனைவரிடமும் இந்த இணையதளத்தைப் பகிர்ந்து, அவர்கள் இந்தக் கதைகளை வாசிக்கும் வாய்ப்பை உருவாக்கித் தருமாறு அன்புடன் கேட்டுக்கொள்கிறோம்.' },
                { icon:'🌱', text:'சிறுவயதில் மனதில் விதைக்கப்படும் ஒரு நல்ல எண்ணம், வாழ்நாள் முழுவதும் நல்ல மனிதனாக வாழ வழிகாட்டும்.' },
                { icon:'📚', text:'"தொட்டில் பழக்கம் சுடுகாடு வரை" என்பார்கள். எனவே, சிறுவயதிலேயே அறநெறி விதைகளை விதைப்பது, எதிர்கால நல்ல சமுதாயத்தை உருவாக்கும் மிகச் சிறந்த முதலீடாகும்.' },
                { icon:'🙏', text:'இந்த அறப்பணிக்கு தங்களின் அன்பான ஆதரவையும், ஒத்துழைப்பையும் மனமார வேண்டுகிறோம்.' },
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', gap:14, alignItems:'flex-start' }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:'#F5E8E8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{item.icon}</div>
                  <div style={{ fontSize:14, color:'#2C1810', lineHeight:1.85, paddingTop:4 }}>{item.text}</div>
                </div>
              ))}
            </div>

          </div>

          {/* ── FOOTER ── */}
          <div style={{ background:'#7A1414', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'center', gap:12 }}>
            <span style={{ fontSize:18 }}>🪷</span>
            <span style={{ fontFamily:'Tiro Tamil, serif', fontSize:17, color:'#FFE8A0', letterSpacing:1 }}>வேணும் சற்குருநாதன் துணை.</span>
            <span style={{ fontSize:18 }}>🪷</span>
          </div>

        </div>
      </div>
      <div style={{ background:'#fff', borderBottom:'1px solid #D9CEBC', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'10px 24px', display:'flex', flexDirection:'column', gap:8 }}>
          {/* Row 1 — Search */}
          <div style={{ position:'relative' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6B5C40" strokeWidth="2" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="தேடுங்கள் / Search…" style={{ width:'100%', padding:'8px 12px 8px 34px', border:'1px solid #D9CEBC', borderRadius:8, fontSize:14, background:'#FAF6ED', color:'#1A1208', outline:'none', fontFamily:'Inter', boxSizing:'border-box' }} />
          </div>
          {/* Row 2 — Filter buttons */}
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <button onClick={()=>setFilter('all')}
              style={{ padding:'5px 14px', borderRadius:20, border:`1px solid ${filter==='all'?'#7A1414':'#D9CEBC'}`, background:filter==='all'?'#7A1414':'transparent', color:filter==='all'?'#fff':'#3D3320', fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>
              அனைத்தும் / All
            </button>
            <span style={{ fontSize:10, color:'#6B5C40', padding:'0 2px' }}>✦ ஔவையார்:</span>
            {SOURCES.filter(s => s.id !== 'naladiyar').map(src => {
              const cnt = books.filter(b => b.source===src.id && matchQ(b,query)).length;
              const active = filter===src.id;
              return (
                <button key={src.id} onClick={()=>setFilter(filter===src.id?'all':src.id)}
                  style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${active?'#7A1414':'#D9CEBC'}`, background:active?'#7A1414':'transparent', color:active?'#fff':'#3D3320', fontSize:12, cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}>
                  {src.icon} {src.ta} <span style={{ background:active?'rgba(255,255,255,.25)':'#F5E8E8', color:active?'#fff':'#7A1414', fontSize:11, fontWeight:600, padding:'1px 6px', borderRadius:10 }}>{cnt}</span>
                </button>
              );
            })}
            <span style={{ fontSize:10, color:'#6B5C40', padding:'0 2px' }}>✦ நாலடியார்:</span>
            {SOURCES.filter(s => s.id === 'naladiyar').map(src => {
              const cnt = books.filter(b => b.source===src.id && matchQ(b,query)).length;
              const active = filter===src.id;
              return (
                <button key={src.id} onClick={()=>setFilter(filter===src.id?'all':src.id)}
                  style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${active?'#7A1414':'#D9CEBC'}`, background:active?'#7A1414':'transparent', color:active?'#fff':'#3D3320', fontSize:12, cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4 }}>
                  {src.icon} {src.ta} <span style={{ background:active?'rgba(255,255,255,.25)':'#F5E8E8', color:active?'#fff':'#7A1414', fontSize:11, fontWeight:600, padding:'1px 6px', borderRadius:10 }}>{cnt}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* MAIN */}
      <main style={{ maxWidth:1100, margin:'0 auto', padding:'28px 24px 64px' }}>
        {SOURCES.map((src, idx) => {
          if (filter !== 'all' && filter !== src.id) return null;
          const srcBooks = books.filter(b => b.source===src.id);
          return (
            <Section key={src.id} src={src} idx={idx} srcBooks={srcBooks} query={query}
              saving={saving} onSave={saveUrl} expandedPoem={expandedPoem} setExpandedPoem={setExpandedPoem} />
          );
        })}
      </main>

      {/* FOOTER */}
      <footer style={{ background:'#1A1208', color:'rgba(255,255,255,.5)', textAlign:'center', padding:24, fontSize:13, lineHeight:1.6 }}>
        <div style={{ fontFamily:'Tiro Tamil, serif', color:'rgba(255,255,255,.7)', fontSize:15, marginBottom:4 }}>தமிழ் இலக்கியத்தின் நீதிகளை அடுத்த தலைமுறைக்கு கொண்டு செல்வோம்</div>
        <div>Preserving the wisdom of Tamil literature for future generations</div>
        <div style={{ marginTop:8, fontSize:11, opacity:.5 }}>Flipbooks powered by Heyzine</div>
        <div style={{ marginTop:14 }}>
          <button onClick={openAdmin} style={{ background:'rgba(255,255,255,.12)', color:'rgba(255,255,255,.7)', border:'1px solid rgba(255,255,255,.2)', padding:'8px 20px', borderRadius:6, fontSize:13, cursor:'pointer', fontFamily:'Inter' }}>
            🔗 இணைப்புகளை நிர்வகி / Manage Links
          </button>
        </div>
      </footer>

      {/* ADMIN MODAL */}
      {adminOpen && (
        <AdminModal
          books={books} sources={SOURCES} saving={saving} onSave={saveUrl}
          adminSrc={adminSrc} setAdminSrc={setAdminSrc}
          onClose={() => setAdminOpen(false)} />
      )}
    </div>
  );
}

function matchQ(book, q) {
  if (!q) return true;
  return [book.ta, book.en, String(book.num)].join(' ').toLowerCase().includes(q.toLowerCase());
}

// ── Section component ──
function Section({ src, idx, srcBooks, query, saving, onSave, expandedPoem, setExpandedPoem }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div style={{ marginBottom:48 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom:20, paddingBottom:14, borderBottom:'2px solid #7A1414' }}>
        <div style={{ background:'#7A1414', color:'#fff', width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:600, flexShrink:0, marginTop:2 }}>{idx+1}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'Tiro Tamil, serif', fontSize:22, color:'#7A1414', lineHeight:1.3 }}>{src.icon} {src.ta}</div>
          <div style={{ fontFamily:'Lora, serif', fontSize:13, fontStyle:'italic', color:'#6B5C40', marginTop:3 }}>{src.en} · {src.author}</div>
          <div style={{ fontSize:12.5, color:'#6B5C40', marginTop:5, lineHeight:1.55, maxWidth:640 }}>{src.desc}</div>
        </div>
        <button onClick={()=>setCollapsed(c=>!c)} style={{ background:'none', border:'1px solid #D9CEBC', color:'#6B5C40', width:28, height:28, borderRadius:6, cursor:'pointer', fontSize:14, flexShrink:0 }}>{collapsed?'▶':'▼'}</button>
      </div>
      {!collapsed && src.subs.map(sub => {
        const subBooks = srcBooks.filter(b => b.sub===sub.id);
        if (!subBooks.length) return null;
        return <SubSection key={sub.id} sub={sub} src={src} subBooks={subBooks} query={query} saving={saving} onSave={onSave} expandedPoem={expandedPoem} setExpandedPoem={setExpandedPoem} />;
      })}
    </div>
  );
}

// ── SubSection with Ready/Coming Soon tabs ──
function SubSection({ sub, src, subBooks, query, saving, onSave, expandedPoem, setExpandedPoem }) {
  const [tab, setTab] = useState('auto');
  const readyBooks  = subBooks.filter(b => b.url && b.url.trim());
  const comingBooks = subBooks.filter(b => !b.url || !b.url.trim());
  const activeTab   = tab==='auto' ? (readyBooks.length?'ready':'coming') : tab;

  return (
    <div style={{ marginBottom:28 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <span style={{ fontSize:11, fontWeight:600, letterSpacing:'.07em', textTransform:'uppercase', color:'#B8860B', background:'#FDF6DC', padding:'3px 10px', borderRadius:4, border:'1px solid #E8D080', whiteSpace:'nowrap' }}>{sub.en}</span>
        <span style={{ fontFamily:'Tiro Tamil, serif', fontSize:14, color:'#3D3320' }}>{sub.ta}</span>
        <div style={{ flex:1, height:1, background:'#D9CEBC' }} />
        <span style={{ fontSize:12, color:'#6B5C40', whiteSpace:'nowrap' }}>{subBooks.length} பாடல்கள்</span>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', marginBottom:14, border:'1px solid #D9CEBC', borderRadius:8, overflow:'hidden' }}>
        {[['ready',`📖 தயாராக உள்ளவை / Ready`,readyBooks.length],['coming',`🕐 விரைவில் / Coming Soon`,comingBooks.length]].map(([t,label,cnt])=>(
          <button key={t} onClick={()=>setTab(t)} style={{ flex:1, padding:'9px 14px', background:activeTab===t?'#7A1414':'#FAF6ED', border:'none', cursor:'pointer', fontSize:13, fontFamily:'Inter', color:activeTab===t?'#fff':'#6B5C40', display:'flex', alignItems:'center', justifyContent:'center', gap:8, borderRight:t==='ready'?'1px solid #D9CEBC':'none' }}>
            {label} <span style={{ fontSize:11, fontWeight:600, padding:'1px 7px', borderRadius:10, background:activeTab===t?'rgba(255,255,255,.25)':'#EDE5D5', color:activeTab===t?'#fff':'#4A3520' }}>{cnt}</span>
          </button>
        ))}
      </div>

      {/* Ready grid */}
      {activeTab==='ready' && (
        readyBooks.length===0
          ? <div style={{ textAlign:'center', padding:32, color:'#6B5C40', fontSize:13 }}>📭 இன்னும் இணைப்புகள் சேர்க்கவில்லை</div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:14 }}>
              {readyBooks.filter(b=>matchQ(b,query)).map(b => <BookCard key={b.id} book={b} src={src} expandedPoem={expandedPoem} setExpandedPoem={setExpandedPoem} />)}
            </div>
      )}

      {/* Coming soon list */}
      {activeTab==='coming' && (
        comingBooks.length===0
          ? <div style={{ textAlign:'center', padding:16, color:'#2E7D32', fontSize:13 }}>✓ அனைத்து பாடல்களும் தயாராக உள்ளன!</div>
          : <div style={{ border:'1px solid #D9CEBC', borderRadius:8, overflow:'hidden' }}>
              {comingBooks.map((b,i) => (
                <div key={b.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 14px', background:i%2===0?'#FFFDF7':'#FAF6ED', borderBottom:i<comingBooks.length-1?'1px solid #D9CEBC':'none' }}>
                  <span style={{ fontSize:11, fontWeight:600, color:'#6B5C40', width:28, textAlign:'right', flexShrink:0 }}>{b.num}</span>
                  <span style={{ fontFamily:'Tiro Tamil, serif', fontSize:13, flex:1 }}>{b.ta}</span>
                  <span style={{ fontSize:10, background:'#FFF3CD', color:'#856404', padding:'2px 8px', borderRadius:10, whiteSpace:'nowrap', flexShrink:0 }}>விரைவில்</span>
                </div>
              ))}
            </div>
      )}
    </div>
  );
}

// ── Book card ──
function BookCard({ book, src, expandedPoem, setExpandedPoem }) {
  const isExpanded = expandedPoem === book.id;
  return (
    <div style={{ background:'#FFFDF7', border:'1px solid #D9CEBC', borderRadius:10, overflow:'hidden', display:'flex', flexDirection:'column', transition:'transform .18s, box-shadow .18s' }}
      onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(26,18,8,.08)';}}
      onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='';}}>
      {/* Cover */}
      <div style={{ aspectRatio:'3/4', background:'linear-gradient(145deg,#F5E8E0,#EDD8C8)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', padding:16 }}>
        <div style={{ fontSize:28, opacity:.5, marginBottom:8 }}>{src.icon}</div>
        <div style={{ fontFamily:'Lora, serif', fontSize:24, fontWeight:600, color:'#7A1414', opacity:.45 }}>{book.num}</div>
        <span style={{ position:'absolute', top:8, right:8, background:'rgba(255,255,255,.92)', color:'#7A1414', fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:4 }}>FLIP</span>
      </div>
      {/* Info */}
      <div style={{ padding:'11px 13px 13px', flex:1, display:'flex', flexDirection:'column', gap:5 }}>
        <div style={{ fontFamily:'Tiro Tamil, serif', fontSize:14, color:'#1A1208', lineHeight:1.4 }}>{book.num}. {book.ta}</div>
        {book.en && <div style={{ fontSize:11.5, color:'#6B5C40', fontStyle:'italic', lineHeight:1.3 }}>{book.en}</div>}
        {book.poem && (
          <div>
            <button onClick={()=>setExpandedPoem(isExpanded?null:book.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#7A1414', fontSize:11, padding:0, marginTop:4 }}>
              {isExpanded?'📜 பாடல் மறை':'📜 பாடல் காண்க'}
            </button>
            {isExpanded && <div style={{ marginTop:8, fontFamily:'Tiro Tamil, serif', fontSize:12.5, lineHeight:1.8, color:'#1A1208', whiteSpace:'pre-line', background:'#FDF6DC', padding:'10px 12px', borderRadius:6, border:'1px solid #E8D080' }}>{book.poem}</div>}
          </div>
        )}
        <button onClick={()=>window.open(book.url,'_blank')} style={{ marginTop:8, padding:7, borderRadius:6, background:'#F5E8E8', color:'#7A1414', fontSize:11.5, fontWeight:500, border:'none', cursor:'pointer', width:'100%', fontFamily:'Inter' }}>
          📖 திறக்கவும் / Open
        </button>
      </div>
    </div>
  );
}

// ── Admin modal ──
function AdminModal({ books, sources, saving, onSave, adminSrc, setAdminSrc, onClose }) {
  const [inputs, setInputs] = useState({});
  const srcBooks = books.filter(b=>b.source===adminSrc);
  const src = sources.find(s=>s.id===adminSrc);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,18,8,.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'#fff', borderRadius:14, width:'100%', maxWidth:600, padding:28, position:'relative', maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#6B5C40' }}>✕</button>
        <div style={{ fontFamily:'Lora, serif', fontSize:20, color:'#1A1208', marginBottom:16, paddingBottom:14, borderBottom:'1px solid #D9CEBC' }}>🔗 Flipbook இணைப்புகளை சேர்க்கவும்</div>

        <select value={adminSrc} onChange={e=>setAdminSrc(e.target.value)} style={{ width:'100%', padding:'9px 12px', border:'1px solid #D9CEBC', borderRadius:7, fontSize:14, marginBottom:16, background:'#FAF6ED', fontFamily:'Inter' }}>
          {sources.map(s=><option key={s.id} value={s.id}>{s.icon} {s.ta} — {s.en}</option>)}
        </select>

        <div style={{ overflowY:'auto', flex:1, border:'1px solid #D9CEBC', borderRadius:8 }}>
          {src && src.subs.map(sub => {
            const subBooks = srcBooks.filter(b=>b.sub===sub.id);
            if (!subBooks.length) return null;
            return (
              <div key={sub.id}>
                <div style={{ background:'#FDF6DC', padding:'8px 14px', fontSize:12, fontWeight:600, color:'#B8860B', borderBottom:'1px solid #E8D080' }}>{sub.ta} — {sub.en}</div>
                {subBooks.map(book => {
                  const hasLink = book.url && book.url.trim();
                  const val = inputs[book.id] !== undefined ? inputs[book.id] : (book.url||'');
                  return (
                    <div key={book.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid #D9CEBC' }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:hasLink?'#E8F5E9':'#F5E8E8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:600, color:hasLink?'#2E7D32':'#7A1414', flexShrink:0 }}>
                        {hasLink?'✓':book.num}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontFamily:'Tiro Tamil, serif', fontSize:13 }}>{book.num}. {book.ta}</div>
                        <div style={{ fontSize:11, color:'#6B5C40', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{book.url||'இணைப்பு இல்லை'}</div>
                      </div>
                      <input type="url" value={val} placeholder="https://heyzine.com/…"
                        onChange={e=>setInputs(i=>({...i,[book.id]:e.target.value}))}
                        style={{ width:180, padding:'6px 10px', border:'1px solid #D9CEBC', borderRadius:6, fontSize:12, background:'#FAF6ED', outline:'none', flexShrink:0 }} />
                      <button onClick={()=>onSave(book.id, val)} disabled={saving[book.id]}
                        style={{ padding:'6px 12px', background:saving[book.id]?'#999':'#7A1414', color:'#fff', border:'none', borderRadius:6, fontSize:12, cursor:saving[book.id]?'default':'pointer', flexShrink:0 }}>
                        {saving[book.id]?'⏳':'Save'}
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop:16, display:'flex', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'9px 20px', border:'1px solid #D9CEBC', borderRadius:7, background:'transparent', color:'#3D3320', fontSize:14, cursor:'pointer' }}>Done ✓</button>
        </div>
      </div>
    </div>
  );
}

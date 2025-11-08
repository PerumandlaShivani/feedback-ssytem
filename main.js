// Shared behaviors for SmartTicket
(function(){
  const $=(s,c=document)=>c.querySelector(s); const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const root=document.documentElement; const prefDark=matchMedia('(prefers-color-scheme: dark)').matches;
  if(localStorage.getItem('theme')==='dark'||(!localStorage.getItem('theme')&&prefDark)) root.classList.add('dark');
  $('.theme-toggle')?.addEventListener('click',()=>{root.classList.toggle('dark');localStorage.setItem('theme',root.classList.contains('dark')?'dark':'light');});
  const loc=location.pathname.split('/').pop()||'index.html';
  $$('.nav-links a').forEach(a=>{if(a.getAttribute('href')===loc) a.classList.add('active');});
  $('.hamburger')?.addEventListener('click',()=>$('.nav-links').classList.toggle('open'));
  window.toast=(msg,type='info')=>{const t=document.createElement('div');t.className='toast';t.innerHTML=`<i class="fa-solid ${type==='error'?'fa-triangle-exclamation':'fa-circle-check'}"></i><span>${msg}</span>`;document.body.appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transform='translateY(10px)';},2200);setTimeout(()=>t.remove(),2600);} 
  window.spinner={show(){const m=document.createElement('div');m.className='modal active';m.id='global-spinner';m.innerHTML='<div class="modal-card" style="background:transparent;box-shadow:none;display:grid;place-items:center"><i class="fa-solid fa-circle-notch fa-spin" style="font-size:34px;color:var(--primary)"></i></div>';document.body.appendChild(m);},hide(){$('#global-spinner')?.remove();}};

  // Logout handler
  $('#logout-link')?.addEventListener('click',e=>{e.preventDefault(); localStorage.removeItem('st_user'); toast('Logged out'); location.href='index.html';});

  // Home stats (feedback summary)
  if(loc==='index.html'){
    (async()=>{
      try{
        const r=await fetch('/api/feedback-summary'); if(!r.ok) throw new Error(); const s=await r.json(); if(!s?.ok) throw new Error();
        const total=s.total||0; const avg=(s.avgRating||0).toFixed ? s.avgRating : Number(s.avgRating||0);
        const positives=(s.sentiments?.Positive||0);
        const posPct = total? Math.round((positives/total)*100):0;
        const f=(n)=>n.toLocaleString();
        const set=(id,val)=>{const el=document.getElementById(id); if(el) el.textContent=val;}
        set('stat-feedbacks', f(total)); set('stat-avg', avg); set('stat-positive', posPct+"%" );
      }catch{}
    })();
  }

  // Route guards
  if(loc==='feedback.html'){
    const params=new URLSearchParams(location.search);
    const guest=params.get('guest')==='1';
    if(!guest){
      const u = JSON.parse(localStorage.getItem('st_user')||'null');
      if(!u){ toast('Please login first'); location.href='login.html'; }
    }
  }
  if(loc==='my-feedback.html'){
    const u = JSON.parse(localStorage.getItem('st_user')||'null');
    if(!u){ toast('Please login first'); location.href='login.html'; }
  }
})();

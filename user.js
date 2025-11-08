// My Feedback page
(function(){
  const $=(s,c=document)=>c.querySelector(s); const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const tbody=$('#feedback-body'); if(!tbody) return;
  const qType=$('#filter-type'); const qStart=$('#filter-start'); const qEnd=$('#filter-end'); const qSearch=$('#search');
  const user = JSON.parse(localStorage.getItem('st_user')||'{}');
  let cache=[];
  async function fetchAll(){
    try{
      const q = user?.email ? `?email=${encodeURIComponent(user.email)}` : '';
      const r = await fetch(`/api/feedback${q}`); if(!r.ok) throw new Error(); const data=await r.json(); if(!data?.ok) throw new Error();
      cache = data.feedback||[]; return cache;
    }catch{
      cache = JSON.parse(localStorage.getItem('st_feedback')||'[]'); return cache;
    }
  }
  function withinRange(d){
    if(!d) return true; const x=new Date(d);
    if(qStart.value){ const s=new Date(qStart.value); if(x<s) return false; }
    if(qEnd.value){ const e=new Date(qEnd.value); if(x>e) return false; }
    return true;
  }
  // Charts
  let pie, line;
  function updateCharts(data){
    const sentiments=data.reduce((m,t)=>{m[t.sentiment]=(m[t.sentiment]||0)+1; return m;},{Positive:0,Negative:0,Neutral:0});
    const trend=data.reduce((m,t)=>{const k=(t.date||'').slice(0,10); if(!k) return m; m[k]=(m[k]||0)+1; return m;},{});
    const ctxPie=document.getElementById('pieSent'); const ctxLine=document.getElementById('lineTrend');
    if(ctxPie){
      const labels=Object.keys(sentiments), vals=Object.values(sentiments);
      if(!pie){ pie=new Chart(ctxPie,{type:'pie',data:{labels,datasets:[{data:vals,backgroundColor:['#00BFA6','#EF476F','#9CA3AF']} ]}}); }
      else { pie.data.labels=labels; pie.data.datasets[0].data=vals; pie.update(); }
    }
    if(ctxLine){
      const labels=Object.keys(trend), vals=Object.values(trend);
      if(!line){ line=new Chart(ctxLine,{type:'line',data:{labels,datasets:[{label:'Feedback Volume',data:vals,borderColor:'#007BFF',backgroundColor:'rgba(0,123,255,.15)'}]}}); }
      else { line.data.labels=labels; line.data.datasets[0].data=vals; line.update(); }
    }
  }
  function filter(arr){return arr.filter(t=>{
    if(qType.value && t.serviceType!==qType.value) return false;
    if(qSearch.value && !(t.message?.toLowerCase().includes(qSearch.value.toLowerCase())||t.bookingId?.toLowerCase().includes(qSearch.value.toLowerCase()))) return false;
    if(!withinRange(t.date)) return false; return true;
  });}
  function render(){const rows=filter(cache); tbody.innerHTML=rows.map(t=>`
    <tr>
      <td>${t.bookingId||'-'}</td>
      <td>${t.serviceType||'-'}</td>
      <td>${t.category?`<span class=\"chip ${String(t.category).toLowerCase()}\">${t.category}</span>`:'-'}</td>
      <td>${Number(t.rating||0)}/5</td>
      <td><span class="badge">${t.sentiment||'-'}${t.confidence!=null?` (${Number(t.confidence).toFixed(2)})`:''}</span></td>
      <td>${t.date||'-'}</td>
    </tr>`).join('')||'<tr><td colspan="5">No feedback yet</td></tr>';
    updateCharts(rows);
  }
  ['change','input'].forEach(ev=>{ qType?.addEventListener(ev,render); qStart?.addEventListener(ev,render); qEnd?.addEventListener(ev,render); qSearch?.addEventListener(ev,render); });
  document.getElementById('export-csv')?.addEventListener('click',()=>{
    const rows=[['bookingId','serviceType','category','rating','sentiment','confidence','date'],...filter(cache).map(t=>[t.bookingId||'',t.serviceType||'',t.category||'',t.rating||'',t.sentiment||'',t.confidence||'',t.date||''])];
    const csv=rows.map(r=>r.join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='my-feedback.csv'; a.click();
  });
  async function load(){ spinner.show(); try{ await fetchAll(); render(); } finally{ spinner.hide(); } }
  load();
})();

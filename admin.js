// Admin dashboard charts
(function(){
  const $=(s,c=document)=>c.querySelector(s); if(!$('#kpi-total')) return;
  // Simulate loading
  try{ spinner.show(); }catch{}
  function getAllLocal(){return JSON.parse(localStorage.getItem('st_feedback')||'[]');}
  function summarize(rows){
    const filtered=rows.filter(t=>String(t.serviceType||'')==='Movie');
    const total=filtered.length;
    const avgRating = total? (filtered.reduce((a,b)=>a+Number(b.rating||0),0)/total):0;
    const sentiments=filtered.reduce((m,t)=>{m[t.sentiment]=(m[t.sentiment]||0)+1; return m;},{Positive:0,Negative:0,Neutral:0});
    const byServiceAvg = filtered.reduce((m,t)=>{const k=t.serviceType||'Other'; m[k]=m[k]||{sum:0,count:0}; m[k].sum+=Number(t.rating||0); m[k].count++; return m;},{});
    const byService = Object.fromEntries(Object.entries(byServiceAvg).map(([k,v])=>[k, v.count? (v.sum/v.count):0]));
    const byCategory = filtered.reduce((m,t)=>{const k=t.category||'Other'; m[k]=(m[k]||0)+1; return m;},{});
    const trend = filtered.reduce((m,t)=>{const d=(t.date||'').slice(0,10); if(!d) return m; m[d]=(m[d]||0)+1; return m;},{});
    return {rows:filtered,total,avgRating, sentiments, byService, byCategory, trend};
  }
  async function load(){
    try{
      const r=await fetch('/api/feedback-summary'); if(!r.ok) throw new Error('net'); const s=await r.json(); if(!s?.ok) throw new Error('bad');
      // Recompute client-side using returned rows, restricting to Movie only
      return summarize(s.rows||[]);
    }catch{
      return summarize(getAllLocal());
    }
  }
  (async function init(){
    const {rows,total,avgRating,sentiments,byService,byCategory,trend}=await load();
    $('#kpi-total').textContent=total; $('#kpi-revenue').textContent=Number(avgRating||0).toFixed(2); 
    const pos = sentiments?.Positive||0; const ratio = total? Math.round((pos/total)*100):0; $('#kpi-popular').textContent=ratio+"%";
    const bar=new Chart(document.getElementById('barService'),{type:'bar',data:{labels:Object.keys(byService),datasets:[{label:'Avg Rating',data:Object.values(byService),backgroundColor:'#007BFF'}]}});
    const dough=new Chart(document.getElementById('doughPlatform'),{type:'doughnut',data:{labels:Object.keys(byCategory),datasets:[{data:Object.values(byCategory),backgroundColor:['#007BFF','#00BFA6','#9CA3AF','#FFB703','#EF476F']} ]}});
    const line=new Chart(document.getElementById('lineTrend'),{type:'line',data:{labels:Object.keys(trend),datasets:[{label:'Feedback Volume',data:Object.values(trend),borderColor:'#00BFA6',backgroundColor:'rgba(0,191,166,.2)'}]}});
    // table
    const tbody=document.getElementById('admin-tbody'); if(tbody){ tbody.innerHTML=rows.map(t=>`<tr><td>${t.bookingId||'-'}</td><td>${t.serviceType||'-'}</td><td>${t.category||'-'}</td><td>${t.rating||'-'}</td><td>${t.sentiment||'-'} (${(t.confidence??'').toString().replace(/^(\d(?:\.\d+)?).*/,'$1')})</td><td>${t.date||'-'}</td></tr>`).join('')||'<tr><td colspan="6">No feedback yet</td></tr>'; }
    // Export
    document.getElementById('export-csv')?.addEventListener('click',()=>{
      const rowsCsv=[["bookingId","serviceType","category","rating","sentiment","confidence","date"],...rows.map(t=>[t.bookingId||'',t.serviceType||'',t.category||'',t.rating||'',t.sentiment||'',t.confidence||'',t.date||''])];
      const csv=rowsCsv.map(r=>r.join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='bookings.csv'; a.click();
    });
    document.getElementById('export-json')?.addEventListener('click',()=>{
      const blob=new Blob([JSON.stringify(rows,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='feedback.json'; a.click();
    });
    try{ spinner.hide(); }catch{}
  })();
})();

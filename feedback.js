// Feedback submission with 5-star rating
(function(){
  const $=(s,c=document)=>c.querySelector(s); const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const form=$('#feedback-form'); if(!form) return;
  const stars=$$('#stars .star'); const ratingInput=form.rating; const modal=$('#feedback-modal'); const modalBody=$('#feedback-result');
  function setStars(val){ stars.forEach((el,i)=>{ el.classList.toggle('active', i<val); }); ratingInput.value=val; }
  stars.forEach((el,idx)=>{ el.addEventListener('click',()=>setStars(idx+1)); el.addEventListener('mouseover',()=>setStars(idx+1)); });
  $('#stars')?.addEventListener('mouseleave',()=>{ setStars(Number(ratingInput.value||0)); });
  setStars(Number(ratingInput.value||0));
  function detectSentiment(msg=''){
    const s=(msg||'').toLowerCase();
    const pos=['good','great','excellent','love','nice','amazing','smooth','fast','easy','helpful'];
    const neg=['bad','poor','terrible','slow','hate','issue','problem','bug','worst'];
    let score=0; pos.forEach(w=>{if(s.includes(w)) score++;}); neg.forEach(w=>{if(s.includes(w)) score--;});
    if(score>0) return 'Positive'; if(score<0) return 'Negative'; return 'Neutral';
  }
  function saveLocal(rec){
    const arr=JSON.parse(localStorage.getItem('st_feedback')||'[]'); arr.unshift(rec); localStorage.setItem('st_feedback',JSON.stringify(arr));
  }
  function validate(){
    if(!form.email.value) throw new Error('Email is required');
    if(!form.platform.value) throw new Error('Platform is required');
    const rv=Number(form.rating.value);
    if(!(rv>=1 && rv<=5)) throw new Error('Please select a rating 1–5');
    if(!form.message.value) throw new Error('Please enter your feedback');
  }
  form.addEventListener('submit',async e=>{
    e.preventDefault(); try{ validate(); }catch(err){ toast(err.message,'error'); return; }
    spinner.show();
    const payload={
      name:form.name.value,
      email:form.email.value,
      serviceType:form.serviceType.value,
      platform:form.platform.value,
      rating:Number(form.rating.value),
      message:form.message.value,
      date:'',
      location:''
    };
    try{
      const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(!r.ok) throw new Error('Network');
      const data=await r.json();
      const sentiment=(data&&data.sentiment)||detectSentiment(payload.message);
      modalBody.innerHTML=`<div class="card" style="text-align:center">
        <img src="https://cdn-icons-png.flaticon.com/512/3416/3416042.png" alt="icon" style="width:56px;margin:0 auto 8px">
        <h3>Thank you for your feedback!</h3>
        <p>Sentiment detected: <b>${sentiment}</b></p>
        <p>Rating: <b>${payload.rating}/5</b></p>
        <div class="cta" style="margin-top:10px">
          <a class="btn btn-primary" href="my-feedback.html">View My Feedback</a>
        </div>
      </div>`;
      modal.classList.add('active'); toast('Feedback submitted!'); form.reset(); setStars(0);
    }catch(err){
      // Fallback to local storage
      const sentiment=detectSentiment(payload.message);
      const rec={ id:'LOCAL-'+Date.now(), sentiment, created_at:new Date().toISOString(), ...payload };
      saveLocal(rec);
      modalBody.innerHTML=`<div class="card" style="text-align:center">
        <img src="https://cdn-icons-png.flaticon.com/512/3416/3416042.png" alt="icon" style="width:56px;margin:0 auto 8px">
        <h3>Thank you for your feedback!</h3>
        <p>Saved locally (offline). Sentiment: <b>${sentiment}</b></p>
        <p>Rating: <b>${payload.rating}/5</b></p>
        <div class="cta" style="margin-top:10px">
          <a class="btn btn-primary" href="my-feedback.html">View My Feedback</a>
        </div>
      </div>`;
      modal.classList.add('active'); toast('Feedback saved (offline)'); form.reset(); setStars(0);
    }
    finally{ spinner.hide(); }
  });
})();

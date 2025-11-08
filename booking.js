// Booking page interactions
(function(){
  const $=(s,c=document)=>c.querySelector(s); const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const form=$('#booking-form'); if(!form) return;
  const priceEl=$('#total-price'); const qty=form.tickets; const type=form.type;
  const PRICES={Movie:200,Train:600,Bus:350,Event:500};
  function calc(){const base=PRICES[type.value]||400; const total=base*Number(qty.value||1); priceEl.textContent='₹'+total; return total;}
  ['change','input'].forEach(ev=>{qty.addEventListener(ev,calc); type.addEventListener(ev,calc)}); calc();
  function makeId(){return 'TKT'+Math.random().toString(36).slice(2,8).toUpperCase();}
  async function apiBook(payload){try{const r=await fetch('/api/book',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); if(!r.ok) throw new Error('Network'); return await r.json();}catch{ return {ok:true, id:makeId()};}}
  function saveTicket(t){const arr=JSON.parse(localStorage.getItem('st_tickets')||'[]'); arr.push(t); localStorage.setItem('st_tickets',JSON.stringify(arr));}
  const modal=$('#confirm-modal'); const modalBody=$('#confirm-body'); const closeBtn=$('#close-modal');
  closeBtn?.addEventListener('click',()=>modal.classList.remove('active'));
  form.addEventListener('submit',async e=>{e.preventDefault(); spinner.show(); const payload={
    name:form.name.value,email:form.email.value,type:form.type.value,
    target:form.target.value,date:form.date.value,tickets:Number(form.tickets.value),
    pay:form.pay.value, price:calc()
  };
  const res=await apiBook(payload); spinner.hide(); if(res){
    const ticket={id:res.id||makeId(), status:'Confirmed', ...payload}; saveTicket(ticket);
    modalBody.innerHTML=`<div class="card" style="text-align:center">
      <img src="https://cdn-icons-png.flaticon.com/512/3416/3416042.png" alt="ticket" style="width:56px;margin:0 auto 8px">
      <h3>Booking Confirmed</h3>
      <p>ID: <b>${ticket.id}</b></p>
      <p>${ticket.type} • ${ticket.target} • ${ticket.date} • Qty ${ticket.tickets}</p>
      <p class="price">Total: ₹${ticket.price}</p>
      <div class="cta" style="margin-top:10px">
        <a class="btn btn-primary" href="my-tickets.html">View My Tickets</a>
        <button id="dl-btn" class="btn">Download Ticket</button>
      </div>
    </div>`;
    modal.classList.add('active'); toast('Booking successful');
    $('#dl-btn')?.addEventListener('click',()=>window.print());
  } else { toast('Booking failed','error'); }
  });
})();

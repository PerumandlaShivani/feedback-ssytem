// Auth: login/register/guest
(function(){
  const $=(s,c=document)=>c.querySelector(s);
  const formLogin=$('#login-form');
  const formReg=$('#register-form');
  function saveUser(u){localStorage.setItem('st_user',JSON.stringify(u));}
  function goFeedback(){location.href='feedback.html';}
  function getUsers(){return JSON.parse(localStorage.getItem('st_users')||'[]');}
  function setUsers(arr){localStorage.setItem('st_users',JSON.stringify(arr));}
  const norm=(s)=>String(s||'').trim().toLowerCase();
  const validPwd=(p)=>typeof p==='string' && p.length>=8 && /[A-Za-z]/.test(p) && /\d/.test(p);
  formLogin?.addEventListener('submit',async e=>{e.preventDefault();spinner.show();try{const email=norm(e.target.email.value); const pwd=e.target.password.value; if(!email||!pwd) throw new Error('Enter credentials'); const users=getUsers(); const u=users.find(x=>norm(x.email)===email && x.password===pwd); if(!u) throw new Error('Invalid email or password'); saveUser({name:u.name,email:u.email}); toast(`Welcome back${u.name?`, ${u.name}`:''}!`); 
    goFeedback(); } catch(err){ toast(err.message||'Login failed','error'); } finally{ spinner.hide(); }});
  formReg?.addEventListener('submit',async e=>{e.preventDefault();spinner.show();try{const name=e.target.name.value; const emailRaw=e.target.email.value; const email=norm(emailRaw); const pwd=e.target.password.value; if(!name||!email||!pwd) throw new Error('Fill all fields'); if(!validPwd(pwd)) throw new Error('Password must be 8+ chars and include letters and numbers'); const users=getUsers(); if(users.some(x=>norm(x.email)===email)) throw new Error('Email already registered'); users.push({name,email:emailRaw.trim(),password:pwd}); setUsers(users); toast(`Account created. Please login, ${name}.`); location.href='login.html'; } catch(err){ toast(err.message||'Register failed','error'); } finally{ spinner.hide(); }});
  // Remove/disable guest: if present, redirect to register
  $('#guest-btn')?.addEventListener('click',()=>{ toast('Please register to continue'); location.href='register.html';});
  // Forgot password: request email link (server sends via Ethereal/test SMTP)
  $('#forgot-link')?.addEventListener('click',async(e)=>{
    e.preventDefault();
    try{
      const emailField=document.querySelector('#login-form input[name="email"]');
      const email = norm((emailField?.value)||prompt('Enter your registered email:')||'');
      if(!email) return; const users=getUsers(); const i=users.findIndex(x=>norm(x.email)===email); if(i<0){ toast('No account with that email','error'); return; }
      spinner.show();
      const r=await fetch('/api/auth/request-reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
      if(!r.ok) throw new Error('Failed to send email'); const data=await r.json();
      toast('Reset email sent. Open the link from your inbox.');
      if(data.previewUrl){ console.log('Email preview:', data.previewUrl); toast('Preview link logged to console'); }
    }catch(err){ toast(err.message||'Failed to request reset','error'); }
    finally{ spinner.hide(); }
  });

  // Handle reset.html: set new password using token validated by server
  if((location.pathname.split('/').pop()||'')==='reset.html'){
    const formReset=document.querySelector('#reset-form');
    formReset?.addEventListener('submit',async ev=>{
      ev.preventDefault();
      const token=new URLSearchParams(location.search).get('token')||'';
      const np=ev.target.password.value; const cp=ev.target.confirm.value;
      if(!validPwd(np)) { toast('Password must be 8+ chars with letters and numbers','error'); return; }
      if(np!==cp){ toast('Passwords do not match','error'); return; }
      try{
        spinner.show();
        const r=await fetch('/api/auth/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});
        const data=await r.json(); if(!r.ok||!data.ok) throw new Error(data.error||'Invalid or expired token');
        const email=norm(data.email||''); if(!email) throw new Error('No email in token');
        const users=getUsers(); const idx=users.findIndex(x=>norm(x.email)===email); if(idx<0) throw new Error('Account not found');
        users[idx].password=np; setUsers(users); toast('Password updated. Please login.'); location.href='login.html';
      }catch(err){ toast(err.message||'Reset failed','error'); }
      finally{ spinner.hide(); }
    });
  }
})();

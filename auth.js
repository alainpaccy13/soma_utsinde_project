(function(){
  var loginBtn=document.getElementById('loginBtn');
  var loginEmail=document.getElementById('loginEmail');
  var loginPassword=document.getElementById('loginPassword');
  var loginMsg=document.getElementById('loginMsg');
  var changePwdCard=document.getElementById('changePwdCard');
  var oldPassword=document.getElementById('oldPassword');
  var newPassword=document.getElementById('newPassword');
  var changePwdBtn=document.getElementById('changePwdBtn');
  var changePwdMsg=document.getElementById('changePwdMsg');
  var registerBtn=document.getElementById('registerBtn');
  var regName=document.getElementById('regName');
  var regEmail=document.getElementById('regEmail');
  var regPassword=document.getElementById('regPassword');
  var regMsg=document.getElementById('regMsg');

  function setMsg(el, text){ if(el){ el.textContent=text; } }
  function saveToken(token){ try{ localStorage.setItem('auth_token', token); }catch(e){} }
  function getToken(){ try{ return localStorage.getItem('auth_token'); }catch(e){ return null; } }
  function fetchJSON(url, opts){ return fetch(url, opts).then(function(r){ return r.ok?r.json():Promise.reject(r); }); }

  function showChangePwdIfLoggedIn(){
    var token=getToken();
    if(token && changePwdCard){ changePwdCard.style.display='block'; }
  }

  async function api(path, method, body){
    const res = await fetch(path, {
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      body: body? JSON.stringify(body): undefined
    });
    if(!res.ok){ throw new Error('request_failed'); }
    return res.json();
  }

  if(loginBtn){
    loginBtn.addEventListener('click', async function(){
      setMsg(loginMsg,'');
      try{
        const data = await api('/api/login','POST',{ email: loginEmail.value.trim(), password: loginPassword.value });
        saveToken(data.token);
        setMsg(loginMsg,'Logged in. Redirecting...');
        var next = new URLSearchParams(location.search).get('next') || 'report.html';
        setTimeout(function(){ window.location.href=next; }, 300);
      }catch(e){ setMsg(loginMsg,'Login failed. Check email/password.'); }
    });
  }

  if(changePwdBtn){
    changePwdBtn.addEventListener('click', async function(){
      setMsg(changePwdMsg,'');
      var token=getToken(); if(!token){ setMsg(changePwdMsg,'Please login first.'); return; }
      try{
        await fetchJSON('/api/change_password', { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': 'Bearer '+token }, body: JSON.stringify({ old_password: oldPassword.value, new_password: newPassword.value }) });
        setMsg(changePwdMsg,'Password updated.');
        oldPassword.value=''; newPassword.value='';
      }catch(e){ setMsg(changePwdMsg,'Failed to update password. Check your current password.'); }
    });
  }

  if(registerBtn){
    registerBtn.addEventListener('click', async function(){
      setMsg(regMsg,'');
      try{
        var body={ name: (regName?regName.value.trim():''), email: (regEmail?regEmail.value.trim():''), password: (regPassword?regPassword.value:'') };
        const res = await fetch('/api/register', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
        if(!res.ok){
          var errTxt='Registration failed.';
          try{ var ej=await res.json(); if(ej && ej.error==='email_in_use') errTxt='Email already in use.'; if(ej && ej.error==='weak_password') errTxt='Weak password. Use 8+ chars with upper, lower and digit.'; }catch(_){ }
          throw new Error(errTxt);
        }
        const data = await res.json();
        saveToken(data.token);
        setMsg(regMsg,'Account created. Redirecting...');
        setTimeout(function(){ window.location.href='report.html'; }, 500);
      }catch(e){ setMsg(regMsg, e.message || 'Registration failed.'); }
    });
  }

  showChangePwdIfLoggedIn();
})();

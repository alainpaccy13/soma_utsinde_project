(function(){
  var usersBody=document.getElementById('usersBody');
  var reloadBtn=document.getElementById('reloadBtn');
  var adminMsg=document.getElementById('adminMsg');

  function setMsg(t){ if(adminMsg){ adminMsg.textContent=t||''; } }
  function token(){ try{ return localStorage.getItem('auth_token'); }catch(e){ return null; } }
  function fetchJSON(url, opts){ return fetch(url, opts).then(function(r){ return r.ok?r.json():r.json().catch(function(){return {error:'request_failed'};}).then(function(ej){ var err=new Error('request_failed'); err.data=ej; throw err; }); }); }

  function requireAdmin(){
    var tk=token(); if(!tk){ window.location.href='login.html?next=admin.html'; return; }
    fetchJSON('/api/me',{ headers:{ 'Authorization':'Bearer '+tk }}).then(function(data){
      if(!data || !data.user || !data.user.admin){ window.location.href='index.html'; }
    }).catch(function(){ window.location.href='index.html'; });
  }

  function renderUsers(list){
    if(!usersBody) return;
    usersBody.innerHTML='';
    list.forEach(function(u){
      var tr=document.createElement('tr');
      tr.innerHTML=
        '<td style="padding:8px;border-bottom:1px solid #1f2a44">'+u.id+'</td>'+
        '<td style="padding:8px;border-bottom:1px solid #1f2a44"><input data-k="name" data-id="'+u.id+'" class="btn" style="padding:6px;width:180px" value="'+(u.name||'')+'"/></td>'+
        '<td style="padding:8px;border-bottom:1px solid #1f2a44"><input data-k="email" data-id="'+u.id+'" class="btn" style="padding:6px;width:220px" value="'+(u.email||'')+'"/></td>'+
        '<td style="padding:8px;border-bottom:1px solid #1f2a44"><input type="checkbox" data-k="verified" data-id="'+u.id+'" '+(u.verified? 'checked':'')+' /></td>'+
        '<td style="padding:8px;border-bottom:1px solid #1f2a44"><input type="checkbox" data-k="admin" data-id="'+u.id+'" '+(u.admin? 'checked':'')+' /></td>'+
        '<td style="padding:8px;border-bottom:1px solid #1f2a44">'
          +'<button class="btn" data-act="save" data-id="'+u.id+'" style="margin-right:6px">Save</button>'
          +'<button class="btn" data-act="del" data-id="'+u.id+'" style="background:#7f1d1d;border-color:#7f1d1d">Delete</button>'
        +'</td>';
      usersBody.appendChild(tr);
    });
  }

  function loadUsers(){
    setMsg('');
    var tk=token(); if(!tk){ return; }
    fetchJSON('/api/admin/users',{ headers:{ 'Authorization':'Bearer '+tk }}).then(function(data){
      renderUsers(data.users||[]);
    }).catch(function(err){ setMsg('Failed to load users'); });
  }

  function onAction(e){
    var t=e.target; if(!t) return;
    var act=t.getAttribute('data-act'); var id=t.getAttribute('data-id');
    if(!act||!id) return;
    var tk=token(); if(!tk) return;
    if(act==='save'){
      var name=document.querySelector('input[data-k="name"][data-id="'+id+'"]').value.trim();
      var email=document.querySelector('input[data-k="email"][data-id="'+id+'"]').value.trim();
      var verified=document.querySelector('input[data-k="verified"][data-id="'+id+'"]').checked?1:0;
      var admin=document.querySelector('input[data-k="admin"][data-id="'+id+'"]').checked?1:0;
      fetchJSON('/api/admin/users/'+id, { method:'PATCH', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+tk }, body: JSON.stringify({name:name,email:email,verified:verified,admin:admin}) })
      .then(function(){ setMsg('Saved user '+id); })
      .catch(function(){ setMsg('Failed to save user'); });
    } else if(act==='del'){
      if(!confirm('Delete user '+id+'? This will remove attempts too.')) return;
      fetchJSON('/api/admin/users/'+id, { method:'DELETE', headers:{ 'Authorization':'Bearer '+tk } })
      .then(function(){ setMsg('Deleted user '+id); loadUsers(); })
      .catch(function(){ setMsg('Failed to delete user'); });
    }
  }

  if(usersBody){ usersBody.addEventListener('click', onAction); }
  if(reloadBtn){ reloadBtn.addEventListener('click', loadUsers); }

  requireAdmin();
  loadUsers();
})();

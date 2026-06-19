// ============================================================
// AUTH SYSTEM
// ============================================================
let S_USER = null;  // {resId, name, isAdmin, teams:[]}
const _adminMap = new Map(); // resId -> isAdmin (source of truth, loaded from /auth/)
let _mustChangePw = false;

async function sha256(str){
  try{
    const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }catch(e){
    // Fallback para contextos sem HTTPS (ex: simulador, http local)
    // Ambos os lados usam o mesmo fallback → login funciona na mesma
    let h=5381;
    for(let i=0;i<str.length;i++) h=((h<<5)+h)^str.charCodeAt(i);
    return 'fb_'+(h>>>0).toString(16)+'_'+str.length;
  }
}

function authPath(resId){ return _FB_ROOT+`/auth/${resId}.json`; }
async function loadAuth(resId){
  try{ const r=await fetch(authPath(resId)); if(r.ok){ const d=await r.json(); return d; } }catch(e){}
  return null;
}
async function saveAuth(resId,data){
  try{ await fetch(authPath(resId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}); }catch(e){}
}

function canEditGantt(){
  if(!S_USER) return false;
  return S_USER.isAdmin===true;
}
function getEditableTeams(){
  if(!S_USER||!S_USER.isAdmin) return [];
  return TEAMS.map(t=>t.id);
}
function canEditTask(t){
  return S_USER?.isAdmin===true;
}
function isAdmin(){ return S_USER?.isAdmin||false; }

function updateSidebarUser(){
  if(!S_USER) return;
  const r=getRes(S_USER.resId);
  document.getElementById('sb-av').textContent=r?.initials||'?';
  document.getElementById('sb-av').className=`av av-lg ${r?.avClass||'av-b'}`;
  document.getElementById('sb-name').textContent=S_USER.name;
  document.getElementById('sb-role').textContent=
    (S_USER.isAdmin?'Admin · ':'')+( r?.role||'');
}

window.showUserMenu=()=>{
  const el=document.getElementById('user-menu');
  if(el.style.display==='block'){closeUserMenu();return;}
  document.getElementById('um-name').textContent=S_USER?.name||'';
  const adminSep=document.getElementById('um-admin-sep');
  const adminBtn=document.getElementById('um-admin-btn');
  adminSep.style.display=isAdmin()?'':'none';
  adminBtn.style.display=isAdmin()?'':'none';
  const sb=document.getElementById('sb-user').getBoundingClientRect();
  el.style.left=sb.left+'px';
  el.style.bottom=(window.innerHeight-sb.top+4)+'px';
  el.style.display='block';
};
window.closeUserMenu=()=>{ document.getElementById('user-menu').style.display='none'; };
document.addEventListener('click',e=>{
  if(!document.getElementById('user-menu').contains(e.target)&&
     !document.getElementById('sb-user').contains(e.target))
    closeUserMenu();
});

// Returns a Promise that resolves only when user is logged in
function initLogin(){
  // Invalidate old sessions on version change
  const APP_VER='v6';
  if(sessionStorage.getItem('pg_ver')!==APP_VER){
    sessionStorage.clear();
    localStorage.removeItem('pg_timer');
    sessionStorage.setItem('pg_ver',APP_VER);
  }

  // If valid session exists, restore it — re-fetch isAdmin from Firebase to pick up changes
  try{
    const sess=JSON.parse(sessionStorage.getItem('pg_sess')||'null');
    if(sess&&sess.resId&&getRes(sess.resId)){
      S_USER=sess;
      updateSidebarUser();
      // Re-fetch auth to get latest isAdmin value (may have changed since last login)
      return loadAuth(sess.resId).then(authData=>{
        if(authData){
          S_USER.isAdmin=authData.isAdmin||sess.resId==='pp';
          sessionStorage.setItem('pg_sess',JSON.stringify(S_USER));
          updateSidebarUser();
        }
      }).catch(()=>{});
    }
  }catch(e){}

  // Show login modal and block until user logs in
  const sel=document.getElementById('login-user');
  if(sel){
    sel.innerHTML='<option value="">— select —</option>'+
      RESOURCES
        .filter(r=>r.name.toLowerCase()!=='outros recursos')
        .slice().sort((a,b)=>a.name.localeCompare(b.name))
        .map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  }
  const modal=document.getElementById('m-login');
  if(modal) modal.style.display='flex';

  // Return promise resolved by doLogin
  return new Promise(resolve=>{ window._loginResolve=resolve; });
}

window.doLogin=async()=>{
  const resId=document.getElementById('login-user').value;
  const pass=document.getElementById('login-pass').value;
  const errEl=document.getElementById('login-err');
  errEl.style.display='none';
  if(!resId){errEl.textContent='Please select a user';errEl.style.display='';return;}
  if(!pass){errEl.textContent='Please enter your password';errEl.style.display='';return;}

  const r=getRes(resId);
  if(!r){errEl.textContent='User not found';errEl.style.display='';return;}
  let authData=await loadAuth(resId);

  // First time ever: create auth record with default password = resource name
  if(!authData){
    const defHash=await sha256(r.name.toLowerCase().replace(/\s+/g,''));
    // pp is admin by default
    authData={hash:defHash, mustChange:true, isAdmin:resId==='pp'};
    await saveAuth(resId,authData);
  }

  const inputHash=await sha256(pass);
  if(inputHash!==authData.hash){
    errEl.textContent='Wrong password';errEl.style.display='';return;
  }

  // Login success
  S_USER={resId, name:r.name, isAdmin:authData.isAdmin||resId==='pp', teams:r.teams||[]};
  sessionStorage.setItem('pg_sess',JSON.stringify(S_USER));
  sessionStorage.setItem('pg_ver','v6');
  document.getElementById('m-login').style.display='none';
  updateSidebarUser();
  if(window._loginResolve){ window._loginResolve(); window._loginResolve=null; }

  if(authData.mustChange){
    _mustChangePw=true;
    document.getElementById('chpw-sub').textContent='First login — set your personal password';
    OM('m-chpw');
  }
};

window.doChangePw=async()=>{
  const np=document.getElementById('chpw-new').value;
  const cf=document.getElementById('chpw-cf').value;
  const errEl=document.getElementById('chpw-err');
  errEl.style.display='none';
  if(np.length<6){errEl.textContent='Mínimo 6 caracteres';errEl.style.display='';return;}
  if(np!==cf){errEl.textContent='As palavras-passe não coincidem';errEl.style.display='';return;}
  const h=await sha256(np);
  const cur=await loadAuth(S_USER.resId)||{};
  await saveAuth(S_USER.resId,{...cur,hash:h,mustChange:false});
  _mustChangePw=false;
  CM('m-chpw');
  ['chpw-new','chpw-cf'].forEach(id=>document.getElementById(id).value='');
  notify('Password alterada ✓','success');
};

window.doLogout=()=>{
  sessionStorage.removeItem('pg_sess');
  location.reload();
};

// Admin: reset password for a user (sets to resource name, mustChange=true)
window.adminClearLogs=async()=>{
  if(!isAdmin()){notify('Admins only','warn');return;}
  if(!confirm('Clear ALL time logs from ALL tasks? This cannot be undone.')) return;
  TASKS.forEach(t=>{ t.timeLogs=[]; t.prog=0; delete t._originalPlanned; delete t._freeSegDays; t.startedAt=null; t.segments=null; });
  localStorage.removeItem('pg_timer');
  _timerState={};
  clearInterval(_timerInterval); _timerInterval=null;
  try{
    await fetch(_FB_ROOT+'/tasks.json',{method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(_toObj(TASKS))});
    await fetch(_FB_ROOT+'/meta.json',{method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(_buildMeta())});
    _lastSaveTs=Date.now();
  }catch(e){}
  saveLocal();
  notify('All time logs cleared ✓','success');
  _reRenderCurrent();
};

window.adminFixData=async()=>{
  if(!isAdmin()){notify('Admins only','warn');return;}
  // Force recalculate resHours and teamIds for every task
  TASKS.forEach(t=>{
    const allIds=[t.resId,...(t.coResIds||[])].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
    if(!allIds.length) return;
    // Always redistribute hours equally
    const total=tHours(t);
    const each=Math.round(total/allIds.length*10)/10;
    t.resHours={};
    allIds.forEach((id,i)=>{ t.resHours[id]=i===allIds.length-1?Math.round((total-each*i)*10)/10:each; });
    // Always fix teamIds from teamId
    if(t.teamId){
      t.teamIds=[t.teamId];
      t.taskTeams=[{teamId:t.teamId,entries:allIds.map(id=>({id,hours:t.resHours[id]||0}))}];
    }
  });
  try{
    await fetch(_FB_ROOT+'/tasks.json',{method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(_toObj(TASKS))});
    await fetch(_FB_ROOT+'/meta.json',{method:'PATCH',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(_buildMeta())});
    _lastSaveTs=Date.now();
    saveLocal();
    notify(`Data fixed: ${TASKS.length} tasks updated ✓`,'success');
  }catch(e){ notify('Save failed: '+e,'warn'); }
};
window.adminResetPw=async(resId)=>{
  if(!isAdmin()) return;
  const r=getRes(resId); if(!r) return;
  addLog({type:'resource',task:r.name,from:'',to:'password reset'});
  const h=await sha256(r.name.toLowerCase().replace(/\s+/g,''));
  const cur=await loadAuth(resId)||{};
  await saveAuth(resId,{...cur,hash:h,mustChange:true});
  notify(`Password de "${r.name}" reposta para o nome do recurso`,'success');
};
// Admin: toggle admin for a user
window.adminToggleAdmin=async(resId)=>{
  if(!isAdmin()||resId==='pp') return; // pp is always admin
  const cur=await loadAuth(resId)||{isAdmin:false};
  const newAdmin=!cur.isAdmin;
  await saveAuth(resId,{...cur,isAdmin:newAdmin});
  addLog({type:'resource',task:getRes(resId)?.name||resId,from:'',to:newAdmin?'granted admin':'revoked admin'});
  notify(`Admin de ${getRes(resId)?.name} alterado`,'success');
  return newAdmin;
};

// ============================================================
// MODAL HELPERS
// ============================================================
function OM(id){ document.getElementById(id).classList.add('open'); }
function CM(id){ document.getElementById(id).classList.remove('open'); }
window.OM=OM; window.CM=CM;

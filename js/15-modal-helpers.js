
// ============================================================
// NOTIFICATION
// ============================================================
let _nt;
// ============================================================
// STATUS CYCLE + MENU
// ============================================================
const STATUS_CYCLE=['todo','done','hold','cancelled']; // doing/paused only via timer
window.cycleStatus=(taskId)=>{
  if(!isAdmin()){notify('Only admins can change task status','warn');return;}
  const t=TASKS.find(x=>x.id===taskId);
  if(!t) return;
  const hasMsLink=taskHasMilestone(taskId);
  // If has milestone link: ready→done only from milestone date onwards
  if(hasMsLink && !isAdmin() && t.status==='ready'){
    const ms=getEffectiveMilestones(taskId)[0];
    const msDay=ms?.dayIdx||0;
    if(GANTT_TODAY>=msDay){ // milestone date reached
      t.status='done'; t.prog=100;
    } else {
      notify(`Milestone "${ms?.name}" not yet reached`,'info'); return;
    }
  } else if(hasMsLink && !isAdmin() && t.status!=='done'){
    t.status='ready'; t.prog=100;
  } else {
    t.status='done'; t.prog=100;
  }
  addLog({type:'status',task:t.name,from:SLABELS[t.status]||t.status,to:'done'});
  notify(`"${t.name}" → ${t.status==='ready'?'Ready':'Done'} ✓`,'success');
  persistState(['tasks'],{tasks:[taskId]}); renderGantt(); renderDash();
};
window.showStatusMenu=(e,taskId)=>{
  const t=TASKS.find(x=>x.id===taskId);
  if(!t) return;
  const menu=document.getElementById('stat-menu');
  const hasMsLink=taskHasMilestone(taskId);
  const allowed=[hasMsLink&&!isAdmin()?'ready':'done','todo','hold','cancelled'];
  menu.innerHTML=allowed.map(s=>`
    <button onclick="setTaskStatus('${taskId}','${s}')" style="display:flex;align-items:center;gap:7px;width:100%;background:${t.status===s?'var(--bg3)':'none'};border:none;padding:6px 10px;font-size:11px;color:${t.status===s?'var(--fg0)':'var(--fg1)'};cursor:pointer;border-radius:4px;font-family:var(--font);text-align:left">
      <span style="width:8px;height:8px;border-radius:50%;background:${SCOLS[s]};flex-shrink:0"></span>${SLABELS[s]}
    </button>`).join('');
  menu.style.display='block';
  menu.style.left=Math.min(e.clientX, window.innerWidth-150)+'px';
  menu.style.top=Math.min(e.clientY, window.innerHeight-180)+'px';
};
window.setTaskStatus=(taskId,status)=>{
  if(!isAdmin()){notify('Only admins can change task status','warn');return;}
  const t=TASKS.find(x=>x.id===taskId);
  if(!t) return;
  document.getElementById('stat-menu').style.display='none';
  if(status==='hold'){
    _showHoldDialog(taskId);
    return;
  }
  // 'doing' can only be set via the timer — redirect to tpStart
  if(status==='doing'){
    tpStart(taskId);
    return;
  }
  // If task has a milestone and user is not admin, 'done' becomes 'ready'
  if(status==='done'&&taskHasMilestone(taskId)&&!isAdmin()){
    status='ready';
    notify(`"${t.name}" → Ready (will auto-complete after milestone date)`,'success');
  }
  t.status=status;
  addLog({type:'status',task:t.name,from:SLABELS[t.status]||t.status,to:SLABELS[status]||status});
  notify(`"${t.name}" → ${SLABELS[status]}`,'success');
  persistState(['tasks'],{tasks:[taskId]}); renderGantt(); renderDash();
};
document.addEventListener('click',()=>{ const m=document.getElementById('stat-menu'); if(m) m.style.display='none'; });

// ============================================================
// EXPORT SNAPSHOT — bake live data into a self-contained HTML
// ============================================================
window.exportSnapshot=()=>{
  // Serialise current state
  const taskDaysObj={};
  TASK_DAYS.forEach((v,k)=>{taskDaysObj[k]={enabled:[...v.enabled],disabled:[...v.disabled]};});
  const resDaysObj={};
  RES_DAYS.forEach((v,k)=>{resDaysObj[k]={enabled:[...v.enabled],disabled:[...v.disabled]};});

  const snapshot={
    TASKS, PROJECTS, RESOURCES, TEAMS, PROJ,
    ENB_DAYS:[...ENB_DAYS], DIS_DAYS:[...DIS_DAYS],
    TASK_DAYS:taskDaysObj, RES_DAYS:resDaysObj
  };

  // Get the full HTML source
  const src=document.documentElement.outerHTML;

  // Replace the placeholder data blocks with live serialised data.
  // We inject a single SNAPSHOT object right after the STORE_KEY line,
  // and add a loadSnapshot() call that runs instead of loadState() on init.
  const marker='const STORE_KEY';
  const injection=`const _SNAPSHOT=${JSON.stringify(snapshot,null,0)};
const STORE_KEY`;

  // Also patch the init block to load from _SNAPSHOT if present
  const initMarker='const restored=loadState();';
  const initPatch=`const restored=_SNAPSHOT?loadSnapshot(_SNAPSHOT):loadState();`;

  let out=src
    .replace(marker, injection)
    .replace(initMarker, initPatch);

  // Inject loadSnapshot function right before persistState
  const persistMarker='function persistState(){';
  const loadSnapshotFn=`function loadSnapshot(snap){
  try{
    if(snap.TASKS) TASKS=snap.TASKS;
    if(snap.PROJECTS) PROJECTS=snap.PROJECTS;
    if(snap.RESOURCES) RESOURCES=snap.RESOURCES;
    if(snap.TEAMS) TEAMS=snap.TEAMS;
    if(snap.PROJ) Object.assign(PROJ,snap.PROJ);
    if(snap.ENB_DAYS) snap.ENB_DAYS.forEach(d=>ENB_DAYS.add(String(d)));
    if(snap.DIS_DAYS) snap.DIS_DAYS.forEach(d=>DIS_DAYS.add(String(d)));
    if(snap.TASK_DAYS) Object.entries(snap.TASK_DAYS).forEach(([k,v])=>TASK_DAYS.set(k,{enabled:new Set(v.enabled),disabled:new Set(v.disabled)}));
    if(snap.RES_DAYS) Object.entries(snap.RES_DAYS).forEach(([k,v])=>RES_DAYS.set(k,{enabled:new Set(v.enabled),disabled:new Set(v.disabled)}));
    return true;
  }catch(e){return false;}
}
function persistState(){`;

  out=out.replace(persistMarker, loadSnapshotFn);

  // Download
  const blob=new Blob([out],{type:'text/html'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  const d=new Date();
  a.download=`progest_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
  notify('Snapshot exported — open it on any computer ✓','success');
};

// ============================================================
// THEME TOGGLE
// ============================================================
window.toggleTheme=()=>{
  const isLight=document.body.classList.toggle('light');
  document.getElementById('theme-btn').innerHTML=isLight?'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.5 9.5A6 6 0 0 1 6.5 2.5 5.5 5.5 0 1 0 13.5 9.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>':'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/><line x1="8" y1="1" x2="8" y2="2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="8" y1="13.5" x2="8" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="8" x2="2.5" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="13.5" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="3.05" y1="3.05" x2="4.11" y2="4.11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="11.89" y1="11.89" x2="12.95" y2="12.95" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="12.95" y1="3.05" x2="11.89" y2="4.11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="4.11" y1="11.89" x2="3.05" y2="12.95" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  try{ localStorage.setItem('progest_theme', isLight?'light':'dark'); }catch(e){}
};
// Restore saved theme on load
(()=>{ try{ if(localStorage.getItem('progest_theme')==='light'){ document.body.classList.add('light'); document.getElementById('theme-btn').innerHTML='<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M13.5 9.5A6 6 0 0 1 6.5 2.5 5.5 5.5 0 1 0 13.5 9.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'; } }catch(e){} })();

function notify(msg,type='success'){
  const el=document.getElementById('ntf');
  el.textContent=msg;
  el.className=`ntf n${type[0]} show`;
  clearTimeout(_nt);
  _nt=setTimeout(()=>el.classList.remove('show'),3000);
}
// Error toast — 2s, larger, red, used for drag validation failures
function notifyErr(msg){
  const el=document.getElementById('ntf');
  el.textContent='⚠ '+msg;
  el.className='ntf ne show';
  el.style.fontSize='12px';
  el.style.maxWidth='360px';
  clearTimeout(_nt);
  _nt=setTimeout(()=>{ el.classList.remove('show'); el.style.fontSize=''; el.style.maxWidth=''; },2000);
}

// ============================================================
// LOCALSTORAGE PERSISTENCE
// ============================================================

// persistState: see Firebase section below

function loadState(){
  try{
    const raw=localStorage.getItem(STORE_KEY);
    if(!raw) return false;
    const data=JSON.parse(raw);
    if(data.TASKS) TASKS=data.TASKS;
    if(data.PROJECTS) PROJECTS=data.PROJECTS;
    if(data.RESOURCES) RESOURCES=data.RESOURCES;
    if(data.TEAMS) TEAMS=data.TEAMS;
    if(data.PROJ) Object.assign(PROJ,data.PROJ);
    if(data.ENB_DAYS) data.ENB_DAYS.forEach(d=>ENB_DAYS.add(String(d)));
    if(data.DIS_DAYS) data.DIS_DAYS.forEach(d=>DIS_DAYS.add(String(d)));
    if(data.TASK_DAYS){
      Object.entries(data.TASK_DAYS).forEach(([k,v])=>{
        TASK_DAYS.set(k,{enabled:new Set(v.enabled),disabled:new Set(v.disabled)});
      });
    }
    if(data.RES_DAYS){
      Object.entries(data.RES_DAYS).forEach(([k,v])=>{
        RES_DAYS.set(k,{enabled:new Set(v.enabled),disabled:new Set(v.disabled)});
      });
    }
    return true;
  } catch(e){ console.warn('load failed',e); return false; }
}


// ============================================================

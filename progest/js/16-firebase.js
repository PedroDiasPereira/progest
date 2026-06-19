// FIREBASE SYNC — conflict-free via caminhos separados
// Cada entidade tem o seu próprio path no Firebase:
//   /pg/tasks, /pg/resources, /pg/teams, /pg/projects, /pg/meta
// PATCH garante que salvar recursos não apaga tarefas e vice-versa
// ============================================================
const FIREBASE_URL = 'https://pibra-progest-default-rtdb.europe-west1.firebasedatabase.app';
const _FB_ROOT = FIREBASE_URL.replace(/\/$/, '') + '/pg';

let _lastSaveTs  = 0;
let _pendingSave = {};   // {tasks:true, resources:true, ...} — o que mudou

// ── helpers de serialização ──────────────────────────────────
const _toObj = arr => Object.fromEntries((arr||[]).map(x=>[x.id,x]));
const _toArr = obj => obj ? Object.values(obj) : [];

function _buildMeta(){
  const td={}, rd={};
  TASK_DAYS.forEach((v,k)=>{ td[k]={enabled:[...v.enabled],disabled:[...v.disabled]}; });
  RES_DAYS.forEach((v,k)=>{ rd[k]={enabled:[...v.enabled],disabled:[...v.disabled]}; });
  return {PROJ, ENB_DAYS:[...ENB_DAYS], DIS_DAYS:[...DIS_DAYS], TASK_DAYS:td, RES_DAYS:rd, COLLECTIVE_HOLIDAYS:COLLECTIVE_HOLIDAYS||[], PT_HOL_CUSTOM:PT_HOL_CUSTOM||[], ts:Date.now()};
}

function _applyMeta(m){
  if(!m) return;
  if(m.PROJ)      Object.assign(PROJ,m.PROJ);
  ENB_DAYS.clear(); (m.ENB_DAYS||[]).forEach(d=>ENB_DAYS.add(String(d)));
  DIS_DAYS.clear(); (m.DIS_DAYS||[]).forEach(d=>DIS_DAYS.add(String(d)));
  COLLECTIVE_HOLIDAYS=m.COLLECTIVE_HOLIDAYS||[];
  PT_HOL_CUSTOM=m.PT_HOL_CUSTOM||[];
  _applyCollectiveHolidays();
  TASK_DAYS.clear(); Object.entries(m.TASK_DAYS||{}).forEach(([k,v])=>
    TASK_DAYS.set(k,{enabled:new Set(v.enabled),disabled:new Set(v.disabled)}));
  RES_DAYS.clear(); Object.entries(m.RES_DAYS||{}).forEach(([k,v])=>
    RES_DAYS.set(k,{enabled:new Set(v.enabled),disabled:new Set(v.disabled)}));
}

// Merge inteligente: une arrays por ID sem perder itens locais recentes
// Registry of deleted IDs per entity — prevents _mergeArr from resurrecting them
const _deletedIds={tasks:new Set(),resources:new Set(),teams:new Set(),projects:new Set(),milestones:new Set()};

function _mergeArr(local, remote, entityKey){
  if(!remote) return local;
  const remoteMap = new Map(remote.map(x=>[x.id,x]));
  // If we have pending local changes for this entity, local wins for existing items
  const ps=_pendingSave[entityKey]; const localWins = entityKey && ps && (ps instanceof Set ? ps.size>0 : ps);
  const result = remote.map(r=>{
    const loc = local.find(l=>l.id===r.id);
    // Local wins if: we have pending saves for this entity, OR local has newer timeLogs
    if(loc && localWins) return loc;
    if(loc && Array.isArray(loc.timeLogs) && Array.isArray(r.timeLogs) && loc.timeLogs.length > r.timeLogs.length) return loc;
    // Preserve in-memory properties not stored in Firebase (e.g. _isAdmin loaded from /auth/)
    if(loc && loc._isAdmin!==undefined && r._isAdmin===undefined) r._isAdmin=loc._isAdmin;
    return r;
  });
  // Add local-only items (new items not yet on remote) — skip deleted ones
  const deleted=_deletedIds[entityKey];
  local.forEach(l=>{ if(!remoteMap.has(l.id)&&!(deleted&&deleted.has(l.id))) result.push(l); });
  // Also filter out deleted items that remote may still have (race condition)
  return deleted&&deleted.size ? result.filter(x=>!deleted.has(x.id)) : result;
}

// ── status bar ───────────────────────────────────────────────
function setSyncStatus(msg, col){
  const el=document.getElementById('sync-status');
  if(!el) return;
  el.textContent=msg; el.style.color=col||'var(--acc3)'; el.style.opacity='1';
  clearTimeout(setSyncStatus._t);
  setSyncStatus._t=setTimeout(()=>el.style.opacity='.35',3000);
}

// ── localStorage fallback ────────────────────────────────────
function loadLocal(){
  try{
    const r=localStorage.getItem(STORE_KEY);
    if(!r) return false;
    const d=JSON.parse(r);
    if(d.TASKS)     TASKS    =d.TASKS;
    if(d.GLOG&&Array.isArray(d.GLOG)) GLOG.splice(0,GLOG.length,...d.GLOG);
    if(d.PROJECTS)  PROJECTS =d.PROJECTS;
    if(d.RESOURCES) RESOURCES=d.RESOURCES;
    if(d.TEAMS)     TEAMS    =d.TEAMS;
    _applyMeta(d);
    migrateTasks(true);
    return true;
  }catch(e){return false;}
}
function saveLocal(){
  try{
    const td={},rd={};
    TASK_DAYS.forEach((v,k)=>td[k]={enabled:[...v.enabled],disabled:[...v.disabled]});
    RES_DAYS.forEach((v,k)=>rd[k]={enabled:[...v.enabled],disabled:[...v.disabled]});
    localStorage.setItem(STORE_KEY, JSON.stringify({TASKS,PROJECTS,RESOURCES,TEAMS,PROJ,GLOG:GLOG.slice(0,200),
      ENB_DAYS:[...ENB_DAYS],DIS_DAYS:[...DIS_DAYS],TASK_DAYS:td,RES_DAYS:rd}));
  }catch(e){}
}

// ── Firebase load (GET tudo de uma vez) ──────────────────────
async function fbLoad(){
  try{
    const r = await fetch(_FB_ROOT+'.json');
    if(!r.ok) throw r.status;
    const d = await r.json();
    if(!d) return false;
    if(d.tasks)     TASKS    =_toArr(d.tasks);
    if(d.logs && Array.isArray(d.logs)) GLOG.splice(0,GLOG.length,...d.logs);
    if(d.milestones) MILESTONES=_toArr(d.milestones)||[];
    if(d.resources) RESOURCES=_toArr(d.resources);
    if(d.teams)     TEAMS    =_toArr(d.teams);
    if(d.projects)  PROJECTS =_toArr(d.projects);
    _applyMeta(d.meta);
    migrateTasks(true); // suppress save during initial load
    // Only save meta on load (never overwrite tasks — would lose concurrent edits)
    const nowTs=Date.now();
    _lastSaveTs=nowTs; // suppress SSE echo
    return true;
  }catch(e){ return false; }
}

// ── Firebase PATCH — só envia o que mudou ────────────────────
async function fbFlush(){
  if(!Object.keys(_pendingSave).length) return;
  const snap=_pendingSave;
  _pendingSave={};
  // Build per-entity patches — PATCH /pg/ENTITY.json {id: item} so concurrent saves never conflict
  const sends=[];
  const _patchEntity=(path,items,ids,entityKey)=>{
    const patch={};
    if(ids.has('__all__')){ items.forEach(x=>{ patch[x.id]=x; }); }
    else { ids.forEach(id=>{ const x=items.find(i=>i.id===id); if(x) patch[x.id]=x; }); }
    // Deleted IDs are handled via explicit DELETE requests in fbFlush
    if(Object.keys(patch).length) sends.push({path,patch});
  };
  if(snap.tasks)     _patchEntity('/tasks',    TASKS,     snap.tasks,    'tasks');
  if(snap.milestones)_patchEntity('/milestones',MILESTONES,snap.milestones,'milestones');
  if(snap.resources) _patchEntity('/resources', RESOURCES, snap.resources, 'resources');
  if(snap.teams)     _patchEntity('/teams',     TEAMS,     snap.teams,     'teams');
  if(snap.projects)  _patchEntity('/projects',  PROJECTS,  snap.projects,  'projects');
  if(snap.meta)      sends.push({path:'/meta',  patch:_buildMeta()});
  if(snap.logs)      sends.push({path:'/logs',  patch:GLOG.slice(0,500),isArr:true});
  // Build explicit DELETE requests for deleted IDs
  const deletes=[];
  Object.entries(_deletedIds).forEach(([entityKey,ids])=>{
    if(!ids.size) return;
    const pathMap={tasks:'/tasks',resources:'/resources',teams:'/teams',projects:'/projects',milestones:'/milestones'};
    const basePath=pathMap[entityKey];
    if(!basePath) return;
    ids.forEach(id=>{ deletes.push(fetch(_FB_ROOT+basePath+'/'+id+'.json',{method:'DELETE'}).catch(()=>{})); });
    ids.clear(); // clear after scheduling
  });
  try{
    await Promise.all([
      ...sends.map(({path,patch,isArr})=>
        fetch(_FB_ROOT+path+'.json',{
          method:isArr?'PUT':'PATCH',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(patch)
        }).then(r=>{ if(!r.ok) throw r.status; })
      ),
      ...deletes
    ]);
    _lastSaveTs=Date.now();
    setSyncStatus('✓ saved');
  }catch(e){ setSyncStatus('⚠ offline','var(--warn)'); _pendingSave=snap; /* retry */ }
}

function persistState(changed, changedIds){
  // changed = array of entity names e.g. ['tasks'] or ['resources','meta']
  // changedIds = optional {tasks:[id1,id2], projects:[id3]} for fine-grained tracking
  const ents = changed||['tasks','resources','teams','projects','meta','milestones'];
  ents.forEach(k=>{
    if(!_pendingSave[k]) _pendingSave[k]=new Set();
    if(changedIds&&changedIds[k]) changedIds[k].forEach(id=>_pendingSave[k].add(id));
    else _pendingSave[k].add('__all__'); // mark all items changed
  });
  saveLocal();
  clearTimeout(persistState._t);
  persistState._t=setTimeout(fbFlush,300);
}

// ── SSE — recebe atualizações em tempo real ──────────────────
function startSSE(){
  const es=new EventSource(_FB_ROOT+'.json?accept=text/event-stream');

  es.addEventListener('put', e=>{
    try{
      const {path,data}=JSON.parse(e.data);
      if(!data) return;
      const ts=data.meta?.ts||data.ts||0;
      if(ts && ts>0 && ts===_lastSaveTs) return; // our own write — skip echo

      // Apply only the changed path
      if(path==='/'||path===''){
        // Initial full load
        if(data.tasks)     TASKS    =_mergeArr(TASKS,    _toArr(data.tasks),'tasks');
        if(data.resources) RESOURCES=_mergeArr(RESOURCES,_toArr(data.resources),'resources');
        if(data.teams)     TEAMS    =_mergeArr(TEAMS,    _toArr(data.teams),'teams');
        if(data.projects)  PROJECTS =_mergeArr(PROJECTS, _toArr(data.projects),'projects');
        if(data.logs&&Array.isArray(data.logs)){
          const existing=new Set(GLOG.map(e=>e.ts+'|'+e.user+'|'+e.task));
          const newE=data.logs.filter(e=>!existing.has(e.ts+'|'+e.user+'|'+e.task));
          if(newE.length){ GLOG.push(...newE); GLOG.sort((a,b)=>b.ts-a.ts); while(GLOG.length>500) GLOG.pop(); }
        }
        if(data.milestones) MILESTONES=_toArr(data.milestones)||[];
        _applyMeta(data.meta);
      } else if(path==='/tasks'){
        TASKS=_mergeArr(TASKS,_toArr(data),'tasks');
  // Clean resStart: remove entries with 0 hours (stale data)
  TASKS.forEach(t=>{
    if(!t.resStart||!t.resHours) return;
    Object.keys(t.resStart).forEach(id=>{
      if(!(t.resHours[id]>0)) delete t.resStart[id];
    });
  });
      } else if(path==='/resources'){
        RESOURCES=_mergeArr(RESOURCES,_toArr(data),'resources');
  // Sync time-off days to RES_DAYS after loading resources
  RESOURCES.forEach(r=>{ if(r.timeOff&&r.timeOff.length) _syncTimeOffToDays(r.id); });
  // Re-sync _isAdmin for all resources from Firebase auth
  Promise.all(RESOURCES.map(async r=>{
    const auth=await loadAuth(r.id).catch(()=>null);
    if(auth) r._isAdmin=auth.isAdmin===true;
  })).then(()=>{ if(S.page==='resources') renderRes(); });
      } else if(path==='/teams'){
        TEAMS=_mergeArr(TEAMS,_toArr(data),'teams');
      } else if(path==='/projects'){
        PROJECTS=_mergeArr(PROJECTS,_toArr(data),'projects');
      } else if(path==='/meta'){
        _applyMeta(data);
      } else if(path==='/logs'){
        if(Array.isArray(data)){
          // Merge incoming logs: combine with local, dedupe by ts+user, sort newest first
          const existing=new Set(GLOG.map(e=>e.ts+'|'+e.user+'|'+e.task));
          const newEntries=data.filter(e=>!existing.has(e.ts+'|'+e.user+'|'+e.task));
          if(newEntries.length){
            GLOG.push(...newEntries);
            GLOG.sort((a,b)=>b.ts-a.ts);
            while(GLOG.length>500) GLOG.pop();
          }
        }
      }

      // Run migration on received data
      migrateTasks();
      flattenSubtasksToTasks(); // promote legacy subtasks to TASKS[]
      const p=S.page;
      if(p==='gantt')         {buildSFChips();buildTagPanel();clearTimeout(window._sseRG);window._sseRG=setTimeout(renderGantt,150);}
      else if(p==='dashboard') renderDash();
      else if(p==='overview')  renderOverview();
      else if(p==='projects')  renderProjects();
      else if(p==='resources') renderRes();
      else if(p==='teams')     renderTeams();
      else if(p==='logs')      renderLogsPage();
      else if(p==='settings')  renderSettings();
      renderLog(); // always update the mini log strip
      setSyncStatus('↓ updated');
    }catch(ex){ console.warn('SSE parse error',ex); }
  });

  es.onerror=()=>setSyncStatus('⚠ offline','var(--warn)');
  es.onopen =()=>setSyncStatus('● live');
}

// ── Funções de escrita com entidades explícitas ───────────────
function uTask(id,field,value){
  const t=TASKS.find(x=>x.id===id); if(!t) return;
  if(field==='tags'&&Array.isArray(value)) t.tags=value; else t[field]=value;
  persistState(['tasks'],{tasks:[id]});
}
function delTask(id){
  const t=TASKS.find(x=>x.id===id); if(!t) return;
  const children=TASKS.filter(ch=>ch.parentId===id);
  if(children.length){
    const r=confirm('Task "'+t.name+'" has '+children.length+' sub-task(s).\n\nOK = Delete all\nCancel = Explode sub-tasks to same level');
    if(r){
      const toDelete=new Set([id]);let changed=true;
      while(changed){changed=false;TASKS.forEach(ch=>{if(ch.parentId&&toDelete.has(ch.parentId)&&!toDelete.has(ch.id)){toDelete.add(ch.id);changed=true;}});}
      for(let i=TASKS.length-1;i>=0;i--){if(toDelete.has(TASKS[i].id))TASKS.splice(i,1);}
    } else {
      if(!confirm('Explode: move sub-tasks to same level as "'+t.name+'"?')) return;
      TASKS.filter(ch=>ch.parentId===id).forEach(ch=>{ch.parentId=t.parentId||null;});
      const i2=TASKS.findIndex(x=>x.id===id);if(i2>=0)TASKS.splice(i2,1);
    }
  } else {
    if(!confirm('Delete "'+t.name+'"?')) return;
    const i2=TASKS.findIndex(x=>x.id===id);if(i2>=0)TASKS.splice(i2,1);
  }
  addLog({type:'delete',task:t.name,from:'',to:''});
  persistState(['tasks']);renderGantt();renderDash();_refreshOverview();CM('m-task');
  notify('Task deleted','success');
}
window.uRes=(i,field,value)=>{
  const r=RESOURCES[i]; if(!r) return;
  const old=r[field];
  r[field]=value;
  if(field==='name') r.initials=_getInitials(value)||'?';
  if(['name','role','dailyCap'].includes(field)&&old!==value)
    addLog({type:'resource',task:r.name||'Resource',from:String(old),to:String(value)+' ('+field+')'});
  persistState(['resources']);
};
window.uTeam=(i,field,value)=>{
  const t=TEAMS[i]; if(!t) return;
  const old=t[field];
  t[field]=value;
  if(['name','leaderId'].includes(field)&&old!==value)
    addLog({type:'team',task:t.name||'Team',from:String(old),to:String(value)+' ('+field+')'});
  persistState(['teams']);
};

// ============================================================
// ============================================================

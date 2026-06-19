// ============================================================
// PROJECTS PAGE
// ============================================================
const PROJ_STAT_LABELS={active:'Active',planning:'Planning',on_hold:'On Hold',completed:'Completed',cancelled:'Cancelled'};
const PROJ_STAT_COLS={active:'var(--ok)',planning:'var(--acc)',on_hold:'var(--warn)',completed:'var(--fg2)',cancelled:'var(--danger)'};

window.selectProjectAndGoGantt=(projId)=>{
  S._activeProjId=projId;
  const sel=document.getElementById('proj-selector');
  if(sel) sel.value=projId;
  nav('gantt');
};

let _projSort={col:null,asc:true};
window.sortProjects=(col)=>{
  if(_projSort.col===col) _projSort.asc=!_projSort.asc;
  else { _projSort.col=col; _projSort.asc=true; }
  // Update sort indicators
  ['name','deadline','status','hours','tasks','enddate','order'].forEach(c=>{
    const el=document.getElementById('proj-sort-'+c);
    if(el) el.textContent=_projSort.col===c?(_projSort.asc?' ▲':' ▼'):'';
  });
  renderProjects();
};
function _projHours(p){
  const _pts=TASKS.filter(t=>t.projId===p.id&&t.status!=='done'&&t.status!=='cancelled');
  return _pts.reduce((n,t)=>n+tHours(t),0);
}
function _projEndDate(p){
  const _pts=TASKS.filter(t=>t.projId===p.id&&t.start!=null);
  if(!_pts.length) return 0;
  const _allEnds=[..._pts.map(t=>t.start+(t.dur||1)-1)];
  _pts.forEach(t=>{ TASKS.filter(c=>c.parentId===t.id&&c.start!=null).forEach(c=>_allEnds.push(c.start+(c.dur||1)-1)); });
  return Math.max(..._allEnds);
}
function renderProjects(){
  let _sortedProjects=[...PROJECTS];
  if(_projSort.col){
    _sortedProjects.sort((a,b)=>{
      let va,vb;
      if(_projSort.col==='name'){ va=a.name||''; vb=b.name||''; return _projSort.asc?va.localeCompare(vb):vb.localeCompare(va); }
      if(_projSort.col==='deadline'){ va=a.deadline||'9999'; vb=b.deadline||'9999'; return _projSort.asc?va.localeCompare(vb):vb.localeCompare(va); }
      if(_projSort.col==='status'){ va=a.status||''; vb=b.status||''; return _projSort.asc?va.localeCompare(vb):vb.localeCompare(va); }
      if(_projSort.col==='hours'){ va=_projHours(a); vb=_projHours(b); return _projSort.asc?va-vb:vb-va; }
      if(_projSort.col==='priority'){ va=a.priorityProject??Infinity; vb=b.priorityProject??Infinity; return _projSort.asc?va-vb:vb-va; }
      if(_projSort.col==='enddate'){ va=_projEndDate(a); vb=_projEndDate(b); return _projSort.asc?va-vb:vb-va; }
      if(_projSort.col==='order'){ va=(a.orderId||'').split(',')[0].trim(); vb=(b.orderId||'').split(',')[0].trim(); return _projSort.asc?va.localeCompare(vb):vb.localeCompare(va); }
      if(_projSort.col==='tasks'){ va=TASKS.filter(t=>t.projId===a.id&&t.status!=='cancelled').length; vb=TASKS.filter(t=>t.projId===b.id&&t.status!=='cancelled').length; return _projSort.asc?va-vb:vb-va; }
      return 0;
    });
  }
  document.getElementById('proj-b').innerHTML=_sortedProjects.map((p,i)=>`<tr>
    <td style="white-space:nowrap"><span style="display:inline-flex;align-items:center;gap:7px"><span style="width:8px;height:8px;border-radius:2px;background:${p.color};flex-shrink:0"></span><span style="font-weight:500;font-size:11px;color:var(--fg0);cursor:pointer" onclick="selectProjectAndGoGantt('${p.id}')" title="Open in Gantt">${p.name}</span></span></td>
    <td style="font-size:11px;color:var(--fg2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.desc||'—'}</td>
    <td style="font-size:10px;color:var(--fg2)">${p.deadline||'—'}</td>
    <td><span class="badge" style="background:${PROJ_STAT_COLS[p.status]}22;color:${PROJ_STAT_COLS[p.status]}">${PROJ_STAT_LABELS[p.status]||p.status}</span></td>
    <td style="font-size:10px;color:var(--fg2);text-align:center">${p.priorityProject??'—'}</td>
    <td class="mono txs">${(()=>{ const _total=_projHours(p); return _total>0?`${_total%1===0?_total:_total.toFixed(1)}h`:'—'; })()}</td>
    <td class="mono txs">${(()=>{ const _c=TASKS.filter(t=>t.projId===p.id&&t.status!=='cancelled').length; return _c>0?_c:'—'; })()}</td>
    <td style="font-size:10px;color:var(--fg2)">${(()=>{ const _maxIdx=_projEndDate(p); if(!_maxIdx) return '—'; const _d=gDate(_maxIdx); return `${String(_d.getDate()).padStart(2,'0')}/${String(_d.getMonth()+1).padStart(2,'0')}/${_d.getFullYear()}`; })()}</td>
    <td style="font-size:11px;color:var(--fg2)">${p.orderId||'—'}</td>
    <td style="display:flex;gap:4px">
      <button class="btn btn-xs" onclick="openEditProject('${p.id}')">✎</button>
      <button class="btn btn-xs btn-d" onclick="delProject('${p.id}')">✕</button>
    </td>
  </tr>`).join('');
}
let _editProjId=null;
// Resources allocated to project — local state while modal is open
let _mprResIds=[];
function _mprRenderChips(){
  const el=document.getElementById('mpr-res-chips'); if(!el) return;
  if(!_mprResIds.length){ el.innerHTML=''; return; }
  el.innerHTML=_mprResIds.map(id=>{
    const r=getRes(id);
    const teamId=(r?.teams||[])[0];
    const team=TEAMS.find(t=>t.id===teamId);
    const dot=team?`<span style="width:6px;height:6px;border-radius:50%;background:${team.color};flex-shrink:0;display:inline-block"></span>`:'';
    return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;background:var(--bg2);border:1px solid var(--bd2);border-radius:20px;font-size:10px">${dot}${r?.name||id}<button onclick="_mprRemoveRes('${id}')" style="background:none;border:none;cursor:pointer;color:var(--fg3);font-size:10px;padding:0 0 0 2px">×</button></span>`;
  }).join('');
}
function _mprPopulateSel(){
  const sel=document.getElementById('mpr-res-sel'); if(!sel) return;
  // Group resources by first team, sorted by team name
  const grouped={};
  RESOURCES.forEach(r=>{
    const teamId=(r.teams||[])[0]||'_none';
    if(!grouped[teamId]) grouped[teamId]=[];
    grouped[teamId].push(r);
  });
  const teamOrder=[...TEAMS.map(t=>t.id),'_none'];
  let html='<option value="">Add resource…</option>';
  teamOrder.forEach(tid=>{
    const members=grouped[tid]; if(!members?.length) return;
    const team=TEAMS.find(t=>t.id===tid);
    const label=team?team.name:'Other';
    html+=`<optgroup label="◉ ${label}">`;
    members.forEach(r=>{ html+=`<option value="${r.id}">${r.name}</option>`; });
    html+=`</optgroup>`;
  });
  sel.innerHTML=html;
}
window._mprAddRes=()=>{
  const sel=document.getElementById('mpr-res-sel'); if(!sel||!sel.value) return;
  if(!_mprResIds.includes(sel.value)) _mprResIds.push(sel.value);
  sel.value=''; _mprRenderChips();
};
window._mprRemoveRes=(id)=>{ _mprResIds=_mprResIds.filter(x=>x!==id); _mprRenderChips(); };

function openAddProject(){
  _editProjId=null;
  _mprResIds=[];
  document.getElementById('mpr-h').textContent='New Project';
  document.getElementById('mpr-del').style.display='none';
  document.getElementById('mpr-n').value='';
  document.getElementById('mpr-desc').value='';
  document.getElementById('mpr-col').value='#4f9cf9';
  document.getElementById('mpr-stat').value='active';
  document.getElementById('mpr-start').value='';
  document.getElementById('mpr-dl').value='';
  { const _pr=document.getElementById('mpr-prio'); if(_pr) _pr.value=''; }
  document.getElementById('mpr-tags').value='';
  const _orderEl=document.getElementById('mpr-order'); if(_orderEl) _orderEl.value='';
  const _notesEl=document.getElementById('mpr-notes'); if(_notesEl) _notesEl.value='';
  const _extEl=document.getElementById('mpr-ext-id'); if(_extEl) _extEl.value='';
  _mprPopulateSel(); _mprRenderChips();
  OM('m-project');
}
function openEditProject(id){
  const p=PROJECTS.find(x=>x.id===id);
  if(!p) return;
  _editProjId=id;
  _mprResIds=[...(p.resources||[])];
  document.getElementById('mpr-h').textContent='Edit Project';
  document.getElementById('mpr-del').style.display='';
  document.getElementById('mpr-n').value=p.name;
  document.getElementById('mpr-desc').value=p.desc||'';
  document.getElementById('mpr-col').value=p.color;
  document.getElementById('mpr-stat').value=p.status||'active';
  document.getElementById('mpr-start').value=p.start||'';
  document.getElementById('mpr-dl').value=p.deadline||'';
  { const _pr=document.getElementById('mpr-prio'); if(_pr) _pr.value=(p.priorityProject==null?'':p.priorityProject); }
  document.getElementById('mpr-tags').value=(p.tags||[]).join(', ');
  const _orderEl=document.getElementById('mpr-order'); if(_orderEl) _orderEl.value=p.orderId||'';
  const _notesEl=document.getElementById('mpr-notes'); if(_notesEl) _notesEl.value=p.notes||'';
  const _extEl=document.getElementById('mpr-ext-id'); if(_extEl) _extEl.value=p.externalId||'';
  _mprPopulateSel(); _mprRenderChips();
  { const _rb=document.getElementById('mpr-revert-all');
    if(_rb){ const _hasProm=TASKS.some(t=>t.projId===id&&t.assignOrigin==='teamPromoted'); _rb.style.display=(isAdmin()&&_hasProm)?'':'none'; } }
  OM('m-project');
}
window.openEditProject=openEditProject;
window.openAddProject=openAddProject;
window.saveProject=()=>{
  const name=document.getElementById('mpr-n').value.trim();
  if(!name){notify('Project name required','warn');return;}
  const data={
    name,
    desc:document.getElementById('mpr-desc').value,
    color:document.getElementById('mpr-col').value,
    status:document.getElementById('mpr-stat').value,
    start:document.getElementById('mpr-start').value||null,
    deadline:document.getElementById('mpr-dl').value||null,
    priorityProject:(()=>{ const v=document.getElementById('mpr-prio')?.value; return v===''||v==null?null:(parseInt(v)||null); })(),
    tags:document.getElementById('mpr-tags').value.split(',').map(x=>x.trim()).filter(Boolean),
    orderId:document.getElementById('mpr-order')?.value.trim()||null,
    notes:document.getElementById('mpr-notes')?.value.trim()||null,
    externalId:document.getElementById('mpr-ext-id')?.value.trim()||null,
    resources:[..._mprResIds],
  };
  if(_editProjId){
    const p=PROJECTS.find(x=>x.id===_editProjId);
    const _pDiffs=[];
    if(p.name!==data.name) _pDiffs.push(`name: "${p.name}" → "${data.name}"`);
    if(p.deadline!==data.deadline) _pDiffs.push(`deadline: ${p.deadline||'none'} → ${data.deadline||'none'}`);
    if(p.status!==data.status) _pDiffs.push(`status: ${p.status} → ${data.status}`);
    if(p.desc!==data.desc&&data.desc) _pDiffs.push(`desc updated`);
    Object.assign(p,data);
    addLog({type:'project',task:name,from:'',to:_pDiffs.length?_pDiffs.join(' · '):'saved'});
    notify('Project updated','success');
  } else {
    PROJECTS.push({id:'p'+Date.now(),...data});
    addLog({type:'project',task:name,from:'',to:'created'});
    notify(`"${name}" created`,'success');
  }
  CM('m-project');
  renderProjects();
  persistState(['projects']);
};
const _fbDeleteProject=()=>{
  const _projMap={}; PROJECTS.forEach(p=>{ _projMap[p.id]=p; });
  return fetch(_FB_ROOT+'/projects.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(_projMap)})
    .then(()=>saveLocal()).catch(()=>notify('Error saving to server','warn'));
};
window.delEditProject=()=>{
  if(!_editProjId) return;
  if(!confirm('Delete this project? Tasks will not be deleted.')) return;
  PROJECTS=PROJECTS.filter(p=>p.id!==_editProjId);
  if(S._activeProjId===_editProjId) S._activeProjId=null;
  CM('m-project');
  renderProjects();
  _fbDeleteProject().then(()=>notify('Project deleted','warn'));
};
window.delProject=(id)=>{
  const _proj=PROJECTS.find(p=>p.id===id);
  const _projTasks=TASKS.filter(t=>t.projId===id);
  const _taskCount=_projTasks.length;
  const _projMsCount=MILESTONES.filter(m=>m.projId===id).length;
  const _details=[];
  if(_taskCount>0) _details.push(_taskCount+' task'+(_taskCount!==1?'s':''));
  if(_projMsCount>0) _details.push(_projMsCount+' milestone'+(_projMsCount!==1?'s':''));
  const _msg='Delete project "'+(_proj?.name||id)+'"?'
    +(_details.length>0?'\n\n⚠ This will also permanently delete '+_details.join(' and ')+' associated with this project.':'\n\nThis project has no tasks or milestones.')
    +'\n\nThis cannot be undone.';
  if(!confirm(_msg)) return;
  // Delete associated tasks
  if(_taskCount>0){
    _projTasks.forEach(t=>{ _deletedIds.tasks.add(t.id); addLog({type:'delete',task:t.name,from:'',to:'deleted with project'}); });
    TASKS=TASKS.filter(t=>t.projId!==id);
    persistState(['tasks'],{tasks:[..._projTasks.map(t=>t.id)]});
  }
  // Delete associated milestones
  const _projMs=MILESTONES.filter(m=>m.projId===id);
  if(_projMs.length>0){
    _projMs.forEach(m=>{ _deletedIds.milestones.add(m.id); });
    MILESTONES=MILESTONES.filter(m=>m.projId!==id);
    persistState(['milestones']);
  }
  PROJECTS=PROJECTS.filter(p=>p.id!==id);
  if(S._activeProjId===id) S._activeProjId=null;
  renderProjects();
  renderGantt();
  _refreshOverview();
  _fbDeleteProject().then(()=>notify('Project and '+_taskCount+' task'+(_taskCount!==1?'s':'')+' deleted','warn'));
};

// ============================================================

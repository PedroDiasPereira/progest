// ============================================================
// TASK MODAL
// ============================================================
function setTM(m){
  S.tm=m;
  // Legacy IDs (may not exist in new modal)
  const _tot=document.getElementById('tm-tot'); if(_tot) _tot.classList.toggle('on',m==='total');
  const _day=document.getElementById('tm-day'); if(_day) _day.classList.toggle('on',m==='daily');
  const _fht=document.getElementById('fg-ht'); if(_fht) _fht.style.display=m==='total'?'':'none';
  const _fhd=document.getElementById('fg-hd'); if(_fhd) _fhd.style.display=m==='daily'?'':'none';
}
function toggleHoldFields(){
  const isHold=document.getElementById('mt-stat').value==='hold';
  document.getElementById('hold-fields').style.display=isHold?'':'none';
}
function populateTeamSel(sel=null){
  document.getElementById('mt-team').innerHTML=
    '<option value="">— no team —</option>'+
    TEAMS.map(t=>`<option value="${t.id}" ${t.id===sel?'selected':''}>${t.name}</option>`).join('');
}
// Store resource list in a module-level variable (not DOM property which gets wiped)
// _taskTeams: [{teamId, entries:[{id,hours}]}]
let _taskTeams = [];

function _getModalTotHours(){
  const contRadio=document.getElementById('tt-cont');
  const isCont=!contRadio||contRadio.checked;
  if(isCont) return parseFloat(document.getElementById('mt-h-tot')?.value)||0;
  // Daily task: return hpd (h/day) as the per-resource value
  return parseFloat(document.getElementById('mt-h-day')?.value)||0;
}
let _hoursManuallySet=false;
function _distributeHoursAll(){
  const htot=_getModalTotHours();
  if(!htot) return;
  const contBtn=document.getElementById('tt-cont');
  const isCont=!contBtn||contBtn.checked;
  const allEntries=_taskTeams.flatMap(tt=>tt.entries);
  if(!allEntries.length) return;
  if(_hoursManuallySet) return; // user edited resource hours manually — don't overwrite
  if(!isCont){
    // Daily task: each resource gets the full hpd (they work together)
    allEntries.forEach(e=>{ e.hours=htot; });
  } else {
    // Continuous: split total equally
    const each=Math.round(htot/allEntries.length*10)/10;
    allEntries.forEach((e,i)=>{
      e.hours = i===allEntries.length-1 ? Math.round((htot-each*i)*10)/10 : each;
    });
  }
  renderTeamResList();
}
window._onTotHoursChange=()=>{ _distributeHoursAll(); };
window._onDailyHoursChange=()=>{ _distributeHoursAll(); };

function renderTeamResList(){
  const el=document.getElementById('mt-team-res-list');
  if(!el) return;
  // Update hidden fields
  const primary=_taskTeams[0]?.entries[0]?.id||'';
  document.getElementById('mt-res-id').value=primary;
  document.getElementById('mt-team').value=_taskTeams[0]?.teamId||'';

  _populateResAddFlat();
  if(!_taskTeams.length){
    el.innerHTML='<div style="font-size:11px;color:var(--fg3);padding:4px">No resources added yet.</div>';
    return;
  }

  el.innerHTML=_taskTeams.flatMap((tt,ti)=>{
    const team=getTeam(tt.teamId);
    return tt.entries.map((entry,ei)=>{
      const r=getRes(entry.id); if(!r) return '';
      return `<div style="display:flex;align-items:center;gap:5px;margin-bottom:2px">
        <span style="width:6px;height:6px;border-radius:2px;background:${team?.color||'#7a8aaa'};flex-shrink:0"></span>
        <span style="font-size:10px;color:var(--fg3);white-space:nowrap">${team?.name||tt.teamId}</span>
        <span class="av av-sm ${r.avClass}">${r.initials}</span>
        <span style="font-size:11px;flex:1;color:var(--fg0)">${r.name}</span>
        <label style="font-size:10px;color:var(--fg3)">h:</label>
        <input type="number" value="${entry.hours||0}" min="0" step="0.5"
          style="width:46px;background:var(--bg2);border:1px solid var(--bd2);border-radius:4px;padding:1px 4px;font-size:10px;color:var(--fg0)"
          onchange="_taskTeams[${ti}].entries[${ei}].hours=+this.value;_hoursManuallySet=true;">
        <button type="button" onclick="removeResFromTeam('${tt.teamId}','${entry.id}')"
          style="background:none;border:none;cursor:pointer;color:var(--fg3);font-size:10px;padding:0 2px">✕</button>
      </div>`;
    });
  }).join('');

  // Repopulate flat resource dropdown
  _populateResAddFlat();
  if(typeof _updateAllocVisibility==='function') _updateAllocVisibility();
}

window.addTeamToTask=()=>{
  const sel=document.getElementById('mt-team-add');
  const teamId=sel?.value; if(!teamId) return;
  if(_taskTeams.find(tt=>tt.teamId===teamId)) return;
  // Auto-add all resources of this team
  const tmRes=RESOURCES.filter(r=>(r.teams||[]).includes(teamId));
  _taskTeams.push({teamId, entries:tmRes.map(r=>({id:r.id,hours:0}))});
  _distributeHoursAll();
  renderTeamResList();
  sel.value='';
};
window.removeTeamFromTask=(teamId)=>{
  _taskTeams=_taskTeams.filter(tt=>tt.teamId!==teamId);
  _distributeHoursAll();
  renderTeamResList();
};
window.addResToTeam=(teamId)=>{
  const sel=document.getElementById(`mt-res-add-${teamId}`);
  const resId=sel?.value; if(!resId) return;
  const tt=_taskTeams.find(tt=>tt.teamId===teamId); if(!tt) return;
  if(!tt.entries.find(e=>e.id===resId)){
    tt.entries.push({id:resId,hours:0});
    _distributeHoursAll();
    renderTeamResList();
  }
};
window.removeResFromTeam=(teamId,resId)=>{
  const tt=_taskTeams.find(tt=>tt.teamId===teamId); if(!tt) return;
  tt.entries=tt.entries.filter(e=>e.id!==resId);
  _distributeHoursAll();
  renderTeamResList();
};
// Keep old compat stubs
window.addResToTask=()=>{};
window.removeResFromTask=()=>{};
window.onTeamChange=()=>{};
window.onResSelChange=function(){};
function getModalResIds(){ return _taskTeams.flatMap(tt=>tt.entries.map(e=>e.id)); }
function populateResAdd(){}

// ── Dependency type toggle ───────────────────────────────────
// ── Dependency type toggle ───────────────────────────────────
window.onDepTypeChange=function(){
  const v=document.getElementById('mt-dep-type').value;
  document.getElementById('fg-dep-task').style.display=v==='task'?'':'none';
  document.getElementById('fg-dep-res').style.display=v==='resource'?'':'none';
  document.getElementById('fg-dep-until').style.display=v==='resource'?'':'none';
  document.getElementById('fg-dep-milestone').style.display=v==='milestone'?'':'none';
  document.getElementById('fg-dep-note').style.display=v?'':'none';
  if(v==='task'){
    const inp=document.getElementById('dep-task-search');
    if(inp) inp.value='';
    const sel=document.getElementById('mt-dep-id');
    if(sel) sel.innerHTML='';
    _buildDepTaskItems();
  }
  if(v==='resource'){
    const sel=document.getElementById('mt-dep-res-id');
    sel.innerHTML='<option value="">— select resource —</option>'+RESOURCES.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
  }
  if(v==='milestone'){
    const sel=document.getElementById('mt-dep-ms-id');
    const taskProjId=document.getElementById('mt-proj')?.value||null;
    const ms=MILESTONES.filter(m=>m.shape==='circle'&&(!taskProjId||m.projId===taskProjId));
    sel.innerHTML='<option value="">— select milestone —</option>'+ms.map(m=>{
      const d=m.dayIdx?idxToDate(m.dayIdx):'';
      return `<option value="${m.id}">${m.name}${d?' ('+d+')':''}</option>`;
    }).join('');
  }
};
function resetDepFields(){
  document.getElementById('mt-dep-type').value='';
  const _depSelR=document.getElementById('mt-dep-id');
  if(_depSelR) _depSelR.innerHTML='';
  const _chipsR=document.getElementById('dep-task-chips');
  if(_chipsR){ _chipsR.innerHTML=''; _chipsR.style.display='none'; }
  document.getElementById('mt-dep-res-id').value='';
  document.getElementById('mt-dep-until').value='';
  document.getElementById('mt-dep-note').value='';
  const inp=document.getElementById('dep-task-search');
  if(inp) inp.value='';
  ['fg-dep-task','fg-dep-res','fg-dep-until','fg-dep-milestone','fg-dep-note'].forEach(id=>document.getElementById(id).style.display='none');
  document.getElementById('mt-dep-ms-id').value='';
}
function loadDepFields(t){
  const dt=t.depType||'';
  document.getElementById('mt-dep-type').value=dt;
  if(dt==='task'){
    _buildDepTaskItems();
    const sel=document.getElementById('mt-dep-id');
    const inp=document.getElementById('dep-task-search');
    if(inp) inp.value='';
    if(sel) sel.innerHTML='';
    // Load all depIds (support multiple)
    const _allDepIds=[...new Set([...(t.depIds||[]),t.depId].filter(Boolean))];
    _allDepIds.forEach(did=>{
      const depT=TASKS.find(x=>x.id===did);
      if(depT&&sel){ const opt=new Option(depT.name,depT.id,true,true); sel.add(opt); }
    });
    _renderDepChips();
    document.getElementById('fg-dep-task').style.display='';
    document.getElementById('fg-dep-note').style.display='';
  } else if(dt==='resource'){
    const sel=document.getElementById('mt-dep-res-id');
    sel.innerHTML='<option value="">— select resource —</option>'+RESOURCES.map(r=>'<option value="'+r.id+'" '+(r.id===t.depResId?'selected':'')+'">'+r.name+'</option>').join('');
    document.getElementById('mt-dep-until').value=t.depUntil||'';
    document.getElementById('fg-dep-res').style.display='';
    document.getElementById('fg-dep-until').style.display='';
    document.getElementById('fg-dep-note').style.display='';
  }
  if(dt==='milestone'){
    const taskProjId=t.projId||null;
    const sel=document.getElementById('mt-dep-ms-id');
    const ms=MILESTONES.filter(m=>m.shape==='circle'&&(!taskProjId||m.projId===taskProjId));
    sel.innerHTML='<option value="">— select milestone —</option>'+ms.map(m=>{
      const d=m.dayIdx?idxToDate(m.dayIdx):'';
      return `<option value="${m.id}" ${m.id===t.depMsId?'selected':''}>${m.name}${d?' ('+d+')':''}</option>`;
    }).join('');
    document.getElementById('fg-dep-milestone').style.display='';
    document.getElementById('fg-dep-note').style.display='';
  }
  document.getElementById('mt-dep-note').value=t.depNote||'';
}

function openAddTask(){
  S.editId=null;
  document.getElementById('mt-h').textContent='New Task';
  { const _lgEl=document.getElementById('mt-logged-hours'); if(_lgEl) _lgEl.textContent=''; }
  const _uaElN=document.getElementById('mt-updated-at');
  if(_uaElN){ _uaElN.textContent=''; _uaElN.style.display='none'; }
  {const _pb=document.getElementById('mt-open-parent');if(_pb)_pb.style.display='none';}
  // Clear milestone display for new task
  const _mtMs=document.getElementById('mt-ms-list'); if(_mtMs) _mtMs.innerHTML='<span style="font-size:10px;color:var(--fg3)">Save task first to associate milestones</span>';
  _loadSubtasksIntoModal([]);
  _updateTotalWithSubs();
  const _ps=document.getElementById('mt-proj');
  if(_ps){
    _ps.innerHTML='<option value="">— project —</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    // Auto-select active project from selector, else first project
    _ps.value=S._activeProjId||(PROJECTS[0]?.id||'');
  }
  _taskTeams=[];
  _hoursManuallySet=false;
  setTaskType('continuous');
  _populateResAddFlat();
  ['mt-n','mt-tag','mt-notes','mt-s-date','mt-e-date'].forEach(id=>document.getElementById(id).value='');
  const _gsel=document.getElementById('mt-group');if(_gsel)_gsel.value='';
  document.getElementById('mt-hld-inp').value='';document.getElementById('mt-hld-id').value='';
  document.getElementById('mt-h-tot').value=8;  // continuous default
  document.getElementById('mt-h-day').value=0;  // daily default
  document.getElementById('mt-s').value=GANTT_TODAY;
  document.getElementById('mt-d').value=1;
  document.getElementById('mt-p').value=0;document.getElementById('mt-pv').textContent='0%';
  document.getElementById('mt-stat').value='todo';
  document.getElementById('mt-dl').value='';
  // Reset allocation fields for new task
  { const _p=document.getElementById('mt-prio'); if(_p) _p.value=''; }
  { const _at=document.getElementById('mt-assign-type'); if(_at) _at.value='direct'; }
  { const _si=document.getElementById('mt-simul'); if(_si) _si.checked=false; }
  { const _fx=document.getElementById('mt-fixed'); if(_fx) _fx.checked=false; }
  { const _ef=document.getElementById('mt-effort'); if(_ef) _ef.value='shared'; }
  { const _tr=document.getElementById('mt-team-ref'); if(_tr) _tr.value=''; }
  if(typeof _updateAllocVisibility==='function') _updateAllocVisibility();
  document.getElementById('hold-fields').style.display='none';
  document.getElementById('mt-team-err').style.display='none';
  resetDepFields();
  setTM('total');
  renderTeamResList();
  // New task has no subtasks yet
  _loadSubtasksIntoModal([]);
  _updateTotalWithSubs();
  window._updateTaskMilestones();
  OM('m-task');
}
function openEditTask(id){
  const t=TASKS.find(x=>x.id===id);
  if(!t) return;
  S.editId=id;
  _hoursManuallySet=false;
  document.getElementById('mt-h').textContent='Edit Task';
  const _uaEl=document.getElementById('mt-updated-at');
  if(_uaEl){
    const _t=TASKS.find(x=>x.id===id);
    if(_t?.updatedAt){ _uaEl.textContent='Last edited: '+new Date(_t.updatedAt).toLocaleString(); _uaEl.style.display=''; }
    else { _uaEl.textContent=''; _uaEl.style.display='none'; }
  }
  {const _pb=document.getElementById('mt-open-parent');if(_pb){const _pt=TASKS.find(x=>x.id===id);if(_pt?.parentId){_pb.style.display='';_pb.onclick=()=>{CM('m-task');setTimeout(()=>openEditTask(_pt.parentId),50);};}else _pb.style.display='none';}}
  const _ps2=document.getElementById('mt-proj');
  if(_ps2){ _ps2.innerHTML='<option value="">— project —</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join(''); _ps2.value=t.projId||S._activeProjId||''; }
  const _isCont=!t.timeMode||t.timeMode==='total';
  // setTaskType called below after all fields are populated
  if(!_isCont&&t.start){ const _sd=gDate(t.start),_ed=gDate(t.start+(t.dur||1)-1);const _fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const _sse=document.getElementById('mt-s-date');const _ese=document.getElementById('mt-e-date');if(_sse)_sse.value=_fmt(_sd);if(_ese)_ese.value=_fmt(_ed); }
  document.getElementById('mt-n').value=t.name;
  document.getElementById('mt-tag').value=(t.tags||[]).join(', ');
  const _gsel2=document.getElementById('mt-group');if(_gsel2)_gsel2.value=t.group||'';
  // Always populate both panels with their respective stored values (or defaults)
  const _contHours=t.timeMode!=='daily'?(t.hours??8):(t.contHours??8);
  const _dailyHpd=t.timeMode==='daily'?(t.hpd!=null?t.hpd:0):(t.dailyHpd??0);
  document.getElementById('mt-h-tot').value=_contHours;
  document.getElementById('mt-h-day').value=_dailyHpd;
  document.getElementById('mt-s').value=t.start||GANTT_TODAY;
  document.getElementById('mt-d').value=t.dur||1;
  document.getElementById('mt-p').value=t.prog||0;document.getElementById('mt-pv').textContent=(t.prog||0)+'%';
  document.getElementById('mt-stat').value=t.status||'todo'; // used when saving
  document.getElementById('mt-dl').value=t.deadline||'';
  document.getElementById('mt-notes').value=t.notes||'';
  { const _lgEl=document.getElementById('mt-logged-hours'); if(_lgEl){ const _lg=logH(t); _lgEl.textContent=_lg>0?'('+(_lg%1===0?_lg:_lg.toFixed(1))+'h logged)':''; } }
  document.getElementById('mt-team-err').style.display='none';
  document.getElementById('mt-hld-inp').value=t.holdBlocker||'';
  resetDepFields();
  loadDepFields(t);
  setTaskType(t.timeMode==='daily'?'daily':'continuous');
  toggleHoldFields();
  // Reconstruct _taskTeams from saved taskTeams or legacy resId/coResIds
  if(t.taskTeams&&t.taskTeams.length){
    _taskTeams=JSON.parse(JSON.stringify(t.taskTeams));
    // If resources have unequal hours or any non-zero hours, treat as manually set
    const _allE=_taskTeams.flatMap(tt=>tt.entries);
    if(_allE.length>1){
      const _firstH=_allE[0].hours;
      if(_allE.some(e=>Math.abs(e.hours-_firstH)>0.01)||_allE.some(e=>e.hours>0)) _hoursManuallySet=true;
    }
  } else {
    // Migrate legacy format
    const resHours=t.resHours||{};
    const allIds=[t.resId,...(t.coResIds||[])].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
    const teamMap={};
    allIds.forEach(rid=>{
      const r=getRes(rid); if(!r) return;
      const teamId=(r.teams||[])[0]||'__unknown__';
      if(!teamMap[teamId]) teamMap[teamId]=[];
      teamMap[teamId].push({id:rid,hours:resHours[rid]||0});
    });
    _taskTeams=Object.entries(teamMap).map(([teamId,entries])=>({teamId,entries}));
  }
  renderTeamResList();
  // Populate allocation fields
  { const _p=document.getElementById('mt-prio'); if(_p) _p.value=(t.priorityTask==null?'':t.priorityTask); }
  { const _at=document.getElementById('mt-assign-type'); if(_at) _at.value=t.assignType||'direct'; }
  { const _si=document.getElementById('mt-simul'); if(_si) _si.checked=!!t.simultaneous; }
  { const _fx=document.getElementById('mt-fixed'); if(_fx) _fx.checked=!!t.fixedDates; }
  { const _ef=document.getElementById('mt-effort'); if(_ef) _ef.value=t.effort||'shared'; }
  if((t.assignType||'direct')==='team') _onAssignTypeChange();
  { const _tr=document.getElementById('mt-team-ref'); if(_tr&&t.teamRef) _tr.value=t.teamRef; }
  _updateAllocVisibility();
  // Load both legacy subtasks[] and new TASKS[] children (parentId model)
  // Merge subtasks[] and TASKS[] children, deduplicating by ID (TASKS[] children take priority)
  const _childTasks=TASKS.filter(ch=>ch.parentId===t.id);
  const _childIds=new Set(_childTasks.map(c=>c.id));
  const _legacySubs=(t.subtasks||[]).filter(st=>st.name?.trim()&&!_childIds.has(st.id));
  const _allSubs=[..._legacySubs,..._childTasks];
  _loadSubtasksIntoModal(_allSubs);
  _updateTotalWithSubs();
  _renderTaskMilestones(id);
  OM('m-task');
}
window.saveTask=()=>{
  if(!isAdmin()){notify('Only admins can save tasks','warn');return;}
  const name=document.getElementById('mt-n').value.trim();
  if(!name){notify('Task name required','warn');return;}
  const projId=document.getElementById('mt-proj')?.value||null;
  if(!projId){notify('Please select a project','warn');document.getElementById('mt-proj')?.focus();return;}
  const group=document.getElementById('mt-group')?.value||null;
  if(!group){notify('Please select a group','warn');document.getElementById('mt-group')?.focus();return;}

  // Auto-remove teams with no resources before saving
  _taskTeams=_taskTeams.filter(tt=>tt.entries.length>0);
  document.getElementById('mt-team-err').style.display='none';

  const tags=document.getElementById('mt-tag').value.split(',').map(x=>x.trim()).filter(Boolean);
  const tm=S.tm;
  const _hpdRaw=parseFloat(document.getElementById('mt-h-day').value);
  const htotForHpd=parseFloat(document.getElementById('mt-h-tot').value)||0;
  // For continuous tasks, hpd is irrelevant — preserve existing value or null
  const _existingTask=S.editId?TASKS.find(x=>x.id===S.editId):null;
  const hpd=S.tm==='daily'?(_hpdRaw===0?0:(_hpdRaw||HPD)):(_existingTask?.hpd??null);
  const htot=parseFloat(document.getElementById('mt-h-tot').value)||0;
  const dur=parseInt(document.getElementById('mt-d').value)||1;
  const hours=tm==='daily'?(hpd===0?htot:hpd*dur):htot;
  // Build flat arrays for compat
  const allEntries=_taskTeams.flatMap(tt=>tt.entries);

  // Validate daily hpd against each resource's dailyCap
  if(S.tm==='daily'&&hpd>0){
    const _capViolations=allEntries.map(e=>{
      const _r=getRes(e.id);
      if(!_r) return null;
      const _cap=_r.dailyCap||HPD;
      if(hpd>_cap) return `${_r.name} (cap: ${_cap}h)`;
      return null;
    }).filter(Boolean);
    if(_capViolations.length){
      notify(`Hours/day (${hpd}h) exceeds daily cap of: ${_capViolations.join(', ')}`, 'warn');
      return;
    }
  }

  // Validate continuous task resource hours against each resource's dailyCap
  if(S.tm!=='daily'){
    const _capViolations=allEntries.map(e=>{
      const _r=getRes(e.id);
      if(!_r||!e.hours) return null;
      const _cap=_r.dailyCap||HPD;
      if(e.hours<_cap) return null; // single day possible — ok
      return null; // continuous tasks can span multiple days — no cap violation
    }).filter(Boolean);
  }
  const resId=allEntries[0]?.id||null;
  const coResIds=allEntries.slice(1).map(e=>e.id);
  const resHours={};
  allEntries.forEach(e=>{ if(e.id) resHours[e.id]=e.hours||0; });
  const resource=allEntries.map(e=>getRes(e.id)?.name||'').filter(Boolean).join(', ');
  const teamId=_taskTeams[0]?.teamId||null;
  const teamIds=_taskTeams.map(tt=>tt.teamId);
  const holdResId=null;
  const holdBlocker=document.getElementById('mt-hld-inp').value||null;
  const depType=document.getElementById('mt-dep-type').value||null;
  const _depSel=document.getElementById('mt-dep-id');
  const depIds=depType==='task'?[..._depSel.options].filter(o=>o.selected&&o.value).map(o=>o.value):[];
  const depId=depIds[0]||null; // keep single for backward compat
  const depResId=depType==='resource'?(document.getElementById('mt-dep-res-id').value||null):null;
  const depUntil=depType==='resource'?(document.getElementById('mt-dep-until').value||null):null;
  const depMsId=depType==='milestone'?(document.getElementById('mt-dep-ms-id').value||null):null;
  const depNote=depType?(document.getElementById('mt-dep-note').value||null):null;
  const data={name,tags,projId,resId,coResIds,resHours,resource,taskTeams:_taskTeams,teamId,teamIds,
    group,
    status:(()=>{ const s=document.getElementById('mt-stat').value; const t2=TASKS.find(x=>x.id===S.editId); return (t2&&(t2.status==='doing'||t2.status==='paused'))?t2.status:s; })(),
    timeMode:tm, hpd:tm==='daily'?hpd:null, hours,
    contHours:tm!=='daily'?htot:(_existingTask?.contHours??8),
    dailyHpd:tm==='daily'?hpd:(_existingTask?.dailyHpd??0),
    weekdays:(()=>{ if(tm!=='daily') return null; const btns=document.querySelectorAll('#mt-weekdays .wd-btn'); return [...btns].filter(b=>b.classList.contains('on')).map(b=>parseInt(b.dataset.d)); })(),
    start:(()=>{const _cb=document.getElementById('tt-cont');const _isCont=!_cb||_cb.checked;if(_isCont){const _rid=document.getElementById('mt-res-id').value;const _ex=S.editId?TASKS.find(x=>x.id===S.editId):null;return _ex?.start||_nextFreeDay(_rid);}const _sd=document.getElementById('mt-s-date')?.value;return _sd?dateToIdx(_sd):null;})(),
    dur:(()=>{const _cb=document.getElementById('tt-cont');const _isCont=!_cb||_cb.checked;if(_isCont){const _rid=allEntries[0]?.id||document.getElementById('mt-res-id').value;const _mainH=allEntries.length>1&&allEntries[0]?.hours>0?allEntries[0].hours:(parseFloat(document.getElementById('mt-h-tot').value)||8);return Math.max(1,Math.ceil(_mainH/(getRes(_rid)?.dailyCap||HPD)));}const _sd=document.getElementById('mt-s-date')?.value,_ed=document.getElementById('mt-e-date')?.value;if(_sd&&_ed){const _si=dateToIdx(_sd),_ei=dateToIdx(_ed);return Math.max(1,_ei-_si+1);}const _ex=S.editId?TASKS.find(x=>x.id===S.editId):null;return _ex?.dur||1;})(),
    prog:parseInt(document.getElementById('mt-p').value)||0,
    deadline:document.getElementById('mt-dl').value||null,
    notes:document.getElementById('mt-notes').value,
    depType, depId, depIds, depResId, depUntil, depMsId, depNote,
    holdBlockerId:holdResId, holdBlocker,
    // ── Allocation fields ──
    priorityTask:(()=>{ const v=document.getElementById('mt-prio')?.value; return v===''||v==null?null:(parseInt(v)||null); })(),
    assignType:document.getElementById('mt-assign-type')?.value||'direct',
    teamRef:(()=>{ const at=document.getElementById('mt-assign-type')?.value; return at==='team'?(document.getElementById('mt-team-ref')?.value||null):null; })(),
    effort:document.getElementById('mt-effort')?.value||'shared',
    simultaneous:!!document.getElementById('mt-simul')?.checked,
    fixedDates:(()=>{
      if(!document.getElementById('mt-fixed')?.checked) return null;
      const _sd=document.getElementById('mt-s-date')?.value, _ed=document.getElementById('mt-e-date')?.value;
      if(!_sd) return null;
      return {start:_sd, end:_ed||_sd};
    })(),
    assignOrigin:(_existingTask?.assignOrigin)||'directRaw',
    priorityHints:(_existingTask?.priorityHints)||[],
    updatedAt:Date.now(),
    resStart:(()=>{
      // Only keep resStart for co-resources with actual hours
      const _rs=_existingTask?.resStart||{};
      const _filtered={};
      Object.entries(_rs).forEach(([id,s])=>{ if((resHours[id]||0)>0) _filtered[id]=s; });
      return _filtered;
    })(),
    resDur:_existingTask?.resDur||{},
    subtasks:(()=>{
      // Preserve existing subtasks if modal subtask list is empty (user didn't edit subs)
      const _stNew=_curSubtasks.filter(st=>st.name?.trim()).map(st=>({...st,name:st.name.trim()}));
      if(!_stNew.length && S.editId){
        const _stExist=TASKS.find(x=>x.id===S.editId)?.subtasks;
        if(_stExist&&_stExist.length) return _stExist;
      }
      return _stNew;
    })(),
    // Auto-update progress from subtasks if any exist
    prog:(()=>{ const sts=_curSubtasks.filter(st=>st.name.trim()); if(!sts.length) return parseInt(document.getElementById('mt-p').value)||0; return Math.round(sts.filter(st=>st.done).length/sts.length*100); })(),
  };
  if(S.editId){
    const t=TASKS.find(x=>x.id===S.editId);
    // Detailed diff of every changed field
    const diffs=[];
    const _dn=(v)=>v||'none';
    const _rn=(id)=>getRes(id)?.name||id||'none';
    const _pn=(id)=>PROJECTS.find(p=>p.id===id)?.name||id||'none';
    const _tn=(id)=>TEAMS.find(t2=>t2.id===id)?.name||id||'none';
    // Name
    if(t.name!==data.name) diffs.push(`name: "${t.name}" → "${data.name}"`);
    // Project
    if((t.projId||'')!==(data.projId||'')) diffs.push(`project: ${_pn(t.projId)} → ${_pn(data.projId)}`);
    // Primary resource
    if((t.resId||'')!==(data.resId||'')) diffs.push(`resource: ${_rn(t.resId)} → ${_rn(data.resId)}`);
    // Co-resources
    const _oldCo=(t.coResIds||[]).slice().sort().join(',');
    const _newCo=(data.coResIds||[]).slice().sort().join(',');
    if(_oldCo!==_newCo){
      const _addedR=(data.coResIds||[]).filter(id=>!(t.coResIds||[]).includes(id));
      const _removedR=(t.coResIds||[]).filter(id=>!(data.coResIds||[]).includes(id));
      if(_addedR.length) diffs.push(`co-resource added: ${_addedR.map(_rn).join(', ')}`);
      if(_removedR.length) diffs.push(`co-resource removed: ${_removedR.map(_rn).join(', ')}`);
    }
    // Tags
    const _oldTags=(t.tags||[]).slice().sort().join(',');
    const _newTags=(data.tags||[]).slice().sort().join(',');
    if(_oldTags!==_newTags){
      const _addedTg=(data.tags||[]).filter(tg=>!(t.tags||[]).includes(tg));
      const _removedTg=(t.tags||[]).filter(tg=>!(data.tags||[]).includes(tg));
      if(_addedTg.length) diffs.push(`tag added: ${_addedTg.join(', ')}`);
      if(_removedTg.length) diffs.push(`tag removed: ${_removedTg.join(', ')}`);
    }
    // Hours
    if((t.hours||0)!==(data.hours||0)) diffs.push(`hours: ${t.hours||0}h → ${data.hours||0}h`);
    // Time mode
    if((t.timeMode||'total')!==(data.timeMode||'total')) diffs.push(`type: ${t.timeMode||'total'} → ${data.timeMode||'total'}`);
    if(data.timeMode==='daily'&&(t.hpd||0)!==(data.hpd||0)) diffs.push(`h/day: ${t.hpd||0}h → ${data.hpd||0}h`);
    // Start date
    if((t.start||0)!==(data.start||0)&&data.start) diffs.push(`start: ${t.start?sd(t.start):'none'} → ${sd(data.start)}`);
    // Deadline
    if((t.deadline||'')!==(data.deadline||'')) diffs.push(`deadline: ${_dn(t.deadline)} → ${_dn(data.deadline)}`);
    // Progress
    if((t.prog||0)!==(data.prog||0)) diffs.push(`progress: ${t.prog||0}% → ${data.prog||0}%`);
    // Status
    if((t.status||'todo')!==(data.status||'todo')) diffs.push(`status: ${SLABELS[t.status]||t.status} → ${SLABELS[data.status]||data.status}`);
    // Notes (show new content if changed)
    const _oldN=(t.notes||'').trim(); const _newN=(data.notes||'').trim();
    if(_oldN!==_newN){
      if(!_newN) diffs.push('notes: cleared');
      else if(!_oldN) diffs.push(`notes added: "${_newN.slice(0,80)}${_newN.length>80?'…':''}"`);
      else diffs.push(`notes changed: "${_newN.slice(0,60)}${_newN.length>60?'…':''}"`);
    }
    // Dependency
    const _oldDeps=[...new Set([...(t.depIds||[]),t.depId].filter(Boolean))].sort().join(',');
    const _newDeps=[...new Set([...(data.depIds||[]),data.depId].filter(Boolean))].sort().join(',');
    if(_oldDeps!==_newDeps) diffs.push(`depends on: ${_oldDeps||'none'} → ${_newDeps||'none'}`);
    // Hold blocker
    if((t.holdBlocker||'')!==(data.holdBlocker||'')) diffs.push(`hold reason: "${_dn(data.holdBlocker)}"`);
    // Subtasks
    const _ost=t.subtasks||[]; const _nst=data.subtasks||[];
    const _addedSt=_nst.filter(n=>!_ost.find(o=>o.id===n.id)).map(n=>n.name);
    const _removedSt=_ost.filter(o=>!_nst.find(n=>n.id===o.id)).map(o=>o.name);
    const _doneSt=_nst.filter(n=>n.done&&!(_ost.find(o=>o.id===n.id)?.done)).map(n=>n.name);
    const _undoneSt=_nst.filter(n=>!n.done&&(_ost.find(o=>o.id===n.id)?.done)).map(n=>n.name);
    if(_addedSt.length) diffs.push(`subtask added: ${_addedSt.join(', ')}`);
    if(_removedSt.length) diffs.push(`subtask removed: ${_removedSt.join(', ')}`);
    if(_doneSt.length) diffs.push(`subtask done: ${_doneSt.join(', ')}`);
    if(_undoneSt.length) diffs.push(`subtask reopened: ${_undoneSt.join(', ')}`);
    // Team
    if((t.teamId||'')!==(data.teamId||'')) diffs.push(`team: ${_tn(t.teamId)} → ${_tn(data.teamId)}`);
    if(S._addChildParentId&&!S.editId){data.parentId=S._addChildParentId;S._addChildParentId=null;}else if(!S.editId)data.parentId=null;
    Object.assign(t,data);
    // Remove subtasks from t.subtasks[] that have already been promoted to TASKS[]
    if(t.subtasks&&t.subtasks.length){
      t.subtasks=t.subtasks.filter(st=>!TASKS.find(x=>x.id===st.id&&x.parentId===t.id));
    }
    // Delete from TASKS[] any promoted children no longer in the saved subtask list
    const _keptIds=new Set((data.subtasks||[]).map(st=>st.id).filter(Boolean));
    const _obsolete=TASKS.filter(x=>x.parentId===t.id&&!_keptIds.has(x.id));
    _obsolete.forEach(x=>{
      TASKS.splice(TASKS.indexOf(x),1);
      const _dp={}; _dp[x.id]=null;
      fetch(_FB_ROOT+'/tasks.json',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(_dp)}).catch(()=>{});
    });
    persistState(['tasks'],{tasks:[t.id]}); // immediate targeted save
    addLog({type:'edit',task:name,from:'',to:diffs.length?diffs.join(' · '):'saved'});
    notify('Task saved','success');
  } else {
    const newId='t'+Date.now();
    const res=getRes(data.resId);
    // Store subtasks in TASKS[] as children, not in subtasks[] to avoid duplication
    const _newSubtasks=data.subtasks||[];
    const newTask={id:newId,timeLogs:[],subtasks:[],segments:null,...data,subtasks:[]};
    TASKS.push(newTask);
    // Promote subtasks directly as TASKS[] children
    _newSubtasks.filter(st=>st.name?.trim()).forEach(st=>{
      if(!TASKS.find(x=>x.id===st.id)) TASKS.push({...st,parentId:newId,projId:st.projId||data.projId,teamId:st.teamId||data.teamId,teamIds:st.teamIds||data.teamIds||[],tags:st.tags||[],timeLogs:st.timeLogs||[],coResIds:st.coResIds||[],resHours:st.resHours||{},timeMode:st.timeMode||'total',subtasks:[],segments:null});
    });
    persistState(['tasks'],{tasks:[newId,..._newSubtasks.map(st=>st.id).filter(Boolean)]}); // save new task immediately
    addLog({type:'create',task:name,from:'',to:`created${data.projId?' in '+PROJECTS.find(p=>p.id===data.projId)?.name:''}${res?' for '+res.name:''}${data.hours?' · '+data.hours+'h':''}`});
    notify(`"${name}" created`,'success');
  }
  CM('m-task');
  buildTagPanel();
  renderGantt();renderDash();_refreshOverview();
  // persistState already called inline above with specific task ID
};
window.delEditTask=()=>{
  if(!S.editId) return;
  const _dt=TASKS.find(x=>x.id===S.editId);
  const _delId=S.editId;
  addLog({type:'delete',task:_dt?.name||S.editId,from:'',to:`task deleted (was ${SLABELS[_dt?.status]||_dt?.status||'unknown'}, ${_dt?.hours||0}h, ${_dt?.resId?getRes(_dt.resId)?.name||_dt.resId:'unassigned'})`});
  // Collect all descendant IDs (children and their children recursively)
  const _collectDesc=(pid)=>{
    const children=TASKS.filter(x=>x.parentId===pid);
    return children.flatMap(c=>[c.id,..._collectDesc(c.id)]);
  };
  const _descIds=_collectDesc(_delId);
  const _allDelIds=[_delId,..._descIds];
  TASKS=TASKS.filter(t=>!_allDelIds.includes(t.id));
  CM('m-task');notify('Deleted','warn');
  renderGantt();renderDash();_refreshOverview();
  // Delete task + all descendants from Firebase
  const _delPatch={};
  _allDelIds.forEach(id=>{ _delPatch[id]=null; });
  fetch(_FB_ROOT+'/tasks.json',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(_delPatch)}).catch(()=>{});
  persistState(['meta']);
};


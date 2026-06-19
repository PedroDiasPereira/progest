// ============================================================
// GANTT
// ============================================================
function setZoom(v,el){ /* removed - always week */ }
function gNav(dir){
  if(dir===0){ S.offset=GANTT_TODAY-1; }
  else { S.offset=Math.max(-60,S.offset+dir*7); }
  renderGantt();
}
// Re-render Gantt on resize so column width updates
window.addEventListener('resize',()=>{ if(S.page==='gantt') renderGantt(); });

window.toggleMsFilter=(msId)=>{
  _msFilter=_msFilter===msId?null:msId;
  renderGantt();
};
function visTasks(){
  const search=(document.getElementById('g-search')?.value||'').toLowerCase();
  // Milestone-associated tasks are always visible when milestone filter is active
  const msTaskIds=_msFilter?new Set((MILESTONES.find(m=>m.id===_msFilter)?.taskIds)||[]):new Set();
  const _yst=GANTT_TODAY-1;
  let tasks=TASKS.filter(t=>{
    const isMsTask=msTaskIds.has(t.id);
    if(_msFilter && !isMsTask) return false;
    // Active project filter — always applies (even to historical tasks)
    if(S._activeProjId && (t.projId||null) !== S._activeProjId) return false;
    // Search filter — always applies
    if(search && !t.name.toLowerCase().includes(search)) return false;
    // Tag filter — always applies
    if(S.selectedTags.length && !S.selectedTags.some(tg=>(t.tags||[]).includes(tg))) return false;
    if(!isMsTask){
      if(!S.statusFilter.includes(t.status)) return false;
    }
    // Unassigned filter: show tasks with no resource, or tasks that have unassigned subtasks
    if(S.filterUnassigned){
      const _hasSubs=[...(t.subtasks||[]).filter(s=>s.name?.trim()),...TASKS.filter(x=>x.parentId===t.id)];
      const _taskUnassigned=!t.resId&&!(t.coResIds||[]).length;
      const _hasUnassignedSub=_hasSubs.some(s=>!s.resId);
      if(!_taskUnassigned && !_hasUnassignedSub) return false;
    }
    return true;
  });
  // Update total hours display
  const _visHours=tasks.reduce((s,t)=>s+tHours(t),0);
  const _hStr=_visHours>0?(_visHours%1===0?_visHours:_visHours.toFixed(1))+'h':'—';
  const _hEl=document.getElementById('g-hours-total');
  if(_hEl) _hEl.textContent=_visHours>0?`Σ ${_visHours%1===0?_visHours:_visHours.toFixed(1)}h`:'';
  const _hEl2=document.getElementById('g-hours-total-row1');
  if(_hEl2) _hEl2.textContent=_hStr;
  const _tcEl=document.getElementById('g-tasks-count');
  if(_tcEl){ const _tc=tasks.filter(t=>t.status!=='cancelled').length; _tcEl.textContent=_tc>0?_tc+'':'—'; }

  const sb=S._sortBy||'';
  if(sb&&!S._sortLocked){
    if(sb==='name') tasks=[...tasks].sort((a,b)=>a.name.localeCompare(b.name));
    else if(sb==='tags') tasks=[...tasks].sort((a,b)=>((a.tags||[])[0]||'').localeCompare((b.tags||[])[0]||''));
    else if(sb==='chrono') tasks=[...tasks].sort((a,b)=>{
      const _eff=(t)=>{
        if(t.start) return t.start;
        // Check all descendants recursively for earliest start
        const _desc=_getDescAll(t.id);
        const _starts=_desc.map(d=>d.start).filter(Boolean);
        return _starts.length?Math.min(..._starts):99999;
      };
      return _eff(a)-_eff(b);
    });
  }
  // Always sort by group as primary key (tasks without group go last)
  const _GRP_ORDER=['REQUISITOS E ESPECIFICAÇÃO','PROTÓTIPO','VALIDAÇÃO','HANDOVER','AVALIAÇÃO DE RISCOS TÉCNICOS','PROJETO'];
  tasks=[...tasks].sort((a,b)=>{
    const _gA=a.parentId?TASKS.find(x=>x.id===a.parentId)?.group||a.group:a.group;
    const _gB=b.parentId?TASKS.find(x=>x.id===b.parentId)?.group||b.group:b.group;
    const ai=_gA?_GRP_ORDER.indexOf(_gA):-1;
    const bi=_gB?_GRP_ORDER.indexOf(_gB):-1;
    return (ai===-1?999:ai)-(bi===-1?999:bi);
  });
  return tasks;
}


const _collapsedTasks=new Set(JSON.parse(sessionStorage.getItem('pg_collapsed')||'[]'));
function _saveCollapsed(){try{sessionStorage.setItem('pg_collapsed',JSON.stringify([..._collapsedTasks]));}catch(e){}}
window.toggleCollapse=(taskId,e)=>{if(e)e.stopPropagation();if(_collapsedTasks.has(taskId))_collapsedTasks.delete(taskId);else _collapsedTasks.add(taskId);_saveCollapsed();renderGantt();};
// team/resource view: tasks with subtasks are collapsed by default; this Set tracks explicitly expanded ones
const _expandedTeamRes=new Set();
window.toggleExpandTeamRes=(taskId,e)=>{if(e)e.stopPropagation();if(_expandedTeamRes.has(taskId))_expandedTeamRes.delete(taskId);else _expandedTeamRes.add(taskId);renderGantt();};
// In team/resource view: tracks which parent tasks are shown inline above their cross-section subtask
const _shownParentTasks=new Set();
window.toggleParentInline=(taskId,e)=>{if(e)e.stopPropagation();if(_shownParentTasks.has(taskId))_shownParentTasks.delete(taskId);else _shownParentTasks.add(taskId);renderGantt();};
function hasChildren(taskId){return TASKS.some(t=>t.parentId===taskId)||(TASKS.find(t=>t.id===taskId)?.subtasks||[]).some(st=>st.name?.trim());}

function buildGRows(tasks){
  const rows=[];
  const _GRP_ORDER=['REQUISITOS E ESPECIFICAÇÃO','PROTÓTIPO','VALIDAÇÃO','HANDOVER','AVALIAÇÃO DE RISCOS TÉCNICOS','PROJETO'];
  const _GRP_LABELS={'REQUISITOS E ESPECIFICAÇÃO':'REQUISITOS E ESPECIFICAÇÃO','PROTÓTIPO':'PROTÓTIPO','VALIDAÇÃO':'VALIDAÇÃO','HANDOVER':'HANDOVER','AVALIAÇÃO DE RISCOS TÉCNICOS':'AVALIAÇÃO DE RISCOS TÉCNICOS','PROJETO':'PROJETO'};
  const _GRP_COLORS={'REQUISITOS E ESPECIFICAÇÃO':'#4f9cf9','PROTÓTIPO':'#7b61ff','VALIDAÇÃO':'#00c9a0','HANDOVER':'#f0a928','AVALIAÇÃO DE RISCOS TÉCNICOS':'#f05252','PROJETO':'#22c55e'};
  // Helper: push tasks grouped by their group field
  function _pushWithGroupHeaders(taskList, addRowFn){
    let _lastGrp=undefined;
    taskList.forEach(t=>{
      const g=t.group||'__none__';
      if(g!==_lastGrp){
        if(g!=='__none__'){
          rows.push({isGrpHdr:true,label:_GRP_LABELS[g]||g,color:_GRP_COLORS[g]||'#7a8aaa'});
        } else {
          rows.push({isGrpHdr:true,label:'—',color:'#3e4f6a'});
        }
        _lastGrp=g;
      }
      addRowFn(t);
    });
  }
  // Shared tree builder — used by all view modes
  function _addTree(t,depth,viewResId){
    rows.push({t,tid:TASKS.indexOf(t),depth,viewResId:viewResId||null});
    if(!hasChildren(t.id)) return;
    // In team/resource view: collapsed by default unless explicitly expanded
    const _isTeamResView=(S.viewBy==='team'||S.viewBy==='resource');
    const _collapsed=_isTeamResView ? !_expandedTeamRes.has(t.id) : _collapsedTasks.has(t.id);
    if(_collapsed) return;
    let _children=[
      ...TASKS.filter(ch=>ch.parentId===t.id),
      ...(t.subtasks||[]).filter(st=>st.name?.trim()&&!TASKS.find(x=>x.id===st.id)).map(st=>({...st,parentId:t.id,projId:st.projId||t.projId,teamId:st.teamId||t.teamId,teamIds:st.teamIds||t.teamIds||[],tags:st.tags||[],timeLogs:st.timeLogs||[],coResIds:st.coResIds||[],resHours:st.resHours||{},timeMode:st.timeMode||'total',subtasks:[]}))
    ];
    // In resource view: only expand children that belong to this resource (or have no resource — shown as unassigned within parent)
    if(S.viewBy==='resource'&&viewResId){
      _children=_children.filter(ch=>ch.resId===viewResId||(ch.coResIds||[]).includes(viewResId)||!ch.resId);
    }
    const _sb=S._sortBy||'';
    if(_sb==='name') _children=[..._children].sort((a,b)=>a.name.localeCompare(b.name));
    else if(_sb==='chrono') _children=[..._children].sort((a,b)=>{const _ea=a.start||(()=>{const d=_getDescAll(a.id);const s=d.map(x=>x.start).filter(Boolean);return s.length?Math.min(...s):99999;})();const _eb=b.start||(()=>{const d=_getDescAll(b.id);const s=d.map(x=>x.start).filter(Boolean);return s.length?Math.min(...s):99999;})();return _ea-_eb;});
    _children.forEach(ch=>{
      // In resource view: only pass viewResId to children that actually belong to that resource
      // Subtasks without a resId should not appear under the parent's resource section
      const _chViewRes=(S.viewBy==='resource'&&ch.resId!==viewResId&&!((ch.coResIds||[]).includes(viewResId)))?null:viewResId;
      _addTree(ch,depth+1,_chViewRes);
    });
  }

  if(S.viewBy==='project'){
    const _apId=S._activeProjId||null;
    const _projIds=_apId?[_apId]:[...new Set(tasks.map(t=>t.projId).filter(Boolean))];
    _projIds.forEach(pid=>{
      const proj=PROJECTS.find(p=>p.id===pid);
      const roots=tasks.filter(t=>t.projId===pid&&!t.parentId);
      if(!roots.length) return;
      rows.push({isGH:true,label:proj?.name||pid,color:proj?.color||'#7a8aaa',resId:null});
      _pushWithGroupHeaders(roots, t=>_addTree(t,0));
    });
    if(!_apId){
      const noProj=tasks.filter(t=>!t.projId&&!t.parentId);
      if(noProj.length){rows.push({isGH:true,label:'No project',color:'#7a8aaa',resId:null});_pushWithGroupHeaders(noProj, t=>_addTree(t,0));}
    }
  } else if(S.viewBy==='resource'){
    // Collect all resource IDs from tasks AND TASKS[] children
    const allTaskResIds=new Set();
    tasks.forEach(t=>{
      if(t.resId) allTaskResIds.add(t.resId);
      (t.coResIds||[]).forEach(id=>allTaskResIds.add(id));
      (t.subtasks||[]).forEach(st=>{if(st.resId) allTaskResIds.add(st.resId);});
    });
    // Also collect from TASKS[] children (parentId model)
    TASKS.filter(ch=>ch.parentId).forEach(ch=>{if(ch.resId) allTaskResIds.add(ch.resId);});

    const _vbReal=S.vbFilter.filter(x=>x!=='__none__');
    const rIds=_vbReal.length&&!S.vbFilter.includes('__none__')?_vbReal:S.vbFilter.includes('__none__')?[]:[...allTaskResIds];
    rIds.forEach(rid=>{
      // All tasks (any depth) assigned to this resource
      const myTasks=tasks.filter(t=>t.resId===rid||(t.coResIds||[]).includes(rid));
      // Cross-resource subtasks: subtasks assigned to this resource whose parent is NOT already in myTasks
      const crossSubs=[];
      TASKS.forEach(t=>{
        if(myTasks.includes(t)) return;
        (t.subtasks||[]).filter(st=>st.name?.trim()&&st.resId===rid&&!TASKS.find(x=>x.id===st.id)).forEach(st=>{
          crossSubs.push({t,st});
        });
        TASKS.filter(ch=>ch.parentId===t.id&&ch.resId===rid).forEach(ch=>{
          crossSubs.push({t,st:ch});
        });
      });
      if(!myTasks.length&&!crossSubs.length) return;
      const r=getRes(rid);
      rows.push({isGH:true,label:r?r.name:'?',color:resTeamColor(rid),resId:rid});
      const myRoots=myTasks.filter(t=>!t.parentId);
      _pushWithGroupHeaders(myRoots, t=>_addTree(t,0,rid));
      // Cross-section subtasks: show parent task inline if _shownParentTasks has the parent id
      crossSubs.forEach(({t,st})=>{
        if(_shownParentTasks.has(t.id)){
          rows.push({t,tid:TASKS.indexOf(t),depth:0,viewResId:rid,isInlineParent:true});
        }
        rows.push({t,st,isCrossSub:true,isSubtask:true,depth:1,viewResId:rid});
      });
    });
    // Unassigned section: tasks with no resource + subtasks with no resource whose parent HAS resource
    const noRes=tasks.filter(t=>!t.resId&&!(t.coResIds||[]).length&&!t.parentId);
    const unassignedCrossSubs=[];
    tasks.filter(t=>t.resId||(t.coResIds||[]).length).forEach(t=>{
      (t.subtasks||[]).filter(st=>st.name?.trim()&&!st.resId&&!TASKS.find(x=>x.id===st.id)).forEach(st=>{
        unassignedCrossSubs.push({t,st});
      });
      TASKS.filter(ch=>ch.parentId===t.id&&!ch.resId&&!(ch.coResIds||[]).length).forEach(ch=>{
        unassignedCrossSubs.push({t,st:ch});
      });
    });
    if(noRes.length||unassignedCrossSubs.length){
      rows.push({isGH:true,label:'Unassigned',color:'#7a8aaa',resId:null});
      _pushWithGroupHeaders(noRes, t=>_addTree(t,0));
      unassignedCrossSubs.forEach(({t,st})=>{
        if(_shownParentTasks.has(t.id)){
          rows.push({t,tid:TASKS.indexOf(t),depth:0,viewResId:null,isInlineParent:true});
        }
        rows.push({t,st,isCrossSub:true,isSubtask:true,depth:1,viewResId:null});
      });
    }
  } else {
    const _vbR2=S.vbFilter.filter(x=>x!=='__none__');
    const tIds=S.vbFilter.includes('__none__') ? [] : _vbR2.length ? _vbR2 : [...new Set(tasks.flatMap(t=>(t.teamIds&&t.teamIds.length)?t.teamIds:(t.teamId?[t.teamId]:[])).filter(Boolean))];
    const _assignedSubIds=new Set();
    tIds.forEach(tid=>{
      const tm=getTeam(tid);
      const rt=tasks.filter(t=>{
        const ids=(t.teamIds&&t.teamIds.length)?t.teamIds:(t.teamId?[t.teamId]:[]);
        return ids.includes(tid);
      });
      // Cross-team subtasks: subtasks whose resource belongs to this team but parent is NOT in rt
      const crossSubs=[];
      TASKS.forEach(t=>{
        if(rt.includes(t)) return;
        (t.subtasks||[]).filter(st=>st.name?.trim()&&st.resId&&!TASKS.find(x=>x.id===st.id)).forEach(st=>{
          const r=getRes(st.resId); if(!r) return;
          if((r.teams||[]).includes(tid)) crossSubs.push({t,st});
        });
        TASKS.filter(ch=>ch.parentId===t.id&&ch.resId).forEach(ch=>{
          const r=getRes(ch.resId); if(!r) return;
          if((r.teams||[]).includes(tid)) crossSubs.push({t,st:ch});
        });
      });
      // Unassigned subtasks whose parent task belongs to THIS team
      const unassignedInTeam=[];
      rt.forEach(t=>{
        (t.subtasks||[]).filter(st=>st.name?.trim()&&!st.resId&&!TASKS.find(x=>x.id===st.id)).forEach(st=>{
          unassignedInTeam.push({t,st}); _assignedSubIds.add(st.id);
        });
        TASKS.filter(ch=>ch.parentId===t.id&&!ch.resId&&!(ch.coResIds||[]).length).forEach(ch=>{
          unassignedInTeam.push({t,st:ch}); _assignedSubIds.add(ch.id);
        });
      });
      if(!rt.length&&!crossSubs.length&&!unassignedInTeam.length) return;
      rows.push({isGH:true,label:tm?tm.name:'?',color:tm?tm.color:'#7a8aaa',resId:null});
      const rtRoots=rt.filter(t=>!t.parentId);
      _pushWithGroupHeaders(rtRoots, t=>_addTree(t,0));
      // Cross-section subtasks with resource
      crossSubs.forEach(({t,st})=>{
        if(_shownParentTasks.has(t.id)){
          rows.push({t,tid:TASKS.indexOf(t),depth:0,viewResId:st.resId||null,isInlineParent:true});
        }
        rows.push({t,st,isCrossSub:true,isSubtask:true,depth:1,viewResId:st.resId||null});
      });
      // Unassigned subtasks of tasks in this team (shown collapsed by default with ⤴)
      unassignedInTeam.forEach(({t,st})=>{
        if(_shownParentTasks.has(t.id)){
          rows.push({t,tid:TASKS.indexOf(t),depth:0,viewResId:null,isInlineParent:true});
        }
        rows.push({t,st,isCrossSub:true,isSubtask:true,depth:1,viewResId:null});
      });
    });
    const noTeam=tasks.filter(t=>!t.teamId&&(!t.teamIds||!t.teamIds.length)&&!t.parentId);
    // Only truly unassigned: subtasks with no resId AND whose parent has no team
    const unassignedTeamCrossSubs=[];
    tasks.filter(t=>!t.teamId&&(!t.teamIds||!t.teamIds.length)).forEach(t=>{
      (t.subtasks||[]).filter(st=>st.name?.trim()&&!st.resId&&!TASKS.find(x=>x.id===st.id)&&!_assignedSubIds.has(st.id)).forEach(st=>{
        unassignedTeamCrossSubs.push({t,st});
      });
      TASKS.filter(ch=>ch.parentId===t.id&&!ch.resId&&!(ch.coResIds||[]).length&&!_assignedSubIds.has(ch.id)).forEach(ch=>{
        unassignedTeamCrossSubs.push({t,st:ch});
      });
    });
    if(noTeam.length||unassignedTeamCrossSubs.length){
      rows.push({isGH:true,label:'Unassigned',color:'#7a8aaa',resId:null});
      _pushWithGroupHeaders(noTeam,t=>_addTree(t,0));
      unassignedTeamCrossSubs.forEach(({t,st})=>{
        if(_shownParentTasks.has(t.id)){
          rows.push({t,tid:TASKS.indexOf(t),depth:0,viewResId:null,isInlineParent:true});
        }
        rows.push({t,st,isCrossSub:true,isSubtask:true,depth:1,viewResId:null});
      });
    }
  }
  return rows;
}

function _reRenderCurrent(){
  const p=S.page;
  if(p==='gantt'){ buildSFChips();buildTagPanel();renderGantt(); }
  else if(p==='dashboard') renderDash();
  else if(p==='myspace') renderMySpace();
  else if(p==='projects') renderProjects();
  else if(p==='resources') renderRes();
  else if(p==='teams') renderTeams();
}
// Hours a subtask packs on a specific day (greedy: fill cap, then next day)
function _subHoursOnDay(s, t, day){
  if(s._sched) return s._sched[day]||0;
  const resId=s.resId||t.resId;
  const cap=getRes(resId)?.dailyCap||HPD;
  const start=s.start||t.start||GANTT_TODAY;
  let rem=s.hours||1, d=start;
  while(d<=day&&rem>0.001){
    if(!isNW(d,null,resId)){
      const put=Math.min(rem,cap);
      if(d===day) return put;
      rem-=put;
    }
    d++;
  }
  return 0;
}


// ── Hierarchical inheritance helpers ─────────────────────────
// Get the most restrictive deadline: task's own OR parent chain minimum
function getEffectiveDeadline(t){
  let dl=t.deadline||null;
  let cur=t;
  while(cur.parentId){
    cur=TASKS.find(x=>x.id===cur.parentId);
    if(!cur) break;
    if(cur.deadline){
      if(!dl||cur.deadline<dl) dl=cur.deadline;
    }
  }
  return dl;
}

// Get the earliest start constraint from parent chain (depType/depId/depUntil)
function getEffectiveDep(t){
  // Own dependency takes priority; if not set, walk up
  if(t.depType) return {depType:t.depType,depId:t.depId,depIds:t.depIds,depResId:t.depResId,depUntil:t.depUntil,depMsId:t.depMsId,depNote:t.depNote};
  let cur=t;
  while(cur.parentId){
    cur=TASKS.find(x=>x.id===cur.parentId);
    if(!cur) break;
    if(cur.depType) return {depType:cur.depType,depId:cur.depId,depIds:cur.depIds,depUntil:cur.depUntil};
  }
  return {depType:null,depId:null,depUntil:null};
}

// Get all milestones that apply to this task (own + inherited from parents)
function getEffectiveMilestones(taskId){
  const ids=new Set();
  let cur=TASKS.find(t=>t.id===taskId);
  while(cur){
    MILESTONES.forEach(m=>{if((m.taskIds||[]).includes(cur.id)) ids.add(m.id);});
    cur=cur.parentId?TASKS.find(t=>t.id===cur.parentId):null;
  }
  return [...ids].map(id=>MILESTONES.find(m=>m.id===id)).filter(Boolean);
}

// Get the minimum dep start from parent chain (for auto-schedule)
function getEffectiveMinStart(t){
  const dep=getEffectiveDep(t);
  if(!dep.depType) return null;
  if(dep.depType==='task'){
    const _allDeps=[...new Set([...(dep.depIds||[]),dep.depId].filter(Boolean))];
    let _maxEnd=null;
    _allDeps.forEach(did=>{
      const depTask=TASKS.find(x=>x.id===did);
      if(depTask&&depTask.status!=='done'){
        const depEnd=tEnd(depTask);
        if(depEnd&&(_maxEnd===null||depEnd>_maxEnd)) _maxEnd=depEnd;
      }
    });
    if(_maxEnd) return _maxEnd+1;
  }
  if(dep.depType==='resource'&&dep.depUntil){
    const mi=dateToIdx(dep.depUntil);
    if(mi) return mi+1;
  }
  if(dep.depType==='milestone'&&dep.depMsId){
    const ms=MILESTONES.find(m=>m.id===dep.depMsId);
    if(ms&&ms.dayIdx) return ms.dayIdx+1;
  }
  return null;
}




// Get all descendants recursively (safe: max depth 20)
function _getDescAll(pid,depth){
  if((depth||0)>20) return [];
  const r=[];
  TASKS.forEach(ch=>{
    if(ch.parentId===pid&&ch.name?.trim()){
      r.push(ch);
      r.push(..._getDescAll(ch.id,(depth||0)+1));
    }
  });
  return r;
}


function renderOverview(){
  const el=document.getElementById('ov-content');
  if(!el) return;
  // Populate project selector
  const ps=document.getElementById('ov-proj');
  if(ps){const cur=ps.value;ps.innerHTML='<option value="">All projects</option>'+PROJECTS.map(p=>`<option value="${p.id}" ${p.id===cur?'selected':''}>${p.name}</option>`).join('');if(cur)ps.value=cur;}
  const projId=document.getElementById('ov-proj')?.value||'';
  const typeF=document.getElementById('ov-type')?.value||'';
  const q=(document.getElementById('ov-search')?.value||'').toLowerCase();
  const _fmtDate=d=>{if(!d)return'—';const dt=new Date(d+'T00:00:00');return dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});};
  const today=new Date().toISOString().slice(0,10);

  const projIds=projId?[projId]:[...new Set([...TASKS.map(t=>t.projId),...MILESTONES.map(m=>m.projId)].filter(Boolean))];
  let H='';

  projIds.forEach(pid=>{
    const proj=PROJECTS.find(p=>p.id===pid);
    const col=proj?.color||'#7a8aaa';
    const tasks=TASKS.filter(t=>t.projId===pid&&!t.parentId&&(!q||(t.name||'').toLowerCase().includes(q)));
    const ms=MILESTONES.filter(m=>(!m.projId||m.projId===pid)&&(!q||(m.name||'').toLowerCase().includes(q)));
    if(!tasks.length&&!ms.length) return;

    H+=`<div style="border:1px solid var(--bd);border-radius:10px;margin-bottom:12px;overflow:hidden">`;
    H+=`<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:var(--bg2);border-bottom:1px solid var(--bd)">`;
    H+=`<span style="width:8px;height:8px;border-radius:2px;background:${col};flex-shrink:0"></span>`;
    H+=`<span style="font-size:13px;font-weight:700;color:var(--fg0)">${proj?.name||pid}</span>`;
    H+=`<span style="font-size:10px;color:var(--fg3);margin-left:auto">${tasks.length} tasks · ${ms.length} milestones</span>`;
    H+=`</div>`;

    if(typeF!=='milestones'&&tasks.length){
      H+=`<table style="width:100%;border-collapse:collapse;font-size:11px">`;
      H+=`<thead><tr style="background:var(--bg2)">`;
      H+=`<th style="padding:5px 10px;text-align:left;color:var(--fg3);font-weight:600">Task</th>`;
      H+=`<th style="padding:5px 10px;text-align:left;color:var(--fg3);font-weight:600">Status</th>`;
      H+=`<th style="padding:5px 10px;text-align:left;color:var(--fg3);font-weight:600">Resource</th>`;
      H+=`<th style="padding:5px 10px;text-align:left;color:var(--fg3);font-weight:600">Hours</th>`;
      H+=`<th style="padding:5px 10px;text-align:left;color:var(--fg3);font-weight:600">Deadline</th>`;
      H+=`<th style="padding:5px 10px;text-align:left;color:var(--fg3);font-weight:600">Start</th>`;
      H+=`<th style="padding:5px 10px;text-align:left;color:var(--fg3);font-weight:600">Dep</th>`;
      H+=`</tr></thead><tbody>`;
      const renderRow=(t,dep)=>{
        if(dep>10) return '';
        const dl=getEffectiveDeadline(t);
        const ov=dl&&tEnd(t)>dateToIdx(dl)&&t.status!=='done';
        const pad='padding-left:'+(10+dep*14)+'px';
        let row=`<tr onclick="openEditTask('${t.id}')" style="cursor:pointer;border-top:1px solid var(--bd)" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">`;
        row+=`<td style="${pad};padding-top:5px;padding-bottom:5px;padding-right:10px"><div style="display:flex;align-items:center;gap:5px">`;
        row+=`<span style="width:6px;height:6px;border-radius:50%;background:${SCOLS[t.status]||'var(--fg3)'};flex-shrink:0"></span>`;
        row+=`<span style="font-size:11px;font-weight:${dep===0?600:400};color:var(--fg0)">${t.name}</span></div></td>`;
        row+=`<td style="padding:5px 10px;font-size:10px;color:${SCOLS[t.status]||'var(--fg3)'}">${SLABELS[t.status]||t.status}</td>`;
        row+=`<td style="padding:5px 10px;font-size:10px;color:var(--fg2)">${t.resId?getRes(t.resId)?.name||'—':'—'}</td>`;
        row+=`<td style="padding:5px 10px;font-size:10px;color:var(--fg2)">${tHours(t)||0}h</td>`;
        row+=`<td style="padding:5px 10px;font-size:10px;color:${ov?'var(--danger)':'var(--fg2)'}">${dl?_fmtDate(dl)+(ov?' ⚠':''):'—'}</td>`;
        row+=`<td style="padding:5px 10px;font-size:10px;color:var(--fg2)">${t.start?_fmtDate(idxToDate(t.start)):'—'}</td>`;
        const dep2=getEffectiveDep(t);
        row+=`<td style="padding:5px 10px;font-size:10px;color:var(--fg3)">${(()=>{
          if(!dep2.depType) return '—';
          let _tt='Blocked by dependency';
          if(dep2.depType==='task'){ const _aids2=[...new Set([...(dep2.depIds||[]),dep2.depId].filter(Boolean))]; _tt='Waiting for: '+_aids2.map(did=>TASKS.find(x=>x.id===did)?.name||did).join(', '); }
          else if(dep2.depType==='resource'){ const _dr=getRes(dep2.depResId); _tt='Resource unavailable until: '+(dep2.depUntil||'?')+(_dr?' ('+_dr.name+')':'')+(dep2.depNote?' — '+dep2.depNote:''); }
          else if(dep2.depType==='milestone'){ const _dm=MILESTONES.find(m=>m.id===dep2.depMsId); _tt='Waiting for milestone: '+(_dm?.name||'?'); }
          return `<span style="position:relative;cursor:default" class="dep-chain-wrap"><span>⛓</span><span class="dep-tip" style="display:none;position:absolute;bottom:calc(100% + 4px);left:0;background:var(--bg2);border:1px solid var(--warn);border-radius:6px;padding:4px 8px;font-size:10px;color:var(--fg0);white-space:nowrap;z-index:100;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.4)">\${_tt}</span></span>`;
        })()}</td>`;
        row+=`</tr>`;
        TASKS.filter(ch=>ch.parentId===t.id).forEach(ch=>{row+=renderRow(ch,dep+1);});
        return row;
      };
      tasks.forEach(t=>{H+=renderRow(t,0);});
      H+=`</tbody></table>`;
    }

    if(typeF!=='tasks'&&ms.length){
      H+=`<table style="width:100%;border-collapse:collapse;font-size:11px;border-top:1px solid var(--bd)">`;
      H+=`<thead><tr style="background:var(--bg2)">`;
      H+=`<th style="padding:5px 10px;text-align:left;color:var(--fg3);font-weight:600">◆ Milestone</th>`;
      H+=`<th style="padding:5px 10px;text-align:left;color:var(--fg3);font-weight:600">Date</th>`;
      H+=`<th style="padding:5px 10px;text-align:left;color:var(--fg3);font-weight:600">Progress</th>`;
      H+=`</tr></thead><tbody>`;
      ms.forEach(m=>{
        const done=(m.taskIds||[]).filter(id=>TASKS.find(t=>t.id===id&&(t.status==='done'||t.status==='ready'))).length;
        const total=(m.taskIds||[]).length;
        const pct=total?Math.round(done/total*100):0;
        H+=`<tr onclick="openEditMilestone('${m.id}')" style="cursor:pointer;border-top:1px solid var(--bd)" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">`;
        H+=`<td style="padding:5px 10px"><div style="display:flex;align-items:center;gap:6px">`;
        H+=`<span style="display:inline-block;width:8px;height:8px;background:${m.color||'var(--acc2)'};transform:rotate(45deg);border-radius:1px;flex-shrink:0"></span>`;
        H+=`<span style="font-size:11px;font-weight:600;color:${m.color||'var(--acc2)'}">${m.name}</span></div></td>`;
        H+=`<td style="padding:5px 10px;font-size:10px;color:var(--fg2)">${m.dayIdx?_fmtDate(idxToDate(m.dayIdx)):'—'}</td>`;
        H+=`<td style="padding:5px 10px"><div style="display:flex;align-items:center;gap:6px">`;
        H+=`<div style="background:var(--bg3);border-radius:3px;height:5px;width:60px"><div style="background:${m.color||'var(--acc2)'};border-radius:3px;height:5px;width:${pct}%"></div></div>`;
        H+=`<span style="font-size:9px;color:var(--fg3)">${done}/${total}</span></div></td>`;
        H+=`</tr>`;
      });
      H+=`</tbody></table>`;
    }
    H+=`</div>`;
  });

  if(!projIds.length||!H) H='<div style="padding:40px;text-align:center;color:var(--fg3)">No items found</div>';
  el.innerHTML=H;
}

function renderGantt(){
  document.getElementById('sb-tc').textContent=TASKS.length;
  {const _sh=document.getElementById('gantt-sort-hdr');if(_sh)_sh.textContent=S._sortBy==='chrono'?'⬆ TASK':'TASK';}
  {const _vm={project:'vb-pr',team:'vb-tm',resource:'vb-rs'};document.querySelectorAll('#vb-pr,#vb-tm,#vb-rs').forEach(x=>x.classList.remove('on'));const _ve=document.getElementById(_vm[S.viewBy]);if(_ve)_ve.classList.add('on');}
  {const _sb=document.getElementById('vb-sel-btn');if(_sb)_sb.style.display=S.viewBy==='project'?'none':'';}  
  {const _sb=document.getElementById('vb-sel-btn');if(_sb)_sb.style.display=S.viewBy==='project'?'none':'';}
  // Sync expand/collapse-all button icon
  {const _btn=document.getElementById('btn-collapse-all');if(_btn){const _isTV=S.viewBy==='team'||S.viewBy==='resource';const _tw=TASKS.filter(t=>hasChildren(t.id));const _allC=_isTV?_tw.every(t=>!_expandedTeamRes.has(t.id)):_tw.every(t=>_collapsedTasks.has(t.id));_btn.textContent=_allC?'▶':'▼';_btn.title=_allC?'Expand all':'Collapse all';}}

  // Hide/show edit controls based on permission
  const canEdit=canEditGantt();
  const addTaskBtn=document.querySelector('#topbar .btn-p');
  if(addTaskBtn) addTaskBtn.style.display=canEdit?'':'none';
  const autoBtn=document.getElementById('btn-autosched');
  if(autoBtn) autoBtn.style.display=canEdit?'':'none';
  // Simulation buttons — admin only
  { const _sb=document.getElementById('btn-simulate'); if(_sb) _sb.style.display=isAdmin()?'':'none'; }
  { const _ch=document.getElementById('btn-clear-hints'); if(_ch) _ch.style.display=isAdmin()?'':'none'; }
  { const _wb=document.getElementById('btn-warnings'); if(_wb){ _wb.style.display=isAdmin()?'':'none'; if(isAdmin()) _refreshWarnBadge(); } }

  // Compute exact per-day schedules before rendering
  computeAllSchedules();
  // For ALL tasks: past days (≤ yesterday) show actual timeLogs, not planned hours
  {
    const _yst=GANTT_TODAY-1;
    TASKS.forEach(t=>{
      if(!t._sched) t._sched={};
      // First clear planned hours for past days
      Object.keys(t._sched).forEach(d=>{ if(+d<=_yst) delete t._sched[+d]; });
      // Then fill in actual logged hours for past days
      (t.timeLogs||[]).forEach(l=>{
        const di=dateToIdx(l.date);
        if(di&&di<=_yst&&(l.hours||0)>0.001)
          t._sched[di]=(t._sched[di]||0)+(l.hours||0);
      });
    });
  }

  // Populate project selector
  const _pSel=document.getElementById('proj-selector');
  if(_pSel){
    const _cur=_pSel.value;
    _pSel.innerHTML='<option value="">All projects</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    _pSel.value=_cur;
  }
  const tasks=visTasks();
  const rows=buildGRows(tasks);

  // COL_W: auto-fit or zoom override
  const FIXED_W=310;
  const availW=Math.max(300,(document.getElementById('gw')?.clientWidth||window.innerWidth-FIXED_W-40)-FIXED_W);
  const ZOOM_STEPS=[14,18,22,28,36,48,64,90]; // px per cell
  const zoomAuto=Math.max(14,Math.min(90,Math.floor(availW/28)));
  const COL_W=_ganttZoom===null?zoomAuto:ZOOM_STEPS[Math.max(0,Math.min(ZOOM_STEPS.length-1,_ganttZoom))];
  const totalDays=_ganttZoom===null?28:Math.max(7,Math.floor(availW/COL_W));

  const cols=Array.from({length:totalDays},(_,i)=>{
    const idx=i+1+S.offset;
    const dt=gDate(idx);
    return{idx,dt,nw:isNW(idx),en:ENB_DAYS.has(String(idx)),today:idx===GANTT_TODAY,locked:isLocked(idx),dow:dt.getDay(),month:dt.getMonth(),day:dt.getDate()};
  });

  // Month spans
  const msp=[]; let cm=-1,cs=0,cc=0;
  cols.forEach((c,i)=>{ if(c.month!==cm){if(cc>0)msp.push({m:cm,s:cs,n:cc});cm=c.month;cs=i;cc=1;}else cc++;});
  if(cc>0) msp.push({m:cm,s:cs,n:cc});

  // Update deadline banner
  // Use selected project for deadline display
  if(S._activeProjId){ const _ap=PROJECTS.find(p=>p.id===S._activeProjId); if(_ap) PROJ=_ap; }
  else if(PROJECTS.length) PROJ=PROJECTS[0];
  else PROJ={name:'PAZZI',deadline:null};
  const pdl=PROJ.deadline?dateToIdx(PROJ.deadline):null;
  const _projTasks=S._activeProjId?TASKS.filter(t=>t.projId===S._activeProjId):TASKS;
  const allEnds=_projTasks.map(t=>tEnd(t)).filter(Boolean);
  const lastEnd=allEnds.length?Math.max(...allEnds):null;
  document.getElementById('pdl-v').textContent=pdl?sd(pdl):'Not set';
  const projNameEl=document.getElementById('proj-name-disp'); if(projNameEl) projNameEl.textContent=PROJ.name||'PAZZI';
  document.getElementById('ltask-v').textContent=lastEnd?sd(lastEnd):'—';
  if(pdl&&lastEnd){
    const diff=lastEnd-pdl;
    document.getElementById('dl-stat').innerHTML=diff>0?`<span style="color:var(--danger)">⚠ ${diff}d over deadline</span>`:diff<0?`<span style="color:var(--ok)">✓ ${Math.abs(diff)}d to spare</span>`:'<span style="color:var(--ok)">✓ On schedule</span>';
  } else document.getElementById('dl-stat').textContent='';

  // Legend: team colors
  const usedTeams=[...new Set(tasks.map(t=>{const r=getRes(t.resId);return r&&r.teams?r.teams[0]:null;}).filter(Boolean))];
  document.getElementById('g-legend').innerHTML=
    usedTeams.map(id=>{const t=getTeam(id);return t?`<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--fg2)"><span style="width:7px;height:7px;border-radius:2px;background:${t.color}"></span>${t.name}</span>`:''}).join('')+
    `<span style="font-size:9px;color:var(--fg3);margin-left:4px">· bar height = h/day · locked = past · right-click for options</span>`;

  // Build col map
  const CM={};
  cols.forEach((c,ci)=>CM[c.idx]=ci);

  let H=`<div><table class="gt" style="width:100%;table-layout:fixed"><thead>
  <tr>
    <th class="stg th-m" style="left:0;z-index:12">Group</th>
    <th class="stn th-m" style="left:0;z-index:12;cursor:pointer;user-select:none" onclick="window._cycleSortGantt()" oncontextmenu="event.preventDefault();window._sortMenuGantt(event)" title="Left-click: cycle sort · Right-click: sort menu">
      Task <span id="g-sort-icon" style="font-size:8px;color:var(--fg3);margin-left:2px">${S._sortBy==='name'?'A-Z':S._sortBy==='tags'?'#':''}</span>
    </th>
    <th class="sto th-m" style="left:240px;z-index:12">Own</th>
    <th class="sth th-m" style="left:276px;z-index:12">Hrs</th>
    ${msp.map(ms=>`<th colspan="${ms.n}" class="th-m" style="width:${ms.n*COL_W}px">${MN[ms.m].toUpperCase()}</th>`).join('')}
  </tr>
  <tr>
    <th class="stg" style="height:28px;left:0;z-index:12;padding:0"></th>
    <th class="stn" id="th-task-col" style="height:28px;left:0;z-index:12;padding:0;cursor:pointer" onclick="S._sortBy=S._sortBy==='chrono'?'':'chrono';S._sortLocked=false;renderGantt();" title="Sort by date"><div id="gantt-sort-hdr" style="padding:0 8px;font-size:9px;font-weight:600;color:var(--fg3);display:flex;align-items:center;gap:3px">TASK</div></th>
    <th class="sto" style="height:28px;left:240px;z-index:12;padding:0"></th>
    <th class="sth" style="height:28px;left:276px;z-index:12;padding:0"></th>
    ${cols.map(c=>{
      let cls='th-d '+(c.today?'today':c.en?'en-h':c.nw?'nw-h':c.locked?'locked':'');
      const tip=`${c.dt.toDateString()}${c.nw?' (non-working — click to enable)':''}${c.en?' (enabled — click to revert)':''}${c.today?' TODAY':''}`;
      const mHere=MILESTONES.filter(m=>m.dayIdx===c.idx&&(!S._activeProjId||(m.projId?m.projId===S._activeProjId:(m.taskIds||[]).some(id=>TASKS.find(t=>t.id===id&&t.projId===S._activeProjId)))));
      // Build header milestone: single dot or multi-colour pie dot
      const dayN=gDate(c.idx).getDate();
      const msInHeader=(()=>{
        if(!mHere.length) return '';
        const ids=mHere.map(m=>m.id);
        // Cycle index: null=none, 0..n-1=each milestone
        const curIdx=ids.indexOf(_msFilter); // -1 if none active
        const isAnyAct=curIdx>=0;
        const allCols=mHere.map(m=>m.color||'var(--acc2)');
        const dotBg=allCols.length===1
          ? allCols[0]
          : `conic-gradient(${allCols.map((col,i)=>`${col} ${Math.round(i/allCols.length*360)}deg ${Math.round((i+1)/allCols.length*360)}deg`).join(',')})`;
        // Active milestone colour for the line
        const lineCol=isAnyAct?allCols[curIdx]:allCols[0];
        const tip=mHere.map(m=>m.name).join(' · ')+' — click to cycle filter · right-click for menu';
        // Left-click: cycle through milestones then clear
        // Order: none→ms[0]→ms[1]→...→ms[n-1]→none
        const nextId=curIdx===-1?ids[0]:(curIdx===ids.length-1?null:ids[curIdx+1]);
        const clickFn=nextId?`cycleMsFilter('${nextId}')`:`cycleMsFilter(null)`;
        // Right-click: show menu
        const ctxFn=`showMsDayMenu(event,${JSON.stringify(ids).replace(/"/g,"'")})`;
        return `<div onclick="event.stopPropagation();${clickFn}" oncontextmenu="event.preventDefault();event.stopPropagation();${ctxFn}"
          title="${tip}"
          style="position:absolute;top:0;bottom:0;left:50%;width:28px;transform:translateX(-50%);z-index:20;cursor:pointer;pointer-events:all">
          <div style="position:absolute;top:0;bottom:0;left:50%;width:${isAnyAct?3:2}px;transform:translateX(-50%);background:${lineCol};opacity:${isAnyAct?1:.65};border-radius:1px;pointer-events:none"></div>
          ${(()=>{
            const allDiamond=mHere.every(m=>m.shape==='diamond');
            if(allDiamond){
              return `<div style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%) rotate(45deg);width:20px;height:20px;background:${dotBg};border:2px solid var(--bg0);pointer-events:none;z-index:21;${isAnyAct?'box-shadow:0 0 8px '+lineCol+';':''}">
                <span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:8px;font-weight:800;color:#fff;line-height:1">${dayN}</span>
              </div>`;
            }
            return `<div style="position:absolute;bottom:1px;left:50%;transform:translateX(-50%);width:28px;height:28px;border-radius:50%;background:${dotBg};border:2.5px solid var(--bg0);display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:21;${isAnyAct?'box-shadow:0 0 10px '+lineCol+';':''}">
              <span style="font-size:9px;font-weight:800;color:#fff;line-height:1;text-shadow:0 1px 2px rgba(0,0,0,.6)">${dayN}</span>
            </div>`;
          })()}
        </div>`;
      })();
      const isPdlCol=pdl&&c.idx===pdl;
      const pdlInHeader=isPdlCol?`
        <div class="pdl-line" style="top:100%"></div>
        <div class="pdl-flag" style="bottom:-12px;font-size:6px">▲ DL</div>
      `:'';
      if(isPdlCol) cls+=' pdl-col-hdr';
      return `<th class="${cls}" style="width:${COL_W}px;min-width:${COL_W}px;max-width:${COL_W}px;cursor:pointer;position:relative;${isPdlCol?'box-shadow:inset 0 0 0 2px var(--danger);border-radius:4px;':''}" title="${tip}${isPdlCol?' — PROJECT DEADLINE':''}" onclick="dayHdrClick(event,${c.idx})" oncontextmenu="dayHdrCtx(event,${c.idx})">
        <div style="font-size:9px;font-weight:600">${c.day}</div>
        <div style="font-size:7px;opacity:.6">${DN[c.dow]}</div>
        ${msInHeader}${pdlInHeader}
      </th>`;
    }).join('')}
  </tr></thead><tbody>`;

  rows.forEach((row,ri)=>{
    // ── Inline parent row (shown above cross-section subtask when toggled) ──
    if(row.isInlineParent){
      const {t}=row;
      const isDone=t.status==='done'||t.status==='cancelled';
      const r=getRes(t.resId);
      const _pr=PROJECTS.find(p=>p.id===t.projId);
      const _teamId=t.teamId||null;
      const _teamColor=_teamId?getTeam(_teamId)?.color:null;
      const _resTeamColor=(()=>{if(!r||!r.teams?.length) return null;for(const _tid of r.teams){const tc=getTeam(_tid)?.color;if(tc) return tc;}return null;})();
      const barColor=_teamColor||_resTeamColor||'#7a8aaa';
      const td2=tDur(t), te=tEnd(t), tst=t.start||GANTT_TODAY;
      H+=`<tr data-tid="${t.id}" style="opacity:${isDone?'.4':'.75'};background:rgba(37,47,69,.25)">
        <td class="stg" style="width:50px;max-width:50px;height:28px;text-align:center;font-size:8px;color:var(--fg3);padding:0 2px">${t.group||''}</td>
        <td class="stn" style="padding:1px 6px;width:240px;max-width:240px;background:transparent;border-top:1px solid rgba(37,47,69,.15)">
          <div style="display:flex;align-items:center;gap:4px">
            <span style="color:var(--acc);font-size:9px;flex-shrink:0;cursor:pointer" onclick="toggleParentInline('${t.id}',event)" title="Hide parent task">▲</span>
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;color:var(--fg3);flex:1;min-width:0;cursor:pointer;font-style:italic" onclick="openEditTask('${t.id}')" title="${t.name}">
              ${_pr?`<span style="font-size:7px;padding:0 3px;border-radius:2px;background:${(_pr.color||'var(--acc)')+'22'};color:${_pr.color||'var(--acc)'};margin-right:3px">${_pr.name}</span>`:''}${t.name}
            </div>
          </div>
        </td>
        <td class="sto" style="border-top:1px solid rgba(37,47,69,.15)">${r?`<div class="av av-sm ${r.avClass}" style="font-size:7px;width:16px;height:16px;line-height:16px;opacity:.6" title="${r.name}">${r.initials}</div>`:''}</td>
        <td class="sth" style="font-size:8px;color:var(--fg3);border-top:1px solid rgba(37,47,69,.15)">${tHours(t)%1===0?tHours(t):tHours(t).toFixed(1)}h</td>`;
      cols.forEach(col=>{
        const day=col.idx; const cellNW=isNW(day,null,t.resId);
        const tcls=col.today?'tdc':cellNW?'nwc':'';
        const inRange=day>=tst&&day<tst+td2&&!cellNW;
        if(inRange){
          H+=`<td class="${tcls}" style="padding:1px;border-top:1px solid rgba(37,47,69,.15)">
            <div style="background:${barColor}33;height:4px;width:100%;border-radius:2px"></div></td>`;
        } else {
          H+=`<td class="${tcls}" style="border-top:1px solid rgba(37,47,69,.15)"></td>`;
        }
      });
      H+='</tr>';
      return;
    }
    // ── Subtask row ─────────────────────────────────────────
    if(row.isSubtask){
      const {t,st}=row;
      const stRes=getRes(st.resId);
      const stIsDone=st.status==='done';
      const stCol=SCOLS[st.status]||'var(--fg3)';
      // Use subtask deadline or fall back to parent task deadline
      const stDlIdx=st.deadline?dateToIdx(st.deadline):(t.deadline?dateToIdx(t.deadline):null);
      // Compute start and duration like a normal task
      const stStart=st.start||t.start||GANTT_TODAY;
      const stCap=getRes(st.resId||t.resId)?.dailyCap||HPD;
      const stHours=st.hours||(t.hours/Math.max(1,(t.subtasks||[]).length));
      // Compute duration respecting NW days
      const stResId2=st.resId||t.resId;
      let _stRem=stHours, _stD=stStart, _stWorkDays=0;
      while(_stRem>0.001&&_stWorkDays<500){
        if(!isNW(_stD,null,stResId2)){ _stRem-=stCap; _stWorkDays++; }
        if(_stRem>0.001) _stD++;
      }
      const stDur=Math.max(1,_stD-stStart+1);
      const stEnd=stStart+stDur-1;
      const stBarColor=stRes&&stRes.teams?.length?(getTeam(stRes.teams[0])?.color||'#7a8aaa'):(t.teamId?getTeam(t.teamId)?.color||'#7a8aaa':'#7a8aaa');
      const stOv=stDlIdx&&stEnd>stDlIdx&&!stIsDone;
      const stTip=`${st.name} · ${stHours}h · ${stStart?sd(stStart)+' → '+sd(stEnd):'no dates'}`;
      H+=`<tr style="opacity:${stIsDone?'.5':'1'}">
        <td class="stg" style="width:50px;max-width:50px;height:28px;background:var(--bg1);border-top:1px solid rgba(37,47,69,.2)"></td>
        <td class="stn" style="padding:1px 6px;padding-left:22px;width:240px;max-width:240px;background:var(--bg1);border-top:1px solid rgba(37,47,69,.2)">
          <div style="display:flex;align-items:center;gap:4px">
            ${row.isCrossSub
              ? `<span onclick="toggleParentInline('${t.id}',event)" title="${_shownParentTasks.has(t.id)?'Hide':'Show'} parent: ${t.name}" style="color:${_shownParentTasks.has(t.id)?'var(--acc)':'var(--fg3)'};font-size:9px;margin-right:1px;flex-shrink:0;cursor:pointer">⤴</span>`
              : `<span style="color:var(--fg3);font-size:8px;margin-right:1px;flex-shrink:0">⤷</span>`
            }
            <button onclick="event.stopPropagation();window._cycleSubtaskStatus('${t.id}','${st.id}')"
              title="${SLABELS[st.status]||st.status}"
              style="flex-shrink:0;width:11px;height:11px;border-radius:50%;border:1.5px solid ${stCol};background:${stIsDone?stCol:'transparent'};cursor:pointer;padding:0"></button>
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:${stIsDone?'var(--fg3)':'var(--fg1)'};flex:1;min-width:0;${stIsDone?'text-decoration:line-through':''}" title="${st.name}">
              ${st.name}
            </div>
          </div>
        </td>
        <td class="sto" style="width:36px;text-align:center;padding:0 2px;border-top:1px solid rgba(37,47,69,.2)">
          ${stRes?`<div class="av av-sm ${stRes.avClass}" style="font-size:7px;width:18px;height:18px;line-height:18px" title="${stRes.name}">${stRes.initials}</div>`:''}
        </td>
        <td class="sth" style="width:34px;text-align:center;padding:0 1px;font-size:9px;font-family:var(--mono);color:var(--fg3);border-top:1px solid rgba(37,47,69,.2)">${stHours%1===0?stHours:stHours.toFixed(1)}h</td>`;
      // Per-day bar cells — same logic as normal task bars
      let stFirstBi=-1, stLastBi=-1;
      cols.forEach((col,ci)=>{ if(col.idx>=stStart&&col.idx<=stEnd&&!isNW(col.idx,null,st.resId||t.resId)){if(stFirstBi<0)stFirstBi=ci;stLastBi=ci;} });
      cols.forEach((col,ci)=>{
        const day=col.idx;
        const locked=isLocked(day);
        const cellNW=isNW(day,null,st.resId||t.resId);
        const isPdlDay2=pdl&&day===pdl;
        const tcls=(col.today?'tdc':cellNW?'nwc':locked?'lkc':'')+(isPdlDay2?' pdl-col':'');
        const pdlLine2=isPdlDay2?'<div class="pdl-line" style="z-index:9"></div>':'';
        const isDlDay=stDlIdx&&day===stDlIdx;
        const bdStyle='border-top:1px solid rgba(37,47,69,.2)';
        // Use _sched if available (TASKS[] child), else greedy pack
        const _stDayH2=st._sched?st._sched[day]:_subHoursOnDay(st,t,day);
        const _stInRange=st._sched?(_stDayH2||0)>0.001:(day>=stStart&&day<=stEnd&&!cellNW);
        if(_stInRange){
          const _stDayH=_stDayH2||0;
          const frac=Math.min(1,_stDayH/stCap);
          const bh=Math.max(BAR_MIN,Math.round(BAR_MIN+frac*(BAR_MAX-BAR_MIN)));
          const isOvDay=stDlIdx&&day>stDlIdx;
          H+=`<td class="${tcls}" style="padding:1px;overflow:visible;vertical-align:middle;position:relative;${bdStyle}">
            ${pdlLine2}${isDlDay?'<div class="dl-marker"></div>':''}
            <div class="gb" style="background:${stIsDone?'rgba(34,197,94,.25)':locked?stBarColor+'44':stBarColor+'88'};height:${bh}px;width:100%;border-radius:3px;position:relative;cursor:${locked?'default':'grab'};opacity:.85;${stOv&&!stIsDone?'outline:1px solid rgba(220,38,38,.85);':''}"
              title="${stTip}"
              onmousedown="${locked?'':` bMD(event,'${t.id}__${st.id}',${stStart},${COL_W})`}"
              onclick="if(!_mv)window._openSubtaskEditor('${t.id}','${st.id}')"
              oncontextmenu="event.preventDefault();window._showSubCtx(event,'${t.id}','${st.id}')">
              ${stIsDone?'<div class="gp" style="width:100%;z-index:2;position:relative"></div>':''}
              ${ci===stFirstBi&&!locked?`<span class="gr gr-l" onmousedown="event.stopPropagation();stRMD(event,'${t.id}','${st.id}','l',${COL_W})"></span>`:''}
              ${ci===stLastBi&&!locked?`<span class="gr gr-r" onmousedown="event.stopPropagation();stRMD(event,'${t.id}','${st.id}','r',${COL_W})"></span>`:''}
            </div>
          </td>`;
        } else {
          H+=`<td class="${tcls}" style="position:relative;${bdStyle}">
            ${pdlLine2}${isDlDay?'<div class="dl-marker"></div>':''}
          </td>`;
        }
      });
      H+='</tr>';
      return;
    }
    // ── Group sub-header row (by group field) ────────────────────
    if(row.isGrpHdr){
      H+=`<tr style="height:16px">
        <td class="stn" style="padding:0 8px;font-size:8px;font-weight:700;color:${row.color};letter-spacing:.5px;text-transform:uppercase;background:rgba(20,24,32,.95);border-bottom:1px solid rgba(37,47,69,.6);position:sticky;left:0;z-index:5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          <span style="opacity:.7">${row.label}</span>
        </td>
        <td class="sto" style="background:rgba(20,24,32,.95);border-bottom:1px solid rgba(37,47,69,.6)"></td>
        <td class="sth" style="background:rgba(20,24,32,.95);border-bottom:1px solid rgba(37,47,69,.6)"></td>
        ${cols.map(c=>`<td style="background:rgba(20,24,32,.95);border-bottom:1px solid rgba(37,47,69,.6);width:${COL_W}px;min-width:${COL_W}px"></td>`).join('')}
      </tr>`;
      return;
    }
    // ── Group header row ──────────────────────────────────────────
    if(row.isGH){
      const resId=row.resId||null; // will be set when viewBy=resource
      // Build day cells for group header
      // Pre-compute daily alloc for this resource (all tasks)
      let _resAlloc={};
      if(resId){
        const _resTasks=TASKS.filter(t=>!t._sched&&!t.start?false:true);
        TASKS.forEach(t=>{
          if(t.status==='done'||t.status==='cancelled') return;
          const _sched=(t.resId===resId?t._sched:null)||(t._schedCo?.[resId]||null);
          if(!_sched) return;
          Object.entries(_sched).forEach(([d,h])=>{ _resAlloc[d]=(_resAlloc[d]||0)+h; });
        });
      }
      const dayCells=cols.map(c=>{
        // Determine state for this day for this resource
        let nw;
        if(resId){
          nw=isNW(c.idx,null,resId);
        } else {
          nw=c.nw;
        }
        const en=resId?(RES_DAYS.get(resId)?.enabled?.has(String(c.idx))):c.en;
        let bg=nw?'rgba(10,14,22,.5)':c.today?'rgba(79,156,249,.1)':'transparent';
        if(en) bg='rgba(34,197,94,.08)';
        const clickFn=resId?`dayResClick(event,${c.idx},'${resId}')`:`dayHdrClick(event,${c.idx})`;
        // Check if this day is a time-off day for this resource
        let _toTip='';
        if(resId&&nw){
          const _r=getRes(resId);
          const _toEntry=(_r?.timeOff||[]).find(to=>{ const s=dateToIdx(to.start),e=dateToIdx(to.end); return s&&e&&c.idx>=s&&c.idx<=e; });
          if(_toEntry){const _icons={vacation:'🏖',sick:'🤒',local_holiday:'📅',other:'📌'}; _toTip=(_icons[_toEntry.type]||'📌')+' '+(_toEntry.note||_toEntry.type);}
        }
        // Build alloc/cap indicator for resource view
        let allocLabel='';
        if(resId&&!nw){
          const _cap=getRes(resId)?.dailyCap||HPD;
          const _alloc=_resAlloc[c.idx]||0;
          if(_alloc>0){
            const _avail=Math.max(0,_cap-_alloc);
            const _pct=_avail/_cap;
            const _col=_pct>0.5?'var(--danger)':_pct>0?'var(--warn)':'var(--ok)';
            const _allocStr=(_alloc%1===0?_alloc:_alloc.toFixed(1))+'h';
            allocLabel=`<div style="font-size:7px;font-weight:600;color:${_col};line-height:1.2">${_allocStr}</div><div style="height:2px;background:var(--bg3);border-radius:1px;overflow:hidden;margin-top:1px"><div style="height:100%;width:${Math.round((1-_pct)*100)}%;background:${_col}"></div></div>`;
          }
        }
        return `<td style="width:${COL_W}px;min-width:${COL_W}px;max-width:${COL_W}px;background:${bg};cursor:pointer;text-align:center;padding:0;font-size:7px;color:${nw?'#3a4a60':c.today?'var(--acc)':'#4a5a70'};border-right:1px solid rgba(37,47,69,.32)"
          onclick="${clickFn}" title="${_toTip||c.dt.toDateString()}${nw&&!_toTip?' (non-working)':''}">${allocLabel||c.day}</td>`;
      }).join('');
      H+=`<tr class="gh-row" style="height:18px">
        <td colspan="3" class="stn" style="padding:3px 8px;font-size:9px;font-weight:700;color:var(--fg2);letter-spacing:.5px;text-transform:uppercase;background:rgba(26,32,46,.9);border-bottom:1px solid var(--bd);position:sticky;left:0;z-index:6">
          ${(()=>{const _r=getRes(row.resId);const _teams=_r?(_r.teams||[]):[];if(_teams.length>1){return _teams.map(tid=>{const tc=getTeam(tid)?.color||row.color;return '<span style="width:6px;height:6px;border-radius:50%;background:'+tc+';display:inline-block;margin-right:2px;vertical-align:middle"></span>';}).join('');}return '<span style="width:6px;height:6px;border-radius:2px;background:'+row.color+';display:inline-block;margin-right:5px;vertical-align:middle"></span>';})()}${row.label}
          ${resId?`<span style="font-size:8px;color:var(--fg3);margin-left:4px;font-weight:400;text-transform:none">click day to toggle</span>`:''}
        </td>
        ${dayCells}
      </tr>`;
      return;
    }
    const {t,tid,viewResId}=row;
    const isDone=t.status==='done'||t.status==='cancelled';
    const isHold=t.status==='hold'; // paused stays blue like doing
    // In resource view show hours for the specific resource being viewed
    const th = viewResId && t.resHours?.[viewResId]
      ? t.resHours[viewResId]
      : tHours(t);
    const td2=tDur(t), te=tEnd(t);
    const _effDl=getEffectiveDeadline(t);
    const dlDay=_effDl?dateToIdx(_effDl):null;
    const isOv=dlDay&&te>dlDay&&!isDone;
    const inc=isInc(t);
    const _td=getEffectiveDep(t);
    const _depAllIds=[...new Set([...(_td.depIds||[]),_td.depId].filter(Boolean))].filter(id=>id!==t.id);
    const depBl=(_td.depType==='task'&&_depAllIds.length>0&&_depAllIds.some(did=>TASKS.find(x=>x.id===did&&(x.status!=='done'||TASKS.filter(ch=>ch.parentId===x.id).some(ch=>ch.status!=='done')))))
              || (_td.depType==='resource'&&_td.depUntil&&dateToIdx(_td.depUntil)>=GANTT_TODAY)
              || (_td.depType==='milestone'&&_td.depMsId&&(()=>{ const _ms=MILESTONES.find(m=>m.id===_td.depMsId); return _ms&&_ms.dayIdx>=GANTT_TODAY; })());
    // Color by viewResId team in resource view, otherwise primary resource
    const displayResId=viewResId||t.resId;
    const r=getRes(displayResId||t.resId);
    const _parentTask=t.parentId?TASKS.find(p=>p.id===t.parentId):null;
    // Bar color: task's own team first, fallback to resource's team
    const _taskTeamId=t.teamId||(_parentTask?.teamId)||null;
    const _taskTeamColor=_taskTeamId?getTeam(_taskTeamId)?.color:null;
    const _resTeamColor=(()=>{if(!r||!r.teams?.length) return null;for(const tid of r.teams){const tc=getTeam(tid)?.color;if(tc) return tc;}return null;})();
    const barColor=_taskTeamColor||_resTeamColor||tagCol((t.tags||[])[0])||'#7a8aaa';
    let rowStyle=isDone?'opacity:.5':'';
    if(isHold) rowStyle='background:rgba(240,169,40,.03)';
    if(isOv) rowStyle='background:rgba(240,82,82,.03)';
    if(inc) rowStyle='background:rgba(240,169,40,.02)';

    // In resource view: show only the avatar of the resource being viewed; otherwise show all
    const allResIds=[t.resId,...(t.coResIds||[])].filter(Boolean);
    const ownerHtml= viewResId
      ? (()=>{ const rx=getRes(viewResId); return rx?`<div class="av av-sm ${rx.avClass}" title="${rx.name}">${rx.initials}</div>`:''; })()
      : allResIds.length
        ? allResIds.map(id=>{ const rx=getRes(id); return rx?`<div class="av av-sm ${rx.avClass}" title="${rx.name}" style="margin-right:-4px;outline:1px solid var(--bg1)">${rx.initials}</div>`:''; }).join('')
        : `<span style="font-size:8px;color:var(--fg3)">${(t.resource||'—').split(' ')[0].substring(0,3)}</span>`;

    // Hold tooltip
    let holdTip='';
    if(isHold){
      const blocker=t.holdBlocker||t.holdBlockerId||'';
      const blockerTask=t.holdTask?TASKS.find(x=>x.id===t.holdTask)?.name||'':''
      const note=t.notes||'';
      holdTip=`On hold${blocker?' — blocked by: '+blocker:''}${blockerTask?' task: '+blockerTask:''}${note?' note: '+note:''}`;
    }

    H+=`<tr data-tid="${t.id}" style="${rowStyle}">
      <td class="stg" style="width:50px;max-width:50px;height:36px;text-align:center;vertical-align:middle;font-size:9px;font-weight:700;font-family:var(--mono);color:var(--fg2);padding:0 2px">${t.group||''}</td>
      <td class="stn" style="padding:2px 6px;width:240px;max-width:240px;height:36px;overflow:hidden;vertical-align:middle">
        <div style="display:flex;align-items:center;gap:4px">
          ${row.depth?`<span style="display:inline-block;width:${row.depth*10}px;flex-shrink:0"></span>`:''}
          <input type="checkbox" class="gt-sel-cb" data-tid="${t.id}"
            onclick="event.stopPropagation();toggleSelTask('${t.id}',this.checked)"
            ${_selTasks.has(t.id)?'checked':''}
            title="Select task">
          
          ${(()=>{
            const _isTV=S.viewBy==='team'||S.viewBy==='resource';
            if(_isTV&&hasChildren(t.id)){
              const _exp=_expandedTeamRes.has(t.id);
              return `<span onclick="toggleExpandTeamRes('${t.id}',event)" style="cursor:pointer;font-size:9px;color:var(--fg3);flex-shrink:0;width:10px;text-align:center;user-select:none">${_exp?'▼':'▶'}</span>`;
            }
            if(S.viewBy==='project'&&hasChildren(t.id)){
              return `<span onclick="toggleCollapse('${t.id}',event)" style="cursor:pointer;font-size:9px;color:var(--fg3);flex-shrink:0;width:10px;text-align:center;user-select:none">${_collapsedTasks.has(t.id)?'▶':'▼'}</span>`;
            }
            return `<span style="display:inline-block;width:10px;flex-shrink:0"></span>`;
          })()}
          <button onclick="event.stopPropagation();cycleStatus('${t.id}')" oncontextmenu="event.preventDefault();event.stopPropagation();showStatusMenu(event,'${t.id}')"
            title="${t.status==='doing'||t.status==='paused'?'Use timer to control':'Click → Done · Right-click for more'}"
            style="flex-shrink:0;width:14px;height:14px;border-radius:50%;border:2px solid ${SCOLS[t.status]};background:${t.status==='done'?SCOLS[t.status]:'transparent'};cursor:pointer;padding:0;transition:all .15s;font-size:7px;line-height:1;display:flex;align-items:center;justify-content:center;color:${SCOLS[t.status]}">
            ${t.status==='paused'?'⏸':t.status==='doing'?'▶':''}
          </button>
          ${depBl?(()=>{
              let _depTip='Blocked by dependency';
              if(_td.depType==='task'&&_depAllIds.length>0){const _names=_depAllIds.map(did=>TASKS.find(x=>x.id===did)?.name||did);_depTip='Waiting for: '+_names.join(', ');}
              else if(_td.depType==='resource'&&_td.depUntil){_depTip='Resource unavailable until: '+_td.depUntil+(_td.depNote?' — '+_td.depNote:'');}
              else if(_td.depType==='milestone'&&_td.depMsId){const _msd=MILESTONES.find(m=>m.id===_td.depMsId);_depTip='Waiting for milestone: '+(_msd?.name||_td.depMsId);}
              return `<span style="font-size:9px;color:var(--warn);cursor:default;position:relative;flex-shrink:0;width:14px;display:inline-flex;align-items:center" class="dep-chain-wrap"><span>⛓</span><span class="dep-tip" style="display:none;position:fixed;background:var(--bg2);border:1px solid var(--warn);border-radius:6px;padding:4px 8px;font-size:10px;color:var(--fg0);white-space:nowrap;z-index:9999;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.4);transform:translateY(-50%)">${_depTip}</span></span>`;
            })():''}
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;font-size:11px;color:${isDone?'var(--fg2)':'var(--fg0)'};flex:1;min-width:0" onclick="openEditTask('${t.id}')" title="${t.name}">
            ${inc?'<span style="color:var(--warn);font-size:9px;margin-right:2px" title="Incomplete">⚠</span>':''}
            ${isHold?`<span style="color:var(--warn);font-size:9px;margin-right:2px" title="${holdTip}">⏸</span>`:''}
            ${t.name}${(()=>{
              if(S.viewBy==='project') return '';
              const _lines=[];
              if(t.projId&&!S._activeProjId){const _pr=PROJECTS.find(p=>p.id===t.projId);if(_pr)_lines.push('<span style="font-size:8px;padding:1px 4px;border-radius:3px;background:'+(_pr.color||'var(--acc)')+'22;color:'+(_pr.color||'var(--acc)')+';display:inline-block;margin-top:1px">'+_pr.name+'</span>');}
              if(t.parentId){const _p=[];let _c=TASKS.find(x=>x.id===t.parentId);while(_c&&_p.length<5){_p.unshift(_c.name);_c=_c.parentId?TASKS.find(x=>x.id===_c.parentId):null;}_lines.push('<span style="font-size:8px;color:var(--fg3);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_p.join(' › ')+'</span>');}
              return _lines.length?'<div style="margin-top:1px;overflow:hidden">'+_lines.join('')+'</div>':'';
            })()}${(()=>{ const _ch=TASKS.filter(x=>x.parentId===t.id); const _leg=(t.subtasks||[]).filter(s=>s.name?.trim()&&!_ch.find(c=>c.id===s.id)); const allSt=[..._ch,..._leg]; if(!allSt.length) return ''; const dn=allSt.filter(s=>s.status==='done'||s.done).length; return `<span style="font-size:8px;color:${dn===allSt.length?'var(--ok)':'var(--fg3)'};margin-left:5px;font-family:var(--mono)" title="Subtasks: ${dn} done / ${allSt.length} total">☑${dn}/${allSt.length}</span>`; })()}
          </div>
        </div>
        <div style="display:flex;gap:2px;flex-wrap:wrap;align-items:center;margin-top:1px;padding-left:18px">
          ${(t.tags||[]).map(tg=>`<span class="tp" style="background:${tagCol(tg)}1a;color:${tagCol(tg)}">${tg}</span>`).join('')}
          ${''/* ⛓ moved to task name row */}
          ${dlDay?`<span style="font-size:8px;color:${isOv?'var(--danger)':'var(--fg3)'}" title="Deadline: ${t.deadline}">⚑${isOv?' OVR':''}</span>`:''}
        </div>
      </td>
      <td class="sto" style="width:36px;text-align:center;padding:0 2px;vertical-align:middle">${ownerHtml}</td>
      <td class="sth" style="width:34px;text-align:center;padding:0 1px;font-size:9px;font-family:var(--mono);color:var(--fg2);vertical-align:middle" title="${logH(t)>0?logH(t)+'h logged / '+th+'h planned':th+'h planned'}">${(()=>{ const _lg=logH(t); const _ov=_lg>parseFloat(th); return _lg>0?`<span style="color:${_ov?'var(--danger)':' var(--ok)'}">${_lg%1===0?_lg:_lg.toFixed(1)}</span>${_ov?'<span style="color:var(--danger);font-size:8px" title="Logged hours exceed planned hours">⚠</span>':''}<span style="color:var(--fg3)">/${th}h</span>`:(th+'h'); })()}</td>`;

    // Per-day bar rendering — use co-resource sched/start when viewing a co-resource
    const _isCoResView=viewResId&&viewResId!==t.resId&&(t.coResIds||[]).includes(viewResId);
    // Simulated-resource flag: task whose primary or co-resource is a hypothetical (simulated) resource
    const _isSimRes=(()=>{ const _rs=getRes(_isCoResView?viewResId:t.resId); if(_rs?.simulated) return true; return [t.resId,...(t.coResIds||[])].some(rid=>getRes(rid)?.simulated); })();
    const cap=getRes(_isCoResView?viewResId:t.resId)?.dailyCap||HPD;
    const sched=(_isCoResView&&t._schedCo?.[viewResId])||(t._sched)||{};
    const schedDays=Object.keys(sched).map(Number).sort((a,b)=>a-b);
    const _effStart=(_isCoResView&&t.resStart?.[viewResId])||t.start||GANTT_TODAY;
    const _effDur=(_isCoResView&&t.resDur?.[viewResId])||t.dur||1;
    let firstSchedDay=schedDays[0]||_effStart;
    let lastSchedDay=schedDays[schedDays.length-1]||(_effStart+_effDur-1);
    if((tHours(t)??0)===0){
      const _desc=_getDescAll(t.id);
      if(_desc.length){
        const _starts=_desc.map(ch=>ch.start).filter(Boolean);
        const _ends=_desc.map(ch=>tEnd(ch)).filter(x=>x>1);
        if(_starts.length){
          firstSchedDay=Math.min(..._starts);
          lastSchedDay=_ends.length?Math.max(..._ends):firstSchedDay;
          // Update t.start/t.dur so sort and tEnd() work correctly
          t.start=firstSchedDay;
          t.dur=Math.max(1,lastSchedDay-firstSchedDay+1);
        }
      }
    }
    const progW=t.prog||0;
    const barCls=['gb',isOv?'overdue-bar':'',t.status==='hold'?'hold-bar':'',inc?'incomplete-bar':''].filter(Boolean).join(' ');
    let firstBarCi=-1,lastBarCi=-1;
    cols.forEach((c,ci)=>{ if((sched[c.idx]||0)>0.001){if(firstBarCi<0)firstBarCi=ci;lastBarCi=ci;} });

    // Subtask outline: span from earliest subtask start to latest subtask end
    // Include both legacy subtasks[] and new TASKS[] children (parentId model)
    const _stDescAll=_getDescAll(t.id);
    const _stLegacy=(t.subtasks||[]).filter(s=>s.name?.trim()&&!TASKS.find(x=>x.id===s.id));
    const _stArr=[..._stLegacy,..._stDescAll];
    let _stOutlineFirst=-1,_stOutlineLast=-1;
    if(_stArr.length&&_showSubtasks){
      let stMin=Infinity, stMax=-Infinity;
      _stArr.forEach(s=>{
        const _sd2=s.dur||Math.max(1,Math.ceil((s.hours||1)/(getRes(s.resId||t.resId)?.dailyCap||HPD)));
        stMin=Math.min(stMin,s.start);
        stMax=Math.max(stMax,s.start+_sd2-1);
      });
      // Outline covers full range: from min(task_start, subtask_min) to max(task_end, subtask_max)
      // Only draw OUTSIDE the task's own bar
      const _outlineMin=Math.min(stMin,firstSchedDay);
      const _outlineMax=Math.max(stMax,lastSchedDay);
      if(stMin<firstSchedDay||stMax>lastSchedDay){ // only if subtasks extend beyond task
        cols.forEach((col2,ci2)=>{
          if(col2.idx>=_outlineMin&&_stOutlineFirst<0) _stOutlineFirst=ci2;
          if(col2.idx<=_outlineMax) _stOutlineLast=ci2;
        });
      }
    }

    // Dependency end day — the last day the dependency occupies (task ends here or resource until date)
    let depDay=null;
    if(t.depType==='task'){
      const _allDeps=[...new Set([...(t.depIds||[]),t.depId].filter(Boolean))];
      _allDeps.forEach(did=>{ const dep=TASKS.find(x=>x.id===did); if(dep&&dep.start){ const e=tEnd(dep); if(depDay===null||e>depDay) depDay=e; } });
    } else if(t.depType==='resource'&&t.depUntil){
      depDay=dateToIdx(t.depUntil);
    } else if(t.depType==='milestone'&&t.depMsId){
      const _depMs=MILESTONES.find(m=>m.id===t.depMsId);
      if(_depMs&&_depMs.dayIdx) depDay=_depMs.dayIdx;
    }

    for(let ci=0;ci<cols.length;ci++){
      const c=cols[ci];
      const day=c.idx;
      const locked=isLocked(day);
      const cellNW=isNW(day,t.id,t.resId);
      const cellEN=!cellNW&&(ENB_DAYS.has(String(day))||RES_DAYS.get(t.resId)?.enabled?.has(String(day))||TASK_DAYS.get(t.id)?.enabled?.has(String(day)));
      const isPdl=pdl&&day===pdl;
      const tcls=(c.today?'tdc':cellEN?'enc':cellNW?'nwc':locked?'lkc':'')+(isPdl?' pdl-col':'');
      const pdlOverlay=isPdl?'<div class="pdl-line" style="z-index:9"></div>':'';
      const isDlCol=dlDay&&day===dlDay;
      const isDepCol=depDay&&day===depDay;
      const dayHours=sched[day]||0;
      const _depMarkerTip=(()=>{ if(!isDepCol) return ''; if(t.depType==='task'){ const _aids=[...new Set([...(t.depIds||[]),t.depId].filter(Boolean))]; const _names=_aids.map(did=>TASKS.find(x=>x.id===did)?.name||did); return _names.length?'⛓ Waiting for: '+_names.join(', '):'⛓'; } if(t.depType==='resource'){ const _dr=getRes(t.depResId); return `⛓ Resource unavailable until: ${t.depUntil||'?'}${_dr?' ('+_dr.name+')':''}${t.depNote?' — '+t.depNote:''}`; } if(t.depType==='milestone'){ const _dm=MILESTONES.find(m=>m.id===t.depMsId); return _dm?`⛓ Waiting for milestone: ${_dm.name}`:'⛓'; } return '⛓'; })();
      const markers=(isDlCol?'<div class="dl-marker"></div>':'')+(isDepCol?`<div class="dep-marker" data-tip="⛓"><div class="dep-tip">${_depMarkerTip}</div></div>`:'');
      const taskMsArr=MILESTONES.filter(m=>(m.taskIds||[]).includes(t.id)&&m.dayIdx===day&&(!S._activeProjId||(m.projId?m.projId===S._activeProjId:(m.taskIds||[]).some(id=>TASKS.find(t2=>t2.id===id&&t2.projId===S._activeProjId)))));
      const _msc=taskMsArr.length>0?(taskMsArr[0].color||'var(--acc2)'):'';
            // Line via background-image (hover uses background-color so this survives)
      // Milestone: injected inside bar div (position:relative), works in all browsers
      // Multi-colour support for task row overlay
      const _msColors=taskMsArr.map(m=>m.color||'var(--acc2)');
      const _msMultiBg=_msColors.length>1
        ? `conic-gradient(${_msColors.map((col,i)=>`${col} ${Math.round(i/_msColors.length*360)}deg ${Math.round((i+1)/_msColors.length*360)}deg`).join(',')})`
        : (_msColors[0]||'');
      const _msAllDiamond=taskMsArr.length>0&&taskMsArr.every(m=>m.shape==='diamond');
      const taskMsOverlay=_msc?(()=>{
        const line=`<div style="position:absolute;top:0;bottom:0;left:calc(50% - 1px);width:2px;background:${_msc};opacity:.8;z-index:3;pointer-events:none"></div>`;
        if(_msAllDiamond){
          return line+`<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(45deg);width:12px;height:12px;background:${_msMultiBg};border:2px solid var(--bg0);z-index:4;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`;
        }
        return line+`<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:${_msMultiBg};border:2px solid var(--bg0);z-index:4;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`;
      })():'';
      // td must have position:relative for inset:0 to work
      // td must have position:relative for inset:0 to work
      const taskMsLine=''; const taskMsDot='';

      // Compute sub visibility OUTSIDE if-block so all branches can use it
      const _isCollapsedHere=(S.viewBy==='project'&&_collapsedTasks.has(t.id)&&hasChildren(t.id))||((S.viewBy==='team'||S.viewBy==='resource')&&hasChildren(t.id)&&!_expandedTeamRes.has(t.id));
      const _activeSubs4Day=_isCollapsedHere?_stArr.filter(s=>{if(isNW(day,null,s.resId||t.resId))return false;if(s._sched)return(s._sched[day]||0)>0.001;const _ss5=s.start||t.start||GANTT_TODAY;const _sc5=getRes(s.resId||t.resId)?.dailyCap||HPD;const _dd5=Math.max(s.dur||1,Math.ceil((s.hours||1)/_sc5));return day>=_ss5&&day<_ss5+_dd5&&_subHoursOnDay(s,t,day)>0.001;}):[];
      const _hasSubsHere=_activeSubs4Day.length>0;

      const _dayActive=_isDayActiveForTask(t,day);
      const _miniSt=_isCollapsedHere?(()=>{
          const _aS=_stArr.filter(s=>{
            if(isNW(day,null,s.resId||t.resId)) return false;
            if(s._sched) return (s._sched[day]||0)>0.001;
            const _ss=s.start||t.start||GANTT_TODAY;
            const _scm=getRes(s.resId||t.resId)?.dailyCap||HPD;const _dd=Math.max(s.dur||1,Math.ceil((s.hours||1)/_scm));
            return day>=_ss&&day<_ss+_dd;
          });
          if(!_aS.length) return '';
          // All children scale together to fit BAR_MAX — same color as parent (barColor)
          const _eFracs=_aS.map(s=>{const _sc=getRes(s.resId||t.resId)?.dailyCap||HPD;const _sd=s.dur||Math.max(1,Math.ceil((s.hours||1)/_sc));return Math.min(1,(s.hours||1)/(_sd*_sc));});
          const _eRaws=_eFracs.map(f=>Math.max(BAR_MIN,Math.round(BAR_MIN+f*(BAR_MAX-BAR_MIN))));
          const _eTotalRaw=_eRaws.reduce((a,h)=>a+h,0);
          const _eScale=_eTotalRaw>BAR_MAX?BAR_MAX/_eTotalRaw:1;
          return _aS.map((s,_si)=>{
            const _sc=getRes(s.resId||t.resId)?.dailyCap||HPD;
            const _sd=s.dur||Math.max(1,Math.ceil((s.hours||1)/_sc));
            const _sf=Math.min(1,(s.hours||1)/(_sd*_sc));
            const _sh=Math.max(2,Math.round(_eRaws[_si]*_eScale));
            const _dl=s.deadline?dateToIdx(s.deadline):(t.deadline?dateToIdx(t.deadline):null);
            const _ov=_dl&&day>_dl;
            return '<div style="height:'+_sh+'px;width:100%;border-radius:3px;margin-top:1px;background:'+(()=>{const _ste=s.teamId||TASKS.find(p=>p.id===s.parentId)?.teamId||t.teamId;return _ste&&getTeam(_ste)?.color||barColor;})()+'88;'+(_ov?'outline:1px solid rgba(220,38,38,.85);':'')+';pointer-events:none"></div>';
          }).join('');
        })():'';
      if(dayHours>0.001 && _dayActive){
        const frac=Math.min(1,dayHours/cap);
        const _bhRaw=Math.max(BAR_MIN,Math.round(BAR_MIN+frac*(BAR_MAX-BAR_MIN)));
        const bh=_bhRaw;
                const isFirst=ci===firstBarCi, isLast=ci===lastBarCi;
        const segLk=isSegLocked(t.id,day);
        const tipText=`${t.name} · ${dayHours%1===0?dayHours:dayHours.toFixed(1)}h today (${th}h total)${t.deadline?' · DL:'+t.deadline:''}`;
        H+=`<td style="padding:1px 0 0;overflow:visible;vertical-align:top;position:relative" class="${tcls}"
          onmouseover="if(_mv)highlightDrop(this)" onmouseout="clearHL(this)">
          ${pdlOverlay}${markers}
          ${taskMsOverlay}
          <div class="${barCls+(segLk?' locked-bar':'')}" style="background:${isDone?'rgba(34,197,94,.3)':t.status==='ready'?'rgba(0,201,160,.3)':locked?barColor+'55':_isSimRes?barColor+'55':barColor};height:${bh}px;width:100%;position:relative;display:flex;align-items:center;cursor:${segLk?'not-allowed':canEdit?'grab':'default'}${_isSimRes?';border:1px dashed '+barColor+';opacity:.7':''}"
            title="${_isSimRes?'⚠ Simulated resource (hypothetical) — '+tipText:tipText}"
            onmousedown="${locked||!canEdit||segLk?'':` bMD(event,'${t.id}',${day},${COL_W})`}"
            onclick="if(!_mv)openEditTask('${t.id}')"
            oncontextmenu="${canEdit?`showCtx(event,'${t.id}')`:``}">
            ${(()=>{ if(!locked) return ''; const dlog=(t.timeLogs||[]).filter(l=>dateToIdx(l.date)===day).reduce((s,l)=>s+l.hours,0); if(dlog<0.001) return ''; const lp=Math.min(100,Math.round(dlog/Math.max(dayHours,0.1)*100)); return `<div style="position:absolute;left:0;top:0;height:100%;width:${lp}%;background:${barColor};border-radius:3px 0 0 3px;z-index:1" title="${dlog.toFixed(1)}h logged"></div>`; })()}
            <div class="gp" style="width:${progW}%;z-index:2;position:relative"></div>
            ${isFirst&&canEdit?`<span class="gr gr-l" onmousedown="rMD(event,'${t.id}','l',${COL_W})"></span>`:''}
            ${isLast&&canEdit?`<span class="gr gr-r" onmousedown="rMD(event,'${t.id}','r',${COL_W})"></span>`:''}
          </div>
          ${_hasSubsHere?(()=>{
            // Scale task bar + all children to fit within BAR_MAX
            const _taskFrac=Math.min(1,dayHours/cap);
            const _taskRaw=Math.max(BAR_MIN,Math.round(BAR_MIN+_taskFrac*(BAR_MAX-BAR_MIN)));
            const _childFracs=_activeSubs4Day.map(s=>{const _scp=getRes(s.resId||t.resId)?.dailyCap||HPD;return Math.min(1,_subHoursOnDay(s,t,day)/_scp);});
            const _childRaws=_childFracs.map(f=>Math.max(BAR_MIN,Math.round(BAR_MIN+f*(BAR_MAX-BAR_MIN))));
            const _totalRaw=_taskRaw+_childRaws.reduce((a,h)=>a+h,0);
            const _scale=_totalRaw>BAR_MAX?BAR_MAX/_totalRaw:1;
            const _scaledTask=Math.max(2,Math.round(_taskRaw*_scale));
            return _activeSubs4Day.map((s,_si)=>{
              const _sh=Math.max(2,Math.round(_childRaws[_si]*_scale));
              const _dlp=s.deadline?dateToIdx(s.deadline):(t.deadline?dateToIdx(t.deadline):null);
              const _ovp=_dlp&&day>_dlp;
              return '<div style="height:'+_sh+'px;width:100%;border-radius:3px;margin-top:1px;background:'+(()=>{const _st=s.teamId||TASKS.find(p=>p.id===s.parentId)?.teamId||t.teamId;return _st&&getTeam(_st)?.color||barColor;})()+'88;'+(_ovp?'outline:1px solid rgba(220,38,38,.85);':'')+';pointer-events:none"></div>';
            }).join('');
          })():''}
        </td>`;
      } else if(day>=firstSchedDay&&day<=lastSchedDay){
        // Outline span (0h grouping task or outside bar range)
        const _isGrouping=(tHours(t)??0)===0;
        H+=`<td class="${_isGrouping?'':'nwc'}${isPdl?' pdl-col':''}" style="position:relative;${_isGrouping?'border-top:2px solid '+barColor+'66;':''}">` + pdlOverlay + markers + _miniSt + `</td>`;
      } else if(!_dayActive && day>=t.start && day<=(t.start+(t.dur||1)-1)){
        // Inactive weekday for daily task — dim cell with subtle indicator
        H+=`<td class="${tcls}" style="position:relative;background:rgba(255,255,255,.02)" title="Inactive weekday">
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:.15"><div style="width:4px;height:4px;border-radius:50%;background:var(--fg3)"></div></div>
        ${markers}</td>`;
      } else {
        const holdStyle=isHold?'hold-stripe':'';
        H+=`<td class="${tcls} ${holdStyle}" style="cursor:${canEdit?'pointer':'default'};position:relative;overflow:visible;vertical-align:top;padding:1px 0 0"
          onmouseover="if(_mv)highlightDrop(this)" onmouseout="clearHL(this)"
          oncontextmenu="${canEdit?`dayCellCtx(event,${day},'${t.id}')`:''}">
          ${pdlOverlay}${markers}${taskMsOverlay}${_miniSt}
        </td>`;
      }
    }
    H+='</tr>';
  });

  H+='</tbody></table></div>';
  document.getElementById('gw').innerHTML=H;
  renderLog();
}

// ── Permission helpers ────────────────────────────────────────
function isPM(){
  if(!S_USER) return false;
  return S_USER.isAdmin || (S_USER.teams||[]).includes('projMgmt');
}
function isTeamLeader(){
  if(!S_USER) return false;
  return TEAMS.some(t=>t.leaderId===S_USER.resId);
}
function getMyTeamResources(){
  if(!S_USER) return [];
  return RESOURCES.filter(r=>(r.teams||[]).some(tid=>
    TEAMS.find(t=>t.id===tid&&t.leaderId===S_USER.resId)
  )).map(r=>r.id);
}

// ── GLOBAL day header click ──────────────────────────────────
// Working day:  normal → disabled → normal
// Non-working:  normal → enabled  → normal
window.dayHdrClick=(e,idx)=>{
  e.preventDefault();e.stopPropagation();
  // Only PM can toggle global days
  if(!isPM()){
    // Team leader / resource: redirect to their own resource day click
    if(S_USER?.resId){
      window.dayResClick(e,idx,S_USER.resId);
    }
    return;
  }
  const key=String(idx);
  const d=gDate(idx);
  const baseNW=isWE(d)||isHol(d);
  if(baseNW){
    if(ENB_DAYS.has(key)){ ENB_DAYS.delete(key); notify(`${sd(idx)} — back to non-working`,'warn'); }
    else { ENB_DAYS.add(key); notify(`${sd(idx)} — enabled globally`,'success'); }
  } else {
    if(DIS_DAYS.has(key)){ DIS_DAYS.delete(key); notify(`${sd(idx)} — back to working`,'success'); }
    else {
      DIS_DAYS.add(key); notify(`${sd(idx)} — disabled globally`,'warn');
      adjustTasksForDay(idx, null);
    }
  }
  persistState(); renderGantt();
};
window.dayHdrCtx=(e,idx)=>{ window.dayHdrClick(e,idx); };

// ── RESOURCE day click (group header row) ────────────────────
window.dayResClick=(e,idx,resId)=>{
  e.preventDefault();e.stopPropagation();
  // Permission: PM=any resource, Team Leader=own team, Resource=self only
  if(!isPM()){
    const allowed=isTeamLeader()?new Set([S_USER.resId,...getMyTeamResources()]):new Set([S_USER?.resId]);
    if(!allowed.has(resId)){notify('No permission to change days for this resource','warn');return;}
  }
  const key=String(idx);
  if(!RES_DAYS.has(resId)) RES_DAYS.set(resId,{enabled:new Set(),disabled:new Set()});
  const rd=RES_DAYS.get(resId);
  const baseNW=isNW(idx);
  const resEnabled=rd.enabled.has(key);
  const resDisabled=rd.disabled.has(key);
  if(baseNW){
    if(resEnabled){ rd.enabled.delete(key); notify(`${sd(idx)} — back to non-working for ${getRes(resId)?.name}`,'warn'); }
    else { rd.enabled.add(key); rd.disabled.delete(key); notify(`${sd(idx)} — enabled for ${getRes(resId)?.name}`,'success'); }
  } else {
    if(resDisabled){ rd.disabled.delete(key); notify(`${sd(idx)} — back to working for ${getRes(resId)?.name}`,'success'); }
    else {
      rd.disabled.add(key); rd.enabled.delete(key); notify(`${sd(idx)} — disabled for ${getRes(resId)?.name}`,'warn');
      adjustTasksForDay(idx, resId);
    }
  }
  persistState(); renderGantt();
};

// ── TASK cell click ──────────────────────────────────────────
window.dayCellClick=(e,idx,taskId)=>{
  e.preventDefault();e.stopPropagation();
  const key=String(idx);
  if(!TASK_DAYS.has(taskId)) TASK_DAYS.set(taskId,{enabled:new Set(),disabled:new Set()});
  const td=TASK_DAYS.get(taskId);
  const t=TASKS.find(x=>x.id===taskId);
  const curNW=isNW(idx, null, t?.resId); // state without task override
  const taskEnabled=td.enabled.has(key);
  const taskDisabled=td.disabled.has(key);
  if(curNW){
    if(taskEnabled){ td.enabled.delete(key); notify(`${sd(idx)} — back to non-working for task`,'warn'); }
    else { td.enabled.add(key); td.disabled.delete(key); notify(`${sd(idx)} — enabled for this task`,'success'); }
  } else {
    if(taskDisabled){ td.disabled.delete(key); notify(`${sd(idx)} — back to working for task`,'success'); }
    else {
      td.disabled.add(key); td.enabled.delete(key); notify(`${sd(idx)} — disabled for this task`,'warn');
      const tsk=TASKS.find(x=>x.id===taskId);
      if(tsk){
        if(tsk.start===idx){
          // Task starts on disabled day → push start forward
          const ns=nextWorkDay(idx+1);
          addLog({type:'cascade',task:tsk.name,from:sd(idx),to:sd(ns)});
          tsk.start=ns;
        } else if(idx > tsk.start && idx <= tEnd(tsk)){
          // Day is mid-span → extend end by one working day
          let newEnd=tEnd(tsk)+1;
          while(isNW(newEnd,tsk.id,tsk.resId)&&newEnd<tEnd(tsk)+30) newEnd++;
          tsk.dur=newEnd-tsk.start+1;
          addLog({type:'resize',task:tsk.name,from:'',to:`extended to ${sd(newEnd)}`});
        }
      }
    }
  }
  persistState(); renderGantt();
};
window.dayCellCtx=(e,idx,taskId)=>{ window.dayCellClick(e,idx,taskId); };

window.highlightDrop=el=>{ if(_mv) el.style.background='rgba(79,156,249,.12)'; };
window.clearHL=el=>el.style.background='';

// ============================================================
// HOUR-PACKING SCHEDULING ENGINE
// ============================================================

// Advance to the next working day (skips NW days globally)
function nextWorkDay(from){
  let d = Math.max(1, from||1);
  let safety = 0;
  while(isNW(d) && safety++ < 90) d++;
  return d;
}

// Count working days in a calendar span [start, start+dur)
function workDaysInSpan(start, dur, taskId=null, resId=null){
  let n=0;
  for(let d=start; d<start+dur; d++) if(!isNW(d,taskId,resId)) n++;
  return n;
}

// ── CALENDAR FOUNDATION (allocation engine, built from scratch) ──────────────
// Single source of truth for how many hours a resource CAN work on a given day,
// and WHY it is limited. Returns {hours, blocks:[{type}]}.
//   type ∈ CALENDARIO | TIMEOFF_DIA_INTEIRO | TIMEOFF_PARCIAL
// Hard-rule precedence: calendar > full-day time-off > (daily-task) > partial time-off.
function dayCapacity(resId, day){
  const r=getRes(resId);
  const cap=r?.dailyCap||HPD;
  // Calendar block (weekend / holiday / collective / global-disabled / overrides)
  if(isNW(day, null, resId)){
    // Distinguish a full-day time-off from a pure calendar block, for explainability.
    const _to=_fullDayTimeOffOn(resId, day);
    if(_to) return {hours:0, blocks:[{type:'TIMEOFF_DIA_INTEIRO', note:_to.note||_to.type}]};
    return {hours:0, blocks:[{type:'CALENDARIO'}]};
  }
  // Partial time-offs reduce capacity but don't block the day.
  const partial=_partialTimeOffHoursOn(resId, day);
  if(partial>0){
    return {hours:Math.max(0, cap-partial), blocks:[{type:'TIMEOFF_PARCIAL', hours:partial}]};
  }
  return {hours:cap, blocks:[]};
}

// Returns the full-day time-off entry covering `day` for this resource, or null.
function _fullDayTimeOffOn(resId, day){
  const r=getRes(resId); if(!r) return null;
  return (r.timeOff||[]).find(to=>{
    if(to.allDay===false) return false;
    const s=dateToIdx(to.start), e=dateToIdx(to.end);
    return s&&e&&day>=s&&day<=e;
  })||null;
}

// Sum of partial time-off hours on `day` for this resource.
function _partialTimeOffHoursOn(resId, day){
  const r=getRes(resId); if(!r) return 0;
  let h=0;
  (r.timeOff||[]).forEach(to=>{
    if(to.allDay!==false) return; // only partials
    const s=dateToIdx(to.start), e=dateToIdx(to.end);
    if(s&&e&&day>=s&&day<=e) h+=(to.hours||0);
  });
  return h;
}

// Resolve a hard-rule collision on a given day for a task/resource.
// Returns {allowed, furou?, blockedBy?} per the agreed precedence:
//   calendario > timeoff_dia_inteiro > daily_task_fixa > timeoff_parcial > deps
// Only case that may exceed cap: a FIXED daily task furando a partial time-off.
function resolveHardCollision(task, resId, day){
  const cap=dayCapacity(resId, day);
  const has=(t)=>cap.blocks.some(b=>b.type===t);
  const isFixedDaily = task && task.timeMode==='daily' && task.fixedDates;
  if(has('CALENDARIO'))           return {allowed:false, blockedBy:'CALENDARIO'};
  if(has('TIMEOFF_DIA_INTEIRO'))  return {allowed:false, blockedBy:'TIMEOFF_DIA_INTEIRO'};
  if(isFixedDaily && has('TIMEOFF_PARCIAL'))
                                  return {allowed:true, furou:'TIMEOFF_PARCIAL'};
  return {allowed:true};
}

// Real free hours for a resource on a day = capacity − already-scheduled load.
function freeRealHours(resId, day, excludeId=null){
  const capH=dayCapacity(resId, day).hours;
  return Math.max(0, capH - getDayLoad(resId, day, excludeId));
}

// ═══════════════════════════════════════════════════════════════════════════
// ALLOCATION ENGINE (built from scratch — pure functions, no global mutation)
// ───────────────────────────────────────────────────────────────────────────
// Design goals: deterministic, explainable, non-destructive. Each function is
// pure: it reads state via getRes/dayCapacity and an explicit `occupied` map,
// and returns plain data. Wiring into the UI/display is a separate step.
//
// Occupancy model: callers pass `occ` = { resId: { dayIdx: hours } }. This is
// the "already scheduled" load the planner must work around. For non-destructive
// manual allocation, `occ` excludes the task being placed.
// ═══════════════════════════════════════════════════════════════════════════

const ENGINE_MAX_ITERS = 1000;

// Remaining hours for a task, optionally for one resource.
// Rule: remaining = estimated − logged, with min 1h when ≤ 0.
//   direct:  per-resource estimate (resHours[resId]); logged is aggregated and
//            split proportionally to each resource's estimate (timeLogs lack a
//            reliable per-resource attribution in current data).
//   team:    pool = total hours − total logged; split happens in distributePool.
function engineRemaining(task, resId){
  const loggedTotal=(task.timeLogs||[]).reduce((s,l)=>s+(l.hours||0),0);
  if(task.assignType==='team'){
    const pool=(task.hours||0)-loggedTotal;
    return Math.max(pool, 1);
  }
  // direct
  const rh=task.resHours||{};
  const hasThisRes = resId!=null && rh[resId]!=null && rh[resId]>0;
  // Estimate for this resource: its resHours entry, else fall back to task total
  // (legacy tasks may store hours only in t.hours without a resHours map).
  const est = hasThisRes ? rh[resId] : (task.hours||0);
  const totalEst = Object.keys(rh).length ? Object.values(rh).reduce((s,h)=>s+(h||0),0) : (task.hours||0);
  const share = (totalEst>0 && hasThisRes) ? (est/totalEst) : 1;
  const rem = est - (loggedTotal*share);
  return Math.max(rem, 1);
}

// Resolve the resources a task is assigned to.
// direct → its resource ids (primary + co). team → team members on the project.
// Precedence: direct resources win over team.
function engineResolveResources(task){
  if(task.assignType!=='team'){
    const ids=[task.resId,...(task.coResIds||[])].filter(Boolean);
    return [...new Set(ids)];
  }
  // team pool (Opção B): members of task's team that are allocated to the project
  // teamId = task.teamId (existing field; teamRef was removed as redundant)
  const teamId=task.teamId||task.teamRef;
  if(!teamId) return [];
  const proj=PROJECTS.find(p=>p.id===task.projId);
  const projResources=proj?.resources||[];
  // Filter: must belong to the team AND be in project.resources (if defined)
  // If project.resources is empty, fall back to all team members
  return RESOURCES
    .filter(r=>(r.teams||[]).includes(teamId))
    .filter(r=>projResources.length===0||projResources.includes(r.id))
    .map(r=>r.id);
}

// Advance `hours` of work from a start day across the calendar for ONE resource,
// skipping blocked days, never exceeding real free capacity. Pure.
// `occ` is { dayIdx: hours } for this resource. Returns {segs:[{day,hours,why}], endDay}.
function enginePlaceResource(task, resId, startDay, occ){
  let faltam=engineRemaining(task, resId);
  let day=startDay, iters=0;
  const segs=[];
  const used=Object.assign({}, occ||{});
  while(faltam>0.001 && iters++<ENGINE_MAX_ITERS){
    const coll=resolveHardCollision(task, resId, day);
    if(!coll.allowed){ day++; continue; }
    const capH=dayCapacity(resId, day).hours;
    // Fixed daily task furando partial time-off may exceed cap by design.
    const effectiveCap = coll.furou==='TIMEOFF_PARCIAL' ? (getRes(resId)?.dailyCap||HPD) : capH;
    const free=Math.max(0, effectiveCap-(used[day]||0));
    if(free<=0.001){ day++; continue; }
    const put=Math.min(faltam, free);
    segs.push({day, hours:put, why:{
      limitadoPor: day===startDay ? 'DEPENDENCIA' : 'CAPACIDADE',
      furou: coll.furou||null
    }});
    used[day]=(used[day]||0)+put;
    faltam-=put;
    day++;
  }
  return {segs, endDay: segs.length?segs[segs.length-1].day:startDay};
}

// Simultaneous ON: all resources start the same day, advance in LOCKSTEP.
// Joint pause: on any day where an active resource has no capacity, NOBODY
// consumes that day (the others wait). A resource that finishes its hours drops
// out (divergent finish allowed). Pure. `occ` = { resId: {day:hours} }.
function enginePlaceSimultaneous(task, resIds, startDay, occByRes){
  // 1. find first day all resources have capacity
  let day=startDay, iters=0;
  const hasCap=(r,d)=>{
    const coll=resolveHardCollision(task, r, d);
    if(!coll.allowed) return false;
    const cap=dayCapacity(r,d).hours;
    const u=(occByRes[r]||{})[d]||0;
    return (cap-u)>0.001;
  };
  while(iters++<ENGINE_MAX_ITERS && !resIds.every(r=>hasCap(r,day))) day++;
  const arranque=day;

  const faltam={}; resIds.forEach(r=>faltam[r]=engineRemaining(task,r));
  const used={};   resIds.forEach(r=>used[r]=Object.assign({},occByRes[r]||{}));
  const segsByRes={}; resIds.forEach(r=>segsByRes[r]=[]);

  iters=0;
  while(resIds.some(r=>faltam[r]>0.001) && iters++<ENGINE_MAX_ITERS){
    const ativos=resIds.filter(r=>faltam[r]>0.001);
    // joint pause: if any active resource lacks capacity today, nobody works
    const quemFalta=ativos.filter(r=>!hasCap2(r,day,used,task));
    if(quemFalta.length){
      // record pause for explainability on active resources that COULD work
      ativos.forEach(r=>{
        if(hasCap2(r,day,used,task)){
          segsByRes[r].push({day, hours:0, why:{limitadoPor:'SIMULTANEO_PAUSA', despoletadoPor:quemFalta[0]}});
        }
      });
      day++; continue;
    }
    ativos.forEach(r=>{
      const cap=dayCapacity(r,day).hours;
      const free=Math.max(0, cap-(used[r][day]||0));
      const put=Math.min(faltam[r], free);
      segsByRes[r].push({day, hours:put, why:{limitadoPor: day===arranque?'SIMULTANEO':'CAPACIDADE'}});
      used[r][day]=(used[r][day]||0)+put;
      faltam[r]-=put;
    });
    day++;
  }
  return {arranque, segsByRes};
}
function hasCap2(r,d,used,task){
  const coll=resolveHardCollision(task, r, d);
  if(!coll.allowed) return false;
  const cap=dayCapacity(r,d).hours;
  return (cap-((used[r]||{})[d]||0))>0.001;
}

// Pool division (team, shared effort): split `total` hours across resources
// balanced by free capacity, achieving the minimum joint finish day D*.
// Returns { resId: hours }. perHead → each resource gets the full total.
// Pure. `occByRes` = { resId: {day:hours} }.
function engineDistributePool(task, total, resIds, startDay, occByRes){
  if(task.effort==='perHead'){
    const m={}; resIds.forEach(r=>m[r]=total); return m;
  }
  if(!resIds.length) return {};
  // Phase 1: accumulate combined free capacity day by day until it covers total → D*
  let day=startDay, acc=0, iters=0;
  const capDay={}; resIds.forEach(r=>capDay[r]={});
  while(acc<total-0.001 && iters++<ENGINE_MAX_ITERS){
    resIds.forEach(r=>{
      const coll=resolveHardCollision(task, r, day);
      const cap=coll.allowed?dayCapacity(r,day).hours:0;
      const free=Math.max(0, cap-((occByRes[r]||{})[day]||0));
      capDay[r][day]=free; acc+=free;
    });
    day++;
  }
  const Dstar=day-1;
  // Phase 2: each resource's free capacity within [startDay, D*]
  const capJanela={}; let sumCap=0;
  resIds.forEach(r=>{
    let s=0; for(let d=startDay; d<=Dstar; d++) s+=(capDay[r][d]||0);
    capJanela[r]=s; sumCap+=s;
  });
  if(sumCap<=0.001){ const m={}; resIds.forEach(r=>m[r]=0); return m; }
  // Phase 3: proportional split, deterministic rounding (0.25h) with remainder by id
  const raw={}; resIds.forEach(r=>raw[r]=total*capJanela[r]/sumCap);
  const round=h=>Math.round(h*4)/4;
  const out={}; let assigned=0;
  resIds.forEach(r=>{ out[r]=round(raw[r]); assigned+=out[r]; });
  // fix rounding drift on the lowest-id resource (determinism)
  const drift=Math.round((total-assigned)*4)/4;
  if(Math.abs(drift)>0.001){
    const first=[...resIds].sort()[0];
    out[first]=Math.max(0, round(out[first]+drift));
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// AUTOMATIC MODE — Schedule Simulation (explicit, isolated; produces a preview)
// ───────────────────────────────────────────────────────────────────────────

// Convert hours → number of working days at a nominal cap.
function _engineWorkDays(hours, cap){ return Math.max(1, Math.ceil(hours/(cap||HPD))); }

// Advance a calendar end-day for `hours` from `start`, skipping global non-work
// days (weekends/holidays). Used by CPM (resource-agnostic). Pure.
function _engineAdvance(start, hours, cap){
  let faltam=hours, day=start, iters=0;
  cap=cap||HPD;
  while(faltam>0.001 && iters++<ENGINE_MAX_ITERS){
    if(!isNW(day,null,null)) faltam-=cap;
    if(faltam>0.001) day++;
  }
  return day;
}

// Earliest viable start for a task from HARD constraints:
// dependencies (task→task), "not before" date, fixed daily-task start.
function engineMinStart(task){
  let minStart=nextWorkDay(GANTT_TODAY);
  if(task.depType==='task'){
    const dids=[...new Set([...(task.depIds||[]),task.depId].filter(Boolean))];
    dids.forEach(did=>{ const dep=TASKS.find(x=>x.id===did); if(dep&&dep.start) minStart=Math.max(minStart, nextWorkDay(tEnd(dep)+1)); });
  }
  if(task.depType==='resource'&&task.depUntil){ const mi=dateToIdx(task.depUntil); if(mi) minStart=Math.max(minStart, nextWorkDay(mi+1)); }
  if(task.depType==='milestone'&&task.depMsId){ const ms=MILESTONES.find(m=>m.id===task.depMsId); if(ms&&ms.dayIdx) minStart=Math.max(minStart, nextWorkDay(ms.dayIdx+1)); }
  if(task.fixedDates&&task.fixedDates.start){ const fi=dateToIdx(task.fixedDates.start); if(fi) minStart=Math.max(minStart, fi); }
  return minStart;
}

// First day >= from where resId has real free capacity considering occByRes.
// Used by scheduleSimulation to chain tasks correctly instead of always using GANTT_TODAY.
function engineFirstFreeDay(resId, from, occByRes){
  let day=from, iters=0;
  while(iters++<ENGINE_MAX_ITERS){
    const cap=dayCapacity(resId, day).hours;
    const used=(occByRes[resId]||{})[day]||0;
    if(cap-used>0.001) return day;
    day++;
  }
  return from;
}

// CPM float (resource-agnostic) used ONLY as a tiebreak signal. Forward/backward
// passes over the task→task dependency DAG, calendar-aware. Returns {id: floatDays}.
// Project-end on the backward pass = min(max(EF), projectDeadline) per decision.
function calcFloatCPM(tasks){
  const byId={}; tasks.forEach(t=>byId[t.id]=t);
  const succ={}; tasks.forEach(t=>succ[t.id]=[]);
  const preds=(t)=> t.depType==='task' ? [...new Set([...(t.depIds||[]),t.depId].filter(Boolean))].filter(id=>byId[id]) : [];
  tasks.forEach(t=>preds(t).forEach(p=>{ if(succ[p]) succ[p].push(t.id); }));
  // topological order (Kahn); on cycle, fall back to input order
  const indeg={}; tasks.forEach(t=>indeg[t.id]=preds(t).length);
  const q=tasks.filter(t=>indeg[t.id]===0).map(t=>t.id); const order=[];
  while(q.length){ const id=q.shift(); order.push(id); (succ[id]||[]).forEach(s=>{ if(--indeg[s]===0) q.push(s); }); }
  if(order.length<tasks.length) tasks.forEach(t=>{ if(!order.includes(t.id)) order.push(t.id); });

  const capOf=(t)=>{ const ids=engineResolveResources(t); const caps=ids.map(r=>getRes(r)?.dailyCap||HPD); return caps.length?Math.max(...caps):HPD; };
  const dur=(t)=> t.status==='done' ? 0 : engineRemaining(t, engineResolveResources(t)[0]);
  const ES={}, EF={};
  order.forEach(id=>{ const t=byId[id];
    let es=nextWorkDay(GANTT_TODAY);
    preds(t).forEach(p=>{ if(EF[p]) es=Math.max(es, nextWorkDay(EF[p]+1)); });
    const ms=engineMinStart(t); es=Math.max(es, ms);
    if(t.status==='doing'||t.status==='paused') es=t.start||es;
    ES[id]=es; EF[id]=_engineAdvance(es, dur(t), capOf(t));
  });
  const maxEF=Math.max(...Object.values(EF), nextWorkDay(GANTT_TODAY));
  const LF={}, LS={};
  [...order].reverse().forEach(id=>{ const t=byId[id];
    let lf;
    if(!(succ[id]||[]).length) lf=maxEF;
    else lf=Math.min(...succ[id].map(s=>LS[s]!=null?LS[s]:maxEF));
    // task deadline tightens LF
    const dl=getEffectiveDeadline(t); if(dl){ const di=dateToIdx(dl); if(di) lf=Math.min(lf,di); }
    // project deadline tightens too (min(maxEF, projDeadline) effect)
    const proj=PROJECTS.find(p=>p.id===t.projId); if(proj&&proj.deadline){ const pi=dateToIdx(proj.deadline); if(pi) lf=Math.min(lf,pi); }
    LF[id]=lf; LS[id]=_engineRecede(lf, dur(t), capOf(t));
  });
  const float={}; tasks.forEach(t=>{ float[t.id]=(LS[t.id]??ES[t.id])-(ES[t.id]??0); });
  return float;
}
function _engineRecede(end, hours, cap){
  let faltam=hours, day=end, iters=0; cap=cap||HPD;
  while(faltam>0.001 && iters++<ENGINE_MAX_ITERS){ if(!isNW(day,null,null)) faltam-=cap; if(faltam>0.001) day--; }
  return day;
}

// Priority comparator (cascade): manual hints → task priority → project priority
// → task deadline → project deadline → weighted tiebreak (float/EDD/successors)
// → id (deterministic). Returns negative if a before b.
function comparePriority(a, b, float, succCount){
  // manual hints: a should come before b
  if((a.priorityHints||[]).includes(b.id)) return -1;
  if((b.priorityHints||[]).includes(a.id)) return 1;
  const pt=(t)=>t.priorityTask==null?Infinity:t.priorityTask;
  if(pt(a)!==pt(b)) return pt(a)-pt(b);
  const projPrio=(t)=>{ const p=PROJECTS.find(x=>x.id===t.projId); return p&&p.priorityProject!=null?p.priorityProject:Infinity; };
  if(projPrio(a)!==projPrio(b)) return projPrio(a)-projPrio(b);
  const dlt=(t)=>{ const d=t.deadline?dateToIdx(t.deadline):null; return d||Infinity; };
  if(dlt(a)!==dlt(b)) return dlt(a)-dlt(b);
  const dlp=(t)=>{ const p=PROJECTS.find(x=>x.id===t.projId); const d=p&&p.deadline?dateToIdx(p.deadline):null; return d||Infinity; };
  if(dlp(a)!==dlp(b)) return dlp(a)-dlp(b);
  // weighted tiebreak: lower float, earlier deadline, more successors = higher prio
  const w1=1, w2=0.5, w3=2;
  const cost=(t)=>w1*(float[t.id]??999) + w2*(dlt(t)===Infinity?999:dlt(t)) - w3*(succCount[t.id]||0);
  const ca=cost(a), cb=cost(b);
  if(Math.abs(ca-cb)>0.001) return ca-cb;
  return String(a.id)<String(b.id)?-1:1; // deterministic
}

// Run a full optimized schedule simulation from scratch (calendar only).
// Does NOT mutate TASKS — returns a preview { taskId: {start, sched} } + conflicts.
function scheduleSimulation(){
  const eligible=TASKS.filter(t=>{
    if(t.status==='done'||t.status==='cancelled') return false;
    const ids=engineResolveResources(t);
    if(!ids.length) return false;                       // needs a resource
    if((t.hours||0)<=0 && t.timeMode!=='daily') return false; // needs time
    if(t.parentId) return false;                        // children handled via parents (kept simple)
    return true;
  });
  const float=calcFloatCPM(eligible);
  // successor counts for tiebreak
  const succCount={}; eligible.forEach(t=>succCount[t.id]=0);
  eligible.forEach(t=>{ if(t.depType==='task'){ [...new Set([...(t.depIds||[]),t.depId].filter(Boolean))].forEach(did=>{ if(succCount[did]!=null) succCount[did]++; }); } });

  // anchors: in-progress tasks keep their current placement
  const occByRes={};
  const preview={};
  const _seedOcc=(resId,sched)=>{ if(!occByRes[resId]) occByRes[resId]={}; Object.entries(sched||{}).forEach(([d,h])=>{ occByRes[resId][d]=(occByRes[resId][d]||0)+h; }); };

  const anchored=eligible.filter(t=>t.status==='doing'||t.status==='paused');
  anchored.forEach(t=>{
    const ids=engineResolveResources(t);
    const start=t.start||engineMinStart(t);
    if(t.simultaneous && ids.length>1){
      const r=enginePlaceSimultaneous(t, ids, nextWorkDay(start), occByRes);
      const schedByRes={}; ids.forEach(id=>{ const m={}; r.segsByRes[id].forEach(s=>{ if(s.hours>0) m[s.day]=(m[s.day]||0)+s.hours; }); schedByRes[id]=m; _seedOcc(id,m); });
      preview[t.id]={start:r.arranque, schedByRes};
    } else {
      const id=ids[0]; const r=enginePlaceResource(t, id, nextWorkDay(start), occByRes[id]||{});
      const m={}; r.segs.forEach(s=>m[s.day]=(m[s.day]||0)+s.hours); _seedOcc(id,m);
      preview[t.id]={start:r.segs[0]?.day||start, schedByRes:{[id]:m}};
    }
  });

  // order the rest by priority and place
  const todo=eligible.filter(t=>!(t.status==='doing'||t.status==='paused'));
  todo.sort((a,b)=>comparePriority(a,b,float,succCount));

  const conflicts=[];
  todo.forEach(t=>{
    const ids=engineResolveResources(t);
    const minStart=engineMinStart(t);
    const usesSimulated=ids.some(r=>getRes(r)?.simulated);
    if(t.assignType==='team' && t.effort!=='perHead' && ids.length>1){
      const pool=engineRemaining(t,null);
      // Use first free day considering accumulated occupancy
      const poolStart=ids.reduce((best,id)=>Math.min(best, engineFirstFreeDay(id, minStart, occByRes)), Infinity);
      const startDay=poolStart===Infinity?minStart:poolStart;
      const split=engineDistributePool(t, pool, ids, startDay, occByRes);
      const schedByRes={};
      ids.forEach(id=>{
        const share=split[id]||0; if(share<=0){ schedByRes[id]={}; return; }
        const fake={...t, assignType:'direct', resHours:{[id]:share}, hours:share, timeLogs:[]};
        const ffd=engineFirstFreeDay(id, minStart, occByRes);
        const r=enginePlaceResource(fake, id, ffd, occByRes[id]||{});
        const m={}; r.segs.forEach(s=>m[s.day]=(m[s.day]||0)+s.hours); _seedOcc(id,m); schedByRes[id]=m;
      });
      const allDays=Object.values(schedByRes).flatMap(m=>Object.keys(m).map(Number));
      preview[t.id]={start:allDays.length?Math.min(...allDays):minStart, schedByRes};
    } else if(t.simultaneous && ids.length>1){
      // For simultaneous: find first day ALL resources are free
      const simStart=ids.reduce((best,id)=>Math.max(best, engineFirstFreeDay(id, minStart, occByRes)), minStart);
      const r=enginePlaceSimultaneous(t, ids, simStart, occByRes);
      const schedByRes={}; ids.forEach(id=>{ const m={}; r.segsByRes[id].forEach(s=>{ if(s.hours>0) m[s.day]=(m[s.day]||0)+s.hours; }); schedByRes[id]=m; _seedOcc(id,m); });
      preview[t.id]={start:r.arranque, schedByRes};
    } else {
      const id=ids[0];
      // Find first free day for this resource considering accumulated occupancy
      const ffd=engineFirstFreeDay(id, minStart, occByRes);
      const r=enginePlaceResource(t, id, ffd, occByRes[id]||{});
      const m={}; r.segs.forEach(s=>m[s.day]=(m[s.day]||0)+s.hours); _seedOcc(id,m);
      preview[t.id]={start:r.segs[0]?.day||ffd, schedByRes:{[id]:m}};
    }
    if(usesSimulated) conflicts.push({type:'DEPENDE_DE_RECURSO_SIMULADO', taskId:t.id, detail:`"${t.name}" usa recurso(s) simulado(s) — requer contratação`});
  });

  return {preview, conflicts, count:Object.keys(preview).length};
}

// Apply a simulation preview to the live tasks. Admin-only. Mutates TASKS.
function applySimulation(sim){
  if(!sim||!sim.preview) return;
  Object.entries(sim.preview).forEach(([taskId,p])=>{
    const t=TASKS.find(x=>x.id===taskId); if(!t) return;
    t.start=p.start||t.start;
    // Write per-resource schedule; primary _sched + co _schedCo
    const ids=Object.keys(p.schedByRes||{});
    const primary=t.resId&&p.schedByRes[t.resId]?t.resId:ids[0];
    if(primary){ t._sched=p.schedByRes[primary]||{}; }
    t._schedCo=t._schedCo||{};
    ids.forEach(id=>{ if(id!==primary) t._schedCo[id]=p.schedByRes[id]; });
    // recompute dur from sched span
    const days=Object.keys(t._sched||{}).map(Number);
    if(days.length){ t.dur=Math.max(1, Math.max(...days)-Math.min(...days)+1); }
  });
}

// ── UI: schedule simulation preview/apply (admin only) ──
let _simPreview=null;
window.openScheduleSimulation=()=>{
  if(!isAdmin()){ notify('Only admins can run simulations','warn'); return; }
  notify('Running simulation…','info');
  setTimeout(()=>{
    try{ _simPreview=scheduleSimulation(); }
    catch(e){ console.error(e); notify('Simulation failed: '+e.message,'warn'); return; }
    _renderSimPreview(_simPreview);
    OM('m-sim');
  }, 30);
};
function _renderSimPreview(sim){
  document.getElementById('sim-summary').textContent=`${sim.count} task(s) would be scheduled. This is a preview — nothing changes until you apply.`;
  const cEl=document.getElementById('sim-conflicts');
  if(sim.conflicts.length){
    cEl.innerHTML=`<div style="font-size:10px;font-weight:600;color:var(--warn);margin-bottom:4px">${sim.conflicts.length} conflict(s):</div>`+
      sim.conflicts.map(c=>`<div style="font-size:10px;color:var(--warn);padding:2px 0">⚠ ${c.detail}</div>`).join('');
  } else cEl.innerHTML='';
  const list=document.getElementById('sim-list');
  const rows=Object.entries(sim.preview).map(([tid,p])=>{
    const t=TASKS.find(x=>x.id===tid); if(!t) return '';
    // Use _computedStart (where the bar actually is) as the "before" reference.
    // t.start is the user-set anchor and may not reflect the rendered position.
    const _currentStart = t._computedStart || t.start;
    const _old=_currentStart?sd(_currentStart):'unscheduled';
    const _new=p.start?sd(p.start):'—';
    const moved=_currentStart!==p.start;
    const delayed = moved && _currentStart && p.start && p.start > _currentStart;
    const advanced = moved && _currentStart && p.start && p.start < _currentStart;
    const unscheduled = !_currentStart && p.start;
    const arrow = !moved ? '' : delayed ? '→' : '←';
    const col = !moved ? 'var(--fg3)' : delayed ? 'var(--danger)' : 'var(--acc)';
    // Count working days between current and proposed start (sign reflects direction)
    let _wdDiff='';
    if(moved && _currentStart && p.start){
      const _from=Math.min(_currentStart,p.start), _to=Math.max(_currentStart,p.start);
      let _wd=0;
      for(let _d=_from;_d<_to;_d++){ if(!isNW(_d,null,null)) _wd++; }
      if(_wd>0) _wdDiff=` (${delayed?'+':'-'}${_wd}d)`;
    }
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 10px;border-bottom:1px solid var(--bd2);font-size:11px">
      <div style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</div>
      <div style="font-size:10px;color:var(--fg3)">${_old}</div>
      ${moved||unscheduled?`<div style="font-size:10px;color:${col};font-weight:600">${arrow} ${_new}<span style="font-weight:400;opacity:.75">${_wdDiff}</span></div>`:`<div style="font-size:10px;color:var(--fg3)">${_new}</div>`}
    </div>`;
  }).join('');
  list.innerHTML=rows||'<div style="padding:8px;font-size:11px;color:var(--fg3)">No tasks to schedule.</div>';
}
window.confirmApplySimulation=()=>{
  if(!isAdmin()){ notify('Only admins can apply simulations','warn'); return; }
  if(!_simPreview){ notify('No simulation to apply','warn'); return; }
  if(!confirm(`Apply this schedule? It replaces the current allocation of ${_simPreview.count} task(s).`)) return;
  applySimulation(_simPreview);
  addLog({type:'task',task:'Schedule simulation',from:'',to:`applied to ${_simPreview.count} task(s)`});
  persistState(['tasks']);
  CM('m-sim');
  renderGantt();
  notify('Simulation applied','success');
};
window.clearAllPriorityHints=()=>{
  if(!isAdmin()){ notify('Only admins','warn'); return; }
  if(!confirm('Clear all manual priority hints from every task?')) return;
  let n=0;
  TASKS.forEach(t=>{ if((t.priorityHints||[]).length){ t.priorityHints=[]; n++; } });
  persistState(['tasks']);
  notify(`Cleared hints from ${n} task(s)`,'success');
};

// ============================================================
// WARNINGS — derived from the CURRENT allocation (not the simulation).
// Recomputed on demand; never persisted (single source of truth = the tasks).
// Detects the rule violations defined in the spec.
// ============================================================
const WARN_META={
  CAP_EXCEEDED:   {icon:'▲', label:'Daily cap exceeded',        col:'var(--danger)'},
  CAP_UNDERFILLED:{icon:'○', label:'Daily capacity not filled', col:'var(--warn)'},
  PRIORITY:       {icon:'≡', label:'Priority not respected',     col:'var(--warn)'},
  DEPENDENCY:     {icon:'⇄', label:'Dependency violated',        col:'var(--danger)'},
  SIMULTANEOUS:   {icon:'⛓', label:'Simultaneous broken',        col:'var(--danger)'},
  SIMULATED_RES:  {icon:'👻',label:'Depends on simulated resource',col:'var(--acc2)'}
};

// Build {resId: {day: hours}} occupation map from the current _sched of every task.
function _currentOccByRes(){
  const occ={};
  TASKS.forEach(t=>{
    if(t.status==='done'||t.status==='cancelled') return;
    const add=(resId,sched)=>{
      if(!resId||!sched) return;
      if(!occ[resId]) occ[resId]={};
      Object.entries(sched).forEach(([d,h])=>{ occ[resId][+d]=(occ[resId][+d]||0)+(h||0); });
    };
    add(t.resId, t._sched);
    if(t._schedCo) Object.entries(t._schedCo).forEach(([rid,sc])=>add(rid,sc));
  });
  return occ;
}

function computeWarnings(){
  const warns=[];
  const occ=_currentOccByRes();

  // 1 & 2 — Daily cap exceeded / underfilled, per resource per day
  Object.entries(occ).forEach(([resId,days])=>{
    const res=getRes(resId); if(!res) return;
    Object.entries(days).forEach(([d,h])=>{
      const day=+d;
      const cap=dayCapacity(resId,day).hours;
      if(cap<=0) return; // blocked day (weekend/holiday/full-day timeoff) — nothing expected
      if(h>cap+0.01){
        warns.push({type:'CAP_EXCEEDED', resId, day, detail:`${res.name}: ${_fmtH(h)} allocated on ${sd(day)} (capacity ${_fmtH(cap)})`});
      } else if(h>0.01 && h<cap-0.01){
        warns.push({type:'CAP_UNDERFILLED', resId, day, detail:`${res.name}: only ${_fmtH(h)} of ${_fmtH(cap)} filled on ${sd(day)}`});
      }
    });
  });

  // 3 — Dependency violated: task starts before its dependency-driven earliest start
  TASKS.forEach(t=>{
    if(t.status==='done'||t.status==='cancelled') return;
    const start=t._computedStart||t.start; if(!start) return;
    const minS=getEffectiveMinStart(t);
    if(minS&&start<minS){
      warns.push({type:'DEPENDENCY', taskId:t.id, detail:`"${t.name}" starts ${sd(start)} — before its dependency allows (${sd(minS)})`});
    }
  });

  // 4 — Priority not respected: a lower-priority task starts before a higher-priority sibling
  //     that shares a resource. Cascade: task priority → project priority → task deadline → project deadline.
  const _rank=(t)=>{
    const pt=t.priorityTask==null?1e9:t.priorityTask;
    const p=PROJECTS.find(x=>x.id===t.projId);
    const pp=(p&&p.priorityProject!=null)?p.priorityProject:1e9;
    const td=getEffectiveDeadline(t); const tdv=td?dateToIdx(td):1e9;
    return {pt,pp,tdv};
  };
  const _cmp=(a,b)=>{ const ra=_rank(a),rb=_rank(b); if(ra.pt!==rb.pt)return ra.pt-rb.pt; if(ra.pp!==rb.pp)return ra.pp-rb.pp; return ra.tdv-rb.tdv; };
  // group active scheduled tasks by primary resource
  const byRes={};
  TASKS.forEach(t=>{
    if(t.status==='done'||t.status==='cancelled') return;
    const start=t._computedStart||t.start; if(!start||!t.resId) return;
    (byRes[t.resId]=byRes[t.resId]||[]).push(t);
  });
  Object.values(byRes).forEach(list=>{
    for(let i=0;i<list.length;i++) for(let j=0;j<list.length;j++){
      if(i===j) continue;
      const a=list[i], b=list[j];
      const sa=a._computedStart||a.start, sb=b._computedStart||b.start;
      // a is higher priority than b, but a starts later than b → violation
      if(_cmp(a,b)<0 && sa>sb){
        // avoid duplicate (report once per ordered pair)
        if(!warns.some(w=>w.type==='PRIORITY'&&w.taskId===a.id&&w.otherId===b.id)){
          warns.push({type:'PRIORITY', taskId:a.id, otherId:b.id, detail:`"${a.name}" (higher priority) starts ${sd(sa)}, after "${b.name}" (${sd(sb)})`});
        }
      }
    }
  });

  // 5 — Simultaneous broken: co-resources of a simultaneous task don't share the same start day
  TASKS.forEach(t=>{
    if(t.status==='done'||t.status==='cancelled') return;
    if(!t.simultaneous) return;
    const starts=[];
    if(t.resId&&t._sched){ const ds=Object.keys(t._sched).map(Number); if(ds.length) starts.push(Math.min(...ds)); }
    if(t._schedCo) Object.values(t._schedCo).forEach(sc=>{ const ds=Object.keys(sc||{}).map(Number); if(ds.length) starts.push(Math.min(...ds)); });
    if(starts.length>1){
      const mn=Math.min(...starts), mx=Math.max(...starts);
      if(mn!==mx) warns.push({type:'SIMULTANEOUS', taskId:t.id, detail:`"${t.name}" is simultaneous but resources start on different days (${sd(mn)}–${sd(mx)})`});
    }
  });

  // 6 — Depends on simulated resource
  TASKS.forEach(t=>{
    if(t.status==='done'||t.status==='cancelled') return;
    const ids=new Set([t.resId,...(t.coResIds||[])].filter(Boolean));
    const sim=[...ids].filter(id=>getRes(id)?.simulated);
    if(sim.length){
      const names=sim.map(id=>getRes(id)?.name||id).join(', ');
      warns.push({type:'SIMULATED_RES', taskId:t.id, detail:`"${t.name}" uses simulated resource(s): ${names} — requires hiring`});
    }
  });

  return warns;
}

function _fmtH(h){ return (Math.round(h*100)/100)+'h'; }

function _refreshWarnBadge(){
  try{
    const n=computeWarnings().length;
    const badge=document.getElementById('warn-count');
    if(badge){ badge.textContent=n; badge.style.display=n?'':'none'; }
  }catch(e){ /* render not ready */ }
}

window.openWarningsPanel=()=>{
  if(!isAdmin()){ notify('Only admins can view warnings','warn'); return; }
  renderWarningsPanel();
  OM('m-warnings');
};

window.renderWarningsPanel=()=>{
  const warns=computeWarnings();
  const sum=document.getElementById('warn-summary');
  const list=document.getElementById('warn-list');
  if(!warns.length){
    sum.innerHTML='<span style="color:var(--ok)">✓ No allocation warnings — everything looks consistent.</span>';
    list.innerHTML='';
    _refreshWarnBadge();
    return;
  }
  // group by type
  const byType={};
  warns.forEach(w=>{ (byType[w.type]=byType[w.type]||[]).push(w); });
  sum.textContent=`${warns.length} warning(s) in the current allocation.`;
  list.innerHTML=Object.entries(byType).map(([type,items])=>{
    const m=WARN_META[type]||{icon:'•',label:type,col:'var(--fg2)'};
    const rows=items.map(w=>{
      const canRealloc=(type==='DEPENDENCY'||type==='PRIORITY'||type==='CAP_EXCEEDED')&&w.taskId;
      const btn=canRealloc?`<button class="btn btn-xs" style="margin-left:8px" onclick="reallocateTask('${w.taskId}')">Reallocate…</button>`:'';
      return `<div style="display:flex;align-items:flex-start;gap:8px;padding:5px 12px;border-bottom:1px solid var(--bd2);font-size:11px">
        <span style="flex:1;color:var(--fg1)">${w.detail}</span>${btn}
      </div>`;
    }).join('');
    return `<div style="padding:6px 12px 2px;font-size:10px;font-weight:700;color:${m.col};text-transform:uppercase;letter-spacing:.04em">${m.icon} ${m.label} (${items.length})</div>${rows}`;
  }).join('');
  _refreshWarnBadge();
};

// Reallocate a single task to its correct position, touching only downstream tasks.
// Shows which tasks would move and asks for confirmation before applying.
window.reallocateTask=(taskId)=>{
  if(!isAdmin()){ notify('Only admins','warn'); return; }
  const t=TASKS.find(x=>x.id===taskId);
  if(!t){ notify('Task not found','warn'); return; }
  const ids=engineResolveResources(t);
  if(!ids.length){ notify('Task has no resource to allocate','warn'); return; }
  // Build occupation from everything EXCEPT this task and its downstream dependents
  const downstream=_downstreamTasks(taskId);
  const exclude=new Set([taskId,...downstream]);
  const occ={};
  TASKS.forEach(o=>{
    if(exclude.has(o.id)||o.status==='done'||o.status==='cancelled') return;
    const add=(rid,sc)=>{ if(!rid||!sc)return; if(!occ[rid])occ[rid]={}; Object.entries(sc).forEach(([d,h])=>occ[rid][+d]=(occ[rid][+d]||0)+(h||0)); };
    add(o.resId,o._sched);
    if(o._schedCo) Object.entries(o._schedCo).forEach(([rid,sc])=>add(rid,sc));
  });
  // Compute new placement for this task
  const minS=getEffectiveMinStart(t)||GANTT_TODAY;
  const affected=[t.name,...downstream.map(id=>TASKS.find(x=>x.id===id)?.name||id)];
  const msg=`Reallocate "${t.name}" to its correct position?\n\nThis will re-place the following task(s):\n• ${affected.join('\n• ')}\n\nOther tasks are not touched.`;
  if(!confirm(msg)) return;
  // Re-place this task + downstream in priority order
  const toPlace=[t,...downstream.map(id=>TASKS.find(x=>x.id===id)).filter(Boolean)];
  toPlace.forEach(task=>{
    const rids=engineResolveResources(task);
    if(!rids.length) return;
    const rid=rids[0];
    const ms=Math.max(getEffectiveMinStart(task)||GANTT_TODAY, GANTT_TODAY);
    const eff=engineFirstFreeDay(rid, nextWorkDay(ms), occ);
    const r=enginePlaceResource(task, rid, eff, occ[rid]||{});
    const m={}; r.segs.forEach(s=>m[s.day]=(m[s.day]||0)+s.hours);
    task._sched=m; task.start=r.segs[0]?.day||eff;
    if(!occ[rid]) occ[rid]={};
    Object.entries(m).forEach(([d,h])=>occ[rid][+d]=(occ[rid][+d]||0)+h);
  });
  persistState(['tasks']);
  renderGantt();
  renderWarningsPanel();
  notify(`Reallocated ${toPlace.length} task(s)`,'success');
};

// Tasks that (transitively) depend on the given task.
function _downstreamTasks(taskId){
  const out=[];
  const seen=new Set([taskId]);
  let frontier=[taskId];
  while(frontier.length){
    const next=[];
    TASKS.forEach(t=>{
      if(seen.has(t.id)) return;
      const dep=getEffectiveDep(t);
      if(dep.depType==='task'){
        const deps=[...new Set([...(dep.depIds||[]),dep.depId].filter(Boolean))];
        if(deps.some(d=>frontier.includes(d))){ out.push(t.id); seen.add(t.id); next.push(t.id); }
      }
    });
    frontier=next;
  }
  return out;
}

// Total hours already scheduled for resId on a given calendar day.
// Excludes one task (the one being placed) to avoid counting it against itself.
function getDayLoad(resId, day, excludeId=null){
  if(!resId) return 0;
  let total=0;
  TASKS.forEach(t=>{
    if(t.id===excludeId) return;
    if(t.status==='done'||t.status==='cancelled'||!t.start) return;
    if(t.resId===resId){
      // Primary resource — only use _sched if available
      if(t._sched) total+=t._sched[day]||0;
    } else if((t.coResIds||[]).includes(resId)){
      // Co-resource — use _schedCo if available
      if(t._schedCo?.[resId]) total+=t._schedCo[resId][day]||0;
    }
  });
  return total;
}

// Build exact per-day allocation for every task, per resource, in start-date order.
// Stores t._sched = {dayIdx: hours} — used by getDayLoad and the Gantt renderer.
function computeAllSchedules(){
  TASKS.forEach(t=>{ t._sched=null; t._schedCo=null; });
  const byRes={};
  // Build _sched for co-resources using resStart
  // Build per-resource dayAlloc for co-resource scheduling
  const _coDayAlloc={};
  // Pre-seed with primary resource tasks so co-resource sees full load
  TASKS.forEach(t=>{
    if(!t.resId||!t.start||!t._sched) return; // _sched not built yet — will seed after
  });
  // Build _schedCo for daily tasks with co-resources AND seed _coDayAlloc
  TASKS.forEach(t=>{
    if(t.timeMode!=='daily') return;
    if(t.status==='done'||t.status==='cancelled'||!t.start) return;
    const _coIds=(t.coResIds||[]).filter(Boolean);
    if(!_coIds.length) return;
    if(!t._schedCo) t._schedCo={};
    _coIds.forEach(coResId=>{
      const _hpd=t.hpd||HPD;
      if(!_hpd||_hpd<=0) return; // skip if no hours
      const sched={};
      if(!_coDayAlloc[coResId]) _coDayAlloc[coResId]={};
      let day=nextWorkDay(t.start), placed=0, iters=0;
      while(placed<(t.dur||1)&&iters++<500){
        if(isNW(day,t.id,coResId)){day++;continue;}
        sched[day]=_hpd;
        // Seed _coDayAlloc so continuous co-resource scheduling respects daily cap
        _coDayAlloc[coResId][day]=(_coDayAlloc[coResId][day]||0)+_hpd;
        placed++; day++;
      }
      t._schedCo[coResId]=sched;
    });
  });

  TASKS.forEach(t=>{
    if(!t.resStart||!Object.keys(t.resStart).length) return;
    if(t.status==='done'||t.status==='cancelled') return;
    if(!t._schedCo) t._schedCo={};
    Object.entries(t.resStart).forEach(([coResId,coStart])=>{
      const coHours=t.resHours?.[coResId]||0;
      if(!coHours||coHours<=0||!coStart) return;
      const coCap=getRes(coResId)?.dailyCap||HPD;
      if(!_coDayAlloc[coResId]) _coDayAlloc[coResId]={};
      const dayAlloc=_coDayAlloc[coResId];
      const sched={};
      // Use max of today and task start — don't trust saved resStart dates
      const coMinDay=nextWorkDay(Math.max(GANTT_TODAY, t.start||GANTT_TODAY));
      let rem=coHours, day=coMinDay, iters=0;
      while(rem>0.001&&iters++<500){
        if(isNW(day,t.id,coResId)){day++;continue;}
        const av=Math.max(0,Math.min(rem,coCap-(dayAlloc[day]||0)));
        if(av>0.001){
          sched[day]=(sched[day]||0)+av;
          dayAlloc[day]=(dayAlloc[day]||0)+av;
          rem-=av;
        }
        if(rem>0.001) day++;
      }
      t._schedCo[coResId]=sched;
    });
  });

  TASKS.forEach(t=>{
    if(t.status==='doing'||t.status==='paused') if(!t.start) t.start=GANTT_TODAY; // anchor active tasks
    if(!t.resId||!t.start||t.status==='done'||t.status==='cancelled'||t.status==='ready') return;
    if((tHours(t)??0)===0){
      // 0h grouping task: update start/dur to span all descendants
      const _desc=_getDescAll(t.id);
      if(_desc.length){
        const _starts=_desc.map(ch=>ch.start).filter(Boolean);
        const _ends=_desc.map(ch=>tEnd(ch)).filter(Boolean);
        if(_starts.length){
          t.start=Math.min(..._starts);
          t.dur=Math.max(1,(Math.max(..._ends)-t.start+1));
        }
      }
      t._sched={}; return;
    }
    if(!byRes[t.resId]) byRes[t.resId]=[];
    byRes[t.resId].push(t);
  });
  Object.entries(byRes).forEach(([resId,tasks])=>{
    const cap=getRes(resId)?.dailyCap||HPD;
    tasks.sort((a,b)=>{
      // Daily tasks ALWAYS processed first so they seed dayAlloc before continuous tasks
      const dailyA=a.timeMode==='daily'?0:1, dailyB=b.timeMode==='daily'?0:1;
      if(dailyA!==dailyB) return dailyA-dailyB;
      // Sort by deadline first (earlier deadline = higher priority), then by status
      const dla=a.deadline?dateToIdx(a.deadline):99999;
      const dlb=b.deadline?dateToIdx(b.deadline):99999;
      if(dla!==dlb) return dla-dlb;
      // Same deadline: doing first, then paused, then rest
      const pri=t=>t.status==='doing'?0:t.status==='paused'?1:2;
      return pri(a)-pri(b);
    });
    // Seed dayAlloc with ALL hours already allocated to this resId as co-resource
    const dayAlloc=Object.assign({},_coDayAlloc[resId]||{});
    // Add hours from _schedCo already computed (continuous + daily co-resource tasks)
    TASKS.forEach(dt=>{
      if(dt.resId===resId) return; // primary — already in tasks list
      if(dt.status==='done'||dt.status==='cancelled') return;
      if(!(dt.coResIds||[]).includes(resId)) return;
      if(!dt._schedCo?.[resId]) return;
      Object.entries(dt._schedCo[resId]).forEach(([day,h])=>{
        dayAlloc[day]=(dayAlloc[day]||0)+h;
      });
    });
    tasks.forEach(t=>{
      const sched={};

      if(t.timeMode==='daily'){
        // Daily rate: place exactly hpd each working day for t.dur days
        // Does NOT consume shared capacity (parallel task) and does NOT rewrite start/dur
        const hpd=t.hpd||HPD;
        let day=nextWorkDay(t.start), placed=0, iters=0;
        while(placed<t.dur && iters++<500){
          if(isNW(day,t.id,resId)){day++;continue;}
          sched[day]=hpd;
          // Note: daily-rate tasks still contribute to dayAlloc so other tasks see them
          dayAlloc[day]=(dayAlloc[day]||0)+hpd;
          placed++; day++;
        }
        t._sched=sched;
        // Record the first scheduled day for preview comparison
        const _dailyDays=Object.keys(sched).map(Number);
        if(_dailyDays.length) t._computedStart=Math.min(..._dailyDays);
        // Do NOT rewrite t.start / t.dur for daily rate tasks
        return;
      }

      // Total-hours task: delegate placement to the allocation engine.
      // Engine handles capacity, calendar blocks, partial time-offs and writes
      // an explainability record (_why). Non-destructive: works around dayAlloc.
      const baseStart = t.start||GANTT_TODAY;
      let minStart=nextWorkDay(baseStart);
      if(t.depType==='task'){
        const _dids=[...(t.depIds||[]),t.depId].filter(Boolean);
        _dids.forEach(did=>{ const dep=TASKS.find(x=>x.id===did); if(dep&&dep.start) minStart=Math.max(minStart,nextWorkDay(tEnd(dep)+1)); });
      }
      if(t.depType==='resource'&&t.depUntil){
        const mi=dateToIdx(t.depUntil);
        if(mi) minStart=Math.max(minStart,nextWorkDay(mi+1));
      }
      if(t.depType==='milestone'&&t.depMsId){
        const ms=MILESTONES.find(m=>m.id===t.depMsId);
        if(ms&&ms.dayIdx) minStart=Math.max(minStart,nextWorkDay(ms.dayIdx+1));
      }
      const _occ=Object.assign({}, dayAlloc);
      const _res=enginePlaceResource(t, resId, minStart, _occ);
      _res.segs.forEach(s=>{
        sched[s.day]=(sched[s.day]||0)+s.hours;
        dayAlloc[s.day]=(dayAlloc[s.day]||0)+s.hours;
      });
      t._sched=sched;
      t._why={}; _res.segs.forEach(s=>{ t._why[s.day]=s.why; });
      // Record the first scheduled day for preview comparison
      const _schedDays=Object.keys(sched).map(Number);
      if(_schedDays.length) t._computedStart=Math.min(..._schedDays);
      // computeAllSchedules remains display-only: it builds _sched for bar heights
    });
  });
}

// Given a task's hours and a start day, compute how many calendar days are
// needed to fit all hours, respecting dailyCap minus existing load.
// Returns { start, dur, endDay }
function packHoursFromDay(hours, fromDay, resId, taskId=null){
  if(!hours||hours<=0||!fromDay||isNaN(fromDay)) return {start:fromDay||1, dur:1, endDay:fromDay||1};
  const cap = getRes(resId)?.dailyCap || HPD;
  let remaining = hours;
  let day = nextWorkDay(fromDay);
  const startDay = day;
  let endDay = day;
  let iters = 0;
  while(remaining > 0.001 && iters++ < 365){
    if(isNW(day, taskId, resId)){ day++; continue; }
    const load = getDayLoad(resId, day, taskId);
    const avail = Math.max(0, cap - load);
    if(avail > 0.001){
      remaining -= Math.min(remaining, avail);
      endDay = day;
    }
    // Always advance to next day (whether or not we placed hours)
    if(remaining > 0.001) day++;
  }
  // Fallback: if still couldn't fit all hours, extend naively
  if(remaining > 0.001){
    let d = endDay+1, r = remaining;
    while(r > 0.001 && d < endDay+90){
      if(!isNW(d, taskId, resId)){ r -= Math.min(r, cap); endDay=d; }
      d++;
    }
  }
  return { start: startDay, dur: Math.max(1, endDay - startDay + 1), endDay };
}

// Find the first day >= fromDay where the resource has any capacity left
function firstDayWithCapacity(fromDay, resId, excludeId=null){
  const cap = getRes(resId)?.dailyCap || HPD;
  let d = nextWorkDay(fromDay);
  for(let i=0; i<500; i++, d++){
    if(isNW(d, excludeId, resId)) continue;
    if(getDayLoad(resId, d, excludeId) < cap - 0.001) return d;
  }
  return fromDay;
}

// When a day is disabled, adjust tasks that span or start on that day.
// - Task starts on day → push to next working day (same as before)
// - Task spans the day → extend by one working day (the lost hours move to the end)
function adjustTasksForDay(dayIdx, resId){
  let affected = 0;
  TASKS.forEach(t=>{
    if(t.status==='done'||t.status==='cancelled') return;
    if(resId && t.resId!==resId) return;
    if(!t.start) return;
    const te = tEnd(t);
    if(dayIdx < t.start || dayIdx > te) return; // day not in span

    if(dayIdx === t.start){
      // Starts on disabled day → push start forward
      const ns = nextWorkDay(dayIdx+1);
      addLog({type:'cascade', task:t.name, from:sd(dayIdx), to:sd(ns)});
      t.start = ns;
    } else {
      // Disabled day is in the middle or at end of span →
      // extend the task's end by one calendar working day
      // (the hours from the disabled day spill to the next working day after current end)
      let newEnd = te + 1;
      while(isNW(newEnd, t.id, t.resId) && newEnd < te + 30) newEnd++;
      const newDur = newEnd - t.start + 1;
      addLog({type:'resize', task:t.name, from:`ends ${sd(te)}`, to:`${sd(newEnd)} (resize)`});
      t.dur = newDur;
    }
    affected++;
  });
  if(affected > 0) notify(`${affected} task(s) adjusted for disabled day`, 'warn');
}

// Create segments for a task wherever non-working days break its span.
function autoSplitTask(t){
  if(!t.start||!t.dur) return;
  if(t.segments) return;
  const totalHours = tHours(t);
  const spans = [];
  let ss = null;
  for(let d=t.start; d<t.start+t.dur; d++){
    if(!isNW(d, t.id, t.resId)){ if(ss===null) ss=d; }
    else { if(ss!==null){ spans.push({start:ss, dur:d-ss}); ss=null; } }
  }
  if(ss!==null) spans.push({start:ss, dur:(t.start+t.dur)-ss});
  if(spans.length<=1) return;
  const totalWork = spans.reduce((s,x)=>s+x.dur, 0);
  t.segments = spans.map(sp=>({
    start:sp.start, dur:sp.dur,
    hours: totalWork>0 ? Math.round(totalHours*(sp.dur/totalWork)*10)/10 : sp.dur*HPD
  }));
  t.dur = (t.segments[t.segments.length-1].start+t.segments[t.segments.length-1].dur-1)-t.segments[0].start+1;
}

// Kept for compat — day-set helpers
function calDays(start, dur){ const s=new Set(); for(let d=start;d<start+dur;d++) s.add(d); return s; }
function workDaysNeeded(hours, cap){ return Math.max(1, Math.ceil(hours/cap)); }

// Simulate hour-aware cascade for drag preview.
// Returns Map<taskId, newStart> — tasks that would need to move to avoid capacity overflow.
function simulateCascade(movedId, proposedStart){
  const result = new Map();
  result.set(movedId, proposedStart);
  // Hour-packing: we don't cascade; other tasks stay where they are.
  // The moved task's duration will be recomputed on drop.
  return result;
}


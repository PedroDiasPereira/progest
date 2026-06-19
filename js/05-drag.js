
// ============================================================
// DRAG STATE + ROW HIGHLIGHTS
// ============================================================
let _dragPreview=new Map();

function applyDragHighlights(cascadeMap){
  document.querySelectorAll('tr.drag-preview-row,tr.drag-preview-moved').forEach(r=>{
    r.classList.remove('drag-preview-row','drag-preview-moved');
  });
  if(!cascadeMap||cascadeMap.size===0) return;
  document.querySelectorAll('tr[data-tid]').forEach(tr=>{
    const tid=tr.dataset.tid;
    if(!cascadeMap.has(tid)) return;
    if(tid===_mv?.taskId) tr.classList.add('drag-preview-moved');
    else tr.classList.add('drag-preview-row');
  });
}

// ============================================================
// MOVE (mousedown-based)
// ============================================================
let _mv=null;

window.bMD=(e,taskId,startDay,colW)=>{
  if(e.button!==0||_rz) return;
  if(e.target.classList.contains('gr')) return;
  e.preventDefault();e.stopPropagation();
  // Support subtask format: 'parentId__stId'
  let stId=null;
  let realTaskId=taskId;
  if(taskId.includes('__')){ const p=taskId.split('__'); realTaskId=p[0]; stId=p[1]; }
  const t=TASKS.find(x=>x.id===realTaskId);
  const _stObj=stId?(t?.subtasks||[]).find(s=>s.id===stId):null;
  const _mvStart=_stObj?(_stObj.start||t?.start||startDay):(t?.start||startDay);
  _mv={taskId:realTaskId, stId, origStart:_mvStart, startX:e.clientX, colW};
  _dragPreview=new Map();
  document.body.style.cursor='grabbing';
  document.body.style.userSelect='none';
};

function finishMove(upX){
  if(!_mv) return;
  const {taskId, stId:_stId, origStart, startX, colW}=_mv;
  _dragPreview=new Map();
  applyDragHighlights(null);
  _mv=null;
  document.body.style.cursor='';
  document.body.style.userSelect='';

  const delta=Math.round((upX-startX)/colW);
  if(delta===0) return;

  let newStart=nextWorkDay(origStart+delta);

  // ── VALIDATION ──────────────────────────────────────────────
  if(isLocked(newStart)){
    notifyErr(`Can't move to ${sd(newStart)} — that day is in the past.`); return;
  }
  const t=TASKS.find(x=>x.id===taskId);
  if(!t) return;

  // ── SUBTASK MOVE ─────────────────────────────────────────────
  if(_stId){
    const st=(t.subtasks||[]).find(s=>s.id===_stId)||TASKS.find(s=>s.id===_stId);
    if(!st) return;
    const oldSt=st.start;
    st.start=newStart;
    const stCap=getRes(st.resId||t.resId)?.dailyCap||HPD;
    const stH=st.hours||(t.hours/Math.max(1,(t.subtasks||[]).length));
    st.dur=Math.max(1,Math.ceil(stH/stCap));
    addLog({type:'move',task:`${t.name} › ${st.name}`,from:oldSt?sd(oldSt):'—',to:sd(newStart)});
    notify(`"${st.name}" → ${sd(newStart)}`,'success');
    S._sortBy=''; S._sortLocked=false;
    persistState(['tasks'],{tasks:[t.id]});
    renderGantt();
    return;
  }

  // Dependency check
  const depErr = checkDepConstraint(t, newStart);
  if(depErr){ notifyErr(depErr); return; }

  // ── APPLY MOVE ──────────────────────────────────────────────
  const old=t.start;
  t.start=newStart;
  if(t._autoSplit){ t.segments=null; t._autoSplit=false; }
  else if(t.segments){
    // Check if dragging a locked segment — block it
    const seg0=t.segments[0];
    if(seg0?._locked&&newStart<=(seg0.start+seg0.dur-1)&&newStart>=seg0.start){
      notifyErr('This part is locked (time already logged)'); t.start=old; return;
    }
    // If task has locked first segment, only move the free (last) segment
    if(seg0?._locked&&t.segments.length>1){
      const freeSeg=t.segments[t.segments.length-1];
      freeSeg.start=newStart;
      t.start=seg0.start; // keep overall start at locked segment
      t.dur=newStart+freeSeg.dur-1-seg0.start+1;
    } else {
      const sh=newStart-(old||newStart);
      t.segments.forEach(sg=>sg.start+=sh);
    }
  }

  // Recompute duration (total-hours tasks only — daily rate keeps its own dur)
  if(!t.segments && tHours(t)>0 && t.timeMode!=='daily'){
    const cap=getRes(t.resId)?.dailyCap||HPD;
    const wd=Math.max(1,Math.ceil(tHours(t)/cap));
    let d=newStart,wc=0,end=newStart;
    while(wc<wd&&d<newStart+365){ if(!isNW(d,t.id,t.resId)){wc++;end=d;} d++; }
    t.dur=Math.max(1,end-newStart+1);
  }

  addLog({type:'move',task:t.name,from:old?sd(old):'—',to:`${sd(newStart)} (moved ${newStart>old?'+':'-'}${Math.abs(newStart-(old||newStart))}d)`});
  notify(`"${t.name}" → ${sd(newStart)}`,'success');

  // ── CASCADE DEPENDENTS ───────────────────────────────────────
  // Any task that depends on the moved task must start after it ends
  cascadeDependents(taskId, new Set([taskId]));

  S._sortLocked=true;
  persistState();
  renderGantt();
}

// Returns error string if t cannot start on day, null if OK
function checkDepConstraint(t, day){
  if(!t.depType) return null;
  if(t.depType==='task'&&t.depId){
    const dep=TASKS.find(x=>x.id===t.depId);
    if(dep&&dep.start){
      const depEnd=tEnd(dep);
      if(day<=depEnd)
        return `"${t.name}" depends on "${dep.name}" — must start after ${sd(depEnd)} (ends there). Earliest: ${sd(nextWorkDay(depEnd+1))}.`;
    }
  }
  if(t.depType==='resource'&&t.depUntil){
    const minDay=dateToIdx(t.depUntil);
    if(minDay&&day<=minDay){
      const res=getRes(t.depResId);
      return `"${t.name}" depends on ${res?res.name:'resource'} — available from ${t.depUntil}. Earliest: ${sd(nextWorkDay(minDay+1))}.`;
    }
  }
  return null;
}

// Push dependents after a task move or resize. Handles both dep types.
function cascadeDependents(changedId, visited){
  const changed=TASKS.find(x=>x.id===changedId);
  if(!changed) return;
  const changedEnd=tEnd(changed);
  TASKS.forEach(t=>{
    if(visited.has(t.id)||t.status==='done'||t.status==='cancelled') return;
    if(t.depType==='task'&&t.depId===changedId){
      const minStart=nextWorkDay(changedEnd+1);
      if((t.start||0)<minStart){
        const old=t.start;
        t.start=minStart;
        addLog({type:'cascade',task:t.name,from:old?sd(old):'—',to:sd(minStart)});
        notify(`"${t.name}" pushed to ${sd(minStart)}`,'warn');
        visited.add(t.id);
        cascadeDependents(t.id, visited);
      }
    }
  });
}



function checkSpanForNW(t){
  if(!t.start||!t.dur||t.dur<=1) return false;
  for(let d=t.start+1;d<t.start+t.dur;d++) if(isNW(d,t.id,t.resId)) return true;
  return false;
}

document.addEventListener('mousemove',e=>{
  if(_mv){
    const {origStart,startX,colW,taskId}=_mv;
    const delta=Math.round((e.clientX-startX)/colW);
    if(delta!==(_mv.lastDelta||0)){
      _mv.lastDelta=delta;
      if(delta!==0&&!isLocked(origStart+delta)){
        _dragPreview=simulateCascade(taskId,origStart+delta);
        applyDragHighlights(_dragPreview);
      } else {
        _dragPreview=new Map();
        applyDragHighlights(null);
      }
    }
  }
  if(_rz) rzMove(e);
});

document.addEventListener('mouseup',e=>{
  if(_mv) finishMove(e.clientX);
  if(_rz) rzEnd();
},true);

// ============================================================
// RESIZE
// ============================================================
let _rz=null;
window.rMD=(e,taskId,edge,colW)=>{
  e.preventDefault();e.stopPropagation();
  const t=TASKS.find(x=>x.id===taskId);
  if(!t) return;
  _rz={taskId,edge,colW,startX:e.clientX,origStart:t.start||1,origDur:tDur(t),origHours:tHours(t)};
  document.body.style.cursor='col-resize';document.body.style.userSelect='none';
};
function rzMove(e){
  if(!_rz) return;
  const {taskId,stId,edge,colW,startX,origStart,origDur,origHours}=_rz;
  // For subtask resize, do a simple preview update
  if(stId){
    const t2=TASKS.find(x=>x.id===taskId);
    const st2=(t2?.subtasks||[]).find(s=>s.id===stId);
    if(st2){
      const delta2=Math.round((e.clientX-startX)/colW);
      const stCap2=getRes(st2.resId||t2.resId)?.dailyCap||HPD;
      if(edge==='r'){ st2.dur=Math.max(1,origDur+delta2); st2.hours=Math.round(st2.dur*stCap2*10)/10; }
      else { const ns=origStart+delta2; if(ns<origStart+origDur) { st2.start=Math.max(GANTT_TODAY,ns); st2.dur=Math.max(1,origDur-delta2); } }
    }
    return;
  }
  const t=TASKS.find(x=>x.id===taskId);
  if(!t) return;
  const d=Math.round((e.clientX-startX)/colW);
  if(edge==='r'){
    const nd=Math.max(1,origDur+d);
    t.dur=nd;
    if(t.timeMode==='daily') t.hours=(t.hpd||HPD)*nd;
  } else {
    let ns=origStart+d, nd=origDur-d;
    if(nd<1||isLocked(ns)) return;
    // Snap left-edge start to a working day
    if(isNW(ns, t.id, t.resId)){ ns=nextWorkDay(ns); nd=origStart+origDur-ns; }
    if(nd<1) return;
    t.start=ns; t.dur=nd;
    if(t.timeMode==='daily') t.hours=(t.hpd||HPD)*nd;
  }
  clearTimeout(window._rzT);
  window._rzT=setTimeout(()=>renderGantt(),30);
}
function rzEnd(){
  if(!_rz) return;
  const {taskId, stId, edge}=_rz;
  const t=TASKS.find(x=>x.id===taskId);
  
  // ── SUBTASK RESIZE END ────────────────────────────────────────
  if(stId){
    const st=(t?.subtasks||[]).find(s=>s.id===stId);
    if(st){
      addLog({type:'resize',task:`${t.name} › ${st.name}`,from:'',to:`${st.start?sd(st.start):'—'}, ${st.dur||1}d, ${st.hours||0}h`});
      persistState(['tasks'],{tasks:[taskId]});
    }
    _rz=null; document.body.style.cursor=''; document.body.style.userSelect='';
    renderGantt();
    return;
  }

  if(t){
    if(edge==='r' && t.resId && t.timeMode!=='daily'){
      const packed = packHoursFromDay(tHours(t), t.start, t.resId, t.id);
      t.dur = packed.dur;
    }
    if(!t.segments){ if(checkSpanForNW(t)){ autoSplitTask(t); if(t.segments) t._autoSplit=true; } }
    addLog({type:'resize', task:t.name, from:'', to:`${sd(t.start)}, ${tDur(t)}d, ${tHours(t)}h`});
    cascadeDependents(taskId, new Set([taskId]));
  }
  _rz=null;
  document.body.style.cursor='';document.body.style.userSelect='';
  persistState();
  renderGantt();
}

// ============================================================
// CONTEXT MENU
// ============================================================
document.addEventListener('click',()=>document.getElementById('ctx').classList.remove('open'));
function showCtx(e,taskId){
  e.preventDefault();e.stopPropagation();
  S.ctxId=taskId;
  const t=TASKS.find(x=>x.id===taskId);
  document.getElementById('ctx-n').textContent=t?.name||'?';
  const ctx=document.getElementById('ctx');
  ctx.style.left=Math.min(e.clientX,window.innerWidth-200)+'px';
  ctx.style.top=Math.min(e.clientY,window.innerHeight-220)+'px';
  ctx.classList.add('open');
  // Promote/revert visibility: promote shown for team tasks; revert shown for promoted tasks
  const _isTeam=t?.assignType==='team';
  const _isPromoted=t?.assignOrigin==='teamPromoted';
  const _pSep=document.getElementById('ctx-promote-sep');
  const _pBtn=document.getElementById('ctx-promote');
  const _rBtn=document.getElementById('ctx-revert');
  if(_pBtn) _pBtn.style.display=(isAdmin()&&_isTeam&&!_isPromoted)?'':'none';
  if(_rBtn) _rBtn.style.display=(isAdmin()&&_isPromoted)?'':'none';
  if(_pSep) _pSep.style.display=(isAdmin()&&(_isTeam||_isPromoted))?'':'none';
}
window.ctxEdit=()=>{CM_close();if(S.ctxId)openEditTask(S.ctxId);};
window.ctxAddDependent=()=>{
  const srcId=S.ctxId;
  CM_close();
  if(!srcId) return;
  const src=TASKS.find(x=>x.id===srcId);
  if(!src) return;
  // Open new task modal and pre-fill the dependency
  openAddTask();
  // Pre-fill group from source task
  const gsel=document.getElementById('mt-group');
  if(gsel&&src.group) gsel.value=src.group;
  // Set dep type to task and pre-select the source task
  const depType=document.getElementById('mt-dep-type');
  if(depType){ depType.value='task'; onDepTypeChange(); }
  // Pre-fill combo-search input and hidden select
  const inp=document.getElementById('dep-task-search');
  if(inp) inp.value=src.name;
  const sel=document.getElementById('mt-dep-id');
  if(sel){
    let opt=[...sel.options].find(o=>o.value===srcId);
    if(!opt){ opt=new Option(src.name,srcId); sel.add(opt); }
    sel.value=srcId;
  }
  // Show the dep section
  document.getElementById('fg-dep-task').style.display='';
  document.getElementById('fg-dep-note').style.display='';
};
window.ctxDuplicate=()=>{
  CM_close();
  const src=TASKS.find(x=>x.id===S.ctxId);
  if(!src) return;
  const newId='t'+Date.now();
  const copy=JSON.parse(JSON.stringify(src));
  copy.id=newId;
  copy.name='(copy) '+src.name;
  copy.status='todo';
  copy.prog=0;
  copy.timeLogs=[];
  copy.segments=null;
  // place copy right after source in array
  const idx=TASKS.findIndex(x=>x.id===src.id);
  TASKS.splice(idx+1,0,copy);
  addLog({type:'create',task:copy.name,from:'',to:'duplicated from '+src.name});
  persistState(['tasks']);
  renderGantt();renderDash();_refreshOverview();
  notify('Task duplicated','success');
};
window.ctxSplit=()=>{CM_close();if(S.ctxId)openSplit(S.ctxId);};

// Promote a team task: freeze the current simulation/allocation as direct resources,
// converting assignType team → direct, capturing per-resource hours from the current _sched.
window.ctxPromoteTeam=()=>{
  CM_close();
  if(!isAdmin()){ notify('Only admins','warn'); return; }
  const t=TASKS.find(x=>x.id===S.ctxId);
  if(!t||t.assignType!=='team'){ notify('Not a team task','warn'); return; }
  // Resolve which resources the current allocation used
  const used={};
  if(t.resId&&t._sched) Object.values(t._sched).forEach(h=>used[t.resId]=(used[t.resId]||0)+h);
  if(t._schedCo) Object.entries(t._schedCo).forEach(([rid,sc])=>{ Object.values(sc||{}).forEach(h=>used[rid]=(used[rid]||0)+h); });
  let ids=Object.keys(used);
  if(!ids.length){ // fall back to engine resolution if not yet scheduled
    ids=engineResolveResources(t);
    if(!ids.length){ notify('No resources to promote — run a simulation first','warn'); return; }
    const rem=engineRemaining(t,null), share=rem/ids.length;
    ids.forEach(id=>used[id]=share);
  }
  const names=ids.map(id=>getRes(id)?.name||id).join(', ');
  if(!confirm(`Promote "${t.name}" to fixed resources?\n\nResources: ${names}\n\nThe team→resource resolution becomes fixed (who is locked, when stays flexible). Reversible later.`)) return;
  // Freeze: direct assignment with captured per-resource hours
  t.assignType='direct';
  t.assignOrigin='teamPromoted';
  t._promotedFrom={teamId:t.teamId}; // remember origin for revert
  t.resId=ids[0];
  t.coResIds=ids.slice(1);
  t.resHours=Object.assign({},used);
  persistState(['tasks']);
  renderGantt();
  notify(`Promoted "${t.name}" to ${ids.length} fixed resource(s)`,'success');
};

// Revert a promoted task back to team assignment (drops fixed resources, restores pool).
window.ctxRevertTeam=()=>{
  CM_close();
  if(!isAdmin()){ notify('Only admins','warn'); return; }
  const t=TASKS.find(x=>x.id===S.ctxId);
  if(!t||t.assignOrigin!=='teamPromoted'){ notify('Not a promoted task','warn'); return; }
  // in-progress guard: a task with logged hours is anchored and must not be reverted
  if(logH(t)>0.001){ notify('Cannot revert: task is in progress (has logged hours)','warn'); return; }
  if(!confirm(`Revert "${t.name}" back to team assignment?\n\nThe fixed resources are dropped and the task returns to the team pool — the simulation will re-resolve who does it.`)) return;
  t.assignType='team';
  t.assignOrigin='directRaw';
  if(t._promotedFrom?.teamId) t.teamId=t._promotedFrom.teamId;
  delete t._promotedFrom;
  t.coResIds=[];
  t.resHours={};
  persistState(['tasks']);
  renderGantt();
  notify(`Reverted "${t.name}" to team assignment`,'success');
};

// Project-wide revert: revert all promoted team tasks in a project back to team assignment.
// Skips in-progress tasks (with logged hours) and never touches direct-from-origin tasks.
window.revertProjectPromoted=()=>{
  if(!isAdmin()){ notify('Only admins','warn'); return; }
  if(!_editProjId){ notify('No project open','warn'); return; }
  const promoted=TASKS.filter(t=>t.projId===_editProjId&&t.assignOrigin==='teamPromoted');
  if(!promoted.length){ notify('No promoted tasks in this project','warn'); return; }
  const eligible=promoted.filter(t=>logH(t)<=0.001);
  const skipped=promoted.filter(t=>logH(t)>0.001);
  let msg=`Revert ${eligible.length} promoted task(s) in this project back to team assignment?`;
  if(skipped.length) msg+=`\n\n${skipped.length} task(s) will be skipped (in progress — have logged hours).`;
  msg+=`\n\nThe simulation will re-resolve who does each task.`;
  if(!confirm(msg)) return;
  eligible.forEach(t=>{
    t.assignType='team';
    t.assignOrigin='directRaw';
    if(t._promotedFrom?.teamId) t.teamId=t._promotedFrom.teamId;
    delete t._promotedFrom;
    t.coResIds=[];
    t.resHours={};
  });
  persistState(['tasks']);
  renderGantt();
  const _rb=document.getElementById('mpr-revert-all'); if(_rb) _rb.style.display='none';
  notify(`Reverted ${eligible.length} task(s)${skipped.length?`, skipped ${skipped.length} in progress`:''}`,'success');
};

window.ctxLog=()=>{CM_close();if(S.ctxId)openLogTime(S.ctxId);};
window.ctxDel=()=>{
  CM_close();
  if(!isAdmin()){notify('Only admins can delete tasks','warn');return;}
  const _ctxDelId=S.ctxId;
  const _collectDesc2=(pid)=>{ const ch=TASKS.filter(x=>x.parentId===pid); return ch.flatMap(c=>[c.id,..._collectDesc2(c.id)]); };
  const _allCtxDel=[_ctxDelId,..._collectDesc2(_ctxDelId)];
  TASKS=TASKS.filter(t=>!_allCtxDel.includes(t.id));
  const _dp2={}; _allCtxDel.forEach(id=>{ _dp2[id]=null; });
  fetch(_FB_ROOT+'/tasks.json',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(_dp2)}).catch(()=>{});
  notify('Deleted','warn');
  renderGantt();renderDash();_refreshOverview();
};
window.ctxStat=(s)=>{
  CM_close();
  const t=TASKS.find(x=>x.id===S.ctxId);
  if(!t) return;
  if(s==='hold'){ _showHoldDialog(S.ctxId); return; }
  if(s==='doing'){ tpStart(S.ctxId); return; } // doing = timer only
  if(s==='done'&&taskHasMilestone(t.id)){
    s='ready';
    notify(`"${t.name}" → Ready`,'success');
  }
  t.status=s;
  const _prevStatus=t.status; addLog({type:'status',task:t.name,from:SLABELS[_prevStatus]||_prevStatus,to:SLABELS[s]||s});
  notify(`"${t.name}" → ${SLABELS[s]}`,'success');
  renderGantt();renderDash();_refreshOverview();
};
function CM_close(){ document.getElementById('ctx').classList.remove('open'); }


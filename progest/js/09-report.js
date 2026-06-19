// ============================================================
// REPORT
// ============================================================
// ============================================================
// REPORT SNAPSHOTS
// ============================================================
let _rptSnapshots = {}; // loaded from Firebase
let _rptSnapshotsLoaded = false;

async function loadReportSnapshots(){
  try{
    const r=await fetch(_FB_ROOT+'/snapshots.json');
    if(!r.ok){ _rptSnapshotsLoaded=true; return; }
    const d=await r.json();
    // Reconstruct milestones from keyed object back to array
    const raw=d||{};
    Object.values(raw).forEach(snap=>{
      if(snap.milestones&&!Array.isArray(snap.milestones)){
        snap.milestones=Object.values(snap.milestones);
      }
    });
    _rptSnapshots=raw;
  }catch(e){ _rptSnapshots={}; }
  _rptSnapshotsLoaded=true;
}

async function saveReportSnapshot(){
  const nameEl=document.getElementById('rpt-snap-name');
  const name=(nameEl?.value||'').trim();
  if(!name){notify('Enter a snapshot name','warn');nameEl?.focus();return;}
  const _rpProjId=document.getElementById('rpt-proj-filter')?.value||'';
  const rptTasks=_rpProjId?TASKS.filter(t=>t.projId===_rpProjId):TASKS;
  // Use short codes as Firebase keys (avoid special chars in keys)
  const _GRP_ORDER=['REQUISITOS E ESPECIFICAÇÃO','PROTÓTIPO','VALIDAÇÃO','HANDOVER','AVALIAÇÃO DE RISCOS TÉCNICOS','PROJETO'];
  const _GRP_KEY={'REQUISITOS E ESPECIFICAÇÃO':'REQ','PROTÓTIPO':'PROT','VALIDAÇÃO':'VAL','HANDOVER':'DEL','AVALIAÇÃO DE RISCOS TÉCNICOS':'RIS','PROJETO':'PROJ'};
  const _GRP_STATUSES=['todo','doing','paused','hold','done','cancelled'];
  const snap={
    id:'snap_'+Date.now(),
    name,
    date:new Date().toISOString(),
    projId:_rpProjId||null,
    metrics:{
      planned:rptTasks.reduce((s,t)=>s+tHours(t),0),
      executed:rptTasks.reduce((s,t)=>s+logH(t),0),
      done:rptTasks.filter(t=>t.status==='done').length,
      doing:rptTasks.filter(t=>t.status==='doing').length,
      overdue:rptTasks.filter(t=>t.deadline&&t.status!=='done'&&t.status!=='cancelled'&&(dateToIdx(t.deadline)<GANTT_TODAY||tEnd(t)>dateToIdx(t.deadline))).length,
      total:rptTasks.length
    },
    groups:Object.fromEntries(_GRP_ORDER.map(g=>{
      const key=_GRP_KEY[g]||g;
      const gt=rptTasks.filter(t=>t.group===g);
      return [key,{
        total:gt.length,
        planned:gt.reduce((s,t)=>s+tHours(t),0),
        executed:gt.reduce((s,t)=>s+logH(t),0),
        statuses:Object.fromEntries(_GRP_STATUSES.map(s=>[s,gt.filter(t=>t.status===s).length]))
      }];
    })),
    milestones:MILESTONES.filter(m=>!_rpProjId||m.projId===_rpProjId||(m.taskIds||[]).some(id=>rptTasks.find(t=>t.id===id))).map(m=>{
      const mt=(m.taskIds||[]).map(id=>TASKS.find(t=>t.id===id)).filter(Boolean);
      const done=mt.filter(t=>t.status==='done'||t.status==='ready').length;
      return {id:m.id,name:m.name,dayIdx:m.dayIdx,color:m.color,total:mt.length,done,planned:mt.reduce((s,t)=>s+tHours(t),0),executed:mt.reduce((s,t)=>s+logH(t),0)};
    })
  };
  // Sanitize: remove undefined/null values, convert milestones array to keyed object
  const snapToSave={
    id:snap.id, name:snap.name, date:snap.date, projId:snap.projId||'',
    metrics:snap.metrics,
    groups:snap.groups,
    milestones:Object.fromEntries(
      snap.milestones.map(m=>[
        'ms_'+(m.id||'').replace(/[.#$\[\]/]/g,'_'),
        {name:m.name||'',dayIdx:m.dayIdx||0,color:m.color||'',total:m.total||0,done:m.done||0,planned:m.planned||0,executed:m.executed||0}
      ])
    )
  };
  try{
    const res=await fetch(_FB_ROOT+'/snapshots/'+snap.id+'.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(snapToSave)});
    if(!res.ok){const txt=await res.text();throw new Error('HTTP '+res.status+': '+txt);}
    _rptSnapshots[snap.id]=snap; // keep full object in memory
    if(nameEl) nameEl.value='';
    notify('Snapshot "'+name+'" saved','success');
    renderReport();
  }catch(e){ notify('Failed to save snapshot: '+e.message,'error'); console.error('Snapshot save error',e); }
}

async function deleteReportSnapshot(){
  const sel=document.getElementById('rpt-snap-compare');
  const id=sel?.value;
  if(!id||!_rptSnapshots[id]) return;
  if(!confirm('Delete snapshot "'+_rptSnapshots[id].name+'"?')) return;
  try{
    await fetch(_FB_ROOT+'/snapshots/'+id+'.json',{method:'DELETE'});
    delete _rptSnapshots[id];
    if(sel) sel.value='';
    notify('Snapshot deleted','success');
    renderReport();
  }catch(e){ notify('Failed to delete snapshot','error'); }
}

function _deltaSpan(cur, snap, suffix='', invert=false){
  if(snap===undefined||snap===null) return '';
  const d=cur-snap;
  if(d===0) return '<span style="font-size:10px;color:var(--fg3);margin-left:4px">±0</span>';
  const pos=invert?d<0:d>0;
  const col=pos?'var(--danger)':'var(--ok)';
  return '<span style="font-size:10px;color:'+col+';margin-left:4px;font-weight:700">'+(d>0?'+':'')+d+suffix+'</span>';
}

function renderReport(){
  // Load snapshots if not yet loaded
  if(!_rptSnapshotsLoaded){ loadReportSnapshots().then(()=>{ if(S.page==='report') renderReport(); }); return; }

  // Populate project filter
  const _rpSel=document.getElementById('rpt-proj-filter');
  if(_rpSel){
    const _cur=_rpSel.value;
    _rpSel.innerHTML='<option value="">All projects</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    _rpSel.value=_cur;
  }
  const _rpProjId=_rpSel?.value||'';
  const rptTasks=_rpProjId?TASKS.filter(t=>t.projId===_rpProjId):TASKS;

  // Populate snapshot compare selector
  const snapSel=document.getElementById('rpt-snap-compare');
  const snapDelBtn=document.getElementById('rpt-snap-del');
  if(snapSel){
    const curSnap=snapSel.value;
    const snaps=Object.values(_rptSnapshots).sort((a,b)=>b.date.localeCompare(a.date));
    snapSel.innerHTML='<option value="">— compare with snapshot —</option>'+snaps.map(s=>{
      const d=new Date(s.date);
      const label=s.name+' ('+d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})+')';
      return `<option value="${s.id}">${label}</option>`;
    }).join('');
    snapSel.value=curSnap;
    if(snapDelBtn) snapDelBtn.style.display=curSnap?'':'none';
  }
  const snapId=snapSel?.value||'';
  const snap=snapId?_rptSnapshots[snapId]:null;

  const done=rptTasks.filter(t=>t.status==='done').length;
  const doing=rptTasks.filter(t=>t.status==='doing').length;
  const ov=rptTasks.filter(t=>t.deadline&&t.status!=='done'&&t.status!=='cancelled'&&(dateToIdx(t.deadline)<GANTT_TODAY||tEnd(t)>dateToIdx(t.deadline))).length;
  const ph=rptTasks.reduce((s,t)=>s+tHours(t),0);
  const ah=rptTasks.reduce((s,t)=>s+logH(t),0);

  const snapBanner=snap?`<div style="display:flex;align-items:center;gap:8px;background:rgba(123,97,255,.1);border:1px solid rgba(123,97,255,.3);border-radius:var(--r8);padding:8px 14px;margin-bottom:12px;font-size:11px;color:var(--acc2)">
    <span style="font-size:14px">📸</span>
    <span>Comparing with snapshot <strong>${snap.name}</strong> — ${new Date(snap.date).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
  </div>`:'';

  document.getElementById('rpt').innerHTML=snapBanner+`
    <div class="mg" style="grid-template-columns:repeat(6,1fr);margin-bottom:16px">
      <div class="mc a1"><div class="ml">Planned</div><div class="mv">${ph}h${snap?_deltaSpan(ph,snap.metrics?.planned,'h',true):''}</div></div>
      <div class="mc a2"><div class="ml">Executed</div><div class="mv">${_fmtHours(ah)}${snap?_deltaSpan(ah,snap.metrics?.executed,'h'):''}</div></div>
      <div class="mc a3"><div class="ml">Efficiency</div><div class="mv">${ph?Math.round(ah/ph*100):0}%${snap&&snap.metrics?.planned?_deltaSpan(ph?Math.round(ah/ph*100):0,Math.round((snap.metrics.executed||0)/(snap.metrics.planned||1)*100),'%'):''}</div></div>
      <div class="mc a2"><div class="ml">Done</div><div class="mv" style="color:var(--ok)">${done}${snap?_deltaSpan(done,snap.metrics?.done,''):''}</div></div>
      <div class="mc a3"><div class="ml">In progress</div><div class="mv" style="color:var(--acc)">${doing}${snap?_deltaSpan(doing,snap.metrics?.doing,''):''}</div></div>
      <div class="mc a4"><div class="ml">Overdue</div><div class="mv" style="color:${ov?'var(--danger)':'inherit'}">${ov}${snap?_deltaSpan(ov,snap.metrics?.overdue,'',true):''}</div></div>
    </div>
    ${(()=>{
      const _proj=_rpProjId?PROJECTS.find(p=>p.id===_rpProjId):null;

      // helpers
      const _idxToIso=idx=>{ if(!idx) return null; const d=gDate(idx); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
      const _fmtShort=iso=>iso?iso.slice(5):'—';
      const _fmtFull=iso=>iso||'—';

      // 1. Deadline
      const _dl=_proj?.deadline||null;
      const _dlIdx=_dl?dateToIdx(_dl):null;
      const _dlPast=_dlIdx&&_dlIdx<GANTT_TODAY;
      const _todayIso=_idxToIso(GANTT_TODAY);
      const _daysLeft=_dlIdx?(_dlIdx-GANTT_TODAY):null;

      // 2. Last task
      const _projTasks=_rpProjId?TASKS.filter(t=>t.projId===_rpProjId&&t.start!=null):TASKS.filter(t=>t.start!=null);
      const _lastTaskIdx=_projTasks.length?Math.max(..._projTasks.map(t=>tEnd(t))):null;
      const _lastTaskIso=_idxToIso(_lastTaskIdx);

      // 3. Last task by team
      const _teamIds=[...new Set(_projTasks.map(t=>t.teamId).filter(Boolean))];
      const _teamRows=_teamIds.map(tid=>{
        const _tm=getTeam(tid);
        const _tTasks=_projTasks.filter(t=>t.teamId===tid&&t.start!=null);
        const _tLast=_tTasks.length?Math.max(..._tTasks.map(t=>tEnd(t))):null;
        return {name:_tm?.name||tid,color:_tm?.color||'#888',lastIdx:_tLast,lastIso:_idxToIso(_tLast)};
      }).sort((a,b)=>(a.lastIdx||0)-(b.lastIdx||0));

      // 4. Last production milestone
      const _prodMs=MILESTONES.filter(m=>m.shape==='circle'&&(!_rpProjId||m.projId===_rpProjId)&&m.dayIdx);
      const _lastProdMs=_prodMs.length?_prodMs.reduce((a,b)=>b.dayIdx>a.dayIdx?b:a,_prodMs[0]):null;
      const _lastProdIso=_idxToIso(_lastProdMs?.dayIdx);

      // Build cards HTML
      const _dlColor=_dlPast?'var(--danger)':'var(--fg0)';
      let H='<div class="card mb16"><div class="ch"><span class="ct">Project Summary</span></div><div class="cb" style="padding:12px 16px">';

      // Cards row
      H+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">';

      // Card: deadline
      H+='<div style="background:var(--bg1);border:1px solid var(--bd2);border-radius:var(--r12);padding:10px 12px;display:flex;flex-direction:column;justify-content:center">'
        +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">'
          +'<div style="width:28px;height:28px;border-radius:6px;background:rgba(229,72,77,.12);display:flex;align-items:center;justify-content:center;font-size:13px">📅</div>'
          +'<span style="font-size:10px;color:var(--fg3)">Deadline</span>'
        +'</div>'
        +'<div style="font-size:17px;font-weight:700;color:'+_dlColor+'">'+_fmtFull(_dl)+'</div>'
        +(_daysLeft!==null?'<div style="font-size:10px;color:var(--fg3);margin-top:3px">'+(_daysLeft>=0?_daysLeft+' days remaining':'Overdue by '+Math.abs(_daysLeft)+' days')+'</div>':'')
      +'</div>';

      // Card: last production delivery (before last scheduled task)
      H+='<div style="background:var(--bg1);border:1px solid var(--bd2);border-radius:var(--r12);padding:10px 12px;display:flex;flex-direction:column;justify-content:center">'
        +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">'
          +'<div style="width:28px;height:28px;border-radius:6px;background:rgba(52,199,89,.12);display:flex;align-items:center;justify-content:center;font-size:13px">📦</div>'
          +'<span style="font-size:10px;color:var(--fg3)">Last production delivery</span>'
        +'</div>'
        +'<div style="font-size:17px;font-weight:700;color:var(--fg0)">'+_fmtFull(_lastProdIso)+'</div>'
        +(_lastProdMs?'<div style="font-size:10px;color:var(--fg3);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+_lastProdMs.name+'</div>':'')
      +'</div>';

      // Card: last scheduled task
      H+='<div style="background:var(--bg1);border:1px solid var(--bd2);border-radius:var(--r12);padding:10px 12px;display:flex;flex-direction:column;justify-content:center">'
        +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">'
          +'<div style="width:28px;height:28px;border-radius:6px;background:rgba(79,156,249,.12);display:flex;align-items:center;justify-content:center;font-size:13px">🏁</div>'
          +'<span style="font-size:10px;color:var(--fg3)">Last scheduled task</span>'
        +'</div>'
        +'<div style="font-size:17px;font-weight:700;color:var(--fg0)">'+_fmtFull(_lastTaskIso)+'</div>'
      +'</div>';

      // Card: last task by team
      H+='<div style="background:var(--bg1);border:1px solid var(--bd2);border-radius:var(--r12);padding:10px 12px">'
        +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">'
          +'<div style="width:28px;height:28px;border-radius:6px;background:rgba(255,149,0,.12);display:flex;align-items:center;justify-content:center;font-size:13px">👥</div>'
          +'<span style="font-size:10px;color:var(--fg3)">Last task by team</span>'
        +'</div>'
        +(_teamRows.length?_teamRows.map(r=>'<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:4px">'
            +'<div style="display:flex;align-items:center;gap:5px;min-width:0">'
              +'<span style="width:7px;height:7px;border-radius:2px;background:'+r.color+';flex-shrink:0"></span>'
              +'<span style="font-size:10px;color:var(--fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+r.name+'</span>'
            +'</div>'
            +'<span style="font-size:10px;font-weight:600;color:var(--fg0);font-family:var(--mono);flex-shrink:0">'+_fmtFull(r.lastIso)+'</span>'
          +'</div>').join(''):'<span style="font-size:10px;color:var(--fg3)">—</span>')
      +'</div>';

      H+='</div>'; // end cards grid

      // Timeline
      const _tlEvents=[];
      if(_todayIso) _tlEvents.push({iso:_todayIso,label:'Today',color:'var(--fg3)',isToday:true});
      if(_dl) _tlEvents.push({iso:_dl,label:'Deadline',color:_dlPast?'var(--danger)':'#e5484d',icon:'📅'});
      if(_lastTaskIso) _tlEvents.push({iso:_lastTaskIso,label:'Last scheduled task',color:'var(--acc)',icon:'🏁'});
      if(_lastProdIso) _tlEvents.push({iso:_lastProdIso,label:'Last delivery',color:'#34c759',icon:'📦'});
      _teamRows.forEach(r=>{ if(r.lastIso) _tlEvents.push({iso:r.lastIso,label:r.name,color:r.color,icon:'●'}); });

      if(_tlEvents.length<2){ H+='</div></div>'; return H; }

      _tlEvents.sort((a,b)=>a.iso.localeCompare(b.iso));
      const _tlMin=new Date(_tlEvents[0].iso).getTime()-12*86400000;
      const _tlMax=new Date(_tlEvents[_tlEvents.length-1].iso).getTime()+12*86400000;
      const _tlSpan=_tlMax-_tlMin;
      const _tlPct=iso=>(((new Date(iso).getTime()-_tlMin)/_tlSpan)*100).toFixed(2);

      H+='<div style="position:relative;padding:36px 0 44px;margin:0 8px">';
      // line
      H+='<div style="position:absolute;top:50%;left:0;right:0;height:2px;background:var(--bd2);transform:translateY(-50%)"></div>';

      const _tlN=_tlEvents.filter(e=>!e.isToday).length;
      let _tlIdx=0;
      _tlEvents.forEach((ev,i)=>{
        const pct=parseFloat(_tlPct(ev.iso));
        const above=ev.isToday?null:(_tlIdx%2===0);
        if(!ev.isToday) _tlIdx++;
        const stemH=26;
        // dot
        H+='<div style="position:absolute;top:50%;left:'+pct+'%;width:'+(ev.isToday?'2':'10')+'px;height:'+(ev.isToday?'100%':'10')+'px;'
          +(ev.isToday?'top:0;background:var(--fg3);opacity:.3;transform:translateX(-50%)'
            :'border-radius:50%;background:'+ev.color+';border:2px solid var(--bg0);transform:translate(-50%,-50%);z-index:2')
          +'"></div>';
        if(ev.isToday){
          H+='<div style="position:absolute;bottom:4px;left:'+pct+'%;transform:translateX(-50%);font-size:9px;color:var(--fg3);white-space:nowrap">today</div>';
          return;
        }
        // stem
        H+='<div style="position:absolute;left:'+pct+'%;width:1px;background:var(--bd2);'
          +(above?'bottom:calc(50% + 5px);height:'+stemH+'px':'top:calc(50% + 5px);height:'+stemH+'px')
          +'"></div>';
        // label — clamp position so it never overflows container
        const lblTop=above?'auto':'calc(50% + '+(stemH+8)+'px)';
        const lblBot=above?'calc(50% + '+(stemH+8)+'px)':'auto';
        // align: left-anchored near left edge, right-anchored near right edge, centered otherwise
        const isLeft=pct<15;
        const isRight=pct>85;
        const align=isLeft?'left':isRight?'right':'center';
        const transform=isLeft?'none':isRight?'translateX(-100%)':'translateX(-50%)';
        H+='<div style="position:absolute;left:'+pct+'%;top:'+lblTop+';bottom:'+lblBot+';transform:'+transform+';display:flex;flex-direction:column;align-items:'+align+';gap:1px;white-space:nowrap">'
          +(above?'<div style="font-size:10px;color:var(--fg3)">'+ev.label+'</div>'
                 +'<div style="font-size:10px;font-weight:600;color:'+ev.color+'">'+ev.iso.slice(5)+'</div>'
                :'<div style="font-size:10px;font-weight:600;color:'+ev.color+'">'+ev.iso.slice(5)+'</div>'
                 +'<div style="font-size:10px;color:var(--fg3)">'+ev.label+'</div>')
        +'</div>';
      });

      H+='</div>'; // end timeline
      H+='</div></div>'; // end card
      return H;
    })()}
    <div class="g2 mb16">
      <div class="card"><div class="ch"><span class="ct">Hours by team — Planned vs Executed</span></div><div class="cb" style="position:relative;height:220px"><canvas id="rp-t">Team hours</canvas></div></div>
      <div class="card"><div class="ch"><span class="ct">Hours by group — Planned vs Executed</span></div><div class="cb" style="position:relative;height:260px"><canvas id="rp-g">Group hours</canvas></div></div>
    </div>
    <div class="card mb16"><div class="ch"><span class="ct">Team workload</span></div><div class="cb" style="padding:12px 16px" id="rp-team-workload"></div></div>
    <div class="card mb16"><div class="ch"><span class="ct">Tasks by group — Status breakdown${snap?' <span style="font-size:9px;color:var(--acc2);margin-left:6px">vs snapshot</span>':''}</span></div><div class="cb" id="rp-gs-wrap" style="padding:12px 16px"></div></div>
    <div class="card"><div class="ch"><span class="ct">Milestones / Sprints${snap?' <span style="font-size:9px;color:var(--acc2);margin-left:6px">vs snapshot</span>':''}</span></div><div style="overflow-x:auto">
      <table class="dt">
        <thead><tr>
          <th style="min-width:180px">Milestone</th>
          <th style="width:110px">Date</th>
          <th style="width:80px">Tasks</th>
          <th style="width:90px">Progress</th>
          <th style="width:75px">Planned h</th>
          <th style="width:75px">Executed h</th>
          <th style="width:60px">Δ</th>
          <th style="width:90px">Status</th>
        </tr></thead>
        <tbody>${(()=>{
          const _fmtD=idx=>idx?sd(idx):'—';
          const rptMs=_rpProjId
            ? MILESTONES.filter(m=>m.projId===_rpProjId||(m.taskIds||[]).some(id=>rptTasks.find(t=>t.id===id)))
            : MILESTONES;
          if(!rptMs.length) return '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--fg3)">No milestones found</td></tr>';
          return rptMs.sort((a,b)=>(a.dayIdx||0)-(b.dayIdx||0)).map(m=>{
            const mTasks=(m.taskIds||[]).map(id=>TASKS.find(t=>t.id===id)).filter(Boolean);
            const total=mTasks.length;
            const done=mTasks.filter(t=>t.status==='done'||t.status==='ready').length;
            const pct=total?Math.round(done/total*100):0;
            const ph=mTasks.reduce((s,t)=>s+tHours(t),0);
            const ah=mTasks.reduce((s,t)=>s+logH(t),0);
            const diff=ah-ph;
            const isPast=m.dayIdx&&m.dayIdx<GANTT_TODAY;
            const isToday=m.dayIdx===GANTT_TODAY;
            const overdue=isPast&&pct<100;
            let statusLabel,statusClass;
            if(pct===100){statusLabel='Done';statusClass='b-done';}
            else if(overdue){statusLabel='Overdue';statusClass='b-overdue';}
            else if(isPast){statusLabel='Delayed';statusClass='b-hold';}
            else if(isToday){statusLabel='Today';statusClass='b-doing';}
            else{statusLabel='Upcoming';statusClass='b-todo';}
            const _col=m.color||'var(--acc2)';
            const _dColor=overdue?'var(--danger)':'var(--fg2)';
            const _barBg=pct===100?'var(--ok)':overdue?'var(--danger)':'var(--acc)';
            const _diffColor=diff>0?'var(--danger)':diff<0?'var(--ok)':'var(--fg2)';
            const _diffStr=(diff>0?'+':'')+diff+'h';
            const snapMs=snap?(snap.milestones||[]).find(sm=>sm.id===m.id):null;
            const snapDoneDelta=snapMs!==null&&snapMs!==undefined?_deltaSpan(done,snapMs.done,''):'';
            const snapPctDelta=snapMs!==null&&snapMs!==undefined?_deltaSpan(pct,snapMs.total?Math.round(snapMs.done/snapMs.total*100):0,'%'):'';
            return '<tr>'
              +'<td style="font-size:11px;color:var(--fg0);max-width:200px">'
              +'<div style="display:flex;align-items:center;gap:7px">'
              +'<span style="width:9px;height:9px;background:'+_col+';transform:rotate(45deg);border-radius:1px;flex-shrink:0;display:inline-block"></span>'
              +'<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+m.name+'">'+m.name+'</span>'
              +'</div></td>'
              +'<td style="font-size:10px;color:'+_dColor+'">'+_fmtD(m.dayIdx)+'</td>'
              +'<td style="font-size:10px;color:var(--fg2)">'+done+'/'+total+snapDoneDelta+'</td>'
              +'<td><div style="display:flex;align-items:center;gap:6px">'
              +'<div style="flex:1;background:var(--bg3);border-radius:3px;height:5px;min-width:40px">'
              +'<div style="width:'+pct+'%;height:5px;background:'+_barBg+';border-radius:3px;transition:width .3s"></div>'
              +'</div>'
              +'<span style="font-size:9px;font-family:var(--mono);color:var(--fg2);flex-shrink:0">'+pct+'%'+snapPctDelta+'</span>'
              +'</div></td>'
              +'<td class="mono txs">'+ph+'h</td>'
              +'<td class="mono txs">'+_fmtHours(ah)+'</td>'
              +'<td class="mono txs" style="color:'+_diffColor+'">'+_diffStr+'</td>'
              +'<td><span class="badge '+statusClass+'">'+statusLabel+'</span></td>'
              +'</tr>';
          }).join('');
        })()}
        </tbody>
      </table>
    </div></div>`;

  setTimeout(()=>{
    const _GRP_ORDER=['REQUISITOS E ESPECIFICAÇÃO','PROTÓTIPO','VALIDAÇÃO','HANDOVER','AVALIAÇÃO DE RISCOS TÉCNICOS','PROJETO'];
    const _GRP_SHORT={'REQUISITOS E ESPECIFICAÇÃO':'REQ','PROTÓTIPO':'PROT','VALIDAÇÃO':'VAL','HANDOVER':'DEL','AVALIAÇÃO DE RISCOS TÉCNICOS':'RIS','PROJETO':'PROJ'};
    const _grpLabels=_GRP_ORDER.slice(); // use full names on chart axis

    if(S.charts['rp-t'])S.charts['rp-t'].destroy();
    const _teamDatasets=[{label:'Planned',data:TEAMS.map(tm=>rptTasks.filter(t=>resInTeam(t.resId,tm.id)).reduce((s,t)=>s+tHours(t),0)),backgroundColor:'rgba(79,156,249,.55)',borderColor:'rgba(79,156,249,.9)',borderWidth:1,borderRadius:4},{label:'Executed',data:TEAMS.map(tm=>rptTasks.filter(t=>resInTeam(t.resId,tm.id)).reduce((s,t)=>s+logH(t),0)),backgroundColor:'rgba(0,201,160,.55)',borderColor:'rgba(0,201,160,.9)',borderWidth:1,borderRadius:4}];
    if(snap){
      _teamDatasets.push({label:'Snap Planned',data:TEAMS.map(tm=>rptTasks.filter(t=>resInTeam(t.resId,tm.id)).reduce((s,t)=>s+(snap.groups?0:0),0)),backgroundColor:'rgba(79,156,249,.15)',borderColor:'rgba(79,156,249,.4)',borderWidth:1,borderRadius:4,borderDash:[4,2]});
    }
    S.charts['rp-t']=new Chart(document.getElementById('rp-t'),{type:'bar',data:{labels:TEAMS.map(t=>t.name),datasets:_teamDatasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'top',labels:{color:'#b0bcda',font:{size:10},boxWidth:12,padding:12}}},scales:{x:{grid:{color:'rgba(37,47,69,.3)'},ticks:{color:'#6e7e9e',font:{size:10}}},y:{grid:{color:'rgba(37,47,69,.3)'},ticks:{color:'#6e7e9e',callback:v=>v+'h'}}}}});

    if(S.charts['rp-g'])S.charts['rp-g'].destroy();
    const _grpDatasets=[
      {label:'Planned',data:_GRP_ORDER.map(g=>rptTasks.filter(t=>t.group===g).reduce((s,t)=>s+tHours(t),0)),backgroundColor:'rgba(79,156,249,.55)',borderColor:'rgba(79,156,249,.9)',borderWidth:1,borderRadius:4},
      {label:'Executed',data:_GRP_ORDER.map(g=>rptTasks.filter(t=>t.group===g).reduce((s,t)=>s+logH(t),0)),backgroundColor:'rgba(0,201,160,.55)',borderColor:'rgba(0,201,160,.9)',borderWidth:1,borderRadius:4}
    ];
    if(snap&&snap.groups){
      _grpDatasets.push({label:'Snap Planned',data:_GRP_ORDER.map(g=>snap.groups[_GRP_SHORT[g]]?.planned||0),backgroundColor:'rgba(79,156,249,.18)',borderColor:'rgba(79,156,249,.45)',borderWidth:1,borderRadius:4});
      _grpDatasets.push({label:'Snap Executed',data:_GRP_ORDER.map(g=>snap.groups[_GRP_SHORT[g]]?.executed||0),backgroundColor:'rgba(0,201,160,.18)',borderColor:'rgba(0,201,160,.45)',borderWidth:1,borderRadius:4});
    }
    S.charts['rp-g']=new Chart(document.getElementById('rp-g'),{type:'bar',data:{labels:_grpLabels,datasets:_grpDatasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'top',labels:{color:'#b0bcda',font:{size:10},boxWidth:12,padding:12}}},scales:{x:{grid:{color:'rgba(37,47,69,.3)'},ticks:{color:'#6e7e9e',font:{size:9},maxRotation:30,minRotation:0}},y:{grid:{color:'rgba(37,47,69,.3)'},ticks:{color:'#6e7e9e',callback:v=>v+'h'}}}}});

    // Tasks by group — status breakdown
    const _GRP_STATUSES=['todo','doing','paused','hold','done','cancelled'];
    const _STAT_COLS={'todo':'#3e4f6a','doing':'#4f9cf9','paused':'#4f9cf9','hold':'#f0a928','done':'#22c55e','cancelled':'#f05252'};
    const _STAT_LABELS_SHORT={'todo':'To do','doing':'Doing','paused':'Paused','hold':'Hold','done':'Done','cancelled':'Cancel.'};
    const _gsWrap=document.getElementById('rp-gs-wrap');
    if(_gsWrap){
      let html='<div style="display:flex;flex-direction:column;gap:10px">';
      html+='<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:4px">';
      _GRP_STATUSES.forEach(s=>{ html+='<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:var(--fg2)"><span style="width:8px;height:8px;border-radius:2px;background:'+_STAT_COLS[s]+';flex-shrink:0"></span>'+_STAT_LABELS_SHORT[s]+'</span>'; });
      html+='</div>';
      _GRP_ORDER.forEach(g=>{
        const gTasks=rptTasks.filter(t=>t.group===g);
        const total=gTasks.length;
        if(!total) return;
        const counts={};
        _GRP_STATUSES.forEach(s=>{ counts[s]=gTasks.filter(t=>t.status===s).length; });
        const donePct=Math.round((counts.done||0)/total*100);
        const snapG=snap&&snap.groups?snap.groups[_GRP_SHORT[g]||g]:null;
        const snapDonePct=snapG&&snapG.total?Math.round((snapG.statuses?.done||0)/snapG.total*100):null;
        const deltaDone=snapDonePct!==null?donePct-snapDonePct:null;
        const deltaCol=deltaDone===null?'':deltaDone>0?'var(--ok)':deltaDone<0?'var(--danger)':'var(--fg3)';
        const deltaStr=deltaDone===null?'':(deltaDone>0?'+':'')+deltaDone+'%';
        html+='<div style="display:flex;align-items:center;gap:10px">';
        html+='<div style="width:44px;flex-shrink:0;font-size:9px;font-weight:700;font-family:var(--mono);color:var(--fg2);text-align:right">'+(_GRP_SHORT[g]||g)+'</div>';
        html+='<div style="flex:1;display:flex;flex-direction:column;gap:3px">';
        // Current bar
        html+='<div style="display:flex;height:14px;border-radius:3px;overflow:hidden;background:var(--bg3)">';
        _GRP_STATUSES.forEach(s=>{ const pct=total?Math.round(counts[s]/total*100):0; if(!pct) return; html+='<div style="width:'+pct+'%;background:'+_STAT_COLS[s]+';height:100%" title="'+_STAT_LABELS_SHORT[s]+': '+counts[s]+' ('+pct+'%)"></div>'; });
        html+='</div>';
        // Snapshot bar (if available)
        if(snapG&&snapG.total){
          html+='<div style="display:flex;height:6px;border-radius:2px;overflow:hidden;background:var(--bg3);opacity:.5" title="Snapshot">';
          _GRP_STATUSES.forEach(s=>{ const pct=Math.round((snapG.statuses?.[s]||0)/snapG.total*100); if(!pct) return; html+='<div style="width:'+pct+'%;background:'+_STAT_COLS[s]+';height:100%"></div>'; });
          html+='</div>';
        }
        html+='</div>';
        html+='<div style="display:flex;gap:4px;flex-shrink:0;min-width:120px;flex-wrap:wrap;align-items:center">';
        _GRP_STATUSES.forEach(s=>{ if(!counts[s]) return; const pct=Math.round(counts[s]/total*100); html+='<span style="font-size:9px;font-family:var(--mono);color:'+_STAT_COLS[s]+'" title="'+_STAT_LABELS_SHORT[s]+'">'+pct+'%</span>'; });
        html+='</div>';
        html+='<div style="font-size:9px;color:var(--fg3);flex-shrink:0;width:36px;text-align:right">'+total+'</div>';
        if(deltaStr) html+='<div style="font-size:9px;font-weight:700;color:'+deltaCol+';flex-shrink:0;width:36px" title="Done % change vs snapshot">'+deltaStr+'</div>';
        html+='</div>';
      });
      html+='</div>';
      _gsWrap.innerHTML=html;
    }
  },40);
}



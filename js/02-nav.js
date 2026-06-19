// ============================================================
// NAVIGATION
// ============================================================
document.querySelectorAll('.nav').forEach(el=>el.addEventListener('click',()=>nav(el.dataset.page)));
function nav(p){
  if(p!=='gantt' && typeof clearSelTasks==='function') clearSelTasks();
  S.page=p;
  document.querySelectorAll('.nav').forEach(el=>el.classList.toggle('on',el.dataset.page===p));
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('on'));
  const pg=document.getElementById(`page-${p}`);
  if(pg) pg.classList.add('on');
  if(S_USER) _saveSessionState();
  const names={dashboard:'Dashboard',gantt:'Dynamic Gantt',projects:'Projects',resources:'Resources',teams:'Teams',myspace:'My Space',howto:'How to Use',production:'Production',logs:'Activity Logs',overview:'Overview',report:'Project Report'};
  document.getElementById('tb-pn').textContent=names[p]||p;
  if(p==='dashboard')  renderDash();
  if(p==='gantt')      { buildSFChips(); buildTagPanel(); renderGantt(); }
  if(p==='projects')   renderProjects();
  if(p==='resources')  renderRes();
  if(p==='teams')      renderTeams();
  if(p==='myspace')    renderMySpace();
  if(p==='howto')      renderHowTo();
  if(p==='settings')   renderSettings();
  if(p==='production') renderProduction();
  if(p==='logs')       renderLogsPage();
  if(p==='overview')   renderOverview();
  if(p==='report')     renderReport();
}
function _refreshOverview(){ if(S.page==='overview') setTimeout(renderOverview,0); }

// ============================================================
// COMBOBOX HELPER
// ============================================================
function openCB(cbId, hidId, items, filterVal=''){
  const cb=document.getElementById(cbId);
  const list=document.getElementById(cbId+'-list');
  if(!cb||!list) return;
  cb.classList.add('open');
  const fv=(filterVal||'').toLowerCase();
  const filtered=items.filter(i=>i.label.toLowerCase().includes(fv)).slice(0,30);
  list.innerHTML=filtered.map(i=>`<div class="csi" onmousedown="pickCB('${cbId}','${hidId}','${i.id.replace(/'/g,"\\'")}',${JSON.stringify(i.label)})">${i.label}</div>`).join('')
    || '<div class="csi" style="color:var(--fg3)">No results</div>';
}
function filterCB(cbId, hidId, items, val){
  openCB(cbId, hidId, items, val);
}
function closeCB(cbId){ document.getElementById(cbId)?.classList.remove('open'); }
function pickCB(cbId, hidId, id, label){
  document.getElementById(cbId+'-list') && closeCB(cbId);
  const inp=document.querySelector(`#${cbId} .csb-i`);
  if(inp) inp.value=label;
  const hid=document.getElementById(hidId);
  if(hid) hid.value=id;
  // Auto-set team dropdown when a resource is picked in the task modal
  if(hidId==='mt-res-id'){
    const r=getRes(id);
    if(r&&r.teams&&r.teams.length){
      const teamSel=document.getElementById('mt-team');
      if(teamSel&&!teamSel.value) teamSel.value=r.teams[0];
    }
  }
}
window.closeLTCB=()=>closeCB('lt-cb');

// ============================================================
// TAG MULTI-SELECT
// ============================================================
function allTags(){ return [...new Set(TASKS.flatMap(t=>t.tags||[]).filter(Boolean))].sort(); }
function buildTagPanel(){
  const tags=allTags();
  document.getElementById('tag-panel').innerHTML = tags.map(t=>`
    <label class="tag-opt"><input type="checkbox" value="${t}" ${S.selectedTags.includes(t)?'checked':''} onchange="toggleTag('${t}')">
    <span style="width:7px;height:7px;border-radius:2px;background:${tagCol(t)};flex-shrink:0"></span>${t}</label>`).join('');
  const c=S.selectedTags.length;
  document.getElementById('tag-sel-c').textContent=c?`(${c} selected)`:'(all)';
}
function toggleTag(t){
  if(S.selectedTags.includes(t)) S.selectedTags=S.selectedTags.filter(x=>x!==t);
  else S.selectedTags.push(t);
  buildTagPanel();
  renderGantt();
}
// Close tag dropdown on outside click
document.addEventListener('click',e=>{
  if(!document.getElementById('tag-dd').contains(e.target)) document.getElementById('tag-dd').classList.remove('open');
});

// ============================================================
// STATUS FILTER CHIPS
// ============================================================
function buildSFChips(){
  const el=document.getElementById('sf-chips');
  el.innerHTML=['todo','doing','paused','ready','done','hold','cancelled'].map(s=>`
    <span class="fc ${S.statusFilter.includes(s)?'on':''}" onclick="toggleSF('${s}')">
      <span style="width:5px;height:5px;border-radius:50%;background:${SCOLS[s]}"></span>${SLABELS[s]}
    </span>`).join('')+`
  <span class="fc ${S.filterUnassigned?'on':''}" onclick="toggleUnassignedFilter()" title="Show only tasks/subtasks without a resource assigned">
    <span style="width:5px;height:5px;border-radius:50%;border:1px solid var(--fg3);background:transparent;display:inline-block"></span>Unassigned
  </span>`;
}
function toggleSF(s){
  if(S.statusFilter.includes(s)) S.statusFilter=S.statusFilter.filter(x=>x!==s);
  else S.statusFilter.push(s);
  buildSFChips(); renderGantt();
}
window.toggleUnassignedFilter=()=>{
  S.filterUnassigned=!S.filterUnassigned;
  buildSFChips(); renderGantt();
};

// ============================================================
// VIEW BY PANEL (multi-select teams/resources/projects)
// ============================================================
function setVB(v,el){
  S.viewBy=v; S.vbFilter=[];
  document.querySelectorAll('#vb-pr,#vb-tm,#vb-rs').forEach(x=>x.classList.remove('on'));
  el.classList.add('on');
  // Always show Select panel
  document.getElementById('vb-sel-wrap').style.display='';
  document.getElementById('vb-sel-panel').style.display='none';
  renderGantt();
}
// ── Gantt Task column resize ─────────────────────────────────
(function(){
  let _resizing=false, _startX=0, _startW=0;
  let _stnW=parseInt(localStorage.getItem('stn_width')||'240');

  window._applyStnW=function(w){
    _stnW=Math.max(120,Math.min(600,w));
    const css=`.stn{width:${_stnW}px!important;min-width:${_stnW}px!important;max-width:${_stnW}px!important}.sto{left:${_stnW}px!important}.sth{left:${_stnW+36}px!important}`;
    let st=document.getElementById('stn-width-style');
    if(!st){st=document.createElement('style');st.id='stn-width-style';document.head.appendChild(st);}
    st.textContent=css;
  };
  function _applyStnWidth(w){
    _stnW=Math.max(120,Math.min(600,w));
    const css=`.stn{width:${_stnW}px!important;min-width:${_stnW}px!important;max-width:${_stnW}px!important}
    .sto{left:${_stnW}px!important}.sth{left:${_stnW+36}px!important}`;
    let st=document.getElementById('stn-width-style');
    if(!st){st=document.createElement('style');st.id='stn-width-style';document.head.appendChild(st);}
    st.textContent=css;
  }

  // Fixed overlay handle that sits on top of everything
  function _ensureHandle(){
    let handle=document.getElementById('stn-col-handle');
    if(!handle){
      handle=document.createElement('div');
      handle.id='stn-col-handle';
      handle.style.cssText='position:fixed;width:8px;background:transparent;cursor:col-resize;z-index:9999;top:0;bottom:0;transition:background .15s';
      handle.title='Drag to resize Task column';
      handle.addEventListener('mouseenter',()=>{handle.style.background='rgba(79,156,249,.5)';});
      handle.addEventListener('mouseleave',()=>{ if(!_resizing) handle.style.background='transparent'; });
      handle.addEventListener('mousedown',e=>{
        e.preventDefault();
        _resizing=true;
        _startX=e.clientX;
        _startW=_stnW;
        handle.style.background='rgba(79,156,249,.8)';
        document.body.style.cursor='col-resize';
        document.body.style.userSelect='none';
      });
      document.body.appendChild(handle);
    }
    // Position handle at right edge of .stn column
    const stn=document.querySelector('td.stn,th.stn');
    if(stn){
      const r=stn.getBoundingClientRect();
      handle.style.left=(r.right-4)+'px';
      handle.style.display='';
    }
    return handle;
  }

  document.addEventListener('mousemove',e=>{
    if(_resizing){
      const dx=e.clientX-_startX;
      _applyStnWidth(_startW+dx);
      _ensureHandle();
    }
  },{passive:true});

  document.addEventListener('mouseup',()=>{
    if(!_resizing) return;
    _resizing=false;
    const h=document.getElementById('stn-col-handle');
    if(h) h.style.background='transparent';
    document.body.style.cursor='';
    document.body.style.userSelect='';
    // width is session-only, no persistence
  });

  function _initResize(){
    // Width is session-only, resets to 240px on each login
    _ensureHandle();
    // Reposition on scroll
    const gw=document.getElementById('gw-scroll');
    if(gw) gw.addEventListener('scroll',_ensureHandle,{passive:true});
    const c=document.getElementById('content');
    if(c) c.addEventListener('scroll',_ensureHandle,{passive:true});
  }

  window._syncGanttThead=()=>{ setTimeout(_ensureHandle,50); };

  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(_initResize,500);
    const _origRG=window.renderGantt;
    window.renderGantt=function(){
      _origRG&&_origRG();
      setTimeout(_ensureHandle,100);
    };
  });
})();

// Position dep-tip tooltips on hover
document.addEventListener('mouseover',function(e){
  const wrap=e.target.closest('.dep-chain-wrap');
  if(!wrap) return;
  const tip=wrap.querySelector('.dep-tip');
  if(!tip) return;
  const r=wrap.getBoundingClientRect();
  tip.style.left=r.left+'px';
  tip.style.top=(r.top-4)+'px';
  tip.style.transform='translateY(-100%)';
});
window._onVBSearch=function(v){
  const el=document.getElementById('vb-list');
  if(el) el.innerHTML=window._renderVBItems(v);
};
function toggleVBPanel(){
  // Project view uses the project selector button — no filter panel needed
  if(S.viewBy==='project'){
    notify('Use the project selector (top bar) to filter by project','info');
    return;
  }
  const p=document.getElementById('vb-sel-panel');
  if(p.style.display==='none'||!p.style.display){
    p.style.display='block';
    let items;
    if(S.viewBy==='team'){
      items=TEAMS.map(t=>({id:t.id,label:t.name,col:t.color}));
    } else {
      items=RESOURCES.map(r=>({id:r.id,label:r.name,col:resTeamColor(r.id)}));
    }
    const _vbAllChecked=(i)=>(S.vbFilter.length===0||S.vbFilter.includes(i.id))&&!S.vbFilter.includes('__none__');
    const _getVBInitials=name=>name.split(' ').map(w=>w[0]||'').join('').toUpperCase();
    const _renderVBItems=(filter)=>{
      const ql=(filter||'').toLowerCase();
      let filtered;
      if(!ql){ filtered=items; }
      else {
        const byInitials=items.filter(i=>_getVBInitials(i.label).toLowerCase().startsWith(ql));
        const byName=items.filter(i=>!byInitials.includes(i)&&i.label.toLowerCase().includes(ql));
        filtered=[...byInitials,...byName];
      }
      return filtered.map(i=>{
        const initials=i.label.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        return `<label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:12px;color:var(--fg0);transition:background .1s" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='transparent'">
          <input type="checkbox" value="${i.id}" ${_vbAllChecked(i)?'checked':''} onchange="toggleVBF('${i.id}',this.checked)" style="accent-color:${i.col};width:14px;height:14px;flex-shrink:0">
          <span style="width:24px;height:24px;border-radius:6px;background:${i.col};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0">${initials}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${i.label}</span>
        </label>`;
      }).join('') || '<div style="padding:8px;font-size:11px;color:var(--fg3);text-align:center">No results</div>';
    };
    p.innerHTML=
      '<div style="padding:6px 8px 4px;border-bottom:1px solid var(--bd2)">'
      +'<input id="vb-search" type="text" placeholder="Search..." autocomplete="off" '
      +'style="width:100%;box-sizing:border-box;background:var(--bg3);border:1px solid var(--bd2);border-radius:6px;padding:5px 8px;font-size:11px;color:var(--fg0);font-family:var(--font);outline:none" '
      +'oninput="window._onVBSearch(this.value)">'
      +'</div>'
      +'<div style="display:flex;gap:6px;padding:5px 8px;border-bottom:1px solid var(--bd2)">'
      +'<button onclick="window._vbSelectAll()" style="flex:1;font-size:10px;padding:3px;border-radius:4px;border:1px solid var(--bd2);background:var(--bg3);color:var(--fg2);cursor:pointer;font-family:var(--font)">✓ All</button>'
      +'<button onclick="deselectAllVB()" style="flex:1;font-size:10px;padding:3px;border-radius:4px;border:1px solid var(--bd2);background:var(--bg3);color:var(--fg2);cursor:pointer;font-family:var(--font)">✕ None</button>'
      +'</div>'
      +'<div id="vb-list" style="padding:4px">'+_renderVBItems('')+'</div>';
    window._renderVBItems=_renderVBItems;
    window._vbSelectAll=()=>{ S.vbFilter=[]; renderGantt(); toggleVBPanel(); toggleVBPanel(); };
    setTimeout(()=>document.getElementById('vb-search')?.focus(),50);
  } else p.style.display='none';
}
function toggleVBF(id, checked){
  // checked=true means user wants this item INCLUDED
  S.vbFilter=S.vbFilter.filter(x=>x!=='__none__'); // strip sentinel
  if(checked){
    if(!S.vbFilter.includes(id)) S.vbFilter.push(id);
    // If all items are now checked, reset to [] (show all = no explicit filter)
    let allItems;
    if(S.viewBy==='resource') allItems=[...new Set(RESOURCES.map(r=>r.id))];
    else if(S.viewBy==='team') allItems=TEAMS.map(t=>t.id);
    else allItems=PROJECTS.map(p=>p.id);
    if(allItems.every(x=>S.vbFilter.includes(x))) S.vbFilter=[];
  } else {
    // Unchecked: if was show-all, init with all except this one
    if(!S.vbFilter.length){
      let allItems2;
      if(S.viewBy==='resource') allItems2=[...new Set(RESOURCES.map(r=>r.id))];
      else if(S.viewBy==='team') allItems2=TEAMS.map(t=>t.id);
      else allItems2=PROJECTS.map(p=>p.id);
      S.vbFilter=allItems2.filter(x=>x!==id);
    } else {
      S.vbFilter=S.vbFilter.filter(x=>x!==id);
    }
    if(!S.vbFilter.length) S.vbFilter=['__none__'];
  }
  renderGantt();
}
document.addEventListener('click',e=>{
  const w=document.getElementById('vb-sel-wrap');
  if(w&&!w.contains(e.target)) document.getElementById('vb-sel-panel').style.display='none';
});


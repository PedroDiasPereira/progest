// INIT
// ============================================================
(async function(){
  // Load data first (needed to populate login dropdown)
  let restored = await fbLoad();
  if(!restored) restored = loadLocal();
  flattenSubtasksToTasks(); // one-time migration: promote subtasks to TASKS[]
  startSSE();
  if(restored) setSyncStatus('● live');
  S.offset=GANTT_TODAY-1;

  // BLOCK until user logs in — nothing renders before this
  await initLogin();

  // Now render app
  // Clear any stuck __none__ sentinel from sessionStorage
  try{ const _sk='pg_ui_'+(S_USER?.resId||''); const _ss=sessionStorage.getItem(_sk); if(_ss){ const _sd=JSON.parse(_ss); if(_sd.vbFilter?.includes('__none__')){ _sd.vbFilter=[]; sessionStorage.setItem(_sk,JSON.stringify(_sd)); S.vbFilter=[]; } } }catch(e){}
  buildSFChips(); buildTagPanel(); buildTagSel();
  loadReportSnapshots();
  // Load _isAdmin for all resources from Firebase auth records
  await Promise.all(RESOURCES.map(async r=>{
    const auth=await loadAuth(r.id).catch(()=>null);
    if(auth){ r._isAdmin=auth.isAdmin===true; _adminMap.set(r.id,auth.isAdmin===true); }
  }));

  // Show Resources/Teams/Logs only for admins
  // Apply saved task column width
  // Task column width resets to 240px on each login (session-only)
  if(isAdmin()){
    const _nr=document.getElementById('nav-resources');
    const _nt=document.getElementById('nav-teams');
    const _ns=document.getElementById('nav-settings');
    if(_nr) _nr.style.display='flex';
    if(_nt) _nt.style.display='flex';
    if(_ns) _ns.style.display='flex';
    const _nst=document.getElementById('sb-sec-team'); if(_nst){ _nst.style.display='block'; }
    // nav-logs is visible to all users (read-only)
  }
  // Mobile starts on My Space, desktop on Dashboard
  if(window.innerWidth<=768){ nav('myspace'); } else { nav('dashboard'); renderDash(); }
  setInterval(()=>persistState(['meta']),30000);
  _loadTimerState();
  // Fix: any task in 'doing' without an active timer session → set to 'paused'
  TASKS.forEach(t=>{
    if(t.status==='doing' && _timerState.taskId!==t.id){
      t.status='paused';
    }
  });
  if(_timerState.taskId&&!_timerState.paused) _startTimerTick();
  // Mobile banner: update every second
  setInterval(()=>{
    updateTimerToggle();
    if(window.innerWidth>768) return;
    const tid=_timerState?.taskId;
    if(!tid||_timerState.paused) return;
    const t=TASKS.find(x=>x.id===tid); if(!t) return;
    const totalH=_totalLoggedH(t)+_sessionElapsedMs()/3600000;
    const mobT=document.getElementById('mob-timer');
    if(mobT) mobT.textContent=_fmtMs(Math.round(totalH*3600000));
  },1000);
  updateMobBanner();
  updateTimerToggle();
})();
</script>

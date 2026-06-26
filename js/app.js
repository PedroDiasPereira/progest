// ============================================================
// VERSION — increment APP_VERSION on every release to confirm
// which build is loaded in the browser.
// ============================================================
const APP_VERSION = '0.6.376';

// ============================================================
// DATA
// ============================================================
const GANTT_ORIGIN = new Date(2026,3,1); // April 1 2026
const GANTT_TODAY  = Math.round((new Date(new Date().toDateString())-GANTT_ORIGIN)/86400000)+1;
const STORE_KEY    = 'progest_pazzi_v1';

const PT_HOL = [{m:1,d:1},{m:4,d:10},{m:4,d:12},{m:4,d:25},{m:5,d:1},{m:6,d:10},{m:6,d:24},{m:8,d:15},{m:10,d:5},{m:11,d:1},{m:12,d:1},{m:12,d:8},{m:12,d:25}]; // m:6,d:24 = Municipal holiday (24 Jun)
const ENB_DAYS = new Set();   // globally enabled non-working days
const DIS_DAYS = new Set();
let COLLECTIVE_HOLIDAYS = []; // [{start:'2026-08-01',end:'2026-08-15',name:'Summer holidays'}]
let PT_HOL_CUSTOM = []; // [{m,d,name,type}] — overrides/additions to PT_HOL, persisted in meta

function _applyCollectiveHolidays(){
  // Add all collective holiday days to DIS_DAYS
  (COLLECTIVE_HOLIDAYS||[]).forEach(ch=>{
    if(!ch.start||!ch.end) return;
    const s=dateToIdx(ch.start), e=dateToIdx(ch.end);
    if(!s||!e) return;
    for(let d=s;d<=e;d++) DIS_DAYS.add(String(d));
  });
}   // globally disabled working days
// Per-task overrides: Map<taskId, {enabled:Set, disabled:Set}>
const TASK_DAYS = new Map();
// Per-resource overrides: Map<resId, {enabled:Set, disabled:Set}>
const RES_DAYS = new Map();

function gDate(idx){ const d=new Date(GANTT_ORIGIN); d.setDate(d.getDate()+idx-1); return d; }
function isHol(d){
  const m=d.getMonth()+1, day=d.getDate();
  const override=PT_HOL_CUSTOM.find(h=>h.m===m&&h.d===day);
  if(override) return override.type!=='deleted';
  return PT_HOL.some(h=>h.m===m&&h.d===day);
}
function isWE(d){ return d.getDay()===0||d.getDay()===6; }
function isNW(idx, taskId=null, resId=null){
  const key=String(idx);
  // Task-level override (highest priority)
  if(taskId && TASK_DAYS.has(taskId)){
    const td=TASK_DAYS.get(taskId);
    if(td.enabled && td.enabled.has(key)) return false;  // forced working
    if(td.disabled && td.disabled.has(key)) return true; // forced non-working
  }
  // Resource-level override
  if(resId && RES_DAYS.has(resId)){
    const rd=RES_DAYS.get(resId);
    if(rd.enabled && rd.enabled.has(key)) return false;
    if(rd.disabled && rd.disabled.has(key)) return true;
  }
  // Global overrides
  if(ENB_DAYS.has(key)) return false;  // globally enabled
  if(DIS_DAYS.has(key)) return true;   // globally disabled
  // Default calendar
  const d=gDate(idx);
  return isWE(d)||isHol(d);
}
function isLocked(idx){ return idx < GANTT_TODAY; }
const DN=['Su','Mo','Tu','We','Th','Fr','Sa'];
const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function sd(idx){ const d=gDate(idx); return `${MN[d.getMonth()]} ${d.getDate()}`; }
function dateToIdx(s){
  if(!s) return null;
  try{ const[y,m,d]=s.split('-').map(Number); const t=new Date(y,m-1,d); return Math.round((t-GANTT_ORIGIN)/86400000)+1; }
  catch{ return null; }
}
function idxToDate(idx){ const d=gDate(idx); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; } //orig-padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

// Project config
let PROJ = { name:'PAZZI', deadline: null };

// Projects list
let MILESTONES = []; // {id,name,dayIdx,color,taskIds[]}
let _msFilter=null; // active milestone filter id

let PROJECTS = [
  {id:'pazzi', name:'PAZZI', desc:'Main PAZZI project', color:'#4f9cf9', status:'active', start:'2026-04-01', deadline:null, order:'', tags:['DRI','LAV','ROB','CFP','UST','DAC','General','Middleware','Click and Collect','PRP']},
];

// Teams
let TEAMS = [
  {id:'mechanics',  name:'Mechanics',         color:'#00c9a0', desc:'Mechanical design & assembly'},
  {id:'software',   name:'Software',           color:'#6366f1', desc:'Embedded & application software'},
  {id:'automation', name:'Automation',         color:'#ec4899', desc:'PLC, automation & control'},
  {id:'robotics',   name:'Robotics',           color:'#22c55e', desc:'Robotics & motion'},
  {id:'afterSales', name:'After-Sales',        color:'#f0a928', desc:'After-sales & support'},
  {id:'projMgmt',   name:'Project Management', color:'#4f9cf9', desc:'Project management'},
  {id:'prodMgmt',   name:'Product Management', color:'#7b61ff', desc:'Product management'},
];

// Resources — teams is now an array (multi-team support)
let RESOURCES = [
  {id:'pp', name:'Pedro Pereira',   initials:'PP', avClass:'av-b', teams:['mechanics','projMgmt'],   role:'Project Manager',       dailyCap:8},
  {id:'ab', name:'António Barbosa', initials:'AB', avClass:'av-p', teams:['projMgmt','afterSales'],  role:'PM / After-Sales',      dailyCap:8},
  {id:'rf', name:'Rafael Freitas',  initials:'RF', avClass:'av-t', teams:['robotics'],               role:'Robotics Engineer',     dailyCap:8},
  {id:'mq', name:'Mauro Queirós',   initials:'MQ', avClass:'av-a', teams:['afterSales','robotics'],  role:'After-Sales Specialist',dailyCap:8},
  {id:'jm', name:'José Matos',      initials:'JM', avClass:'av-c', teams:['software'],               role:'Software Engineer',     dailyCap:8},
  {id:'mc', name:'Marcos Costa',    initials:'MC', avClass:'av-k', teams:['automation'],             role:'Automation Engineer',   dailyCap:8},
  {id:'sd', name:'Sara Dias',       initials:'SD', avClass:'av-g', teams:['software'],               role:'Software Engineer',     dailyCap:8},
  {id:'ja', name:'Joana Alves',     initials:'JA', avClass:'av-o', teams:['software'],               role:'Software Engineer',     dailyCap:8},
];

function getRes(id){ return RESOURCES.find(r=>r.id===id); }
function getTeam(id){ return TEAMS.find(t=>t.id===id); }

// Tag → color
const TAG_COL={
  'ROB':'#22c55e','LAV':'#00c9a0','CFP':'#ec4899','DRI':'#4f9cf9','UST':'#f0a928',
  'ZFR':'#7b61ff','SSC':'#6366f1','PRP':'#f05252','GERAL':'#4f9cf9','General':'#4f9cf9',
  'general':'#4f9cf9','dashboard':'#7b61ff','Documentation':'#00c9a0','VMA':'#f0a928',
  'Click and Collect':'#f05252','DRI / Cleaning':'#4f9cf9',
};
function tagCol(tag){ return TAG_COL[tag]||TAG_COL[(tag||'').toUpperCase()]||'#7a8aaa'; }

function resTeamColor(resId){
  const r=getRes(resId);
  if(!r||!r.teams||!r.teams.length) return '#7a8aaa';
  const t=getTeam(r.teams[0]);
  return t?t.color:'#7a8aaa';
}

// Helper: Excel serial date → GANTT_ORIGIN-relative index
function xlDateToIdx(serial){ if(!serial||isNaN(serial)) return null; const d=new Date((serial-25569)*86400000); const diff=Math.round((d-GANTT_ORIGIN)/86400000)+1; return diff>=1?diff:null; }

// TASKS — loaded from Excel (43 tasks)
let TASKS = [
  {id:'t001',name:'Assess the need to glue bolted elements to containers',tags:['DRI'],teamId:'mechanics',resId:'pp',resource:'Pedro Pereira',status:'todo',timeMode:'total',hours:1,hpd:null,start:xlDateToIdx(46127),dur:1,prog:0,deadline:'2026-04-15',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t002',name:'Replace knives',tags:['UST'],teamId:'robotics',resId:'mq',resource:'Mauro Queirós',status:'todo',timeMode:'total',hours:1,hpd:null,start:xlDateToIdx(46128),dur:1,prog:0,deadline:'2026-04-16',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t003',name:'Validate points',tags:['LAV'],teamId:'robotics',resId:'mq',resource:'Mauro Queirós',status:'todo',timeMode:'total',hours:8,hpd:null,start:xlDateToIdx(46128),dur:1,prog:0,deadline:'2026-04-16',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t004',name:'Test dance cycles',tags:['ROB'],teamId:'robotics',resId:'mq',resource:'Mauro Queirós',status:'todo',timeMode:'total',hours:8,hpd:null,start:xlDateToIdx(46128),dur:2,prog:0,deadline:'2026-04-17',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t005',name:'Validate wait commands',tags:['ROB'],teamId:'robotics',resId:'rf',resource:'Rafael Freitas',status:'todo',timeMode:'total',hours:1,hpd:null,start:xlDateToIdx(46129),dur:1,prog:0,deadline:'2026-04-17',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t006',name:'Validate cleaning and maintenance software',tags:['General'],teamId:'projMgmt',resId:'ab',resource:'António Barbosa',status:'todo',timeMode:'total',hours:8,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t007',name:'Fix small CFP shovel fitting',tags:['CFP'],teamId:'mechanics',resId:'pp',resource:'Pedro Pereira',status:'todo',timeMode:'total',hours:8,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t008',name:'Bearing problem',tags:['CFP'],teamId:'mechanics',resId:'pp',resource:'Pedro Pereira',status:'todo',timeMode:'total',hours:16,hpd:null,start:null,dur:2,prog:0,deadline:'2026-04-24',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t009',name:'Sauces accessories',tags:['CFP'],teamId:'mechanics',resId:'pp',resource:'Pedro Pereira',status:'todo',timeMode:'total',hours:16,hpd:null,start:null,dur:2,prog:0,deadline:'2026-04-24',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t010',name:'Launch into production and ship CFP sauce parts kit',tags:['CFP'],teamId:'mechanics',resId:'pp',resource:'Pedro Pereira',status:'todo',timeMode:'total',hours:2,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t011',name:'Send fine forks',tags:['UST'],teamId:'mechanics',resId:'pp',resource:'Pedro Pereira',status:'todo',timeMode:'total',hours:8,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t012',name:'Review General document',tags:['General'],teamId:'projMgmt',resId:'pp',resource:'Pedro Pereira',status:'todo',timeMode:'total',hours:8,hpd:null,start:xlDateToIdx(46129),dur:1,prog:0,deadline:'2026-04-17',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t013',name:'Software Recover',tags:['General'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:8,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t014',name:'Capsule Maintenance commands',tags:['General'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:1,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t015',name:'Maintenance Jogs tests',tags:['General'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:2,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t016',name:'Maintenance Capsule Unlock/Lock Door testing',tags:['General'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:1,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t017',name:'Capsule Cleaning Program 3',tags:['DAC'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:8,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t018',name:'Maintenance change camera parameters',tags:['PRP'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:6,hpd:null,start:null,dur:1,prog:0,deadline:'2026-04-17',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t019',name:'Washing machine testing',tags:['LAV'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:1,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t020',name:'Implement 2h cycle in 2h (no orders)',tags:['LAV'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:4,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t021',name:'Reset on the general page',tags:['DAC'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:1,hpd:null,start:null,dur:1,prog:0,deadline:'2026-04-17',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t022',name:'Cleaning mode shows emergency in DRI',tags:['DRI','Cleaning'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:2,hpd:null,start:null,dur:1,prog:0,deadline:'2026-04-17',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t023',name:'Check recover positions',tags:['ROB'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:1,hpd:null,start:null,dur:1,prog:0,deadline:'2026-04-17',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t024',name:'Validate wait commands (SW)',tags:['ROB'],teamId:'software',resId:'rf',resource:'Rafael Freitas',status:'todo',timeMode:'total',hours:8,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t025',name:'Stats Inflight (+Endpoint images improve responses)',tags:['General','Middleware'],teamId:'software',resId:'ja',resource:'Joana Alves',status:'todo',timeMode:'total',hours:120,hpd:null,start:xlDateToIdx(46132),dur:15,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t026',name:'Ticket interface',tags:['General','Middleware'],teamId:'software',resId:'ja',resource:'Joana Alves',status:'todo',timeMode:'total',hours:6,hpd:null,start:null,dur:1,prog:0,deadline:'2026-04-17',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t027',name:'Tickets testing',tags:['General','Middleware'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:8,hpd:null,start:null,dur:1,prog:0,deadline:'2026-04-17',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t028',name:'Removing an ingredient',tags:['General','Middleware'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:4,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t029',name:'Check pizza availability',tags:['General','Middleware'],teamId:'software',resId:'ja',resource:'Joana Alves',status:'todo',timeMode:'total',hours:1,hpd:null,start:3,dur:1,prog:0,deadline:'2026-04-17',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t030',name:'Products, location association (tiramisus with errors)',tags:['General','Middleware','VMA'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:1,hpd:null,start:null,dur:1,prog:0,deadline:'2026-04-17',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t031',name:'BO Client Update (third party token)',tags:['General','Middleware'],teamId:'software',resId:'ja',resource:'Joana Alves',status:'todo',timeMode:'total',hours:4,hpd:null,start:1,dur:1,prog:0,deadline:'2026-04-17',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t032',name:'History of updating location on Pazzo BO',tags:['General','Middleware'],teamId:'software',resId:'ja',resource:'Joana Alves',status:'todo',timeMode:'total',hours:4,hpd:null,start:2,dur:1,prog:0,deadline:'2026-04-17',timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t033',name:'Sequences/L2 – define endpoints and enable functionality in middleware',tags:['General','Middleware'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:8,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t034',name:'Bugs and minor improvements',tags:['General','Middleware'],teamId:'software',resId:'ja',resource:'Joana Alves',status:'todo',timeMode:'daily',hours:8,hpd:1,start:null,dur:8,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:'End of project'},
  {id:'t035',name:'Click and collect test',tags:['General','Click and Collect'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:3,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t036',name:'Maintenance General – testing',tags:['General','Dashboards'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:4,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t037',name:'Monitoring – cleaning PRP',tags:['PRP','Dashboards','Monitoring'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:2,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t038',name:'Execute commands – set listing and order',tags:['General'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:8,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t039',name:'More detailed manuals',tags:['General'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:16,hpd:null,start:null,dur:2,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t040',name:'Take photo and check box position',tags:['CPR'],teamId:'software',resId:'rf',resource:'Rafael Freitas',status:'todo',timeMode:'total',hours:8,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t041',name:'On-screen stock management',tags:['General'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:8,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t042',name:'Oven temperature on screen',tags:['General'],teamId:'software',resId:'jm',resource:'José Matos',status:'todo',timeMode:'total',hours:8,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
  {id:'t043',name:'Validate tools',tags:['UST'],teamId:'mechanics',resId:'pp',resource:'Pedro Pereira',status:'todo',timeMode:'total',hours:8,hpd:null,start:null,dur:1,prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''},
];

const HPD=8; // hours per day default
function _isDayActiveForTask(t, day){
  // For daily tasks with weekday selection, skip inactive weekdays
  if(t.timeMode!=='daily'||!t.weekdays||!t.weekdays.length) return true;
  const dt=gDate(day);
  const dow=dt.getDay(); // 0=Sun,1=Mon...
  return t.weekdays.includes(dow);
}
function isSegLocked(taskId, day){
  const t=TASKS.find(x=>x.id===taskId);
  if(!t||!t.segments) return false;
  const seg=t.segments[0];
  return !!(seg?._locked && day>=seg.start && day<seg.start+seg.dur);
}
function tHours(t){ if(t.segments) return t.segments.reduce((s,g)=>s+g.hours,0); return t.timeMode==='daily'?(t.hpd||HPD)*(t.dur||1):t.timeMode==='test'?(t.hours??0):(t.hours??0); }
function tDur(t)  { if(t.segments){ const l=t.segments[t.segments.length-1]; return l.start+l.dur-1-t.segments[0].start+1; } return t.dur||1; }
function tEnd(t)  { if(t.segments){ const l=t.segments[t.segments.length-1]; return l.start+l.dur-1; } return (t.start||1)+(t.dur||1)-1; }

// Migrate tasks: fill resHours if empty, build taskTeams if missing

// Flatten subtasks into TASKS[] with parentId (for unlimited nesting)
function flattenSubtasksToTasks(){
  const toAdd=[];
  TASKS.forEach(t=>{
    if(!t.parentId) t.parentId=null; // ensure field exists
    if(!(t.subtasks||[]).length) return;
    t.subtasks.forEach(st=>{
      // Only promote if not already in TASKS (avoid double-add on reload)
      const stId=st.id||(st.id='st_'+t.id+'_'+Math.random().toString(36).slice(2));
      if(!TASKS.find(x=>x.id===stId)){
        toAdd.push({
          ...st,
          parentId:t.id,
          projId:st.projId||t.projId,
          teamId:st.teamId||t.teamId,
          teamIds:st.teamIds||t.teamIds||[],
          tags:st.tags||[],
          timeLogs:st.timeLogs||[],
          segments:null,
          coResIds:st.coResIds||[],
          resHours:st.resHours||{},
          timeMode:st.timeMode||'total',
          hpd:st.hpd||null,
          weekdays:st.weekdays||null,
        });
      }
    });
    // Clear promoted entries from t.subtasks[] to prevent re-promotion on next SSE
    t.subtasks=(t.subtasks||[]).filter(st=>{
      const promoted=toAdd.find(x=>x.id===st.id)||TASKS.find(x=>x.id===st.id&&x.parentId===t.id);
      return !promoted;
    });
  });
  toAdd.forEach(t=>TASKS.push(t));
}

function migrateTasks(suppressSave){
  let _migrChanged=false; const _migrIds=[];
  TASKS.forEach(t=>{
    const allIds=[t.resId,...(t.coResIds||[])].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);

    // ── Schema backfill: new allocation fields (safe defaults) ──
    // Only sets when missing; never overwrites existing user data.
    if(t.simultaneous===undefined)  t.simultaneous=false;
    if(t.priorityTask===undefined)  t.priorityTask=null;   // null = no explicit priority
    if(t.assignType===undefined)    t.assignType='direct'; // direct | team
    if(t.teamRef===undefined)       t.teamRef=null;
    if(t.assignOrigin===undefined)  t.assignOrigin='directRaw'; // directRaw | teamPromoted
    if(t.effort===undefined)        t.effort='shared';     // shared | perHead
    if(t.fixedDates===undefined)    t.fixedDates=null;     // {start,end} or null
    if(t.priorityHints===undefined) t.priorityHints=[];    // [taskId] relative order

    // ALWAYS redistribute resHours equally (fixes 0h-per-resource bug)
    // Only skip if user has manually set different values (sum != total hours)
    if(allIds.length){
      const total=tHours(t);
      const rh=t.resHours||{};
      const sum=allIds.reduce((s,id)=>s+(rh[id]||0),0);
      // Redistribute only if sum is 0 (never set)
      if(sum<0.001){
        const each=Math.round(total/allIds.length*10)/10;
        t.resHours={};
        allIds.forEach((id,i)=>{ t.resHours[id]=i===allIds.length-1?Math.round((total-each*i)*10)/10:each; });
        _migrChanged=true; _migrIds.push(t.id);
      }
    }

    // Fix teamIds and rebuild taskTeams only if missing or entries don't match resHours
    if(t.teamId){
      t.teamIds=[t.teamId];
      // Only rebuild taskTeams if missing or entries don't reflect current resHours
      const _existEntries=(t.taskTeams||[]).flatMap(tt=>tt.entries);
      const _needRebuild=!_existEntries.length||allIds.some(id=>{
        const _ee=_existEntries.find(e=>e.id===id);
        return !_ee||Math.abs((_ee.hours||0)-(t.resHours?.[id]||0))>0.01;
      });
      if(_needRebuild){
        t.taskTeams=[{teamId:t.teamId,entries:allIds.map(id=>({id,hours:t.resHours?.[id]||0}))}];
      }
    } else if(allIds.length){
      const r=getRes(allIds[0]);
      const tid=(r?.teams||[])[0]||null;
      if(tid){
        t.teamId=tid; t.teamIds=[tid];
        const _existEntries2=(t.taskTeams||[]).flatMap(tt=>tt.entries);
        const _needRebuild2=!_existEntries2.length||allIds.some(id=>{
          const _ee=_existEntries2.find(e=>e.id===id);
          return !_ee||Math.abs((_ee.hours||0)-(t.resHours?.[id]||0))>0.01;
        });
        if(_needRebuild2){
          t.taskTeams=[{teamId:tid,entries:allIds.map(id=>({id,hours:t.resHours?.[id]||0}))}];
        }
      }
    }
  });
  migrateSchema();
}

// Backfill new allocation fields on resources, time-offs and projects.
// Safe: only sets when missing, never overwrites existing data.
function migrateSchema(){
  (RESOURCES||[]).forEach(r=>{
    if(r.simulated===undefined) r.simulated=false; // hypothetical resource flag
    // Time-offs: ensure allDay/hours exist. Legacy entries = full day.
    (r.timeOff||[]).forEach(to=>{
      if(to.allDay===undefined) to.allDay=true;     // legacy = full day
      if(to.hours===undefined)  to.hours=null;       // only used when !allDay
    });
  });
  (PROJECTS||[]).forEach(p=>{
    if(p.priorityProject===undefined) p.priorityProject=null;
  });
}
function logH(t)  { return (t.timeLogs||[]).reduce((s,l)=>s+l.hours,0); }
function isInc(t) { const _hasStart=t.start||(t.resStart&&Object.keys(t.resStart).length); return !_hasStart||!(t.hours||t.hpd)||!t.resId; } // incomplete

// Format decimal hours → "7h 30m" or "45m" or "8h"
function _fmtHours(h){
  if(isNaN(h)||h===null||h===undefined) return '0h';
  const neg=h<0; const abs=Math.abs(h);
  const totalMin=Math.round(abs*60);
  const hh=Math.floor(totalMin/60); const mm=totalMin%60;
  const str=hh>0?(mm>0?`${hh}h ${mm}m`:`${hh}h`):(mm>0?`${mm}m`:'0h');
  return neg?`-${str}`:str;
}

// Format milliseconds → "00:04:23"
function _fmtMs(ms){
  if(!ms||ms<0) return '00:00:00';
  const s=Math.floor(ms/1000);
  const hh=Math.floor(s/3600), mm=Math.floor((s%3600)/60), ss=s%60;
  return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}

// Bar height: in daily mode height ∝ hpd; in total mode height ∝ density
const BAR_MAX=28, BAR_MIN=4, BAR_1H=3; // BAR_1H = px per 1h/day in daily mode
function barH(t, segH, segDur){
  if(t.timeMode==='daily'){
    const hpd = t.hpd||HPD;
    return Math.min(BAR_MAX, Math.max(BAR_MIN, Math.round(hpd * BAR_1H)));
  }
  const density = segDur>0 ? Math.min(1,(segH||HPD)/((segDur||1)*HPD)) : 1;
  return Math.round(BAR_MIN + density*(BAR_MAX-BAR_MIN));
}

// STATE
const S = {
  page:'gantt', viewBy:'resource', zoom:'week', offset:0, _wlView:'week', _wlOffset:0, _sortBy:'chrono',
  statusFilter:['todo','doing','paused','ready','hold'],
  filterUnassigned:false,
  selectedTags:[], // multi-tag filter
  vbFilter:[], // selected projects/teams/resources for view
  charts:{},
  editId:null, ctxId:null, splitId:null, logId:null,
  tm:'total', // time mode for current modal
};

const SLABELS = {todo:'To Do',doing:'In Progress',paused:'Paused',ready:'Ready',done:'Done',hold:'On Hold',cancelled:'Cancelled'};
const SCOLS   = {todo:'var(--fg3)',doing:'var(--acc)',paused:'var(--acc)',ready:'#00c9a0',done:'var(--ok)',hold:'var(--warn)',cancelled:'var(--danger)'};

// Working visual segments (auto-split on non-working days)
function wSegs(startDay, dur, cols, taskId=null, resId=null){
  const cm={}; cols.forEach((c,ci)=>cm[c.idx]=ci);
  const segs=[]; let ss=null;
  for(let o=0;o<dur;o++){
    const day=startDay+o, ci=cm[day];
    if(ci===undefined) continue;
    if(!isNW(day,taskId,resId)){ if(ss===null) ss=ci; }
    else{ if(ss!==null){ segs.push({sc:ss,ec:ci-1}); ss=null; } }
  }
  if(ss!==null){
    const lc=cm[Math.min(startDay+dur-1, cols[cols.length-1].idx)] ?? cols.length-1;
    segs.push({sc:ss,ec:lc});
  }
  return segs;
}

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
      items=[{id:'__unassigned__',label:'Unassigned',col:'var(--fg3)'},...RESOURCES.map(r=>({id:r.id,label:r.name,col:resTeamColor(r.id)}))];
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
      // Auto-select if Enter is pressed and only one item visible
      window._vbFilteredItems=filtered;
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
      +'oninput="window._onVBSearch(this.value)" onkeydown="window._onVBKey(event)">'
      +'</div>'
      +'<div style="display:flex;gap:6px;padding:5px 8px;border-bottom:1px solid var(--bd2)">'
      +'<button onclick="window._vbSelectAll()" style="flex:1;font-size:10px;padding:3px;border-radius:4px;border:1px solid var(--bd2);background:var(--bg3);color:var(--fg2);cursor:pointer;font-family:var(--font)">✓ All</button>'
      +'<button onclick="deselectAllVB()" style="flex:1;font-size:10px;padding:3px;border-radius:4px;border:1px solid var(--bd2);background:var(--bg3);color:var(--fg2);cursor:pointer;font-family:var(--font)">✕ None</button>'
      +'</div>'
      +'<div id="vb-list" style="padding:4px">'+_renderVBItems('')+'</div>';
    window._renderVBItems=_renderVBItems;
    window._vbSelectAll=()=>{ S.vbFilter=[]; renderGantt(); toggleVBPanel(); toggleVBPanel(); };
    window._onVBKey=(e)=>{
      if(e.key!=='Enter') return;
      const filtered=window._vbFilteredItems||[];
      if(filtered.length===1){
        // Deselect all others, select only this one
        S.vbFilter=[filtered[0].id];
        renderGantt();
        document.getElementById('vb-sel-panel').style.display='none';
      }
    };
    setTimeout(()=>document.getElementById('vb-search')?.focus(),50);
  } else p.style.display='none';
}
function toggleVBF(id, checked){
  // checked=true means user wants this item INCLUDED
  S.vbFilter=S.vbFilter.filter(x=>x!=='__none__'); // strip sentinel
  if(checked){
    if(!S.vbFilter.includes(id)) S.vbFilter.push(id);
    // Unassigned and resources are mutually exclusive groups
    if(id==='__unassigned__'){
      S.vbFilter=['__unassigned__']; // deselect all resources
    } else {
      S.vbFilter=S.vbFilter.filter(x=>x!=='__unassigned__'); // deselect unassigned
    }
    // If all items are now checked, reset to [] (show all = no explicit filter)
    let allItems;
    if(S.viewBy==='resource') allItems=['__unassigned__',...new Set(RESOURCES.map(r=>r.id))];
    else if(S.viewBy==='team') allItems=TEAMS.map(t=>t.id);
    else allItems=PROJECTS.map(p=>p.id);
    if(allItems.every(x=>S.vbFilter.includes(x))) S.vbFilter=[];
  } else {
    // Unchecked: if was show-all, init with all except this one
    if(!S.vbFilter.length){
      let allItems2;
      if(S.viewBy==='resource') allItems2=['__unassigned__',...new Set(RESOURCES.map(r=>r.id))];
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

// ============================================================
// DASHBOARD
// ============================================================
function _renderTeamWorkload(){
  const el=document.getElementById('rp-team-workload');
  if(!el) return;
  const _rpSel=document.getElementById('rpt-proj-filter');
  const _rpProjId=_rpSel?.value||'';
  const _projTasks=(_rpProjId?TASKS.filter(t=>t.projId===_rpProjId):TASKS).filter(t=>t.start!=null&&t.status!=='cancelled');
  if(!_projTasks.length){ el.innerHTML='<div style="font-size:11px;color:var(--fg3);padding:8px">No tasks with dates.</div>'; return; }

  const _idxToIso=idx=>{ if(!idx) return null; const d=gDate(idx); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  const _toMs=iso=>new Date(iso).getTime();
  const _toIso=ms=>{ const d=new Date(ms); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  const _fmtS=iso=>iso?iso.slice(5).replace('-','/'):'';

  // Build team data
  const _teamIds=[...new Set(_projTasks.map(t=>t.teamId).filter(Boolean))];
  const _teams=_teamIds.map(tid=>{
    const _tm=getTeam(tid);
    const _tTasks=_projTasks.filter(t=>t.teamId===tid);
    const _items=_tTasks.map(t=>({start:_idxToIso(t.start),end:_idxToIso(tEnd(t)),hours:tHours(t)})).filter(x=>x.start&&x.end);
    const _totalH=_items.reduce((s,x)=>s+x.hours,0);
    // merge overlapping blocks
    const _sorted=[..._items].sort((a,b)=>_toMs(a.start)-_toMs(b.start));
    const _blocks=[];
    _sorted.forEach(x=>{
      const s=_toMs(x.start),e=_toMs(x.end);
      if(_blocks.length&&s<=_blocks[_blocks.length-1].end+86400000){
        _blocks[_blocks.length-1].end=Math.max(_blocks[_blocks.length-1].end,e);
        _blocks[_blocks.length-1].count++;
      } else { _blocks.push({start:s,end:e,count:1}); }
    });
    return {name:_tm?.name||tid,color:_tm?.color||'var(--acc)',blocks:_blocks,totalH:_totalH};
  }).filter(t=>t.blocks.length);

  if(!_teams.length){ el.innerHTML='<div style="font-size:11px;color:var(--fg3);padding:8px">No team data.</div>'; return; }

  const _allMs=_teams.flatMap(t=>t.blocks.flatMap(b=>[b.start,b.end]));
  const _minMs=Math.min(..._allMs)-5*86400000;
  const _maxMs=Math.max(..._allMs)+5*86400000;
  const _span=_maxMs-_minMs;
  const _pct=ms=>(((ms-_minMs)/_span)*100).toFixed(2);
  const LABEL_W=120, HOURS_W=52;

  let H='';

  // Month header
  H+='<div style="display:flex;align-items:center;margin-bottom:4px">';
  H+='<div style="width:'+LABEL_W+'px;flex-shrink:0"></div>';
  H+='<div style="flex:1;position:relative;height:18px;border-bottom:1px solid var(--bd2)">';
  const _months={};
  for(let ms=_minMs;ms<=_maxMs;ms+=86400000){
    const d=new Date(ms);
    const key=d.getFullYear()+'-'+d.getMonth();
    if(!_months[key]) _months[key]={ms,label:d.toLocaleDateString('en-GB',{month:'short',year:'2-digit'})};
  }
  Object.values(_months).forEach(m=>{
    H+='<div style="position:absolute;top:0;font-size:10px;color:var(--fg3);transform:translateX(-50%);left:'+_pct(m.ms)+'%;white-space:nowrap">'+m.label+'</div>';
  });
  H+='</div>';
  H+='<div style="width:'+HOURS_W+'px;flex-shrink:0;text-align:right;font-size:10px;color:var(--fg3);padding-right:4px">hours</div>';
  H+='</div>';

  // Team rows
  _teams.forEach(team=>{
    H+='<div style="display:flex;align-items:center;margin-bottom:8px">';
    H+='<div style="width:'+LABEL_W+'px;flex-shrink:0;display:flex;align-items:center;gap:6px;padding-right:8px">'
      +'<span style="width:7px;height:7px;border-radius:2px;background:'+team.color+';flex-shrink:0"></span>'
      +'<span style="font-size:11px;color:var(--fg0);font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+team.name+'</span>'
    +'</div>';
    H+='<div style="flex:1;position:relative;height:24px">';
    H+='<div style="position:absolute;top:50%;left:0;right:0;height:1px;background:var(--bd2);transform:translateY(-50%)"></div>';
    team.blocks.forEach(b=>{
      const left=parseFloat(_pct(b.start));
      const right=parseFloat(_pct(b.end));
      const w=Math.max(right-left,0.5);
      const tip=_fmtS(_toIso(b.start))+' → '+_fmtS(_toIso(b.end))+(b.count>1?' ('+b.count+' tasks)':'');
      H+='<div title="'+tip+'" style="position:absolute;top:50%;height:14px;border-radius:3px;background:'+team.color+';opacity:.85;transform:translateY(-50%);left:'+left+'%;width:'+w+'%"></div>';
      if(w>6){
        H+='<div style="position:absolute;top:50%;transform:translateY(-50%);left:'+left+'%;width:'+w+'%;display:flex;justify-content:space-between;align-items:center;padding:0 4px;pointer-events:none;overflow:hidden">'
          +'<span style="font-size:9px;font-weight:500;color:#fff;white-space:nowrap">'+_fmtS(_toIso(b.start))+'</span>'
          +'<span style="font-size:9px;font-weight:500;color:#fff;white-space:nowrap">'+_fmtS(_toIso(b.end))+'</span>'
        +'</div>';
      }
    });
    H+='</div>';
    const _hStr=team.totalH%1===0?team.totalH:team.totalH.toFixed(1);
    H+='<div style="width:'+HOURS_W+'px;flex-shrink:0;text-align:right;padding-right:4px;font-size:12px;font-weight:600;color:var(--fg0)">'+_hStr+'h</div>';
    H+='</div>';
  });

  el.innerHTML=H;
}
function _renderProjProgress(){
  const el=document.getElementById('dash-proj-progress');
  if(!el) return;
  const today=new Date().toISOString().slice(0,10);
  const activeProjs=PROJECTS.filter(p=>p.status==='active'||p.status==='planning');
  if(!activeProjs.length){ el.innerHTML='<div style="color:var(--fg3);font-size:11px;padding:8px">No active projects</div>'; return; }
  const sorted=[...activeProjs].sort((a,b)=>{
    if(!a.deadline&&!b.deadline) return 0;
    if(!a.deadline) return 1; if(!b.deadline) return -1;
    return a.deadline.localeCompare(b.deadline);
  });
  let H='';
  sorted.forEach(p=>{
    const pts=TASKS.filter(t=>t.projId===p.id&&t.status!=='cancelled');
    const total=pts.length; if(!total) return;
    const done=pts.filter(t=>t.status==='done').length;
    const doing=pts.filter(t=>t.status==='doing'||t.status==='paused').length;
    const todo=total-done-doing;
    const pct=Math.round(done/total*100);
    const hTot=Math.round(pts.filter(t=>t.status!=='done'&&t.status!=='cancelled').reduce((s,t)=>s+tHours(t),0));
    const hDone=pts.filter(t=>t.status==='done').reduce((s,t)=>s+tHours(t),0);
    const hRem=hTot;
    const col=p.color||'var(--acc)';
    const pctDone=hTot>0?Math.min(100,Math.round(hDone/hTot*100)):0;
    const pctDoing=hTot>0?Math.min(100-pctDone,Math.round(doing/total*100)):0;
    const dlCol=p.deadline&&p.deadline<today?'var(--danger)':'var(--fg3)';
    const dlStr=p.deadline?'<span style="font-size:9px;color:'+dlCol+'">'+p.deadline+'</span>':'';
    const pctCol=pct>=100?'var(--ok)':pct>=50?col:'var(--fg2)';
    const doingStr=doing>0?(doing+' in progress · '):'';
    H+='<div style="margin-bottom:10px">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">'
        +'<div style="display:flex;align-items:center;gap:6px;min-width:0">'
          +'<span style="width:8px;height:8px;border-radius:2px;background:'+col+';flex-shrink:0"></span>'
          +'<span style="font-size:11px;font-weight:600;color:var(--fg0);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+p.name+'</span>'
          +dlStr
        +'</div>'
        +'<div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:8px">'
          +'<span style="font-size:10px;color:var(--fg3)">'+done+'/'+total+' tasks</span>'
          +'<span style="font-size:11px;font-weight:700;color:'+pctCol+';font-family:var(--mono);min-width:32px;text-align:right">'+pct+'%</span>'
        +'</div>'
      +'</div>'
      +'<div style="height:8px;background:var(--bg3);border-radius:4px;overflow:hidden;margin-bottom:2px">'
        +'<div style="height:100%;display:flex;border-radius:4px;overflow:hidden">'
          +'<div style="width:'+pctDone+'%;background:'+col+';opacity:.9;transition:width .4s"></div>'
          +'<div style="width:'+pctDoing+'%;background:'+col+';opacity:.4;transition:width .4s"></div>'
        +'</div>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--fg3)">'
        +'<span>'+_fmtHours(hDone)+'h done · '+_fmtHours(hRem)+'h remaining</span>'
        +'<span>'+doingStr+todo+' to do</span>'
      +'</div>'
    +'</div>';
  });
  el.innerHTML=H||'<div style="color:var(--fg3);font-size:11px;padding:8px">No tasks found</div>';
}
function renderDash(){
  const h=new Date().getHours();
  const uname=S_USER?.name||'there'; document.getElementById('greet').textContent=(h<12?'Good morning':h<18?'Good afternoon':'Good evening')+', '+uname.split(' ')[0];
  const tot=TASKS.length, done=TASKS.filter(t=>t.status==='done').length,
    doing=TASKS.filter(t=>t.status==='doing').length, hold=TASKS.filter(t=>t.status==='hold').length,
    ph=TASKS.reduce((s,t)=>s+tHours(t),0), ah=TASKS.reduce((s,t)=>s+logH(t),0),
    ov=TASKS.filter(t=>t.deadline&&t.status!=='done'&&t.status!=='cancelled'&&(dateToIdx(t.deadline)<GANTT_TODAY||tEnd(t)>dateToIdx(t.deadline))).length;
  document.getElementById('dash-m').innerHTML=`
    <div class="mc a1"><div class="ml">Total tasks</div><div class="mv">${tot}</div><div class="ms">${done} done · ${doing} in progress</div></div>
    <div class="mc a2"><div class="ml">Completion</div><div class="mv">${tot?Math.round(done/tot*100):0}%</div><div class="ms">${hold} on hold</div></div>
    <div class="mc a3"><div class="ml">Planned hours</div><div class="mv">${_fmtHours(ph)}</div><div class="ms">${_fmtHours(ah)} logged (${ph>0?Math.round(ah/ph*100):0}%)</div></div>
    <div class="mc a4"><div class="ml">Overdue</div><div class="mv" style="color:${ov?'var(--danger)':'inherit'}">${ov}</div><div class="ms">tasks past deadline</div></div>
    <div class="mc a1"><div class="ml">On Hold</div><div class="mv" style="color:${hold?'var(--warn)':'inherit'}">${hold}</div><div class="ms">tasks on hold</div></div>`;

  // ── WORKLOAD GAUGES ──────────────────────────────────────────
  // Calculate load: pending hours / (working days left * dailyCap) for each resource
  const today=GANTT_TODAY;
  const LOOK_AHEAD=20; // working days
  // Count working days in next LOOK_AHEAD days
  let wdaysLeft=0;
  for(let d=today;d<today+60&&wdaysLeft<LOOK_AHEAD;d++){ if(!isNW(d)) wdaysLeft++; }

  // ── Workload: Day/Week/Month ─────────────────────────────────
  const wlView=S._wlView||'week';
  const wlOffset=S._wlOffset||0;

  function wlRange(){
    const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if(wlView==='day'){
      const d=GANTT_TODAY+wlOffset;
      return {start:d,end:d,label:sd(d)};
    }
    if(wlView==='week'){
      const dt=gDate(GANTT_TODAY+wlOffset*7);
      const dow=dt.getDay(); const mo=dow===0?-6:1-dow;
      const mon=GANTT_TODAY+wlOffset*7+mo;
      const fri=mon+4;
      const dm=gDate(mon),df=gDate(fri);
      return {start:mon,end:fri,label:`${dm.getDate()} ${MN[dm.getMonth()]} – ${df.getDate()} ${MN[df.getMonth()]}`};
    }
    const dt=gDate(GANTT_TODAY);
    const adj=new Date(dt.getFullYear(),dt.getMonth()+wlOffset,1);
    const dim=new Date(adj.getFullYear(),adj.getMonth()+1,0).getDate();
    const s=Math.round((adj-GANTT_ORIGIN)/86400000)+1;
    const MN2=['January','February','March','April','May','June','July','August','September','October','November','December'];
    return {start:s,end:s+dim-1,label:`${MN2[adj.getMonth()]} ${adj.getFullYear()}`};
  }

  function wdInRange(s,e){ let n=0; for(let d=s;d<=e;d++) if(!isNW(d)) n++; return Math.max(1,n); }

  function resHrsInRange(resId,s,e){
    let logged=0,planned=0,overdue=0;
    TASKS.forEach(t=>{
      if(t.resId!==resId&&!(t.coResIds||[]).includes(resId)) return;
      if(t.status==='cancelled'||t.status==='done') return;
      (t.timeLogs||[]).forEach(l=>{ const di=dateToIdx(l.date); if(di&&di>=s&&di<=e) logged+=l.hours||0; });
      const sc=t._sched||{};
      Object.entries(sc).forEach(([d,h])=>{ const di=+d; if(di>=s&&di<=e) planned+=h||0; });
      if(t.deadline){ const dl=dateToIdx(t.deadline);
        if(dl) Object.entries(sc).forEach(([d,h])=>{ if(+d>dl&&+d>=s&&+d<=e) overdue+=h||0; }); }
    });
    return {logged,planned,overdue};
  }

  function getResFreeDate2(resId){
    const tasks=TASKS.filter(t=>t.resId===resId&&t.status!=='done'&&t.status!=='cancelled');
    let last=0;
    tasks.forEach(t=>{ const sc=t._sched||{};
      const days=Object.keys(sc).map(Number).filter(d=>sc[d]>0.001);
      const e=days.length?Math.max(...days):tEnd(t); if(e>last) last=e; });
    return last||null;
  }

  function getTeamFreeDate2(ids){ const ds=ids.map(getResFreeDate2).filter(Boolean); return ds.length?Math.max(...ds):null; }

  function freeLabel2(d){
    if(!d||d<=GANTT_TODAY) return '<span style="color:var(--ok);font-size:9px">✓ Free now</span>';
    const diff=d-GANTT_TODAY;
    const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dt=gDate(d);
    if(diff<=7) return `<span style="color:var(--warn);font-size:9px">Free in ${diff}d</span>`;
    return `<span style="color:var(--fg3);font-size:9px">Free ${dt.getDate()} ${MN[dt.getMonth()]}</span>`;
  }

  const activeTeams=TEAMS.filter(tm=>{
    if(tm.showInDash===false) return false;
    return RESOURCES.some(r=>r.showInDash!==false&&(r.teams||[]).includes(tm.id));
  });

  const wlRange2=wlRange();
  const wdays=wdInRange(wlRange2.start,wlRange2.end);

  let gaugeHTML=`<div class="card" style="margin-top:16px">
    <div class="ch" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
      <span class="ct">Team Workload</span>
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
        <button class="btn btn-sm btn-ic" onclick="S._wlOffset=(S._wlOffset||0)-1;renderDash()">‹</button>
        <button class="btn btn-sm" onclick="S._wlOffset=0;renderDash()" style="font-size:9px;min-width:120px;text-align:center">${wlRange2.label}</button>
        <button class="btn btn-sm btn-ic" onclick="S._wlOffset=(S._wlOffset||0)+1;renderDash()">›</button>
        <div style="display:flex;border:1px solid var(--bd);border-radius:6px;overflow:hidden;margin-left:4px">
          ${['day','week','month'].map(v=>`<button onclick="S._wlView='${v}';S._wlOffset=0;renderDash()" style="padding:3px 10px;font-size:9px;font-weight:600;border:none;cursor:pointer;background:${wlView===v?'var(--acc)':'transparent'};color:${wlView===v?'#fff':'var(--fg2)'};font-family:var(--font)">${v[0].toUpperCase()+v.slice(1)}</button>`).join('')}
        </div>
      </div>
    </div>
    <div class="cb" style="padding:8px"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">`;

  activeTeams.forEach(tm=>{
    const tmRes=RESOURCES.filter(r=>r.showInDash!==false&&(r.teams||[]).includes(tm.id));
    if(!tmRes.length) return;
    const totalCap=tmRes.reduce((s,r)=>s+(r.dailyCap||8),0)*wdays;
    let tmLogged=0,tmPlanned=0,tmOver=0;
    tmRes.forEach(r=>{ const {logged,planned,overdue}=resHrsInRange(r.id,wlRange2.start,wlRange2.end);
      tmLogged+=logged; tmPlanned+=planned; tmOver+=overdue; });
    const tmUsed=tmLogged+tmPlanned;
    const pct=totalCap>0?Math.round(tmUsed/totalCap*100):0;
    const col=pct>=100?'var(--danger)':pct>=90?'var(--warn)':pct>=70?'#f59e0b':'var(--ok)';
    const fd=getTeamFreeDate2(tmRes.map(r=>r.id));

    gaugeHTML+=`<div style="background:var(--bg2);border:1px solid var(--bd)${pct>=100?';outline:1px solid rgba(240,82,82,.4)':''};border-radius:10px;padding:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="width:8px;height:8px;border-radius:50%;background:${tm.color}"></span>
          <span style="font-size:11px;font-weight:700">${tm.name}</span>
          <span style="font-size:9px;color:var(--fg3)">${tmRes.length}p</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:6px">
          <span style="font-size:18px;font-weight:800;color:${col};font-family:var(--mono)">${pct}%</span>
          ${tmOver>0?`<span style="font-size:9px;font-weight:700;color:var(--danger);background:rgba(240,82,82,.12);padding:1px 6px;border-radius:4px">+${_fmtHours(tmOver)} OVR</span>`:''}
        </div>
      </div>
      <div style="height:7px;background:var(--bg3);border-radius:4px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${Math.min(pct,100)}%;background:${col};border-radius:4px;transition:width .4s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:9px;color:var(--fg3);margin-bottom:8px">
        <span>${_fmtHours(tmLogged)} logged · ${_fmtHours(tmPlanned)} sched · ${_fmtHours(totalCap)} cap</span>
        ${freeLabel2(fd)}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px">
        ${tmRes.map(r=>{
          const {logged,planned,overdue:rOvr}=resHrsInRange(r.id,wlRange2.start,wlRange2.end);
          const rUsed=logged+planned; const rCap=(r.dailyCap||8)*wdays;
          const rPct=rCap>0?Math.round(rUsed/rCap*100):0;
          const rCol=rPct>=100?'var(--danger)':rPct>=90?'var(--warn)':rPct>=70?'#f59e0b':'var(--ok)';
          return `<div style="flex:1;min-width:65px;background:var(--bg3);border-radius:7px;padding:6px 8px">
            <div style="font-size:9px;font-weight:600;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.name.split(' ')[0]}</div>
            <div style="height:4px;background:var(--bg2);border-radius:2px;overflow:hidden;margin-bottom:4px">
              <div style="height:100%;width:${Math.min(rPct,100)}%;background:${rCol};border-radius:2px"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:8px;gap:3px">
              <span style="color:${rCol};font-weight:700;font-family:var(--mono)">${rPct}%</span>
              ${rOvr>0?`<span style="color:var(--danger)">+${_fmtHours(rOvr)}</span>`:''}
              <span style="color:var(--fg3)">${_fmtHours(rUsed)}/${_fmtHours(rCap)}</span>
            </div>
            <div style="margin-top:3px">${freeLabel2(getResFreeDate2(r.id))}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  });

  gaugeHTML+=`</div></div></div>`;

  document.getElementById('dash-c').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="card"><div class="ch"><span class="ct">Status breakdown</span></div><div class="cb" style="display:flex;align-items:center;gap:18px">
        <div style="position:relative;width:130px;height:130px;flex-shrink:0"><canvas id="dc-s">Status chart</canvas></div>
        <div style="display:flex;flex-direction:column;gap:5px">${['todo','doing','done','hold','cancelled'].map(s=>`<div style="display:flex;align-items:center;gap:6px;font-size:11px"><span style="width:8px;height:8px;border-radius:2px;background:${SCOLS[s]}"></span><span style="color:var(--fg2)">${SLABELS[s]} — ${TASKS.filter(t=>t.status===s).length}</span></div>`).join('')}</div>
      </div></div>
      <div class="card"><div class="ch"><span class="ct">Hours by team (planned vs logged)</span></div><div class="cb" style="position:relative;height:160px"><canvas id="dc-h">Hours chart</canvas></div></div>
    </div>
    ${gaugeHTML}
    <div class="card" style="margin-top:16px">
      <div class="ch" style="justify-content:space-between">
        <span class="ct">Projects Progress</span>
        <span style="font-size:10px;color:var(--fg3)">active projects · hours remaining vs done</span>
      </div>
      <div class="cb" style="padding:8px 12px" id="dash-proj-progress"></div>
    </div>`

  _renderProjProgress();
  _renderTeamWorkload();
  setTimeout(()=>{
    ['dc-s','dc-h'].forEach(id=>{if(S.charts[id])S.charts[id].destroy();});
    S.charts['dc-s']=new Chart(document.getElementById('dc-s'),{type:'doughnut',data:{labels:Object.values(SLABELS),datasets:[{data:['todo','doing','done','hold','cancelled'].map(s=>TASKS.filter(t=>t.status===s).length),backgroundColor:['#3e4f6a','#4f9cf9','#22c55e','#f0a928','#f05252'],borderWidth:3,borderColor:'#1b2130'}]},options:{responsive:true,maintainAspectRatio:false,cutout:'66%',plugins:{legend:{display:false}}}});
    const tIds=TEAMS.map(t=>t.id);
    S.charts['dc-h']=new Chart(document.getElementById('dc-h'),{type:'bar',data:{labels:TEAMS.map(t=>t.name.split(' ')[0]),datasets:[{label:'Planned',data:tIds.map(id=>TASKS.filter(t=>resInTeam(t.resId,id)).reduce((s,t)=>s+tHours(t),0)),backgroundColor:'rgba(79,156,249,.3)',borderRadius:3},{label:'Logged',data:tIds.map(id=>TASKS.filter(t=>resInTeam(t.resId,id)).reduce((s,t)=>s+logH(t),0)),backgroundColor:'rgba(0,201,160,.45)',borderRadius:3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(37,47,69,.4)'},ticks:{color:'#6e7e9e',font:{size:9}}},y:{grid:{color:'rgba(37,47,69,.4)'},ticks:{color:'#6e7e9e',callback:v=>v+'h'}}}}});
  },40);
}
function resInTeam(resId,teamId){ const r=getRes(resId); return r&&r.teams&&r.teams.includes(teamId); }

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
    // Exclude tasks belonging to On Hold projects
    if(isProjOnHold(t.projId)) return false;
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
    const _hasUnassigned=_vbReal.includes('__unassigned__');
    const _vbResOnly=_vbReal.filter(x=>x!=='__unassigned__');
    // Show all resources if no filter, none if __none__, specific if filtered
    const rIds=_vbResOnly.length?_vbResOnly:S.vbFilter.includes('__none__')?[]:_hasUnassigned?[]:[...allTaskResIds];
    // Handle unassigned group — only when explicitly selected
    if(_hasUnassigned&&!_vbResOnly.length){
      const unassignedTasks=tasks.filter(t=>!t.resId&&!(t.coResIds||[]).length);
      if(unassignedTasks.length){
        rows.push({type:'res-header',resId:null,label:'Unassigned'});
        unassignedTasks.forEach(t=>rows.push({type:'task',t,resId:null}));
      }
    }
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
    // Unassigned section: only show when no specific resource filter is active,
    // or when __unassigned__ is explicitly selected
    const _showUnassigned = !_vbResOnly.length && (!S.vbFilter.length || _hasUnassigned);
    if(_showUnassigned){
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
  if(t.depType) return {depType:t.depType,depId:t.depId,depIds:t.depIds,depResId:t.depResId,depUntil:t.depUntil,depMsId:t.depMsId,depGroup:t.depGroup,depNote:t.depNote,projId:t.projId,id:t.id};
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
  if(dep.depType==='group'&&dep.depGroup){
    const groupTasks=TASKS.filter(t=>t.group===dep.depGroup&&t.status!=='cancelled');
    const lastEnd=groupTasks.reduce((m,t)=>{ const e=tEnd(t); return e>m?e:m; }, 0);
    if(lastEnd>0) return lastEnd+1;
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
      // Always restore _sched/_schedCo from canonical sched/schedCo before applying timeLogs
      // to avoid accumulation across multiple renderGantt calls
      if(t.sched){
        t._sched=Object.assign({},t.sched);
        t._schedCo=t.schedCo?JSON.parse(JSON.stringify(t.schedCo)):undefined;
      } else {
        if(!t._sched) t._sched={};
        // Clear planned hours for past days (non-simulation tasks only)
        Object.keys(t._sched).forEach(d=>{ if(+d<=_yst) delete t._sched[+d]; });
      }
      // Fill in actual logged hours for past days
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
    _pSel.innerHTML='<option value="">All projects</option>'+PROJECTS.filter(p=>p.status!=='on_hold'&&p.status!=='cancelled').map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    if(_cur && !isProjOnHold(_cur)) _pSel.value=_cur; else if(isProjOnHold(S._activeProjId)){ S._activeProjId=null; _pSel.value=""; }
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
            const _over=_alloc>_cap+0.001;
            const _avail=Math.max(0,_cap-_alloc);
            const _pct=_alloc/_cap; // fraction allocated (>1 = over-allocated)
            const _col=_over?'var(--danger)':_pct>=1?'var(--ok)':'var(--warn)';
            const _allocStr=(_alloc%1===0?_alloc:_alloc.toFixed(1))+'h';
            const _barW=Math.min(100,Math.round(_pct*100));
            allocLabel=`<div style="font-size:7px;font-weight:600;color:${_col};line-height:1.2${_over?';outline:1px solid var(--danger);border-radius:2px;padding:0 1px':''}">${_over?'⚠ ':''}<b>${_allocStr}</b></div><div style="height:2px;background:var(--bg3);border-radius:1px;overflow:hidden;margin-top:1px"><div style="height:100%;width:${_barW}%;background:${_col}"></div></div>`;
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
              || (_td.depType==='milestone'&&_td.depMsId&&(()=>{ const _ms=MILESTONES.find(m=>m.id===_td.depMsId); return _ms&&_ms.dayIdx>=GANTT_TODAY; })())
              || (_td.depType==='group'&&_td.depGroup&&TASKS.filter(t=>t.group===_td.depGroup&&(!_td.projId||t.projId===_td.projId)&&t.id!==_td.id&&t.status!=='cancelled').some(t=>t.status!=='done'));
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
          ${_td.depType?(()=>{
              const _isBlocked=depBl;
              let _depTip='';
              if(_td.depType==='task'&&_depAllIds.length>0){const _names=_depAllIds.map(did=>TASKS.find(x=>x.id===did)?.name||did);_depTip=(_isBlocked?'Waiting for: ':'Depends on: ')+_names.join(', ');}
              else if(_td.depType==='resource'&&_td.depUntil){_depTip='Resource unavailable until: '+_td.depUntil+(_td.depNote?' — '+_td.depNote:'');}
              else if(_td.depType==='milestone'&&_td.depMsId){const _msd=MILESTONES.find(m=>m.id===_td.depMsId);_depTip=(_isBlocked?'Waiting for milestone: ':'Depends on milestone: ')+(_msd?.name||_td.depMsId);}
              else if(_td.depType==='group'&&_td.depGroup){_depTip=(_isBlocked?'Waiting for group: ':'Depends on group: ')+_td.depGroup;}
              const _col=_isBlocked?'var(--warn)':'var(--fg3)';
              return `<span style="font-size:11px;color:${_col};cursor:default;position:relative;flex-shrink:0;width:16px;display:inline-flex;align-items:center;opacity:${_isBlocked?'1':'0.5'}" class="dep-chain-wrap"><span>⛓</span><span class="dep-tip" style="display:none;position:fixed;background:var(--bg2);border:1px solid ${_col};border-radius:6px;padding:4px 8px;font-size:10px;color:var(--fg0);white-space:nowrap;z-index:9999;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.4);transform:translateY(-50%)">${_depTip}</span></span>`;
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
    } else if(t.depType==='group'&&t.depGroup){
      const _groupTasks=TASKS.filter(x=>x.group===t.depGroup&&(!t.projId||x.projId===t.projId)&&x.id!==t.id&&x.status!=='cancelled');
      depDay=_groupTasks.reduce((m,x)=>{ const e=tEnd(x); return e>m?e:m; }, null);
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
      const _depMarkerTip=(()=>{ if(!isDepCol) return ''; if(t.depType==='task'){ const _aids=[...new Set([...(t.depIds||[]),t.depId].filter(Boolean))]; const _names=_aids.map(did=>TASKS.find(x=>x.id===did)?.name||did); return _names.length?'⛓ Waiting for: '+_names.join(', '):'⛓'; } if(t.depType==='resource'){ const _dr=getRes(t.depResId); return `⛓ Resource unavailable until: ${t.depUntil||'?'}${_dr?' ('+_dr.name+')':''}${t.depNote?' — '+t.depNote:''}`; } if(t.depType==='milestone'){ const _dm=MILESTONES.find(m=>m.id===t.depMsId); return _dm?`⛓ Waiting for milestone: ${_dm.name}`:'⛓'; } if(t.depType==='group'){ return `⛓ Waiting for group: ${t.depGroup||'?'}`; } return '⛓'; })();
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
    const pool=Math.max((task.hours||0)-loggedTotal, 1);
    return pool;
  }

  // Count all resources on this task (primary + co)
  const allResIds=[task.resId,...(task.coResIds||[])].filter(Boolean);
  const nRes=Math.max(allResIds.length, 1);

  const rh=task.resHours||{};
  const hasResHours=Object.keys(rh).length>0;

  let rem;
  if(hasResHours && resId!=null && rh[resId]!=null){
    // Per-resource hours defined: use resHours[resId] as the estimate for this resource.
    // Distribute logged hours proportionally across resources.
    const totalEst=Object.values(rh).reduce((s,h)=>s+(h||0),0);
    const resEst=rh[resId]||0;
    const share=totalEst>0 ? resEst/totalEst : 1/nRes;
    rem=resEst-(loggedTotal*share);
  } else {
    // No per-resource breakdown: split total equally across all resources.
    const totalEst=task.hours||0;
    rem=(totalEst-loggedTotal)/nRes;
  }

  // Minimum 1h; round up to nearest 0.5h
  rem=Math.max(rem, 1);
  rem=Math.ceil(rem*2)/2; // round up to nearest 0.5h
  return rem;
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
    const effectiveCap = coll.furou==='TIMEOFF_PARCIAL' ? (getRes(resId)?.dailyCap||HPD) : capH;
    const free=Math.max(0, effectiveCap-(used[day]||0));
    if(free<=0.001){ day++; continue; }
    const put=Math.min(faltam, free);
    segs.push({day, hours:put, why:{ limitadoPor: day===startDay ? 'DEPENDENCIA' : 'CAPACIDADE', furou: coll.furou||null }});
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
  // Always start from today — t.start may be stale from a previous Apply.
  // Only respect t.start if it is explicitly a user-set future date (fixedDates).
  let minStart=nextWorkDay(GANTT_TODAY);
  if(task.depType==='task'){
    const dids=[...new Set([...(task.depIds||[]),task.depId].filter(Boolean))];
    dids.forEach(did=>{ const dep=TASKS.find(x=>x.id===did); if(dep&&dep.start) minStart=Math.max(minStart, nextWorkDay(tEnd(dep)+1)); });
  }
  if(task.depType==='group'&&task.depGroup){
    // Find the last end day of all tasks in the group (same project)
    const groupTasks=TASKS.filter(t=>t.group===task.depGroup&&(!task.projId||t.projId===task.projId)&&t.id!==task.id&&t.status!=='cancelled');
    const lastEnd=groupTasks.reduce((m,t)=>{ const e=tEnd(t); return e>m?e:m; }, 0);
    if(lastEnd>0) minStart=Math.max(minStart, nextWorkDay(lastEnd+1));
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
    if(isProjOnHold(t.projId)) return false;    // ignore On Hold projects
    if(t.timeMode==='daily') return false;       // Daily tasks have fixed dates — never rescheduled
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

  // ── FULL SIMULATION LOG ──────────────────────────────────────────────────
  // Tracks every allocation for every resource. Exposed as window._lastSimLog.
  const _simLog=[];
  const _seedOcc=(resId, sched, taskId)=>{
    if(!occByRes[resId]) occByRes[resId]={};
    Object.entries(sched||{}).forEach(([d,h])=>{
      const prev=occByRes[resId][d]||0;
      occByRes[resId][d]=prev+h;
      const t=TASKS.find(x=>x.id===taskId);
      const cap=getRes(resId)?.dailyCap||HPD;
      const over=occByRes[resId][d]>cap+0.001;
      _simLog.push({
        day:sd(+d), dayIdx:+d,
        res:getRes(resId)?.name||resId, resId,
        task:t?.name||taskId, taskId,
        prev, added:h, total:occByRes[resId][d], cap,
        over
      });
      if(over) console.warn(`[SIM OVER-ALLOC] ${getRes(resId)?.name||resId} | ${sd(+d)} | cap:${cap}h | total:${occByRes[resId][d]}h | task:"${t?.name||taskId}"`);
    });
  };
  window._lastSimLog=_simLog;

  // Pre-seed occByRes with ALL tasks that won't be rescheduled (daily tasks, tasks from
  // other projects, done/cancelled excluded) so the simulation sees real capacity.
  // Uses existing _sched/_schedCo from computeAllSchedules when available.
  // Also includes _schedLocked tasks (applied by a previous simulation) as fixed anchors.
  const eligibleIds=new Set(eligible.map(t=>t.id));
  TASKS.forEach(t=>{
    if(t.status==='done'||t.status==='cancelled') return;
    const isNonEligible=!eligibleIds.has(t.id);
    if(!isNonEligible) return; // will be handled by simulation itself
    // Seed primary resource — only future days
    if(t.resId && t._sched) _seedOcc(t.resId, Object.fromEntries(Object.entries(t._sched).filter(([d])=>+d>=GANTT_TODAY)), t.id);
    // Seed co-resources via existing _schedCo — only future days
    if(t._schedCo){
      Object.entries(t._schedCo).forEach(([coId, coSched])=>{
        if(coSched && typeof coSched==='object'){
          const future=Object.fromEntries(Object.entries(coSched).filter(([d])=>+d>=GANTT_TODAY));
          if(Object.keys(future).length) _seedOcc(coId, future, t.id);
        }
      });
    }
  });

  const _hasLogs=t=>(t.timeLogs||[]).reduce((s,l)=>s+(l.hours||0),0)>0;

  // Anchors: ALL doing/paused — placed first regardless of timeLogs
  const anchored=eligible.filter(t=>t.status==='doing'||t.status==='paused');
  anchored.forEach(t=>{
    const ids=engineResolveResources(t);
    // Never use t.start from a previous Apply — always place from today or later if dependencies require it
    const start=engineMinStart(t);
    if(t.simultaneous && ids.length>1){
      const r=enginePlaceSimultaneous(t, ids, nextWorkDay(start), occByRes);
      const schedByRes={}; ids.forEach(id=>{ const m={}; r.segsByRes[id].forEach(s=>{ if(s.hours>0) m[s.day]=(m[s.day]||0)+s.hours; }); schedByRes[id]=m; _seedOcc(id,m,t.id); });
      preview[t.id]={start:r.arranque, schedByRes};
    } else {
      const id=ids[0]; const r=enginePlaceResource(t, id, nextWorkDay(start), occByRes[id]||{});
      const m={}; r.segs.forEach(s=>m[s.day]=(m[s.day]||0)+s.hours); _seedOcc(id,m,t.id);
      const schedByRes={[id]:m};
      const coIds=(t.coResIds||[]).filter(Boolean);
      coIds.forEach(coId=>{
        const coHours=t.resHours?.[coId]||0; if(coHours<=0) return;
        const coR=enginePlaceResource({...t,resId:coId,hours:coHours}, coId, nextWorkDay(start), occByRes[coId]||{});
        const coM={}; coR.segs.forEach(s=>coM[s.day]=(coM[s.day]||0)+s.hours);
        _seedOcc(coId,coM,t.id);
        schedByRes[coId]=coM;
      });
      preview[t.id]={start:r.segs[0]?.day||start, schedByRes};
    }
  });

  // order the rest by priority and place
  const todo=eligible.filter(t=>!(t.status==='doing'||t.status==='paused'));
  todo.sort((a,b)=>comparePriority(a,b,float,succCount));
  // Log todo order for debugging
  window._lastTodoOrder=todo.map((t,i)=>({pos:i+1,name:t.name,resId:t.resId,status:t.status,priority:t.priority}));

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
        const m={}; r.segs.forEach(s=>m[s.day]=(m[s.day]||0)+s.hours); _seedOcc(id,m,t.id); schedByRes[id]=m;
      });
      const allDays=Object.values(schedByRes).flatMap(m=>Object.keys(m).map(Number));
      preview[t.id]={start:allDays.length?Math.min(...allDays):minStart, schedByRes};
    } else if(t.simultaneous && ids.length>1){
      // For simultaneous: find first day ALL resources are free
      const simStart=ids.reduce((best,id)=>Math.max(best, engineFirstFreeDay(id, minStart, occByRes)), minStart);
      const r=enginePlaceSimultaneous(t, ids, simStart, occByRes);
      const schedByRes={}; ids.forEach(id=>{ const m={}; r.segsByRes[id].forEach(s=>{ if(s.hours>0) m[s.day]=(m[s.day]||0)+s.hours; }); schedByRes[id]=m; _seedOcc(id,m,t.id); });
      preview[t.id]={start:r.arranque, schedByRes};
    } else {
      const id=ids[0];
      // Find first free day for this resource considering accumulated occupancy
      const ffd=engineFirstFreeDay(id, minStart, occByRes);
      const r=enginePlaceResource(t, id, ffd, occByRes[id]||{});
      const m={}; r.segs.forEach(s=>m[s.day]=(m[s.day]||0)+s.hours); _seedOcc(id,m,t.id);
      // Seed co-resources so they consume capacity in occByRes
      const coIds=(t.coResIds||[]).filter(Boolean);
      const schedByRes={[id]:m};
      coIds.forEach(coId=>{
        const coHours=t.resHours?.[coId]||0; if(coHours<=0) return;
        const coFfd=engineFirstFreeDay(coId, minStart, occByRes);
        const coR=enginePlaceResource({...t,resId:coId,hours:coHours}, coId, coFfd, occByRes[coId]||{});
        const coM={}; coR.segs.forEach(s=>coM[s.day]=(coM[s.day]||0)+s.hours); _seedOcc(coId,coM,t.id);
        schedByRes[coId]=coM;
      });
      preview[t.id]={start:r.segs[0]?.day||ffd, schedByRes};
    }
    if(usesSimulated) conflicts.push({type:'DEPENDE_DE_RECURSO_SIMULADO', taskId:t.id, detail:`"${t.name}" usa recurso(s) simulado(s) — requer contratação`});
  });

  return {preview, conflicts, count:Object.keys(preview).length, _occByRes:occByRes};
}

// ── DEBUG: log occupation for a specific resource after simulation ──
function _debugSimOcc(sim, resId, dayIdx){
  const res=getRes(resId);
  const cap=res?.dailyCap||HPD;
  console.group(`[SIM DEBUG] Resource: ${res?.name||resId} | Day idx: ${dayIdx} (${sd(dayIdx)}) | dailyCap: ${cap}h`);
  let totalOnDay=0;
  Object.entries(sim.preview).forEach(([taskId, p])=>{
    const t=TASKS.find(x=>x.id===taskId); if(!t) return;
    // Check primary sched
    Object.entries(p.schedByRes||{}).forEach(([rid, sched])=>{
      if(rid!==resId) return;
      const h=sched[dayIdx]||0;
      if(h>0.001){
        totalOnDay+=h;
        console.log(`  TASK "${t.name}" (${taskId}) → ${h}h [schedByRes primary]`);
      }
    });
  });
  console.log(`  ─── TOTAL on day ${sd(dayIdx)}: ${totalOnDay}h (cap: ${cap}h, over by: ${Math.max(0,totalOnDay-cap)}h)`);
  // Also check occByRes snapshot — need to re-run to get it, so show raw preview totals
  console.groupEnd();
}

// Apply a simulation preview to the live tasks. Admin-only. Mutates TASKS.
function applySimulation(sim){
  if(!sim||!sim.preview) return;
  // Clear previous simulation schedule from all tasks before applying new one
  TASKS.forEach(t=>{ delete t.sched; delete t.schedCo; delete t._sched; delete t._schedCo; delete t._computedStart; });
  Object.entries(sim.preview).forEach(([taskId,p])=>{
    const t=TASKS.find(x=>x.id===taskId); if(!t) return;
    t.start=p.start||t.start;
    // Write per-resource schedule; primary _sched + co _schedCo
    const ids=Object.keys(p.schedByRes||{});
    const primary=t.resId&&p.schedByRes[t.resId]?t.resId:ids[0];
    if(primary){
      t._sched=p.schedByRes[primary]||{};
      t.sched=t._sched; // persist
    }
    t._schedCo=t._schedCo||{};
    t.schedCo=t.schedCo||{};
    ids.forEach(id=>{
      if(id!==primary){
        t._schedCo[id]=p.schedByRes[id];
        t.schedCo[id]=p.schedByRes[id]; // persist
      }
    });
    // recompute dur from sched span
    const days=Object.keys(t._sched||{}).map(Number);
    if(days.length){ t.dur=Math.max(1, Math.max(...days)-Math.min(...days)+1); }
    // Clear cached render position
    delete t._computedStart;
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
    // DEBUG: log full over-allocation report
    console.group('[SIM DEBUG] Over-allocation report after simulation');
    const occ=_simPreview._occByRes||{};
    let found=false;
    Object.entries(occ).forEach(([resId,days])=>{
      const cap=getRes(resId)?.dailyCap||HPD;
      Object.entries(days).forEach(([d,h])=>{
        if(h>cap+0.001){
          found=true;
          console.warn(`  Res: ${getRes(resId)?.name||resId} | Day: ${sd(+d)} | cap: ${cap}h | allocated: ${h}h | over: ${(h-cap).toFixed(2)}h`);
          // List all tasks contributing to this day
          Object.entries(_simPreview.preview).forEach(([tid,p])=>{
            const contrib=(p.schedByRes?.[resId]||{})[+d]||0;
            if(contrib>0.001){
              const t=TASKS.find(x=>x.id===tid);
              console.log(`    → task "${t?.name||tid}": ${contrib}h`);
            }
          });
        }
      });
    });
    if(!found) console.log('  No over-allocations found.');
    console.groupEnd();
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

  // Pre-compute: for each resource, which future days have schedulable tasks available
  const _eligibleByRes={};
  TASKS.forEach(t=>{
    if(t.status==='done'||t.status==='cancelled'||t.timeMode==='daily') return;
    if(isProjOnHold(t.projId)) return;
    // Include doing/paused only if they have dependencies (otherwise they are anchors at today)
    const isDoing=t.status==='doing'||t.status==='paused';
    const hasDep=t.depType==='task'&&([...(t.depIds||[]),t.depId].filter(Boolean).length>0);
    if(!isDoing&&t.sched) return; // non-doing tasks already applied — skip
    if(isDoing&&!hasDep) return;  // pure anchor — always starts today, not a warning candidate
    const ids=[t.resId,...(t.coResIds||[])].filter(Boolean);
    const ms=engineMinStart(t);
    ids.forEach(resId=>{
      if(!_eligibleByRes[resId]) _eligibleByRes[resId]=[];
      _eligibleByRes[resId].push(ms);
    });
  });

  // 1 & 2 — Daily cap exceeded / underfilled, per resource per day
  Object.entries(occ).forEach(([resId,days])=>{
    const res=getRes(resId); if(!res) return;
    const futureDays=Object.keys(days).map(Number).filter(d=>d>=GANTT_TODAY).sort((a,b)=>a-b);
    if(!futureDays.length) return;
    const lastDay=futureDays[futureDays.length-1];
    Object.entries(days).forEach(([d,h])=>{
      const day=+d;
      if(day<GANTT_TODAY) return;
      const cap=dayCapacity(resId,day).hours;
      if(cap<=0) return;
      if(h>cap+0.01){
        warns.push({type:'CAP_EXCEEDED', resId, day, detail:`${res.name}: ${_fmtH(h)} allocated on ${sd(day)} (capacity ${_fmtH(cap)})`});
      } else if(h>0.01 && h<cap-0.01){
        if(day===lastDay) return;
        // Only warn if there's an eligible task that could have been placed on this day
        const canFill=(_eligibleByRes[resId]||[]).some(ms=>ms<=day);
        if(!canFill) return;
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

// DEBUG helper: call window._debugDayLoad('resId', 'YYYY-MM-DD') in console
window._debugDayLoad=(resId, dateStr)=>{
  const dayIdx=dateToIdx(dateStr);
  const cap=getRes(resId)?.dailyCap||HPD;
  console.group(`[DAY LOAD DEBUG] Res: ${getRes(resId)?.name||resId} | ${dateStr} (idx ${dayIdx}) | cap: ${cap}h`);
  let total=0;
  TASKS.forEach(t=>{
    if(t.status==='done'||t.status==='cancelled'||!t.start) return;
    if(t.resId===resId && t._sched){
      const h=t._sched[dayIdx]||0;
      if(h>0.001){ total+=h; console.log(`  PRIMARY  "${t.name}" (${t.id}) _schedLocked:${!!t._schedLocked} → ${h}h`); }
    } else if((t.coResIds||[]).includes(resId) && t._schedCo?.[resId]){
      const h=t._schedCo[resId][dayIdx]||0;
      if(h>0.001){ total+=h; console.log(`  CO-RES   "${t.name}" (${t.id}) → ${h}h`); }
    }
  });
  console.log(`  TOTAL: ${total}h | over by: ${Math.max(0,total-cap).toFixed(2)}h`);
  console.groupEnd();
};

// Build exact per-day allocation for every task, per resource, in start-date order.
// Stores t._sched = {dayIdx: hours} — used by getDayLoad and the Gantt renderer.
function computeAllSchedules(){
  TASKS.forEach(t=>{ if(!t.sched){ t._sched=null; t._schedCo=null; } });
  const byRes={};
  const _coDayAlloc={};

  // Build _schedCo for daily tasks with co-resources AND seed _coDayAlloc
  TASKS.forEach(t=>{
    if(t.timeMode!=='daily') return;    if(t.status==='done'||t.status==='cancelled'||!t.start) return;
    if(t.sched) return; // simulation-applied — _schedCo already restored from schedCo
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

  // Build _schedCo for test tasks with co-resources
  TASKS.forEach(t=>{
    if(t.timeMode!=='test') return;
    if(t.status==='done'||t.status==='cancelled'||!t.start) return;
    if(t.sched) return; // simulation-applied
    const _coIds=(t.coResIds||[]).filter(Boolean);
    if(!_coIds.length) return;
    if(!t._schedCo) t._schedCo={};
    const _baseStart=Math.max(t.start||GANTT_TODAY, GANTT_TODAY);
    _coIds.forEach(coResId=>{
      const _totalH=t.resHours?.[coResId]||0;
      const _hpd=_totalH>0&&(t.dur||1)>0?Math.round(_totalH/(t.dur||1)*100)/100:0;
      if(!_hpd) return;
      const sched={};
      if(!_coDayAlloc[coResId]) _coDayAlloc[coResId]={};
      let day=nextWorkDay(_baseStart), placed=0, iters=0;
      while(placed<(t.dur||1)&&iters++<500){
        if(isNW(day,t.id,coResId)){day++;continue;}
        sched[day]=_hpd;
        _coDayAlloc[coResId][day]=(_coDayAlloc[coResId][day]||0)+_hpd;
        placed++; day++;
      }
      t._schedCo[coResId]=sched;
    });
  });

  TASKS.forEach(t=>{
    if(!t.resStart||!Object.keys(t.resStart).length) return;
    if(t.status==='done'||t.status==='cancelled') return;
    if(t.sched) return; // simulation-applied — _schedCo already restored from schedCo
    if(!t._schedCo) t._schedCo={};
    Object.entries(t.resStart).forEach(([coResId,coStart])=>{
      const coHours=t.resHours?.[coResId]||0;
      if(!coHours||coHours<=0||!coStart) return;
      const coCap=getRes(coResId)?.dailyCap||HPD;
      if(!_coDayAlloc[coResId]) _coDayAlloc[coResId]={};
      const dayAlloc=_coDayAlloc[coResId];
      const sched={};
      // Use engineRemaining so logged hours and 0.5h rounding are respected
      const coRem=engineRemaining({...t,resId:coResId,hours:coHours,resHours:{[coResId]:coHours}}, coResId);
      // Use max of today and task start — don't trust saved resStart dates
      const coMinDay=nextWorkDay(Math.max(GANTT_TODAY, t.start||GANTT_TODAY));
      let rem=coRem, day=coMinDay, iters=0;
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
    if(!t.resId||t.status==='done'||t.status==='cancelled'||t.status==='ready') return;
    if(t.sched) return; // schedule was applied by simulation — don't overwrite
    if(isProjOnHold(t.projId)) return; // ignore On Hold projects
    if((tHours(t)??0)===0){
      // 0h grouping task: update start/dur to span all descendants
      if(t.start){
        const _desc=_getDescAll(t.id);
        if(_desc.length){
          const _starts=_desc.map(ch=>ch.start).filter(Boolean);
          const _ends=_desc.map(ch=>tEnd(ch)).filter(Boolean);
          if(_starts.length){
            t.start=Math.min(..._starts);
            t.dur=Math.max(1,(Math.max(..._ends)-t.start+1));
          }
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
    // _coDayAlloc already includes tasks with sched (simulation-applied) — start from there
    const dayAlloc=Object.assign({},_coDayAlloc[resId]||{});
    // Add hours from _schedCo of tasks NOT yet in _coDayAlloc (non-sched co-resource tasks)
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

      if(t.timeMode==='test'){
        // Test Task: distribute resHours[resId]/dur per day for exactly dur days
        const _hpd=t.resHours?.[resId]>0&&t.dur>0?Math.round(t.resHours[resId]/t.dur*100)/100:0;
        if(_hpd<=0){ t._sched={}; return; }
        const _baseStart=Math.max(t.start||GANTT_TODAY, GANTT_TODAY);
        let day=nextWorkDay(_baseStart), placed=0, iters=0;
        while(placed<(t.dur||1) && iters++<500){
          if(isNW(day,t.id,resId)){day++;continue;}
          sched[day]=_hpd;
          dayAlloc[day]=(dayAlloc[day]||0)+_hpd;
          placed++; day++;
        }
        t._sched=sched;
        const _testDays=Object.keys(sched).map(Number);
        if(_testDays.length){
          t._computedStart=Math.min(..._testDays);
          if(!t.start) t.start=t._computedStart;
        }
        return;
      }

      // Total-hours task: delegate placement to the allocation engine.
      // Engine handles capacity, calendar blocks, partial time-offs and writes
      // an explainability record (_why). Non-destructive: works around dayAlloc.
      const baseStart = Math.max(t.start||GANTT_TODAY, GANTT_TODAY);
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
      if(_schedDays.length){
        t._computedStart=Math.min(..._schedDays);
        // If task had no start, assign it now so it renders and persists
        if(!t.start) t.start=t._computedStart;
      }
      // DEBUG: check if dayAlloc exceeded cap after placing this task
      Object.entries(sched).forEach(([d,h])=>{
        if((dayAlloc[+d]||0)>cap+0.001)
          console.warn(`[SCHED DEBUG] Over-alloc after placing task: Res ${getRes(resId)?.name||resId} | Day ${sd(+d)} | cap ${cap}h | dayAlloc now ${dayAlloc[+d]}h | task: "${t.name}" added ${h}h`);
      });
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
  const contBtn=document.getElementById('tt-cont');
  const testBtn=document.getElementById('tt-test');
  const isCont=!contBtn||contBtn.checked;
  const isTest=testBtn&&testBtn.checked;
  const allEntries=_taskTeams.flatMap(tt=>tt.entries);
  if(!allEntries.length) return;
  if(isTest) return; // Test Task: each resource has its own h/day — don't auto-distribute
  if(!htot) return;
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
  document.getElementById('fg-dep-group').style.display=v==='group'?'':'none';
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
  if(v==='group'){
    const sel=document.getElementById('mt-dep-group-id');
    // Get unique groups from tasks in the same project
    const projId=document.getElementById('mt-proj')?.value||null;
    const groups=[...new Set(TASKS.filter(t=>!projId||t.projId===projId).map(t=>t.group).filter(Boolean))].sort();
    sel.innerHTML='<option value="">— select group —</option>'+groups.map(g=>`<option value="${g}">${g}</option>`).join('');
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
  ['fg-dep-task','fg-dep-group','fg-dep-res','fg-dep-until','fg-dep-milestone','fg-dep-note'].forEach(id=>document.getElementById(id).style.display='none');
  document.getElementById('mt-dep-ms-id').value='';
  const _dg=document.getElementById('mt-dep-group-id'); if(_dg) _dg.value='';
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
  } else if(dt==='group'){
    const sel=document.getElementById('mt-dep-group-id');
    const projId=t.projId||null;
    const groups=[...new Set(TASKS.filter(x=>!projId||x.projId===projId).map(x=>x.group).filter(Boolean))].sort();
    sel.innerHTML='<option value="">— select group —</option>'+groups.map(g=>`<option value="${g}" ${g===t.depGroup?'selected':''}>${g}</option>`).join('');
    document.getElementById('fg-dep-group').style.display='';
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
    _ps.innerHTML='<option value="">— project —</option>'+PROJECTS.filter(p=>p.status!=='on_hold'&&p.status!=='cancelled').map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    // Auto-select active project from selector, else first project
    _ps.value=S._activeProjId||(PROJECTS.find(p=>p.status!=='on_hold'&&p.status!=='cancelled')?.id||'');
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
  if(_ps2){ _ps2.innerHTML='<option value="">— project —</option>'+PROJECTS.filter(p=>p.status!=='on_hold'&&p.status!=='cancelled').map(p=>`<option value="${p.id}">${p.name}</option>`).join(''); _ps2.value=t.projId||S._activeProjId||''; }
  const _isCont=!t.timeMode||t.timeMode==='total';
  const _isTest=t.timeMode==='test';
  // setTaskType called below after all fields are populated
  if(t.timeMode==='daily'&&t.start){ const _sd=gDate(t.start),_ed=gDate(t.start+(t.dur||1)-1);const _fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const _sse=document.getElementById('mt-s-date');const _ese=document.getElementById('mt-e-date');if(_sse)_sse.value=_fmt(_sd);if(_ese)_ese.value=_fmt(_ed); }
  document.getElementById('mt-n').value=t.name;
  document.getElementById('mt-tag').value=(t.tags||[]).join(', ');
  const _gsel2=document.getElementById('mt-group');if(_gsel2)_gsel2.value=t.group||'';
  // Always populate both panels with their respective stored values (or defaults)
  const _contHours=t.timeMode!=='daily'?(t.hours??8):(t.contHours??8);
  const _dailyHpd=t.timeMode==='daily'?(t.hpd!=null?t.hpd:0):(t.dailyHpd??0);
  const _testHours=t.timeMode==='test'?(t.hours??8):8;
  document.getElementById('mt-h-tot').value=_contHours;
  document.getElementById('mt-h-day').value=_dailyHpd;
  const _testEl=document.getElementById('mt-h-test'); if(_testEl) _testEl.value=_testHours;
  const _durEl=document.getElementById('mt-dur-test'); if(_durEl) _durEl.value=t.timeMode==='test'?(t.dur||1):Math.max(1,Math.round(_testHours/8));
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
  setTaskType(t.timeMode==='daily'?'daily':t.timeMode==='test'?'test':'continuous');
  toggleHoldFields();
  // Reconstruct _taskTeams from saved taskTeams or legacy resId/coResIds
  if(t.taskTeams&&t.taskTeams.length){
    _taskTeams=JSON.parse(JSON.stringify(t.taskTeams));
    // For Test tasks, convert stored resHours (total) to h/day for display
    if(t.timeMode==='test'&&(t.dur||1)>1){
      const _d=t.dur||1;
      _taskTeams.forEach(tt=>tt.entries.forEach(e=>{ e.hours=Math.round((e.hours||0)/_d*10)/10; }));
    }
    // If resources have unequal hours or any non-zero hours, treat as manually set
    const _allE=_taskTeams.flatMap(tt=>tt.entries);
    if(_allE.length>1){
      const _firstH=_allE[0].hours;
      if(_allE.some(e=>Math.abs(e.hours-_firstH)>0.01)||_allE.some(e=>e.hours>0)) _hoursManuallySet=true;
    }
  } else {
    // Migrate legacy format
    const resHours=t.resHours||{};
    const _isTestLoad=t.timeMode==='test';
    const _loadDur=_isTestLoad?(t.dur||1):1;
    const allIds=[t.resId,...(t.coResIds||[])].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i);
    const teamMap={};
    allIds.forEach(rid=>{
      const r=getRes(rid); if(!r) return;
      const teamId=(r.teams||[])[0]||'__unknown__';
      if(!teamMap[teamId]) teamMap[teamId]=[];
      // For Test tasks show h/day (total ÷ dur), for others show total
      const hDisplay=_isTestLoad?Math.round((resHours[rid]||0)/_loadDur*10)/10:(resHours[rid]||0);
      teamMap[teamId].push({id:rid,hours:hDisplay});
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
  const _testDur=tm==='test'?Math.max(1,parseInt(document.getElementById('mt-dur-test')?.value)||1):1;
  const _testHours=tm==='test'?0:0; // hours calculated from resHours after saving
  const htot=tm==='test'?_testHours:(parseFloat(document.getElementById('mt-h-tot').value)||0);
  const dur=tm==='test'?_testDur:(parseInt(document.getElementById('mt-d').value)||1);
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
  if(tm==='test'){
    allEntries.forEach(e=>{ if(e.id) resHours[e.id]=(e.hours||0)*_testDur; });
  } else {
    allEntries.forEach(e=>{ if(e.id) resHours[e.id]=e.hours||0; });
  }
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
  const depGroup=depType==='group'?(document.getElementById('mt-dep-group-id').value||null):null;
  const depNote=depType?(document.getElementById('mt-dep-note').value||null):null;
  const data={name,tags,projId,resId,coResIds,resHours,resource,taskTeams:_taskTeams,teamId,teamIds,
    group,
    status:(()=>{ const s=document.getElementById('mt-stat').value; const t2=TASKS.find(x=>x.id===S.editId); return (t2&&(t2.status==='doing'||t2.status==='paused'))?t2.status:s; })(),
    timeMode:tm, hpd:tm==='daily'?hpd:null,
    hours:tm==='test'?Object.values(resHours).reduce((s,h)=>s+h,0):hours,
    contHours:tm!=='daily'&&tm!=='test'?htot:(_existingTask?.contHours??8),
    dailyHpd:tm==='daily'?hpd:(_existingTask?.dailyHpd??0),
    weekdays:(()=>{ if(tm!=='daily') return null; const btns=document.querySelectorAll('#mt-weekdays .wd-btn'); return [...btns].filter(b=>b.classList.contains('on')).map(b=>parseInt(b.dataset.d)); })(),
    start:(()=>{
      if(tm==='test'){ const _ex=S.editId?TASKS.find(x=>x.id===S.editId):null; return _ex?.start||null; }
      const _cb=document.getElementById('tt-cont');const _isCont=!_cb||_cb.checked;
      if(_isCont){const _rid=document.getElementById('mt-res-id').value;const _ex=S.editId?TASKS.find(x=>x.id===S.editId):null;return _ex?.start||_nextFreeDay(_rid);}
      const _sd=document.getElementById('mt-s-date')?.value;return _sd?dateToIdx(_sd):null;
    })(),
    dur:(()=>{
      if(tm==='test') return _testDur;
      const _cb=document.getElementById('tt-cont');const _isCont=!_cb||_cb.checked;
      if(_isCont){const _rid=allEntries[0]?.id||document.getElementById('mt-res-id').value;const _mainH=allEntries.length>1&&allEntries[0]?.hours>0?allEntries[0].hours:(parseFloat(document.getElementById('mt-h-tot').value)||8);return Math.max(1,Math.ceil(_mainH/(getRes(_rid)?.dailyCap||HPD)));}
      const _sd=document.getElementById('mt-s-date')?.value,_ed=document.getElementById('mt-e-date')?.value;
      if(_sd&&_ed){const _si=dateToIdx(_sd),_ei=dateToIdx(_ed);return Math.max(1,_ei-_si+1);}
      const _ex=S.editId?TASKS.find(x=>x.id===S.editId):null;return _ex?.dur||1;
    })(),
    prog:parseInt(document.getElementById('mt-p').value)||0,
    deadline:document.getElementById('mt-dl').value||null,
    notes:document.getElementById('mt-notes').value,
    depType, depId, depIds, depResId, depUntil, depMsId, depGroup, depNote,
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
    // Manual edit invalidates the simulation schedule — force recalculation
    delete t.sched; delete t.schedCo; delete t._sched; delete t._schedCo; delete t._computedStart;
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

// ============================================================
// LOG TIME
// ============================================================
function openLogTime(taskId){
  S.logId=taskId;
  const t=taskId?TASKS.find(x=>x.id===taskId):null;
  document.getElementById('ml-ts').textContent=t?t.name:'Select a task';
  document.getElementById('ml-t-inp').value=t?t.name:'';
  document.getElementById('ml-t-id').value=taskId||'';
  document.getElementById('ml-date').value=idxToDate(GANTT_TODAY);
  document.getElementById('ml-h').value=1;
  document.getElementById('ml-notes').value='';
  OM('m-log');
}
window.openLogTime=openLogTime;
window.saveLog=()=>{
  const taskId=document.getElementById('ml-t-id').value;
  const t=TASKS.find(x=>x.id===taskId);
  if(!t){notify('Select a task','warn');return;}
  const h=parseFloat(document.getElementById('ml-h').value)||0;
  if(h<=0){notify('Hours > 0 required','warn');return;}
  t.timeLogs=t.timeLogs||[];
  t.timeLogs.push({date:document.getElementById('ml-date').value,hours:h,notes:document.getElementById('ml-notes').value,user:'Pedro Pereira'});
  if(t.status==='todo') t.status='paused'; // manual log = work done, task is paused (not actively timing)
  addLog({type:'timelog',task:t.name,from:'',to:`${_fmtHours(h)} logged on ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}`});
  notify(`${h}h logged on "${t.name}"`,'success');
  CM('m-log');renderGantt();renderDash();_refreshOverview();
  persistState(['tasks'],{tasks:[taskId]});
};

// ============================================================
// SPLIT
// ============================================================
function openSplit(taskId){
  const t=TASKS.find(x=>x.id===taskId);
  if(!t){return;}
  const tot=tHours(t);
  if(tot<16){notify('Need ≥16h to split','warn');return;}
  S.splitId=taskId;
  document.getElementById('ms-inf').textContent=`"${t.name}" — ${tot}h`;
  const half=Math.round(tot/2);
  document.getElementById('ms-ah').value=half;
  document.getElementById('ms-bh').value=tot-half;
  document.getElementById('ms-gap').value=1;
  updSplitPrev();
  OM('m-split');
}
function updSplitPrev(){
  const t=TASKS.find(x=>x.id===S.splitId);
  if(!t) return;
  const tot=tHours(t);
  const ah=parseFloat(document.getElementById('ms-ah').value)||0;
  const bh=parseFloat(document.getElementById('ms-bh').value)||0;
  const gap=parseInt(document.getElementById('ms-gap').value)||0;
  const ok=Math.round(ah+bh)===Math.round(tot);
  document.getElementById('ms-ck').innerHTML=ok?`<span style="color:var(--acc3)">✓ ${tot}h</span>`:`<span style="color:var(--warn)">⚠ ${ah+bh}h ≠ ${tot}h</span>`;
  const ad=Math.ceil(ah/HPD),bd=Math.ceil(bh/HPD),s=t.start||1;
  document.getElementById('ms-prev').textContent=`A: ${sd(s)}–${sd(s+ad-1)} (${ah}h) + ${gap}d + B: ${sd(s+ad+gap)}–${sd(s+ad+gap+bd-1)} (${bh}h)`;
}
window.syncSB=()=>{ const t=TASKS.find(x=>x.id===S.splitId); if(t){const a=parseFloat(document.getElementById('ms-ah').value)||0;document.getElementById('ms-bh').value=Math.max(0,tHours(t)-a);updSplitPrev();}};
window.syncSA=()=>{ const t=TASKS.find(x=>x.id===S.splitId); if(t){const b=parseFloat(document.getElementById('ms-bh').value)||0;document.getElementById('ms-ah').value=Math.max(0,tHours(t)-b);updSplitPrev();}};
window.confirmSplit=()=>{
  const t=TASKS.find(x=>x.id===S.splitId);
  if(!t) return;
  const tot=tHours(t),ah=parseFloat(document.getElementById('ms-ah').value)||0,bh=parseFloat(document.getElementById('ms-bh').value)||0,gap=parseInt(document.getElementById('ms-gap').value)||0;
  if(Math.round(ah+bh)!==Math.round(tot)){notify(`Parts must sum to ${tot}h`,'warn');return;}
  const ad=Math.ceil(ah/HPD),bd=Math.ceil(bh/HPD),s=t.start||1;
  t.segments=[{start:s,dur:ad,hours:ah},{start:s+ad+gap,dur:bd,hours:bh}];
  t.dur=ad+gap+bd;
  addLog({type:'split',task:t.name,from:`${tot}h total`,to:`Part A: ${ah}h · Part B: ${bh}h · gap: ${gap}d`});
  notify('Task split','success');
  CM('m-split');renderGantt();
};

// ============================================================
// PROJECT DEADLINE
// ============================================================
window.saveProjDl=()=>{
  const dl=document.getElementById('proj-dl-inp').value||null;
  PROJ.deadline=dl;
  // Also persist deadline on the matching PROJECTS entry
  const activeProjId=S._activeProjId||(PROJECTS.length?PROJECTS[0].id:null);
  const proj=PROJECTS.find(p=>p.id===activeProjId)||PROJECTS[0];
  if(proj) proj.deadline=dl;
  addLog({type:'project',task:PROJ?.name||'Project',from:'',to:'deadline: '+(dl||'cleared')});
  persistState(['projects','meta']);
  CM('m-proj');renderGantt();
  notify('Deadline saved','success');
};

// ============================================================
// CHANGE LOG
// ============================================================
const GLOG=[];
const LOG_TTL=55000;
const LICO={move:'→',cascade:'↷',resize:'↔',split:'⌥',status:'◉',timelog:'⏱',create:'✚',edit:'✎',delete:'✕',calendar:'📅',overdue:'⚠'};
const LCOL={move:'var(--acc)',cascade:'var(--warn)',resize:'var(--fg1)',split:'var(--acc3)',status:'var(--ok)',timelog:'#a78bfa',create:'var(--ok)',edit:'var(--fg2)',overdue:'var(--danger)',calendar:'var(--fg2)'};
function addLog(e){
  GLOG.unshift({...e,ts:Date.now(),user:S_USER?.name||'—',time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})});
  if(GLOG.length>500) GLOG.pop();
  renderLog();
  if(S.page==='logs') renderLogsPage();
  clearTimeout(window._lt); window._lt=setTimeout(renderLog,LOG_TTL+500);
  // Persist to Firebase
  clearTimeout(addLog._ft);
  addLog._ft=setTimeout(async()=>{
    try{
      await fetch(_FB_ROOT+'/logs.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(GLOG.slice(0,500))});
    }catch(e){}
  }, 800);
}
function renderLog(){
  const el=document.getElementById('glog'),le=document.getElementById('log-e');
  if(!el||!le) return;
  if(!GLOG.length){el.style.display='none';return;}
  el.style.display='block';
  const now=Date.now();
  const rec=GLOG.filter(e=>now-e.ts<LOG_TTL);
  const show=rec.length?rec:GLOG.slice(0,1);
  le.innerHTML=show.map(e=>`<div style="display:flex;align-items:baseline;gap:5px;padding:1px 0;border-bottom:1px solid rgba(37,47,69,.3);font-size:10px;font-family:var(--mono)">
    <span style="color:var(--fg3)">${e.time}</span>
    <span style="color:${LCOL[e.type]||'var(--fg2)'}">${LICO[e.type]||'·'}</span>
    <span style="color:var(--fg0);font-weight:500">${e.task}</span>
    <span style="color:var(--fg2)">${e.from?e.from+' → ':''}<span style="color:var(--fg1)">${e.to}</span></span>
  </div>`).join('');
}
window.clearLog=()=>{
  GLOG.length=0; renderLog();
  fetch(_FB_ROOT+'/logs.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:'[]'}).catch(()=>{});
};
window.openFullLog=()=>{
  document.getElementById('flog-l').innerHTML=GLOG.length?GLOG.map(e=>`<div style="display:flex;align-items:baseline;gap:7px;padding:5px 12px;border-bottom:1px solid rgba(37,47,69,.3);font-size:10px"><span style="color:var(--fg3);min-width:40px">${e.time}</span><span style="color:${LCOL[e.type]||'var(--fg2)'}">${LICO[e.type]||'·'}</span><span style="color:var(--fg0);font-weight:500">${e.task}</span><span style="color:var(--fg2)">${e.from?e.from+' → ':''}<span style="color:var(--fg1)">${e.to}</span></span></div>`).join(''):'<div style="padding:14px;font-size:11px;color:var(--fg3)">No entries</div>';
  OM('m-flog');
};

// ============================================================
// TABLE VIEW (no time tracking, with delete)
// ============================================================
function buildTagSel(){
  const tags=allTags();
  ['tv-tag'].forEach(id=>{
    const el=document.getElementById(id);if(!el) return;
    const cur=el.value;
    el.innerHTML='<option value="">All tags</option>'+tags.map(t=>`<option value="${t}">${t}</option>`).join('');
    el.value=cur;
  });
}
function renderTable(){
  buildTagSel();
  const search=(document.getElementById('tv-s')?.value||'').toLowerCase();
  const tagF=document.getElementById('tv-tag')?.value||'';
  const incOnly=document.getElementById('tv-inc')?.checked;
  const tasks=TASKS.filter(t=>{
    if(search&&!t.name.toLowerCase().includes(search)) return false;
    if(tagF&&!(t.tags||[]).includes(tagF)) return false;
    if(incOnly&&!isInc(t)) return false;
    return true;
  });

  const H=`<table class="dt" style="min-width:900px">
    <thead><tr>
      <th style="width:28px">#</th>
      <th style="min-width:200px">Task name</th>
      <th style="width:80px">Tag</th>
      <th style="width:110px">Team</th>
      <th style="width:120px">Resource</th>
      <th style="width:50px">Hrs</th>
      <th style="width:45px">Mode</th>
      <th style="width:50px">Start</th>
      <th style="width:45px">Dur</th>
      <th style="width:50px">Prog%</th>
      <th style="width:95px">Status</th>
      <th style="width:95px">Deadline</th>
      <th style="width:30px"></th>
    </tr></thead>
    <tbody>
    ${tasks.map((t,i)=>{
      const inc=isInc(t);
      const incStyle=inc?'background:rgba(240,169,40,.04)':'';
      return `<tr style="${incStyle}">
        <td class="tc txs">${i+1}${inc?'<span style="color:var(--warn);margin-left:2px" title="Incomplete">⚠</span>':''}</td>
        <td style="max-width:200px"><input class="ie" value="${t.name.replace(/"/g,'&quot;')}" onchange="uTask('${t.id}','name',this.value)" style="min-width:190px"></td>
        <td><input class="ie" value="${(t.tags||[]).join(', ')}" onchange="uTask('${t.id}','tags',this.value.split(',').map(x=>x.trim()).filter(Boolean))" style="width:75px"></td>
        <td><select class="ie" onchange="uTask('${t.id}','teamId',this.value)" style="width:105px">
          <option value="">—</option>
          ${TEAMS.map(tm=>`<option value="${tm.id}" ${t.teamId===tm.id?'selected':''}>${tm.name}</option>`).join('')}
        </select></td>
        <td><select class="ie" onchange="uTask('${t.id}','resId',this.value);uTask('${t.id}','resource',RESOURCES.find(r=>r.id===this.value)?.name||'')" style="width:115px">
          <option value="">—</option>
          ${RESOURCES.map(r=>`<option value="${r.id}" ${t.resId===r.id?'selected':''}>${r.name}</option>`).join('')}
        </select></td>
        <td><input class="ie" type="number" value="${tHours(t)}" onchange="uTask('${t.id}','hours',+this.value)" style="width:44px"></td>
        <td style="font-size:9px;color:var(--fg2)">${t.timeMode==='daily'?'Daily':'Total'}</td>
        <td><input class="ie" type="number" value="${t.start||GANTT_TODAY}" onchange="uTask('${t.id}','start',+this.value)" style="width:44px"></td>
        <td><input class="ie" type="number" value="${t.dur||1}" onchange="uTask('${t.id}','dur',+this.value)" style="width:40px"></td>
        <td><input class="ie" type="number" value="${t.prog||0}" min="0" max="100" onchange="uTask('${t.id}','prog',+this.value)" style="width:44px"></td>
        <td><select class="ie" onchange="uTask('${t.id}','status',this.value)" style="width:90px">
          ${Object.entries(SLABELS).map(([v,l])=>`<option value="${v}" ${t.status===v?'selected':''}>${l}</option>`).join('')}
        </select></td>
        <td><input class="ie" type="date" value="${t.deadline||''}" onchange="uTask('${t.id}','deadline',this.value)" style="width:90px"></td>
        <td><button class="btn btn-xs btn-d" onclick="delTask('${t.id}')" title="Delete">✕</button></td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
  document.getElementById('tv').innerHTML=H;
}
// uTask and delTask defined in persistence section below

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
    _rpSel.innerHTML='<option value="">All projects</option>'
      +'<option value="__active__">All active / planning</option>'
      +PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    _rpSel.value=_cur;
  }
  const _rpProjId=_rpSel?.value||'';
  const rptTasks=_rpProjId==='__active__'
    ? TASKS.filter(t=>{ const p=PROJECTS.find(x=>x.id===t.projId); return p&&(p.status==='active'||p.status==='planning'); })
    : _rpProjId?TASKS.filter(t=>t.projId===_rpProjId):TASKS;

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
  const ph=Math.round(rptTasks.filter(t=>t.status!=='done'&&t.status!=='cancelled').reduce((s,t)=>s+tHours(t),0));
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


// ============================================================
// RESOURCES PAGE
// ============================================================
// ── RESOURCES TABLE SORT ─────────────────────────────────────────
let _resSort = {col: null, dir: 1}; // dir: 1=asc, -1=desc

window.sortRes = (col) => {
  if(_resSort.col === col) _resSort.dir *= -1;
  else { _resSort.col = col; _resSort.dir = 1; }
  renderRes();
};

function _getSortedResources(){
  const {col, dir} = _resSort;
  if(!col) return RESOURCES.map((r,i)=>({r,i}));
  return RESOURCES.map((r,i)=>({r,i})).sort((a,b)=>{
    let va, vb;
    if(col==='tasks'){
      va = TASKS.filter(t=>t.resId===a.r.id).length;
      vb = TASKS.filter(t=>t.resId===b.r.id).length;
    } else {
      va = (a.r[col]||'').toString().toLowerCase();
      vb = (b.r[col]||'').toString().toLowerCase();
    }
    if(va < vb) return -dir;
    if(va > vb) return dir;
    return 0;
  });
}

function _updateResSortHeaders(){
  ['name','role','dailyCap','tasks'].forEach(col=>{
    const el = document.getElementById('res-sh-'+col);
    if(!el) return;
    const isActive = _resSort.col === col;
    const arrow = isActive ? (_resSort.dir===1 ? ' ↑' : ' ↓') : '';
    el.textContent = {name:'Name',role:'Role',dailyCap:'Daily cap (h)',tasks:'Tasks'}[col] + arrow;
    el.parentElement.style.color = isActive ? 'var(--acc)' : '';
  });
}

function renderRes(){
  const sorted = _getSortedResources();
  document.getElementById('res-b').innerHTML=sorted.map(({r,i})=>`<tr>
    <td><input class="ie" value="${r.name}" onchange="uRes(${i},'name',this.value)" style="min-width:130px"></td>
    <td><input class="ie" value="${r.role||''}" onchange="uRes(${i},'role',this.value)" style="min-width:95px"></td>
    <td><div style="display:flex;gap:3px;flex-wrap:wrap;align-items:center">
      ${TEAMS.map(t=>`<label style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:var(--fg2);cursor:pointer;white-space:nowrap">
        <input type="checkbox" ${(r.teams||[]).includes(t.id)?'checked':''} onchange="toggleResTeam(${i},'${t.id}',this.checked)" style="accent-color:${t.color}">
        <span style="width:5px;height:5px;border-radius:1px;background:${t.color}"></span>${t.name.split(' ')[0]}
      </label>`).join('')}
    </div></td>
    <td><input class="ie" type="number" value="${r.dailyCap||8}" min="1" max="24" onchange="uRes(${i},'dailyCap',+this.value)" style="width:50px"></td>
    <td style="text-align:center"><button onclick="RESOURCES[${i}].showInDash=!(RESOURCES[${i}].showInDash!==false);persistState(['resources']);renderRes();renderDash();" title="Show/hide in workload gauges" style="background:none;border:none;cursor:pointer;font-size:15px;line-height:1;opacity:${r.showInDash===false?0.2:1}">${r.showInDash===false?'🚫':'👁'}</button></td>
    <td class="mono txs">${TASKS.filter(t=>t.resId===r.id).length}</td>
    <td class="mono txs" title="Vacation days this year: remaining / total">${(()=>{
      const _yr=new Date().getFullYear();
      const _todayStr=new Date().toISOString().slice(0,10);
      let _total=0, _taken=0;
      [...(r.timeOff||[]),...(COLLECTIVE_HOLIDAYS||[])].forEach(to=>{ // personal + collective
        if(!to.start||!to.end) return;
        const s=new Date(to.start+'T12:00:00'), e=new Date(to.end+'T12:00:00');
        if(s.getFullYear()!==_yr&&e.getFullYear()!==_yr) return;
        const _sD=new Date(Math.max(s,new Date(_yr+'-01-01T12:00:00')));
        const _eD=new Date(Math.min(e,new Date(_yr+'-12-31T12:00:00')));
        for(let d=new Date(_sD);d<=_eD;d.setDate(d.getDate()+1)){
          const dw=d.getDay();
          if(dw===0||dw===6) continue;
          _total++;
          const _dStr=d.toISOString().slice(0,10);
          if(_dStr<_todayStr) _taken++; // strictly before today = gozado
        }
      });
      if(!_total) return '—';
      const _rem=_total-_taken;
      return `<span style="color:${_rem===0?'var(--ok)':_rem<5?'var(--warn)':'var(--fg0)'}">${_rem}</span><span style="color:var(--fg3)">/${_total}</span>`;
    })()}</td>
    <td style="display:flex;gap:4px;align-items:center">
      <button class="btn btn-xs" onclick="adminResetPw('${r.id}')" title="Repor palavra-passe">🔑</button>
      ${r.id!=='pp'?`<button class="btn btn-xs" id="admin-btn-${r.id}" onclick="adminToggleAdminUI('${r.id}')" title="Toggle admin" style="font-size:10px">${(_adminMap.get(r.id)||r._isAdmin)?'★ Admin':'☆'}</button>`:'<span style="font-size:9px;color:var(--acc)">ADMIN</span>'}
      <button class="btn btn-xs" onclick="openTimeOff('${r.id}')" title="Time Off">🏖</button>
      <button class="btn btn-xs" onclick="RESOURCES[${i}].simulated=!RESOURCES[${i}].simulated;persistState(['resources']);renderRes();" title="${r.simulated?'Simulated (hypothetical) resource — click to make real':'Real resource — click to mark as simulated'}" style="${r.simulated?'background:rgba(240,169,40,.15);border-color:var(--warn)':''}">${r.simulated?'👻':'👤'}</button>
      <button class="btn btn-xs btn-d" onclick="delRes('${r.id}')">✕</button>
    </td>
  </tr>`).join('');
  _updateResSortHeaders();
}
window.adminToggleAdminUI=async(resId)=>{
  const newAdmin=await adminToggleAdmin(resId);
  const r=getRes(resId); if(r) r._isAdmin=newAdmin===true;
  _adminMap.set(resId,newAdmin===true);
  renderRes();
};
function toggleResTeam(i,teamId,checked){
  if(!RESOURCES[i].teams) RESOURCES[i].teams=[];
  if(checked){ if(!RESOURCES[i].teams.includes(teamId)) RESOURCES[i].teams.push(teamId); }
  else RESOURCES[i].teams=RESOURCES[i].teams.filter(x=>x!==teamId);
  const tm=getTeam(teamId);
  addLog({type:'resource',task:RESOURCES[i].name,from:'',to:(checked?'added to ':'removed from ')+(tm?.name||teamId)});
  persistState(['resources']);
}
window.addRes=()=>{
  const defaultName='New Resource';
  RESOURCES.push({id:'r'+Date.now(),name:defaultName,initials:_getInitials(defaultName),avClass:'av-b',teams:[],role:'',dailyCap:8});
  addLog({type:'resource',task:defaultName,from:'',to:'created'});
  persistState(['resources']); renderRes();
};
window.delRes=(id)=>{
  if(!confirm('Delete resource?')) return;
  const _dr=getRes(id);
  addLog({type:'resource',task:_dr?.name||id,from:'',to:'deleted'});
  _deletedIds.resources.add(id);
  RESOURCES=RESOURCES.filter(r=>r.id!==id);
  persistState(['resources']); renderRes();
};

// ============================================================
// PROJECTS PAGE
// ============================================================
const PROJ_STAT_LABELS={active:'Active',planning:'Planning',on_hold:'On Hold',completed:'Completed',cancelled:'Cancelled'};
const PROJ_STAT_COLS={active:'var(--ok)',planning:'var(--acc)',on_hold:'var(--warn)',completed:'var(--fg2)',cancelled:'var(--danger)'};
// Returns true if a project should be excluded from Gantt (On Hold or Cancelled).
function isProjOnHold(projId){ const p=PROJECTS.find(x=>x.id===projId); return p?.status==='on_hold'||p?.status==='cancelled'; }

window.selectProjectAndGoGantt=(projId)=>{
  if(isProjOnHold(projId)){ notify('This project is On Hold or Cancelled — not available in Gantt','warn'); return; }
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
  return Math.round(_pts.reduce((n,t)=>n+tHours(t),0));
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
  const _grandTotal=_sortedProjects.reduce((s,p)=>s+_projHours(p),0);
  document.getElementById('proj-b').innerHTML=_sortedProjects.map((p,i)=>`<tr>
    <td style="white-space:nowrap"><span style="display:inline-flex;align-items:center;gap:7px"><span style="width:8px;height:8px;border-radius:2px;background:${p.color};flex-shrink:0"></span><span style="font-weight:500;font-size:11px;color:var(--fg0);cursor:pointer" onclick="selectProjectAndGoGantt('${p.id}')" title="Open in Gantt">${p.name}</span></span></td>
    <td style="font-size:11px;color:var(--fg2);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.desc||'—'}</td>
    <td style="font-size:10px;color:var(--fg2)">${p.deadline||'—'}</td>
    <td><span class="badge" style="background:${PROJ_STAT_COLS[p.status]}22;color:${PROJ_STAT_COLS[p.status]}">${PROJ_STAT_LABELS[p.status]||p.status}</span></td>
    <td style="font-size:10px;color:var(--fg2);text-align:center">${p.priorityProject??'—'}</td>
    <td class="mono txs">${(()=>{ const _total=_projHours(p); return _total>0?`${_total}h`:'—'; })()}</td>
    <td class="mono txs">${(()=>{ const _c=TASKS.filter(t=>t.projId===p.id&&t.status!=='cancelled').length; return _c>0?_c:'—'; })()}</td>
    <td style="font-size:10px;color:var(--fg2)">${(()=>{ const _maxIdx=_projEndDate(p); if(!_maxIdx) return '—'; const _d=gDate(_maxIdx); return `${String(_d.getDate()).padStart(2,'0')}/${String(_d.getMonth()+1).padStart(2,'0')}/${_d.getFullYear()}`; })()}</td>
    <td style="font-size:11px;color:var(--fg2)">${p.orderId||'—'}</td>
    <td style="display:flex;gap:4px">
      <button class="btn btn-xs" onclick="openEditProject('${p.id}')">✎</button>
      <button class="btn btn-xs btn-d" onclick="delProject('${p.id}')">✕</button>
    </td>
  </tr>`).join('')
  +`<tr style="border-top:2px solid var(--bd)">
    <td colspan="5" style="font-size:11px;color:var(--fg0);padding-top:6px">Total</td>
    <td class="mono txs" style="font-size:11px;color:var(--fg0);padding-top:6px">${_grandTotal>0?`${_grandTotal}h`:'—'}</td>
    <td colspan="4"></td>
  </tr>`;
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
// TEAMS PAGE
// ============================================================
function renderTeams(){
  const canEdit=isAdmin();
  document.getElementById('teams-b').innerHTML=TEAMS.map((t,i)=>{
    const members=RESOURCES.filter(r=>(r.teams||[]).includes(t.id));
    const leaderSel=`<select class="ie" ${canEdit?'':`disabled`} onchange="uTeam(${i},'leaderId',this.value)" style="width:120px">
      <option value="">— nenhum —</option>
      ${members.map(m=>`<option value="${m.id}" ${t.leaderId===m.id?'selected':''}>${m.name}</option>`).join('')}
    </select>`;
    return `<tr>
      <td>${canEdit?`<input class="ie" value="${t.name}" onchange="uTeam(${i},'name',this.value)" style="min-width:125px">`:`<span style="font-size:11px">${t.name}</span>`}</td>
      <td>${leaderSel}</td>
      <td>${canEdit?`<input class="ie" value="${t.desc||''}" onchange="uTeam(${i},'desc',this.value)" style="min-width:190px">`:`<span style="font-size:11px;color:var(--fg2)">${t.desc||'—'}</span>`}</td>
      <td>${canEdit?`<input type="color" value="${t.color}" onchange="uTeam(${i},'color',this.value)" style="width:34px;height:28px;border:none;background:none;cursor:pointer">`:`<span style="display:inline-block;width:16px;height:16px;border-radius:3px;background:${t.color}"></span>`}</td>
      <td class="mono txs">${members.length} members</td>
      <td style="text-align:center"><button onclick="TEAMS[${i}].showInDash=!(TEAMS[${i}].showInDash!==false);persistState(['teams']);renderTeams();renderDash();" title="Show/hide in workload gauges" style="background:none;border:none;cursor:pointer;font-size:15px;line-height:1;opacity:${t.showInDash===false?0.2:1}">${t.showInDash===false?'🚫':'👁'}</button></td>
      <td>${canEdit?`<button class="btn btn-xs btn-d" onclick="delTeam('${t.id}')">✕</button>`:''}</td>
    </tr>`;
  }).join('');
  // Show/hide Add button based on admin
  const addBtn=document.querySelector('#page-teams .btn-p');
  if(addBtn) addBtn.style.display=isAdmin()?'':'none';
}
window.addTeam=()=>{
  if(!isAdmin()){notify('Only admins can add teams','warn');return;}
  TEAMS.push({id:'tm'+Date.now(),name:'New Team',color:'#7a8aaa',desc:'',leaderId:null});
  persistState(['teams']); renderTeams();
};
window.delTeam=(id)=>{
  if(!isAdmin()){notify('Only admins can delete teams','warn');return;}
  if(!confirm('Delete team?')) return;
  TEAMS=TEAMS.filter(t=>t.id!==id);
  persistState(['teams']); renderTeams();
};

// Move a task up (-1) or down (+1) in the TASKS array (= Gantt priority order)
window.moveTaskOrder=(taskId, dir)=>{
  const idx=TASKS.findIndex(t=>t.id===taskId);
  if(idx<0) return;
  const target=idx+dir;
  if(target<0||target>=TASKS.length) return;
  // Swap
  [TASKS[idx], TASKS[target]]=[TASKS[target], TASKS[idx]];
  persistState();
  renderGantt();
};

window.openAddChildTask=(parentId)=>{S._addChildParentId=parentId;openAddTask();const parent=TASKS.find(t=>t.id===parentId);if(parent){const ps=document.getElementById('mt-proj');if(ps&&parent.projId)ps.value=parent.projId;}document.getElementById('mt-h').textContent='Add Sub-Task';};

// ============================================================
// MY SPACE
// ============================================================
let _myOffset = GANTT_TODAY - 1; // start of current week



function renderMyDay(tasks, myId){
  const wrap=document.getElementById('my-day-wrap');
  if(!wrap) return;

  const dayIdx=GANTT_TODAY+_myDayOffset;
  const dt=gDate(dayIdx);
  const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DN=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayLabel=`${DN[dt.getDay()]}, ${dt.getDate()} ${MN[dt.getMonth()]}`;
  const isToday=dayIdx===GANTT_TODAY;

  // Update nav label
  const lbl=document.getElementById('my-day-lbl');
  if(lbl) lbl.textContent=isToday?'Today':dayLabel;

  // Gather logs for this day
  const fmtH=h=>{const m=Math.round(h*60);return m>=60?`${Math.floor(m/60)}h${m%60>0?' '+m%60+'m':''}`:`${m}m`;};
  const todayDate=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;

  // All logs for this day
  const logs=tasks.flatMap(t=>(t.timeLogs||[])
    .filter(l=>l.date===todayDate)
    .map(l=>({...l,task:t,barCol:getTeam(t.teamId)?.color||'#4f9cf9'}))
  ).sort((a,b)=>(a.startTime||'99:99').localeCompare(b.startTime||'99:99'));

  // Tasks scheduled for this day (future / remaining)
  const sched=tasks.filter(t=>{
    if(t.status==='done'||t.status==='cancelled') return false;
    const s=t._sched||{};
    return s[dayIdx]>0;
  }).map(t=>({task:t,hours:t._sched[dayIdx]||0,barCol:getTeam(t.teamId)?.color||'#4f9cf9'}))
    .sort((a,b)=>b.hours-a.hours);

  // Total logged today
  const totalLogged=logs.reduce((s,l)=>s+l.hours,0);
  const cap=getRes(myId)?.dailyCap||HPD;

  const now=new Date();
  const nowStr=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  let H=`<div style="padding:16px">`;

  // Day header + capacity bar
  H+=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
    <div>
      <div style="font-size:15px;font-weight:700;color:var(--fg0)">${dayLabel}</div>
      <div style="font-size:10px;color:var(--fg3);margin-top:2px">${fmtH(totalLogged)} logged · ${fmtH(Math.max(0,cap-totalLogged))} remaining of ${fmtH(cap)} capacity</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      ${isToday?`<div style="font-size:12px;font-weight:700;color:var(--acc);font-family:var(--mono)">${nowStr}</div>`:''}
      <div style="width:120px;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${Math.min(100,Math.round(totalLogged/cap*100))}%;background:${totalLogged>=cap?'var(--danger)':totalLogged>=cap*0.7?'var(--warn)':'var(--ok)'};border-radius:3px;transition:width .4s"></div>
      </div>
    </div>
  </div>`;

  // ── PAST: time logged ──────────────────────────────────────────
  if(logs.length){
    H+=`<div style="margin-bottom:20px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--fg3);margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <span style="color:var(--ok)">✓ Logged</span>
        <div style="flex:1;height:1px;background:var(--bd)"></div>
        <span style="color:var(--ok)">${fmtH(totalLogged)}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">`;

    logs.forEach(l=>{
      const t=l.task;
      H+=`<div style="display:flex;align-items:stretch;gap:10px">
        <div style="display:flex;flex-direction:column;align-items:center;width:44px;flex-shrink:0">
          ${l.startTime?`<div style="font-size:9px;font-family:var(--mono);color:var(--fg2)">${l.startTime}</div>`:''}
          <div style="flex:1;width:2px;background:${l.barCol};opacity:.4;margin:3px 0"></div>
          ${l.endTime?`<div style="font-size:9px;font-family:var(--mono);color:var(--fg2)">${l.endTime}</div>`:''}
        </div>
        <div style="flex:1;background:var(--bg2);border:1px solid var(--bd);border-left:3px solid ${l.barCol};border-radius:0 var(--r8) var(--r8) 0;padding:8px 12px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
            <div style="font-size:11px;font-weight:600;color:var(--fg0)">${t.name}</div>
            <div style="font-size:12px;font-weight:700;font-family:var(--mono);color:var(--ok)">${fmtH(l.hours)}</div>
          </div>
          ${l.notes?`<div style="font-size:10px;color:var(--fg3);margin-top:3px;font-style:italic">${l.notes}</div>`:''}
          <div style="font-size:9px;color:var(--fg3);margin-top:2px">${getTeam(t.teamId)?.name||'—'}</div>
        </div>
      </div>`;
    });
    H+='</div></div>';
  }

  // ── NOW marker ─────────────────────────────────────────────────
  if(isToday){
    H+=`<div style="display:flex;align-items:center;gap:8px;margin:12px 0">
      <div style="width:44px;text-align:right;font-size:9px;font-weight:700;font-family:var(--mono);color:var(--acc)">${nowStr}</div>
      <div style="height:2px;flex:1;background:linear-gradient(to right,var(--acc),transparent)"></div>
      <div style="width:8px;height:8px;border-radius:50%;background:var(--acc);box-shadow:0 0 0 3px rgba(79,156,249,.25);flex-shrink:0"></div>
    </div>`;
  }

  // ── FUTURE: scheduled tasks ────────────────────────────────────
  if(sched.length){
    H+=`<div style="margin-top:8px">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--fg3);margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <span style="color:var(--acc)">→ Scheduled</span>
        <div style="flex:1;height:1px;background:var(--bd)"></div>
        <span style="color:var(--fg2)">${fmtH(sched.reduce((s,x)=>s+x.hours,0))}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">`;

    sched.forEach(({task:t,hours,barCol})=>{
      const loggedOnTask=logH(t);
      const totalPlanned=t.resHours?.[myId]||tHours(t);
      const pct=totalPlanned>0?Math.round(loggedOnTask/totalPlanned*100):0;
      const statusBadge=t.status==='doing'?`<span style="font-size:8px;font-weight:700;padding:1px 6px;background:rgba(79,156,249,.2);color:var(--acc);border-radius:4px">▶ Active</span>`:
        t.status==='paused'?`<span style="font-size:8px;font-weight:700;padding:1px 6px;background:rgba(79,156,249,.1);color:var(--acc);border-radius:4px">⏸ Paused</span>`:'';
      H+=`<div style="display:flex;align-items:stretch;gap:10px">
        <div style="width:44px;flex-shrink:0;display:flex;align-items:center;justify-content:flex-end">
          <div style="font-size:11px;font-weight:700;font-family:var(--mono);color:${barCol}">${fmtH(hours)}</div>
        </div>
        <div style="flex:1;background:var(--bg2);border:1px solid var(--bd);border-left:3px solid ${barCol};border-radius:0 var(--r8) var(--r8) 0;padding:8px 12px;cursor:pointer" onclick="openEditTask('${t.id}')">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <div style="font-size:11px;font-weight:600;color:var(--fg0)">${t.name}</div>
            ${statusBadge}
          </div>
          <div style="height:3px;background:var(--bg3);border-radius:2px;overflow:hidden;margin-bottom:4px">
            <div style="height:100%;width:${pct}%;background:${barCol};opacity:.7;border-radius:2px"></div>
          </div>
          <div style="display:flex;gap:8px;font-size:9px;color:var(--fg3)">
            <span>${getTeam(t.teamId)?.name||'—'}</span>
            <span>${pct}% done overall</span>
            ${t.deadline?`<span style="color:${tEnd(t)>dateToIdx(t.deadline)?'var(--danger)':'var(--fg3)'}">DL: ${t.deadline}</span>`:''}
          </div>
        </div>
      </div>`;
    });
    H+='</div></div>';
  }

  if(!logs.length&&!sched.length){
    H+=`<div style="text-align:center;padding:32px;color:var(--fg3)">
      <div style="font-size:28px;margin-bottom:8px">📅</div>
      <div style="font-size:12px;font-weight:600;color:var(--fg1)">Nothing scheduled</div>
      <div style="font-size:11px;margin-top:4px">No logs or tasks for this day.</div>
    </div>`;
  }

  H+='</div>';
  wrap.innerHTML=H;
}
window.renderMyDay=renderMyDay;

function renderMySpace(){
  if(!S_USER){ document.getElementById('mys').innerHTML='<div style="padding:20px;color:var(--fg3)">Please log in first.</div>'; return; }
  try{
  const me=getRes(S_USER.resId);
  if(!me){ document.getElementById('mys').innerHTML='<div style="padding:20px;color:var(--fg3)">User not found.</div>'; return; }
  const myId=me.id;
  const myT=TASKS.filter(t=>t.resId===myId||(t.coResIds||[]).includes(myId));
  const pend=myT.filter(t=>t.status==='todo').length;
  const doing=myT.filter(t=>t.status==='doing').length;
  const ph=myT.reduce((s,t)=>s+tHours(t),0);
  const ah=myT.reduce((s,t)=>s+logH(t),0);
  document.getElementById('mys').innerHTML=`
    <div class="mg" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:12px">
      <div class="mc a1"><div class="ml">My tasks</div><div class="mv">${myT.length}</div><div class="ms">${pend} pending · ${doing} doing</div></div>
      <div class="mc a3"><div class="ml">Logged</div><div class="mv">${_fmtHours(ah)}</div><div class="ms">of ${_fmtHours(ph)} planned</div></div>
      <div class="mc a4"><div class="ml">Progress</div><div class="mv">${ph?Math.round(ah/ph*100):0}%</div><div class="ms">&nbsp;</div></div>
    </div>
    <!-- Side-by-side: Gantt 75% + Day 25% -->
    <div style="display:grid;grid-template-columns:3fr 1fr;gap:12px;align-items:stretch">
      <div class="card" style="overflow:hidden;display:flex;flex-direction:column">
        <div class="ch" style="justify-content:space-between">
          <span class="ct">My Gantt</span>
          <div style="display:flex;gap:4px">
            <button class="btn btn-sm btn-ic" onclick="myGanttNav(-1)">‹ week</button>
            <button class="btn btn-sm" onclick="myGanttNav(0)">Today</button>
            <button class="btn btn-sm btn-ic" onclick="myGanttNav(1)">week ›</button>
          </div>
        </div>
        <div id="my-gantt-wrap" style="overflow-x:auto;flex:1"></div>
      </div>
      <div class="card" style="overflow:hidden;display:flex;flex-direction:column">
        <div class="ch" style="justify-content:space-between;padding:8px 12px">
          <span class="ct" id="my-day-lbl" style="font-size:11px">Today</span>
          <div style="display:flex;gap:3px">
            <button class="btn btn-sm btn-ic" onclick="myDayNav(-1)" style="padding:2px 6px">‹</button>
            <button class="btn btn-sm btn-ic" onclick="myDayNav(0)" style="padding:2px 6px;font-size:9px">↺</button>
            <button class="btn btn-sm btn-ic" onclick="myDayNav(1)" style="padding:2px 6px">›</button>
          </div>
        </div>
        <div id="my-day-wrap" style="flex:1;overflow-y:auto"></div>
      </div>
    </div>`;
  renderMyGantt(myT, myId);
  renderMyDay(myT, myId);
  const allLogs=myT.flatMap(t=>(t.timeLogs||[]).map(l=>({...l,tname:t.name}))).sort((a,b)=>b.date.localeCompare(a.date));
  const logEl=document.getElementById('mys-log');
  if(logEl){
    const fmtH=h=>{const totalMin=Math.round(h*60);const hh=Math.floor(totalMin/60);const mm=totalMin%60;return mm>0?`${hh}h ${mm}m`:`${hh}h`;};
    logEl.innerHTML=allLogs.slice(0,40).map(l=>{
      const timeRange=l.startTime&&l.endTime?`${l.startTime}–${l.endTime}`:(l.date||'');
      return `<tr>
        <td style="font-size:11px">${l.tname}</td>
        <td class="txs tc">${l.date||''}<br><span style="color:var(--fg3)">${l.startTime&&l.endTime?l.startTime+' – '+l.endTime:''}</span></td>
        <td class="mono txs">${fmtH(l.hours)}</td>
        <td class="txs tc">${l.notes||'—'}</td>
      </tr>`;
    }).join('')||'<tr><td colspan="4" style="text-align:center;padding:16px;color:var(--fg3)">No time logged yet</td></tr>';
  }
  }catch(e){ console.error('renderMySpace:',e); document.getElementById('mys').innerHTML=`<div style="padding:20px;color:var(--danger)">Error loading My Space: ${e.message}</div>`; }
}


window.setMyView=()=>{}; // unused
window.myDayNav=(dir)=>{
  if(dir===0) _myDayOffset=0;
  else _myDayOffset+=dir;
  // Only re-render day panel
  const me=S_USER?getRes(S_USER.resId):null;
  if(!me) return;
  const myT=TASKS.filter(t=>t.resId===me.id||(t.coResIds||[]).includes(me.id));
  renderMyDay(myT,me.id);
};
window.myGanttNav=(dir)=>{
  if(dir===0) _myOffset=GANTT_TODAY-1;
  else _myOffset+=dir*7;
  const me=S_USER?getRes(S_USER.resId):RESOURCES.find(r=>r.name.includes('Pedro'));
  const myId=me?.id;
  const myT=TASKS.filter(t=>t.resId===myId||(t.coResIds||[]).includes(myId));
  renderMyGantt(myT,myId);
};

function renderMyGantt(tasks,myId){
  const wrap=document.getElementById('my-gantt-wrap');
  if(!wrap) return;
  computeAllSchedules();
  const cap=getRes(myId)?.dailyCap||HPD;
  const DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const NUM_DAYS=20; // 20 working days (fills page)
  const fmtH=h=>{const totalMin=Math.round(h*60);const hh=Math.floor(totalMin/60);const mm=totalMin%60;return mm>0?`${hh}h ${mm}m`:`${hh}h`;};

  // Build cols: all calendar days for the range of NUM_DAYS working days
  // First find the end date (NUM_DAYS working days)
  let _wdCount=0, _endScan=_myOffset+1;
  while(_wdCount<NUM_DAYS&&_endScan<_myOffset+100){
    if(!isNW(_endScan)) _wdCount++;
    _endScan++;
  }
  const cols=[];
  for(let _d=_myOffset+1;_d<_endScan;_d++){
    const dt=gDate(_d);
    const nw=isNW(_d);
    cols.push({idx:_d,dt,nw,today:_d===GANTT_TODAY,day:dt.getDate(),dow:dt.getDay()});
  }
  const rangeStart=cols[0]?.idx||_myOffset+1, rangeEnd=cols[cols.length-1]?.idx||_myOffset+NUM_DAYS;

  const ws=cols[0].dt, we=cols[NUM_DAYS-1].dt;
  const rangeLabel=`${ws.getDate()} ${MN[ws.getMonth()]} – ${we.getDate()} ${MN[we.getMonth()]} ${we.getFullYear()}`;
  // Auto-fit COL_W to available width, respect zoom
  const NAME_W=220;
  const NW_W=20; // weekend narrow column
  // Count NW cols in range
  const nwCount=cols.filter(x=>x.nw).length;
  const wdCount=cols.length-nwCount;
  const wrapW=document.getElementById('my-gantt-wrap')?.clientWidth||window.innerWidth-32;
  const ZOOM_STEPS_MS=[18,24,32,42,54,68,84,100];
  const autoFit=Math.max(18,Math.min(100,Math.floor((wrapW-NAME_W-nwCount*NW_W)/Math.max(1,wdCount))));
  const COL_W=_ganttZoom===null?autoFit:ZOOM_STEPS_MS[Math.max(0,Math.min(ZOOM_STEPS_MS.length-1,_ganttZoom))];

  // Milestones relevant to this user (have at least one of this user's tasks)
  const myTaskIds=new Set(tasks.map(t=>t.id));
  const myMilestones=MILESTONES.filter(m=>
    m.dayIdx>=rangeStart && m.dayIdx<=rangeEnd &&
    (m.taskIds||[]).some(id=>myTaskIds.has(id)) &&
    (!S._activeProjId||(m.projId?m.projId===S._activeProjId:(m.taskIds||[]).some(id=>myTaskIds.has(id))))
  );

  // Build per-day log map: {dayIdx: [{hours, startTime, endTime, taskId}]}
  const logsByDay={};
  tasks.forEach(t=>{
    (t.timeLogs||[]).forEach(l=>{
      const dayIdx=dateToIdx(l.date);
      if(!dayIdx) return;
      if(!logsByDay[dayIdx]) logsByDay[dayIdx]=[];
      logsByDay[dayIdx].push({hours:l.hours,startTime:l.startTime,endTime:l.endTime,taskId:t.id,tname:t.name});
    });
  });

  // Include tasks that are scheduled in range OR have logs in range
  const inRange=[...new Set([
    ...tasks.filter(t=>t.start&&tEnd(t)>=rangeStart&&t.start<=rangeEnd),
    ...tasks.filter(t=>(t.timeLogs||[]).some(l=>{const d=dateToIdx(l.date);return d>=rangeStart&&d<=rangeEnd;}))
  ])];

  let H=`<table style="border-collapse:collapse;table-layout:fixed;min-width:${NAME_W+NUM_DAYS*COL_W}px">
  <thead>
    <tr>
      <th style="width:${NAME_W}px;background:var(--bg2);padding:6px 10px;font-size:9px;font-weight:700;text-transform:uppercase;color:var(--fg2);border-bottom:1px solid var(--bd);text-align:left">${rangeLabel}</th>
      ${cols.map(c=>{
        const msDay=myMilestones.filter(m=>m.dayIdx===c.idx);
        const msCols=msDay.length>0;
        const msHdrCol=msCols?(msDay[0].color||'var(--acc2)'):'';
        const colW=c.nw?NW_W:COL_W;
        return `<th style="width:${colW}px;min-width:${colW}px;max-width:${colW}px;background:${c.nw?'rgba(10,14,22,.5)':c.today?'rgba(79,156,249,.12)':'var(--bg2)'};padding:4px 0;text-align:center;border-bottom:1px solid var(--bd);border-left:1px solid var(--bd);${msCols?'outline:2px solid '+msHdrCol+';outline-offset:-2px;':''}" ${msCols?`title="${msDay.map(m=>m.name).join(', ')}"`:''}">
          ${c.nw
            ? `<div style="font-size:8px;color:var(--fg3);writing-mode:vertical-lr;transform:rotate(180deg);margin:4px auto;letter-spacing:.5px">${DN[c.dow]}</div>`
            : `<div style="font-size:12px;font-weight:${c.today?700:500};color:${msCols?msHdrCol:c.today?'var(--acc)':'var(--fg0)'}">${c.day}</div>
               <div style="font-size:9px;color:${c.today?'var(--acc)':'var(--fg2)'}">${DN[c.dow]}</div>`
          }
        </th>`;
      }).join('')}
    </tr>
    <tr>
      <td style="padding:3px 10px;font-size:9px;color:var(--fg3);background:var(--bg1);border-bottom:1px solid var(--bd)">Available capacity</td>
      ${cols.map(c=>{
        if(c.nw) return `<td style="width:${NW_W}px;min-width:${NW_W}px;max-width:${NW_W}px;background:rgba(10,14,22,.45);border-bottom:1px solid var(--bd);border-left:1px solid var(--bd)"></td>`;
        const load=getDayLoad(myId,c.idx,null);
        const avail=Math.max(0,cap-load);
        const pct=avail/cap;
        const col=pct>0.5?'var(--ok)':pct>0.2?'var(--warn)':'var(--danger)';
        return `<td style="padding:3px 4px;text-align:center;background:var(--bg1);border-bottom:1px solid var(--bd);border-left:1px solid var(--bd)">
          <div style="font-size:10px;font-weight:600;color:${col}">${fmtH(avail)}</div>
          <div style="height:2px;background:var(--bg3);border-radius:1px;overflow:hidden;margin-top:2px"><div style="height:100%;width:${Math.round(pct*100)}%;background:${col}"></div></div>
        </td>`;
      }).join('')}
    </tr>
  </thead><tbody>`;

  if(!inRange.length){
    H+=`<tr><td colspan="${1+NUM_DAYS}" style="padding:24px;text-align:center;font-size:11px;color:var(--fg3)">No tasks in this period</td></tr>`;
  } else {
    inRange.forEach(t=>{
      const barCol=t.teamId?getTeam(t.teamId)?.color||'#7a8aaa':'#7a8aaa';
      const _overLoggedTask=logH(t)>tHours(t);
      const isDone=t.status==='done'||t.status==='cancelled';
      const sched=t._sched||{};
      const myPlanned=t._originalPlanned||t.resHours?.[myId]||tHours(t);
      const myLogged=logH(t);
      const remaining=Math.max(0,myPlanned-myLogged);
      const logFrac=myPlanned>0?Math.min(1,myLogged/myPlanned):0;
      const isOv=t.deadline&&tEnd(t)>dateToIdx(t.deadline)&&!isDone;

      const isActiveRow=t.status==='doing';
      const isPausedRow=t.status==='paused';
      const rowBg=isActiveRow?'background:rgba(255,255,255,.06)':isPausedRow?'background:rgba(79,156,249,.04)':'';
      H+=`<tr style="${rowBg}">
        <td style="padding:4px 10px;border-bottom:1px solid var(--bd);cursor:pointer;${rowBg}" onclick="openEditTask('${t.id}')">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${SCOLS[t.status]};flex-shrink:0"></span>
            <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;max-width:190px" title="${t.name}">${t.name}</div>
          </div>
          <div style="font-size:9px;color:var(--fg3);margin-top:1px;padding-left:14px">
            ${myLogged>0?`<span style="color:var(--ok)">${fmtH(myLogged)} done</span> · `:''}<span style="color:${remaining>0?'var(--fg2)':'var(--ok)'}">${fmtH(remaining)} left</span>
          </div>
          ${myLogged>0?`<div style="height:2px;background:var(--bg3);border-radius:1px;overflow:hidden;margin-top:2px;margin-left:14px">
            <div style="height:100%;width:${Math.round(logFrac*100)}%;background:${isDone?'var(--ok)':'var(--acc)'};border-radius:1px"></div>
          </div>`:''}
        </td>
        ${cols.map(c=>{
          const msHere=myMilestones.filter(m=>(m.taskIds||[]).includes(t.id)&&m.dayIdx===c.idx);
          const hasMsHere=msHere.length>0;
          const msCol=hasMsHere?(msHere[0].color||'var(--acc2)'):'';
          if(c.nw) return `<td style="width:${NW_W}px;min-width:${NW_W}px;max-width:${NW_W}px;background:rgba(10,14,22,.45);border-bottom:1px solid var(--bd);border-left:1px solid var(--bd)"></td>`;
          // Use box-shadow inset to draw milestone line — no absolute positioning needed
          // Line via background-image — hover uses background-color so this survives
          const msBoxShadow=hasMsHere?`background-image:linear-gradient(to right,transparent calc(50% - 1px),${msCol} calc(50% - 1px),${msCol} calc(50% + 1px),transparent calc(50% + 1px));`:'';
          const _msColors2=msHere.map(m=>m.color||'var(--acc2)');
          const _msMultiBg2=_msColors2.length>1?`conic-gradient(${_msColors2.map((col,i)=>`${col} ${Math.round(i/_msColors2.length*360)}deg ${Math.round((i+1)/_msColors2.length*360)}deg`).join(',')})`:(msCol||'');
          const _msDiv=hasMsHere?`<div style="position:absolute;top:0;bottom:0;left:50%;width:2px;transform:translateX(-50%);background:${msCol};z-index:5;pointer-events:none"></div><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;border-radius:50%;background:${_msMultiBg2};border:2px solid rgba(0,0,0,.4);z-index:6;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`:'';
          const msClick=hasMsHere?`onclick="toggleMsFilter('${msHere[0].id}')" title="${msHere[0].name} — click to filter" style="cursor:pointer"`:'';
          // For active task today with no sched data: infer from remaining hours
          let schedH=sched[c.idx]||0;
          if(!schedH&&c.today&&t.status==='doing'&&!t.segments){
            const planned2=t._originalPlanned||t.resHours?.[myId]||tHours(t);
            const loggedAll=logH(t);
            schedH=Math.min(cap, Math.max(0,planned2-loggedAll)); // cap to daily capacity
          }
          // Hours actually logged on this specific day
          const loggedToday=(t.timeLogs||[]).filter(l=>dateToIdx(l.date)===c.idx).reduce((s,l)=>s+l.hours,0);
          const logEntries=(t.timeLogs||[]).filter(l=>dateToIdx(l.date)===c.idx);
          const logTip=logEntries.map(l=>l.startTime&&l.endTime?`${l.startTime}–${l.endTime} (${fmtH(l.hours)})`:`${fmtH(l.hours)}`).join(', ');

          if(loggedToday>0.001){
            const frac=Math.min(1,loggedToday/cap);
            const bh=Math.max(20,Math.round(20+frac*28));
            const isActive=_timerState.taskId===t.id&&!_timerState.paused&&t.status==='doing';
            const hasRemSched=schedH>0.001;
            return `<td ${msClick} style="padding:2px 3px;border-bottom:1px solid var(--bd);border-left:1px solid var(--bd);vertical-align:middle;text-align:center;${msBoxShadow}">
              <div style="background:${isDone?'var(--ok)':_overLoggedTask?'var(--danger)':barCol};height:${bh}px;border-radius:3px 3px ${hasRemSched?0:3}px ${hasRemSched?0:3}px;position:relative;" title="Logged: ${logTip}">${_msDiv}
                <span style="font-size:9px;font-weight:700;color:#fff;position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${fmtH(loggedToday)}${isActive?' ⏱':''}</span>
              </div>
              ${hasRemSched?`<div style="background:${barCol}55;height:6px;border-radius:0 0 3px 3px;border:1px dashed ${barCol}99;border-top:none"></div>`:''}
            </td>`;
          } else if(schedH>0.001){
            const frac=Math.min(1,schedH/cap);
            const bh=Math.max(20,Math.round(20+frac*28));
            const isActive=_timerState.taskId===t.id&&!_timerState.paused&&t.status==='doing';
            return `<td ${msClick} style="padding:2px 3px;border-bottom:1px solid var(--bd);border-left:1px solid var(--bd);vertical-align:middle;text-align:center;${msBoxShadow}">
              <div style="background:${isActiveRow?barCol:barCol+'88'};height:${bh}px;border-radius:3px;position:relative;${isOv&&!hasMsHere?'outline:1px solid var(--danger)':''}${isActiveRow?';box-shadow:0 0 8px '+barCol+'66':''}" title="${t.name}: ${fmtH(schedH)}">
                <span style="font-size:9px;font-weight:600;color:rgba(255,255,255,.85);position:absolute;inset:0;display:flex;align-items:center;justify-content:center">${fmtH(schedH)}${isActive?' ⏱':''}</span>
              </div>
            </td>`;
          } else if(t.start&&c.idx>=t.start&&c.idx<=tEnd(t)){
            const freeSeg=t.segments&&t.segments[0]?._locked&&t.segments.length>1?t.segments[t.segments.length-1]:null;
            const inFree=freeSeg&&c.idx>=freeSeg.start&&c.idx<freeSeg.start+freeSeg.dur;
            const barColFree=t.teamId?getTeam(t.teamId)?.color||'#7a8aaa':'#7a8aaa';
            if(inFree){
              return `<td ${msClick} style="padding:2px 3px;border-bottom:1px solid var(--bd);border-left:1px solid var(--bd);vertical-align:middle;text-align:center;${msBoxShadow}">
                <div style="background:${barColFree}44;height:16px;border-radius:3px;border:1.5px dashed ${barColFree}cc" title="${t.name}: ${fmtH(freeSeg.hours)} remaining"></div>
              </td>`;
            }
            return `<td ${msClick} style="padding:2px 3px;border-bottom:1px solid var(--bd);border-left:1px solid var(--bd);vertical-align:middle;${msBoxShadow}">
              <div style="height:6px;background:${barColFree}55;border-radius:3px"></div>
            </td>`;
          }
          return `<td ${msClick} style="border-bottom:1px solid var(--bd);border-left:1px solid var(--bd);${msBoxShadow}"></td>`;
        }).join('')}
      </tr>`;
    });
  }
  H+=`</tbody></table>`;
  wrap.innerHTML=H;
}

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
    if(d.TASKS){
      TASKS=d.TASKS;
      TASKS.forEach(t=>{
        delete t._schedLocked; delete t._computedStart; delete t._why;
        if(t.sched)    { t._sched=t.sched; }    else { delete t._sched; }
        if(t.schedCo)  { t._schedCo=t.schedCo; } else { delete t._schedCo; }
      });
    }
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
    const _sp=o=>{const r={};Object.entries(o).forEach(([k,v])=>{if(!k.startsWith('_'))r[k]=v;});return r;};
    localStorage.setItem(STORE_KEY, JSON.stringify({TASKS:TASKS.map(_sp),PROJECTS,RESOURCES,TEAMS,PROJ,GLOG:GLOG.slice(0,200),
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
    if(d.tasks){
      TASKS=_toArr(d.tasks);
      // Strip stale runtime fields persisted by older versions; restore from canonical sched/schedCo
      TASKS.forEach(t=>{
        delete t._schedLocked; delete t._computedStart; delete t._why;
        if(t.sched)    { t._sched=t.sched; }    else { delete t._sched; }
        if(t.schedCo)  { t._schedCo=t.schedCo; } else { delete t._schedCo; }
      });
    }
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
  const _stripPrivate=obj=>{
    const out={};
    // Keep 'sched' and 'schedCo' (canonical simulation output — must persist).
    // Strip everything else starting with '_' (runtime-only computed fields).
    Object.entries(obj).forEach(([k,v])=>{ if(!k.startsWith('_')) out[k]=v; });
    return out;
  };
  const _patchEntity=(path,items,ids,entityKey)=>{
    const patch={};
    const isTask=path==='/tasks';
    if(ids.has('__all__')){ items.forEach(x=>{ patch[x.id]=isTask?_stripPrivate(x):x; }); }
    else { ids.forEach(id=>{ const x=items.find(i=>i.id===id); if(x) patch[x.id]=isTask?_stripPrivate(x):x; }); }
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
// TIMER PANEL
// ============================================================
// _timerState: {taskId, sessionStartMs, sessionPausedMs, paused, pausedAt}
// ============================================================
// TIMER — state, controls, panel rendering
// ============================================================

// _timerState: {taskId, sessionStartMs, sessionPausedMs, paused}
let _timerState = {};
let _timerInterval = null;
let _tpView = 'day';   // 'day' | 'all'
let _tpDayOffset = 0;  // days from GANTT_TODAY for day view

function _saveTimerState(){
  try{ localStorage.setItem('pg_timer', JSON.stringify(_timerState)); }catch(e){}
}
function _loadTimerState(){
  try{ const s=localStorage.getItem('pg_timer'); if(s) _timerState=JSON.parse(s)||{}; }catch(e){}
}

// ms elapsed in current live session (0 if paused or no session)
function _sessionElapsedMs(){
  if(!_timerState.sessionStartMs||_timerState.paused) return 0;
  return Math.max(0, Date.now()-_timerState.sessionStartMs-(_timerState.sessionPausedMs||0));
}

// Total hours logged across all timeLogs for a task
function _totalLoggedH(t){
  return (t&&t.timeLogs||[]).reduce((s,l)=>s+(l.hours||0),0);
}

// Commit current session to timeLogs (rounds to nearest minute)
// Returns hours committed
function _commitSession(taskId){
  const ms=_sessionElapsedMs();
  if(ms<10000) return 0; // ignore < 10 seconds
  const minutes=Math.round(ms/60000);
  const h=minutes/60;
  const endMs=Date.now();
  const startMs=endMs-ms;
  const fmt=ts=>{const d=new Date(ts);return d.toTimeString().slice(0,5);};
  const t=TASKS.find(x=>x.id===taskId); if(!t) return 0;
  t.timeLogs=t.timeLogs||[];
  t.timeLogs.push({
    date:new Date().toISOString().slice(0,10),
    hours:h,
    startTime:fmt(startMs),
    endTime:fmt(endMs),
    notes:'Timer'
  });
  return h;
}

// Live tick: update timer display every second
function _startTimerTick(){
  clearInterval(_timerInterval);
  _timerInterval=setInterval(()=>{
    const id=_timerState.taskId;
    if(!id||_timerState.paused) return;
    const t=TASKS.find(x=>x.id===id);
    const myId=S_USER?.resId;
    const planned=t?._originalPlanned||t?.resHours?.[myId]||tHours(t)||0;
    const logged=_totalLoggedH(t||{});
    const sessMs=_sessionElapsedMs();
    const sessH=sessMs/3600000;
    const totalH=logged+sessH;
    const remaining=planned-totalH;

    const sessEl=document.getElementById(`tp-sess-${id}`);
    const totEl=document.getElementById(`tp-total-${id}`);
    const remEl=document.getElementById(`tp-rem-${id}`);
    if(sessEl) sessEl.textContent=_fmtMs(sessMs);
    if(totEl)  totEl.textContent=_fmtMs(Math.round(totalH*3600000));
    if(remEl){
      remEl.textContent=_fmtHours(remaining);
      remEl.style.color=remaining<0?'var(--danger)':remaining<0.5?'var(--warn)':'var(--ok)';
    }
  },1000);
}

// ── Start or Resume a task ────────────────────────────────────
window.tpStart=(taskId)=>{
  if(!isAdmin()){notify('Only admins can start tasks','warn');return;}
  const myId=S_USER?.resId;

  // If another task is currently ticking, pause it first
  if(_timerState.taskId && _timerState.taskId!==taskId && !_timerState.paused){
    _commitSession(_timerState.taskId);
    const prev=TASKS.find(x=>x.id===_timerState.taskId);
    if(prev) prev.status='paused';
    clearInterval(_timerInterval); _timerInterval=null;
    _timerState={};
  }

  const t=TASKS.find(x=>x.id===taskId);
  if(!t) return;
  // Already ticking for this task — do nothing
  if(_timerState.taskId===taskId && !_timerState.paused) return;

  // Store original planned hours once (so we always know the budget)
  if(!t._originalPlanned) t._originalPlanned = t.resHours?.[myId]||tHours(t);

  // Start fresh session
  _timerState = {taskId, sessionStartMs:Date.now(), sessionPausedMs:0, paused:false};
  _saveTimerState();

  // Mark task as doing, anchor to today
  t.status='doing';
  if(!t.startedAt) t.startedAt=GANTT_TODAY;
  t.start=GANTT_TODAY;
  _tpDayOffset=0;

  addLog({type:'time',task:t.name,from:'',to:'▶ timer started'});
  persistState(['tasks'],{tasks:[taskId]}); _reRenderCurrent(); updateTimerToggle(); if(typeof updateMobBanner!=="undefined") updateMobBanner();
  _startTimerTick();
  renderTimerPanel();
};

// ── Pause active task ─────────────────────────────────────────
window.tpPause=(taskId)=>{
  if(!taskId || _timerState.taskId!==taskId || _timerState.paused) return;
  _commitSession(taskId);
  _timerState.paused=true;
  _timerState.sessionStartMs=null;
  _timerState.sessionPausedMs=0;
  _saveTimerState();
  clearInterval(_timerInterval); _timerInterval=null;
  const t=TASKS.find(x=>x.id===taskId);
  if(t){ t.status='paused'; const sessH=_sessionElapsedMs()/3600000; addLog({type:'time',task:t.name,from:'',to:`⏸ paused — session: ${_fmtHours(sessH)}`}); persistState(['tasks'],{tasks:[taskId]}); _reRenderCurrent(); }
  renderTimerPanel();
};

// ── Mark task done ────────────────────────────────────────────
window.tpDone=(taskId)=>{
  const t=TASKS.find(x=>x.id===taskId); if(!t) return;
  if(_timerState.taskId===taskId){
    _commitSession(taskId);
    _timerState={}; _saveTimerState();
    clearInterval(_timerInterval); _timerInterval=null;
  }
  const _sessH=_commitSession?0:0; const _loggedH=_totalLoggedH(t);
  t.status=taskHasMilestone(taskId)?'ready':'done'; t.prog=100;
  addLog({type:'status',task:t.name,from:'',to:`${taskHasMilestone(taskId)?'◆ Ready':'✓ Done'} — total logged: ${_fmtHours(_loggedH)}`});
  persistState(['tasks'],{tasks:[taskId]}); _reRenderCurrent();
  notify(`"${t.name}" → Done ✓`,'success');
  renderTimerPanel();
};

// ── Cancel task ───────────────────────────────────────────────
window.tpCancel=(taskId)=>{
  const t=TASKS.find(x=>x.id===taskId); if(!t) return;
  if(!confirm(`Cancel "${t.name}"?`)) return;
  if(_timerState.taskId===taskId){
    _commitSession(taskId);
    _timerState={}; _saveTimerState();
    clearInterval(_timerInterval); _timerInterval=null;
  }
  t.status='cancelled';
  addLog({type:'status',task:t.name,from:'',to:'Cancelled'});
  persistState(['tasks'],{tasks:[taskId]}); _reRenderCurrent();
  notify(`"${t.name}" cancelled`,'warn');
  renderTimerPanel();
};

// ── Timer panel rendering ─────────────────────────────────────
window.toggleTimerPanel=()=>{
  const panel=document.getElementById('timer-panel');
  const isOpen=panel.classList.contains('open');
  panel.classList.toggle('open',!isOpen);
  if(!isOpen) renderTimerPanel();
};

window.setTPView=(view, el)=>{
  _tpView=view;
  document.querySelectorAll('.tp-tab').forEach(t=>t.classList.remove('on'));
  if(el) el.classList.add('on');
  const nav=document.getElementById('tp-day-nav');
  if(nav) nav.style.display=view==='day'?'flex':'none';
  renderTimerPanel();
};

window.tpNavDay=(dir)=>{
  if(dir===0) _tpDayOffset=0;
  else _tpDayOffset+=dir;
  // Update day label
  const lbl=document.getElementById('tp-day-lbl');
  if(lbl){
    const d=gDate(GANTT_TODAY+_tpDayOffset);
    const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    lbl.textContent=_tpDayOffset===0?'Today':DN[d.getDay()]+' '+d.getDate()+' '+MN[d.getMonth()];
  }
  renderTimerPanel();
};


window.toggleTPAdd=()=>{
  const form=document.getElementById('tp-add-form');
  const arrow=document.getElementById('tp-add-arrow');
  const open=form.style.display==='none';
  form.style.display=open?'block':'none';
  if(arrow) arrow.textContent=open?'▾':'▸';
  if(open){
    // Populate team select
    const sel=document.getElementById('tp-team');
    if(sel) sel.innerHTML=TEAMS.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
  }
};

window.tpAddTask=()=>{
  const desc=document.getElementById('tp-desc')?.value?.trim();
  const teamId=document.getElementById('tp-team')?.value;
  const hours=parseFloat(document.getElementById('tp-hours')?.value)||1;
  if(!desc){notify('Add a description','warn');return;}
  const myId=S_USER?.resId; if(!myId) return;
  const id='t'+Date.now().toString(36);
  const t={id,name:desc,tags:[],teamId,teamIds:[teamId].filter(Boolean),
    resId:myId,coResIds:[],resHours:{[myId]:hours},resource:S_USER.name,
    status:'todo',timeMode:'total',hours,hpd:null,
    start:GANTT_TODAY,dur:Math.max(1,Math.ceil(hours/(getRes(myId)?.dailyCap||HPD))),
    prog:0,deadline:null,timeLogs:[],subtasks:[],segments:null,notes:''};
  TASKS.push(t);
  migrateTasks();
  persistState(['tasks'],{tasks:[id]});
  _reRenderCurrent();
  document.getElementById('tp-desc').value='';
  document.getElementById('tp-hours').value='1';
  notify(`"${desc}" added ✓`,'success');
};

function renderTimerPanel(){
  if(!document.getElementById('timer-panel').classList.contains('open')) return;
  if(!S_USER) return;

  const dayIdx=GANTT_TODAY+_tpDayOffset;
  const dayDate=gDate(dayIdx);
  const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const lbl=document.getElementById('tp-day-lbl');
  if(lbl){
    if(_tpDayOffset===0) lbl.textContent='Today';
    else if(_tpDayOffset===1) lbl.textContent='Tomorrow';
    else if(_tpDayOffset===-1) lbl.textContent='Yesterday';
    else lbl.textContent=`${DN[dayDate.getDay()]} ${dayDate.getDate()} ${MN[dayDate.getMonth()]}`;
  }

  const projSel=document.getElementById('tp-proj-filter');
  const curProj=projSel?.value||'';
  if(projSel&&projSel.options.length<=1){
    projSel.innerHTML='<option value="">All projects</option>'+
      PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    projSel.value=curProj;
  }

  const myId=S_USER.resId;
  let myT=TASKS.filter(t=>(t.resId===myId||(t.coResIds||[]).includes(myId))&&t.status!=='cancelled');
  if(curProj){
    const proj=PROJECTS.find(p=>p.id===curProj);
    const ptags=new Set(proj?.tags||[]);
    myT=myT.filter(t=>(t.tags||[]).some(tg=>ptags.has(tg)));
  }
  if(_tpView==='day'){
    // Only show on a day if the task has scheduled hours (sched) or it's a working day within span
    const inDay=myT.filter(t=>{
      if(!t.start&&t.status!=='todo') return false;
      // Always show active timer task today
      if(_timerState.taskId===t.id&&dayIdx===GANTT_TODAY) return true;
      // Tasks that haven't started yet but are todo — show on today
      if(!t.start&&t.status==='todo'&&dayIdx===GANTT_TODAY) return true;
      if(!t.start) return false;
      if(t.start>dayIdx||tEnd(t)<dayIdx) return false;
      // If schedule data, use it; otherwise any working day in task span
      if(t._sched&&Object.keys(t._sched).length>0) return (t._sched[dayIdx]||0)>0;
      return !isNW(dayIdx,t.id,t.resId);
    });
    const noStart=(_tpDayOffset===0)?myT.filter(t=>!t.start&&t.status==='todo'):[];
    myT=[...inDay,...noStart];
  }

  const wrap=document.getElementById('tp-tasks');
  if(!myT.length){
    wrap.innerHTML=`<div style="padding:20px;text-align:center;font-size:11px;color:var(--fg3)">${_tpView==='day'?'No tasks for this day':'No tasks assigned'}</div>`;
    return;
  }

  wrap.innerHTML=myT.map(t=>{
    const isActive = _timerState.taskId===t.id && !_timerState.paused;
    const isPaused = t.status==='paused';
    const isExpanded = isActive; // ONLY the running task expands
    const planned=t._originalPlanned||t.resHours?.[myId]||tHours(t);
    const logged=_totalLoggedH(t);
    const sessH=isActive?_sessionElapsedMs()/3600000:0;
    const totalH=logged+sessH;
    const remaining=planned-totalH;
    const team=getTeam(t.teamId);
    const remColor=remaining<0?'var(--danger)':remaining<0.5?'var(--warn)':'var(--ok)';
    const statusDot=`<span style="width:8px;height:8px;border-radius:50%;background:${SCOLS[t.status]};flex-shrink:0;margin-top:3px"></span>`;

    if(!isExpanded){
      // MINIMIZED: just name + status dot + remaining + Start button
      return `<div class="tp-task${isPaused?' paused':''}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          ${statusDot}
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.name}">${t.name}</div>
            <div style="font-size:9px;color:var(--fg3);margin-top:1px">${team?`<span style="color:${team.color}">${team.name}</span> · `:''}${_fmtHours(remaining)} remaining</div>
          </div>
          ${isPaused?`<span style="font-size:9px;color:var(--acc)">⏸</span>`:''}
        </div>
        <div class="tp-btns">
          <button class="tp-btn start" onclick="tpStart('${t.id}')">${isPaused?'▶ Resume':'▶ Start'}</button>
          <button class="tp-btn start" onclick="tpDone('${t.id}')" style="background:rgba(34,197,94,.15);color:var(--ok);border:1px solid rgba(34,197,94,.3)">✓ Done</button>
          <button class="tp-btn stop" onclick="tpCancel('${t.id}')">✕</button>
        </div>
      </div>`;
    }

    // EXPANDED: full timer display for active/paused task
    return `<div class="tp-task ${isActive?'active':'paused'}">
      <div style="display:flex;align-items:flex-start;gap:6px;margin-bottom:6px">
        ${statusDot}
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${t.name}">${t.name}</div>
          <div style="font-size:9px;color:var(--fg3);margin-top:1px">${team?`<span style="color:${team.color}">${team.name}</span> · `:''}${_fmtHours(planned)} planned</div>
        </div>
        <span style="font-size:9px;color:${isActive?'var(--acc)':'var(--warn)'}">${isActive?'● Running':'⏸ Paused'}</span>
      </div>

      <div style="background:var(--bg1);border-radius:6px;padding:8px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
          <span style="font-size:9px;color:var(--fg3)">TOTAL</span>
          <div class="tp-timer ${isPaused?'paused':''}" id="tp-total-${t.id}">${_fmtMs(Math.round(totalH*3600000))}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
          <span style="font-size:9px;color:var(--fg3)">SESSION</span>
          <div style="font-size:13px;font-weight:600;font-family:var(--mono);color:var(--fg2)" id="tp-sess-${t.id}">${_fmtMs(isActive?_sessionElapsedMs():0)}</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <span style="font-size:9px;color:var(--fg3)">REMAINING</span>
          <div style="font-size:13px;font-weight:600;font-family:var(--mono);color:${remColor}" id="tp-rem-${t.id}">${_fmtHours(remaining)}</div>
        </div>
      </div>

      <div class="tp-btns">
        ${isActive
          ? `<button class="tp-btn pause" onclick="tpPause('${t.id}')">⏸ Pause</button>
             <button class="tp-btn start" onclick="tpDone('${t.id}')" style="background:rgba(34,197,94,.15);color:var(--ok);border:1px solid rgba(34,197,94,.3)">✓ Done</button>
             <button class="tp-btn stop" onclick="tpCancel('${t.id}')">✕</button>`
          : `<button class="tp-btn start" onclick="tpStart('${t.id}')">▶ Resume</button>
             <button class="tp-btn start" onclick="tpDone('${t.id}')" style="background:rgba(34,197,94,.15);color:var(--ok);border:1px solid rgba(34,197,94,.3)">✓ Done</button>
             <button class="tp-btn stop" onclick="tpCancel('${t.id}')">✕</button>`
        }
      </div>
    </div>`;
  }).join('');

  if(_timerState.taskId&&!_timerState.paused&&!_timerInterval) _startTimerTick();
}




// ============================================================
// HOW TO USE
// ============================================================
function renderHowTo(){
  const doc=document.getElementById('howto-content');
  if(!doc) return;
  doc.innerHTML=`
<style>
.ht-wrap{max-width:780px;margin:0 auto;padding:0 0 48px}
.ht-step{background:var(--bg1);border:1px solid var(--bd);border-radius:var(--r12);margin-bottom:10px;overflow:hidden}
.ht-step-h{display:flex;align-items:center;gap:10px;padding:11px 16px;cursor:pointer;user-select:none;background:var(--bg2)}
.ht-step-h:hover{background:var(--bg3)}
.ht-num{width:24px;height:24px;border-radius:50%;background:var(--acc);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0}
.ht-num.orange{background:#f59e0b}.ht-num.green{background:var(--ok)}.ht-num.purple{background:#8b5cf6}
.ht-title{font-size:12px;font-weight:600;color:var(--fg0);flex:1}
.ht-badge{font-size:9px;font-weight:700;padding:1px 7px;border-radius:10px;border:1px solid;flex-shrink:0}
.ht-body{padding:14px 16px;border-top:1px solid var(--bd)}
.ht-step.open .ht-body{display:block}.ht-step:not(.open) .ht-body{display:none}
.ht-step.open .ht-arr{transform:rotate(90deg)}
.ht-arr{transition:transform .2s;color:var(--fg3);font-size:13px}
.ht-demo{background:var(--bg2);border:1px solid var(--bd);border-radius:var(--r8);padding:12px;margin:8px 0}
.ht-btn{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:5px;border:1px solid var(--bd2);background:var(--bg3);color:var(--acc);cursor:pointer;font-size:11px;font-family:var(--font)}
.ht-btn.ok{color:var(--ok);border-color:var(--ok)}.ht-btn.warn{color:var(--warn);border-color:var(--warn)}
.ht-key{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;background:var(--bg3);border:1px solid var(--bd2);color:var(--fg1);font-family:var(--mono)}
.ht-row{display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-bottom:1px solid var(--bd);font-size:11px;line-height:1.5}
.ht-row:last-child{border:none}
.ht-perm{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:4px;font-size:10px}
.ht-perm-hdr{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--fg3);padding:4px 6px}
.ht-perm-cell{padding:4px 6px;border-radius:4px;background:var(--bg3)}
.ht-perm-y{color:var(--ok)}.ht-perm-n{color:var(--fg3)}.ht-perm-p{color:var(--warn)}
.tip{font-size:10px;color:var(--fg2);padding:6px 10px;background:rgba(79,156,249,.07);border-left:3px solid var(--acc);border-radius:0 5px 5px 0;margin:8px 0;line-height:1.6}
.tip.orange{background:rgba(245,158,11,.07);border-color:#f59e0b}
.tip.purple{background:rgba(139,92,246,.07);border-color:#8b5cf6}
.ht-2col{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ht-fi{font-size:11px;padding:4px 8px;border-radius:5px;border:1px solid var(--bd2);background:var(--bg2);color:var(--fg0);font-family:var(--font);width:100%}
@media(max-width:600px){.ht-2col,.ht-perm{grid-template-columns:1fr}.ht-perm{display:none}}
</style>
<div class="ht-wrap">
<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:4px">
  <span style="font-size:20px;font-weight:700;color:var(--fg0)">Progest — How To Use</span>
  <span style="font-size:10px;color:var(--fg3)">v${APP_VERSION}</span>
</div>
<p style="font-size:11px;color:var(--fg3);margin-bottom:16px">Click any section to expand. Sections marked <span style="color:#f59e0b;font-weight:700">Team Leader</span> or <span style="color:#8b5cf6;font-weight:700">Admin</span> require those roles.</p>

<!-- PERMISSION MATRIX -->
<div class="ht-step open">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">★</div><div class="ht-title">Permission levels</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-perm" style="margin-bottom:8px">
    <div class="ht-perm-hdr">Action</div>
    <div class="ht-perm-hdr" style="color:var(--fg2)">Resource</div>
    <div class="ht-perm-hdr" style="color:#f59e0b">Team Leader</div>
    <div class="ht-perm-hdr" style="color:#8b5cf6">Admin / PM</div>
    ${[
      ['View Gantt','✓','✓','✓'],
      ['Edit own tasks','✓','✓','✓'],
      ['Edit team tasks','✗','✓','✓'],
      ['Edit all tasks','✗','✗','✓'],
      ['Disable own days','✓','✓','✓'],
      ['Disable team days','✗','✓','✓'],
      ['Disable global days','✗','✗','✓'],
      ['Add/remove resources','✗','✗','✓ Admin'],
      ['Manage teams','✗','✗','✓ Admin'],
      ['Reset passwords','✗','✗','✓ Admin'],
      ['Clear all time logs','✗','✗','✓ Admin'],
    ].map(([a,r,tl,pm])=>`
      <div class="ht-perm-cell">${a}</div>
      <div class="ht-perm-cell ht-perm-${r==='✓'?'y':'n'}">${r}</div>
      <div class="ht-perm-cell ht-perm-${tl.startsWith('✓')?'y':'n'}">${tl}</div>
      <div class="ht-perm-cell ht-perm-${pm.startsWith('✓')?'y':'n'}">${pm}</div>`).join('')}
  </div>
  <div class="tip">Your role is shown at the bottom of the left sidebar. PM = any member of the <b>Project Management</b> team or Admin.</div>
</div>
</div>

<!-- GANTT VIEWS -->
<div class="ht-step open">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">1</div><div class="ht-title">Gantt — views & navigation</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-demo">
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      ${['By Resource (default)','By Team','By Project'].map(v=>`<button class="ht-btn" onclick="this.style.background='var(--acc)';this.style.color='#fff';setTimeout(()=>{this.style.background='';this.style.color=''},1200)">${v}</button>`).join('')}
    </div>
    <div class="ht-2col" style="font-size:11px;gap:6px">
      <div class="ht-row"><span class="ht-key">Select… ▾</span><span>Filter by project / team / resource. Multiple selections supported.</span></div>
      <div class="ht-row"><span class="ht-key">✕ Deselect all</span><span>Hide everything — click individual items to show them again.</span></div>
      <div class="ht-row"><span class="ht-key">⤷ Sub</span><span>Show/hide subtask rows. When hidden, subtask bars appear inside the parent row.</span></div>
      <div class="ht-row"><span class="ht-key">⊕ / ⊖ zoom</span><span>Adjust column width. ↺ resets to auto-fit.</span></div>
      <div class="ht-row"><span class="ht-key">← → arrows</span><span>Navigate weeks forward/back.</span></div>
      <div class="ht-row"><span class="ht-key">Today</span><span>Jump back to the current week.</span></div>
    </div>
  </div>
  <div class="tip">Bar colour = team colour. Bar thickness = hours ÷ daily capacity. Past days show <b>actual logged hours</b>; future days show <b>planned hours</b>.</div>
</div>
</div>

<!-- TASKS -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">2</div><div class="ht-title">Creating & editing tasks</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-demo">
    <div class="ht-row"><span class="ht-key">+ Task</span><span>Opens the task modal (toolbar). Can also drag an empty cell to create.</span></div>
    <div class="ht-row"><span class="ht-key">Click bar</span><span>Opens the edit modal for that task.</span></div>
    <div class="ht-row"><span class="ht-key">Drag bar</span><span>Move the task's start date.</span></div>
    <div class="ht-row"><span class="ht-key">◂ ▸ grips</span><span>Resize duration — hours recalculated automatically.</span></div>
    <div class="ht-row"><span class="ht-key">Right-click bar</span><span>Status context menu: Done, Hold, Cancelled…</span></div>
  </div>
  <p style="font-size:11px;color:var(--fg2);margin:8px 0">Two scheduling modes:</p>
  <div class="ht-2col" style="font-size:11px">
    <div style="padding:8px;background:var(--bg3);border-radius:6px"><b style="color:var(--acc)">Continuous</b> — total hours, distributed across days automatically by auto-schedule.</div>
    <div style="padding:8px;background:var(--bg3);border-radius:6px"><b style="color:var(--acc)">Daily</b> — hours/day and a date range. Runs in parallel (doesn't consume shared capacity).</div>
  </div>
  <div class="tip">Each task can have multiple resources and teams. Hours are split equally by default — adjust per resource in the task modal.</div>

  <p style="font-size:11px;color:var(--fg2);margin:10px 0 6px">Bar outlines and visual states:</p>
  <div class="ht-demo">
    <div class="ht-row">
      <span class="ht-key" style="background:rgba(240,82,82,.12);border-color:rgba(240,82,82,.4);color:#f87171;white-space:nowrap">── red pulse</span>
      <span><b style="color:#f87171">Overdue</b> — task has a deadline that has already passed.</span>
    </div>
    <div class="ht-row">
      <span class="ht-key" style="background:rgba(240,169,40,.12);border-color:rgba(240,169,40,.5);color:#fbbf24;white-space:nowrap">── yellow solid</span>
      <span><b style="color:#fbbf24">On Hold</b> — task is paused and waiting for something.</span>
    </div>
    <div class="ht-row">
      <span class="ht-key" style="background:rgba(240,169,40,.08);border-color:rgba(240,169,40,.4);color:#fbbf24;white-space:nowrap">--- yellow dashed</span>
      <span><b style="color:#fbbf24">Incomplete</b> — task is missing start date, hours, or assigned resource.</span>
    </div>
    <div class="ht-row">
      <span class="ht-key" style="background:rgba(120,120,120,.12);border-color:rgba(120,120,120,.4);color:var(--fg3);white-space:nowrap">── grey hatched</span>
      <span><b style="color:var(--fg3)">Locked</b> — task is frozen and cannot be moved (e.g. a dependency constraint is active).</span>
    </div>
    <div class="ht-row">
      <span class="ht-key" style="background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.3);color:#4ade80;white-space:nowrap">── green fade</span>
      <span><b style="color:#4ade80">Done</b> — task is completed. Bar appears at reduced opacity.</span>
    </div>
    <div class="ht-row">
      <span class="ht-key" style="background:rgba(0,201,160,.1);border-color:rgba(0,201,160,.3);color:#34d399;white-space:nowrap">── teal fade</span>
      <span><b style="color:#34d399">Ready</b> — task is ready to start.</span>
    </div>
  </div>
</div>
</div>

<!-- SUBTASKS -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">3</div><div class="ht-title">Subtasks</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-demo" id="ht-sub-demo">
    <div style="font-size:11px;font-weight:600;margin-bottom:6px;color:var(--fg0)">Task example — total: <b id="ht-sub-total">6h</b> <span id="ht-sub-prog" style="font-size:10px;color:var(--fg3)"></span></div>
    <div id="ht-sub-list" style="display:flex;flex-direction:column;gap:3px;margin-bottom:8px"></div>
  </div>
  <div class="ht-row"><span class="ht-key">⤷ Sub OFF</span><span>Subtask rows hidden. Each sub bar appears <b>below</b> the parent bar in the same row — thickness proportional to its hours ÷ cap, colour slightly more transparent.</span></div>
  <div class="ht-row"><span class="ht-key">Click subtask bar</span><span>Opens subtask editor (name, resource, hours, deadline, status, notes).</span></div>
  <div class="tip">Subtasks are scheduled by <b>Auto-schedule</b> and have their own resources and deadlines. Parent progress auto-calculates from subtask completion.</div>
</div>
</div>

<!-- STATUSES -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">4</div><div class="ht-title">Task statuses</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-demo">
    ${Object.entries({todo:'Not started',doing:'Timer running — set only via ▶ timer button',paused:'Started, timer stopped',ready:'Done, waiting for milestone date — auto-completes after milestone',done:'Fully completed',hold:'Blocked — a reason must be given',cancelled:'Excluded from planning'}).map(([s,d])=>`
    <div class="ht-row">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${SCOLS[s]};flex-shrink:0;margin-top:3px"></span>
      <span style="font-size:10px;font-weight:700;min-width:80px;color:${SCOLS[s]}">${SLABELS[s]||s}</span>
      <span style="color:var(--fg2)">${d}</span>
    </div>`).join('')}
  </div>
  <div class="tip">The red/orange vertical line = <b>project deadline</b>. Task bars turn red outline when they extend past the task's own deadline.</div>
</div>
</div>

<!-- TIMER -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">5</div><div class="ht-title">Timer — logging time</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-demo">
    <div style="display:flex;align-items:center;gap:10px;background:var(--bg3);border-radius:7px;padding:10px;margin-bottom:8px">
      <div style="font-size:24px;font-family:var(--mono);font-weight:700;color:var(--acc)" id="ht-timer-display">00:00:00</div>
      <div style="flex:1"><div style="font-size:11px;font-weight:600;color:var(--fg0)" id="ht-timer-task">No task</div>
        <div style="font-size:10px;color:var(--fg3)" id="ht-timer-state">Stopped</div></div>
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap">
      <select id="ht-timer-sel" class="ht-fi" style="flex:1;min-width:140px">
        <option value="">Select a task…</option>
        ${TASKS.filter(t=>t.status!=='done'&&t.status!=='cancelled').slice(0,8).map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}
      </select>
      <button class="ht-btn ok" onclick="htTimerStart()">▶ Start</button>
      <button class="ht-btn warn" onclick="htTimerPause()">⏸ Pause</button>
      <button class="ht-btn ok" onclick="htTimerDone()">✓ Done</button>
    </div>
    <div id="ht-timer-log" style="font-size:10px;color:var(--fg3);margin-top:5px"></div>
  </div>
  <div class="tip">Timer keeps running if you navigate to other pages. On browser close, the session is saved automatically. Only <b>you</b> can log time — it appears under your name in the Logs page.</div>
</div>
</div>

<!-- DAYS -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">6</div><div class="ht-title">Working days — enable / disable</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-row"><span class="ht-key">Click day header</span><span>Toggle that day. Weekends/holidays → enable for everyone (PM only). Weekdays → disable globally (PM only).</span></div>
  <div class="ht-row"><span class="ht-key">Click resource row header</span><span>Toggle that day for that specific resource. Team leaders can do this for their team members. Resources can do it for themselves.</span></div>
  <div class="tip orange">When a working day is disabled: tasks starting on it are pushed forward; tasks spanning it are extended by one working day.</div>
</div>
</div>

<!-- AUTO-SCHEDULE -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">7</div><div class="ht-title">Auto-schedule & milestones</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-row"><span class="ht-key">⚡ Auto</span><span>Packs all tasks from today, filling each resource's daily capacity in deadline priority order. Also schedules subtasks interleaved with parent tasks. <b>Admin only.</b> After running, a report shows how many tasks were rescheduled and the before/after dates.</span></div>
  <div class="ht-row"><span class="ht-key">◆ Milestone</span><span>Link tasks to a delivery date. Tasks set to <b>Ready</b> auto-complete to <b>Done</b> after the milestone date passes.</span></div>
  <div class="ht-demo">
    ${MILESTONES.slice(0,3).map(ms=>{
      const done=(ms.taskIds||[]).filter(id=>TASKS.find(t=>t.id===id&&(t.status==='done'||t.status==='ready'))).length;
      const total=(ms.taskIds||[]).length;
      return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:10px;border-bottom:1px solid var(--bd)">
        <span style="width:8px;height:8px;border-radius:50%;background:${ms.color||'var(--acc2)'};flex-shrink:0"></span>
        <span style="font-weight:600;color:${ms.color||'var(--acc2)'};">${ms.name}</span>
        <span style="color:var(--fg3)">${ms.dayIdx?sd(ms.dayIdx):'no date'}</span>
        <span style="color:var(--ok);margin-left:auto">${done}/${total} done</span>
      </div>`;
    }).join('')||'<div style="font-size:11px;color:var(--fg3)">No milestones yet — click ◆ Milestone in the toolbar to create one.</div>'}
  </div>
</div>
</div>

<!-- TEAM LEADER -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num" style="background:#f59e0b">TL</div><div class="ht-title">Team Leader features</div>
  <span class="ht-badge" style="color:#f59e0b;border-color:#f59e0b">Team Leader</span>
  <span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="tip orange" style="margin-bottom:10px">A Team Leader is any resource set as leader of a team (configurable in the Teams page by an Admin).</div>
  <div class="ht-row"><span>✎ Edit tasks</span><span>Can create and edit tasks belonging to their team(s) in addition to their own tasks.</span></div>
  <div class="ht-row"><span>📅 Days</span><span>Can enable/disable working days for any resource in their team — click the resource row header in the Gantt.</span></div>
  <div class="ht-row"><span>👁 View</span><span>Can see all tasks in their teams and all team members' Gantt rows.</span></div>
  <div class="tip orange">Team leaders cannot: add/remove resources, change team composition, reset passwords, or edit tasks from other teams.</div>
</div>
</div>

<!-- ADMIN -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num" style="background:#8b5cf6">A</div><div class="ht-title">Admin features</div>
  <span class="ht-badge" style="color:#8b5cf6;border-color:#8b5cf6">Admin only</span>
  <span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-2col" style="margin-bottom:10px">
    <div>
      <div style="font-size:10px;font-weight:700;color:var(--fg2);margin-bottom:6px">Resources page</div>
      <div class="ht-row"><span class="ht-key">🔑</span><span>Reset password — resets to the resource's name (lowercase, no spaces). User must change on next login.</span></div>
      <div class="ht-row"><span class="ht-key">☆ / ★</span><span>Toggle Admin — grants or revokes admin rights for that resource.</span></div>
      <div class="ht-row"><span class="ht-key">✕</span><span>Delete resource permanently.</span></div>
      <div class="ht-row"><span class="ht-key">👁</span><span>Show/hide resource in workload gauges on the Dashboard.</span></div>
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;color:var(--fg2);margin-bottom:6px">Teams page</div>
      <div class="ht-row"><span>Leader</span><span>Set the Team Leader for each team — they get editing rights for all tasks in that team.</span></div>
      <div class="ht-row"><span>Colour</span><span>Team colour appears on all task bars for that team throughout the Gantt.</span></div>
      <div class="ht-row"><span>+ Add team</span><span>Create a new team. Assign resources to teams on the Resources page.</span></div>
    </div>
  </div>
  <div style="font-size:10px;font-weight:700;color:var(--fg2);margin-bottom:6px">Other admin actions</div>
  <div class="ht-row"><span class="ht-key">Clear logs</span><span>In the Logs page — permanently clears ALL time logs from ALL tasks. Cannot be undone.</span></div>
  <div class="ht-row"><span class="ht-key">Global days</span><span>Click any day column header to disable/enable it globally for all resources.</span></div>
  <div class="ht-row"><span class="ht-key">Projects</span><span>Create projects, set deadlines (shown as vertical line in Gantt), assign colours and status.</span></div>
  <div class="tip purple">The admin account (pp) cannot have its admin status revoked. All other admins can be toggled by any existing admin.</div>
</div>
</div>

<!-- LOGS & SYNC -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">8</div><div class="ht-title">Logs & real-time sync</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-demo" style="max-height:160px;overflow-y:auto">
    ${GLOG.slice(0,8).map(e=>`
    <div style="display:grid;grid-template-columns:38px 75px 55px 1fr;gap:5px;padding:3px 0;border-bottom:1px solid var(--bd);font-size:10px;align-items:start">
      <span style="color:var(--fg3)">${e.time||'—'}</span>
      <span style="font-weight:600;color:var(--fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(e.user||'').split(' ')[0]}</span>
      <span style="color:${LCOL[e.type]||'var(--fg2)'};">${LICO[e.type]||'·'} ${e.type}</span>
      <span style="color:var(--fg1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(e.task||'').slice(0,18)}${e.to?' — '+(e.to||'').slice(0,40):''}</span>
    </div>`).join('')||'<div style="font-size:11px;color:var(--fg3)">No activity yet.</div>'}
  </div>
  <div class="ht-row" style="margin-top:8px"><span class="ht-key">● live</span><span>Firebase SSE pushes changes to all open tabs in real time. Each save sends only the changed entity — no full overwrites.</span></div>
  <div class="ht-row"><span class="ht-key">↓ updated</span><span>Appears when another user's change arrives. Gantt refreshes automatically.</span></div>
  <div class="tip">Logs record full diffs: "deadline: none → 2026-05-10", "subtask done: Check wiring", "tag added: ROB". Filter by user or type on the Logs page.</div>
</div>
</div>

<!-- MY SPACE -->
<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">9</div><div class="ht-title">My Space & My Day</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <div class="ht-row"><span class="ht-key">My Space</span><span>Personal Gantt showing only your tasks + a day-view panel with logged hours and scheduled work.</span></div>
  <div class="ht-row"><span class="ht-key">‹ › nav</span><span>Navigate days in the day panel. ↺ returns to today.</span></div>
  <div class="ht-row"><span class="ht-key">Capacity bar</span><span>Shows your daily load vs capacity (green → yellow → red as you approach full capacity).</span></div>
  <div class="tip">The ▶ Start button in the Timer panel sets a task to <b>In Progress</b> and starts timing. Only the currently-running task is expanded in the panel; others show compact buttons.</div>
</div>
</div>

<div class="ht-step">
<div class="ht-step-h" onclick="this.closest('.ht-step').classList.toggle('open')">
  <div class="ht-num">10</div><div class="ht-title">Import Tasks (ClickUp CSV)</div><span class="ht-arr">›</span>
</div>
<div class="ht-body">
  <p style="font-size:11px;color:var(--fg2);margin:0 0 10px">Tasks are imported from a ClickUp CSV export. The system automatically maps ClickUp fields to Progest fields using the rules below.</p>
  <div class="ht-demo">
    <div class="ht-row"><span class="ht-key">Task ID</span><span>Used as the <b>external_id</b> — the unique identifier that links imported tasks to ClickUp. Tasks with a matching external_id are <b>updated</b>; tasks without one are <b>created</b>.</span></div>
    <div class="ht-row"><span class="ht-key">Task Name</span><span>Maps to the task <b>name</b>.</span></div>
    <div class="ht-row"><span class="ht-key">Home Location ID</span><span>Maps to the <b>project</b> by matching the <b>External Project ID</b> field set in each project's settings (Edit Project). If no match is found, a validation error is shown — set the External Project ID on the corresponding project to fix it.</span></div>
    <div class="ht-row"><span class="ht-key">Time Estimated</span><span>Converted to <b>total hours</b>: value in milliseconds ÷ 1000 ÷ 3600. <b>New tasks without estimated time are not created.</b> Existing tasks without time are updated (hours set to 0).</span></div>
    <div class="ht-row"><span class="ht-key">Time Spent</span><span>Converted to <b>logged hours</b> (milliseconds ÷ 1000 ÷ 3600) and stored in the task's time log as an "Imported from ClickUp" entry. On update, only the import entry is replaced — manually logged hours are preserved.</span></div>
    <div class="ht-row"><span class="ht-key">Status</span><span>Mapped to Progest status: <b>to do</b> → todo · <b>in progress / critical</b> → doing · <b>on hold</b> → hold · <b>review</b> → ready · <b>completed / migrated / closed</b> → done · <b>canceled</b> → cancelled.</span></div>
    <div class="ht-row"><span class="ht-key">Assignees</span><span>Maps to <b>resource</b>. Brackets <code>[ ]</code> are removed; multiple assignees separated by commas become multiple resources separated by <code>;</code>. <b>New tasks without a resource are not created.</b> Existing tasks without a resource are updated (resource is cleared).</span></div>
    <div class="ht-row"><span class="ht-key">Tags</span><span>If Tags contains <b>sr hélder</b>, <b>Hélder Parente</b> is automatically added as a resource to that task.</span></div>
  </div>
  <p style="font-size:11px;color:var(--fg2);margin:10px 0 6px">Fixed values (always the same regardless of the CSV):</p>
  <div class="ht-demo">
    <div class="ht-row"><span class="ht-key">group</span><span>Derived automatically from the task name: <b> - 1</b> → Requisitos e Especificação · <b> - 2</b> → Protótipo · <b> - 3</b> → Validação · <b> - 4</b> → Handover · <b> - 5</b> → Avaliação de Riscos Técnicos · <b> - 6</b> → Projeto. If none match, group is left empty.</span></div>
    <div class="ht-row"><span class="ht-key">type</span><span>Always <b>continuous</b>.</span></div>
    <div class="ht-row"><span class="ht-key">hours_per_day, start/end date, deadline, notes, resource_hours, weekdays</span><span>Always left <b>empty</b> — scheduled by auto-schedule.</span></div>
  </div>
  <p style="font-size:11px;color:var(--fg2);margin:10px 0 6px">Create vs Update rules:</p>
  <div class="ht-demo">
    <div class="ht-row"><span class="ht-key">New task</span><span>If the Task ID does not match any existing external_id → <b>creates</b> a new task (unless status is completed / migrated / canceled / closed).</span></div>
    <div class="ht-row"><span class="ht-key">Existing task</span><span>If the Task ID matches an existing external_id → <b>updates</b> name, project, group, total hours, status and resources. Deadline is never updated. Always updates, including completed/migrated/canceled/closed tasks.</span></div>
    <div class="ht-row"><span class="ht-key">Skip statuses</span><span>Tasks with status <b>completed, migrated, canceled or closed</b> are <b>not created</b> if they don't already exist in Progest.</span></div>
    <div class="ht-row"><span class="ht-key">Skipped</span><span>New tasks are silently skipped (no error shown) when: status is completed/migrated/canceled/closed, <b>no resource</b> is assigned, or <b>no hours</b> are estimated. The preview shows a <b>skipped</b> count. Existing tasks are always updated regardless.</span></div>
  </div>
</div>
</div>

</div>

<scr` + `ipt>
// How To Use helpers
let _htTrn=false,_htTs=0,_htTInt=null;
function htTimerStart(){
  const sel=document.getElementById('ht-timer-sel');
  if(!sel?.value){document.getElementById('ht-timer-log').textContent='⚠ Select a task first';return;}
  const t=TASKS.find(x=>x.id===sel.value);
  document.getElementById('ht-timer-task').textContent=t?.name||'?';
  document.getElementById('ht-timer-state').textContent='In Progress ●';
  document.getElementById('ht-timer-state').style.color='var(--acc)';
  if(!_htTrn){_htTrn=true;_htTs=Date.now();
    _htTInt=setInterval(()=>{const s=Math.floor((Date.now()-_htTs)/1000);const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;const el=document.getElementById('ht-timer-display');if(el)el.textContent=[h,m,sc].map(x=>x.toString().padStart(2,'0')).join(':');},1000);}
  document.getElementById('ht-timer-log').textContent='▶ Timer started for "'+t?.name+'"';
}
function htTimerPause(){
  if(!_htTrn)return;clearInterval(_htTInt);_htTrn=false;
  document.getElementById('ht-timer-state').textContent='Paused';
  document.getElementById('ht-timer-state').style.color='var(--warn)';
  const s=Math.floor((Date.now()-_htTs)/1000);document.getElementById('ht-timer-log').textContent='⏸ '+Math.floor(s/60)+'m '+s%60+'s';
}
function htTimerDone(){
  clearInterval(_htTInt);_htTrn=false;
  const h=((Date.now()-_htTs)/3600000).toFixed(2);
  document.getElementById('ht-timer-state').textContent='Done ✓';
  document.getElementById('ht-timer-state').style.color='var(--ok)';
  const el=document.getElementById('ht-timer-display');if(el)el.textContent='00:00:00';
  document.getElementById('ht-timer-log').textContent='✓ Simulated: '+h+'h logged';
  _htTs=Date.now();
}
let _htSubs=[{name:'Check wiring',hours:3,status:'done'},{name:'Install sensors',hours:5,status:'todo'}];
const _htPH=6;
function htRenderSubs(){
  const el=document.getElementById('ht-sub-list');if(!el)return;
  el.innerHTML=_htSubs.map((s,i)=>{
    const done=s.status==='done';
    return '<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:var(--bg3);border-radius:6px;opacity:'+(done?.55:1)+'">'
      +'<button onclick="_htSubs['+i+'].status=_htSubs['+i+'].status===\'done\'?\'todo\':\'done\';htRenderSubs()" style="width:11px;height:11px;border-radius:50%;border:1.5px solid '+(done?'var(--ok)':'var(--fg3)')+';background:'+(done?'var(--ok)':'transparent')+';cursor:pointer;padding:0;flex-shrink:0"></button>'
      +'<span style="font-size:11px;color:'+(done?'var(--fg3)':'var(--fg1)')+';flex:1;'+(done?'text-decoration:line-through':'')+'">'+(s.name||'')+'</span>'
      +'<span style="font-size:10px;color:var(--fg3)">'+s.hours+'h</span>'
      +'<button onclick="_htSubs.splice('+i+',1);htRenderSubs()" style="background:none;border:none;cursor:pointer;color:var(--fg3);font-size:12px;padding:0">✕</button>'
      +'</div>';
  }).join('');
  const done=_htSubs.filter(s=>s.status==='done').length;
  const stH=_htSubs.reduce((a,s)=>a+s.hours,0);
  const tot=document.getElementById('ht-sub-total');if(tot)tot.textContent=(_htPH+stH)+'h';
  const prog=_htSubs.length?Math.round(done/_htSubs.length*100):0;
  const lbl=document.getElementById('ht-sub-prog');if(lbl)lbl.textContent='('+done+'/'+_htSubs.length+' done, '+prog+'% progress)';
}
function htAddSub(){_htSubs.push({name:'New subtask',hours:4,status:'todo'});htRenderSubs();}
htRenderSubs();
<\/script>
`;
}

// ============================================================
// MILESTONES
// ============================================================
let _msEditId=null;


function _populateMsFilters(){
  const ts=document.getElementById('ms-task-team'); if(ts) ts.innerHTML='<option value="">All teams</option>'+TEAMS.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
  const rs=document.getElementById('ms-task-res'); if(rs) rs.innerHTML='<option value="">All resources</option>'+RESOURCES.map(r=>`<option value="${r.id}">${r.name}</option>`).join('');
}
window._renderMsTaskListFiltered=()=>{
  // Save currently checked before re-render
  const checked=new Set([...document.querySelectorAll('#ms-task-list input[type=checkbox]:checked')].map(cb=>cb.value));
  window._msCurSelected=[...new Set([...(window._msCurSelected||[]),...checked])];
  const sel=new Set(window._msCurSelected||[]);

  const q=(document.getElementById('ms-task-search')?.value||'').toLowerCase();
  const tf=document.getElementById('ms-task-team')?.value||'';
  const rf=document.getElementById('ms-task-res')?.value||'';

  // Filter by active project if one is selected
  const _msProjId=document.getElementById('ms-proj')?.value||null;
  const projFilter=t=>!_msProjId||(t.projId===_msProjId);

  // Selected tasks always shown first; unselected filtered by search
  const selected=TASKS.filter(t=>sel.has(t.id)&&projFilter(t));
  const unselected=TASKS.filter(t=>!sel.has(t.id)&&projFilter(t)&&(
    (!q||t.name.toLowerCase().includes(q))&&
    (!tf||(t.teamId===tf||(t.teamIds||[]).includes(tf)))&&
    (!rf||t.resId===rf)
  ));

  const list=[...selected,...unselected];
  const el=document.getElementById('ms-task-list'); if(!el) return;

  const mkRow=t=>`<label style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:4px;cursor:pointer;font-size:11px;${sel.has(t.id)?'background:rgba(123,97,255,.1);':''}color:${sel.has(t.id)?'var(--fg0)':'var(--fg2)'}">
    <input type="checkbox" ${sel.has(t.id)?'checked':''} value="${t.id}" style="accent-color:var(--acc2)" onchange="(window._msCurSelected=window._msCurSelected||[],this.checked?(!window._msCurSelected.includes('${t.id}')&&window._msCurSelected.push('${t.id}')):window._msCurSelected=window._msCurSelected.filter(x=>x!=='${t.id}'),_renderMsTaskListFiltered())">
    <span style="width:7px;height:7px;border-radius:50%;background:${SCOLS[t.status]};flex-shrink:0"></span>
    ${t.name}${t.tags?.length?` <span style="font-size:8px;color:var(--fg3)">${t.tags.join(', ')}</span>`:''}
  </label>`;

  if(selected.length&&unselected.length){
    el.innerHTML=selected.map(mkRow).join('')+
      `<div style="height:1px;background:var(--bd);margin:4px 0"></div>`+
      unselected.map(mkRow).join('');
  } else {
    el.innerHTML=list.map(mkRow).join('')||'<div style="font-size:11px;color:var(--fg3);padding:6px">No tasks found</div>';
  }
};

// Update colour picker: disable colours already used on the selected date
function _updateMsColorAvailability(){
  // No restrictions — all colors always available
  document.querySelectorAll('#ms-colors div').forEach(d=>{
    d.style.opacity='1';
    d.style.cursor='pointer';
    d.style.pointerEvents='auto';
    d.title='';
  });
}
window.selMsCol=(el,col)=>{
  document.getElementById('ms-color').value=col;
  document.querySelectorAll('#ms-colors div').forEach(d=>{
    const sel=d.dataset.col===col;
    d.style.border=sel?'3px solid white':'2px solid transparent';
    d.style.boxShadow=sel?'0 0 0 2px '+col:'none';
  });
};

window.openAddMilestone=()=>{
  _msEditId=null;
  document.getElementById('ms-modal-title').textContent='New Milestone';
  document.getElementById('ms-name').value='';
  document.getElementById('ms-date').value=new Date().toISOString().slice(0,10);
  document.getElementById('ms-color').value='#7b61ff';
  document.getElementById('ms-del-btn').style.display='none';
  const _msProjSel=document.getElementById('ms-proj');
  if(_msProjSel){ _msProjSel.innerHTML='<option value="">— all projects —</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join(''); _msProjSel.value=''; }
  selMsCol(null,'#7b61ff');
  setTimeout(_updateMsColorAvailability,0);
  window._msCurSelected=[];
  if(document.getElementById('ms-task-search')) document.getElementById('ms-task-search').value='';
  _populateMsFilters();
  _renderMsTaskList(null);
  OM('m-milestone');
};

window.openEditMilestone=(msId)=>{
  const ms=MILESTONES.find(m=>m.id===msId); if(!ms) return;
  _msEditId=msId;
  document.getElementById('ms-modal-title').textContent='Edit Milestone';
  document.getElementById('ms-name').value=ms.name;
  const d=gDate(ms.dayIdx); const pad=n=>String(n).padStart(2,'0');
  document.getElementById('ms-date').value=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  document.getElementById('ms-color').value=ms.color||'#7b61ff';
  document.getElementById('ms-del-btn').style.display='';
  selMsCol(null,ms.color||'#7b61ff');
  const _msProjSel2=document.getElementById('ms-proj');
  if(_msProjSel2){ _msProjSel2.innerHTML='<option value="">— all projects —</option>'+PROJECTS.map(p=>`<option value="${p.id}">${p.name}</option>`).join(''); _msProjSel2.value=ms.projId||''; }
  setTimeout(_updateMsColorAvailability,0);
  window._msCurSelected=[...(ms.taskIds||[])];
  _populateMsFilters();
  _renderMsTaskList(ms.taskIds||[]);
  OM('m-milestone');
};

function _renderMsTaskList(selectedIds){
  const sel=new Set(selectedIds||[]);
  const el=document.getElementById('ms-task-list');
  if(!el) return;
  const sortedTasks=[...TASKS].sort((a,b)=>a.name.localeCompare(b.name));
  el.innerHTML=sortedTasks.map(t=>`
    <label style="display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:4px;cursor:pointer;font-size:11px;color:${sel.has(t.id)?'var(--fg0)':'var(--fg2)'}">
      <input type="checkbox" ${sel.has(t.id)?'checked':''} value="${t.id}" style="accent-color:var(--acc2)">
      <span style="width:7px;height:7px;border-radius:50%;background:${SCOLS[t.status]};flex-shrink:0"></span>
      ${t.name}
    </label>`).join('');
}

window.saveMilestone=()=>{
  // Check for duplicate colour on same day
  const date=document.getElementById('ms-date').value;


  const name=document.getElementById('ms-name').value.trim();
  const dateStr=document.getElementById('ms-date').value;
  if(!name){notify('Name required','warn');return;}
  if(!dateStr){notify('Date required','warn');return;}
  const dayIdx=dateToIdx(dateStr);
  if(!dayIdx){notify('Invalid date','warn');return;}
  const color=document.getElementById('ms-color').value||'#7b61ff';
  const projId=document.getElementById('ms-proj')?.value||null;
  const taskIds=[...document.querySelectorAll('#ms-task-list input[type=checkbox]:checked')].map(cb=>cb.value);
  if(_msEditId){
    const ms=MILESTONES.find(m=>m.id===_msEditId);
    if(ms){Object.assign(ms,{name,dayIdx,color,taskIds,projId});}
    const _old=MILESTONES.find(m=>m.id===_msEditId);
    const _msDiffs=[];
    if(_old?.name!==name) _msDiffs.push(`name: "${_old?.name}" → "${name}"`);
    if(_old?.dayIdx!==dayIdx) _msDiffs.push(`date: ${_old?.dayIdx?sd(_old.dayIdx):'—'} → ${sd(dayIdx)}`);
    const _prevIds=_old?.taskIds||[]; const _addedTs=taskIds.filter(id=>!_prevIds.includes(id)); const _removedTs=_prevIds.filter(id=>!taskIds.includes(id));
    if(_addedTs.length) _msDiffs.push(`+tasks: ${_addedTs.map(id=>TASKS.find(t=>t.id===id)?.name||id).join(', ')}`);
    if(_removedTs.length) _msDiffs.push(`-tasks: ${_removedTs.map(id=>TASKS.find(t=>t.id===id)?.name||id).join(', ')}`);
    addLog({type:'milestone',task:name,from:'',to:_msDiffs.length?_msDiffs.join(' · '):'saved'});
  } else {
    MILESTONES.push({id:'ms'+Date.now().toString(36),name,dayIdx,color,taskIds,projId,shape:'diamond'});
    addLog({type:'milestone',task:name,from:'',to:`created — ${sd(dayIdx)}${taskIds.length?' · '+taskIds.length+' task(s)':''}`});
  }
  persistState(['milestones']);
  CM('m-milestone');
  renderGantt();
  _refreshOverview();
  notify(`Milestone "${name}" saved ✓`,'success');
};

window.deleteMilestone=()=>{
  if(!_msEditId||!confirm('Delete this milestone?')) return;
  const _dm=MILESTONES.find(m=>m.id===_msEditId);
  addLog({type:'milestone',task:_dm?.name||'',from:'',to:'deleted'});
  _deletedIds.milestones.add(_msEditId);
  MILESTONES=MILESTONES.filter(m=>m.id!==_msEditId);
  if(_msFilter===_msEditId) _msFilter=null;
  persistState(['milestones']);
  CM('m-milestone');
  renderGantt();
  _refreshOverview();
  notify('Milestone deleted','warn');
};


// ── MOBILE HAMBURGER ─────────────────────────────────────────
(function(){
  function isMob(){ return window.innerWidth<=768 || ('ontouchstart' in window && window.innerWidth<=1024); }

  function ensureMobUI(){
    if(!isMob()) return;
    // Hamburger button
    if(!document.getElementById('mob-menu-btn')){
      const btn=document.createElement('div');
      btn.id='mob-menu-btn';
      btn.innerHTML='<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><line x1="2" y1="4" x2="16" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="2" y1="14" x2="16" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
      btn.style.cssText='display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;background:var(--bg2);border:1px solid var(--bd);cursor:pointer;color:var(--fg1);flex-shrink:0';
      btn.onclick=toggleMob;
      const tb=document.getElementById('topbar');
      if(tb) tb.prepend(btn);
    }
    // Overlay
    if(!document.getElementById('mob-overlay')){
      const ov=document.createElement('div');
      ov.id='mob-overlay';
      ov.onclick=closeMob;
      document.body.appendChild(ov);
    }
  }

  function toggleMob(){
    const sb=document.getElementById('sb');
    const ov=document.getElementById('mob-overlay');
    const isOpen=sb.classList.contains('mob-open');
    sb.classList.toggle('mob-open',!isOpen);
    ov.classList.toggle('show',!isOpen);
  }

  function closeMob(){
    document.getElementById('sb')?.classList.remove('mob-open');
    document.getElementById('mob-overlay')?.classList.remove('show');
  }

  // Close menu when a nav item is clicked on mobile
  window.addEventListener('click', e=>{
    if(!isMob()) return;
    const nav=e.target.closest('.nav');
    if(nav) setTimeout(closeMob, 150);
  });

  window.toggleMob=toggleMob;
  window.closeMob=closeMob;

  // Init after DOM ready
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', ensureMobUI);

  // ── Sync ROW 2 sticky top to ROW 1 height ───────────────────
  document.addEventListener('DOMContentLoaded',()=>{
    function _syncRow2(){
      const r1=document.getElementById('dl-banner');
      const r2=document.getElementById('gantt-row2');
      if(r1&&r2) r2.style.top=r1.offsetHeight+'px';
    }
    _syncRow2();
    new ResizeObserver(_syncRow2).observe(document.getElementById('dl-banner')||document.body);
  });

  // ── Sticky Gantt thead (disabled) ───────────────────────────
  window._syncGanttThead=()=>{};
  } else {
    ensureMobUI();
  }
  window.addEventListener('resize', ensureMobUI);
})();


// ============================================================
// MOBILE ACTIVE TASK BANNER
// ============================================================
function updateMobBanner(){
  if(window.innerWidth>768) return;
  const banner=document.getElementById('mob-active-task');
  if(!banner) return;
  const tid=_timerState?.taskId;
  const t=tid?TASKS.find(x=>x.id===tid):null;
  const isRunning=t&&!_timerState.paused;
  const isPaused=t&&_timerState.paused;
  const show=t&&(isRunning||isPaused);
  banner.style.display=show?'flex':'none';
  if(!show) return;
  const nameEl=document.getElementById('mob-task-name');
  const metaEl=document.getElementById('mob-task-meta');
  const pauseBtn=document.getElementById('mob-pause-btn');
  if(nameEl) nameEl.textContent=t.name;
  const rem=Math.max(0,(t._originalPlanned||tHours(t))-_totalLoggedH(t)-_sessionElapsedMs()/3600000);
  if(metaEl) metaEl.textContent=(getTeam(t.teamId)?.name||'')+' · '+_fmtHours(rem)+' left';
  if(pauseBtn){
    if(isRunning){ pauseBtn.textContent='⏸'; pauseBtn.style.background='rgba(240,169,40,.2)'; pauseBtn.style.color='var(--warn)'; }
    else { pauseBtn.textContent='▶'; pauseBtn.style.background='rgba(79,156,249,.15)'; pauseBtn.style.color='var(--acc)'; }
  }
  const timerEl=document.getElementById('mob-timer');
  if(timerEl) timerEl.textContent=_fmtMs(Math.round((_totalLoggedH(t)+_sessionElapsedMs()/3600000)*3600000));
}
window.mobToggleActive=()=>{
  const tid=_timerState?.taskId;
  if(!tid) return;
  if(_timerState.paused) tpStart(tid); else tpPause(tid);
};

// Mobile banner: update timer display via a separate interval started after login

// ============================================================
// WEEK VIEW
// ============================================================
let _weekView=false;
let _ganttZoom=null; // null = auto, number = index into ZOOM_STEPS
let _myView='gantt'; // 'gantt' | 'day'
let _myDayOffset=0; // days offset from today for day view

window.toggleWeekView=()=>{ /* removed */ };
window.ganttZoom=(dir)=>{
  if(dir===0){
    _ganttZoom=null; // reset to auto
  } else {
    // If currently on auto, find closest step index first
    if(_ganttZoom===null){
      const STEPS=[14,18,22,28,36,48,64,90];
      const gw=document.getElementById('gw');
      const availW=Math.max(300,(gw?.clientWidth||window.innerWidth-350));
      const autoW=Math.max(14,Math.min(90,Math.floor(availW/28)));
      // Find closest step
      let best=3, bestDiff=999;
      STEPS.forEach((s,i)=>{ const d=Math.abs(s-autoW); if(d<bestDiff){bestDiff=d;best=i;} });
      _ganttZoom=best;
    }
    _ganttZoom=Math.max(0,Math.min(7,_ganttZoom+dir));
  }
  const btn=document.getElementById('btn-zoom-reset');
  if(btn) btn.style.color=_ganttZoom!==null?'var(--acc)':'';
  renderGantt();
  // Also re-render My Space if open
  if(S.page==='myspace'&&_myView==='gantt'){
    const me=S_USER?getRes(S_USER.resId):null;
    if(me){ const myT=TASKS.filter(t=>t.resId===me.id||(t.coResIds||[]).includes(me.id)); renderMyGantt(myT,me.id); }
  }
};

// Patch renderGantt to support week view
const _origRenderGantt=renderGantt;
window.renderGantt=function(){
  if(!_weekView){ _origRenderGantt(); return; }
  renderGanttWeek();
};

function renderGanttWeek(){
  computeAllSchedules();
  // Populate project selector
  const _pSel=document.getElementById('proj-selector');
  if(_pSel){
    const _cur=_pSel.value;
    _pSel.innerHTML='<option value="">All projects</option>'+PROJECTS.filter(p=>p.status!=='on_hold'&&p.status!=='cancelled').map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
    if(_cur && !isProjOnHold(_cur)) _pSel.value=_cur; else if(isProjOnHold(S._activeProjId)){ S._activeProjId=null; _pSel.value=""; }
  }
  const tasks=visTasks();
  const rows=buildGRows(tasks);

  // Build 12 weeks starting from current week Monday
  const todayDate=gDate(GANTT_TODAY);
  const monday=new Date(todayDate);
  monday.setDate(todayDate.getDate()-((todayDate.getDay()+6)%7));
  const NWEEKS=12;
  const weeks=[];
  for(let w=0;w<NWEEKS;w++){
    const wStart=new Date(monday); wStart.setDate(monday.getDate()+w*7);
    const wEnd=new Date(wStart); wEnd.setDate(wStart.getDate()+6);
    const startIdx=dateToIdx(wStart.toISOString().slice(0,10));
    const endIdx=dateToIdx(wEnd.toISOString().slice(0,10));
    const isCurrentWeek=startIdx<=GANTT_TODAY&&GANTT_TODAY<=endIdx;
    const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    weeks.push({startIdx,endIdx,label:wStart.getDate()+' '+MN[wStart.getMonth()],isCurrentWeek});
  }

  const NAME_W=160, WCOL_W=52;
  let H=`<div><table class="gt" style="width:100%;table-layout:fixed">
  <thead>
    <tr>
      <th style="width:${NAME_W}px;text-align:left;padding-left:10px;background:var(--bg2);position:sticky;left:0;z-index:3">Task</th>
      <th style="width:32px;background:var(--bg2)">Hrs</th>
      ${weeks.map(w=>`<th style="width:${WCOL_W}px;background:${w.isCurrentWeek?'rgba(79,156,249,.15)':'var(--bg2)'};color:${w.isCurrentWeek?'var(--acc)':'var(--fg2)'}${w.isCurrentWeek?';outline:2px solid rgba(79,156,249,.3);outline-offset:-2px':''}">${w.label}</th>`).join('')}
    </tr>
  </thead><tbody>`;

  let curResId=null;
  rows.forEach(({t,depth,isHeader,label})=>{
    if(isHeader){
      const res=RESOURCES.find(r=>r.id===label)||{name:label};
      H+=`<tr><td colspan="${2+NWEEKS}" style="background:var(--bg2);padding:5px 10px;font-size:9px;font-weight:700;color:var(--acc3);position:sticky;left:0">${label==='__nogroup'?'':'● '+(RESOURCES.find(r=>r.id===label)?.name||TEAMS.find(t=>t.id===label)?.name||label)}</td></tr>`;
      return;
    }
    const th=tHours(t);
    const barColor=t.teamId?(getTeam(t.teamId)?.color||'#7a8aaa'):'#7a8aaa';
    const isDone=t.status==='done';
    const isHold=t.status==='hold';
    const isOv=getEffectiveDeadline(t)&&!isDone&&tEnd(t)>dateToIdx(getEffectiveDeadline(t));

    H+=`<tr ondblclick="openEditTask('${t.id}')" oncontextmenu="showCtx(event,'${t.id}')">
      <td style="position:sticky;left:0;background:var(--bg1);padding:3px 8px;z-index:1">
        <div style="font-size:10px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${isDone?'var(--fg3)':'var(--fg0)'}">${t.name}</div>
        <div style="font-size:8px;color:var(--fg3);margin-top:1px">${(t.tags||[]).map(tg=>`<span style="background:rgba(79,156,249,.1);color:var(--acc);padding:1px 5px;border-radius:3px;margin-right:2px">${tg}</span>`).join('')}</div>
      </td>
      <td style="text-align:center;font-size:9px;color:var(--fg2)">${th}h</td>
      ${weeks.map(w=>{
        // Does task span this week?
        const tStart=t.start||99999, tEnd2=tEnd(t)||0;
        const overlap=tStart<=w.endIdx&&tEnd2>=w.startIdx;
        if(!overlap) return `<td style="background:${w.isCurrentWeek?'rgba(79,156,249,.04)':''}"></td>`;
        // Hours scheduled in this week
        const weekH=Object.entries(t._sched||{}).reduce((s,[d,h])=>{const di=parseInt(d);return di>=w.startIdx&&di<=w.endIdx?s+h:s;},0);
        const loggedW=(t.timeLogs||[]).filter(l=>{const d=dateToIdx(l.date);return d>=w.startIdx&&d<=w.endIdx;}).reduce((s,l)=>s+l.hours,0);
        const dispH=weekH||loggedW;
        const ms=MILESTONES.filter(m=>(m.taskIds||[]).includes(t.id)&&m.dayIdx>=w.startIdx&&m.dayIdx<=w.endIdx&&(!S._activeProjId||(m.projId?m.projId===S._activeProjId:(m.taskIds||[]).some(id=>TASKS.find(t=>t.id===id&&t.projId===S._activeProjId)))));
        const _wmc=ms.length?(ms[0].color||'var(--acc2)'):'';
        const _wmStyle=ms.length?`background-image:linear-gradient(to right,transparent calc(50% - 1px),${_wmc} calc(50% - 1px),${_wmc} calc(50% + 1px),transparent calc(50% + 1px));`:'';
        if(dispH>0){
          return `<td style="padding:2px;vertical-align:middle;${_wmStyle}${w.isCurrentWeek?'background-color:rgba(79,156,249,.04)':''}">
            <div style="background:${isDone?'var(--ok)':barColor};height:18px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff">${Math.round(dispH)}h</div>
          </td>`;
        }
        return `<td style="${w.isCurrentWeek?'background:rgba(79,156,249,.04)':''}${msStyle}">
          <div style="height:6px;background:${barColor}44;border-radius:3px;margin:2px"></div>
        </td>`;
      }).join('')}
    </tr>`;
  });

  H+=`</tbody></table></div>`;
  document.getElementById('gw').innerHTML=H;
  renderLog();
}


// Update timer toggle tab state
function updateTimerToggle(){
  const btn=document.getElementById('timer-toggle');
  if(!btn) return;
  const tid=_timerState?.taskId;
  const isPlaying=tid&&!_timerState.paused;
  const icon=document.getElementById('tt-icon');
  const lbl=document.getElementById('tt-label');
  btn.classList.remove('tt-playing','tt-idle');
  if(isPlaying){
    btn.classList.add('tt-playing');
    if(icon) icon.textContent='▶';
    if(lbl){ lbl.textContent='REC'; lbl.style.color='var(--ok)'; }
  } else {
    // Not recording — red blink regardless of pause/idle
    btn.classList.add('tt-idle');
    if(icon) icon.textContent='⏱';
    if(lbl){ lbl.textContent='TIMER'; lbl.style.color='var(--danger)'; }
  }
}

// ============================================================
// PRODUCTION
// ============================================================
function renderProduction(){
  const el=document.getElementById('prod-content');
  if(!el) return;
  const data=window._prodData;
  if(!data||!data.length){
    el.innerHTML='<div style="padding:40px;text-align:center;color:var(--fg3);font-size:13px">No data — click <b>📂 Load JSON</b> to import a pending lines file.</div>';
    return;
  }

  // Filter state
  if(window._prodFilterMy===undefined) window._prodFilterMy=true;
  // Default visible columns
  const ALL_COLS=['Documento','DataEntrega','CodigoArtigo','NomeArtigo','Qtd','QtdTransferida','QtdPendente','Obra','IdLinha'];
  if(!window._prodCols) window._prodCols=['Documento','DataEntrega','CodigoArtigo','NomeArtigo','Qtd','QtdTransferida','QtdPendente'];

  const search=(document.getElementById('prod-search')?.value||'').toLowerCase();
  const sortBy=document.getElementById('prod-sort')?.value||'date';

  // Update filter button
  const fbtn=document.getElementById('prod-filter-btn');
  if(fbtn){
    const canAll=isPM();
    fbtn.style.display=canAll?'':'none';
    fbtn.textContent=window._prodFilterMy?'🔒 My Projects':'🌐 All Orders';
    fbtn.style.opacity=window._prodFilterMy?'1':'0.6';
  }

  // Build set of orderIds linked to projects
  const linkedOrderIds=new Set(PROJECTS.flatMap(p=>(p.orderId||'').split(',').map(s=>s.trim()).filter(Boolean)));

  // Filter lines
  let lines=data.filter(l=>{
    if(window._prodFilterMy && !linkedOrderIds.has(l.Documento)) return false;
    if(!search) return true;
    return ['Documento','CodigoArtigo','NomeArtigo','Obra','IdLinha'].some(k=>(l[k]||'').toLowerCase().includes(search));
  });

  // Group by Documento
  const byDoc={};
  lines.forEach(l=>{
    if(!byDoc[l.Documento]) byDoc[l.Documento]={
      doc:l.Documento, lines:[], minDate:l.DataEntrega, maxDate:l.DataEntrega,
      totalQty:0, totalPend:0,
      proj:PROJECTS.find(p=>(p.orderId||'').split(',').map(s=>s.trim()).includes(l.Documento))||null
    };
    const g=byDoc[l.Documento];
    g.lines.push(l);
    g.totalQty+=(l.Qtd||0);
    g.totalPend+=(l.QtdPendente||0);
    if(l.DataEntrega<g.minDate) g.minDate=l.DataEntrega;
    if(l.DataEntrega>g.maxDate) g.maxDate=l.DataEntrega;
  });

  let groups=Object.values(byDoc);
  if(sortBy==='date') groups.sort((a,b)=>a.minDate.localeCompare(b.minDate));
  else if(sortBy==='doc') groups.sort((a,b)=>a.doc.localeCompare(b.doc));
  else if(sortBy==='qty') groups.sort((a,b)=>b.totalPend-a.totalPend);

  const today=new Date().toISOString().slice(0,10);
  const _sd=d=>{if(!d||d==='0001-01-01')return'—';const dt=new Date(d+'T00:00:00');return dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});};
  const _ov=d=>d&&d!=='0001-01-01'&&d<today;
  const _soon=d=>{if(!d||d==='0001-01-01')return false;const diff=(new Date(d+'T00:00:00')-new Date())/(1000*86400);return diff>=0&&diff<=7;};

  // Milestone diamond button
  const msBtn=(doc,line,date,label)=>{
    const proj=PROJECTS.find(p=>(p.orderId||'').split(',').map(s=>s.trim()).includes(doc));
    if(!proj) return '';
    const enc=encodeURIComponent;
    return `<button onclick="prodAddMilestone('${enc(proj.id)}','${enc(label)}','${date}')"
      title="Add milestone to project ${proj.name}"
      style="padding:0 5px;height:18px;font-size:9px;border-radius:4px;border:1px solid var(--acc);background:rgba(79,156,249,.1);color:var(--acc);cursor:pointer;line-height:18px">◆ MS</button>`;
  };

  const cols=window._prodCols;
  const colLabel={'Documento':'Order','DataEntrega':'Delivery','CodigoArtigo':'Code','NomeArtigo':'Article','Qtd':'Qty','QtdTransferida':'Transferred','QtdPendente':'Pending','Obra':'Obra ID','IdLinha':'Line ID'};

  let H=`<div style="font-size:11px;color:var(--fg3);margin-bottom:10px">${groups.length} orders · ${lines.length} lines · ${lines.reduce((a,l)=>a+(l.QtdPendente||0),0).toFixed(0)} units pending</div>`;

  groups.forEach(g=>{
    const ov=_ov(g.minDate); const soon=_soon(g.minDate);
    const borderCol=ov?'var(--danger)':soon?'var(--warn)':'var(--bd)';
    const bgCol=ov?'rgba(220,38,38,.05)':soon?'rgba(245,158,11,.05)':'var(--bg1)';
    const dateRange=g.minDate===g.maxDate?_sd(g.minDate):`${_sd(g.minDate)} → ${_sd(g.maxDate)}`;

    H+=`<div style="border:1px solid ${borderCol};border-radius:10px;margin-bottom:8px;overflow:hidden;background:${bgCol}">
      <!-- Order header -->
      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;cursor:pointer;user-select:none"
           onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none';this.querySelector('.pa').textContent=this.nextElementSibling.style.display==='none'?'▶':'▼'">
        <span class="pa" style="font-size:10px;color:var(--fg3);width:10px;flex-shrink:0">▼</span>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span style="font-size:13px;font-weight:700;color:var(--fg0)">Order ${g.doc}</span>
            ${g.proj?`<span style="font-size:10px;padding:1px 6px;border-radius:4px;background:${g.proj.color||'var(--acc)'}22;color:${g.proj.color||'var(--acc)'};">${g.proj.name}</span>`:''}
            ${ov?'<span style="font-size:9px;font-weight:700;color:var(--danger)">⚠ OVERDUE</span>':soon?'<span style="font-size:9px;font-weight:700;color:var(--warn)">⏰ DUE SOON</span>':''}
          </div>
          <div style="font-size:10px;color:var(--fg3);margin-top:2px">${g.lines.length} line${g.lines.length!==1?'s':''} · ${g.totalPend.toFixed(0)} units pending</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
          ${g.proj?msBtn(g.doc,null,g.minDate,`Order ${g.doc} delivery`):''}
          <div style="text-align:right">
            <div style="font-size:12px;font-weight:600;color:${ov?'var(--danger)':soon?'var(--warn)':'var(--fg0)'}">${dateRange}</div>
          </div>
        </div>
      </div>
      <!-- Lines table -->
      <div style="border-top:1px solid var(--bd);overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:500px">
          <thead>
            <tr style="background:var(--bg2)">
              ${cols.map(col=>`<th style="padding:5px 10px;text-align:${['Qtd','QtdTransferida','QtdPendente'].includes(col)?'right':'left'};color:var(--fg3);font-weight:600;white-space:nowrap">${colLabel[col]||col}</th>`).join('')}
              <th style="padding:5px 10px;text-align:center;color:var(--fg3);font-weight:600;white-space:nowrap">Milestone</th>
            </tr>
          </thead>
          <tbody>
            ${g.lines.map((l,i)=>{
              const lov=_ov(l.DataEntrega); const lsoon=_soon(l.DataEntrega);
              return `<tr style="border-top:1px solid var(--bd);background:${i%2?'var(--bg2)':'transparent'}">
                ${cols.map(col=>{
                  let val=l[col];
                  if(['Qtd','QtdTransferida','QtdPendente'].includes(col)){
                    const num=(val||0);
                    const color=col==='QtdPendente'?(num>0?'var(--warn)':'var(--ok)'):col==='QtdTransferida'?'var(--ok)':'var(--fg1)';
                    return `<td style="padding:5px 10px;text-align:right;font-weight:${col==='QtdPendente'?'600':'400'};color:${color}">${num.toFixed(0)}</td>`;
                  }
                  if(col==='DataEntrega'){
                    return `<td style="padding:5px 10px;white-space:nowrap;color:${lov?'var(--danger)':lsoon?'var(--warn)':'var(--fg0)'}">
                      ${_sd(val)}${lov?' ⚠':lsoon?' ⏰':''}</td>`;
                  }
                  if(col==='CodigoArtigo') return `<td style="padding:5px 10px;font-family:var(--mono);font-size:10px;color:var(--fg3);white-space:nowrap">${val||'—'}</td>`;
                  if(col==='Obra'||col==='IdLinha') return `<td style="padding:5px 10px;font-family:var(--mono);font-size:9px;color:var(--fg3);white-space:nowrap">${(val||'').slice(0,18)}…</td>`;
                  return `<td style="padding:5px 10px;color:var(--fg0)">${val||'—'}</td>`;
                }).join('')}
                <td style="padding:5px 10px;text-align:center">${g.proj?msBtn(g.doc,l,l.DataEntrega,`${l.CodigoArtigo||l.NomeArtigo}`):'—'}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  });

  if(!groups.length) H+='<div style="padding:40px;text-align:center;color:var(--fg3)">No orders found'+( search?` for "${search}"`:'')+(window._prodFilterMy?' — try switching to All Orders':'')+' </div>';
  el.innerHTML=H;
}

window.prodToggleFilter=()=>{
  if(!isPM()){ notify('Only PM/Admin can view all orders','warn'); return; }
  window._prodFilterMy=!window._prodFilterMy;
  renderProduction();
};

window.prodAddMilestone=(projId,label,date)=>{
  projId=decodeURIComponent(projId); label=decodeURIComponent(label);
  const proj=PROJECTS.find(p=>p.id===projId);
  if(!proj){ notify('Project not found','warn'); return; }
  const name=prompt('Milestone name:',label);
  if(!name) return;
  const idx=dateToIdx(date);
  if(!idx){ notify('Invalid date','warn'); return; }
  MILESTONES.push({id:'ms'+Date.now().toString(36),name,dayIdx:idx,color:proj.color||'#7b61ff',taskIds:[],projId,shape:'circle'});
  addLog({type:'milestone',task:name,from:'',to:'created from Production ('+proj.name+')'});
  persistState(['milestones']);
  notify('Milestone "'+name+'" added to '+proj.name,'success');
  renderGantt();
};

window.prodCols=()=>{
  const ALL=['Documento','DataEntrega','CodigoArtigo','NomeArtigo','Qtd','QtdTransferida','QtdPendente','Obra','IdLinha'];
  const labels={'Documento':'Order','DataEntrega':'Delivery','CodigoArtigo':'Code','NomeArtigo':'Article','Qtd':'Qty','QtdTransferida':'Transferred','QtdPendente':'Pending','Obra':'Obra ID','IdLinha':'Line ID'};
  const cur=window._prodCols||[];
  const old=document.getElementById('_prodColsPanel');
  if(old){old.remove();return;}
  const panel=document.createElement('div');
  panel.id='_prodColsPanel';
  panel.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:500;background:var(--bg2);border:1px solid var(--bd2);border-radius:12px;padding:16px;min-width:220px;box-shadow:0 4px 20px rgba(0,0,0,.5)';
  panel.innerHTML='<div style="font-size:13px;font-weight:700;margin-bottom:10px;color:var(--fg0)">Visible columns</div>'+
    ALL.map(col=>`<label style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer;font-size:12px;color:var(--fg1)">
      <input type="checkbox" ${cur.includes(col)?'checked':''} onchange="prodToggleCol('${col}',this.checked)" style="accent-color:var(--acc)">
      ${labels[col]||col}</label>`).join('')+
    '<button onclick="document.getElementById(\'_prodColsPanel\')?.remove()" style="margin-top:10px;width:100%;" class="btn btn-sm btn-p">Done</button>';
  document.body.appendChild(panel);
};

window.prodToggleCol=(col,on)=>{
  if(!window._prodCols) window._prodCols=['Documento','DataEntrega','CodigoArtigo','NomeArtigo','Qtd','QtdTransferida','QtdPendente'];
  if(on){ if(!window._prodCols.includes(col)) window._prodCols.push(col); }
  else { window._prodCols=window._prodCols.filter(c=>c!==col); }
  renderProduction();
};

window.prodLoadFile=()=>{
  // Reset input so same file can be selected again
  const inp=document.getElementById('prod-file-input');
  if(!inp) return;
  inp.value='';
  inp.click();
};

window.prodFileChanged=(input)=>{
  const file=input.files[0];
  if(!file){ return; }
  if(!file.name.endsWith('.json')){
    prodShowMsg('Please select a .json file.','error'); return;
  }
  const reader=new FileReader();
  reader.onerror=()=>prodShowMsg('Error reading file.','error');
  reader.onload=e=>{
    try{
      let text=e.target.result;
      // Strip UTF-8 BOM if present
      if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
      // Strip line breaks that may appear inside numbers in this JSON
      while(text.indexOf('\r')>=0||text.indexOf('\n')>=0){ text=text.split('\r').join('').split('\n').join(''); }
      const data=JSON.parse(text);
      const lines=data.LinhasPendentes||data||[];
      if(!Array.isArray(lines)||!lines.length){
        prodShowMsg('File loaded but no lines found (expected "LinhasPendentes" array).','error');
        return;
      }
      window._prodData=lines;
      const ts=new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
      try{ sessionStorage.setItem('pg_prod',JSON.stringify({data:lines,ts})); }catch(e){}
      // Save to Firebase so all users see the same data
      fetch(_FB_ROOT+'/production.json',{method:'PUT',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({data:lines,ts,file:file.name})})
        .then(()=>prodShowMsg('Loaded & saved: '+lines.length+' lines from '+file.name,'ok'))
        .catch(()=>prodShowMsg('Loaded '+lines.length+' lines (Firebase save failed)','ok'));
      const upd=document.getElementById('prod-updated');
      if(upd) upd.textContent='Last loaded: '+ts+' — '+file.name+' ('+lines.length+' lines)';
      renderProduction();
    }catch(err){
      prodShowMsg('Invalid JSON: '+err.message,'error');
    }
  };
  reader.readAsText(file,'utf-8');
};

function prodShowMsg(msg,type){
  const el=document.getElementById('prod-content');
  if(!el) return;
  const col=type==='error'?'var(--danger)':type==='ok'?'var(--ok)':'var(--fg2)';
  const banner=document.createElement('div');
  banner.style.cssText='padding:10px 14px;border-radius:8px;font-size:12px;margin-bottom:10px;background:'+
    (type==='error'?'rgba(220,38,38,.1)':'rgba(34,197,94,.1)')+';color:'+col+';border:1px solid '+col;
  banner.textContent=msg;
  el.prepend(banner);
  setTimeout(()=>banner.remove(),5000);
}

// Load prod data from Firebase (authoritative) then fallback to sessionStorage
(async()=>{
  try{
    const r=await fetch(_FB_ROOT+'/production.json');
    if(r.ok){
      const d=await r.json();
      if(d&&d.data&&d.data.length){
        window._prodData=d.data;
        try{sessionStorage.setItem('pg_prod',JSON.stringify(d));}catch(e){}
        const upd=document.getElementById('prod-updated');
        if(upd) upd.textContent='Last loaded: '+(d.ts||'—')+' — '+(d.file||'')+(d.data?' ('+d.data.length+' lines)':'');
        if(S.page==='production') renderProduction();
        return;
      }
    }
  }catch(e){}
  // Fallback to sessionStorage
  try{
    const saved=sessionStorage.getItem('pg_prod');
    if(saved){
      const parsed=JSON.parse(saved);
      window._prodData=parsed.data||parsed;
      const upd=document.getElementById('prod-updated');
      if(upd&&parsed.ts) upd.textContent='Last loaded: '+parsed.ts+' (cached)';
    }
  }catch(e){}
})();
window.renderProduction=renderProduction;


window.setTaskType=(type)=>{
  const isCont=type==='continuous';
  const isDaily=type==='daily';
  const isTest=type==='test';
  // Sync radio buttons
  const rCont=document.getElementById('tt-cont'); if(rCont) rCont.checked=isCont;
  const rDaily=document.getElementById('tt-daily'); if(rDaily) rDaily.checked=isDaily;
  const rTest=document.getElementById('tt-test'); if(rTest) rTest.checked=isTest;
  // Show only active panel
  const cp=document.getElementById('tt-cont-panel');
  const dp=document.getElementById('tt-daily-panel');
  const tp=document.getElementById('tt-test-panel');
  if(cp) cp.style.display=isCont?'':'none';
  if(dp) dp.style.display=isDaily?'':'none';
  if(tp) tp.style.display=isTest?'':'none';
  // Highlight active label
  ['tt-cont-lbl','tt-daily-lbl','tt-test-lbl'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.style.background=(
      (id==='tt-cont-lbl'&&isCont)||(id==='tt-daily-lbl'&&isDaily)||(id==='tt-test-lbl'&&isTest)
    )?'var(--bg3)':'transparent';
  });
  // Enable/disable fields
  document.querySelectorAll('#tt-cont-fields input,#tt-cont-fields select,#tt-cont-fields button').forEach(el=>{ el.disabled=!isCont; });
  document.querySelectorAll('#tt-daily-fields input,#tt-daily-fields select,#tt-daily-fields button').forEach(el=>{ el.disabled=!isDaily; });
  document.querySelectorAll('#tt-test-fields input,#tt-test-fields select,#tt-test-fields button').forEach(el=>{ el.disabled=!isTest; });
  if(typeof setTM==='function'){ if(isCont) setTM('total'); else if(isDaily) setTM('daily'); else setTM('test'); }
  requestAnimationFrame(()=>{ if(_taskTeams.flatMap(tt=>tt.entries).length) _distributeHoursAll(); });
  _updateAllocVisibility();
};

window._onTestDurChange=()=>{
  // dur is now directly editable — nothing to auto-calculate
};

// Show/hide allocation controls based on current modal state.
function _updateAllocVisibility(){
  const nRes=_taskTeams.flatMap(tt=>tt.entries).length;
  const isDaily=(S.tm==='daily')||document.getElementById('tt-daily')?.checked;
  const assignType=document.getElementById('mt-assign-type')?.value||'direct';
  // Simultaneous only with >1 resource
  const simulRow=document.getElementById('mt-simul-row');
  if(simulRow) simulRow.style.display=(nRes>1&&assignType==='direct')?'flex':'none';
  // Fixed dates only for daily tasks
  const fixedRow=document.getElementById('mt-fixed-row');
  if(fixedRow) fixedRow.style.display=isDaily?'flex':'none';
  // Team-pool options only when assignType=team
  const teamOpts=document.getElementById('mt-team-opts');
  if(teamOpts) teamOpts.style.display=assignType==='team'?'block':'none';
}

window._onAssignTypeChange=()=>{
  const assignType=document.getElementById('mt-assign-type')?.value||'direct';
  if(assignType==='team'){
    // Populate team selector from existing teams
    const sel=document.getElementById('mt-team-ref');
    if(sel && sel.options.length<=1){
      TEAMS.forEach(t=>{ const o=document.createElement('option'); o.value=t.id; o.textContent=t.name; sel.appendChild(o); });
    }
  }
  _updateAllocVisibility();
};
window.toggleWD=(btn)=>{ if(!btn.disabled){ btn.classList.toggle('on'); setTimeout(_distributeHoursAll,10); } };
window.mtProjChange=()=>{};
function _nextFreeDay(resId){
  if(!resId) return GANTT_TODAY;
  let d=GANTT_TODAY;
  for(let i=0;i<60;i++){
    if(!isNW(d)){ const load=getDayLoad(resId,d,null); if(load<(getRes(resId)?.dailyCap||HPD)) return d; }
    d++;
  }
  return GANTT_TODAY;
}

// Populate flat "add resource" dropdown grouped by team
function _populateResAddFlat(){
  const sel=document.getElementById('mt-res-add-flat');
  if(!sel) return;
  // Get already-added resource IDs
  const addedIds=new Set(_taskTeams.flatMap(tt=>tt.entries.map(e=>e.id)));
  let html='<option value="">— add resource —</option>';
  TEAMS.forEach(tm=>{
    const res=RESOURCES.filter(r=>(r.teams||[]).includes(tm.id)&&!addedIds.has(r.id));
    if(!res.length) return;
    html+=`<optgroup label="${tm.name}">`;
    res.forEach(r=>{ html+=`<option value="${r.id}|${tm.id}">${r.name}</option>`; });
    html+=`</optgroup>`;
  });
  // Resources with no team
  const noTeam=RESOURCES.filter(r=>(!r.teams||!r.teams.length)&&!addedIds.has(r.id));
  if(noTeam.length){
    html+=`<optgroup label="No team">`;
    noTeam.forEach(r=>{ html+=`<option value="${r.id}|">${r.name}</option>`; });
    html+=`</optgroup>`;
  }
  sel.innerHTML=html;
  // Sync combo-search list
  _buildResSearchItems();
}

window.addResFlat=()=>{
  const sel=document.getElementById('mt-res-add-flat');
  if(!sel||!sel.value) return;
  const [resId,teamId]=sel.value.split('|');
  if(!resId) return;
  // Find or create team bucket
  let tt=_taskTeams.find(t=>t.teamId===teamId);
  if(!tt){
    tt={teamId,entries:[]};
    _taskTeams.push(tt);
  }
  if(!tt.entries.find(e=>e.id===resId)){
    tt.entries.push({id:resId,hours:0});
    _distributeHoursAll();
    _populateResAddFlat();
    renderTeamResList();
  }
  sel.value='';
};

// ── COLLECTIVE HOLIDAYS ──────────────────────────────────────
function _renderCollHolList(){
  const el=document.getElementById('ch-list'); if(!el) return;
  if(!COLLECTIVE_HOLIDAYS.length){ el.innerHTML='<div style="font-size:11px;color:var(--fg3);padding:4px">No collective holidays defined.</div>'; return; }
  el.innerHTML=COLLECTIVE_HOLIDAYS.map((ch,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--bd2);border-radius:var(--r8);margin-bottom:6px;background:var(--bg1)">
    <span style="font-size:16px">📅</span>
    <div style="flex:1">
      <div style="font-size:11px;font-weight:600;color:var(--fg0)">${ch.name||'Holiday'}</div>
      <div style="font-size:10px;color:var(--fg3)">${ch.start} → ${ch.end}</div>
    </div>
    <button onclick="removeCollectiveHoliday(${i})" style="background:none;border:none;cursor:pointer;color:var(--fg3);font-size:11px;padding:0 4px">✕</button>
  </div>`).join('');
}

window.openCollectiveHolidays=()=>{
  if(!isAdmin()){notify('Only admins can manage collective holidays','warn');return;}
  document.getElementById('ch-start').value='';
  document.getElementById('ch-end').value='';
  document.getElementById('ch-name').value='';
  _renderCollHolList();
  OM('m-coll-hol');
};

window.addCollectiveHoliday=()=>{
  const start=document.getElementById('ch-start').value;
  const end=document.getElementById('ch-end').value||start;
  const name=document.getElementById('ch-name').value.trim();
  if(!start){notify('Please select a start date','warn');return;}
  if(end<start){notify('End date must be after start date','warn');return;}
  COLLECTIVE_HOLIDAYS.push({start,end,name:name||'Collective holiday'});
  _applyCollectiveHolidays();
  persistState(['meta']);
  renderGantt();
  _renderCollHolList();
  document.getElementById('ch-start').value='';
  document.getElementById('ch-end').value='';
  document.getElementById('ch-name').value='';
  addLog({type:'resource',task:'Collective holiday',from:'',to:`added: ${name||'Holiday'} ${start}→${end}`});
  notify('Collective holiday added','success');
};

window.removeCollectiveHoliday=(idx)=>{
  const ch=COLLECTIVE_HOLIDAYS.splice(idx,1)[0];
  // Rebuild DIS_DAYS: remove only days from this removed holiday, keep manual ones
  const _s=dateToIdx(ch?.start), _e=dateToIdx(ch?.end);
  if(_s&&_e){ for(let d=_s;d<=_e;d++) DIS_DAYS.delete(String(d)); }
  _applyCollectiveHolidays();
  persistState(['meta']);
  renderGantt();
  _renderCollHolList();
  addLog({type:'resource',task:'Collective holiday',from:'',to:`removed: ${ch?.name||''} ${ch?.start||''}→${ch?.end||''}`});
  notify('Collective holiday removed','warn');
};

// ── TIME OFF ─────────────────────────────────────────────────
let _toResId=null;

function _syncTimeOffToDays(resId){
  // Rebuild RES_DAYS.disabled for this resource from timeOff array
  const r=getRes(resId); if(!r) return;
  if(!RES_DAYS.has(resId)) RES_DAYS.set(resId,{enabled:new Set(),disabled:new Set()});
  const rd=RES_DAYS.get(resId);
  // Clear existing time-off days (keep manually disabled days — prefixed with 'to:')
  // We store time-off day keys without prefix, so clear all and re-add manual ones
  rd.disabled=new Set([...rd.disabled].filter(k=>k.startsWith('m:')));
  // Add all time-off days — ONLY full-day time-offs block the whole day.
  // Partial time-offs (allDay===false) do NOT disable the day; their hours are
  // subtracted later by dayCapacity(). Otherwise a 2h time-off would wrongly
  // mark the entire day as non-working.
  (r.timeOff||[]).forEach(to=>{
    if(!to.start||!to.end) return;
    if(to.allDay===false) return; // partial — handled by dayCapacity
    const s=dateToIdx(to.start), e=dateToIdx(to.end);
    if(!s||!e) return;
    for(let d=s;d<=e;d++) rd.disabled.add(String(d));
  });
}

function _renderTimeOffList(){
  const el=document.getElementById('to-list'); if(!el) return;
  const r=getRes(_toResId); if(!r){ el.innerHTML=''; return; }
  const items=(r.timeOff||[]).sort((a,b)=>a.start.localeCompare(b.start));
  if(!items.length){ el.innerHTML='<div style="font-size:11px;color:var(--fg3);padding:4px">No time off scheduled.</div>'; return; }
  const icons={vacation:'🏖',sick:'🤒',local_holiday:'📅',other:'📌'};
  el.innerHTML=items.map((to,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--bd2);border-radius:var(--r8);margin-bottom:6px;background:var(--bg1)">
    <span style="font-size:14px">${icons[to.type]||'📌'}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:11px;font-weight:600;color:var(--fg0)">${to.start} → ${to.end}${to.allDay===false?` <span style="color:var(--warn);font-weight:500">· ${to.hours}h/day</span>`:''}</div>
      <div style="font-size:10px;color:var(--fg3)">${to.note||to.type}</div>
    </div>
    <button onclick="removeTimeOff('${_toResId}',${i})" style="background:none;border:none;cursor:pointer;color:var(--fg3);font-size:11px;padding:0 4px">✕</button>
  </div>`).join('');
}

window.openTimeOff=(resId)=>{
  _toResId=resId;
  const r=getRes(resId); if(!r) return;
  document.getElementById('to-res-name').textContent=r.name;
  document.getElementById('to-start').value='';
  document.getElementById('to-end').value='';
  document.getElementById('to-note').value='';
  document.getElementById('to-type').value='vacation';
  { const _ad=document.getElementById('to-allday'); if(_ad) _ad.value='true'; }
  { const _hw=document.getElementById('to-hours-wrap'); if(_hw) _hw.style.display='none'; }
  _renderTimeOffList();
  OM('m-timeoff');
};

window.addTimeOff=()=>{
  const start=document.getElementById('to-start').value;
  const end=document.getElementById('to-end').value||start;
  const type=document.getElementById('to-type').value;
  const note=document.getElementById('to-note').value.trim();
  if(!start){notify('Please select a start date','warn');return;}
  if(end<start){notify('End date must be after start date','warn');return;}
  const r=getRes(_toResId); if(!r) return;
  const allDay=(document.getElementById('to-allday')?.value||'true')==='true';
  let hours=null;
  if(!allDay){
    hours=parseFloat(document.getElementById('to-hours')?.value)||0;
    if(hours<=0){notify('Partial time off needs hours > 0','warn');return;}
    const _cap=r.dailyCap||HPD;
    if(hours>=_cap){notify(`Partial hours (${hours}h) ≥ daily cap (${_cap}h). Use "Full day" instead.`,'warn');return;}
  }
  if(!r.timeOff) r.timeOff=[];
  r.timeOff.push({start,end,type,note,allDay,hours});
  _syncTimeOffToDays(_toResId);
  addLog({type:'resource',task:r.name,from:'',to:`time off added: ${type} ${start}→${end}${allDay?'':` (${hours}h/day)`}${note?' ('+note+')':''}`});
  persistState(['resources','meta']);
  renderGantt();
  _renderTimeOffList();
  document.getElementById('to-start').value='';
  document.getElementById('to-end').value='';
  document.getElementById('to-note').value='';
  notify('Time off added','success');
};

window._onToAllDayChange=()=>{
  const allDay=(document.getElementById('to-allday')?.value||'true')==='true';
  const wrap=document.getElementById('to-hours-wrap');
  if(wrap) wrap.style.display=allDay?'none':'block';
};

window.removeTimeOff=(resId,idx)=>{
  const r=getRes(resId); if(!r||!r.timeOff) return;
  const _removed=r.timeOff.splice(idx,1)[0];
  _syncTimeOffToDays(resId);
  addLog({type:'resource',task:r.name,from:'',to:`time off removed: ${_removed?.type||''} ${_removed?.start||''}→${_removed?.end||''}`});
  persistState(['resources','meta']);
  renderGantt();
  _renderTimeOffList();
  notify('Time off removed','warn');
};

// ── CSV IMPORT ───────────────────────────────────────────────
let _csvParsed=[];

window.openImportCSV=()=>{
  if(!isAdmin()){notify('Only admins can import tasks','warn');return;}
  _csvParsed=[];
  document.getElementById('csv-preview').style.display='none';
  document.getElementById('csv-import-btn').style.display='none';
  document.getElementById('csv-file-input').value='';
  document.getElementById('csv-drop-zone').style.borderColor='var(--bd2)';
  OM('m-import-csv');
};

window.downloadCSVTemplate=()=>{
  const rows=[
    ['external_id','name','project','group','type','total_hours','hours_per_day','start_date','end_date','deadline','status','tags','notes','resource','resource_hours','weekdays'],
    ['EXT-001','Task name (required)','Project name or ID (required)','Group name','continuous or daily','8','0','2026-06-01','2026-06-05','2026-06-30','todo','tag1,tag2','Notes here','Resource name (use ; for multiple)','Hours per resource (use ; for multiple)','Mon,Tue,Wed,Thu,Fri'],
    ['EXT-002','Install panels','PAZZI','Mechanical','continuous','16','','','','2026-07-15','todo','ROB','Install solar panels','João Silva','16','Mon,Tue,Wed,Thu,Fri'],
    ['EXT-003','Multi-res task','PAZZI','Mechanical','continuous','24','','','','2026-07-15','todo','','Task with 2 resources','João Silva;Maria Santos','16;8','Mon,Tue,Wed,Thu,Fri'],
    ['EXT-004','Daily check','PAZZI','Electrical','daily','','2','2026-06-10','2026-06-20','','todo','','Daily inspection','Maria Santos','','Mon,Tue,Wed,Thu,Fri'],
  ];
  const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='task_import_template.csv';
  a.click();
};

function _parseCSV(text){
  // RFC 4180 compliant parser — handles multiline fields, escaped quotes, Excel exports
  text=text.replace(/^﻿/,'');

  // Parse entire text char by char to handle quoted fields spanning lines
  function parseAll(txt, sep){
    const rows=[];
    let row=[], cur='', inQ=false, i=0;
    while(i<txt.length){
      const ch=txt[i];
      if(inQ){
        if(ch==='"'){
          if(txt[i+1]==='"'){cur+='"';i+=2;continue;} // escaped quote
          else{inQ=false;i++;continue;} // end quote
        }
        cur+=ch; i++;
      } else {
        if(ch==='"'){inQ=true;i++;continue;}
        if(ch===sep){row.push(cur.trim());cur='';i++;continue;}
        if(ch==='\r'&&txt[i+1]==='\n'){row.push(cur.trim());cur='';rows.push(row);row=[];i+=2;continue;}
        if(ch==='\n'){row.push(cur.trim());cur='';rows.push(row);row=[];i++;continue;}
        cur+=ch; i++; // advance — prevents infinite loop
      }
    }
    if(cur||row.length){row.push(cur.trim());rows.push(row);}
    return rows.filter(r=>r.some(c=>c));
  }

  // Auto-detect separator from first non-quoted content
  const firstLine=text.split('\n')[0];
  const sep=firstLine.replace(/"[^"]*"/g,'').includes(';')?';':',';
  const rows=parseAll(text,sep);
  if(!rows.length) return [];

  // Handle Excel-wrapped header: entire header as single quoted field
  let headers=rows[0];
  if(headers.length===1&&headers[0].includes(sep)){
    // Single field containing all headers separated by sep
    headers=headers[0].split(sep).map(h=>h.trim());
  }
  headers=headers.map(h=>h.replace(/^"|"$/g,'').trim().toLowerCase());

  return rows.slice(1).map((cols,li)=>{
    const row={_line:li+2};
    headers.forEach((h,i)=>{ row[h]=(cols[i]||'').replace(/^"|"$/g,'').trim(); });
    return row;
  });
}

// Map new ClickUp-style CSV format to internal format
// _PROJ_ID_MAP is now dynamic — built from PROJECTS.externalId
function _getProjIdMap(){
  const map={};
  PROJECTS.forEach(p=>{ if(p.externalId) map[p.externalId.trim()]=p.name; });
  return map;
}
const _PROJ_ID_MAP={};
const _STATUS_MAP={
  'to do':'todo','in progress':'doing','critical':'doing',
  'on hold':'hold','review':'ready','completed':'done',
  'migrated':'done','canceled':'cancelled','closed':'done',
};
const _SKIP_STATUSES=new Set(['completed','migrated','canceled','closed']);


function _mapNewCSVRow(row){
  const rawStatus=(row['status']||'').trim().toLowerCase();

  // Map project from Home Location ID
  const homeLocId=(row['home location id']||'').trim();
  const _dynMap=_getProjIdMap(); const projName=_dynMap[homeLocId]||null;

  // Map status
  const mappedStatus=_STATUS_MAP[rawStatus]||'todo';

  // Map hours: Time Estimated is in ms (divide by 1000 to get seconds, then /3600 for hours)
  const timeEstMs=parseFloat(row['time estimated']||'0')||0;
  const hours=timeEstMs>0?Math.round(timeEstMs/1000/3600*10)/10:0;

  // Map assignees: format is [name1,name2] or [name]
  let assigneeStr=(row['assignees']||'').trim();
  if(assigneeStr.startsWith('[')) assigneeStr=assigneeStr.slice(1);
  if(assigneeStr.endsWith(']')) assigneeStr=assigneeStr.slice(0,-1);
  let assignees=assigneeStr.split(',').map(s=>s.trim()).filter(Boolean);

  // Tags: if [sr hélder] add Hélder Parente
  const tagsStr=(row['tags']||'').trim().toLowerCase();
  if(tagsStr.includes('sr hélder')||tagsStr.includes('sr helder')){
    if(!assignees.some(a=>a.toLowerCase().includes('hélder')||a.toLowerCase().includes('helder'))){
      assignees.push('Hélder Parente');
    }
  }
  // Tags: if [outros recursos] add Outros Recursos
  if(tagsStr.includes('outros recursos')){
    if(!assignees.some(a=>a.toLowerCase().includes('outros recursos'))){
      assignees.push('Outros Recursos');
    }
  }

  // Map time spent: milliseconds -> hours (same as time estimated)
  const timeSpentMs=parseFloat((row['time spent']||'0').replace(/[^0-9.]/g,''))||0;
  const spentHours=timeSpentMs>0?Math.round(timeSpentMs/1000/3600*100)/100:0;

  return {
    external_id: (row['task id']||'').trim(),
    _rawStatus: rawStatus,
    _rawSpentHours: spentHours,
    _line: row._line,
    name: (row['task name']||'').trim(),
    project: projName,
    group: (()=>{
      const _n=(row['task name']||'').trim();
      if(_n.includes(' - 1')) return 'REQUISITOS E ESPECIFICAÇÃO';
      if(_n.includes(' - 2')) return 'PROTÓTIPO';
      if(_n.includes(' - 3')) return 'VALIDAÇÃO';
      if(_n.includes(' - 4')) return 'HANDOVER';
      if(_n.includes(' - 5')) return 'AVALIAÇÃO DE RISCOS TÉCNICOS';
      if(_n.includes(' - 6')) return 'PROJETO';
      return null;
    })(),
    type: 'continuous',
    total_hours: hours>0?String(hours):'0',
    hours_per_day: '',
    start_date: '',
    end_date: '',
    deadline: '',
    status: mappedStatus,
    tags: (row['tags']||'').trim(),
    notes: '',
    resource: assignees.join(';'),
    resource_hours: '',
    weekdays: '',
  };
}

function _validateCSVRow(row){
  const errors=[];
  if(!row.name) errors.push('name is required');
  if(!row.project) errors.push('project is required');
  const _pq=(row.project||'').trim().toLowerCase();
  const proj=PROJECTS.find(p=>p.name.toLowerCase()===_pq||p.id.toLowerCase()===_pq||(p.orderId||'').split(',').map(s=>s.trim().toLowerCase()).includes(_pq));
  if(!proj){
    const _tid2=row.external_id?('['+row.external_id+'] '):'';
    const _label2=(_tid2+(row.name||'')).slice(0,50);
    const _noMap=row.project&&!PROJECTS.find(p=>p.externalId===row.project);
    const _hint=_noMap?' (Home Location ID not mapped — set External Project ID in project settings)':'';
    errors.push('project not found'+_hint+' — '+_label2);
  }
  const type=(row.type||'continuous').toLowerCase();
  if(!['continuous','daily'].includes(type)) errors.push(`type must be "continuous" or "daily"`);
  if(row.status&&!['todo','doing','done','hold','cancelled','ready','inprogress','onhold'].includes(row.status)) errors.push(`invalid status "${row.status}"`);
  // Warn about resources not found
  const _resNames=(row.resource||'').split(';').map(s=>s.trim()).filter(Boolean);
  if(_resNames.length){
    const notFound=_resNames.filter(name=>!RESOURCES.find(r=>r.name.toLowerCase()===name.toLowerCase()||r.id.toLowerCase()===name.toLowerCase()));
    if(notFound.length){ const _tid=row.external_id?('['+row.external_id+'] '):''; const _label=(_tid+(row.name||'')).slice(0,50); errors.push('resource'+(notFound.length>1?'s':'')+' not found: '+notFound.join(', ')+' — '+_label); }
  } // no resource — silently skip creation (no error shown)
  // No hours — silently skip creation (no error shown)
  return {errors,proj,type};
}

window.handleCSVFile=(file)=>{
  if(!file) return;
  const reader=new FileReader();
  // Try UTF-8 first, fallback to Latin-1 if garbled
  reader.onload=e=>{
    let text=e.target.result;
    // Detect if first line looks like a header — if not, prepend it
    const firstLine=text.split(/\r?\n/)[0];
    const knownHeaders=['task id','task name','home location','name','project'];
    const hasHeader=knownHeaders.some(h=>firstLine.toLowerCase().includes(h));
    if(!hasHeader) text='name,project,group,type,total_hours,hours_per_day,start_date,end_date,deadline,status,tags,notes,resource,resource_hours,weekdays\n'+text;
    _processCSV(text);
  };
  // Detect encoding: try UTF-8 first, fallback to Latin-1
  const fr=new FileReader();
  fr.onload=e=>{
    let t=e.target.result;
    // Check if result contains replacement chars (UTF-8 read as Latin-1 issue)
    if(t.includes('ï»¿')||t.charCodeAt(0)===65279){
      // Has UTF-8 BOM but read as Latin-1 — re-read as UTF-8
      const fr2=new FileReader();
      fr2.onload=e2=>reader.onload({target:e2.target});
      fr2.readAsText(file,'UTF-8');
    } else {
      reader.onload({target:e.target});
    }
  };
  fr.readAsText(file,'UTF-8');
};

window.handleCSVDrop=(file)=>{
  if(!file||!file.name.endsWith('.csv')){notify('Please upload a .csv file','warn');return;}
  handleCSVFile(file);
};

function _processCSV(text){
  // Detect lines wrapped in outer quotes (Excel export issue)
  const rawLines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim()).slice(1); // skip header
  const quotedLines=[];
  rawLines.forEach((line,i)=>{
    if(line.startsWith('"')&&line.endsWith('"')&&!line.slice(1,-1).includes('""')){
      quotedLines.push(i+2); // +2: 1-based + skip header
    }
  });

  let parsedRows=_parseCSV(text);
  // Debug: show parsed row count
  // Always use ClickUp format mapping
  const rows=parsedRows.map(r=>_mapNewCSVRow(r)).filter(r=>r&&r.name);
  _csvParsed=rows;
  const preview=document.getElementById('csv-preview');
  const summary=document.getElementById('csv-preview-summary');
  const errorsEl=document.getElementById('csv-preview-errors');
  const tableEl=document.getElementById('csv-preview-table');
  const importBtn=document.getElementById('csv-import-btn');
  preview.style.display='';
  if(!rows.length){
    summary.textContent='No valid rows found.';
    const quotedWarn=quotedLines.length?'<div style="background:rgba(240,169,40,.08);border:1px solid rgba(240,169,40,.3);border-radius:var(--r8);padding:8px 10px;margin-bottom:8px"><div style="font-size:11px;font-weight:600;color:var(--warn);margin-bottom:4px">⚠ Rows wrapped in quotes detected</div><div style="font-size:10px;color:var(--fg2)">Row'+(quotedLines.length>1?'s':'')+' '+quotedLines.join(', ')+' appear to be wrapped in outer quotes, which prevents correct parsing. Fields containing commas must be individually quoted, not the entire row.</div></div>':'';
    errorsEl.innerHTML=quotedWarn;
    tableEl.innerHTML='';
    importBtn.style.display='none';
    return;
  }
  // Only validate rows that will be created or updated — skip ignored rows
  let allErrors=[];
  rows.forEach(row=>{
    const willUpdate=row.external_id&&TASKS.find(t=>t.externalId===row.external_id);
    const willCreate=!_SKIP_STATUSES.has(row._rawStatus||'')&&(parseFloat(row.total_hours||'0')||0)>0&&(row.resource||'').trim().length>0;
    if(!willUpdate&&!willCreate) return; // silently skipped
    const {errors}=_validateCSVRow(row);
    if(errors.length) allErrors.push({line:row._line,errors});
  });
  // Preview table
  const validRows=rows.filter(r=>_validateCSVRow(r).errors.length===0);
  // Classify all rows
  const _toUpdate2=rows.filter(r=>r.external_id&&TASKS.find(t=>t.externalId===r.external_id));
  // Detect which updates actually have changes
  window._hasChanges=function(r){
    const t=TASKS.find(x=>x.externalId===r.external_id);
    if(!t) return false;
    const proj=PROJECTS.find(p=>p.name.toLowerCase()===(r.project||'').toLowerCase()||p.id.toLowerCase()===(r.project||'').toLowerCase()||(p.orderId||'').split(',').map(s=>s.trim().toLowerCase()).includes((r.project||'').toLowerCase()));
    if(t.name!==(r.name||'')) { console.log('[DIFF]',r.external_id,'name:',JSON.stringify(t.name),'vs',JSON.stringify(r.name)); return true; }
    if(proj&&t.projId!==proj.id) { console.log('[DIFF]',r.external_id,'proj:',t.projId,'vs',proj.id); return true; }
    if(t.group!==(r.group||'PROTÓTIPO')) { console.log('[DIFF]',r.external_id,'group:',JSON.stringify(t.group),'vs',JSON.stringify(r.group||'PROTÓTIPO')); return true; }
    const _csvH=Math.round((parseFloat(r.total_hours||'0')||0)*100)/100;
    const _tH=Math.round((tHours(t)||0)*100)/100;
    if(Math.abs(_tH-_csvH)>0.05) { console.log('[DIFF]',r.external_id,'hours:',_tH,'vs',_csvH); return true; }
    if(t.status!==(r.status||'todo')) { console.log('[DIFF]',r.external_id,'status:',JSON.stringify(t.status),'vs',JSON.stringify(r.status||'todo')); return true; }
    const newRes=(r.resource||'').split(';').map(s=>s.trim()).filter(Boolean).sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase())).join(';').toLowerCase();
    const oldRes=[t.resId,...(t.coResIds||[])].filter(Boolean).map(id=>getRes(id)?.name||id).sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase())).join(';').toLowerCase();
    if(newRes!==oldRes) { console.log('[DIFF]',r.external_id,'resource:',JSON.stringify(oldRes),'vs',JSON.stringify(newRes)); return true; }
    return false;
  }
  const _toUpdateWithChanges=_toUpdate2.filter(r=>_hasChanges(r));
  const _toUpdateNoChanges=_toUpdate2.filter(r=>!_hasChanges(r));
  const _toCreate2=rows.filter(r=>{
    if(r.external_id&&TASKS.find(t=>t.externalId===r.external_id)) return false; // update
    if(_SKIP_STATUSES.has(r._rawStatus||'')) return false; // skip status
    if(!(parseFloat(r.total_hours||'0')||0)) return false; // no hours
    if(!(r.resource||'').trim()) return false; // no resource
    if(_validateCSVRow(r).errors.length>0) return false; // validation errors
    return true;
  });
  const _toSkip2=rows.filter(r=>{
    if(r.external_id&&TASKS.find(t=>t.externalId===r.external_id)) return false; // update
    if(_validateCSVRow(r).errors.length>0) return false; // has errors (shown separately)
    if(_SKIP_STATUSES.has(r._rawStatus||'')) return true;
    if(!(parseFloat(r.total_hours||'0')||0)) return true;
    if(!(r.resource||'').trim()) return true;
    return false;
  });
  // Classify every row into exactly one bucket
  const _skipStatus=[], _skipNoRes=[], _skipNoHours=[], _unclassified=[];
  rows.forEach(r=>{
    if(_toUpdate2.includes(r)) return; // update
    if(_toCreate2.includes(r)) return; // create
    if(allErrors.find(e=>e.line===r._line)) return; // visible error
    // Skipped — determine reason (priority order)
    if(_SKIP_STATUSES.has(r._rawStatus||'')) { _skipStatus.push(r); return; }
    if(!(parseFloat(r.total_hours||'0')||0)) { _skipNoHours.push(r); return; }
    if(!(r.resource||'').trim()) { _skipNoRes.push(r); return; }
    _unclassified.push(r); // catch-all — should not happen
  });
  const _totalSkipped=_skipStatus.length+_skipNoHours.length+_skipNoRes.length+_unclassified.length;
  const _totalAll=_toCreate2.length+_toUpdate2.length+_totalSkipped+allErrors.length;

  let summaryParts=[rows.length+' task'+(rows.length!==1?'s':'')+' found'];
  if(_toCreate2.length) summaryParts.push(_toCreate2.length+' to create');
  if(_toUpdateWithChanges.length){
    const _toCancelled=_toUpdateWithChanges.filter(r=>r.status==='cancelled');
    const _toDone=_toUpdateWithChanges.filter(r=>r.status==='done');
    const _updateParts=[];
    if(_toCancelled.length) _updateParts.push(_toCancelled.length+' → Cancelled');
    if(_toDone.length) _updateParts.push(_toDone.length+' → Done');
    summaryParts.push(_toUpdateWithChanges.length+' to update'+(_updateParts.length?' ('+_updateParts.join(', ')+')':''));
  }
  if(_toUpdateNoChanges.length) summaryParts.push(_toUpdateNoChanges.length+' unchanged');
  if(allErrors.length) summaryParts.push(allErrors.length+' error'+(allErrors.length!==1?'s':''));
  // Debug: show if totals don't match
  if(_totalAll!==rows.length) summaryParts.push('⚠ '+(rows.length-_totalAll)+' unaccounted');
  const _skipParts=[];
  if(_skipStatus.length) _skipParts.push(_skipStatus.length+' status');
  if(_skipNoHours.length) _skipParts.push(_skipNoHours.length+' no hours');
  if(_skipNoRes.length) _skipParts.push(_skipNoRes.length+' no resource');
  if(_unclassified.length) _skipParts.push(_unclassified.length+' unknown');
  const _skipLine=_totalSkipped>0?(_totalSkipped+' skipped'+(_skipParts.length?' ('+_skipParts.join(', ')+')':'')):'';
  summary.innerHTML=summaryParts.join(' · ')+(_skipLine?'<br><span style="font-size:10px;color:var(--fg3)">'+_skipLine+'</span>':'');
  const quotedWarnHtml=quotedLines.length?'<div style="background:rgba(240,169,40,.08);border:1px solid rgba(240,169,40,.3);border-radius:var(--r8);padding:8px 10px;margin-bottom:8px"><div style="font-size:11px;font-weight:600;color:var(--warn);margin-bottom:4px">⚠ '+quotedLines.length+' row'+(quotedLines.length>1?'s':'')+' wrapped in quotes (row'+(quotedLines.length>1?'s':'')+' '+quotedLines.join(', ')+')</div><div style="font-size:10px;color:var(--fg2)">These rows could not be parsed correctly. Fields containing commas must be individually quoted, not the entire row. Please fix in a text editor or Excel and re-upload.</div></div>':'';
  errorsEl.innerHTML=quotedWarnHtml+(allErrors.length?'<div style="background:rgba(240,82,82,.08);border:1px solid rgba(240,82,82,.3);border-radius:var(--r8);padding:8px 10px;margin-bottom:8px">'+allErrors.map(e=>`<div style="font-size:10px;color:var(--danger)">Row ${e.line}: ${e.errors.join(', ')}</div>`).join('')+'</div>':'');
  tableEl.innerHTML='<table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--bg2)">'
    +['Ext ID','Name','Project','Hours','Resource','Status'].map(h=>`<th style="padding:5px 8px;text-align:left;font-size:10px;color:var(--fg3);font-weight:600;border-bottom:1px solid var(--bd2)">${h}</th>`).join('')
    +'</tr></thead><tbody>'
    +[..._toCreate2,..._toUpdateWithChanges].map((r,i)=>`<tr style="background:${i%2===0?'transparent':'rgba(255,255,255,.02)'}">
      <td style="padding:4px 8px;font-size:10px;color:var(--fg3);font-family:var(--mono)">${r.external_id||'—'}</td>
      <td style="padding:4px 8px;font-size:10px;color:${_hasChanges(r)?'var(--warn)':TASKS.find(t=>t.externalId&&t.externalId===r.external_id)?'var(--fg3)':'var(--fg0)'}">${r.name}${_hasChanges(r)?' ✎':TASKS.find(t=>t.externalId&&t.externalId===r.external_id)?' —':''}</td>
      <td style="padding:4px 8px;font-size:10px;color:var(--fg2)">${r.project}</td>
      <td style="padding:4px 8px;font-size:10px;color:var(--fg3)">${r.total_hours||r.hours_per_day||'—'}h</td>
      <td style="padding:4px 8px;font-size:10px;color:var(--fg2)">${r.resource||'—'}</td>
      <td style="padding:4px 8px;font-size:10px;font-weight:${r.status==='cancelled'||r.status==='done'?'600':'400'};color:${r.status==='cancelled'?'var(--danger)':r.status==='done'?'var(--ok)':'var(--fg3)'}">${SLABELS[r.status]||r.status||'To Do'}</td>
    </tr>`).join('')
    +'</tbody></table>';
  importBtn.style.display=(_toCreate2.length||_toUpdate2.length)?'':'none';
  importBtn.textContent='Import ('+(_toCreate2.length?_toCreate2.length+' create':'')+
    ((_toCreate2.length&&_toUpdateWithChanges.length)?' · ':'')+(_toUpdateWithChanges.length?_toUpdateWithChanges.length+' update':'')+(_toUpdateNoChanges.length?' · '+_toUpdateNoChanges.length+' unchanged':'')+')';
}

window.executeCSVImport=()=>{
  const validRows=_csvParsed.filter(r=>_validateCSVRow(r).errors.length===0);
  if(!validRows.length) return;
  let created=0, updated=0;
  validRows.forEach(row=>{
    const {proj,type}=_validateCSVRow(row); if(!proj) return;
    const tags=row.tags?row.tags.split(',').map(t=>t.trim()).filter(t=>t&&t.toLowerCase()!=='[teste]'&&t.toLowerCase()!=='teste'):[];
    const tm=type==='daily'?'daily':'total';
    const totalHours=tm==='daily'?(parseFloat(row.hours_per_day)||0):(parseFloat(row.total_hours)||8);
    const wdays=row.weekdays?row.weekdays.split(',').map(d=>({mon:1,tue:2,wed:3,thu:4,fri:5,sat:6,sun:0}[d.trim().toLowerCase()])).filter(d=>d!==undefined):[1,2,3,4,5];

    // Parse multiple resources: use ; as separator (e.g. "Res1;Res2" with hours "16;8")
    const resNames=(row.resource||'').split(';').map(s=>s.trim()).filter(Boolean);
    const resHoursList=(row.resource_hours||'').split(';').map(s=>parseFloat(s.trim())||0);
    const allRes=resNames.map((name,i)=>({
      res:RESOURCES.find(r=>r.name.toLowerCase()===name.toLowerCase()||r.id.toLowerCase()===name.toLowerCase())||null,
      hours:resHoursList[i]||0
    })).filter(x=>x.res);

    // Distribute hours equally if not specified
    if(allRes.length&&allRes.every(x=>x.hours===0)){
      const each=Math.round(totalHours/allRes.length*10)/10;
      allRes.forEach((x,i)=>{ x.hours=i===allRes.length-1?Math.round((totalHours-each*i)*10)/10:each; });
    }

    const mainRes=allRes[0]?.res||null;
    const coRes=allRes.slice(1).map(x=>x.res);
    const resHours={};
    allRes.forEach(x=>{ resHours[x.res.id]=x.hours; });

    // Build taskTeams grouped by team
    const teamMap={};
    allRes.forEach(x=>{
      const tid=(x.res.teams||[])[0]||'_notm';
      if(!teamMap[tid]) teamMap[tid]={teamId:tid==='_notm'?null:tid,entries:[]};
      teamMap[tid].entries.push({id:x.res.id,hours:x.hours});
    });
    const taskTeams=Object.values(teamMap);

    const task={
      id:'t'+Date.now()+Math.random().toString(36).slice(2,6),
      name:row.name,
      projId:proj.id,
      group:row.group||null,
      timeMode:tm,
      hours:totalHours,
      hpd:tm==='daily'?totalHours:null,
      contHours:tm!=='daily'?totalHours:8,
      dailyHpd:tm==='daily'?totalHours:0,
      start:row.start_date?dateToIdx(row.start_date):null,
      dur:row.start_date&&row.end_date?Math.max(1,dateToIdx(row.end_date)-dateToIdx(row.start_date)+1):1,
      deadline:row.deadline||null,
      status:row.status||'todo',
      prog:0,
      tags,
      notes:row.notes||'',
      resId:mainRes?.id||null,
      resource:mainRes?.name||'',
      coResIds:coRes.map(r=>r.id),
      resHours,
      teamId:(mainRes?.teams||[])[0]||null,
      teamIds:[...new Set(allRes.flatMap(x=>x.res.teams||[]))],
      taskTeams,
      weekdays:tm==='daily'?wdays:null,
      timeLogs:[],
      resStart:{},resDur:{},
      externalId:row.external_id||null,
    };
    // ── TAG "teste" rule ──────────────────────────────────────────────────
    // If Tags contains "teste":
    // - Primary resource becomes "Outros Recursos" (r1781609514902) with all task hours
    // - All other CSV resources become co-resources with timeMode daily, 2h/day
    const _csvTags=(row.tags||'').toLowerCase();
    if(_csvTags.includes('teste')){
      const _outrosId='r1781609514902';
      const _outros=getRes(_outrosId);
      // Co-resources: all CSV resources (excluding Outros if already present)
      const _coResForTeste=allRes.filter(x=>x.res.id!==_outrosId).map(x=>x.res);
      task.resId=_outrosId;
      task.resource=_outros?.name||'Outros Recursos';
      task.coResIds=_coResForTeste.map(r=>r.id);
      task.timeMode='test';
      const _testeDur=Math.max(1, Math.round(totalHours/8));
      task.hpd=null;
      task.dailyHpd=0;
      task.contHours=totalHours;
      task.dur=_testeDur;
      task.start=null;
      task.weekdays=null;
      // resHours: primary gets totalHours, co-resources get 2h/day × dur
      const _rhTeste={};
      _rhTeste[_outrosId]=totalHours;
      _coResForTeste.forEach(r=>{ _rhTeste[r.id]=2*_testeDur; });
      task.resHours=_rhTeste;
      task.hours=Object.values(_rhTeste).reduce((s,h)=>s+h,0);
      // taskTeams
      const _tmTeste={};
      if(_outros){ const tid=(_outros.teams||[])[0]||'_notm'; if(!_tmTeste[tid]) _tmTeste[tid]={teamId:tid==='_notm'?null:tid,entries:[]}; _tmTeste[tid].entries.push({id:_outrosId,hours:totalHours}); }
      _coResForTeste.forEach(r=>{ const tid=(r.teams||[])[0]||'_notm'; if(!_tmTeste[tid]) _tmTeste[tid]={teamId:tid==='_notm'?null:tid,entries:[]}; _tmTeste[tid].entries.push({id:r.id,hours:2}); });
      task.taskTeams=Object.values(_tmTeste);
      task.teamId=(_outros?.teams||[])[0]||null;
      task.teamIds=[...new Set([_outrosId,..._coResForTeste.flatMap(r=>r.teams||[])].map(id=>getRes(id)?.teams||[]).flat())];
    }
    // ─────────────────────────────────────────────────────────────────────

    // Check if task already exists by external_id
    const existingTask=row.external_id?TASKS.find(t=>t.externalId===row.external_id):null;
    // Skip creation for completed/migrated/canceled/closed — only update if already exists
    if(!existingTask&&_SKIP_STATUSES.has((row._rawStatus||''))) return;
    // Skip creation if no resource or no hours — only update if already exists
    const _hasRes=(row.resource||'').trim().length>0;
    const _hasHours=(parseFloat(row.total_hours||'0')||0)>0;
    if(!existingTask&&(!_hasRes||!_hasHours)) return;
    if(existingTask){
      // Skip if no changes
      if(!_hasChanges(row)) { updated++; return; } // count but don't write
      // Update timeLogs if spent hours changed
      const _existingLogged=(existingTask.timeLogs||[]).reduce((s,l)=>s+l.hours,0);
      const _newSpent=row._rawSpentHours||0;
      if(_newSpent>0&&Math.abs(_existingLogged-_newSpent)>0.05){
        const _nonImport=(existingTask.timeLogs||[]).filter(l=>l.notes!=='Imported from ClickUp');
        const _manualH=_nonImport.reduce((s,l)=>s+l.hours,0);
        const _importH=Math.max(0,_newSpent-_manualH);
        if(_importH>0){
          existingTask.timeLogs=[..._nonImport,{date:new Date().toISOString().slice(0,10),hours:_importH,notes:'Imported from ClickUp',user:S_USER?.name||'import'}];
        }
      }
      // Update existing task
      Object.assign(existingTask,{
        name:task.name, projId:task.projId, group:task.group, // group updated from name-based mapping
        updatedAt:Date.now(),
        timeMode:task.timeMode, hours:task.hours, hpd:task.hpd,
        contHours:task.contHours, dailyHpd:task.dailyHpd,
        status:task.status,
        resId:task.resId, resource:task.resource, coResIds:task.coResIds,
        resHours:task.resHours, teamId:task.teamId, teamIds:task.teamIds,
        taskTeams:task.taskTeams,
        // deadline, tags, notes, weekdays are never updated from CSV
      });
      addLog({type:'edit',task:task.name,from:'',to:'updated from CSV'});
      updated++;
    } else {
      task.externalId=row.external_id||null;
      task.updatedAt=Date.now();
      // Auto-calculate start if not provided in CSV (same behaviour as modal)
      if(!task.start && task.resId){
        task.start=_nextFreeDay(task.resId);
      }
      if(row._rawSpentHours>0){
        task.timeLogs=[{date:new Date().toISOString().slice(0,10),hours:row._rawSpentHours,notes:'Imported from ClickUp',user:S_USER?.name||'import'}];
      }
      TASKS.push(task);
      addLog({type:'create',task:task.name,from:'',to:'imported from CSV'});
      created++;
    }
  });
  persistState(['tasks']);
  renderGantt();renderDash();_refreshOverview();
  CM('m-import-csv');
  const _parts2=[];
  if(created) _parts2.push(created+' created');
  if(updated) _parts2.push(updated+' updated');
  notify(_parts2.join(' · ')||'No changes','success');
};

// ── SETTINGS > CALENDÁRIO ─────────────────────────────────────────────────
// PT_HOL_CUSTOM: persisted in meta.ptHolCustom as [{m,d,name,type}]
// Merges with the built-in PT_HOL list; custom overrides are highlighted.
function _getHolidays(){
  const base=PT_HOL.map(h=>({...h, builtin:true, name:h.name||_ptHolName(h.m,h.d), type:h.type||'nacional'}));
  const map={}; base.forEach(h=>map[`${h.m}-${h.d}`]=h);
  PT_HOL_CUSTOM.forEach(h=>map[`${h.m}-${h.d}`]={...h, builtin:false});
  return Object.values(map).sort((a,b)=>a.m!==b.m?a.m-b.m:a.d-b.d);
}
function _ptHolName(m,d){
  const names={
    '1-1':'Ano Novo','4-10':'Sexta-feira Santa','4-12':'Páscoa','4-25':'25 de Abril',
    '5-1':'Dia do Trabalhador','6-10':'Dia de Portugal','6-24':'S. João (Municipal)',
    '8-15':'Assunção de Nossa Senhora','10-5':'Implantação da República',
    '11-1':'Dia de Todos os Santos','12-1':'Restauração da Independência',
    '12-8':'Imaculada Conceição','12-25':'Natal'
  };
  return names[`${m}-${d}`]||`${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;
}
let _editHolKey=null;
function renderSettings(){
  // Show nav-settings for admins
  const ns=document.getElementById('nav-settings'); if(ns) ns.style.display=isAdmin()?'':'none';
  _renderHolidayList();
  const addBtn=document.getElementById('set-hol-add-btn');
  if(addBtn) addBtn.style.display=isAdmin()?'':'none';
}
function _renderHolidayList(){
  const el=document.getElementById('set-hol-list'); if(!el) return;
  const hols=_getHolidays();
  const admin=isAdmin();
  el.innerHTML=hols.map(h=>{
    const key=`${h.m}-${h.d}`;
    const label=h.name||_ptHolName(h.m,h.d);
    const badge=h.type==='municipal'?'🏙':'🇵🇹';
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bd2);font-size:11px">
      <span style="font-size:13px">${badge}</span>
      <span style="flex:1;color:var(--fg0)">${label}</span>
      <span style="color:var(--fg3);min-width:40px">${String(h.d).padStart(2,'0')}/${String(h.m).padStart(2,'0')}</span>
      <span style="font-size:9px;color:var(--fg3);min-width:55px">${h.type||'nacional'}</span>
      ${admin?`<button class="btn btn-xs" onclick="_editHolidayForm('${key}')" title="Edit">✎</button>
               <button class="btn btn-xs btn-d" onclick="_deleteHoliday('${key}')" title="Delete">✕</button>`:''}
    </div>`;
  }).join('');
}
window._addHolidayForm=()=>{
  _editHolKey=null;
  document.getElementById('set-hol-name').value='';
  document.getElementById('set-hol-date').value='';
  document.getElementById('set-hol-type').value='municipal';
  document.getElementById('set-hol-form').style.display='';
  document.getElementById('set-hol-add-btn').style.display='none';
};
window._editHolidayForm=(key)=>{
  _editHolKey=key;
  const h=_getHolidays().find(x=>`${x.m}-${x.d}`===key); if(!h) return;
  document.getElementById('set-hol-name').value=h.name||_ptHolName(h.m,h.d);
  document.getElementById('set-hol-date').value=`${String(h.m).padStart(2,'0')}-${String(h.d).padStart(2,'0')}`;
  document.getElementById('set-hol-type').value=h.type||'nacional';
  document.getElementById('set-hol-form').style.display='';
  document.getElementById('set-hol-add-btn').style.display='none';
};
window._cancelHoliday=()=>{
  document.getElementById('set-hol-form').style.display='none';
  document.getElementById('set-hol-add-btn').style.display=isAdmin()?'':'none';
};
window._saveHoliday=()=>{
  const name=document.getElementById('set-hol-name').value.trim();
  const dateVal=document.getElementById('set-hol-date').value.trim(); // MM-DD
  const type=document.getElementById('set-hol-type').value;
  if(!name||!dateVal){ notify('Name and date required','warn'); return; }
  const parts=dateVal.split('-').map(Number);
  if(parts.length!==2||parts[0]<1||parts[0]>12||parts[1]<1||parts[1]>31){ notify('Date must be MM-DD (e.g. 06-13)','warn'); return; }
  const [m,d]=parts;
  const action=_editHolKey?'edit':'create';
  const msg=action==='edit'
    ? `Save changes to this holiday?\n\nCalendar changes take effect immediately in the Gantt — tasks already allocated on the affected dates may need to be reviewed.`
    : `Add "${name}" (${dateVal}) as a holiday?\n\nCalendar changes take effect immediately in the Gantt — tasks already allocated on this date may need to be reviewed.`;
  if(!confirm(msg)) return;
  // If editing, remove the OLD entry first (by original key, not new date)
  if(_editHolKey){
    const oldParts=_editHolKey.split('-').map(Number);
    const oldIdx=PT_HOL_CUSTOM.findIndex(x=>x.m===oldParts[0]&&x.d===oldParts[1]);
    if(oldIdx>=0) PT_HOL_CUSTOM.splice(oldIdx,1);
    // If old date was a builtin and date changed, mark old date as deleted
    const oldBuiltin=PT_HOL.find(h=>h.m===oldParts[0]&&h.d===oldParts[1]);
    if(oldBuiltin&&(oldParts[0]!==m||oldParts[1]!==d))
      PT_HOL_CUSTOM.push({m:oldParts[0],d:oldParts[1],name:'',type:'deleted'});
  }
  // Insert/update new entry
  const existing=PT_HOL_CUSTOM.findIndex(x=>x.m===m&&x.d===d);
  if(existing>=0) PT_HOL_CUSTOM[existing]={m,d,name,type};
  else PT_HOL_CUSTOM.push({m,d,name,type});
  persistState(['meta']);
  _cancelHoliday(); _renderHolidayList();
  notify('Holiday saved — Gantt updated','success');
};
window._deleteHoliday=(key)=>{
  const parts=key.split('-').map(Number); const [m,d]=parts;
  const hol=_getHolidays().find(h=>`${h.m}-${h.d}`===key);
  const label=hol?.name||`${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;
  if(!confirm(`Remove "${label}" from the holiday calendar?\n\nThis change takes effect immediately in the Gantt — tasks already allocated on this date may need to be reviewed.`)) return;
  const idx=PT_HOL_CUSTOM.findIndex(x=>x.m===m&&x.d===d);
  if(idx>=0) PT_HOL_CUSTOM.splice(idx,1);
  const builtin=PT_HOL.find(h=>h.m===m&&h.d===d);
  if(builtin) PT_HOL_CUSTOM.push({m,d,name:'',type:'deleted'});
  persistState(['meta']);
  _renderHolidayList();
  notify('Holiday removed — Gantt updated','success');
};

function renderLogsPage(){
  const el=document.getElementById('logs-page-content');
  if(!el) return;

  // Populate user filter (preserve current selection)
  const userSel=document.getElementById('log-filter-user');
  if(userSel){
    const _prevUser=userSel.value;
    const users=new Set(GLOG.map(e=>e.user||'—').filter(Boolean));
    userSel.innerHTML='<option value="">All users</option>'+[...users].map(u=>`<option value="${u}">${u}</option>`).join('');
    if(_prevUser) userSel.value=_prevUser;
  }

  const typeF=document.getElementById('log-filter-type')?.value||'';
  const userF=document.getElementById('log-filter-user')?.value||'';

  const logs=GLOG.filter(e=>{
    if(typeF&&e.type!==typeF) return false;
    if(userF&&(e.user||'—')!==userF) return false;
    return true;
  });

  if(!logs.length){
    el.innerHTML='<div style="padding:24px;text-align:center;color:var(--fg3);font-size:11px">No activity logged yet. Logs appear here when tasks are created, edited, moved or timed.</div>';
    return;
  }

  el.innerHTML=`<div style="overflow-x:auto">
    <table class="dt">
      <thead><tr>
        <th style="width:75px">Time</th>
        <th style="width:85px">User</th>
        <th style="width:65px">Type</th>
        <th style="min-width:160px">Task / Entity</th>
        <th style="min-width:300px">Details</th>
      </tr></thead>
      <tbody>
        ${logs.map(e=>{
          const col=LCOL[e.type]||'var(--fg2)';
          const ico=LICO[e.type]||'·';
          const user=e.user||S_USER?.name||'—';
          return `<tr>
            <td class="mono txs" style="color:var(--fg3)">${e.time||'—'}</td>
            <td style="font-size:10px;font-weight:600;color:var(--fg1)">${user}</td>
            <td><span style="display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;color:${col};padding:2px 6px;background:${col}18;border-radius:4px">${ico} ${e.type}</span></td>
            <td style="font-size:11px;color:var(--fg0);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${e.task}">${e.task||'—'}</td>
            <td style="font-size:10px;color:var(--fg2);white-space:normal;line-height:1.5">${e.from?`<span style="color:var(--fg3)">${e.from}</span><span style="color:var(--fg3);margin:0 4px">→</span>`:''}<span style="color:var(--fg1)">${e.to||''}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}
window.renderLogsPage=renderLogsPage;





window.cycleMsFilter=(id)=>{
  _msFilter=id||null;
  renderGantt();
};

window.showMsDayMenu=(e,ids)=>{
  const old=document.getElementById('ms-day-menu');
  if(old) old.remove();
  const menu=document.createElement('div');
  menu.id='ms-day-menu';
  menu.style.cssText='position:fixed;z-index:500;background:var(--bg2);border:1px solid var(--bd2);border-radius:8px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,.5);min-width:160px';
  menu.style.left=Math.min(e.clientX,window.innerWidth-170)+'px';
  menu.style.top=Math.min(e.clientY,window.innerHeight-220)+'px';
  let html='<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--fg3);padding:4px 8px 2px">Milestones</div>';
  ids.forEach(id=>{
    const ms=MILESTONES.find(m=>m.id===id); if(!ms) return;
    const isAct=_msFilter===id;
    const col=ms.color||'var(--acc2)';
    html+=`<div onclick="window._msDayMenuClick('${id}')" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;cursor:pointer;${isAct?'background:rgba(79,156,249,.12)':''};font-size:11px;color:var(--fg0)" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background='${isAct?'rgba(79,156,249,.12)':''}'">
      <span style="width:10px;height:10px;border-radius:50%;background:${col};flex-shrink:0"></span>
      <span style="flex:1">${ms.name}</span>
      ${isAct?'<span style="font-size:9px;color:var(--acc)">✓</span>':''}
    </div>`;
  });
  html+=`<div style="height:1px;background:var(--bd);margin:3px 0"></div>`;
  if(_msFilter&&ids.includes(_msFilter)){
    html+=`<div onclick="window._msDayMenuClick(null)" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;cursor:pointer;font-size:11px;color:var(--fg2)" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background=''">
      <span>✕</span> Clear filter
    </div>`;
  }
  html+=`<div style="height:1px;background:var(--bd);margin:3px 0"></div>`;
  ids.forEach(id=>{
    const ms=MILESTONES.find(m=>m.id===id); if(!ms) return;
    html+=`<div onclick="openEditMilestone('${id}');document.getElementById('ms-day-menu')?.remove()" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:5px;cursor:pointer;font-size:11px;color:var(--fg2)" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background=''">
      <span style="font-size:10px">✎</span> Edit: ${ms.name}
    </div>`;
  });
  menu.innerHTML=html;
  document.body.appendChild(menu);
  window._msDayMenuClick=(id)=>{
    _msFilter=id||null;
    renderGantt();
    menu.remove();
  };
  setTimeout(()=>{
    const close=(ev)=>{ if(!menu.contains(ev.target)){ menu.remove(); document.removeEventListener('click',close); } };
    document.addEventListener('click',close);
  },50);
};

window._showHoldDialog=(taskId)=>{
  const t=TASKS.find(x=>x.id===taskId); if(!t) return;
  // Create inline mini-modal
  const old=document.getElementById('hold-dialog'); if(old) old.remove();
  const dlg=document.createElement('div');
  dlg.id='hold-dialog';
  dlg.style.cssText='position:fixed;inset:0;z-index:600;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)';
  dlg.innerHTML=`
    <div style="background:var(--bg2);border:1px solid var(--bd2);border-radius:var(--r12);padding:20px 24px;width:360px;max-width:95vw;box-shadow:0 8px 32px rgba(0,0,0,.6)">
      <div style="font-size:13px;font-weight:700;color:var(--fg0);margin-bottom:4px">⏸ Put on hold</div>
      <div style="font-size:11px;color:var(--fg2);margin-bottom:14px">${t.name}</div>
      <label style="font-size:10px;font-weight:600;color:var(--fg2);display:block;margin-bottom:6px">Reason / blocked by <span style="color:var(--fg3);font-weight:400">(optional)</span></label>
      <input id="hold-reason-inp" class="fi" placeholder="e.g. Waiting for parts, Pedro, Supplier X…" style="margin-bottom:14px;width:100%" value="${t.holdBlocker||''}">
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-sm" onclick="document.getElementById('hold-dialog').remove()">Cancel</button>
        <button class="btn btn-sm" style="background:rgba(240,169,40,.18);color:var(--warn);border-color:var(--warn)" onclick="
          const reason=document.getElementById('hold-reason-inp').value.trim();
          const t2=TASKS.find(x=>x.id==='${taskId}');
          if(t2){ t2.status='hold'; t2.holdBlocker=reason||null; }
          addLog({type:'status',task:'${t.name.replace(/'/g,"\'")}',from:'',to:'On Hold'+(reason?' — '+reason:'')});
          notify('On hold'+(reason?' — '+reason:''),'warn');
          persistState(['tasks'],{tasks:['${taskId}']}); renderGantt(); renderDash();
          document.getElementById('hold-dialog').remove();
        ">⏸ Put on hold</button>
      </div>
    </div>`;
  dlg.addEventListener('click',e=>{ if(e.target===dlg) dlg.remove(); });
  document.body.appendChild(dlg);
  setTimeout(()=>document.getElementById('hold-reason-inp')?.focus(),50);
};


// ── Auto-pause on PC suspend / screen lock ────────────────────
(()=>{
  let _hiddenAt=null;
  const SUSPEND_THRESHOLD=60000; // 60s = definite suspend/sleep

  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){
      _hiddenAt=Date.now();
    } else {
      if(_hiddenAt){
        const hiddenMs=Date.now()-_hiddenAt;
        _hiddenAt=null;
        if(hiddenMs>=SUSPEND_THRESHOLD){
          const tid=_timerState?.taskId;
          if(tid&&!_timerState.paused){
            tpPause(tid);
            notify('Timer paused — PC was suspended','warn');
          }
        }
      }

    }
  });
})();

// Prevent modal from closing when mouse drag ends outside
(()=>{
  let _mbgMouseDownTarget=null;
  document.addEventListener('mousedown',e=>{ _mbgMouseDownTarget=e.target; });
  document.addEventListener('click',e=>{
    const mbg=e.target.closest?.('.mbg');
    if(mbg&&e.target===mbg&&_mbgMouseDownTarget===mbg){
      // Both mousedown and click on backdrop — close
      const modal=mbg.querySelector('.modal');
      if(modal){
        const id=mbg.id;
        if(id==='m-task'||id==='m-milestone'||id==='m-project'||id==='m-proj'||id==='m-log'||id==='m-split'||id==='m-flog'){
          CM(id);
        }
      }
    }
  });
})();

window._cycleSortGantt=()=>{
  const order=['chrono','name','tags'];
  const cur=S._sortBy||'chrono';
  S._sortBy=order[(order.indexOf(cur)+1)%order.length];
  S._sortLocked=false;
  renderGantt();
};
window._sortMenuGantt=(e)=>{
  const old=document.getElementById('g-sort-menu'); if(old) old.remove();
  const menu=document.createElement('div');
  menu.id='g-sort-menu';
  menu.style.cssText='position:fixed;z-index:500;background:var(--bg2);border:1px solid var(--bd2);border-radius:8px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,.5);min-width:140px';
  menu.style.left=e.clientX+'px'; menu.style.top=e.clientY+'px';
  const opts=[['chrono','📅 Chronological'],['name','🔤 Name (A–Z)'],['tags','# Tags (A–Z)']];
  menu.innerHTML=opts.map(([v,l])=>`<div onclick="S._sortBy='${v}';S._sortLocked=false;renderGantt();this.closest('#g-sort-menu').remove()" style="padding:7px 12px;font-size:11px;cursor:pointer;border-radius:5px;background:${(S._sortBy||'chrono')===v?'var(--bg3)':'none'};color:var(--fg0)" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='${(S._sortBy||'chrono')===v?'var(--bg3)':'none'}'">
    ${l}${(S._sortBy||'chrono')===v?' ✓':''}
  </div>`).join('');
  document.body.appendChild(menu);
  setTimeout(()=>{ const cl=()=>{menu.remove();document.removeEventListener('click',cl);}; document.addEventListener('click',cl); },50);
};

window._onProjSelectorChange=(projId)=>{
  S._activeProjId=projId||null;
  // Clear milestone filter if it belongs to a different project
  if(_msFilter){ const _msObj=MILESTONES.find(m=>m.id===_msFilter); if(_msObj&&_msObj.projId&&projId&&_msObj.projId!==projId) _msFilter=null; }
  // Project selector only sets _activeProjId — never touches vbFilter
  // (vbFilter belongs to the resource/team/project view-by filter)
  renderGantt();
};

function _renderTaskMilestones(taskId){
  const wrap=document.getElementById('mt-ms-list');
  if(!wrap) return;
  if(!taskId){
    wrap.innerHTML='<span style="font-size:10px;color:var(--fg3)">Save task first to associate milestones</span>';
    return;
  }
  // Filter milestones to the task's project only
  const _task=TASKS.find(t=>t.id===taskId);
  const _projFilter=_task?.projId;
  const projMs=ms=>!_projFilter||!ms.projId||(ms.projId===_projFilter); // include global milestones (no projId)
  const assoc=MILESTONES.filter(m=>(m.taskIds||[]).includes(taskId)&&projMs(m));
  const unassoc=MILESTONES.filter(m=>!(m.taskIds||[]).includes(taskId)&&projMs(m));
  let html='';
  if(assoc.length){
    html+=assoc.map(m=>`<span style="display:inline-flex;align-items:center;gap:4px;background:${m.color||'var(--acc2)'}22;border:1px solid ${m.color||'var(--acc2)'};border-radius:5px;padding:2px 8px;font-size:10px;color:${m.color||'var(--acc2)'}">◆ ${m.name}<span onclick="(function(){var ms=MILESTONES.find(function(x){return x.id==='${m.id}'});if(ms)ms.taskIds=(ms.taskIds||[]).filter(function(x){return x!=='${taskId}'});persistState(['milestones']);_renderTaskMilestones('${taskId}');})()" style="cursor:pointer;margin-left:3px;opacity:.6">✕</span></span>`).join('');
  }
  if(unassoc.length){
    html+=`<select onchange="(function(){var ms=MILESTONES.find(function(x){return x.id===this.value}.bind(this));if(ms){if(!ms.taskIds)ms.taskIds=[];if(!ms.taskIds.includes('${taskId}'))ms.taskIds.push('${taskId}');persistState(['milestones']);_renderTaskMilestones('${taskId}');}this.value='';}.bind(this))()" style="font-size:10px;padding:2px 6px;border-radius:5px;border:1px solid var(--bd);background:var(--bg3);color:var(--fg2);cursor:pointer;margin-left:4px"><option value="">+ Add milestone</option>${unassoc.map(m=>`<option value="${m.id}">◆ ${m.name}</option>`).join('')}</select>`;
  }
  if(!assoc.length&&!unassoc.length) html='<span style="font-size:10px;color:var(--fg3)">No milestones defined yet</span>';
  wrap.innerHTML=html;
}
window._updateTaskMilestones=()=>_renderTaskMilestones(S.editId||null);

function taskHasMilestone(taskId){
  return getEffectiveMilestones(taskId).length>0;
}

function _checkMilestoneAutoComplete(){
  let changed=false; const _changedIds=[];
  MILESTONES.forEach(ms=>{
    if(!ms.dayIdx||ms.dayIdx>GANTT_TODAY) return;
    (ms.taskIds||[]).forEach(tid=>{
      const t=TASKS.find(x=>x.id===tid);
      if(t&&t.status==='ready'){
        t.status='done';
        _changedIds.push(tid);
        addLog({type:'status',task:t.name,from:'Ready',to:'Done (milestone passed)'});
        changed=true;
      }
    });
  });
  if(changed){ persistState(['tasks'],{tasks:_changedIds}); renderGantt&&renderGantt(); renderDash&&renderDash(); }
}

window._msSwitchTab=(tab)=>{
  document.getElementById('ms-pane-details').style.display=tab==='details'?'':'none';
  document.getElementById('ms-pane-notes').style.display=tab==='notes'?'':'none';
  document.getElementById('ms-tab-details').classList.toggle('on',tab==='details');
  document.getElementById('ms-tab-notes').classList.toggle('on',tab==='notes');
};

function _saveSessionState(){
  if(!S_USER?.resId) return;
  try{
    sessionStorage.setItem('pg_ui_'+S_USER.resId, JSON.stringify({
      page: S.page,
      viewBy: S.viewBy,
      vbFilter: S.vbFilter.filter(x=>x!=='__none__'), // don't persist sentinel
      statusFilter: S.statusFilter,
      filterUnassigned: S.filterUnassigned,
      offset: S.offset,
      _sortBy: S._sortBy||'chrono',
      _wlView: S._wlView||'week',
      _activeProjId: S._activeProjId||null,
      _myDayOffset: _myDayOffset||0
    }));
  }catch(e){}
}

function _restoreSessionState(){
  if(!S_USER?.resId) return;
  try{
    const raw=sessionStorage.getItem('pg_ui_'+S_USER.resId);
    if(!raw) return;
    const saved=JSON.parse(raw);
    if(saved.viewBy) S.viewBy=saved.viewBy;
    if(saved.vbFilter) S.vbFilter=(saved.vbFilter||[]).filter(x=>x!=='__none__');
    if(saved.statusFilter) S.statusFilter=saved.statusFilter;
    if(saved.filterUnassigned!=null) S.filterUnassigned=saved.filterUnassigned;
    if(saved.offset) S.offset=saved.offset;
    if(saved._sortBy) S._sortBy=saved._sortBy;
    if(saved._wlView) S._wlView=saved._wlView;
    if(saved._activeProjId) S._activeProjId=saved._activeProjId;
    if(saved._myDayOffset) _myDayOffset=saved._myDayOffset;
    return saved.page; // return saved page to navigate to
  }catch(e){ return null; }
}

// Force save on tab close / navigate away
window.addEventListener('beforeunload', ()=>{
  if(!Object.keys(_pendingSave).length) return;
  clearTimeout(persistState._t);
  const snap2=_pendingSave; _pendingSave={};
  const patch={};
  const _be=(k,arr)=>{ if(!snap2[k]) return; const p={}; const ids=snap2[k]; if(ids.has('__all__')) arr.forEach(x=>p[x.id]=x); else ids.forEach(id=>{const x=arr.find(i=>i.id===id);if(x)p[x.id]=x;}); if(Object.keys(p).length) patch[k]=p; };
  _be('tasks',TASKS); _be('milestones',MILESTONES); _be('resources',RESOURCES); _be('teams',TEAMS); _be('projects',PROJECTS);
  if(snap2.meta) patch.meta=_buildMeta();
  if(snap2.logs) patch.logs=GLOG.slice(0,500);
  try{
    // Per-entity PATCHes with keepalive so concurrent saves don't conflict
    const _e={tasks:TASKS,milestones:MILESTONES,resources:RESOURCES,teams:TEAMS,projects:PROJECTS};
    for(const [k,arr] of Object.entries(_e)){
      if(patch[k]) fetch(_FB_ROOT+'/'+k+'.json',{method:'PATCH',keepalive:true,
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(patch[k])}).catch(()=>{});
    }
    if(patch.meta) fetch(_FB_ROOT+'/meta.json',{method:'PATCH',keepalive:true,
      headers:{'Content-Type':'application/json'},body:JSON.stringify(patch.meta)}).catch(()=>{});
  } catch(e){}
  _pendingSave={};
});


window._cycleSubtaskStatus=(taskId,stId)=>{
  const t=TASKS.find(x=>x.id===taskId); if(!t) return;
  const st=(t.subtasks||[]).find(s=>s.id===stId); if(!st) return;
  const order=['todo','doing','paused','done'];
  st.status=order[(order.indexOf(st.status||'todo')+1)%order.length];
  // Auto-update parent progress
  const sts=t.subtasks.filter(s=>s.name?.trim());
  if(sts.length) t.prog=Math.round(sts.filter(s=>s.status==='done').length/sts.length*100);
  addLog({type:'edit',task:t.name,from:'',to:`subtask "${st.name}" → ${SLABELS[st.status]||st.status}`});
  persistState(['tasks'],{tasks:[taskId]});
  renderGantt();
};

// ── SUBTASK EDITOR MODAL ──────────────────────────────────────────
let _stEditParentId=null, _stEditStId=null;

window._openSubtaskEditor=(parentId, stId)=>{
  const t=TASKS.find(x=>x.id===parentId); if(!t) return;
  // Find subtask in t.subtasks[] or in TASKS[] children (promoted subtasks)
  const st=(t.subtasks||[]).find(s=>s.id===stId) || TASKS.find(x=>x.id===stId&&x.parentId===parentId);
  if(!st) return;
  _stEditParentId=parentId; _stEditStId=stId;
  const modal=document.getElementById('m-subtask');
  if(!modal){
    // Create modal inline
    const div=document.createElement('div');
    div.id='m-subtask';
    div.className='mbg';
    div.innerHTML=`<div class="modal" style="width:420px;max-width:95vw">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <span style="font-size:13px;font-weight:700;color:var(--fg0)" id="mst-title">Edit Subtask</span>
        <button onclick="CM('m-subtask')" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--fg3)">✕</button>
      </div>
      <div class="fg"><label class="fl">Name *</label><input class="fi" id="mst-name" placeholder="Subtask name"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="fg"><label class="fl">Resource</label><select class="fi" id="mst-res"><option value="">— none —</option></select></div>
        <div class="fg"><label class="fl">Hours</label><input class="fi" type="number" id="mst-hours" min="0.5" step="0.5" placeholder="0"></div>
        <div class="fg"><label class="fl">Group</label><input class="fi" id="mst-group" readonly style="background:var(--bg2);color:var(--fg3);cursor:default" tabindex="-1"></div>
        <div class="fg"><label class="fl">Deadline</label><input class="fi" type="date" id="mst-deadline"></div>
      </div>
      <div class="fg"><label class="fl">Notes</label><textarea class="fi" id="mst-notes" rows="2" style="resize:none" placeholder="Optional notes…"></textarea></div>
      <div class="fg" style="margin-bottom:0">
        <label class="fl">Status</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${['todo','doing','paused','done'].map(s=>`<button onclick="document.querySelectorAll('.mst-stat').forEach(b=>b.classList.remove('on'));this.classList.add('on');document.getElementById('mst-stat-val').value='${s}'" class="btn btn-sm mst-stat" style="font-size:10px">${SLABELS[s]||s}</button>`).join('')}
          <input type="hidden" id="mst-stat-val" value="todo">
        </div>
      </div>
      <div class="mf">
        <button class="btn btn-sm" style="margin-right:auto;background:rgba(240,82,82,.12);color:var(--danger);border-color:var(--danger)" onclick="window._deleteSubtask()">Delete</button>
        <button class="btn btn-sm" onclick="CM('m-subtask')">Cancel</button>
        <button class="btn btn-p btn-sm" onclick="window._saveSubtaskEditor()">Save</button>
      </div>
    </div>`;
    div.addEventListener('mousedown',e=>{if(e.target===div){div._mousedownOnBg=true;}});
    div.addEventListener('click',e=>{if(e.target===div&&div._mousedownOnBg){CM('m-subtask');}div._mousedownOnBg=false;});
    document.body.appendChild(div);
  // Populate resources grouped by team
  const sel=document.getElementById('mst-res');
  const byTeam={};
  RESOURCES.forEach(r=>{ const tid=(r.teams||[])[0]||'__none__'; if(!byTeam[tid]) byTeam[tid]=[]; byTeam[tid].push(r); });
  sel.innerHTML='<option value="">— Unassigned —</option>'+Object.entries(byTeam).map(([tid,res])=>{
    const tName=tid==='__none__'?'No team':(TEAMS.find(x=>x.id===tid)?.name||tid);
    return `<optgroup label="${tName}">${res.map(r=>`<option value="${r.id}">${r.name}</option>`).join('')}</optgroup>`;
  }).join('');
  }
  // Fill fields
  document.getElementById('mst-name').value=st.name||'';
  document.getElementById('mst-res').value=st.resId||'';
  document.getElementById('mst-hours').value=st.hours||'';
  document.getElementById('mst-group').value=t.group||'';
  // start date not shown in editor
  document.getElementById('mst-deadline').value=st.deadline||'';
  document.getElementById('mst-notes').value=st.notes||'';
  const statVal=st.status||'todo';
  document.getElementById('mst-stat-val').value=statVal;
  document.querySelectorAll('.mst-stat').forEach(b=>b.classList.toggle('on',b.textContent.trim()===(SLABELS[statVal]||statVal)));
  OM('m-subtask');
};

window._saveSubtaskEditor=()=>{
  const t=TASKS.find(x=>x.id===_stEditParentId); if(!t) return;
  const st=(t.subtasks||[]).find(s=>s.id===_stEditStId) || TASKS.find(x=>x.id===_stEditStId&&x.parentId===_stEditParentId);
  if(!st) return;
  const isChild=!!(st.parentId); // true if promoted to TASKS[]
  const name=document.getElementById('mst-name').value.trim();
  if(!name){notify('Name required','warn');return;}
  const oldSt=JSON.parse(JSON.stringify(st));
  st.name=name;
  const _newStResId=document.getElementById('mst-res').value||null;
  st.resId=_newStResId;
  st.group=t.group||null;
  st.hours=parseFloat(document.getElementById('mst-hours').value)||null;
  // start is computed by the scheduler, not set manually
  st.deadline=document.getElementById('mst-deadline').value||null;
  st.notes=document.getElementById('mst-notes').value||'';
  st.status=document.getElementById('mst-stat-val').value||'todo';
  // Recompute dur
  if(st.start&&st.hours){
    const cap=getRes(st.resId||t.resId)?.dailyCap||HPD;
    st.dur=Math.max(1,Math.ceil(st.hours/cap));
  }
  // Log changes
  const diffs=[];
  if(oldSt.name!==st.name) diffs.push(`name: "${oldSt.name}" → "${st.name}"`);
  if((oldSt.status||'todo')!==(st.status||'todo')) diffs.push(`status: ${SLABELS[oldSt.status]||oldSt.status} → ${SLABELS[st.status]||st.status}`);
  if(oldSt.hours!==st.hours) diffs.push(`hours: ${oldSt.hours||0}h → ${st.hours||0}h`);
  if(oldSt.deadline!==st.deadline) diffs.push(`deadline: ${oldSt.deadline||'none'} → ${st.deadline||'none'}`);
  if(diffs.length) addLog({type:'edit',task:`${t.name} › ${st.name}`,from:'',to:diffs.join(' · ')});
  // Auto-update parent progress
  const sts=t.subtasks.filter(s=>s.name?.trim());
  if(sts.length) t.prog=Math.round(sts.filter(s=>s.status==='done').length/sts.length*100);
  persistState(['tasks'],{tasks:[_stEditParentId,...(isChild?[_stEditStId]:[])]}); 
  CM('m-subtask');
  renderGantt();
  notify(`"${st.name}" saved ✓`,'success');
};

window._deleteSubtask=()=>{
  if(!confirm('Delete this subtask?')) return;
  const t=TASKS.find(x=>x.id===_stEditParentId); if(!t) return;
  const st=(t.subtasks||[]).find(s=>s.id===_stEditStId) || TASKS.find(x=>x.id===_stEditStId&&x.parentId===_stEditParentId);
  addLog({type:'delete',task:`${t.name} › ${st?.name||''}`,from:'',to:'subtask deleted'});
  // Remove from t.subtasks[] if present
  t.subtasks=(t.subtasks||[]).filter(s=>s.id!==_stEditStId);
  // Remove from TASKS[] if promoted
  const childIdx=TASKS.findIndex(x=>x.id===_stEditStId&&x.parentId===_stEditParentId);
  if(childIdx!==-1){
    TASKS.splice(childIdx,1);
    const _dp={}; _dp[_stEditStId]=null;
    fetch(_FB_ROOT+'/tasks.json',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(_dp)}).catch(()=>{});
  }
  const sts=t.subtasks.filter(s=>s.name?.trim());
  if(sts.length) t.prog=Math.round(sts.filter(s=>s.status==='done').length/sts.length*100);
  persistState(['tasks'],{tasks:[_stEditParentId]});
  CM('m-subtask');
  renderGantt();
};

window._showSubCtx=(e,parentId,stId)=>{
  const t=TASKS.find(x=>x.id===parentId); if(!t) return;
  const st=(t.subtasks||[]).find(s=>s.id===stId); if(!st) return;
  const old=document.getElementById('sub-ctx'); if(old) old.remove();
  const menu=document.createElement('div');
  menu.id='sub-ctx';
  menu.style.cssText='position:fixed;z-index:500;background:var(--bg2);border:1px solid var(--bd2);border-radius:8px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,.5);min-width:160px';
  menu.style.left=Math.min(e.clientX,window.innerWidth-170)+'px';
  menu.style.top=Math.min(e.clientY,window.innerHeight-220)+'px';
  const stCol=SCOLS[st.status]||'var(--fg3)';
  menu.innerHTML=`
    <div style="padding:5px 10px;font-size:9px;font-weight:700;color:var(--fg3);text-transform:uppercase;letter-spacing:.5px">⤷ ${st.name.slice(0,24)}${st.name.length>24?'…':''}</div>
    <div style="height:1px;background:var(--bd);margin:2px 0"></div>
    <div onclick="window._openSubtaskEditor('${parentId}','${stId}');this.closest('#sub-ctx').remove()" class="ci">✎ Edit subtask</div>
    <div style="height:1px;background:var(--bd);margin:2px 0"></div>
    ${['todo','doing','paused','done'].map(s=>`<div onclick="window._setSubStatusDirect('${parentId}','${stId}','${s}');this.closest('#sub-ctx').remove()" class="ci" style="color:${SCOLS[s]||'var(--fg2)'}">${s===st.status?'✓ ':''} ${SLABELS[s]||s}</div>`).join('')}
    <div style="height:1px;background:var(--bd);margin:2px 0"></div>
    <div onclick="if(confirm('Delete subtask?')){_stEditParentId='${parentId}';_stEditStId='${stId}';window._deleteSubtask();}this.closest('#sub-ctx')?.remove()" class="ci" style="color:var(--danger)">🗑 Delete</div>`;
  document.body.appendChild(menu);
  setTimeout(()=>{const cl=()=>{menu.remove();document.removeEventListener('click',cl);};document.addEventListener('click',cl);},50);
};

window._setSubStatusDirect=(parentId,stId,status)=>{
  const t=TASKS.find(x=>x.id===parentId); if(!t) return;
  const st=(t.subtasks||[]).find(s=>s.id===stId); if(!st) return;
  addLog({type:'status',task:`${t.name} › ${st.name}`,from:SLABELS[st.status]||st.status,to:SLABELS[status]||status});
  st.status=status;
  const sts=t.subtasks.filter(s=>s.name?.trim());
  if(sts.length) t.prog=Math.round(sts.filter(s=>s.status==='done').length/sts.length*100);
  persistState(['tasks'],{tasks:[parentId]});
  renderGantt();
};
// ── SUBTASKS ──────────────────────────────────────────────────
// Subtask: {id, name, resId, hours, status('todo'|'doing'|'paused'|'done'), deadline, notes}
let _curSubtasks = [];
let _showSubtasks = true; // Gantt toggle

function _renderSubtaskList(){
  const wrap = document.getElementById('mt-sub-list');
  const count = document.getElementById('mt-sub-count');
  const progBar = document.getElementById('mt-sub-prog-bar');
  const progFill = document.getElementById('mt-sub-prog-fill');
  const progPct = document.getElementById('mt-sub-prog-pct');
  if(!wrap) return;
  const done = _curSubtasks.filter(s=>s.status==='done').length;
  const total = _curSubtasks.length;
  if(count) count.textContent = total ? `${done}/${total}` : '';
  // Progress bar
  if(progBar){
    progBar.style.display = total ? '' : 'none';
    if(total){
      const pct = Math.round(done/total*100);
      if(progFill) progFill.style.width = pct+'%';
      if(progPct) progPct.textContent = pct+'%';
    }
  }
  if(!total){
    wrap.innerHTML = `<div style="font-size:10px;color:var(--fg3);padding:8px 0;text-align:center;border:1px dashed var(--bd);border-radius:7px;cursor:pointer" onclick="window._addSubtask()">
      + Add your first subtask
    </div>`;
    return;
  }
  wrap.innerHTML = _curSubtasks.map((st,i)=>{
    const isDone = st.status==='done';
    const stCol = SCOLS[st.status]||'var(--fg3)';
    const res = getRes(st.resId);
    const isPromoted = !!TASKS.find(x=>x.id===st.id);
    return `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--bg2);border-radius:7px;border:1px solid var(--bd);${isDone?'opacity:.55':''}transition:background .15s"
      onmouseenter="this.style.background='var(--bg3)'" onmouseleave="this.style.background='var(--bg2)'">
      <!-- Status circle -->
      <button onclick="window._cycleSubStatus(${i})" title="Status: ${SLABELS[st.status]||st.status} — click to cycle"
        style="flex-shrink:0;width:14px;height:14px;border-radius:50%;border:2px solid ${stCol};background:${isDone?stCol:'transparent'};padding:0;cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center">
        ${isDone?'<svg width="8" height="8" viewBox="0 0 8 8"><polyline points="1,4 3,6 7,2" stroke="white" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>':''}
      </button>
      <!-- Name -->
      <input type="text" value="${(st.name||'').replace(/"/g,'&quot;')}"
        oninput="window._renameSubtask(${i},this.value)"
        onfocus="this.parentElement.style.background='var(--bg3)'"
        onblur="this.parentElement.style.background='var(--bg2)'"
        style="flex:1;min-width:0;background:none;border:none;outline:none;font-size:11px;color:${isDone?'var(--fg3)':'var(--fg0)'};font-family:var(--font);${isDone?'text-decoration:line-through':''}"
        placeholder="Subtask name…">
      <!-- Resource avatar or assign button -->
      ${res
        ? `<div class="av av-sm ${res.avClass}" title="${res.name}" style="flex-shrink:0;width:20px;height:20px;font-size:8px;line-height:20px;cursor:pointer" onclick="window._openSubtaskEditor('${S.editId||''}','${st.id}')">${res.initials}</div>`
        : `<button onclick="window._openSubtaskEditor('${S.editId||''}','${st.id}')" title="Assign resource" style="flex-shrink:0;width:20px;height:20px;border-radius:50%;border:1.5px dashed var(--fg3);background:none;color:var(--fg3);font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">+</button>`
      }
      <!-- Hours input -->
      <input type="number" value="${st.hours||''}" min="0.5" step="0.5" placeholder="h"
        oninput="window._setSubHours(${i},this.value)"
        title="Hours"
        style="flex-shrink:0;width:38px;font-size:9px;font-family:var(--mono);color:var(--fg2);background:var(--bg3);border:1px solid transparent;border-radius:4px;padding:1px 4px;text-align:center;outline:none"
        onfocus="this.style.borderColor='var(--acc)'"
        onblur="this.style.borderColor='transparent'">
      <!-- Deadline -->
      ${st.deadline ? `<span style="flex-shrink:0;font-size:9px;color:${new Date(st.deadline)<new Date()&&!isDone?'var(--danger)':'var(--fg3)'};font-family:var(--mono)">${st.deadline}</span>` : ''}
      <!-- Open full task -->
      ${isPromoted ? `<button onclick="event.stopPropagation();CM('m-task');setTimeout(()=>openEditTask('${st.id}'),50)" title="Open as full task" style="flex-shrink:0;background:none;border:none;cursor:pointer;color:var(--acc);font-size:11px;padding:0 2px;opacity:.7" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='.7'">↗</button>` : ''}
      <!-- Delete -->
      <button onclick="window._delSubtask(${i})" title="Remove subtask"
        style="flex-shrink:0;background:none;border:none;cursor:pointer;color:var(--fg3);font-size:13px;padding:0;line-height:1;opacity:0;transition:opacity .15s"
        onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0'">✕</button>
    </div>`;
  }).join('');
}

window._cycleSubStatus = (i)=>{
  const order=['todo','doing','paused','done'];
  const st=_curSubtasks[i]; if(!st) return;
  const next=order[(order.indexOf(st.status||'todo')+1)%order.length];
  st.status=next;
  _renderSubtaskList();
  _autoSaveSubtasks();
};
window._renameSubtask   = (i,v)=>{ if(_curSubtasks[i]){ _curSubtasks[i].name=v; clearTimeout(window._rnT); window._rnT=setTimeout(_autoSaveSubtasks,600); } };
window._setSubRes=(i,v)=>{
  if(!_curSubtasks[i]) return;
  _curSubtasks[i].resId=v||null;
  _renderSubtaskList();
  _autoSaveSubtasks();
};
window._setSubHours     = (i,v)=>{ if(_curSubtasks[i]){ _curSubtasks[i].hours=parseFloat(v)||null; _updateTotalWithSubs(); _autoSaveSubtasks(); } };
window._setSubDl        = (i,v)=>{ if(_curSubtasks[i]){ _curSubtasks[i].deadline=v||null; _autoSaveSubtasks(); } };
window._setSubStart     = (i,v)=>{ if(_curSubtasks[i]){ _curSubtasks[i].start=v?dateToIdx(v):null; _autoSaveSubtasks(); } };
// Auto-save subtask changes to TASKS + Firebase while modal is open
window._autoSaveSubtasks=()=>{
  if(!S.editId) return;
  const t=TASKS.find(x=>x.id===S.editId); if(!t) return;
  const kept=new Set(_curSubtasks.filter(st=>st.name?.trim()).map(st=>st.id));
  // Remove promoted children that were deleted from the modal
  const toDelete=TASKS.filter(x=>x.parentId===S.editId&&!kept.has(x.id));
  toDelete.forEach(x=>{
    TASKS.splice(TASKS.indexOf(x),1);
    const _dp={}; _dp[x.id]=null;
    fetch(_FB_ROOT+'/tasks.json',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(_dp)}).catch(()=>{});
  });
  t.subtasks=_curSubtasks.filter(st=>st.name?.trim()).map(st=>({...st,name:st.name.trim(),group:t.group||null}));
  // For subtasks already promoted to TASKS[], update them directly
  _curSubtasks.filter(st=>st.name?.trim()).forEach(st=>{
    const child=TASKS.find(x=>x.id===st.id&&x.parentId===t.id);
    if(child){ Object.assign(child,{name:st.name.trim(),resId:st.resId||null,hours:st.hours||null,deadline:st.deadline||null,status:st.status||'todo',group:t.group||null,notes:st.notes||''}); }
  });
  // Also clear subtasks entries that are already in TASKS[] to avoid re-promotion
  t.subtasks=t.subtasks.filter(st=>!TASKS.find(x=>x.id===st.id&&x.parentId===t.id));
  const sts=_curSubtasks.filter(st=>st.name?.trim());
  if(sts.length) t.prog=Math.round(sts.filter(s=>s.status==='done').length/sts.length*100);
  const _promotedIds=sts.map(st=>st.id).filter(id=>TASKS.find(x=>x.id===id&&x.parentId===S.editId));
  persistState(['tasks'],{tasks:[S.editId,..._promotedIds]});
};
window._delSubtask=(i)=>{
  const st=_curSubtasks[i];
  if(st&&st.id){
    // Remove promoted child task from TASKS[] if it exists
    const childIdx=TASKS.findIndex(x=>x.id===st.id&&x.parentId===S.editId);
    if(childIdx!==-1){
      const childId=TASKS[childIdx].id;
      TASKS.splice(childIdx,1);
      // Delete from Firebase
      const _dp={}; _dp[childId]=null;
      fetch(_FB_ROOT+'/tasks.json',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(_dp)}).catch(()=>{});
    }
  }
  _curSubtasks.splice(i,1);
  _renderSubtaskList();
  _updateTotalWithSubs();
  _autoSaveSubtasks();
};

window._addSubtask = ()=>{
  const _parentTask=TASKS.find(x=>x.id===S.editId);
  _curSubtasks.push({id:'st'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    name:'', status:'todo', resId:null, hours:null, start:null, deadline:null, notes:'',
    group:_parentTask?.group||null});
  _renderSubtaskList();
  _updateTotalWithSubs();
  _autoSaveSubtasks();
  const inputs = document.querySelectorAll('#mt-sub-list input[type=text]');
  if(inputs.length) inputs[inputs.length-1].focus();
};

function _loadSubtasksIntoModal(subtasks){
  _curSubtasks = JSON.parse(JSON.stringify((subtasks||[]).map(st=>({
    id:st.id||('st'+Date.now()),
    name:st.name||'',
    status:st.status||(st.done?'done':'todo'),
    resId:st.resId||null,
    hours:st.hours||null,
    start:st.start||null,
    deadline:st.deadline||null,
    notes:st.notes||'',
    group:st.group||null
  }))));
  _renderSubtaskList();
}

// Gantt toggle
window.ganttToggleAllCollapse=()=>{
  const btn=document.getElementById('btn-collapse-all');
  const isTV=S.viewBy==='team'||S.viewBy==='resource';
  const tasksWithChildren=TASKS.filter(t=>hasChildren(t.id));
  if(isTV){
    // team/resource view: default=collapsed, _expandedTeamRes tracks expanded
    const allExpanded=tasksWithChildren.every(t=>_expandedTeamRes.has(t.id));
    if(allExpanded){ _expandedTeamRes.clear(); if(btn) btn.textContent='▼'; }
    else { tasksWithChildren.forEach(t=>_expandedTeamRes.add(t.id)); if(btn) btn.textContent='▶'; }
  } else {
    // project view: default=expanded, _collapsedTasks tracks collapsed
    const allCollapsed=tasksWithChildren.every(t=>_collapsedTasks.has(t.id));
    if(allCollapsed){ tasksWithChildren.forEach(t=>_collapsedTasks.delete(t.id)); _saveCollapsed(); if(btn) btn.textContent='▼'; }
    else { tasksWithChildren.forEach(t=>_collapsedTasks.add(t.id)); _saveCollapsed(); if(btn) btn.textContent='▶'; }
  }
  renderGantt();
};

window.toggleSubtasks = ()=>{
  _showSubtasks = !_showSubtasks;
  const btn=document.getElementById('btn-show-subtasks');
  if(btn){ btn.style.opacity=_showSubtasks?'1':'0.4'; btn.title=_showSubtasks?'Hide subtasks':'Show subtasks'; }
  renderGantt();
};

// ── CLEAR FILTERS ────────────────────────────────────────────────
window.clearAllFilters=()=>{
  S.statusFilter=['todo','doing','paused','ready','hold'];
  S.filterUnassigned=false;
  S.selectedTags=[];
  S.vbFilter=[];
  const gs=document.getElementById('g-search'); if(gs) gs.value='';
  buildSFChips(); buildTagPanel(); buildVBPanel&&buildVBPanel();
  renderGantt(); renderTable&&renderTable();
  notify('Filters cleared','success');
};

// ── DESELECT ALL VB ──────────────────────────────────────────────
window.deselectAllVB=()=>{
  // '__none__' sentinel = nothing selected = show nothing
  S.vbFilter=['__none__'];
  // Re-render the panel in place so checkboxes reflect the new state
  const _p=document.getElementById('vb-sel-panel');
  if(_p&&_p.style.display!=='none'){ _p.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.checked=false); }
  renderGantt();
};

// ── TOTAL W/ SUBTASKS UPDATE ─────────────────────────────────────
window._updateTotalWithSubs=()=>{
  const h=parseFloat(document.getElementById('mt-h-tot').value)||0;
  const stH=_curSubtasks.filter(st=>st.name?.trim()).reduce((a,s)=>a+(s.hours||0),0);
  const el=document.getElementById('mt-h-total-sub');
  if(el){
    if(stH>0) el.value=`${h+stH}h (${h}h + ${stH}h subtasks)`;
    else el.value=`${h}h`;
  }
};

// ── GANTT MULTI-SELECT ───────────────────────────────────────────
let _selTasks = new Set();

window.toggleSelTask = (id, checked) => {
  if(checked) _selTasks.add(id);
  else _selTasks.delete(id);
  _updateSelBar();
  // highlight row
  const row = document.querySelector(`.gt tr[data-tid="${id}"]`);
  if(row) row.classList.toggle('sel-row', checked);
};

window.selectAllVisibleTasks=()=>{
  if(!isAdmin()){notify('Only admins can select tasks','warn');return;}
  // Get all task IDs currently visible in the Gantt (checkboxes)
  const checkboxes=document.querySelectorAll('#gw input[type=checkbox][data-tid]');
  if(!checkboxes.length){notify('No tasks visible','warn');return;}
  checkboxes.forEach(cb=>{
    const id=cb.dataset.tid;
    if(id){ _selTasks.add(id); cb.checked=true; }
  });
  _updateSelBar();
};
window.clearSelTasks = () => {
  _selTasks.clear();
  document.querySelectorAll('.gt-sel-cb').forEach(cb => cb.checked = false);
  document.querySelectorAll('.gt tr.sel-row').forEach(r => r.classList.remove('sel-row'));
  _updateSelBar();
};

function _updateSelBar(){
  const bar = document.getElementById('sel-bar');
  const cnt = document.getElementById('sel-bar-count');
  if(!bar) return;
  if(_selTasks.size > 0){
    bar.classList.remove('hidden');
    if(cnt) cnt.textContent = _selTasks.size;
  } else {
    bar.classList.add('hidden');
  }
}

window.selDuplicate = () => {
  if(!_selTasks.size) return;
  if(!isAdmin()){notify('Only admins can duplicate tasks','warn');return;}
  const ids=[..._selTasks];
  clearSelTasks();
  let inserted=0;
  ids.forEach(id=>{
    const src=TASKS.find(x=>x.id===id);
    if(!src) return;
    const copy=JSON.parse(JSON.stringify(src));
    copy.id='t'+Date.now()+inserted;
    copy.name='(copy) '+src.name;
    copy.status='todo';
    copy.prog=0;
    copy.timeLogs=[];
    copy.segments=null;
    const idx=TASKS.findIndex(x=>x.id===src.id);
    TASKS.splice(idx+1,0,copy);
    addLog({type:'create',task:copy.name,from:'',to:'duplicated from '+src.name});
    inserted++;
  });
  persistState(['tasks']);
  renderGantt();renderDash();_refreshOverview();
  notify(inserted+' task'+(inserted>1?'s':'')+' duplicated','success');
};
window.selChangeGroup=()=>{
  if(!isAdmin()){notify('Only admins can change group','warn');return;}
  if(!_selTasks.size) return;
  // Use same fixed group list as Edit Task modal (same order)
  const _fixedGroups=[...document.querySelectorAll('#mt-group option')].filter(o=>o.value).map(o=>o.value);
  const selGroups=[...new Set([..._selTasks].map(id=>TASKS.find(t=>t.id===id)?.group).filter(Boolean))];
  const currentGroup=selGroups.length===1?selGroups[0]:'';
  const inp=document.getElementById('sel-group-input');
  if(inp){
    inp.innerHTML='<option value="">— group —</option>'+_fixedGroups.map(g=>`<option value="${g}" ${g===currentGroup?'selected':''}>${g}</option>`).join('');
  }
  const countEl=document.getElementById('sel-group-count');
  if(countEl) countEl.textContent=_selTasks.size+' task'+(_selTasks.size!==1?'s':'')+' selected';
  OM('m-sel-group');
  setTimeout(()=>document.getElementById('sel-group-input')?.focus(),50);
};

window.selChangeGroupApply=()=>{
  const newGroup=document.getElementById('sel-group-input')?.value||null;
  const ids=[..._selTasks];
  ids.forEach(id=>{
    const t=TASKS.find(x=>x.id===id);
    if(t){ addLog({type:'edit',task:t.name,from:t.group||'—',to:newGroup||'—'}); t.group=newGroup; }
  });
  persistState(['tasks'],{tasks:ids});
  renderGantt(); renderDash(); _refreshOverview();
  CM('m-sel-group');
  clearSelTasks();
  notify(ids.length+' task'+(ids.length!==1?'s':'')+' updated','success');
};

window.selDelete = () => {
  if(!_selTasks.size) return;
  if(!isAdmin()){notify('Only admins can delete tasks','warn');return;}
  const count=_selTasks.size;
  if(!confirm(`Delete ${count} task${count!==1?'s':''}? This cannot be undone.`)) return;
  const ids=[..._selTasks];
  clearSelTasks();
  ids.forEach(id=>{
    _deletedIds.tasks.add(id);
    const t=TASKS.find(x=>x.id===id);
    if(t) addLog({type:'delete',task:t.name,from:'',to:'deleted'});
  });
  TASKS=TASKS.filter(t=>!ids.includes(t.id));
  persistState(['tasks'],{tasks:ids});
  renderGantt();renderDash();_refreshOverview();
  notify(count+' task'+(count!==1?'s':'')+' deleted','warn');
};
window.selAddDependent = () => {
  if(!_selTasks.size) return;
  const ids = [..._selTasks];
  clearSelTasks();
  openAddTask();
  // Set dep type to task
  const depType = document.getElementById('mt-dep-type');
  if(depType){ depType.value = 'task'; onDepTypeChange(); }
  // If only one task, pre-fill the combo-search label
  if(ids.length === 1){
    const src = TASKS.find(x => x.id === ids[0]);
    const inp = document.getElementById('dep-task-search');
    if(inp && src) inp.value = src.name;
    const sel = document.getElementById('mt-dep-id');
    if(sel && src){
      let opt = [...sel.options].find(o => o.value === ids[0]);
      if(!opt){ opt = new Option(src.name, ids[0]); sel.add(opt); }
      sel.value = ids[0];
    }
    // Pre-fill group from source
    const gsel = document.getElementById('mt-group');
    if(gsel && src?.group) gsel.value = src.group;
  } else {
    // Multiple: show names in the search field as hint, store first as dep
    // and note others in the dep note field
    const tasks = ids.map(id => TASKS.find(x => x.id === id)).filter(Boolean);
    const first = tasks[0];
    const inp = document.getElementById('dep-task-search');
    if(inp && first) inp.value = first.name;
    const sel = document.getElementById('mt-dep-id');
    if(sel && first){
      let opt = [...sel.options].find(o => o.value === first.id);
      if(!opt){ opt = new Option(first.name, first.id); sel.add(opt); }
      sel.value = first.id;
    }
    // Put remaining task names in the dep note as reference
    const note = document.getElementById('mt-dep-note');
    if(note && tasks.length > 1){
      note.value = 'Also depends on: ' + tasks.slice(1).map(t => t.name).join(', ');
    }
    document.getElementById('fg-dep-note').style.display = '';
    const gsel = document.getElementById('mt-group');
    if(gsel && first?.group) gsel.value = first.group;
  }
  document.getElementById('fg-dep-task').style.display = '';
  document.getElementById('fg-dep-note').style.display = '';
};

// ── DEP-TASK COMBO-SEARCH (task modal) ───────────────────────────
let _depTaskItems = [];  // [{value, label, indent}]
let _depTaskIdx = -1;

function _buildDepTaskItems(){
  const _projId = S._activeProjId || document.getElementById('mt-proj')?.value || null;
  _depTaskItems = [];
  function _walk(t, depth){
    if(t.id === S.editId) return;
    _depTaskItems.push({value: t.id, label: t.name, depth});
    TASKS.filter(ch => ch.parentId === t.id).forEach(ch => _walk(ch, depth+1));
  }
  TASKS.filter(t => !t.parentId && (!_projId || t.projId === _projId)).forEach(t => _walk(t, 0));
}

function _filterDepTasks(q){
  const ql = q.toLowerCase();
  return _depTaskItems.filter(it => it.label.toLowerCase().includes(ql));
}

function _renderDepTaskDropdown(items){
  const dd = document.getElementById('dep-task-dropdown');
  const csb = document.getElementById('dep-task-csb');
  if(!dd) return;
  if(!items.length){
    dd.innerHTML = '<div class="csi" style="color:var(--fg3);pointer-events:none">No results</div>';
  } else {
    dd.innerHTML = items.map((it,i) => `
      <div class="csi ${i===_depTaskIdx?'csi-active':''}"
        data-val="${it.value}" data-label="${it.label.replace(/"/g,'&quot;')}"
        onmousedown="depTaskSelect('${it.value}','${it.label.replace(/'/g,"&#39;")}')"
        style="${i===_depTaskIdx?'background:var(--bg3);color:var(--fg0)':''}">
        ${'&nbsp;&nbsp;'.repeat(it.depth)}${it.depth>0?'⤷ ':''}<span style="font-weight:600">${it.label}</span>
      </div>`).join('');
  }
  csb.classList.add('open');
}

window.depTaskOpen = ()=>{
  _buildDepTaskItems();
  _depTaskIdx = -1;
  const q = (document.getElementById('dep-task-search')?.value||'').trim();
  _renderDepTaskDropdown(q ? _filterDepTasks(q) : _depTaskItems);
  const inp = document.getElementById('dep-task-search');
  const dd = document.getElementById('dep-task-dropdown');
  if(inp && dd){
    const r = inp.getBoundingClientRect();
    dd.style.left = r.left+'px';
    dd.style.top = (r.bottom+2)+'px';
    dd.style.width = r.width+'px';
  }
};

window.depTaskClose = ()=>{
  const csb = document.getElementById('dep-task-csb');
  if(csb) csb.classList.remove('open');
  _depTaskIdx = -1;
};

window.depTaskInput = (inp)=>{
  _depTaskIdx = -1;
  const q = inp.value.trim();
  _renderDepTaskDropdown(q ? _filterDepTasks(q) : _depTaskItems);
  const dd = document.getElementById('dep-task-dropdown');
  if(dd){
    const r = inp.getBoundingClientRect();
    dd.style.left = r.left+'px';
    dd.style.top = (r.bottom+2)+'px';
    dd.style.width = r.width+'px';
  }
};

window.depTaskKeydown = (e)=>{
  const dd = document.getElementById('dep-task-dropdown');
  const items = dd ? dd.querySelectorAll('.csi[data-val]') : [];
  if(e.key==='ArrowDown'){ e.preventDefault(); _depTaskIdx=Math.min(_depTaskIdx+1,items.length-1); _highlightDepTask(items); }
  else if(e.key==='ArrowUp'){ e.preventDefault(); _depTaskIdx=Math.max(_depTaskIdx-1,0); _highlightDepTask(items); }
  else if(e.key==='Enter'){
    e.preventDefault();
    if(_depTaskIdx>=0&&items[_depTaskIdx]) depTaskSelect(items[_depTaskIdx].dataset.val, items[_depTaskIdx].dataset.label);
    else if(items.length===1) depTaskSelect(items[0].dataset.val, items[0].dataset.label);
  } else if(e.key==='Escape'){ depTaskClose(); }
};

function _highlightDepTask(items){
  items.forEach((el,i)=>{
    el.style.background = i===_depTaskIdx?'var(--bg3)':'';
    el.style.color = i===_depTaskIdx?'var(--fg0)':'';
    if(i===_depTaskIdx) el.scrollIntoView({block:'nearest'});
  });
}

window.depTaskSelect = (value, label)=>{
  const sel = document.getElementById('mt-dep-id');
  if(sel){
    if(![...sel.options].find(o=>o.value===value)){
      const opt=new Option(label, value, true, true);
      sel.add(opt);
    } else {
      [...sel.options].find(o=>o.value===value).selected=true;
    }
  }
  const inp = document.getElementById('dep-task-search');
  if(inp){ inp.value=''; depTaskClose(); }
  _renderDepChips();
};

function _renderDepChips(){
  const sel=document.getElementById('mt-dep-id');
  const chips=document.getElementById('dep-task-chips');
  if(!sel||!chips) return;
  const selected=[...sel.options].filter(o=>o.selected&&o.value);
  chips.innerHTML=selected.map(o=>`<span style="display:inline-flex;align-items:center;gap:4px;background:var(--bg3);border:1px solid var(--bd2);border-radius:4px;padding:2px 6px;font-size:10px;color:var(--fg1)">
    <span>${o.text}</span>
    <span onclick="depRemoveChip('${o.value}')" style="cursor:pointer;color:var(--fg3);font-size:10px;line-height:1">✕</span>
  </span>`).join('');
  chips.style.display=selected.length?'flex':'none';
}

window.depRemoveChip=(value)=>{
  const sel=document.getElementById('mt-dep-id');
  if(!sel) return;
  const opt=[...sel.options].find(o=>o.value===value);
  if(opt) sel.remove(opt.index);
  _renderDepChips();
};

// ── RESOURCE COMBO-SEARCH (task modal) ───────────────────────────
// Internal list: [{value:'resId|teamId', label:'Name', team:'Team Name', initials:'NM'}]
let _resSearchItems = [];
let _resSearchIdx = -1;

function _getInitials(name){
  return name.split(/\s+/).map(w=>w[0]||'').join('').toUpperCase();
}

// Called by _populateResAddFlat to also fill _resSearchItems
function _buildResSearchItems(){
  const addedIds = new Set(_taskTeams.flatMap(tt=>tt.entries.map(e=>e.id)));
  _resSearchItems = [];
  TEAMS.forEach(tm=>{
    const res = RESOURCES.filter(r=>(r.teams||[]).includes(tm.id) && !addedIds.has(r.id));
    res.forEach(r=>_resSearchItems.push({
      value: r.id+'|'+tm.id,
      label: r.name,
      team: tm.name,
      initials: _getInitials(r.name)
    }));
  });
  const noTeam = RESOURCES.filter(r=>(!r.teams||!r.teams.length)&&!addedIds.has(r.id));
  noTeam.forEach(r=>_resSearchItems.push({value:r.id+'|',label:r.name,team:'No team',initials:_getInitials(r.name)}));
}

function _renderResDropdown(items){
  const dd = document.getElementById('mt-res-dropdown');
  const csb = document.getElementById('mt-res-csb');
  if(!dd) return;
  if(!items.length){
    dd.innerHTML = '<div class="csi" style="color:var(--fg3);pointer-events:none">No results</div>';
  } else {
    dd.innerHTML = items.map((it,i)=>`
      <div class="csi ${i===_resSearchIdx?'csi-active':''}"
        data-val="${it.value}" data-label="${it.label}"
        onmousedown="resSearchSelect('${it.value}','${it.label.replace(/'/g,"&#39;")}')"
        style="${i===_resSearchIdx?'background:var(--bg3);color:var(--fg0)':''}">
        <span style="font-weight:600">${it.label}</span>
        <span style="color:var(--fg3);font-size:10px;margin-left:6px">${it.team}</span>
      </div>`).join('');
  }
  csb.classList.add('open');
}

window.resSearchOpen = ()=>{
  _buildResSearchItems();
  _resSearchIdx = -1;
  const q = (document.getElementById('mt-res-search')?.value||'').trim();
  const filtered = q ? _filterResItems(q) : _resSearchItems;
  _renderResDropdown(filtered);
  // Position fixed dropdown under the input
  const inp = document.getElementById('mt-res-search');
  const dd = document.getElementById('mt-res-dropdown');
  if(inp && dd){
    const r = inp.getBoundingClientRect();
    dd.style.left = r.left+'px';
    dd.style.top = (r.bottom+2)+'px';
    dd.style.width = r.width+'px';
  }
};

window.resSearchClose = ()=>{
  const csb = document.getElementById('mt-res-csb');
  if(csb) csb.classList.remove('open');
  _resSearchIdx = -1;
};

function _filterResItems(q){
  const ql = q.toLowerCase();
  // Match by initials first, then by name substring
  const byInitials = _resSearchItems.filter(it=>it.initials.toLowerCase().startsWith(ql));
  const byName = _resSearchItems.filter(it=>!byInitials.includes(it) && it.label.toLowerCase().includes(ql));
  return [...byInitials, ...byName];
}

window.resSearchInput = (inp)=>{
  _resSearchIdx = -1;
  const q = inp.value.trim();
  const filtered = q ? _filterResItems(q) : _resSearchItems;
  _renderResDropdown(filtered);
  const dd = document.getElementById('mt-res-dropdown');
  if(dd){
    const r = inp.getBoundingClientRect();
    dd.style.left = r.left+'px';
    dd.style.top = (r.bottom+2)+'px';
    dd.style.width = r.width+'px';
  }
};

window.resSearchKeydown = (e)=>{
  const dd = document.getElementById('mt-res-dropdown');
  const csb = document.getElementById('mt-res-csb');
  const items = dd ? dd.querySelectorAll('.csi[data-val]') : [];
  if(e.key==='ArrowDown'){
    e.preventDefault();
    _resSearchIdx = Math.min(_resSearchIdx+1, items.length-1);
    _highlightResItem(items);
  } else if(e.key==='ArrowUp'){
    e.preventDefault();
    _resSearchIdx = Math.max(_resSearchIdx-1, 0);
    _highlightResItem(items);
  } else if(e.key==='Enter'){
    e.preventDefault();
    if(_resSearchIdx>=0 && items[_resSearchIdx]){
      const el = items[_resSearchIdx];
      resSearchSelect(el.dataset.val, el.dataset.label);
    } else if(items.length===1){
      resSearchSelect(items[0].dataset.val, items[0].dataset.label);
    }
  } else if(e.key==='Escape'){
    resSearchClose();
  } else {
    if(!csb.classList.contains('open')) csb.classList.add('open');
  }
};

function _highlightResItem(items){
  items.forEach((el,i)=>{
    el.style.background = i===_resSearchIdx ? 'var(--bg3)' : '';
    el.style.color = i===_resSearchIdx ? 'var(--fg0)' : '';
    if(i===_resSearchIdx) el.scrollIntoView({block:'nearest'});
  });
}

window.resSearchSelect = (value, label)=>{
  // Trigger addResFlat via the hidden select
  const sel = document.getElementById('mt-res-add-flat');
  if(sel){
    // Ensure the option exists (it was populated by _populateResAddFlat)
    let opt = [...sel.options].find(o=>o.value===value);
    if(!opt){ opt = new Option(label, value); sel.add(opt); }
    sel.value = value;
    addResFlat();
  }
  // Clear and close
  const inp = document.getElementById('mt-res-search');
  if(inp) inp.value = '';
  resSearchClose();
};

// ── GENERATE REPORT ──────────────────────────────────────────────
window.generateReport=()=>{
  notify('Report — em breve: define o que deves incluir no relatório','info');
};
// ============================================================
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
  // Stamp APP_VERSION into the logo version element (sidebar)
  (()=>{ const _lv=document.getElementById('logo-ver'); if(_lv) _lv.textContent='v'+APP_VERSION; })();
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
  // TEMPORARILY DISABLED — timer not in active use; tasks imported as 'doing' must stay 'doing'
  // TASKS.forEach(t=>{
  //   if(t.status==='doing' && _timerState.taskId!==t.id){
  //     t.status='paused';
  //   }
  // });
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

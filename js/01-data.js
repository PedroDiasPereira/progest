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
function tHours(t){ if(t.segments) return t.segments.reduce((s,g)=>s+g.hours,0); return t.timeMode==='daily'?(t.hpd||HPD)*(t.dur||1):(t.hours??0); }
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


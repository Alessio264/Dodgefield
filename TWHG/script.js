/* =====================================================
   WORLD'S HARDEST GAME – LEVEL EDITOR  (v6)

   Changes:
   - Home screen (level manager) shown on load
   - No pre-made levels when creating a new one (blank canvas)
   - No conveyors
   - Ice: locks direction on entry, player loses control until tile exits
   - Sliders paired with manual number inputs
   - Player speed configurable per level
   - All improvements to intuitiveness
   ===================================================== */

// -------------------------------------------------------
// CONSTANTS
// -------------------------------------------------------
const TILE         = 32;
const PLAYER_SIZE  = 22;
const COIN_RADIUS  = 7;
const ENEMY_RADIUS = 12;

const TILE_EMPTY      = 0;
const TILE_WALL       = 1;
const TILE_GOAL       = 2;
const TILE_ICE        = 3;
const TILE_CHECKPOINT = 4;
const TILE_KILL       = 5;
const TILE_TELEPORT   = 6;
const TILE_TRIGGER    = 7;

const KEY_COLORS = ['#e8c200','#e03030','#2244cc','#20aa40','#cc44cc','#cc7700'];

const COLOR = {
  bg_light:   '#c8d8f0',
  bg_dark:    '#b0c0e0',
  wall:       '#1a1a2e',
  goal:       '#28a845',
  player:     '#e03030',
  coin:       '#f0c020',
  coin_bd:    '#b08010',
  enemy:      '#1a3acc',
  enemy_bd:   '#0d1e88',
  orbit:      '#aa22ee',
  orbit_bd:   '#660099',
  follower:   '#cc2200',
  follower_bd:'#881400',
  sel_ring:   '#ff6600',
  path_line:  'rgba(255,120,0,0.8)',
  grid_line:  'rgba(100,120,180,0.18)',
  spawn_mark: 'rgba(220,50,50,0.2)',
  ice:        '#a0e0ff',
  ice_bd:     '#60b0e0',
  checkpoint: '#ff8c00',
  checkpoint_bd: '#cc6600',
  checkpoint_done: '#999',
  teleport:   '#cc44ff',
  teleport_bd:'#8800cc',
  trigger:    '#ff9900',
  trigger_bd: '#cc6600',
};

// -------------------------------------------------------
// MULTI-LEVEL STATE
// -------------------------------------------------------
let levelCollection = [];
let currentLevelIdx = 0;
let nextLevelId     = 1;

function getCurrentLevel() {
  if (_onlineTempLevel) return _onlineTempLevel;
  return levelCollection[currentLevelIdx];
}

function blankLevelData(name) {
  const cols = 28, rows = 18;
  const g = [];
  for (let r = 0; r < rows; r++) g[r] = new Array(cols).fill(TILE_EMPTY);
  return {
    id: nextLevelId++,
    name: name || ('Level ' + nextLevelId),
    COLS: cols, ROWS: rows,
    grid: g,
    playerSpawn: { gx: 2, gy: Math.floor(rows / 2) },
    coins: [], enemies: [], keys: [], doors: [],
    timeLimit: 0,
    playerSpeed: 120,
    cameraMode: 'fixed',
    cameraZoom: 2,
    killOpacities: {},
    idCounter: 0,
    outerWalls: {},
    teleportLinks: {},
    triggerLinks: {},   // "c,r" -> [enemyId, ...]
    triggerActions: {}, // "c,r" -> "start"|"stop" (default: start)
  };
}

function saveCurrentEditorState() {
  if (_onlineTempLevel) return; // never overwrite editor levels while playing online
  const lv = levelCollection[currentLevelIdx];
  if (!lv) return;
  lv.COLS = COLS; lv.ROWS = ROWS;
  lv.grid        = JSON.parse(JSON.stringify(grid));
  lv.playerSpawn = { ...playerSpawn };
  lv.coins       = JSON.parse(JSON.stringify(coins));
  lv.enemies     = JSON.parse(JSON.stringify(enemies));
  lv.keys        = JSON.parse(JSON.stringify(keys));
  lv.doors       = JSON.parse(JSON.stringify(doors));
  lv.wallColors    = { ...wallColors };
  lv.killOpacities = { ...killOpacities };
  lv.outerWalls    = { ...outerWalls };
  lv.teleportLinks = { ...teleportLinks };
  lv.triggerLinks  = JSON.parse(JSON.stringify(triggerLinks));
  lv.triggerActions = JSON.parse(JSON.stringify(triggerActions));
  lv.timeLimit   = currentTimeLimit;
  lv.playerSpeed = currentPlayerSpeed;
  lv.cameraMode  = currentCameraMode;
  lv.cameraZoom  = currentCameraZoom;
  lv.name        = document.getElementById('current-level-name-input').value.trim() || lv.name;
  lv.idCounter   = idCounter;
}

function loadLevelIntoEditor(lv) {
  COLS = lv.COLS || 28; ROWS = lv.ROWS || 18;
  grid        = JSON.parse(JSON.stringify(lv.grid));
  playerSpawn = { ...lv.playerSpawn };
  coins       = JSON.parse(JSON.stringify(lv.coins   || []));
  enemies     = JSON.parse(JSON.stringify(lv.enemies || []));
  keys        = JSON.parse(JSON.stringify(lv.keys    || []));
  doors       = JSON.parse(JSON.stringify(lv.doors   || []));
  wallColors    = JSON.parse(JSON.stringify(lv.wallColors    || {}));
  killOpacities = JSON.parse(JSON.stringify(lv.killOpacities || {}));
  outerWalls    = JSON.parse(JSON.stringify(lv.outerWalls    || {}));
  teleportLinks = JSON.parse(JSON.stringify(lv.teleportLinks || {}));
  triggerLinks  = JSON.parse(JSON.stringify(lv.triggerLinks  || {}));
  triggerActions = JSON.parse(JSON.stringify(lv.triggerActions || {}));
  currentTimeLimit   = lv.timeLimit   || 0;
  currentPlayerSpeed = lv.playerSpeed || 120;
  currentCameraMode  = lv.cameraMode  || 'fixed';
  currentCameraZoom  = lv.cameraZoom  || 2;
  idCounter   = lv.idCounter || 0;

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] === undefined) grid[r][c] = TILE_EMPTY;

  // Clamp any unknown tile values (valid: 0-7)
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid[r][c] < 0 || grid[r][c] > 7) grid[r][c] = TILE_EMPTY;

  document.getElementById('current-level-name-input').value = lv.name || '';
  selectedId = null; selectedType = null;
  undoStack = [];

  updateTimeLimitUI();
  updateSpeedUI();
  updateCameraUI();
  resizeCanvas();
  refreshContextPanel();
  drawEditor();
  updateSizeStatus();
}

function normalizeLevelData(data) {
  return {
    id: nextLevelId++,
    name: data.name || 'Imported Level',
    COLS: data.COLS || 28,
    ROWS: data.ROWS || 18,
    grid: data.grid || [],
    playerSpawn: data.playerSpawn || { gx:2, gy:9 },
    wallColors: data.wallColors || {},
    killOpacities: data.killOpacities || {},
    outerWalls: data.outerWalls || {},
    teleportLinks: data.teleportLinks || {},
    triggerLinks: data.triggerLinks || {},
    triggerActions: data.triggerActions || {},
    coins: data.coins || [],
    enemies: (data.enemies || []).map(en => {
      const base = {
        keyframes:[], phase:0, forward:true, duration:3, loopMode:false,
        cx:0, cy:0, radius:3*TILE, orbitDuration:4, startAngle:0, clockwise:true, type:'linear',
        followerSpeed:80, followerDrift:4, followerRange:0,
        ...en,
      };
      // Migrate legacy single triggerId -> triggerIds array
      if (base.triggerId && !base.triggerIds) {
        base.triggerIds = [base.triggerId];
      }
      if (!base.triggerIds) base.triggerIds = [];
      delete base.triggerId;
      return base;
    }),
    keys:  data.keys  || [],
    doors: data.doors || [],
    timeLimit: data.timeLimit || 0,
    playerSpeed: data.playerSpeed || 120,
    cameraMode: data.cameraMode || 'fixed',
    cameraZoom: data.cameraZoom || 2,
    idCounter: data.idCounter || 0,
  };
}

// -------------------------------------------------------
// EDITOR STATE
// -------------------------------------------------------
let COLS = 28, ROWS = 18;
let grid        = [];
let playerSpawn = { gx: 2, gy: 9 };
let coins       = [], enemies = [], keys = [], doors = [];
let wallColors    = {};  // "c,r" -> hex color string
let killOpacities = {};  // "c,r" -> 0.0–1.0 (default 1 = opaque)
let outerWalls    = {};  // kept for compat but unused visually
let teleportLinks = {};  // "c,r" -> "c2,r2" bidirectional pairs
let triggerLinks  = {};  // "c,r" -> [enemyId, ...]
let triggerActions = {}; // "c,r" -> "start"|"stop"
let currentWallColor = '#1a1a2e';  // active wall painting color
let idCounter   = 0;
let currentTimeLimit   = 0;
let currentPlayerSpeed = 120;
let currentCameraMode  = 'fixed'; // 'fixed' | 'follow'
let currentCameraZoom  = 2;       // zoom scale in follow mode (1–10)
let selectedKillTiles  = new Set(); // for multi-select via rect

// -------------------------------------------------------
// AUTO-SAVE (localStorage)
// -------------------------------------------------------
const LS_KEY = 'dodgefield-autosave';
let autoSaveTimer = null;
function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(autoSave, 800);
}
function autoSave() {
  try {
    saveCurrentEditorState();
    const data = { version: 6, levels: levelCollection, nextLevelId, currentLevelIdx };
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    const ind = document.getElementById('autosave-indicator');
    if (ind) { ind.textContent = '✓ Saved'; ind.classList.add('show'); setTimeout(()=>ind.classList.remove('show'), 1500); }
  } catch(e) { /* storage full */ }
}
function autoLoad() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data.levels || !data.levels.length) return false;
    levelCollection = data.levels.map(normalizeLevelData);
    nextLevelId = data.nextLevelId || levelCollection.length + 1;
    currentLevelIdx = Math.min(data.currentLevelIdx || 0, levelCollection.length - 1);
    return true;
  } catch(e) { return false; }
}

let selectedId   = null;
let selectedType = null;
let editorClipboard = null; // { type, data, offsetGx, offsetGy } for copy/paste
let currentTool  = 'wall';
let _onlineTempLevel = null;  // temp online level — never persisted to collection

// -------------------------------------------------------
// SETTINGS
// -------------------------------------------------------
const SETTINGS_KEY = 'dodgefield-settings';
let appSettings = { joystick: false, mobileControls: false, hcontrast: false, playgrid: false, confirmclear: true };
function loadSettings() {
  try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}'); Object.assign(appSettings, s); } catch(e) {}
}
function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(appSettings));
}
let joystickEnabled = false; // kept in sync with appSettings.joystick

let pathMode = false, pathModeState = 0, pathTemp = null, pathAddKf = false;
let centerMode = false;
let linkDoorMode = false, linkDoorKeyId = null;
let teleportLinkMode = false, teleportLinkSrc = null;
let triggerLinkMode = false, triggerLinkEnemyId = null;
let undoStack = [];
const MAX_UNDO = 60;

let playMode = false;

const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');

// -------------------------------------------------------
// PLAY STATE
// -------------------------------------------------------
let player        = null;
let playerVx      = 0, playerVy = 0;
let playerOnIce   = false;   // true while standing on ice
let iceLockedVx   = 0, iceLockedVy = 0;  // the velocity locked at the moment of ice entry
let playerDying   = false;
let deathCooldown = 0;
let playCoins = [], playEnemies = [], playDoors = [], playKeys = [];
let deaths = 0, keysDown = {};
let collectedKeyIds = new Set();
let animFrameId = null, lastTime = 0;
let playTimer = 0;
let checkpointPos = null;

// -------------------------------------------------------
// HELPERS
// -------------------------------------------------------
function newId() { return ++idCounter; }
function initGrid() {
  grid = [];
  for (let r = 0; r < ROWS; r++) grid[r] = new Array(COLS).fill(TILE_EMPTY);
}
function tileCenter(gx, gy) { return { px: gx*TILE + TILE/2, py: gy*TILE + TILE/2 }; }
function inBounds(gx, gy)   { return gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS; }
function mouseToPixel(e) {
  const rect = canvas.getBoundingClientRect(), s = canvas._scale;
  return { px: (e.clientX - rect.left) / s, py: (e.clientY - rect.top) / s };
}
function pixelToGrid(px, py) { return { gx: Math.floor(px/TILE), gy: Math.floor(py/TILE) }; }
function formatTime(s) {
  const m = Math.floor(s/60), sec = Math.floor(s%60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}
function setStatus(msg) {
  const el = document.getElementById('status-msg'); el.textContent = msg;
  setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3000);
}
function updateSizeStatus() {
  document.getElementById('status-size').textContent = `${COLS}×${ROWS}`;
}
function isDoorAt(gx, gy) { return doors.some(d => d.gx===gx && d.gy===gy); }
function doorAt(gx, gy)   { return doors.find(d => d.gx===gx && d.gy===gy); }

// -------------------------------------------------------
// CANVAS SIZING
// -------------------------------------------------------
function resizeCanvas() {
  const area = document.getElementById('canvas-area');
  const maxW = area.clientWidth  - 16;
  const maxH = area.clientHeight - 16;
  const scale = Math.min(maxW / (COLS*TILE), maxH / (ROWS*TILE), 1.8);
  canvas.width  = Math.floor(COLS*TILE*scale);
  canvas.height = Math.floor(ROWS*TILE*scale);
  canvas._scale = scale;
  canvas._outerOffset = 0;
}
window.addEventListener('resize', () => { resizeCanvas(); playMode ? drawPlay() : drawEditor(); });

// -------------------------------------------------------
// UNDO
// -------------------------------------------------------
function snapshot() {
  undoStack.push(JSON.stringify({ grid, coins, enemies, keys, doors, playerSpawn, COLS, ROWS, outerWalls, teleportLinks, triggerLinks, triggerActions, wallColors, killOpacities }));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}
function undo() {
  if (!undoStack.length) { setStatus('Nothing to undo.'); return; }
  const s = JSON.parse(undoStack.pop());
  grid = s.grid; coins = s.coins; enemies = s.enemies;
  keys = s.keys||[]; doors = s.doors||[];
  playerSpawn = s.playerSpawn;
  outerWalls    = s.outerWalls    || {};
  teleportLinks = s.teleportLinks || {};
  triggerLinks  = s.triggerLinks  || {};
  triggerActions = s.triggerActions || {};
  wallColors    = s.wallColors    || {};
  killOpacities = s.killOpacities || {};
  if (s.COLS && s.ROWS) { COLS = s.COLS; ROWS = s.ROWS; }
  selectedId = null; selectedType = null;
  resizeCanvas(); refreshContextPanel(); drawEditor(); updateSizeStatus();
  setStatus('Undo applied.');
}

// -------------------------------------------------------
// FLOOD FILL
// -------------------------------------------------------
function floodFill(gx, gy, targetTile) {
  const startTile = grid[gy][gx];
  if (startTile === targetTile) return;
  snapshot();
  const queue=[{gx,gy}], visited=new Set();
  while (queue.length) {
    const {gx:cx, gy:cy} = queue.shift(), k = cx+','+cy;
    if (visited.has(k) || !inBounds(cx,cy)) continue;
    if (grid[cy][cx] !== startTile) continue;
    visited.add(k); grid[cy][cx] = targetTile;
    if (targetTile === TILE_WALL) {
      if (currentWallColor !== COLOR.wall) wallColors[k] = currentWallColor;
      else delete wallColors[k];
    } else {
      delete wallColors[k];
    }
    if (targetTile !== TILE_EMPTY) {
      coins = coins.filter(c => !(c.gx===cx && c.gy===cy));
      keys  = keys.filter(k => !(k.gx===cx && k.gy===cy));
    }
    queue.push({gx:cx-1,gy:cy},{gx:cx+1,gy:cy},{gx:cx,gy:cy-1},{gx:cx,gy:cy+1});
  }
  scheduleAutoSave(); drawEditor();
}

// -------------------------------------------------------
// PATH HELPERS
// -------------------------------------------------------
function getWaypoints(en) {
  const wps = [{px:en.x1,py:en.y1}];
  for (const kf of (en.keyframes||[])) wps.push({px:kf.px,py:kf.py});
  wps.push({px:en.x2,py:en.y2}); return wps;
}
function totalPathLength(en) {
  const wps=getWaypoints(en); let len=0;
  for (let i=1;i<wps.length;i++) len+=Math.hypot(wps[i].px-wps[i-1].px, wps[i].py-wps[i-1].py);
  return len;
}
function positionAlongPath(en, t) {
  const wps=getWaypoints(en), total=totalPathLength(en);
  if (total<1) return {px:en.x1,py:en.y1};
  let dist=t*total;
  for (let i=1;i<wps.length;i++) {
    const seg=Math.hypot(wps[i].px-wps[i-1].px, wps[i].py-wps[i-1].py);
    if (dist<=seg || i===wps.length-1) {
      const f=seg>0?Math.min(dist/seg,1):0;
      return {px:wps[i-1].px+(wps[i].px-wps[i-1].px)*f, py:wps[i-1].py+(wps[i].py-wps[i-1].py)*f};
    }
    dist-=seg;
  }
  return {px:en.x2,py:en.y2};
}

// -------------------------------------------------------
// DRAWING — EDITOR
// -------------------------------------------------------
function drawEditor() {
  if (!grid || !grid.length || !grid[0]) return;
  const s = canvas._scale; ctx.save(); ctx.scale(s,s);

  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    const t=grid[r][c];
    ctx.fillStyle = (r+c)%2===0 ? COLOR.bg_light : COLOR.bg_dark;
    ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
    if      (t===TILE_WALL)       drawWallTile(c,r);
    else if (t===TILE_GOAL)       drawGoalTile(c,r);
    else if (t===TILE_ICE)        drawIceTile(c,r);
    else if (t===TILE_CHECKPOINT) drawCheckpointTile(c,r,false);
    else if (t===TILE_KILL) {
      drawKillTile(c,r,true); // always visible in editor
      const tk=c+','+r;
      // Editor-only outline: always show a subtle red dashed border so kill tiles are identifiable
      const op = killOpacities[tk] ?? 1;
      if (op < 0.5) {
        ctx.save(); ctx.globalAlpha=0.6;
        ctx.strokeStyle='#cc1111'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
        ctx.strokeRect(c*TILE+0.5,r*TILE+0.5,TILE-1,TILE-1); ctx.setLineDash([]);
        ctx.restore();
      }
      if ((selectedType==='kill'&&selectedId===tk)||selectedKillTiles.has(tk)) {
        ctx.save(); ctx.globalAlpha=1;
        ctx.strokeStyle='#ff6600'; ctx.lineWidth=2.5; ctx.setLineDash([4,3]);
        ctx.strokeRect(c*TILE+1.5,r*TILE+1.5,TILE-3,TILE-3); ctx.setLineDash([]);
        ctx.restore();
      }
    }
    else if (t===TILE_TELEPORT)   drawTeleportTile(c,r);
    else if (t===TILE_TRIGGER)    drawTriggerTile(c,r);
  }
  for (const door of doors)
    drawDoorTile(door.gx, door.gy, door.keyId, door.id===selectedId && selectedType==='door');

  // Draw teleport link lines
  const drawnLinks=new Set();
  for (const [key,dest] of Object.entries(teleportLinks)) {
    const lid=[key,dest].sort().join('|');
    if (drawnLinks.has(lid)) continue; drawnLinks.add(lid);
    const [c1,r1]=key.split(',').map(Number), [c2,r2]=dest.split(',').map(Number);
    ctx.save();
    ctx.strokeStyle=COLOR.teleport; ctx.lineWidth=1.5; ctx.setLineDash([4,3]); ctx.globalAlpha=0.7;
    ctx.beginPath(); ctx.moveTo(c1*TILE+TILE/2,r1*TILE+TILE/2); ctx.lineTo(c2*TILE+TILE/2,r2*TILE+TILE/2); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }

  // Draw trigger-enemy link lines
  for (const [tKey, eids] of Object.entries(triggerLinks)) {
    const [tc,tr]=tKey.split(',').map(Number);
    if (!inBounds(tc,tr)||grid[tr][tc]!==TILE_TRIGGER) continue;
    const tx=tc*TILE+TILE/2, ty=tr*TILE+TILE/2;
    (eids||[]).forEach(eid=>{
      const en=enemies.find(e=>e.id===eid); if (!en) return;
      let ex,ey;
      if (en.type==='orbit'){ex=en.cx;ey=en.cy;}
      else if (en.type==='follower'){const tc2=tileCenter(en.gx||0,en.gy||0);ex=tc2.px;ey=tc2.py;}
      else{ex=en.x1||0;ey=en.y1||0;}
      ctx.save();
      ctx.strokeStyle=COLOR.trigger; ctx.lineWidth=1.5; ctx.setLineDash([4,3]); ctx.globalAlpha=0.65;
      ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(ex,ey); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    });
  }

  // Draw follower range circles for all followers (always visible in editor)
  for (const en of enemies) {
    if (en.type==='follower' && (en.followerRange||0)>0) {
      const tc2=tileCenter(en.gx||0,en.gy||0);
      const isSel=(en.id===selectedId&&selectedType==='enemy');
      ctx.save();
      ctx.globalAlpha=isSel?0.3:0.12;
      ctx.beginPath(); ctx.arc(tc2.px,tc2.py,en.followerRange,0,Math.PI*2);
      ctx.strokeStyle=COLOR.follower; ctx.lineWidth=isSel?2:1; ctx.setLineDash([6,4]); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
  }

  // Grid lines
  ctx.strokeStyle=COLOR.grid_line; ctx.lineWidth=0.5;
  for (let r=0;r<=ROWS;r++) { ctx.beginPath();ctx.moveTo(0,r*TILE);ctx.lineTo(COLS*TILE,r*TILE);ctx.stroke(); }
  for (let c=0;c<=COLS;c++) { ctx.beginPath();ctx.moveTo(c*TILE,0);ctx.lineTo(c*TILE,ROWS*TILE);ctx.stroke(); }

  // Spawn
  ctx.fillStyle=COLOR.spawn_mark; ctx.fillRect(playerSpawn.gx*TILE,playerSpawn.gy*TILE,TILE,TILE);
  const sc=tileCenter(playerSpawn.gx,playerSpawn.gy); renderPlayer(sc.px,sc.py,0.7);

  for (const coin of coins) { const c=tileCenter(coin.gx,coin.gy); renderCoin(c.px,c.py); }
  for (const k of keys) { const c=tileCenter(k.gx,k.gy); renderKey(c.px,c.py,k.color,k.id===selectedId&&selectedType==='key'); }
  for (const en of enemies) drawEnemyEditor(en, en.id===selectedId&&selectedType==='enemy');

  if (pathMode&&pathModeState>=1&&pathTemp) {
    ctx.save(); ctx.globalAlpha=0.85;
    ctx.beginPath();ctx.arc(pathTemp.px,pathTemp.py,8,0,Math.PI*2);
    ctx.fillStyle='#ff6600';ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
    ctx.restore();
  }

  // Teleport link mode highlight
  if (teleportLinkMode && teleportLinkSrc) {
    const [tc,tr]=teleportLinkSrc.split(',').map(Number);
    ctx.save(); ctx.fillStyle=COLOR.teleport; ctx.globalAlpha=0.3;
    ctx.fillRect(tc*TILE,tr*TILE,TILE,TILE); ctx.restore();
  }

  // Camera follow preview: show the viewport rectangle centered on spawn
  if (currentCameraMode === 'follow') {
    const levelW = COLS * TILE, levelH = ROWS * TILE;
    const vpW = levelW / currentCameraZoom;
    const vpH = levelH / currentCameraZoom;
    const cx = tileCenter(playerSpawn.gx, playerSpawn.gy).px;
    const cy = tileCenter(playerSpawn.gx, playerSpawn.gy).py;
    // Clamp viewport like the play mode does
    let rx = cx - vpW/2;
    let ry = cy - vpH/2;
    rx = Math.max(0, Math.min(levelW - vpW, rx));
    ry = Math.max(0, Math.min(levelH - vpH, ry));
    ctx.save();
    // Semi-transparent dark outside viewport
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, 0, levelW, ry);
    ctx.fillRect(0, ry+vpH, levelW, levelH-(ry+vpH));
    ctx.fillRect(0, ry, rx, vpH);
    ctx.fillRect(rx+vpW, ry, levelW-(rx+vpW), vpH);
    // Viewport border
    ctx.strokeStyle = 'rgba(255,210,60,0.95)';
    ctx.lineWidth = 2; ctx.setLineDash([6,4]);
    ctx.strokeRect(rx, ry, vpW, vpH);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,210,60,0.95)';
    ctx.font = 'bold 10px Arial'; ctx.textAlign='left'; ctx.textBaseline='bottom';
    ctx.fillText(' CAMERA VIEW  ×' + currentCameraZoom.toFixed(1), rx+3, ry-2);
    ctx.restore();
  }

  ctx.restore();
}

function drawWallTile(c,r) {
  const col = wallColors[c+','+r] || COLOR.wall;
  ctx.fillStyle = col;
  ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(c*TILE+1, r*TILE+1, TILE-2, 4);
  ctx.fillRect(c*TILE+1, r*TILE+1, 4, TILE-2);
}
function drawKillTile(c,r,forceEditorVisible) {
  const op = killOpacities[c+','+r] ?? 1;
  ctx.save();
  // In editor mode, always show kill tiles at minimum 0.2 opacity so they're never invisible
  const displayOp = forceEditorVisible ? Math.max(op, 0.2) : op;
  ctx.globalAlpha = displayOp;
  // Dark charcoal base
  ctx.fillStyle = '#1a0808';
  ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
  // Diagonal hazard stripes
  ctx.save();
  ctx.beginPath();
  ctx.rect(c*TILE, r*TILE, TILE, TILE);
  ctx.clip();
  ctx.strokeStyle = '#cc1111';
  ctx.lineWidth = 5;
  for (let i = -TILE; i < TILE*2; i += 9) {
    ctx.beginPath();
    ctx.moveTo(c*TILE + i, r*TILE);
    ctx.lineTo(c*TILE + i + TILE, r*TILE + TILE);
    ctx.stroke();
  }
  // Dark overlay to make stripes subtle
  ctx.fillStyle = 'rgba(10,0,0,0.35)';
  ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
  ctx.restore();
  // Red border
  ctx.strokeStyle = '#cc1111';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(c*TILE+0.75, r*TILE+0.75, TILE-1.5, TILE-1.5);
  ctx.restore();
}
function drawGoalTile(c,r) {
  ctx.fillStyle=COLOR.goal; ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
  ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(c*TILE+2,r*TILE+2,TILE-4,TILE/2-2);
}
function drawIceTile(c,r) {
  ctx.fillStyle=COLOR.ice; ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
  ctx.strokeStyle=COLOR.ice_bd; ctx.lineWidth=1.5; ctx.strokeRect(c*TILE+1,r*TILE+1,TILE-2,TILE-2);
  ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fillRect(c*TILE+3,r*TILE+3,TILE/2,4);
  // snowflake hint
  ctx.fillStyle='rgba(180,230,255,0.8)'; ctx.font='bold 10px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('❄', c*TILE+TILE/2, r*TILE+TILE/2);
}
function drawCheckpointTile(c,r,activated) {
  ctx.fillStyle=activated?COLOR.checkpoint_done:COLOR.checkpoint;
  ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
  ctx.strokeStyle=activated?'#777':COLOR.checkpoint_bd;
  ctx.lineWidth=2; ctx.strokeRect(c*TILE+1,r*TILE+1,TILE-2,TILE-2);
  ctx.fillStyle='rgba(255,255,255,0.8)'; ctx.font='bold 13px Arial';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('✓', c*TILE+TILE/2, r*TILE+TILE/2);
}
function drawTeleportTile(c,r) {
  ctx.fillStyle = '#330055';
  ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
  // Outer glow border
  ctx.strokeStyle = COLOR.teleport; ctx.lineWidth = 2;
  ctx.strokeRect(c*TILE+1.5,r*TILE+1.5,TILE-3,TILE-3);
  // Inner radial glow
  ctx.save();
  const cx2=c*TILE+TILE/2, cy2=r*TILE+TILE/2;
  const grad=ctx.createRadialGradient(cx2,cy2,1,cx2,cy2,TILE/2-3);
  grad.addColorStop(0,'rgba(200,100,255,0.75)');
  grad.addColorStop(1,'rgba(80,0,160,0)');
  ctx.fillStyle=grad;
  ctx.beginPath();ctx.arc(cx2,cy2,TILE/2-3,0,Math.PI*2);ctx.fill();
  ctx.restore();
  // Portal symbol - draw a simple star/asterisk shape
  ctx.strokeStyle='rgba(240,200,255,0.92)'; ctx.lineWidth=2;
  const cx3=c*TILE+TILE/2, cy3=r*TILE+TILE/2, sr=7;
  for (let a=0;a<3;a++) {
    const ang=a*Math.PI/3;
    ctx.beginPath();
    ctx.moveTo(cx3+Math.cos(ang)*sr,cy3+Math.sin(ang)*sr);
    ctx.lineTo(cx3-Math.cos(ang)*sr,cy3-Math.sin(ang)*sr);
    ctx.stroke();
  }
  ctx.beginPath();ctx.arc(cx3,cy3,4,0,Math.PI*2);
  ctx.fillStyle='rgba(220,160,255,0.9)';ctx.fill();
}
function drawTriggerTile(c,r) {
  // Draw orange trigger block (editor-only, invisible in play)
  ctx.fillStyle = '#3a1a00';
  ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
  // diagonal warning stripes
  ctx.save();
  ctx.beginPath(); ctx.rect(c*TILE,r*TILE,TILE,TILE); ctx.clip();
  ctx.strokeStyle = '#ff6600'; ctx.lineWidth = 4;
  for (let i=-TILE;i<TILE*2;i+=10) {
    ctx.beginPath();
    ctx.moveTo(c*TILE+i,r*TILE);
    ctx.lineTo(c*TILE+i+TILE,r*TILE+TILE);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle='rgba(20,8,0,0.4)'; ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
  ctx.strokeStyle = COLOR.trigger; ctx.lineWidth = 2;
  ctx.strokeRect(c*TILE+1.5,r*TILE+1.5,TILE-3,TILE-3);
  // Draw a lightning bolt shape
  const tx2=c*TILE+TILE/2, ty2=r*TILE+TILE/2;
  ctx.fillStyle='rgba(255,180,60,0.9)';
  ctx.beginPath();
  ctx.moveTo(tx2+3,ty2-8);
  ctx.lineTo(tx2-2,ty2-1);
  ctx.lineTo(tx2+2,ty2-1);
  ctx.lineTo(tx2-3,ty2+8);
  ctx.lineTo(tx2+3,ty2+1);
  ctx.lineTo(tx2-1,ty2+1);
  ctx.closePath();
  ctx.fill();
  // If selected, show selection highlight
  if (selectedType==='trigger' && selectedId===c+','+r) {
    ctx.strokeStyle='#ff6600'; ctx.lineWidth=3; ctx.setLineDash([4,3]);
    ctx.strokeRect(c*TILE+2,r*TILE+2,TILE-4,TILE-4); ctx.setLineDash([]);
  }
}
function drawDoorTile(gx,gy,keyId,isSel) {
  const key=keys.find(k=>k.id===keyId), col=key?key.color:'#888';
  ctx.fillStyle=col; ctx.globalAlpha=0.8; ctx.fillRect(gx*TILE,gy*TILE,TILE,TILE); ctx.globalAlpha=1;
  ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=2; ctx.strokeRect(gx*TILE+1,gy*TILE+1,TILE-2,TILE-2);
  ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(gx*TILE+TILE-8,gy*TILE+TILE/2-3,4,6);
  if (isSel) {
    ctx.strokeStyle='#ff6600'; ctx.lineWidth=3; ctx.setLineDash([4,3]);
    ctx.strokeRect(gx*TILE+1.5,gy*TILE+1.5,TILE-3,TILE-3); ctx.setLineDash([]);
  }
}

function drawEnemyEditor(en,isSel) {
  ctx.save();
  if (en.type==='orbit') {
    ctx.globalAlpha=isSel?1:0.5;
    ctx.beginPath();ctx.arc(en.cx,en.cy,en.radius,0,Math.PI*2);
    ctx.strokeStyle='#aa22ee';ctx.lineWidth=isSel?2:1;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(en.cx,en.cy,4,0,Math.PI*2);ctx.fillStyle='#aa22ee';ctx.fill();
    const a=(en.startAngle||0)*Math.PI/180;
    const bx=en.cx+Math.cos(a)*en.radius, by=en.cy+Math.sin(a)*en.radius;
    ctx.globalAlpha=isSel?1:0.7;
    renderEnemy(bx,by,isSel,COLOR.orbit,COLOR.orbit_bd,'#cc88ff');
  } else if (en.type==='follower') {
    const tc=tileCenter(en.gx,en.gy);
    ctx.globalAlpha=isSel?1:0.65;
    // Draw range circle if range is set
    if (isSel && (en.followerRange||0)>0) {
      ctx.save(); ctx.globalAlpha=0.2;
      ctx.beginPath(); ctx.arc(tc.px,tc.py,en.followerRange,0,Math.PI*2);
      ctx.strokeStyle=COLOR.follower; ctx.lineWidth=1.5; ctx.setLineDash([4,3]); ctx.stroke();
      ctx.setLineDash([]); ctx.restore();
    }
    ctx.save();ctx.globalAlpha=isSel?0.5:0.25;
    ctx.beginPath();ctx.arc(tc.px,tc.py,TILE*1.2,0,Math.PI*2);
    ctx.strokeStyle=COLOR.follower;ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.stroke();ctx.setLineDash([]);
    ctx.restore();
    ctx.globalAlpha=isSel?1:0.65;
    renderEnemy(tc.px,tc.py,isSel,COLOR.follower,COLOR.follower_bd,'#ff8866');
  } else {
    const wps=getWaypoints(en), hasPath=totalPathLength(en)>2;
    ctx.globalAlpha=isSel?0.95:0.42;
    if (hasPath) {
      ctx.beginPath();ctx.moveTo(wps[0].px,wps[0].py);
      for (let i=1;i<wps.length;i++) ctx.lineTo(wps[i].px,wps[i].py);
      if (en.loopMode) ctx.closePath();
      ctx.strokeStyle=COLOR.path_line;ctx.lineWidth=isSel?2.5:1.5;ctx.setLineDash([6,4]);ctx.stroke();ctx.setLineDash([]);
      ctx.globalAlpha=isSel?1:0.5;
      ctx.beginPath();ctx.arc(en.x1,en.y1,isSel?8:5,0,Math.PI*2);
      ctx.fillStyle='#ff6600';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
      if (isSel) { ctx.fillStyle='#fff';ctx.font='bold 7px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('A',en.x1,en.y1); }
      for (let i=0;i<(en.keyframes||[]).length;i++) {
        const kf=en.keyframes[i];ctx.globalAlpha=isSel?1:0.5;
        ctx.beginPath();ctx.arc(kf.px,kf.py,isSel?6:4,0,Math.PI*2);
        ctx.fillStyle='#00bbcc';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
        if (isSel) { ctx.fillStyle='#fff';ctx.font='bold 6px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(i+1,kf.px,kf.py); }
      }
      ctx.globalAlpha=isSel?1:0.5;
      ctx.beginPath();ctx.arc(en.x2,en.y2,isSel?8:5,0,Math.PI*2);
      ctx.fillStyle='#ff3399';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();
      if (isSel) { ctx.fillStyle='#fff';ctx.font='bold 7px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('B',en.x2,en.y2); }
    }
    const sp=positionAlongPath(en,en.phase||0);ctx.globalAlpha=isSel?1:0.65;
    renderEnemy(sp.px,sp.py,isSel,COLOR.enemy,COLOR.enemy_bd,'#6688ff');
  }
  ctx.restore();
}

// -------------------------------------------------------
// RENDERING HELPERS
// -------------------------------------------------------
function renderPlayer(cx,cy,alpha) {
  ctx.globalAlpha=alpha; const h=PLAYER_SIZE/2;
  ctx.fillStyle=COLOR.player; ctx.fillRect(cx-h,cy-h,PLAYER_SIZE,PLAYER_SIZE);
  ctx.strokeStyle='#801010';ctx.lineWidth=2;ctx.strokeRect(cx-h,cy-h,PLAYER_SIZE,PLAYER_SIZE);
  ctx.fillStyle='rgba(255,200,200,0.4)';ctx.fillRect(cx-h+2,cy-h+2,PLAYER_SIZE/2,4);
  ctx.globalAlpha=1;
}
function renderCoin(cx,cy) {
  ctx.beginPath();ctx.arc(cx,cy,COIN_RADIUS,0,Math.PI*2);
  ctx.fillStyle=COLOR.coin;ctx.fill();ctx.strokeStyle=COLOR.coin_bd;ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.arc(cx-2,cy-2,COIN_RADIUS/2.5,0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,200,0.6)';ctx.fill();
}
function renderEnemy(cx,cy,selected,col,bd,shine) {
  if (selected) {
    ctx.beginPath();ctx.arc(cx,cy,ENEMY_RADIUS+5,0,Math.PI*2);
    ctx.strokeStyle=COLOR.sel_ring;ctx.lineWidth=3;ctx.stroke();
  }
  ctx.beginPath();ctx.arc(cx+2,cy+2,ENEMY_RADIUS,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,0.2)';ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy,ENEMY_RADIUS,0,Math.PI*2);
  const g=ctx.createRadialGradient(cx-3,cy-3,2,cx,cy,ENEMY_RADIUS);
  g.addColorStop(0,shine);g.addColorStop(1,col);
  ctx.fillStyle=g;ctx.fill();ctx.strokeStyle=bd;ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.arc(cx-4,cy-4,3,0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,0.6)';ctx.fill();
}
function renderKey(cx,cy,color,selected) {
  ctx.save();ctx.translate(cx,cy);
  if (selected) {
    ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);
    ctx.strokeStyle=COLOR.sel_ring;ctx.lineWidth=2.5;ctx.stroke();
  }
  ctx.beginPath();ctx.arc(-3,0,7,0,Math.PI*2);
  ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='rgba(0,0,0,0.4)';ctx.lineWidth=2;ctx.stroke();
  ctx.beginPath();ctx.arc(-3,0,3.5,0,Math.PI*2);ctx.fillStyle='rgba(0,0,0,0.28)';ctx.fill();
  ctx.fillStyle=color;
  ctx.fillRect(4,-2.5,9,5);ctx.fillRect(8,2.5,3,3);ctx.fillRect(11,2.5,2,2);
  ctx.restore();
}

// -------------------------------------------------------
// DRAWING — PLAY MODE
// -------------------------------------------------------
function drawPlay() {
  const s = canvas._scale;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();

  if (currentCameraMode === 'follow' && player) {
    const zoom = currentCameraZoom;
    const s = canvas._scale;
    // Viewport size in logical (unscaled) pixels
    const vpW = (COLS * TILE) / zoom;
    const vpH = (ROWS * TILE) / zoom;
    // Center on player, clamped so we don't show outside the level
    let camX = player.x - vpW / 2;
    let camY = player.y - vpH / 2;
    camX = Math.max(0, Math.min(COLS * TILE - vpW, camX));
    camY = Math.max(0, Math.min(ROWS * TILE - vpH, camY));
    // Scale so the viewport fills the entire canvas
    ctx.scale(s * zoom, s * zoom);
    ctx.translate(-camX, -camY);
  } else {
    ctx.scale(s, s);
  }

  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    const t=grid[r][c];
    ctx.fillStyle=(r+c)%2===0?COLOR.bg_light:COLOR.bg_dark;
    ctx.fillRect(c*TILE,r*TILE,TILE,TILE);
    if      (t===TILE_WALL)       drawWallTile(c,r);
    else if (t===TILE_GOAL)       drawGoalTile(c,r);
    else if (t===TILE_ICE)        drawIceTile(c,r);
    else if (t===TILE_KILL)       drawKillTile(c,r);
    else if (t===TILE_TELEPORT)   drawTeleportTile(c,r);
    else if (t===TILE_CHECKPOINT) {
      const activated = checkpointPos && checkpointPos.gx===c && checkpointPos.gy===r;
      drawCheckpointTile(c,r,activated);
    }
  }
  for (const d of playDoors) if (!d.open) {
    const key=keys.find(k=>k.id===d.keyId), col=key?key.color:'#888';
    ctx.fillStyle=col;ctx.globalAlpha=0.85;ctx.fillRect(d.gx*TILE,d.gy*TILE,TILE,TILE);ctx.globalAlpha=1;
    ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=2;ctx.strokeRect(d.gx*TILE+1,d.gy*TILE+1,TILE-2,TILE-2);
    ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillRect(d.gx*TILE+TILE-8,d.gy*TILE+TILE/2-3,4,6);
  }
  for (const coin of playCoins) { const c=tileCenter(coin.gx,coin.gy);renderCoin(c.px,c.py); }
  for (const k of playKeys) if (!k.collected) renderKey(k.px,k.py,k.color,false);
  for (const en of playEnemies) {
    if (en.type==='orbit')    renderEnemy(en.px,en.py,false,COLOR.orbit,COLOR.orbit_bd,'#cc88ff');
    else if (en.type==='follower') {
      if ((en.followerRange||0)>0) {
        ctx.save(); ctx.globalAlpha=0.15;
        ctx.beginPath(); ctx.arc(en.px,en.py,en.followerRange,0,Math.PI*2);
        ctx.strokeStyle=COLOR.follower; ctx.lineWidth=1.5; ctx.setLineDash([5,4]); ctx.stroke();
        ctx.setLineDash([]); ctx.restore();
      }
      renderEnemy(en.px,en.py,false,COLOR.follower,COLOR.follower_bd,'#ff8866');
    }
    else renderEnemy(en.px,en.py,false,COLOR.enemy,COLOR.enemy_bd,'#6688ff');
  }
  if (player && !playerDying) {
    const alpha = deathCooldown>0 ? (Math.sin(deathCooldown*18)*0.5+0.5) : 1;
    renderPlayer(player.x,player.y,alpha);
  }
  // Draw level border outline so you can see level edges when zoomed
  if (currentCameraMode === 'follow') {
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, COLS*TILE, ROWS*TILE);
    ctx.restore();
  }
  ctx.restore();
}

// -------------------------------------------------------
// MOUSE — EDITOR
// -------------------------------------------------------
let isMouseDown=false, lastTileKey=null;
let rectMode=false, rectStart=null;  // double-click area fill/erase

canvas.addEventListener('dblclick', e => {
  if (playMode) return;
  if (pathMode||centerMode||linkDoorMode||teleportLinkMode) return;
  if (currentTool!=='wall'&&currentTool!=='erase'&&currentTool!=='select'&&TOOL_TO_TILE[currentTool]===undefined) return;
  const {px,py}=mouseToPixel(e), gx=Math.floor(px/TILE), gy=Math.floor(py/TILE);
  if (!inBounds(gx,gy)) return;
  rectMode=true; rectStart={gx,gy}; isMouseDown=true; lastTileKey=null;
});

// Drag-to-move state for select tool
let selectDragActive = false;
let selectDragId = null;
let selectDragType = null;
let selectDragStartPx = null;
let selectDragStartPy = null;
let selectDragOrigData = null;

canvas.addEventListener('mousedown', e => {
  if (playMode) return;
  if (centerMode)        { handleCenterClick(e); return; }
  if (pathMode)          { handlePathClick(e); return; }
  if (linkDoorMode)      { handleLinkDoorClick(e); return; }
  if (teleportLinkMode)  { handleTeleportLinkClick(e); return; }
  if (triggerLinkMode)   { handleTriggerLinkClick(e); return; }
  isMouseDown=true; lastTileKey=null;
  // Check if we're clicking on the selected object to start a drag
  if (currentTool==='select' && selectedId!=null) {
    const {px,py}=mouseToPixel(e);
    let hitSelected=false;
    if (selectedType==='enemy') {
      const en=enemies.find(x=>x.id===selectedId);
      if (en) {
        let bx,by;
        if (en.type==='orbit'){const a=(en.startAngle||0)*Math.PI/180;bx=en.cx+Math.cos(a)*en.radius;by=en.cy+Math.sin(a)*en.radius;}
        else if (en.type==='follower'){const tc=tileCenter(en.gx,en.gy);bx=tc.px;by=tc.py;}
        else{const sp=positionAlongPath(en,en.phase||0);bx=sp.px;by=sp.py;}
        if (Math.hypot(bx-px,by-py)<=ENEMY_RADIUS+10) hitSelected=true;
      }
    } else if (selectedType==='key') {
      const k=keys.find(x=>x.id===selectedId);
      if (k){const c=tileCenter(k.gx,k.gy);if(Math.hypot(c.px-px,c.py-py)<=TILE/2+4)hitSelected=true;}
    }
    if (hitSelected) {
      selectDragActive=true; selectDragId=selectedId; selectDragType=selectedType;
      selectDragStartPx=px; selectDragStartPy=py;
      // Store original data for moving
      if (selectedType==='enemy') {
        const en=enemies.find(x=>x.id===selectedId);
        selectDragOrigData=JSON.parse(JSON.stringify(en));
      } else if (selectedType==='key') {
        const k=keys.find(x=>x.id===selectedId);
        selectDragOrigData={...k};
      }
      snapshot();
      return;
    }
  }
  handleEditorClick(e,true);
});
canvas.addEventListener('mousemove', e => {
  if (playMode) return;
  const {px,py}=mouseToPixel(e), gx=Math.floor(px/TILE), gy=Math.floor(py/TILE);
  if (inBounds(gx,gy)) document.getElementById('status-grid').textContent=`${gx}, ${gy}`;
  // Handle drag-move of selected object
  if (selectDragActive && selectDragOrigData) {
    const dx=px-selectDragStartPx, dy=py-selectDragStartPy;
    if (selectDragType==='enemy') {
      const en=enemies.find(x=>x.id===selectDragId);
      if (en) {
        const orig=selectDragOrigData;
        const snapGx=Math.round(((orig.x1||0)+dx)/TILE-0.5), snapGy=Math.round(((orig.y1||0)+dy)/TILE-0.5);
        const clampGx=Math.max(0,Math.min(COLS-1,snapGx)), clampGy=Math.max(0,Math.min(ROWS-1,snapGy));
        const actualDx=(clampGx-((orig.gx||0)))*TILE, actualDy=(clampGy-((orig.gy||0)))*TILE;
        en.gx=clampGx; en.gy=clampGy;
        en.x1=(orig.x1||0)+actualDx; en.y1=(orig.y1||0)+actualDy;
        en.x2=(orig.x2||0)+actualDx; en.y2=(orig.y2||0)+actualDy;
        if (orig.cx!==undefined) en.cx=orig.cx+actualDx;
        if (orig.cy!==undefined) en.cy=orig.cy+actualDy;
        if (orig.keyframes) en.keyframes=orig.keyframes.map(kf=>({...kf,px:kf.px+actualDx,py:kf.py+actualDy}));
        drawEditor();
      }
    } else if (selectDragType==='key') {
      const k=keys.find(x=>x.id===selectDragId);
      if (k) {
        const ngx=Math.max(0,Math.min(COLS-1,Math.round(((selectDragOrigData.gx*TILE+TILE/2)+dx)/TILE-0.5)));
        const ngy=Math.max(0,Math.min(ROWS-1,Math.round(((selectDragOrigData.gy*TILE+TILE/2)+dy)/TILE-0.5)));
        k.gx=ngx; k.gy=ngy;
        drawEditor();
      }
    }
    return;
  }
  if (rectMode && isMouseDown && rectStart) {
    drawEditor();
    if (inBounds(gx,gy)) {
      const s=canvas._scale; ctx.save(); ctx.scale(s,s);
      const x1=Math.min(rectStart.gx,gx)*TILE, y1=Math.min(rectStart.gy,gy)*TILE;
      const w=(Math.abs(gx-rectStart.gx)+1)*TILE, h=(Math.abs(gy-rectStart.gy)+1)*TILE;
      ctx.fillStyle=currentTool==='erase'?'rgba(255,80,80,0.25)':currentTool==='select'?'rgba(80,200,120,0.2)':'rgba(100,160,255,0.3)';
      ctx.fillRect(x1,y1,w,h);
      ctx.strokeStyle=currentTool==='erase'?'#ff4040':currentTool==='select'?'#40cc80':'#4488ff';
      ctx.lineWidth=2; ctx.setLineDash([4,3]);
      ctx.strokeRect(x1,y1,w,h); ctx.setLineDash([]);
      ctx.restore();
    }
    return;
  }
  if (pathMode) {
    drawEditor();
    if (pathTemp && inBounds(gx,gy)) {
      const s=canvas._scale; ctx.save();ctx.scale(s,s);
      const tc=tileCenter(gx,gy);
      ctx.beginPath();ctx.moveTo(pathTemp.px,pathTemp.py);ctx.lineTo(tc.px,tc.py);
      ctx.strokeStyle=COLOR.path_line;ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.globalAlpha=0.7;ctx.stroke();ctx.setLineDash([]);
      ctx.beginPath();ctx.arc(tc.px,tc.py,6,0,Math.PI*2);ctx.fillStyle='#ff3399';ctx.globalAlpha=0.85;ctx.fill();
      ctx.restore();
    }
    return;
  }
  if (!isMouseDown) return;
  if (!rectMode) handleEditorClick(e,false);
});
canvas.addEventListener('mouseup', e => {
  if (selectDragActive) {
    selectDragActive=false; selectDragId=null; selectDragType=null;
    selectDragStartPx=null; selectDragStartPy=null; selectDragOrigData=null;
    refreshContextPanel(); drawEditor();
    isMouseDown=false; return;
  }
  if (rectMode && rectStart) {
    const {px,py}=mouseToPixel(e);
    const gx=Math.floor(px/TILE), gy=Math.floor(py/TILE);
    applyRectFill(rectStart.gx,rectStart.gy,gx,gy);
  }
  rectMode=false; rectStart=null;
  isMouseDown=false; lastTileKey=null;
});
canvas.addEventListener('mouseleave', () => {
  if (selectDragActive) {
    selectDragActive=false; selectDragId=null; selectDragType=null;
    selectDragStartPx=null; selectDragStartPy=null; selectDragOrigData=null;
  }
  if (rectMode) { rectMode=false; rectStart=null; drawEditor(); }
  isMouseDown=false; lastTileKey=null;
});

function applyRectFill(gx1,gy1,gx2,gy2) {
  const x1=Math.max(0,Math.min(COLS-1,Math.min(gx1,gx2)));
  const y1=Math.max(0,Math.min(ROWS-1,Math.min(gy1,gy2)));
  const x2=Math.max(0,Math.min(COLS-1,Math.max(gx1,gx2)));
  const y2=Math.max(0,Math.min(ROWS-1,Math.max(gy1,gy2)));

  if (currentTool==='select') {
    // Multi-select all kill tiles in the rect
    selectedKillTiles.clear();
    for (let r=y1;r<=y2;r++) for (let c=x1;c<=x2;c++) {
      if (grid[r][c]===TILE_KILL) selectedKillTiles.add(c+','+r);
    }
    if (selectedKillTiles.size>0) {
      selectedId=[...selectedKillTiles][0]; selectedType='kill';
    } else {
      selectedId=null; selectedType=null;
    }
    refreshContextPanel(); drawEditor();
    return;
  }

  snapshot();
  for (let r=y1;r<=y2;r++) for (let c=x1;c<=x2;c++) {
    const tk=c+','+r;
    if (currentTool==='erase') {
      if (grid[r][c]===TILE_TELEPORT) removeTeleportLink(tk);
      if (grid[r][c]===TILE_TRIGGER) removeTrigger(tk);
      grid[r][c]=TILE_EMPTY;
      doors=doors.filter(d=>!(d.gx===c&&d.gy===r));
      delete wallColors[tk]; delete killOpacities[tk]; removePlaceables(c,r);
    } else if (TOOL_TO_TILE[currentTool]!==undefined) {
      if (grid[r][c]===TILE_TELEPORT) removeTeleportLink(tk);
      if (grid[r][c]===TILE_TRIGGER) removeTrigger(tk);
      grid[r][c]=TOOL_TO_TILE[currentTool];
      doors=doors.filter(d=>!(d.gx===c&&d.gy===r));
      if (TOOL_TO_TILE[currentTool]===TILE_WALL) {
        removePlaceables(c,r);
        if (currentWallColor!==COLOR.wall) wallColors[tk]=currentWallColor;
        else delete wallColors[tk];
      } else { delete wallColors[tk]; }
    }
  }
  scheduleAutoSave(); drawEditor();
}

const TOOL_TO_TILE = { wall:TILE_WALL, goal:TILE_GOAL, ice:TILE_ICE, checkpoint:TILE_CHECKPOINT, kill:TILE_KILL, teleport:TILE_TELEPORT, trigger:TILE_TRIGGER };

function handleEditorClick(e, isFirst) {
  const {px,py}=mouseToPixel(e);
  const gx=Math.floor(px/TILE), gy=Math.floor(py/TILE);
  if (!inBounds(gx,gy)) return;
  const tileKey=gx+','+gy;

  if (currentTool==='fill') {
    if (!isFirst) return;
    const targetTile=TOOL_TO_TILE[document.querySelector('.tool-btn.active')?.dataset.tool]??TILE_WALL;
    floodFill(gx,gy,targetTile); return;
  }

  if (TOOL_TO_TILE[currentTool]!==undefined) {
    if (lastTileKey===tileKey) return; lastTileKey=tileKey; snapshot();
    // Remove teleport links if overwriting
    if (grid[gy][gx]===TILE_TELEPORT) removeTeleportLink(tileKey);
    if (grid[gy][gx]===TILE_TRIGGER) removeTrigger(tileKey);
    grid[gy][gx]=TOOL_TO_TILE[currentTool];
    doors=doors.filter(d=>!(d.gx===gx&&d.gy===gy));
    if (TOOL_TO_TILE[currentTool]===TILE_WALL) {
      removePlaceables(gx,gy);
      if (currentWallColor !== COLOR.wall) wallColors[tileKey] = currentWallColor;
      else delete wallColors[tileKey];
    } else { delete wallColors[tileKey]; }
    // Auto-select kill tile immediately after placing
    if (TOOL_TO_TILE[currentTool]===TILE_KILL && isFirst) {
      selectedId=tileKey; selectedType='kill'; selectedKillTiles.clear();
      scheduleAutoSave(); drawEditor(); refreshContextPanel(); return;
    }
    scheduleAutoSave(); drawEditor(); return;
  }
  if (currentTool==='erase') {
    if (lastTileKey===tileKey) return; lastTileKey=tileKey; snapshot();
    if (grid[gy][gx]===TILE_TELEPORT) removeTeleportLink(tileKey);
    if (grid[gy][gx]===TILE_TRIGGER) removeTrigger(tileKey);
    grid[gy][gx]=TILE_EMPTY; doors=doors.filter(d=>!(d.gx===gx&&d.gy===gy));
    delete wallColors[tileKey];
    removePlaceables(gx,gy); scheduleAutoSave(); drawEditor(); return;
  }
  if (currentTool==='player') {
    if (!isFirst) return; snapshot(); playerSpawn={gx,gy}; drawEditor(); return;
  }
  if (currentTool==='coin') {
    if (lastTileKey===tileKey) return; lastTileKey=tileKey;
    if (grid[gy][gx]===TILE_WALL||isDoorAt(gx,gy)) return;
    if (coins.some(c=>c.gx===gx&&c.gy===gy)) return;
    snapshot(); coins.push({gx,gy}); drawEditor(); return;
  }
  if (currentTool==='linear'||currentTool==='orbit'||currentTool==='follower') {
    if (!isFirst) return;
    if (grid[gy][gx]===TILE_WALL) return; snapshot();
    const tc=tileCenter(gx,gy);
    const newEn={
      id:newId(),type:currentTool,gx,gy,
      x1:tc.px,y1:tc.py,x2:tc.px,y2:tc.py,
      keyframes:[],phase:0,forward:true,duration:3,loopMode:false,
      cx:tc.px,cy:tc.py,radius:3*TILE,orbitDuration:4,startAngle:0,clockwise:true,
      followerSpeed:80,followerDrift:4,followerRange:0,
      triggerIds:[],
    };
    enemies.push(newEn);
    selectedId=newEn.id; selectedType='enemy';
    refreshContextPanel(); drawEditor(); return;
  }
  if (currentTool==='key') {
    if (!isFirst) return;
    if (grid[gy][gx]===TILE_WALL||isDoorAt(gx,gy)) return;
    if (keys.some(k=>k.gx===gx&&k.gy===gy)) return;
    snapshot(); keys.push({id:newId(),gx,gy,color:KEY_COLORS[0]}); drawEditor(); return;
  }
  if (currentTool==='door') {
    if (lastTileKey===tileKey) return; lastTileKey=tileKey;
    if (isDoorAt(gx,gy)) { snapshot();doors=doors.filter(d=>!(d.gx===gx&&d.gy===gy));drawEditor();return; }
    if (grid[gy][gx]===TILE_WALL||grid[gy][gx]===TILE_GOAL) return;
    snapshot(); doors.push({id:newId(),gx,gy,keyId:null}); drawEditor(); return;
  }
  if (currentTool==='select') {
    if (!isFirst) return; selectAt(px,py);
  }
}

function removeTeleportLink(key) {
  const dest=teleportLinks[key];
  if (dest) delete teleportLinks[dest];
  delete teleportLinks[key];
}

function removeTrigger(key) {
  // Remove this trigger from any enemies that reference it
  if (triggerLinks[key]) {
    triggerLinks[key].forEach(eid => {
      const en = enemies.find(e => e.id === eid);
      if (en && (en.triggerIds||[]).includes(key)) en.triggerIds=en.triggerIds.filter(id=>id!==key);
    });
  }
  delete triggerLinks[key];
}

// Teleport link mode
function enterTeleportLinkMode(srcKey) {
  teleportLinkMode=true; teleportLinkSrc=srcKey;
  canvas.classList.add('path-mode');
  setStatus('Click destination teleport tile to link.');
}
function exitTeleportLinkMode() {
  teleportLinkMode=false; teleportLinkSrc=null;
  canvas.classList.remove('path-mode');
  drawEditor();
}
function handleTeleportLinkClick(e) {
  const {px,py}=mouseToPixel(e), gx=Math.floor(px/TILE), gy=Math.floor(py/TILE);
  if (!inBounds(gx,gy)||grid[gy][gx]!==TILE_TELEPORT) { setStatus('Must click a teleport tile.'); exitTeleportLinkMode(); return; }
  const destKey=gx+','+gy;
  if (destKey===teleportLinkSrc) { setStatus('Cannot link teleport to itself.'); exitTeleportLinkMode(); return; }
  snapshot();
  teleportLinks[teleportLinkSrc]=destKey;
  teleportLinks[destKey]=teleportLinkSrc;
  setStatus('Teleports linked!');
  exitTeleportLinkMode();
  drawEditor();
}
// Trigger link mode
function getTriggerHintEl() {
  const en=enemies.find(e=>e.id===triggerLinkEnemyId||e.id===selectedId);
  if (!en) return document.getElementById('trigger-link-hint');
  if (en.type==='orbit') return document.getElementById('trigger-link-hint-orbit');
  if (en.type==='follower') return document.getElementById('trigger-link-hint-follower');
  return document.getElementById('trigger-link-hint');
}
function getLinkTriggerBtn() {
  const en=enemies.find(e=>e.id===triggerLinkEnemyId||e.id===selectedId);
  if (!en) return document.getElementById('btn-link-trigger');
  if (en.type==='orbit') return document.getElementById('btn-link-trigger-orbit');
  if (en.type==='follower') return document.getElementById('btn-link-trigger-follower');
  return document.getElementById('btn-link-trigger');
}
function enterTriggerLinkMode(enemyId) {
  triggerLinkMode=true; triggerLinkEnemyId=enemyId;
  canvas.classList.add('path-mode');
  const hint=getTriggerHintEl();
  if (hint) { hint.classList.remove('hidden'); hint.textContent='Click a trigger tile to link this enemy.'; }
  const btn=getLinkTriggerBtn();
  if (btn) btn.textContent='Cancel';
  setStatus('Click a trigger block to link this enemy.');
}
function exitTriggerLinkMode() {
  const hint=getTriggerHintEl();
  if (hint) hint.classList.add('hidden');
  const btn=getLinkTriggerBtn();
  if (btn) btn.textContent='Link to Trigger';
  triggerLinkMode=false; triggerLinkEnemyId=null;
  canvas.classList.remove('path-mode');
  drawEditor();
}
function handleTriggerLinkClick(e) {
  const {px,py}=mouseToPixel(e), gx=Math.floor(px/TILE), gy=Math.floor(py/TILE);
  if (!inBounds(gx,gy)||grid[gy][gx]!==TILE_TRIGGER) {
    setStatus('Must click a trigger block.');
    exitTriggerLinkMode(); return;
  }
  const tKey=gx+','+gy;
  const en=enemies.find(x=>x.id===triggerLinkEnemyId);
  if (en) {
    snapshot();
    if (!en.triggerIds) en.triggerIds=[];
    if (en.triggerIds.includes(tKey)) { setStatus('Already linked to that trigger.'); exitTriggerLinkMode(); return; }
    en.triggerIds.push(tKey);
    if (!triggerLinks[tKey]) triggerLinks[tKey]=[];
    if (!triggerLinks[tKey].includes(en.id)) triggerLinks[tKey].push(en.id);
    setStatus('Enemy linked to trigger!');
    refreshContextPanel();
  }
  exitTriggerLinkMode();
  drawEditor();
}

function removePlaceables(gx,gy) {
  coins=coins.filter(c=>!(c.gx===gx&&c.gy===gy));
  keys=keys.filter(k=>!(k.gx===gx&&k.gy===gy));
}

// -------------------------------------------------------
// SELECT
// -------------------------------------------------------
function selectAt(px,py) {
  for (const en of enemies) {
    let bx,by;
    if (en.type==='orbit') {
      const a=(en.startAngle||0)*Math.PI/180;
      bx=en.cx+Math.cos(a)*en.radius; by=en.cy+Math.sin(a)*en.radius;
      if (Math.hypot(en.cx-px,en.cy-py)<=8) { selectedId=en.id;selectedType='enemy';refreshContextPanel();drawEditor();return; }
    } else if (en.type==='follower') {
      const tc=tileCenter(en.gx,en.gy); bx=tc.px; by=tc.py;
    } else { const sp=positionAlongPath(en,en.phase||0);bx=sp.px;by=sp.py; }
    if (Math.hypot(bx-px,by-py)<=ENEMY_RADIUS+8) { selectedId=en.id;selectedType='enemy';refreshContextPanel();drawEditor();return; }
  }
  for (const k of keys) {
    const c=tileCenter(k.gx,k.gy);
    if (Math.hypot(c.px-px,c.py-py)<=TILE/2) { selectedId=k.id;selectedType='key';refreshContextPanel();drawEditor();return; }
  }
  const {gx,gy}=pixelToGrid(px,py);
  if (inBounds(gx,gy)) {
    const door=doorAt(gx,gy);
    if (door){selectedId=door.id;selectedType='door';selectedKillTiles.clear();refreshContextPanel();drawEditor();return;}
    if (grid[gy][gx]===TILE_TELEPORT){selectedId=gx+','+gy;selectedType='teleport';selectedKillTiles.clear();refreshContextPanel();drawEditor();return;}
    if (grid[gy][gx]===TILE_TRIGGER){selectedId=gx+','+gy;selectedType='trigger';selectedKillTiles.clear();refreshContextPanel();drawEditor();return;}
    if (grid[gy][gx]===TILE_KILL){selectedId=gx+','+gy;selectedType='kill';selectedKillTiles.clear();refreshContextPanel();drawEditor();return;}
  }
  selectedId=null;selectedType=null;refreshContextPanel();drawEditor();
}

// -------------------------------------------------------
// PATH MODE
// -------------------------------------------------------
function enterPathMode(addingKf) {
  if (!enemies.find(x=>x.id===selectedId)) { setStatus('Select an enemy first.'); return; }
  pathMode=true;pathModeState=0;pathTemp=null;pathAddKf=addingKf;
  canvas.classList.add('path-mode');
  const hint=document.getElementById('path-hint'); hint.classList.remove('hidden');
  if (addingKf) { hint.textContent='Click to place a waypoint.'; document.getElementById('btn-add-keyframe').textContent='Cancel'; }
  else { hint.textContent='Click point A on the canvas.'; document.getElementById('btn-set-path').textContent='Cancel'; }
}
function exitPathMode(cancelled) {
  pathMode=false;pathModeState=0;pathTemp=null;canvas.classList.remove('path-mode');
  document.getElementById('path-hint').classList.add('hidden');
  document.getElementById('btn-set-path').textContent='Set Path (A to B)';
  document.getElementById('btn-add-keyframe').textContent='+ Add Waypoint';
  if (!cancelled) setStatus('Path saved.');
  drawEditor();
}
function handlePathClick(e) {
  const {px,py}=mouseToPixel(e),{gx,gy}=pixelToGrid(px,py);
  if (!inBounds(gx,gy)) return;
  const tc=tileCenter(gx,gy);
  if (pathAddKf) {
    const en=enemies.find(x=>x.id===selectedId);
    if (en) { snapshot();en.keyframes=en.keyframes||[];en.keyframes.push({px:tc.px,py:tc.py});refreshContextPanel(); }
    exitPathMode(false); return;
  }
  if (pathModeState===0) {
    pathTemp={px:tc.px,py:tc.py};pathModeState=1;
    document.getElementById('path-hint').textContent=`A=(${gx},${gy})  Click point B.`;
  } else {
    const en=enemies.find(x=>x.id===selectedId);
    if (en) { snapshot();en.x1=pathTemp.px;en.y1=pathTemp.py;en.x2=tc.px;en.y2=tc.py;en.keyframes=[];refreshContextPanel(); }
    exitPathMode(false);
  }
}
document.getElementById('btn-set-path').addEventListener('click',()=>{ pathMode?exitPathMode(true):enterPathMode(false); });
document.getElementById('btn-add-keyframe').addEventListener('click',()=>{ pathMode?exitPathMode(true):enterPathMode(true); });

// -------------------------------------------------------
// CENTER MODE
// -------------------------------------------------------
function enterCenterMode() {
  centerMode=true;canvas.classList.add('center-mode');
  const h=document.getElementById('center-hint');h.classList.remove('hidden');
  h.textContent='Click anywhere to set the orbit center.';
  document.getElementById('btn-set-center').textContent='Cancel';
}
function exitCenterMode() {
  centerMode=false;canvas.classList.remove('center-mode');
  document.getElementById('center-hint').classList.add('hidden');
  document.getElementById('btn-set-center').textContent='Set Center Point';
}
function handleCenterClick(e) {
  const {px,py}=mouseToPixel(e),en=enemies.find(o=>o.id===selectedId);
  if (en) { snapshot();en.cx=px;en.cy=py;drawEditor(); }
  exitCenterMode();
}
document.getElementById('btn-set-center').addEventListener('click',()=>{
  if (centerMode){exitCenterMode();return;}
  const en=enemies.find(x=>x.id===selectedId);
  if (!en||en.type!=='orbit'){setStatus('Select an orbit enemy first.');return;}
  enterCenterMode();
});

// -------------------------------------------------------
// LINK DOOR MODE
// -------------------------------------------------------
function enterLinkDoorMode() {
  linkDoorMode=true;linkDoorKeyId=selectedId;
  const h=document.getElementById('link-door-hint');h.classList.remove('hidden');
  h.textContent='Click a door tile to link it to this key.';
  document.getElementById('btn-link-door').textContent='Cancel';
}
function exitLinkDoorMode() {
  linkDoorMode=false;linkDoorKeyId=null;
  document.getElementById('link-door-hint').classList.add('hidden');
  document.getElementById('btn-link-door').textContent='Link a Door';
}
function handleLinkDoorClick(e) {
  const {px,py}=mouseToPixel(e),{gx,gy}=pixelToGrid(px,py);
  const door=inBounds(gx,gy)?doorAt(gx,gy):null;
  if (door) { snapshot();door.keyId=linkDoorKeyId;setStatus(`Door (${gx},${gy}) linked.`);refreshContextPanel();drawEditor(); }
  else setStatus('That is not a door tile.');
  exitLinkDoorMode();
}
document.getElementById('btn-link-door').addEventListener('click',()=>{
  if (linkDoorMode){exitLinkDoorMode();return;}
  if (!selectedId||selectedType!=='key'){setStatus('Select a key first.');return;}
  enterLinkDoorMode();
});

// -------------------------------------------------------
// CONTEXT PANEL
// -------------------------------------------------------
function renderEnemyTriggerList(en, listId, noneId) {
  const listEl = document.getElementById(listId);
  const noneEl = document.getElementById(noneId);
  if (!listEl) return;
  listEl.innerHTML = '';
  const ids = en.triggerIds || [];
  if (!ids.length) {
    if (noneEl) noneEl.style.display = '';
  } else {
    if (noneEl) noneEl.style.display = 'none';
    ids.forEach(tKey => {
      const div = document.createElement('div'); div.className = 'door-entry';
      div.innerHTML = `<span>Trigger (${tKey})</span>`;
      const btn = document.createElement('button'); btn.textContent = 'X';
      btn.onclick = () => {
        snapshot();
        en.triggerIds = (en.triggerIds||[]).filter(k => k !== tKey);
        if (triggerLinks[tKey]) triggerLinks[tKey] = triggerLinks[tKey].filter(id => id !== en.id);
        refreshContextPanel(); drawEditor();
      };
      div.appendChild(btn); listEl.appendChild(div);
    });
  }
}

function refreshContextPanel() {
  document.querySelectorAll('.panel-block').forEach(p=>p.classList.add('hidden'));
  if (!selectedId||!selectedType) { document.getElementById('panel-default').classList.remove('hidden');return; }

  if (selectedType==='enemy') {
    const en=enemies.find(e=>e.id===selectedId); if (!en) { deselect();return; }
    const type=en.type||'linear';

    if (type==='linear') {
      document.getElementById('panel-linear').classList.remove('hidden');
      syncSliderNum('enemy-duration', en.duration||3);
      syncSliderNum('enemy-phase', en.phase||0);
      document.getElementById('mode-bounce').classList.toggle('active',!en.loopMode);
      document.getElementById('mode-loop').classList.toggle('active',!!en.loopMode);
      document.getElementById('dir-fwd').classList.toggle('active',en.forward!==false);
      document.getElementById('dir-bwd').classList.toggle('active',en.forward===false);
      const kfl=document.getElementById('keyframes-list');kfl.innerHTML='';
      (en.keyframes||[]).forEach((kf,i)=>{
        const div=document.createElement('div');div.className='kf-entry';
        const gkf=pixelToGrid(kf.px,kf.py);
        div.innerHTML=`<span>WP${i+1} (${gkf.gx},${gkf.gy})</span>`;
        const btn=document.createElement('button');btn.textContent='✕';
        btn.onclick=()=>{snapshot();en.keyframes.splice(i,1);refreshContextPanel();drawEditor();};
        div.appendChild(btn);kfl.appendChild(div);
      });
      const hasPath=totalPathLength(en)>2;
      const rd=document.getElementById('path-readout');
      if (hasPath) { rd.classList.remove('hidden');document.getElementById('path-readout-text').textContent=`${Math.round(totalPathLength(en))}px · ${(en.keyframes||[]).length} WPs`; }
      else rd.classList.add('hidden');
      // Trigger list
      renderEnemyTriggerList(en, 'linear-trigger-list', 'linear-trigger-none');

    } else if (type==='orbit') {
      document.getElementById('panel-orbit').classList.remove('hidden');
      syncSliderNum('orbit-radius', en.radius/TILE);
      syncSliderNum('orbit-duration', en.orbitDuration||4);
      syncSliderNum('orbit-angle', en.startAngle||0);
      document.getElementById('orbit-cw').classList.toggle('active',en.clockwise!==false);
      document.getElementById('orbit-ccw').classList.toggle('active',en.clockwise===false);
      // Bounce mode
      const isBounce = en.orbitBounce===true;
      document.getElementById('orbit-mode-loop').classList.toggle('active',!isBounce);
      document.getElementById('orbit-mode-bounce').classList.toggle('active',isBounce);
      document.getElementById('orbit-bounce-panel').classList.toggle('hidden',!isBounce);
      syncSliderNum('orbit-bounce-loops', en.orbitBounceLoops||1);
      // Trigger list
      renderEnemyTriggerList(en, 'orbit-trigger-list', 'orbit-trigger-none');

    } else { // follower
      document.getElementById('panel-follower').classList.remove('hidden');
      syncSliderNum('follower-speed', en.followerSpeed||80);
      syncSliderNum('follower-drift', en.followerDrift||4);
      syncSliderNum('follower-range', en.followerRange||0);
      const infBtn=document.getElementById('follower-range-infinite');
      if (infBtn) infBtn.classList.toggle('active', en.followerRange===0);
      // Trigger list
      renderEnemyTriggerList(en, 'follower-trigger-list', 'follower-trigger-none');
    }

  } else if (selectedType==='key') {
    const k=keys.find(x=>x.id===selectedId); if (!k){deselect();return;}
    document.getElementById('panel-key').classList.remove('hidden');
    document.querySelectorAll('#key-color-swatches .color-swatch').forEach(sw=>{
      sw.classList.toggle('active',sw.dataset.color===k.color);
    });
    const linked=doors.filter(d=>d.keyId===k.id);
    const dl=document.getElementById('key-doors-list');dl.innerHTML='';
    if (!linked.length) {
      const p=document.createElement('p');p.className='inst-text';p.textContent='No doors linked.';dl.appendChild(p);
    } else linked.forEach(d=>{
      const div=document.createElement('div');div.className='door-entry';
      div.innerHTML=`<span>Door (${d.gx},${d.gy})</span>`;
      const btn=document.createElement('button');btn.textContent='✕';
      btn.onclick=()=>{snapshot();d.keyId=null;refreshContextPanel();drawEditor();};
      div.appendChild(btn);dl.appendChild(div);
    });
  } else if (selectedType==='door') {
    const door=doors.find(d=>d.id===selectedId); if (!door){deselect();return;}
    document.getElementById('panel-door').classList.remove('hidden');
    const k=keys.find(x=>x.id===door.keyId);
    const val=document.getElementById('door-key-val');
    val.textContent=k?`Key (${k.gx},${k.gy})`:'None'; val.style.color=k?k.color:'';
  } else if (selectedType==='teleport') {
    // selectedId is "gx,gy" string for teleport
    const panelTp=document.getElementById('panel-teleport');
    if (!panelTp) { deselect(); return; }
    panelTp.classList.remove('hidden');
    const dest=teleportLinks[selectedId];
    const infoRow=document.getElementById('teleport-linked-info');
    const destVal=document.getElementById('teleport-dest-val');
    const hint=document.getElementById('teleport-link-hint');
    if (hint) hint.classList.add('hidden');
    if (dest) {
      infoRow.classList.remove('hidden');
      destVal.textContent='('+dest+')';
    } else {
      infoRow.classList.add('hidden');
    }
  } else if (selectedType==='trigger') {
    const panelTr=document.getElementById('panel-trigger');
    if (!panelTr) { deselect(); return; }
    panelTr.classList.remove('hidden');
    // Update start/stop buttons
    const currentAction = triggerActions[selectedId] || 'start';
    const startBtn = document.getElementById('trigger-action-start');
    const stopBtn = document.getElementById('trigger-action-stop');
    if (startBtn) startBtn.classList.toggle('active', currentAction === 'start');
    if (stopBtn) stopBtn.classList.toggle('active', currentAction === 'stop');
    const linkedEnemies=(triggerLinks[selectedId]||[]);
    const listEl=document.getElementById('trigger-linked-enemies');
    const noEl=document.getElementById('trigger-no-enemies');
    if (listEl) {
      listEl.innerHTML='';
      const validLinked=linkedEnemies.filter(eid=>enemies.some(e=>e.id===eid));
      // Clean up stale links
      if (validLinked.length!==linkedEnemies.length) triggerLinks[selectedId]=validLinked;
      if (!validLinked.length) {
        if (noEl) noEl.style.display='';
      } else {
        if (noEl) noEl.style.display='none';
        validLinked.forEach(eid=>{
          const en=enemies.find(e=>e.id===eid);
          if (!en) return;
          const div=document.createElement('div');div.className='door-entry';
          div.innerHTML=`<span>${en.type} (${en.gx||0},${en.gy||0})</span>`;
          const btn=document.createElement('button');btn.textContent='X';
          btn.onclick=()=>{
            snapshot();
            triggerLinks[selectedId]=(triggerLinks[selectedId]||[]).filter(id=>id!==eid);
            if (en.triggerIds) en.triggerIds=en.triggerIds.filter(k=>k!==selectedId);
            refreshContextPanel(); drawEditor();
          };
          div.appendChild(btn); listEl.appendChild(div);
        });
      }
    }
  } else if (selectedType==='kill') {
    const panelKill=document.getElementById('panel-kill');
    if (!panelKill) { deselect(); return; }
    panelKill.classList.remove('hidden');
    // Show opacity of the primary selected tile (or shared value if all match)
    const op = killOpacities[selectedId] ?? 1;
    syncSliderNum('kill-opacity', Math.round(op * 100));
    // Show count if multi-selected
    const countEl = document.getElementById('kill-multi-count');
    if (countEl) countEl.textContent = selectedKillTiles.size > 1
      ? `${selectedKillTiles.size} tiles selected` : '';
  }
}
function deselect() {
  if (teleportLinkMode) exitTeleportLinkMode();
  if (triggerLinkMode) exitTriggerLinkMode();
  selectedId=null;selectedType=null;selectedKillTiles.clear();
  document.querySelectorAll('.panel-block').forEach(p=>p.classList.add('hidden'));
  document.getElementById('panel-default').classList.remove('hidden');
}

// Sync a slider+number pair to a value
function syncSliderNum(id, val) {
  const slider=document.getElementById(id), num=document.getElementById(id+'-num');
  if (slider) slider.value=val;
  if (num) num.value=val;
}

// Helper: bind a slider+num pair together
function bindSliderNum(id, onChange) {
  const slider=document.getElementById(id), num=document.getElementById(id+'-num');
  if (!slider||!num) return;
  slider.addEventListener('input',()=>{ num.value=slider.value; onChange(parseFloat(slider.value)); });
  num.addEventListener('change',()=>{
    let v=parseFloat(num.value);
    if (isNaN(v)) v=parseFloat(slider.min)||0;
    v=Math.max(parseFloat(slider.min)||0, Math.min(parseFloat(slider.max)||9999, v));
    slider.value=v; num.value=v; onChange(v);
  });
}

// -------------------------------------------------------
// PANEL CONTROLS — LINEAR
// -------------------------------------------------------
bindSliderNum('enemy-duration', v=>{ const en=enemies.find(x=>x.id===selectedId);if (en) en.duration=v; });
bindSliderNum('enemy-phase', v=>{ const en=enemies.find(x=>x.id===selectedId);if (en){en.phase=v;drawEditor();} });
document.getElementById('mode-bounce').addEventListener('click',()=>{
  const en=enemies.find(x=>x.id===selectedId);if (!en) return;
  en.loopMode=false;document.getElementById('mode-bounce').classList.add('active');document.getElementById('mode-loop').classList.remove('active');
});
document.getElementById('mode-loop').addEventListener('click',()=>{
  const en=enemies.find(x=>x.id===selectedId);if (!en) return;
  en.loopMode=true;document.getElementById('mode-loop').classList.add('active');document.getElementById('mode-bounce').classList.remove('active');
});
document.getElementById('dir-fwd').addEventListener('click',()=>{
  const en=enemies.find(x=>x.id===selectedId);if (!en) return;
  en.forward=true;document.getElementById('dir-fwd').classList.add('active');document.getElementById('dir-bwd').classList.remove('active');drawEditor();
});
document.getElementById('dir-bwd').addEventListener('click',()=>{
  const en=enemies.find(x=>x.id===selectedId);if (!en) return;
  en.forward=false;document.getElementById('dir-fwd').classList.remove('active');document.getElementById('dir-bwd').classList.add('active');drawEditor();
});
document.getElementById('btn-delete-enemy').addEventListener('click',()=>{
  snapshot();enemies=enemies.filter(e=>e.id!==selectedId);
  if (pathMode) exitPathMode(true); if (centerMode) exitCenterMode();
  selectedId=null;selectedType=null;refreshContextPanel();drawEditor();
});

// -------------------------------------------------------
// PANEL CONTROLS — ORBIT
// -------------------------------------------------------
bindSliderNum('orbit-radius', v=>{ const en=enemies.find(o=>o.id===selectedId);if (en){en.radius=v*TILE;drawEditor();} });
bindSliderNum('orbit-duration', v=>{ const en=enemies.find(o=>o.id===selectedId);if (en) en.orbitDuration=v; });
bindSliderNum('orbit-angle', v=>{ const en=enemies.find(o=>o.id===selectedId);if (en){en.startAngle=v;drawEditor();} });
document.getElementById('orbit-cw').addEventListener('click',()=>{
  const en=enemies.find(o=>o.id===selectedId);if (!en) return;
  en.clockwise=true;document.getElementById('orbit-cw').classList.add('active');document.getElementById('orbit-ccw').classList.remove('active');
});
document.getElementById('orbit-ccw').addEventListener('click',()=>{
  const en=enemies.find(o=>o.id===selectedId);if (!en) return;
  en.clockwise=false;document.getElementById('orbit-cw').classList.remove('active');document.getElementById('orbit-ccw').classList.add('active');
});
document.getElementById('orbit-mode-loop').addEventListener('click',()=>{
  const en=enemies.find(o=>o.id===selectedId);if (!en) return;
  en.orbitBounce=false;
  document.getElementById('orbit-mode-loop').classList.add('active');
  document.getElementById('orbit-mode-bounce').classList.remove('active');
  document.getElementById('orbit-bounce-panel').classList.add('hidden');
});
document.getElementById('orbit-mode-bounce').addEventListener('click',()=>{
  const en=enemies.find(o=>o.id===selectedId);if (!en) return;
  en.orbitBounce=true;
  document.getElementById('orbit-mode-bounce').classList.add('active');
  document.getElementById('orbit-mode-loop').classList.remove('active');
  document.getElementById('orbit-bounce-panel').classList.remove('hidden');
});
bindSliderNum('orbit-bounce-loops', v=>{ const en=enemies.find(o=>o.id===selectedId);if (en) en.orbitBounceLoops=v; });
document.getElementById('btn-delete-enemy-orbit').addEventListener('click',()=>{
  snapshot();enemies=enemies.filter(e=>e.id!==selectedId);
  if (centerMode) exitCenterMode();
  selectedId=null;selectedType=null;refreshContextPanel();drawEditor();
});

// -------------------------------------------------------
// PANEL CONTROLS — FOLLOWER
// -------------------------------------------------------
bindSliderNum('follower-speed', v=>{ const en=enemies.find(o=>o.id===selectedId);if (en) en.followerSpeed=v; });
bindSliderNum('follower-drift', v=>{ const en=enemies.find(o=>o.id===selectedId);if (en) en.followerDrift=v; });
bindSliderNum('follower-range', v=>{ const en=enemies.find(o=>o.id===selectedId);if (en){en.followerRange=v;drawEditor();} });
document.getElementById('follower-range-infinite').addEventListener('click',()=>{
  const en=enemies.find(o=>o.id===selectedId);if (!en) return;
  en.followerRange=0; syncSliderNum('follower-range',0);
  document.getElementById('follower-range-infinite').classList.add('active');
});
document.getElementById('btn-delete-enemy-follower').addEventListener('click',()=>{
  snapshot();enemies=enemies.filter(e=>e.id!==selectedId);
  selectedId=null;selectedType=null;refreshContextPanel();drawEditor();
});
document.querySelectorAll('#key-color-swatches .color-swatch').forEach(sw=>{
  sw.addEventListener('click',()=>{
    const k=keys.find(x=>x.id===selectedId);if (!k) return;
    snapshot();k.color=sw.dataset.color;
    document.querySelectorAll('#key-color-swatches .color-swatch').forEach(s=>s.classList.remove('active'));
    sw.classList.add('active');drawEditor();
  });
});
document.getElementById('btn-delete-key').addEventListener('click',()=>{
  snapshot();doors.forEach(d=>{if (d.keyId===selectedId) d.keyId=null;});
  keys=keys.filter(k=>k.id!==selectedId);selectedId=null;selectedType=null;
  if (linkDoorMode) exitLinkDoorMode();refreshContextPanel();drawEditor();
});
document.getElementById('btn-delete-door').addEventListener('click',()=>{
  const door=doors.find(d=>d.id===selectedId);if (!door) return;
  snapshot();doors=doors.filter(d=>d.id!==selectedId);selectedId=null;selectedType=null;refreshContextPanel();drawEditor();
});

// -------------------------------------------------------
// TELEPORT PANEL BUTTONS
// -------------------------------------------------------
const _tpLinkBtn = document.getElementById('btn-link-teleport');
if (_tpLinkBtn) _tpLinkBtn.addEventListener('click',()=>{
  if (teleportLinkMode){exitTeleportLinkMode();return;}
  if (!selectedId||selectedType!=='teleport'){setStatus('Select a teleport tile first.');return;}
  enterTeleportLinkMode(selectedId);
});
const _tpUnlinkBtn = document.getElementById('btn-unlink-teleport');
if (_tpUnlinkBtn) _tpUnlinkBtn.addEventListener('click',()=>{
  if (!selectedId||selectedType!=='teleport') return;
  snapshot(); removeTeleportLink(selectedId);
  refreshContextPanel(); drawEditor();
  setStatus('Teleport unlinked.');
});

// -------------------------------------------------------
// TRIGGER BUTTONS (per enemy panel)
// -------------------------------------------------------
function unlinkEnemyTrigger() {
  if (!selectedId||selectedType!=='enemy') return;
  const en=enemies.find(e=>e.id===selectedId);
  if (!en||(en.triggerIds||[]).length===0) return;
  snapshot();
  (en.triggerIds||[]).forEach(tKey=>{
    if (triggerLinks[tKey]) triggerLinks[tKey]=triggerLinks[tKey].filter(id=>id!==en.id);
  });
  en.triggerIds=[];
  refreshContextPanel(); drawEditor();
}
document.getElementById('btn-link-trigger').addEventListener('click',()=>{
  if (triggerLinkMode){exitTriggerLinkMode();return;}
  if (!selectedId||selectedType!=='enemy'){setStatus('Select an enemy first.');return;}
  enterTriggerLinkMode(selectedId);
});
// Unlink buttons removed — unlinking is now done per-item in the trigger list
document.getElementById('btn-link-trigger-orbit').addEventListener('click',()=>{
  if (triggerLinkMode){exitTriggerLinkMode();return;}
  if (!selectedId||selectedType!=='enemy'){setStatus('Select an enemy first.');return;}
  enterTriggerLinkMode(selectedId);
});
document.getElementById('btn-link-trigger-follower').addEventListener('click',()=>{
  if (triggerLinkMode){exitTriggerLinkMode();return;}
  if (!selectedId||selectedType!=='enemy'){setStatus('Select an enemy first.');return;}
  enterTriggerLinkMode(selectedId);
});
// Trigger action: start or stop
var _triggerActionStart = document.getElementById('trigger-action-start');
var _triggerActionStop = document.getElementById('trigger-action-stop');
if (_triggerActionStart) _triggerActionStart.addEventListener('click', function() {
  if (!selectedId || selectedType !== 'trigger') return;
  snapshot();
  triggerActions[selectedId] = 'start';
  refreshContextPanel();
});
if (_triggerActionStop) _triggerActionStop.addEventListener('click', function() {
  if (!selectedId || selectedType !== 'trigger') return;
  snapshot();
  triggerActions[selectedId] = 'stop';
  refreshContextPanel();
});

document.getElementById('btn-delete-trigger').addEventListener('click',()=>{
  if (!selectedId||selectedType!=='trigger') return;
  const [gx,gy]=selectedId.split(',').map(Number);
  snapshot(); removeTrigger(selectedId);
  delete triggerActions[selectedId];
  grid[gy][gx]=TILE_EMPTY;
  selectedId=null;selectedType=null;refreshContextPanel();drawEditor();
});

// -------------------------------------------------------
// PANEL CONTROLS — KILL TILE
// -------------------------------------------------------
bindSliderNum('kill-opacity', v=>{
  if (selectedType!=='kill') return;
  const op = v/100;
  const targets = selectedKillTiles.size>0 ? selectedKillTiles : new Set([selectedId]);
  targets.forEach(tk=>{
    if (op>=1) delete killOpacities[tk]; else killOpacities[tk]=op;
  });
  drawEditor();
});
document.getElementById('btn-delete-kill').addEventListener('click',()=>{
  if (selectedType!=='kill') return;
  const targets = selectedKillTiles.size>0 ? [...selectedKillTiles] : [selectedId];
  snapshot();
  targets.forEach(tk=>{
    const [gx,gy]=tk.split(',').map(Number);
    grid[gy][gx]=TILE_EMPTY; delete killOpacities[tk];
  });
  selectedId=null;selectedType=null;selectedKillTiles.clear();
  refreshContextPanel();drawEditor();
});

// -------------------------------------------------------
// CAMERA UI
// -------------------------------------------------------
function updateCameraUI() {
  const isFollow=currentCameraMode==='follow';
  document.getElementById('camera-fixed').classList.toggle('active',!isFollow);
  document.getElementById('camera-follow').classList.toggle('active',isFollow);
  const zr=document.getElementById('camera-zoom-row');
  if (zr) zr.classList.toggle('hidden',!isFollow);
  if (isFollow) syncSliderNum('camera-zoom',currentCameraZoom);
  drawEditor();
}
document.getElementById('camera-fixed').addEventListener('click',()=>{
  currentCameraMode='fixed'; updateCameraUI();
});
document.getElementById('camera-follow').addEventListener('click',()=>{
  currentCameraMode='follow'; updateCameraUI();
});
bindSliderNum('camera-zoom',v=>{ currentCameraZoom=v; updateCameraUI(); });

// -------------------------------------------------------
// TOOL BUTTONS
// -------------------------------------------------------
document.querySelectorAll('.tool-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    if (playMode) return;
    currentTool=btn.dataset.tool;
    document.querySelectorAll('.tool-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('status-tool').textContent='Tool: '+btn.querySelector('.tool-label').textContent.trim();
    // Show wall color palette only when wall tool active
    const wallColorPanel = document.getElementById('wall-color-panel');
    if (wallColorPanel) wallColorPanel.classList.toggle('hidden', currentTool !== 'wall');
    if (currentTool!=='select' && currentTool!=='linear' && currentTool!=='orbit' && currentTool!=='follower') {
      if (pathMode) exitPathMode(true);
      if (centerMode) exitCenterMode();
      if (linkDoorMode) exitLinkDoorMode();
      if (teleportLinkMode) exitTeleportLinkMode();
      if (triggerLinkMode) exitTriggerLinkMode();
      selectedId=null;selectedType=null;refreshContextPanel();drawEditor();
    } else if (currentTool==='linear'||currentTool==='orbit'||currentTool==='follower') {
      if (pathMode) exitPathMode(true);
      if (centerMode) exitCenterMode();
      if (linkDoorMode) exitLinkDoorMode();
      if (teleportLinkMode) exitTeleportLinkMode();
      if (triggerLinkMode) exitTriggerLinkMode();
      // keep selection if matching enemy type selected, otherwise clear
      if (selectedType!=='enemy') { selectedId=null;selectedType=null;refreshContextPanel();drawEditor(); }
    }
  });
});

const TOOL_KEYS = {
  '1':'wall','2':'erase','3':'goal','4':'player','5':'coin',
  '6':'linear','o':'orbit','v':'follower','7':'key','8':'door','9':'ice','k':'checkpoint',
  'x':'kill','s':'select','f':'fill','t':'teleport','g':'trigger',
};

// -------------------------------------------------------
// WALL COLOR SWATCHES
// -------------------------------------------------------
document.querySelectorAll('.wall-color-swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    if (sw.dataset.color === 'custom') {
      const picker = document.getElementById('wall-color-picker');
      picker.click();
      return;
    }
    setWallColor(sw.dataset.color);
  });
});
document.getElementById('wall-color-picker').addEventListener('input', e => {
  setWallColor(e.target.value);
});
function setWallColor(color) {
  currentWallColor = color;
  document.querySelectorAll('.wall-color-swatch').forEach(s => {
    if (s.dataset.color === 'custom') {
      s.classList.toggle('active', !document.querySelector('.wall-color-swatch[data-color="' + color + '"]:not(.custom-color-btn)'));
    } else {
      s.classList.toggle('active', s.dataset.color === color);
    }
  });
  // Update the tool swatch preview
  const wallSwatch = document.querySelector('.tool-btn[data-tool="wall"] .tool-swatch');
  if (wallSwatch) wallSwatch.style.background = color;
}

// -------------------------------------------------------
// TIME LIMIT + SPEED UI
// -------------------------------------------------------
function updateTimeLimitUI() {
  const isOn=currentTimeLimit>0;
  document.getElementById('timelimit-off').classList.toggle('active',!isOn);
  document.getElementById('timelimit-on').classList.toggle('active',isOn);
  const row=document.getElementById('timelimit-row');
  if (isOn) {
    row.classList.remove('hidden');
    syncSliderNum('timelimit',currentTimeLimit);
  } else row.classList.add('hidden');
}
function updateSpeedUI() {
  syncSliderNum('speed',currentPlayerSpeed);
}
document.getElementById('timelimit-off').addEventListener('click',()=>{ currentTimeLimit=0;updateTimeLimitUI(); });
document.getElementById('timelimit-on').addEventListener('click',()=>{ if(!currentTimeLimit)currentTimeLimit=60;updateTimeLimitUI(); });
bindSliderNum('timelimit',v=>{ currentTimeLimit=v; });
bindSliderNum('speed',v=>{ currentPlayerSpeed=v; });

// -------------------------------------------------------
// SIDEBAR TOGGLE
// -------------------------------------------------------
let sidebarVisible=true;
document.getElementById('btn-sidebar-toggle').addEventListener('click',toggleSidebar);
function toggleSidebar() {
  sidebarVisible=!sidebarVisible;
  document.getElementById('toolbar').classList.toggle('collapsed',!sidebarVisible);
  setTimeout(()=>{ resizeCanvas(); playMode?drawPlay():drawEditor(); },230);
}

// -------------------------------------------------------
// KEYBOARD
// -------------------------------------------------------
document.addEventListener('keydown', e=>{
  if (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA') return;
  if (playMode) {
    keysDown[e.key]=true;
    if (e.key==='r'||e.key==='R') { resetPlayState();return; }
    if (e.key==='Escape') {
      const isOnline = document.getElementById('topbar-actions').dataset.onlineMode === '1';
      if (document.getElementById('pause-overlay') && !document.getElementById('pause-overlay').classList.contains('hidden')) {
        resumeFromPause(); return;
      }
      showPauseMenu();
      return;
    }
    return;
  }
  if (e.key==='Tab') { e.preventDefault();toggleSidebar();return; }
  if (e.key==='Escape') {
    if (pathMode){exitPathMode(true);return;}
    if (centerMode){exitCenterMode();return;}
    if (linkDoorMode){exitLinkDoorMode();return;}
    if (triggerLinkMode){exitTriggerLinkMode();return;}
  }
  if ((e.ctrlKey||e.metaKey)&&e.key==='z') { e.preventDefault();undo();return; }
  // Copy/Paste for select tool
  if ((e.ctrlKey||e.metaKey)&&e.key==='c') {
    if (currentTool==='select'&&selectedId!=null) {
      e.preventDefault();
      if (selectedType==='enemy') {
        const en=enemies.find(x=>x.id===selectedId);
        if (en) { editorClipboard={type:'enemy',data:JSON.parse(JSON.stringify(en))}; setStatus('Enemy copied.'); }
      } else if (selectedType==='key') {
        const k=keys.find(x=>x.id===selectedId);
        if (k) { editorClipboard={type:'key',data:JSON.parse(JSON.stringify(k))}; setStatus('Key copied.'); }
      } else if (selectedType==='kill') {
        const tiles=[...selectedKillTiles.size>0?selectedKillTiles:new Set([selectedId])];
        const killData=tiles.map(tk=>({tk,op:killOpacities[tk]??1}));
        editorClipboard={type:'kill',data:killData}; setStatus(`${tiles.length} kill tile(s) copied.`);
      }
    }
    return;
  }
  if ((e.ctrlKey||e.metaKey)&&e.key==='v') {
    if (editorClipboard&&!playMode) {
      e.preventDefault();
      snapshot();
      if (editorClipboard.type==='enemy') {
        const orig=editorClipboard.data;
        const dx=TILE, dy=TILE; // offset paste by 1 tile
        const newEn=JSON.parse(JSON.stringify(orig));
        newEn.id=newId();
        if (newEn.gx!==undefined) newEn.gx=Math.min(COLS-1,newEn.gx+1);
        if (newEn.gy!==undefined) newEn.gy=Math.min(ROWS-1,newEn.gy+1);
        newEn.x1=(newEn.x1||0)+dx; newEn.y1=(newEn.y1||0)+dy;
        newEn.x2=(newEn.x2||0)+dx; newEn.y2=(newEn.y2||0)+dy;
        if (newEn.cx!==undefined) newEn.cx+=dx;
        if (newEn.cy!==undefined) newEn.cy+=dy;
        if (newEn.keyframes) newEn.keyframes=newEn.keyframes.map(kf=>({...kf,px:kf.px+dx,py:kf.py+dy}));
        newEn.triggerIds=[]; // don't copy trigger links
        enemies.push(newEn);
        selectedId=newEn.id; selectedType='enemy';
        refreshContextPanel(); drawEditor(); setStatus('Enemy pasted.');
      } else if (editorClipboard.type==='key') {
        const orig=editorClipboard.data;
        const newK=JSON.parse(JSON.stringify(orig));
        newK.id=newId();
        newK.gx=Math.min(COLS-1,newK.gx+1); newK.gy=Math.min(ROWS-1,newK.gy+1);
        keys.push(newK);
        selectedId=newK.id; selectedType='key';
        refreshContextPanel(); drawEditor(); setStatus('Key pasted.');
      } else if (editorClipboard.type==='kill') {
        const pastedTiles=[];
        editorClipboard.data.forEach(({tk,op})=>{
          const [c,r]=tk.split(',').map(Number);
          const nc=c+1, nr=r+1;
          if (inBounds(nc,nr)) {
            const ntk=nc+','+nr;
            grid[nr][nc]=TILE_KILL;
            killOpacities[ntk]=op;
            pastedTiles.push(ntk);
          }
        });
        if (pastedTiles.length) {
          selectedKillTiles=new Set(pastedTiles);
          selectedId=pastedTiles[0]; selectedType='kill';
          refreshContextPanel(); drawEditor(); setStatus(`${pastedTiles.length} kill tile(s) pasted.`);
        }
      }
    }
    return;
  }
  // W = add waypoint (when enemy selected), L = link door/trigger
  if (!e.ctrlKey&&!e.metaKey) {
    if (e.key==='w'||e.key==='W') {
      // Add waypoint if enemy selected, otherwise ignore
      if (selectedType==='enemy') {
        const addKfBtn=document.getElementById('btn-add-keyframe');
        if (addKfBtn) { addKfBtn.click(); return; }
      }
    }
    if (e.key==='l'||e.key==='L') {
      // Link: door if key selected, trigger if trigger selected, trigger-link if enemy selected
      if (selectedType==='key') {
        const linkDoorBtn=document.getElementById('btn-link-door');
        if (linkDoorBtn) { linkDoorBtn.click(); return; }
      } else if (selectedType==='trigger') {
        const linkTrigBtn=document.getElementById('btn-link-trigger') || document.getElementById('btn-link-trigger-orbit') || document.getElementById('btn-link-trigger-follower');
        if (linkTrigBtn) { linkTrigBtn.click(); return; }
      } else if (selectedType==='enemy') {
        const en=enemies.find(x=>x.id===selectedId);
        if (en) {
          let btn;
          if (en.type==='orbit') btn=document.getElementById('btn-link-trigger-orbit');
          else if (en.type==='follower') btn=document.getElementById('btn-link-trigger-follower');
          else btn=document.getElementById('btn-link-trigger');
          if (btn) { btn.click(); return; }
        }
      }
    }
  }
  const toolFor=TOOL_KEYS[e.key.toLowerCase()];
  if (toolFor&&!e.ctrlKey&&!e.metaKey) {
    const btn=document.querySelector(`.tool-btn[data-tool="${toolFor}"]`);
    if (btn) btn.click();
  }
});
document.addEventListener('keyup',e=>{ keysDown[e.key]=false; });

// -------------------------------------------------------
// GRID RESIZE
// -------------------------------------------------------
document.getElementById('btn-resize').addEventListener('click',()=>{
  const body=document.getElementById('modal-body');
  body.innerHTML=`
    <div class="resize-controls">
      <div class="resize-row"><label>Columns:</label><input type="number" id="inp-cols" min="4" max="80" value="${COLS}" /></div>
      <div class="resize-row"><label>Rows:</label><input type="number" id="inp-rows" min="4" max="50" value="${ROWS}" /></div>
      <p class="resize-note">Shrinking crops the level and removes out-of-bounds objects.</p>
    </div>`;
  document.getElementById('modal-title').textContent='Change Grid Size';
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-confirm').textContent='Apply';
  document.getElementById('modal-confirm').onclick=()=>{
    const nc=Math.max(4,Math.min(80,parseInt(document.getElementById('inp-cols').value)||COLS));
    const nr=Math.max(4,Math.min(50,parseInt(document.getElementById('inp-rows').value)||ROWS));
    applyGridResize(nc,nr);
    document.getElementById('modal-overlay').classList.add('hidden');
  };
});
function applyGridResize(nc,nr) {
  snapshot();
  const ng=[];
  for (let r=0;r<nr;r++) { ng[r]=[];for (let c=0;c<nc;c++) ng[r][c]=(r<ROWS&&c<COLS)?grid[r][c]:TILE_EMPTY; }
  COLS=nc;ROWS=nr;grid=ng;
  playerSpawn.gx=Math.min(playerSpawn.gx,COLS-1); playerSpawn.gy=Math.min(playerSpawn.gy,ROWS-1);
  coins=coins.filter(c=>inBounds(c.gx,c.gy));keys=keys.filter(k=>inBounds(k.gx,k.gy));
  doors=doors.filter(d=>inBounds(d.gx,d.gy));
  enemies=enemies.filter(en=>en.type==='orbit'||inBounds(Math.floor(en.x1/TILE),Math.floor(en.y1/TILE)));
  resizeCanvas();drawEditor();updateSizeStatus();setStatus(`Grid resized to ${COLS}×${ROWS}.`);
}

// -------------------------------------------------------
// TOP BAR
// -------------------------------------------------------
document.getElementById('btn-undo').addEventListener('click',undo);
document.getElementById('btn-clear').addEventListener('click',()=>{
  if (!confirm('Clear the entire level?')) return;
  undoStack=[];initGrid();coins=[];enemies=[];keys=[];doors=[];wallColors={};outerWalls={};triggerLinks={};triggerActions={};
  playerSpawn={gx:2,gy:Math.floor(ROWS/2)};selectedId=null;selectedType=null;
  if (pathMode) exitPathMode(true);if (centerMode) exitCenterMode();if (linkDoorMode) exitLinkDoorMode();if (teleportLinkMode) exitTeleportLinkMode();
  refreshContextPanel();drawEditor();scheduleAutoSave();setStatus('Level cleared.');
});
document.getElementById('btn-play').addEventListener('click',togglePlay);

document.getElementById('btn-save').addEventListener('click', function() {
  saveCurrentEditorState();
  const lv = getCurrentLevel();
  if (!lv) { setStatus('No level to export.'); return; }
  const clean = stripInternalMeta(lv);
  const json = JSON.stringify(clean, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (lv.name || 'level').replace(/[^a-z0-9_\-]/gi, '_') + '.json';
  a.click();
  URL.revokeObjectURL(url);
  setStatus('Exported "' + (lv.name || 'level') + '".');
});

// Level name sync
document.getElementById('current-level-name-input').addEventListener('input', function(e) {
  const lv = getCurrentLevel(); if (lv) lv.name = e.target.value;
  renderHubMyLevels();
  scheduleAutoSave();
});

// Export/modal handlers defined in hub section below

// Screen navigation handled in hub section below

function renderHomeScreen() { renderHubMyLevels(); }

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function playLevelFromHome(idx) { hubPlayLocal(idx); }
function duplicateLevel(idx)    { hubDuplicateLevel(idx); }
function deleteLevel(idx)       { hubDeleteLevel(idx); }
function openEditor(idx)        { openEditorFromHub(idx); }

document.getElementById('hub-btn-import').addEventListener('click', function() {
  openImportModal(renderHubMyLevels);
});
document.getElementById('hub-btn-export-all').addEventListener('click', exportAll);



// -------------------------------------------------------
// PLAY MODE
// -------------------------------------------------------
function togglePlay() {
  if (document.getElementById('topbar-actions').dataset.onlineMode === '1') return;
  playMode ? stopPlay() : startPlay();
}

function startPlay() {
  saveCurrentEditorState();
  playMode=true;
  if (pathMode) exitPathMode(true);if (centerMode) exitCenterMode();if (linkDoorMode) exitLinkDoorMode();if (teleportLinkMode) exitTeleportLinkMode();
  const btn=document.getElementById('btn-play');
  btn.textContent='Stop'; btn.style.cssText='background:#cc2222;border-color:#991111;color:#fff;';
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('win-overlay').classList.add('hidden');
  const _pauseOv = document.getElementById('pause-overlay');
  if (_pauseOv) _pauseOv.classList.add('hidden');
  var floatPause = document.getElementById('btn-pause-float');
  if (floatPause) floatPause.classList.remove('hidden');
  deaths=0;playTimer=0;
  buildPlayState();lastTime=0;
  canvas.style.cursor='default';
  document.getElementById('statusbar').style.display='none';
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId=requestAnimationFrame(ts=>{lastTime=ts;gameLoop(ts);});
}

function stopPlay() {
  playMode=false;
  if (animFrameId){cancelAnimationFrame(animFrameId);animFrameId=null;}
  const btn=document.getElementById('btn-play');
  btn.textContent='Play';btn.style.cssText='';
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('win-overlay').classList.add('hidden');
  const pauseOv = document.getElementById('pause-overlay');
  if (pauseOv) pauseOv.classList.add('hidden');
  var floatPause = document.getElementById('btn-pause-float');
  if (floatPause) floatPause.classList.add('hidden');
  canvas.style.cursor='crosshair';
  document.getElementById('statusbar').style.display='';
  playerDying=false;playerOnIce=false;
  document.getElementById('death-flash').classList.remove('active');
  drawEditor();
}

let _paused = false;
function showPauseMenu() {
  if (!playMode || playerDying) return;
  _paused = true;
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  // Populate stats
  var dEl = document.getElementById('pause-stat-deaths');
  var tEl = document.getElementById('pause-stat-time');
  if (dEl) dEl.textContent = deaths;
  if (tEl) tEl.textContent = formatTime(playTimer);
  const ov = document.getElementById('pause-overlay');
  if (ov) ov.classList.remove('hidden');
}
function resumeFromPause() {
  _paused = false;
  const ov = document.getElementById('pause-overlay');
  if (ov) ov.classList.add('hidden');
  if (playMode && !animFrameId) {
    animFrameId = requestAnimationFrame(function(ts) { lastTime = ts; gameLoop(ts); });
  }
}

function buildPlayState() {
  playCoins=coins.map(c=>({...c}));
  playKeys=keys.map(k=>{const c=tileCenter(k.gx,k.gy);return{...k,px:c.px,py:c.py,collected:false};});
  playDoors=doors.map(d=>({...d,open:false}));
  collectedKeyIds=new Set(); checkpointPos=null;
  playerVx=0;playerVy=0;playerOnIce=false;iceLockedVx=0;iceLockedVy=0;
  playerDying=false;deathCooldown=0;
  playEnemies=enemies.map(en=>{
    const hasTrigger=!!(en.triggerIds&&en.triggerIds.length);
    if (en.type==='orbit') {
      const a=(en.startAngle||0)*Math.PI/180;
      const baseSpeed=(2*Math.PI)/(en.orbitDuration||4)*(en.clockwise!==false?1:-1);
      const orbitBounce=en.orbitBounce===true;
      const bounceLoops=en.orbitBounceLoops||1;
      return{...en,angle:a,angularSpeed:baseSpeed,_orbitBaseSpeed:baseSpeed,_orbitBounce:orbitBounce,_bounceLoops:bounceLoops,_bounceAccum:0,px:en.cx+Math.cos(a)*en.radius,py:en.cy+Math.sin(a)*en.radius,triggered:!hasTrigger};
    } else if (en.type==='follower') {
      const tc=tileCenter(en.gx||0,en.gy||0);
      return{...en,px:en.spawnX||tc.px,py:en.spawnY||tc.py,triggered:!hasTrigger};
    } else {
      const len=totalPathLength(en),sp=positionAlongPath(en,en.phase||0);
      const speed=len>0?len/(en.duration||3):60;
      const dir=en.forward!==false?1:-1;
      return{...en,px:sp.px,py:sp.py,t:(en.phase||0)*len,dir,speed,len,triggered:!hasTrigger};
    }
  });
  keysDown={};
  resetPlayerPos();updateHUD();
}

function resetPlayState() {
  const cp=checkpointPos,d=deaths;
  buildPlayState();checkpointPos=cp;deaths=d;playTimer=cp?cp.savedTimer||0:0;
  if (cp) {const c=tileCenter(cp.gx,cp.gy);player={x:c.px,y:c.py};}
  updateHUD();
}
function resetPlayerPos() {
  const spawn=checkpointPos||playerSpawn;
  const c=tileCenter(spawn.gx,spawn.gy);
  player={x:c.px,y:c.py,_lastTpTile:null};playerVx=0;playerVy=0;
  playerOnIce=false;iceLockedVx=0;iceLockedVy=0;
  document.getElementById('hud-msg').textContent='';
}

// -------------------------------------------------------
// GAME LOOP
// -------------------------------------------------------
function gameLoop(ts) {
  if (!playMode) return;
  const dt=Math.min((ts-lastTime)/1000,0.05);lastTime=ts;
  updatePlay(dt);drawPlay();
  animFrameId=requestAnimationFrame(gameLoop);
}

function updatePlay(dt) {
  if (!player||playerDying) return;

  // Timer
  playTimer+=dt;
  if (currentTimeLimit>0) {
    const remaining=currentTimeLimit-playTimer;
    const tel=document.getElementById('hud-timer');
    tel.classList.remove('hidden');
    if (remaining<=0) { tel.textContent='0:00';tel.classList.add('urgent');die();return; }
    tel.textContent=formatTime(remaining);
    tel.classList.toggle('urgent',remaining<10);
  } else document.getElementById('hud-timer').classList.add('hidden');

  // Where is the player tile?
  const half=PLAYER_SIZE/2;
  const pgx=Math.floor(player.x/TILE), pgy=Math.floor(player.y/TILE);
  const currentTileType=inBounds(pgx,pgy)?grid[pgy][pgx]:TILE_EMPTY;
  const nowOnIce=currentTileType===TILE_ICE;

  // ICE MECHANIC:
  // When entering ice: lock in current velocity direction. Player loses input control.
  // When leaving ice: restore normal input.
  // ICE: entering
  if (nowOnIce && !playerOnIce) {
    playerOnIce = true;
    const speed = Math.hypot(playerVx, playerVy);
    if (speed > 5) {
      iceLockedVx = playerVx;
      iceLockedVy = playerVy;
    } else {
      let ix=0,iy=0;
      if (keysDown['ArrowLeft']||keysDown['a']||keysDown['A']||dpadState.left) ix=-1;
      if (keysDown['ArrowRight']||keysDown['d']||keysDown['D']||dpadState.right) ix=1;
      if (keysDown['ArrowUp']||keysDown['w']||keysDown['W']||dpadState.up) iy=-1;
      if (keysDown['ArrowDown']||keysDown['s']||keysDown['S']||dpadState.down) iy=1;
      if (joystickEnabled && (vjoyDx||vjoyDy)) { ix=vjoyDx; iy=vjoyDy; }
      const mag=Math.hypot(ix,iy);
      if (mag>0) { iceLockedVx=ix/mag*currentPlayerSpeed; iceLockedVy=iy/mag*currentPlayerSpeed; }
      else { iceLockedVx=0; iceLockedVy=0; }
    }
  } else if (!nowOnIce && playerOnIce) {
    // Left ice tile — restore control
    playerOnIce=false; playerVx=0; playerVy=0;
  }

  // Movement
  if (playerOnIce) {
    playerVx = iceLockedVx;
    playerVy = iceLockedVy;
  } else {
    let ix=0,iy=0;
    if (keysDown['ArrowLeft']||keysDown['a']||keysDown['A']||dpadState.left) ix=-1;
    if (keysDown['ArrowRight']||keysDown['d']||keysDown['D']||dpadState.right) ix=1;
    if (keysDown['ArrowUp']||keysDown['w']||keysDown['W']||dpadState.up) iy=-1;
    if (keysDown['ArrowDown']||keysDown['s']||keysDown['S']||dpadState.down) iy=1;
    if (joystickEnabled && (vjoyDx!==0||vjoyDy!==0)) { ix=vjoyDx; iy=vjoyDy; }
    const mag=Math.hypot(ix,iy);
    if (mag>1){ix/=mag;iy/=mag;}
    playerVx=ix*currentPlayerSpeed;
    playerVy=iy*currentPlayerSpeed;
  }

  // Try to move
  const dx=playerVx*dt, dy=playerVy*dt;
  const newX=moveAxis(player.x,player.y,dx,0).x;
  const newY=moveAxis(newX,player.y,0,dy).y;

  // Ice wall collision: if still sliding and we were blocked, kill that axis and exit ice
  if (playerOnIce) {
    const blockedX = (dx !== 0 && newX === player.x);
    const blockedY = (dy !== 0 && newY === player.y);
    if (blockedX || blockedY) {
      playerOnIce = false;
      iceLockedVx = 0; iceLockedVy = 0;
      playerVx = 0; playerVy = 0;
    }
  }

  player.x=newX;player.y=newY;
  player.x=Math.max(half,Math.min(COLS*TILE-half,player.x));
  player.y=Math.max(half,Math.min(ROWS*TILE-half,player.y));

  // Update enemies
  for (const en of playEnemies) {
    if (!en.triggered) continue; // waiting for trigger
    if (en.type==='orbit') {
      if (en._orbitBounce) {
        const prevAngle = en.angle;
        en.angle += en.angularSpeed * dt;
        // Track accumulated rotation (in full loops)
        const delta = Math.abs(en.angle - prevAngle);
        en._bounceAccum = (en._bounceAccum||0) + delta / (2*Math.PI);
        if (en._bounceAccum >= en._bounceLoops) {
          en._bounceAccum -= en._bounceLoops;
          en.angularSpeed = -en.angularSpeed; // flip direction
        }
      } else {
        en.angle += en.angularSpeed * dt;
      }
      en.px=en.cx+Math.cos(en.angle)*en.radius;
      en.py=en.cy+Math.sin(en.angle)*en.radius;
    } else if (en.type==='follower') {
      if (player) {
        const dx=player.x-en.px, dy=player.y-en.py;
        const dist=Math.hypot(dx,dy);
        const spd = en.followerSpeed||80;
        const drift = en.followerDrift||4;
        const range = en.followerRange||0; // 0 = infinite
        const inRange = range===0 || dist<=range;
        if (inRange && dist > 1) {
          const tx=(dx/dist)*spd, ty=(dy/dist)*spd;
          en.vx=(en.vx||0)+(tx-(en.vx||0))*Math.min(1,dt*drift);
          en.vy=(en.vy||0)+(ty-(en.vy||0))*Math.min(1,dt*drift);
        } else {
          // Decelerate when out of range
          en.vx=(en.vx||0)*(1-Math.min(1,dt*drift));
          en.vy=(en.vy||0)*(1-Math.min(1,dt*drift));
        }
        en.px += en.vx * dt;
        en.py += en.vy * dt;
      }
    } else {
      if (en.len<1) continue;
      if (en.loopMode) { en.t=(en.t+en.speed*dt)%en.len; }
      else {
        en.t+=en.speed*dt*en.dir;
        if (en.t>=en.len){en.t=en.len;en.dir=-1;}
        if (en.t<=0){en.t=0;en.dir=1;}
      }
      const pos=positionAlongPath(en,en.t/en.len);
      en.px=pos.px;en.py=pos.py;
    }
  }

  // Trigger tile activation
  if (player) {
    const tgx=Math.floor(player.x/TILE), tgy=Math.floor(player.y/TILE);
    if (inBounds(tgx,tgy) && grid[tgy][tgx]===TILE_TRIGGER) {
      const tKey=tgx+','+tgy;
      const linkedIds=triggerLinks[tKey]||[];
      const action = triggerActions[tKey] || 'start';
      linkedIds.forEach(eid=>{
        const pEn=playEnemies.find(e=>e.id===eid);
        if (action === 'stop') {
          if (pEn && pEn.triggered) { pEn.triggered = false; }
        } else {
          if (pEn && !pEn.triggered) { pEn.triggered=true; }
        }
      });
    }
  }

  // Coins
  playCoins=playCoins.filter(coin=>{
    const c=tileCenter(coin.gx,coin.gy);
    return Math.hypot(player.x-c.px,player.y-c.py)>COIN_RADIUS+half-3;
  });

  // Keys
  for (const k of playKeys) {
    if (k.collected) continue;
    if (Math.hypot(player.x-k.px,player.y-k.py)<TILE/2+4) {
      k.collected=true;collectedKeyIds.add(k.id);
      for (const d of playDoors) if (d.keyId===k.id) d.open=true;
    }
  }

  // Checkpoint
  const cpgx=Math.floor(player.x/TILE),cpgy=Math.floor(player.y/TILE);
  if (inBounds(cpgx,cpgy)&&grid[cpgy][cpgx]===TILE_CHECKPOINT) {
    if (!checkpointPos||checkpointPos.gx!==cpgx||checkpointPos.gy!==cpgy) {
      checkpointPos={
        gx:cpgx, gy:cpgy,
        savedTimer: playTimer,
        // Snapshot collected state at this checkpoint
        savedCoins: playCoins.map(c=>({...c})),
        savedKeys: playKeys.map(k=>({...k})),
        savedCollectedKeyIds: new Set(collectedKeyIds),
        savedDoors: playDoors.map(d=>({...d})),
      };
    }
  }

  // Teleport collision — fires once per entry (no cooldown timer, just track last tile)
  if (inBounds(pgx,pgy) && grid[pgy][pgx]===TILE_TELEPORT) {
    const srcKey=pgx+','+pgy;
    if (player._lastTpTile !== srcKey) {
      const destKey=teleportLinks[srcKey];
      if (destKey) {
        const [dc,dr]=destKey.split(',').map(Number);
        const dest=tileCenter(dc,dr);
        player.x=dest.px; player.y=dest.py;
        player._lastTpTile=destKey; // track destination tile so we don't instantly loop back
        playerVx=0; playerVy=0; playerOnIce=false;
      }
    }
  } else {
    player._lastTpTile = null; // reset when off all teleport tiles
  }

  // Kill tile collision
  if (inBounds(pgx,pgy) && grid[pgy][pgx] === TILE_KILL) { die(); return; }

  // Enemy collision
  if (deathCooldown>0) { deathCooldown-=dt; }
  else {
    for (const en of playEnemies) {
      if (Math.hypot(player.x-en.px,player.y-en.py)<ENEMY_RADIUS+half-3) { die();return; }
    }
  }

  // Goal
  if (inBounds(pgx,pgy)&&grid[pgy][pgx]===TILE_GOAL&&playCoins.length===0) { win();return; }

  updateHUD();
}

function flashMsg(msg,ms) {
  document.getElementById('hud-msg').textContent=msg;
  setTimeout(()=>{if (playMode) document.getElementById('hud-msg').textContent='';},ms);
}

function die() {
  deaths++;playerDying=true;
  const flash=document.getElementById('death-flash');
  flash.classList.remove('active');void flash.offsetWidth;flash.classList.add('active');
  setTimeout(()=>{
    if (!playMode) return;
    playerDying=false;
    deathCooldown=0.6;

    const cp=checkpointPos, d=deaths;

    if (cp && cp.savedCoins) {
      // Restore state from checkpoint snapshot (coins/keys collected up to checkpoint are kept gone)
      playCoins = cp.savedCoins.map(c=>({...c}));
      playKeys  = cp.savedKeys.map(k=>({...k}));
      collectedKeyIds = new Set(cp.savedCollectedKeyIds);
      playDoors = cp.savedDoors.map(d=>({...d}));
      // Rebuild only enemies (they reset on death)
      playEnemies=enemies.map(en=>{
        const hasTrigger=!!(en.triggerIds&&en.triggerIds.length);
        if (en.type==='orbit') {
          const a=(en.startAngle||0)*Math.PI/180;
          const baseSpeed=(2*Math.PI)/(en.orbitDuration||4)*(en.clockwise!==false?1:-1);
          const orbitBounce=en.orbitBounce===true;
          const bounceLoops=en.orbitBounceLoops||1;
          return{...en,angle:a,angularSpeed:baseSpeed,_orbitBaseSpeed:baseSpeed,_orbitBounce:orbitBounce,_bounceLoops:bounceLoops,_bounceAccum:0,px:en.cx+Math.cos(a)*en.radius,py:en.cy+Math.sin(a)*en.radius,triggered:!hasTrigger};
        } else if (en.type==='follower') {
          const tc=tileCenter(en.gx||0,en.gy||0);
          return{...en,px:en.spawnX||tc.px,py:en.spawnY||tc.py,triggered:!hasTrigger};
        } else {
          const len=totalPathLength(en),sp=positionAlongPath(en,en.phase||0);
          const speed=len>0?len/(en.duration||3):60;
          const dir=en.forward!==false?1:-1;
          return{...en,px:sp.px,py:sp.py,t:(en.phase||0)*len,dir,speed,len,triggered:!hasTrigger};
        }
      });
      checkpointPos=cp; deaths=d; playTimer=cp.savedTimer||0;
    } else {
      // No checkpoint: full reset including timer
      buildPlayState(); deaths=d; playTimer=0;
    }

    const spawn = checkpointPos||playerSpawn;
    const c2=tileCenter(spawn.gx,spawn.gy);
    player={x:c2.px,y:c2.py};playerVx=0;playerVy=0;
    playerOnIce=false;iceLockedVx=0;iceLockedVy=0;
    deathCooldown=0.6;
    document.getElementById('hud-msg').textContent='';
    updateHUD();
  },500);
}

// win(), btn-win handlers defined in hub section below

function moveAxis(cx,cy,dx,dy) {
  const nx=cx+dx,ny=cy+dy,h=PLAYER_SIZE/2-1;
  const corners=[{x:nx-h,y:ny-h},{x:nx+h,y:ny-h},{x:nx-h,y:ny+h},{x:nx+h,y:ny+h}];
  for (const c of corners) {
    const gx=Math.floor(c.x/TILE),gy=Math.floor(c.y/TILE);
    if (!inBounds(gx,gy)) return {x:cx,y:cy};
    if (grid[gy][gx]===TILE_WALL) return {x:cx,y:cy};
    const pd=playDoors.find(d=>d.gx===gx&&d.gy===gy);
    if (pd&&!pd.open) return {x:cx,y:cy};
  }
  return {x:nx,y:ny};
}

function updateHUD() {
  document.getElementById('hud-deaths').textContent=`Deaths: ${deaths}`;
  const total=coins.length,remaining=playCoins.length;
  document.getElementById('hud-coins').textContent=`Coins: ${total-remaining}/${total}`;
  const hk=document.getElementById('hud-keys');
  if (keys.length>0){hk.classList.remove('hidden');hk.textContent=`Keys: ${collectedKeyIds.size}/${keys.length}`;}
  else hk.classList.add('hidden');
}


// -------------------------------------------------------
// SUPABASE CONFIG
// -------------------------------------------------------
const SUPABASE_URL = 'https://comhpjwpjklhbcubaylw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNvbWhwandwamtsaGJjdWJheWx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTc3MjgsImV4cCI6MjA4Nzc5MzcyOH0.0CWSA29Sq_no-06nwEMNdy5sMMMPOeyjOrZvFi6SEEc';
const SUPABASE_HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_KEY,
  'Authorization': 'Bearer ' + SUPABASE_KEY
};

// -------------------------------------------------------
// USER AUTH STATE  (username + password only, no email)
// -------------------------------------------------------
var currentUser      = null;  // { id, username }
var onlineLevels     = [];
var beatenLevelIds   = new Set();
var likedLevelIds    = new Set();
var dislikedLevelIds = new Set();

var BEATEN_LS_KEY = 'df_beaten_';
var BEATEN_GUEST_KEY = 'df_beaten_guest';
var SESSION_KEY   = 'df_session_v2';

async function hashPassword(pw) {
  var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}
function saveSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({id: user.id, username: user.username}));
}
function clearSession() { localStorage.removeItem(SESSION_KEY); }

function loadBeaten() {
  try {
    if (currentUser) {
      var raw = localStorage.getItem(BEATEN_LS_KEY + currentUser.id);
      var userBeaten = raw ? new Set(JSON.parse(raw)) : new Set();
      // Merge guest beaten into user beaten
      try {
        var gRaw = localStorage.getItem(BEATEN_GUEST_KEY);
        if (gRaw) { JSON.parse(gRaw).forEach(function(id) { userBeaten.add(id); }); }
      } catch(e) {}
      beatenLevelIds = userBeaten;
      saveBeaten(); // persist merged result
    } else {
      var gRaw2 = localStorage.getItem(BEATEN_GUEST_KEY);
      beatenLevelIds = gRaw2 ? new Set(JSON.parse(gRaw2)) : new Set();
    }
  } catch(e) { beatenLevelIds = new Set(); }
}
function saveBeaten() {
  if (currentUser) {
    localStorage.setItem(BEATEN_LS_KEY + currentUser.id, JSON.stringify([...beatenLevelIds]));
  } else {
    localStorage.setItem(BEATEN_GUEST_KEY, JSON.stringify([...beatenLevelIds]));
  }
}
function markLevelBeaten(supabaseId) {
  if (!supabaseId) return;
  var sid = String(supabaseId);
  if (beatenLevelIds.has(sid)) return; // already beaten, no need to refresh UI
  beatenLevelIds.add(sid);
  saveBeaten();
  // Update the card immediately without full re-render
  renderHubOnline();
}

function loadVotes() {
  if (!currentUser) { likedLevelIds = new Set(); dislikedLevelIds = new Set(); return; }
  try {
    var lr = localStorage.getItem('df_likes_'    + currentUser.id);
    var dr = localStorage.getItem('df_dislikes_' + currentUser.id);
    likedLevelIds    = lr ? new Set(JSON.parse(lr)) : new Set();
    dislikedLevelIds = dr ? new Set(JSON.parse(dr)) : new Set();
  } catch(e) { likedLevelIds = new Set(); dislikedLevelIds = new Set(); }
}
function saveVotes() {
  if (!currentUser) return;
  localStorage.setItem('df_likes_'    + currentUser.id, JSON.stringify([...likedLevelIds]));
  localStorage.setItem('df_dislikes_' + currentUser.id, JSON.stringify([...dislikedLevelIds]));
}
async function voteLevel(supabaseId, realIdx, vote) {
  var sid = String(supabaseId);
  var wasLiked    = likedLevelIds.has(sid);
  var wasDisliked = dislikedLevelIds.has(sid);
  var ld = 0, dd = 0;
  if (vote === 'like') {
    if (wasLiked)    { likedLevelIds.delete(sid);    ld = -1; }
    else             { likedLevelIds.add(sid);        ld =  1; if (wasDisliked) { dislikedLevelIds.delete(sid); dd = -1; } }
  } else {
    if (wasDisliked) { dislikedLevelIds.delete(sid); dd = -1; }
    else             { dislikedLevelIds.add(sid);    dd =  1; if (wasLiked) { likedLevelIds.delete(sid); ld = -1; } }
  }
  saveVotes();
  var lv = onlineLevels[realIdx];
  lv._likes    = Math.max(0, (lv._likes    || 0) + ld);
  lv._dislikes = Math.max(0, (lv._dislikes || 0) + dd);
  renderHubOnline();
  try {
    await fetch(SUPABASE_URL + '/rest/v1/levels?id=eq.' + supabaseId, {
      method: 'PATCH',
      headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'}),
      body: JSON.stringify({likes: lv._likes, dislikes: lv._dislikes})
    });
  } catch(e) {}
}
// -------------------------------------------------------
// ADMIN STATE
// -------------------------------------------------------
let isAdminLoggedIn = false;
const ADMIN_USERNAMES = []; // add your username here for automatic admin access

function adminAuthHeaders() { return SUPABASE_HEADERS; }

// -------------------------------------------------------
// HUB SCREEN — main entry point
// -------------------------------------------------------
function showHub() {
  if (playMode) stopPlay();
  if (currentLevelIdx >= 0 && levelCollection.length > 0) saveCurrentEditorState();
  document.getElementById('editor-screen').classList.add('hidden');
  document.getElementById('upload-modal').classList.add('hidden');
  const floatBtn = document.getElementById('online-float-exit');
  if (floatBtn) floatBtn.style.display = 'none';
  document.getElementById('hub-screen').style.display = '';
  // If not in a room, make sure panels are visible and lobby is hidden
  if (!MP || !MP.roomCode) {
    document.getElementById('hub-panels').style.display = '';
    document.getElementById('hub-lobby').classList.add('hidden');
    document.getElementById('mp-results-overlay').classList.add('hidden');
  }
  renderHubMyLevels();
  renderHubOnline();
  updateHubAccountBar();
  refreshInboxBadge();
}

// Back button from editor goes to hub
document.getElementById('btn-home').addEventListener('click', function() {
  if (_onlineTempLevel) { exitOnlinePlay(); return; }
  showHub();
});

// Generic modal cancel button
document.getElementById('modal-cancel').addEventListener('click', function() {
  document.getElementById('modal-overlay').classList.add('hidden');
});
// Also close modal if user clicks the dark overlay backdrop
document.getElementById('modal-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.classList.add('hidden');
});

// -------------------------------------------------------
// HUB — MY LEVELS panel
// -------------------------------------------------------
function renderHubMyLevels() {
  const list  = document.getElementById('hub-my-levels-list');
  const empty = document.getElementById('hub-my-empty');
  list.innerHTML = '';
  if (!levelCollection.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  levelCollection.forEach(function(lv, idx) {
    const card = document.createElement('div');
    card.className = 'hub-level-card';
    const coinCount  = (lv.coins||[]).length;
    const enemyCount = (lv.enemies||[]).length;
    const meta = [(lv.COLS||28)+'x'+(lv.ROWS||18),
      coinCount  ? coinCount+' coin'+(coinCount!==1?'s':'')   : '',
      enemyCount ? enemyCount+' enem'+(enemyCount!==1?'ies':'y') : '',
    ].filter(Boolean).join(' · ');

    card.innerHTML =
      '<div class="hub-level-num">'+(idx+1)+'</div>'+
      '<div class="hub-level-info">'+
        '<div class="hub-level-name">'+escHtml(lv.name||'Untitled')+'</div>'+
        '<div class="hub-level-meta">'+meta+'</div>'+
      '</div>'+
      '<div class="hub-level-btns">'+
        '<button class="hub-level-btn btn-play" title="Play">Play</button>'+
        '<button class="hub-level-btn" title="Edit">Edit</button>'+
        '<button class="hub-level-btn" title="Duplicate">Copy</button>'+
        '<button class="hub-level-btn btn-del" title="Delete">Del</button>'+
      '</div>';

    card.querySelector('.btn-play').addEventListener('click', function(e) { e.stopPropagation(); hubPlayLocal(idx); });
    card.querySelectorAll('.hub-level-btn')[1].addEventListener('click', function(e) { e.stopPropagation(); openEditorFromHub(idx); });
    card.querySelectorAll('.hub-level-btn')[2].addEventListener('click', function(e) { e.stopPropagation(); hubDuplicateLevel(idx); });
    card.querySelector('.btn-del').addEventListener('click', function(e) { e.stopPropagation(); hubDeleteLevel(idx); });
    card.addEventListener('click', function() { openEditorFromHub(idx); });
    list.appendChild(card);
  });
}

function openEditorFromHub(idx) {
  currentLevelIdx = idx;
  document.getElementById('hub-screen').style.display = 'none';
  document.getElementById('editor-screen').classList.remove('hidden');
  // Wait for the browser to finish layout after unhiding the editor
  // (if we call resizeCanvas while display:none, clientWidth=0 → corrupts the level)
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      loadLevelIntoEditor(levelCollection[idx]);
    });
  });
}

function hubPlayLocal(idx) {
  currentLevelIdx = idx;
  document.getElementById('hub-screen').style.display = 'none';
  document.getElementById('editor-screen').classList.remove('hidden');
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      loadLevelIntoEditor(levelCollection[idx]);
      startPlay();
    });
  });
}

function hubDuplicateLevel(idx) {
  const copy = JSON.parse(JSON.stringify(levelCollection[idx]));
  copy.id = nextLevelId++; copy.name = copy.name + ' copy';
  levelCollection.splice(idx+1, 0, copy);
  scheduleAutoSave(); renderHubMyLevels();
  setStatus('Duplicated.');
}
function hubDeleteLevel(idx) {
  if (!confirm('Delete "'+levelCollection[idx].name+'"?')) return;
  levelCollection.splice(idx, 1);
  if (currentLevelIdx >= levelCollection.length) currentLevelIdx = Math.max(0, levelCollection.length-1);
  scheduleAutoSave(); renderHubMyLevels();
}

document.getElementById('hub-btn-new-level').addEventListener('click', function() {
  const lv = blankLevelData('Level ' + (levelCollection.length + 1));
  levelCollection.push(lv);
  scheduleAutoSave();
  openEditorFromHub(levelCollection.length - 1);
});

// -------------------------------------------------------
// AUTH MODAL
// -------------------------------------------------------
document.getElementById('auth-tab-login').addEventListener('click', function() {
  this.classList.add('active');
  document.getElementById('auth-tab-register').classList.remove('active');
  document.getElementById('auth-login-form').classList.remove('hidden');
  document.getElementById('auth-register-form').classList.add('hidden');
});
document.getElementById('auth-tab-register').addEventListener('click', function() {
  this.classList.add('active');
  document.getElementById('auth-tab-login').classList.remove('active');
  document.getElementById('auth-register-form').classList.remove('hidden');
  document.getElementById('auth-login-form').classList.add('hidden');
});
function showAuthModal(defaultTab) {
  document.getElementById('auth-modal').classList.remove('hidden');
  if (defaultTab === 'register') document.getElementById('auth-tab-register').click();
  else document.getElementById('auth-tab-login').click();
  document.getElementById('auth-error').classList.add('hidden');
  document.getElementById('auth-reg-error').classList.add('hidden');
}
function closeAuthModal() { document.getElementById('auth-modal').classList.add('hidden'); }
function continueAsGuest() { closeAuthModal(); updateHubAccountBar(); }
document.getElementById('auth-btn-guest').addEventListener('click', continueAsGuest);
document.getElementById('auth-btn-guest-2').addEventListener('click', continueAsGuest);

// LOGIN
document.getElementById('auth-btn-login').addEventListener('click', async function() {
  var username = document.getElementById('auth-email').value.trim();
  var password = document.getElementById('auth-password').value;
  var errEl    = document.getElementById('auth-error');
  errEl.classList.add('hidden');
  if (!username || !password) { errEl.textContent = 'Please fill in both fields.'; errEl.classList.remove('hidden'); return; }
  this.textContent = 'Signing in...'; this.disabled = true;
  try {
    var hashed = await hashPassword(password);
    var resp = await fetch(
      SUPABASE_URL + '/rest/v1/users?username=eq.' + encodeURIComponent(username) +
      '&password=eq.' + encodeURIComponent(hashed) + '&select=id,username',
      { headers: SUPABASE_HEADERS }
    );
    var rows = await resp.json();
    if (!resp.ok) throw new Error('DB error ' + resp.status);
    if (!Array.isArray(rows) || !rows.length) {
      errEl.textContent = 'Wrong username or password.'; errEl.classList.remove('hidden');
    } else {
      finishLogin(rows[0]); closeAuthModal();
    }
  } catch(e) { errEl.textContent = 'Error: ' + e.message; errEl.classList.remove('hidden'); }
  finally { this.textContent = 'Sign In'; this.disabled = false; }
});

// REGISTER
document.getElementById('auth-btn-register').addEventListener('click', async function() {
  var username = document.getElementById('auth-reg-username').value.trim();
  var password = document.getElementById('auth-reg-password').value;
  var errEl    = document.getElementById('auth-reg-error');
  errEl.classList.add('hidden'); errEl.style.color = '';
  if (!username || !password) { errEl.textContent = 'Please fill in all fields.'; errEl.classList.remove('hidden'); return; }
  if (username.length < 2) { errEl.textContent = 'Username must be at least 2 characters.'; errEl.classList.remove('hidden'); return; }
  if (password.length < 4) { errEl.textContent = 'Password must be at least 4 characters.'; errEl.classList.remove('hidden'); return; }
  this.textContent = 'Creating...'; this.disabled = true;
  try {
    var checkResp = await fetch(
      SUPABASE_URL + '/rest/v1/users?username=eq.' + encodeURIComponent(username) + '&select=id',
      { headers: SUPABASE_HEADERS }
    );
    var existing = await checkResp.json();
    if (!checkResp.ok) throw new Error('DB error ' + checkResp.status);
    if (Array.isArray(existing) && existing.length > 0) {
      errEl.textContent = 'Username already taken.'; errEl.classList.remove('hidden'); return;
    }
    var hashed = await hashPassword(password);
    var insResp = await fetch(SUPABASE_URL + '/rest/v1/users', {
      method: 'POST',
      headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=representation'}),
      body: JSON.stringify({username: username, password: hashed})
    });
    var insData = await insResp.json();
    if (!insResp.ok) {
      var m = Array.isArray(insData) ? insData[0] : insData;
      throw new Error(m.message || m.details || ('Status ' + insResp.status));
    }
    finishLogin(Array.isArray(insData) ? insData[0] : insData);
    closeAuthModal();
  } catch(e) { errEl.textContent = 'Error: ' + e.message; errEl.classList.remove('hidden'); }
  finally { this.textContent = 'Create Account'; this.disabled = false; }
});

function finishLogin(user) {
  currentUser = {id: user.id, username: user.username};
  saveSession(currentUser);
  isAdminLoggedIn = ADMIN_USERNAMES.includes(user.username);
  loadBeaten(); loadVotes();
  updateHubAccountBar(); renderHubOnline();
  updateInboxTabs(); refreshInboxBadge();
}
function signOut() {
  currentUser = null; clearSession(); isAdminLoggedIn = false;
  beatenLevelIds = new Set(); likedLevelIds = new Set(); dislikedLevelIds = new Set();
  loadBeaten(); // re-load guest beaten
  updateHubAccountBar(); renderHubOnline();
  updateInboxTabs(); refreshInboxBadge();
}
function updateHubAccountBar() {
  var nameEl    = document.getElementById('hub-account-name');
  var loginBtn  = document.getElementById('hub-btn-login');
  var regBtn    = document.getElementById('hub-btn-register');
  var outBtn    = document.getElementById('hub-btn-logout');
  var uploadsBtn= document.getElementById('hub-btn-my-uploads');
  var uploadBtn = document.getElementById('hub-btn-upload');
  if (currentUser) {
    nameEl.textContent = currentUser.username;
    loginBtn.classList.add('hidden'); regBtn.classList.add('hidden');
    outBtn.classList.remove('hidden'); uploadsBtn.classList.remove('hidden'); uploadBtn.classList.remove('hidden');
  } else {
    nameEl.textContent = '';
    loginBtn.classList.remove('hidden'); regBtn.classList.remove('hidden');
    outBtn.classList.add('hidden'); uploadsBtn.classList.add('hidden'); uploadBtn.classList.add('hidden');
  }
  var adminBtn = document.getElementById('hub-btn-admin');
  if (isAdminLoggedIn) {
    adminBtn.textContent = 'Admin: ON'; adminBtn.style.background = '#1a6a1a';
    adminBtn.onclick = function() { adminLogout(); };
  } else {
    adminBtn.textContent = 'Admin'; adminBtn.style.background = '';
    adminBtn.onclick = function() { promptAdminLogin(); };
  }
}
document.getElementById('hub-btn-login').addEventListener('click', function() { showAuthModal('login'); });
document.getElementById('hub-btn-register').addEventListener('click', function() { showAuthModal('register'); });
document.getElementById('hub-btn-logout').addEventListener('click', signOut);
var _mobileControlsBtn = document.getElementById('hub-btn-mobile-controls');
if (_mobileControlsBtn) _mobileControlsBtn.addEventListener('click', toggleMobileControls);

// -------------------------------------------------------
// MY UPLOADS MODAL
// -------------------------------------------------------
document.getElementById('hub-btn-my-uploads').addEventListener('click', openMyUploads);
document.getElementById('my-uploads-close').addEventListener('click', function() {
  document.getElementById('my-uploads-modal').classList.add('hidden');
});

async function openMyUploads() {
  if (!currentUser) return;
  const modal   = document.getElementById('my-uploads-modal');
  const listEl  = document.getElementById('my-uploads-list');
  const emptyEl = document.getElementById('my-uploads-empty');
  const loadEl  = document.getElementById('my-uploads-loading');
  modal.classList.remove('hidden');
  listEl.innerHTML = '';
  emptyEl.classList.add('hidden');
  loadEl.classList.remove('hidden');
  try {
    const resp = await fetch(
      SUPABASE_URL + '/rest/v1/levels?user_id=eq.' + currentUser.id + '&select=*&order=created_at.desc',
      { headers: SUPABASE_HEADERS }
    );
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const rows = await resp.json();
    loadEl.classList.add('hidden');
    if (!rows.length) { emptyEl.classList.remove('hidden'); return; }
    rows.forEach(function(row) {
      const card = document.createElement('div');
      card.className = 'my-upload-card';
      const diff = row.difficulty || 0;
      const featured = row.featured ? ' [Featured]' : '';
      card.innerHTML =
        '<div class="my-upload-info">'+
          '<div class="my-upload-name">'+escHtml(row.name||'Untitled')+featured+'</div>'+
          '<div class="my-upload-meta">Difficulty: '+(diff||'Not set')+' &nbsp;&middot;&nbsp; '+new Date(row.created_at).toLocaleDateString()+'</div>'+
        '</div>'+
        '<div class="my-upload-stats">'+
          '<div class="my-upload-stat"><span class="my-upload-stat-val">'+(row.likes||0)+'</span><span class="my-upload-stat-lbl">Likes</span></div>'+
          '<div class="my-upload-stat"><span class="my-upload-stat-val">'+(row.dislikes||0)+'</span><span class="my-upload-stat-lbl">Dislikes</span></div>'+
        '</div>';
      listEl.appendChild(card);
    });
  } catch(e) {
    loadEl.classList.add('hidden');
    listEl.innerHTML = '<div class="hub-empty hub-empty-text" style="padding:20px;">Could not load: '+e.message+'</div>';
  }
}

// -------------------------------------------------------
// ADMIN
// -------------------------------------------------------
function promptAdminLogin() {
  const body = document.getElementById('modal-body');
  body.innerHTML =
    '<div style="display:flex;flex-direction:column;gap:10px;">'+
    '<label style="font-size:9px;font-weight:900;color:#5577aa;letter-spacing:1px;text-transform:uppercase;">Username</label>'+
    '<input type="text" id="admin-login-user" placeholder="Your username" style="padding:9px 12px;background:#141c34;border:1px solid #2a3a6a;color:#c8d8f0;border-radius:3px;font-size:13px;font-weight:700;font-family:inherit;outline:none;" autocomplete="username"/>'+
    '<label style="font-size:9px;font-weight:900;color:#5577aa;letter-spacing:1px;text-transform:uppercase;">Password</label>'+
    '<input type="password" id="admin-login-pass" placeholder="Password" style="padding:9px 12px;background:#141c34;border:1px solid #2a3a6a;color:#c8d8f0;border-radius:3px;font-size:13px;font-weight:700;font-family:inherit;outline:none;" autocomplete="current-password"/>'+
    '<p id="admin-login-error" style="color:#ff6060;display:none;margin:0;font-size:12px;font-family:Arial,sans-serif;"></p>'+
    '</div>';
  document.getElementById('modal-title').textContent = 'Admin Login';
  document.getElementById('modal-confirm').textContent = 'Sign In';
  document.getElementById('modal-overlay').classList.remove('hidden');

  body.addEventListener('keydown', function onEnter(e) {
    if (e.key === 'Enter') document.getElementById('modal-confirm').click();
  });

  document.getElementById('modal-confirm').onclick = async function() {
    const username = document.getElementById('admin-login-user').value.trim();
    const password = document.getElementById('admin-login-pass').value;
    const errEl    = document.getElementById('admin-login-error');
    errEl.style.display = 'none';
    if (!username || !password) { errEl.textContent = 'Please fill in both fields.'; errEl.style.display = ''; return; }
    const btn = this;
    btn.textContent = 'Signing in...'; btn.disabled = true;
    try {
      const hashed = await hashPassword(password);
      const resp = await fetch(
        SUPABASE_URL + '/rest/v1/users?username=eq.' + encodeURIComponent(username) +
        '&password=eq.' + encodeURIComponent(hashed) + '&select=id,username,is_admin',
        { headers: SUPABASE_HEADERS }
      );
      const rows = await resp.json();
      if (!resp.ok) throw new Error('DB error ' + resp.status);
      if (!Array.isArray(rows) || !rows.length) {
        errEl.textContent = 'Wrong username or password.'; errEl.style.display = ''; return;
      }
      if (!rows[0].is_admin) {
        errEl.textContent = 'This account does not have admin access.'; errEl.style.display = ''; return;
      }
      isAdminLoggedIn = true;
      document.getElementById('modal-overlay').classList.add('hidden');
      updateHubAccountBar();
      renderHubOnline();
      alert('Admin mode on.');
    } catch(e) {
      errEl.textContent = 'Error: ' + e.message; errEl.style.display = '';
    } finally {
      btn.textContent = 'Sign In'; btn.disabled = false;
    }
  };
}

function adminLogout() {
  isAdminLoggedIn = false;
  updateHubAccountBar();
  renderHubOnline();
}

async function adminDeleteLevel(supabaseId, idx) {
  if (!isAdminLoggedIn) return;
  if (!confirm('Delete this level permanently?')) return;
  try {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/levels?id=eq.' + supabaseId, {
      method: 'DELETE', headers: Object.assign({}, adminAuthHeaders(), { 'Prefer': 'return=minimal' })
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => resp.status);
      throw new Error('HTTP ' + resp.status + ' — ' + txt + '\n\nMake sure RLS allows DELETE for the anon/service role on the levels table.');
    }
    // Remove from local array by supabase id (not idx which may have shifted)
    onlineLevels = onlineLevels.filter(lv => String(lv._supabase_id) !== String(supabaseId));
    renderHubOnline();
  } catch(e) { alert('Delete failed: ' + e.message); }
}

async function adminCrazyLevel(supabaseId, idx, currentlyCrazy) {
  if (!isAdminLoggedIn) return;
  if (currentlyCrazy) {
    // Remove crazy
    try {
      const resp = await fetch(SUPABASE_URL + '/rest/v1/levels?id=eq.' + supabaseId, {
        method: 'PATCH',
        headers: Object.assign({}, adminAuthHeaders(), { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ crazy: false, crazy_points: 0 })
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      onlineLevels[idx]._crazy = false;
      onlineLevels[idx]._crazy_points = 0;
      renderHubOnline();
    } catch(e) { alert('Failed: ' + e.message); }
    return;
  }
  // Cannot be both crazy and unreal
  if (onlineLevels[idx]._unreal) { alert('This level is already UNREAL. Remove Unreal first.'); return; }
  // Set crazy — prompt for points
  const input = prompt('Set CRAZY points (1–10):', onlineLevels[idx]._crazy_points || 5);
  if (input === null) return;
  const pts = Math.max(1, Math.min(10, parseInt(input) || 5));
  try {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/levels?id=eq.' + supabaseId, {
      method: 'PATCH',
      headers: Object.assign({}, adminAuthHeaders(), { 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ crazy: true, crazy_points: pts })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    onlineLevels[idx]._crazy = true;
    onlineLevels[idx]._crazy_points = pts;
    renderHubOnline();
  } catch(e) { alert('Failed: ' + e.message); }
}

async function adminImpossibleLevel(supabaseId, idx, currentlyImpossible) {
  if (!isAdminLoggedIn) return;
  if (currentlyImpossible) {
    try {
      const resp = await fetch(SUPABASE_URL + '/rest/v1/levels?id=eq.' + supabaseId, {
        method: 'PATCH',
        headers: Object.assign({}, adminAuthHeaders(), { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ impossible: false, impossible_points: 0 })
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(()=>'');
        if (txt.includes('column') || txt.includes('impossible')) {
          alert('The "impossible" columns are missing.\n\nRun:\nALTER TABLE levels ADD COLUMN IF NOT EXISTS impossible boolean DEFAULT false;\nALTER TABLE levels ADD COLUMN IF NOT EXISTS impossible_points integer DEFAULT 0;');
          return;
        }
        throw new Error('HTTP ' + resp.status);
      }
      onlineLevels[idx]._impossible = false;
      onlineLevels[idx]._impossible_points = 0;
      renderHubOnline();
    } catch(e) { alert('Failed: ' + e.message); }
    return;
  }
  // Cannot combine with crazy or unreal
  if (onlineLevels[idx]._crazy) { alert('Remove CRAZY first.'); return; }
  if (onlineLevels[idx]._unreal) { alert('Remove UNREAL first.'); return; }
  const input = prompt('Set IMPOSSIBLE points (1-10):', onlineLevels[idx]._impossible_points || 10);
  if (input === null) return;
  const pts = Math.max(1, Math.min(10, parseInt(input) || 10));
  try {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/levels?id=eq.' + supabaseId, {
      method: 'PATCH',
      headers: Object.assign({}, adminAuthHeaders(), { 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ impossible: true, impossible_points: pts })
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(()=>'');
      if (txt.includes('column') || txt.includes('impossible')) {
        alert('Missing columns. Run:\nALTER TABLE levels ADD COLUMN IF NOT EXISTS impossible boolean DEFAULT false;\nALTER TABLE levels ADD COLUMN IF NOT EXISTS impossible_points integer DEFAULT 0;');
        return;
      }
      throw new Error('HTTP ' + resp.status);
    }
    onlineLevels[idx]._impossible = true;
    onlineLevels[idx]._impossible_points = pts;
    renderHubOnline();
  } catch(e) { alert('Failed: ' + e.message); }
}

async function adminUnrealLevel(supabaseId, idx, currentlyUnreal) {
  if (!isAdminLoggedIn) return;
  if (currentlyUnreal) {
    try {
      const resp = await fetch(SUPABASE_URL + '/rest/v1/levels?id=eq.' + supabaseId, {
        method: 'PATCH',
        headers: Object.assign({}, adminAuthHeaders(), { 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ unreal: false, unreal_points: 0 })
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(()=>'');
        if (txt.includes('column') || txt.includes('unreal')) {
          alert('The "unreal" and "unreal_points" columns are missing from your Supabase levels table.\n\nRun this SQL in your Supabase SQL editor:\n\nALTER TABLE levels ADD COLUMN IF NOT EXISTS unreal boolean DEFAULT false;\nALTER TABLE levels ADD COLUMN IF NOT EXISTS unreal_points integer DEFAULT 0;');
          return;
        }
        throw new Error('HTTP ' + resp.status);
      }
      onlineLevels[idx]._unreal = false;
      onlineLevels[idx]._unreal_points = 0;
      renderHubOnline();
    } catch(e) { alert('Failed: ' + e.message); }
    return;
  }
  // Cannot be both unreal and crazy
  if (onlineLevels[idx]._crazy) { alert('This level is already CRAZY. Remove Crazy first.'); return; }
  const input = prompt('Set UNREAL points (1–10):', onlineLevels[idx]._unreal_points || 10);
  if (input === null) return;
  const pts = Math.max(1, Math.min(10, parseInt(input) || 10));
  try {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/levels?id=eq.' + supabaseId, {
      method: 'PATCH',
      headers: Object.assign({}, adminAuthHeaders(), { 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ unreal: true, unreal_points: pts })
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(()=>'');
      if (txt.includes('column') || txt.includes('unreal')) {
        alert('The "unreal" and "unreal_points" columns are missing from your Supabase levels table.\n\nRun this SQL in your Supabase SQL editor:\n\nALTER TABLE levels ADD COLUMN IF NOT EXISTS unreal boolean DEFAULT false;\nALTER TABLE levels ADD COLUMN IF NOT EXISTS unreal_points integer DEFAULT 0;');
        return;
      }
      throw new Error('HTTP ' + resp.status);
    }
    onlineLevels[idx]._unreal = true;
    onlineLevels[idx]._unreal_points = pts;
    renderHubOnline();
  } catch(e) { alert('Failed: ' + e.message); }
}

async function adminRateLevel(supabaseId, idx) {
  if (!isAdminLoggedIn) return;
  const current = onlineLevels[idx]._admin_rating || 0;
  const input = prompt('Set admin rating 1-5 (0 = clear):', current);
  if (input === null) return;
  const rating = Math.max(0, Math.min(5, parseInt(input) || 0));
  try {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/levels?id=eq.' + supabaseId, {
      method: 'PATCH',
      headers: Object.assign({}, adminAuthHeaders(), { 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ admin_rating: rating })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    onlineLevels[idx]._admin_rating = rating;
    renderHubOnline();
  } catch(e) { alert('Rate failed: ' + e.message); }
}

async function adminFeatureLevel(supabaseId, idx, featured) {
  if (!isAdminLoggedIn) return;
  try {
    const resp = await fetch(SUPABASE_URL + '/rest/v1/levels?id=eq.' + supabaseId, {
      method: 'PATCH',
      headers: Object.assign({}, adminAuthHeaders(), { 'Prefer': 'return=minimal' }),
      body: JSON.stringify({ featured: featured })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    onlineLevels[idx]._featured = featured;
    renderHubOnline();
  } catch(e) { alert('Feature failed: ' + e.message); }
}

// -------------------------------------------------------
// ONLINE FILTER STATE
// -------------------------------------------------------
let onlineFilter = {
  search:   '',
  featured: 'all',
  diffMin:  1,
  diffMax:  10,
  diffAny:  true
};
let filterControlsBound = false;

function bindFilterControls() {
  if (filterControlsBound) return;
  filterControlsBound = true;

  document.getElementById('hub-search').addEventListener('input', function() {
    onlineFilter.search = this.value.trim();
    renderHubOnline();
  });
  ['all','featured','normal','crazy','unreal','impossible'].forEach(function(v) {
    const el = document.getElementById('filter-feat-' + v);
    if (!el) return;
    el.addEventListener('click', function() {
      onlineFilter.featured = v;
      updateFilterBtns();
      renderHubOnline();
    });
  });

  function syncDiff() {
    let mn = parseInt(document.getElementById('filter-diff-min').value) || 1;
    let mx = parseInt(document.getElementById('filter-diff-max').value) || 10;
    if (mn > mx) mx = mn;
    onlineFilter.diffMin = mn; onlineFilter.diffMax = mx;
    document.getElementById('filter-diff-min').value = mn;
    document.getElementById('filter-diff-max').value = mx;
    updateDiffLabel();
    renderHubOnline();
  }
  document.getElementById('filter-diff-min').addEventListener('input', syncDiff);
  document.getElementById('filter-diff-max').addEventListener('input', syncDiff);

  document.getElementById('filter-diff-any').addEventListener('click', function() {
    onlineFilter.diffAny = !onlineFilter.diffAny;
    this.classList.toggle('active', onlineFilter.diffAny);
    renderHubOnline();
  });
}

function updateFilterBtns() {
  ['all','featured','normal','crazy','unreal','impossible'].forEach(function(v) {
    const el = document.getElementById('filter-feat-' + v);
    if (el) el.classList.toggle('active', onlineFilter.featured === v);
  });
}
function updateDiffLabel() {
  const lbl = document.getElementById('filter-diff-label');
  const mn = onlineFilter.diffMin, mx = onlineFilter.diffMax;
  lbl.textContent = (mn === 1 && mx === 10) ? 'Any' : mn + '-' + mx;
}

function getFilteredLevels() {
  const sorted = onlineLevels.slice().sort(function(a, b) {
    // Priority: impossible > unreal > featured > unfeatured, then by likes
    const rankA = a._impossible ? 3 : a._unreal ? 2 : a._featured ? 1 : 0;
    const rankB = b._impossible ? 3 : b._unreal ? 2 : b._featured ? 1 : 0;
    if (rankA !== rankB) return rankB - rankA;
    // Within same rank, sort by likes descending
    return (b._likes || 0) - (a._likes || 0);
  });
  return sorted.filter(function(lv) {
    if (onlineFilter.search) {
      const q = onlineFilter.search.toLowerCase();
      if (!(lv.name||'').toLowerCase().includes(q) && !(lv._supabase_author||'').toLowerCase().includes(q)) return false;
    }
    if (onlineFilter.featured === 'featured'   && !lv._featured)    return false;
    if (onlineFilter.featured === 'normal'     &&  lv._featured)    return false;
    if (onlineFilter.featured === 'crazy'      && !lv._crazy)       return false;
    if (onlineFilter.featured === 'unreal'     && !lv._unreal)      return false;
    if (onlineFilter.featured === 'impossible' && !lv._impossible)  return false;
    const d = lv._difficulty || 0;
    if (d === 0) { if (!onlineFilter.diffAny) return false; }
    else { if (d < onlineFilter.diffMin || d > onlineFilter.diffMax) return false; }
    return true;
  });
}

// -------------------------------------------------------
// LOAD + RENDER ONLINE LEVELS
// -------------------------------------------------------
async function loadOnlineLevels() {
  const listEl   = document.getElementById('hub-online-list');
  const loadEl   = document.getElementById('hub-online-loading');
  const emptyEl  = document.getElementById('hub-online-empty');
  const noresEl  = document.getElementById('hub-online-noresults');
  // clear cards but keep the helper divs
  Array.from(listEl.children).forEach(function(c) {
    if (!c.id) listEl.removeChild(c);
  });
  emptyEl.classList.add('hidden');
  noresEl.classList.add('hidden');
  loadEl.classList.remove('hidden');
  try {
    const resp = await fetch(
      SUPABASE_URL + '/rest/v1/levels?select=*&order=created_at.desc',
      { headers: SUPABASE_HEADERS }
    );
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const rows = await resp.json();
    onlineLevels = rows.map(function(row) {
      const lv = row.data || {};
      lv._supabase_id     = row.id;
      lv._supabase_author = row.author || '';
      lv._user_id         = row.user_id;
      lv._created_at      = row.created_at;
      lv._featured        = row.featured || false;
      lv._crazy           = row.crazy    || false;
      lv._crazy_points    = row.crazy_points || 0;
      lv._unreal          = row.unreal   || false;
      lv._unreal_points   = row.unreal_points || 0;
      lv._impossible      = row.impossible || false;
      lv._impossible_points = row.impossible_points || 0;
      lv._admin_rating    = row.admin_rating || 0;
      lv._difficulty      = row.difficulty || 0;
      lv._likes           = row.likes    || 0;
      lv._dislikes        = row.dislikes || 0;
      return lv;
    });
    loadEl.classList.add('hidden');
    renderHubOnline();
  } catch(e) {
    loadEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    emptyEl.querySelector('.hub-empty-text').textContent = 'Could not load levels: ' + e.message;
  }
}

function renderHubOnline() {
  bindFilterControls();
  const listEl  = document.getElementById('hub-online-list');
  const emptyEl = document.getElementById('hub-online-empty');
  const noresEl = document.getElementById('hub-online-noresults');
  const countEl = document.getElementById('hub-online-count');

  // Remove all level cards (not the helper divs which have IDs)
  Array.from(listEl.children).forEach(function(c) {
    if (!c.id) listEl.removeChild(c);
  });

  if (!onlineLevels.length) {
    emptyEl.classList.remove('hidden');
    noresEl.classList.add('hidden');
    countEl.textContent = 'COMMUNITY LEVELS';
    return;
  }
  emptyEl.classList.add('hidden');

  const filtered = getFilteredLevels();
  if (!filtered.length) {
    noresEl.classList.remove('hidden');
    countEl.textContent = 'COMMUNITY LEVELS (0 / ' + onlineLevels.length + ')';
    return;
  }
  noresEl.classList.add('hidden');
  countEl.textContent = 'COMMUNITY LEVELS (' + filtered.length + ' / ' + onlineLevels.length + ')';

  filtered.forEach(function(lv, displayIdx) {
    var realIdx    = onlineLevels.indexOf(lv);
    var sid        = String(lv._supabase_id);
    var isFeatured = lv._featured  || false;
    var isCrazy    = lv._crazy     || false;
    var crazyPts   = lv._crazy_points || 0;
    var isUnreal   = lv._unreal    || false;
    var unrealPts  = lv._unreal_points || 0;
    var isImpossible = lv._impossible || false;
    var impossiblePts = lv._impossible_points || 0;
    var isBeaten   = beatenLevelIds.has(sid);
    var isLiked    = likedLevelIds.has(sid);
    var isDisliked = dislikedLevelIds.has(sid);
    var coinCount  = (lv.coins||[]).length;
    var enemyCount = (lv.enemies||[]).length;
    var author     = lv._supabase_author || '';
    var diff       = lv._difficulty || 0;
    var likes      = lv._likes    || 0;
    var dislikes   = lv._dislikes || 0;

    var meta = [
      (lv.COLS||28)+'x'+(lv.ROWS||18),
      coinCount  ? coinCount +' coin'+(coinCount!==1?'s':'') : '',
      enemyCount ? enemyCount+' enem'+(enemyCount!==1?'ies':'y') : '',
      lv.timeLimit ? lv.timeLimit+'s' : '',
      author ? 'by '+escHtml(author) : '',
    ].filter(Boolean).join(' · ');

    var diffHtml = '';
    if (diff > 0) {
      var pips = '';
      for (var i = 1; i <= 10; i++) pips += '<span class="diff-pip'+(i<=diff?' filled':'')+'"></span>';
      diffHtml = '<span class="level-diff">'+pips+'<span class="diff-num-label">'+diff+'/10</span></span>';
    }

    var featuredBadge = isFeatured ? '<span class="level-badge badge-featured">Featured</span>' : '';
    var beatenBadge   = isBeaten   ? '<span class="level-badge badge-beaten">Cleared</span>'   : '';
    var crazyBadge    = isCrazy    ? '<span class="level-badge badge-crazy">CRAZY' + (crazyPts>0?' '+crazyPts+'/10':'') + '</span>' : '';
    var unrealBadge   = isUnreal   ? '<span class="level-badge badge-unreal">UNREAL' + (unrealPts>0?' '+unrealPts+'/10':'') + '</span>' : '';
    var impossibleBadge = isImpossible ? '<span class="level-badge badge-impossible">IMPOSSIBLE' + (impossiblePts>0?' '+impossiblePts+'/10':'') + '</span>' : '';

    var classes = 'online-level-card';
    if (isFeatured)   classes += ' is-featured';
    if (isBeaten)     classes += ' is-beaten';
    if (isCrazy)      classes += ' is-crazy';
    if (isUnreal)     classes += ' is-unreal';
    if (isImpossible) classes += ' is-impossible';

    var adminBtns = '';
    if (isAdminLoggedIn) {
      adminBtns =
        '<button class="online-level-btn btn-admin-impossible">'+(isImpossible?'UnImpossible':'IMPOSSIBLE!')+'</button>'+
        '<button class="online-level-btn btn-admin-unreal">'+(isUnreal?'UnUnreal':'UNREAL!')+'</button>'+
        '<button class="online-level-btn btn-admin-crazy">'+(isCrazy?'UnCrazy':'CRAZY!')+'</button>'+
        '<button class="online-level-btn btn-admin-feat">'+(isFeatured?'Unfeat':'Feat')+'</button>'+
        '<button class="online-level-btn btn-admin-del">Del</button>';
    }

    var voteBtns =
      '<button class="vote-btn btn-like'  +(isLiked    ?' voted':'')+'">'+likes   +' ▲</button>'+
      '<button class="vote-btn btn-dislike'+(isDisliked ?' voted':'')+'">'+dislikes+' ▼</button>';

    var reportBtn = '<button class="online-level-btn btn-report" title="Report this level">⚑ Report</button>';

    var card = document.createElement('div');
    card.className = classes;
    card.innerHTML =
      '<div class="online-level-info">'+
        '<div class="online-level-name">'+escHtml(lv.name||'Untitled')+'</div>'+
        '<div class="level-badges-row">'+featuredBadge+beatenBadge+crazyBadge+unrealBadge+impossibleBadge+'</div>'+
        '<div class="online-level-meta">'+meta+'</div>'+
        '<div class="online-level-extras">'+diffHtml+'</div>'+
      '</div>'+
      '<div class="online-level-votes">'+voteBtns+'</div>'+
      '<div class="online-level-btns">'+adminBtns+'<button class="online-level-btn btn-play">Play</button>'+reportBtn+'</div>';

    card.querySelector('.btn-play').addEventListener('click', function(e) { e.stopPropagation(); playOnlineLevel(lv); });
    card.addEventListener('click', function() { playOnlineLevel(lv); });
    card.querySelector('.btn-like').addEventListener('click', function(e) {
      e.stopPropagation();
      if (!currentUser) { showAuthModal('login'); return; }
      voteLevel(lv._supabase_id, realIdx, 'like');
    });
    card.querySelector('.btn-dislike').addEventListener('click', function(e) {
      e.stopPropagation();
      if (!currentUser) { showAuthModal('login'); return; }
      voteLevel(lv._supabase_id, realIdx, 'dislike');
    });
    card.querySelector('.btn-report').addEventListener('click', function(e) {
      e.stopPropagation();
      openReportModal(lv._supabase_id, lv.name || 'Untitled');
    });
    if (isAdminLoggedIn) {
      card.querySelector('.btn-admin-impossible').addEventListener('click', function(e) { e.stopPropagation(); adminImpossibleLevel(lv._supabase_id, realIdx, isImpossible); });
      card.querySelector('.btn-admin-unreal').addEventListener('click', function(e) { e.stopPropagation(); adminUnrealLevel(lv._supabase_id, realIdx, isUnreal); });
      card.querySelector('.btn-admin-crazy').addEventListener('click', function(e) { e.stopPropagation(); adminCrazyLevel(lv._supabase_id, realIdx, isCrazy); });
      card.querySelector('.btn-admin-feat').addEventListener('click',  function(e) { e.stopPropagation(); adminFeatureLevel(lv._supabase_id, realIdx, !isFeatured); });
      card.querySelector('.btn-admin-del').addEventListener('click',   function(e) { e.stopPropagation(); adminDeleteLevel(lv._supabase_id, realIdx); });
    }
    listEl.appendChild(card);
  });
}

document.getElementById('hub-btn-refresh').addEventListener('click', loadOnlineLevels);

// -------------------------------------------------------
// PLAY ONLINE LEVEL
// -------------------------------------------------------
function playOnlineLevel(lv) {
  // Save current editor level before we overwrite the global vars
  if (!_onlineTempLevel && levelCollection.length > 0) saveCurrentEditorState();

  const clone = JSON.parse(JSON.stringify(normalizeLevelData(lv)));
  clone._isOnline     = true;
  clone._supabase_id  = lv._supabase_id;
  _onlineTempLevel = clone;

  document.getElementById('hub-screen').style.display = 'none';
  document.getElementById('editor-screen').classList.remove('hidden');

  COLS = clone.COLS || 28; ROWS = clone.ROWS || 18;
  grid        = JSON.parse(JSON.stringify(clone.grid));
  playerSpawn = { ...clone.playerSpawn };
  coins       = JSON.parse(JSON.stringify(clone.coins   || []));
  enemies     = JSON.parse(JSON.stringify(clone.enemies || []));
  keys        = JSON.parse(JSON.stringify(clone.keys    || []));
  doors       = JSON.parse(JSON.stringify(clone.doors   || []));
  wallColors      = JSON.parse(JSON.stringify(clone.wallColors    || {}));
  killOpacities   = JSON.parse(JSON.stringify(clone.killOpacities || {}));
  teleportLinks   = JSON.parse(JSON.stringify(clone.teleportLinks || {}));
  triggerLinks    = JSON.parse(JSON.stringify(clone.triggerLinks  || {}));
  triggerActions  = JSON.parse(JSON.stringify(clone.triggerActions || {}));
  currentTimeLimit   = clone.timeLimit   || 0;
  currentPlayerSpeed = clone.playerSpeed || 120;
  currentCameraMode  = clone.cameraMode  || 'fixed';
  currentCameraZoom  = clone.cameraZoom  || 2;
  idCounter   = clone.idCounter || 0;
  document.getElementById('current-level-name-input').value = clone.name || '';
  selectedId = null; selectedType = null; undoStack = [];
  resizeCanvas(); drawEditor();

  document.getElementById('topbar-actions').dataset.onlineMode = '1';
  document.getElementById('topbar').style.display = 'none';
  document.getElementById('toolbar').style.display = 'none';
  document.getElementById('statusbar').style.display = 'none';

  let floatBtn = document.getElementById('online-float-exit');
  if (!floatBtn) {
    floatBtn = document.createElement('button');
    floatBtn.id = 'online-float-exit';
    floatBtn.className = 'online-float-exit-btn';
    floatBtn.innerHTML = '&#8592; Back to Online';
    document.getElementById('editor-screen').appendChild(floatBtn);
  }
  floatBtn.style.display = 'none'; // always hidden — use pause menu to exit
  floatBtn.onclick = function() { exitOnlinePlay(); };

  // Show delete button if playing from report inbox (admin only)
  var existingDelBtn = document.getElementById('report-inbox-del-btn');
  if (existingDelBtn) existingDelBtn.remove();
  if (isAdminLoggedIn && clone._fromReportInbox && clone._supabase_id) {
    var delBtn = document.createElement('button');
    delBtn.id = 'report-inbox-del-btn';
    delBtn.className = 'online-float-exit-btn';
    delBtn.style.cssText = 'background:rgba(120,20,20,0.92);right:12px;left:auto;top:12px;';
    delBtn.textContent = 'Delete Level';
    delBtn.onclick = async function() {
      if (!confirm('Permanently delete this level?')) return;
      try {
        var resp = await fetch(SUPABASE_URL + '/rest/v1/levels?id=eq.' + clone._supabase_id, {
          method: 'DELETE',
          headers: Object.assign({}, adminAuthHeaders(), { 'Prefer': 'return=minimal' })
        });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        onlineLevels = onlineLevels.filter(function(lv) { return String(lv._supabase_id) !== String(clone._supabase_id); });
        exitOnlinePlay();
      } catch(e) { alert('Delete failed: ' + e.message); }
    };
    document.getElementById('editor-screen').appendChild(delBtn);
  }

  startPlayOnline();
}

function exitOnlinePlay() {
  if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
  playMode = false;

  document.getElementById('topbar-actions').dataset.onlineMode = '0';
  document.getElementById('topbar').style.display = '';
  document.getElementById('toolbar').style.display = '';
  document.getElementById('statusbar').style.display = '';

  const floatBtn = document.getElementById('online-float-exit');
  if (floatBtn) floatBtn.style.display = 'none';
  var repDelBtn2 = document.getElementById('report-inbox-del-btn');
  if (repDelBtn2) repDelBtn2.remove();
  document.getElementById('win-overlay').classList.add('hidden');
  canvas.style.cursor = 'crosshair';
  playerDying = false; playerOnIce = false;
  document.getElementById('death-flash').classList.remove('active');
  document.getElementById('editor-screen').classList.add('hidden');
  document.getElementById('hub-screen').style.display = '';

  // Restore the editor level BEFORE clearing _onlineTempLevel,
  // so any subsequent saveCurrentEditorState calls write into the correct level.
  if (levelCollection.length > 0) loadLevelIntoEditor(levelCollection[currentLevelIdx]);
  _onlineTempLevel = null;
  renderHubOnline();  // refresh to show newly beaten levels
}

function startPlayOnline() {
  playMode = true;
  if (pathMode) exitPathMode(true);
  if (centerMode) exitCenterMode();
  if (linkDoorMode) exitLinkDoorMode();
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('win-overlay').classList.add('hidden');
  var floatPause = document.getElementById('btn-pause-float');
  if (floatPause) floatPause.classList.remove('hidden');
  deaths = 0; playTimer = 0;
  buildPlayState(); lastTime = 0;
  canvas.style.cursor = 'default';
  document.getElementById('statusbar').style.display = 'none';
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(function(ts) { lastTime = ts; gameLoop(ts); });
}

// -------------------------------------------------------
// WIN — mark level as beaten for online levels
// -------------------------------------------------------
function win() {
  cancelAnimationFrame(animFrameId); animFrameId = null;
  playMode = false;
  const finalTime = playTimer;
  const lv = getCurrentLevel();

  // Mark beaten if it's an online level
  if (lv && lv._isOnline && lv._supabase_id) {
    markLevelBeaten(lv._supabase_id);
  }

  document.getElementById('win-level-name').textContent = lv ? lv.name : '';
  document.getElementById('win-deaths').textContent  = deaths;
  document.getElementById('win-time').textContent    = formatTime(finalTime);

  // Show coins stat if level had coins
  const totalCoins = coins.length;
  const coinStatEl = document.getElementById('win-stat-coins');
  if (totalCoins > 0) {
    coinStatEl.style.display = '';
    document.getElementById('win-coins').textContent = totalCoins + '/' + totalCoins;
  } else {
    coinStatEl.style.display = 'none';
  }

  // Show/hide online cleared banner
  const winTitle = document.getElementById('win-title');
  if (lv && lv._isOnline) {
    winTitle.textContent = '[ LEVEL CLEARED! ]';
    winTitle.style.background = 'linear-gradient(180deg, #1a6a1a, #2acc44)';
    winTitle.style.animation = 'winTitlePulse 1s ease-in-out infinite alternate';
  } else {
    winTitle.textContent = 'Level Complete!';
    winTitle.style.background = '';
    winTitle.style.animation = '';
  }

  document.getElementById('win-overlay').classList.remove('hidden');
}

// Pause menu buttons
var _pauseResumeBtn = document.getElementById('btn-pause-resume');
var _pauseExitBtn = document.getElementById('btn-pause-exit');
var _pauseRestartBtn = document.getElementById('btn-pause-restart');
var _pauseFloatBtn = document.getElementById('btn-pause-float');
if (_pauseFloatBtn) _pauseFloatBtn.addEventListener('click', function() { showPauseMenu(); });
if (_pauseResumeBtn) _pauseResumeBtn.addEventListener('click', function() { resumeFromPause(); });
if (_pauseRestartBtn) _pauseRestartBtn.addEventListener('click', function() {
  var ov = document.getElementById('pause-overlay');
  if (ov) ov.classList.add('hidden');
  _paused = false;
  const isOnline = _onlineTempLevel !== null;
  if (isOnline) { startPlayOnline(); return; }
  resetPlayState();
  playMode = true;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(function(ts) { lastTime = ts; gameLoop(ts); });
});
if (_pauseExitBtn) _pauseExitBtn.addEventListener('click', function() {
  var ov = document.getElementById('pause-overlay');
  if (ov) ov.classList.add('hidden');
  _paused = false;
  const isOnline = _onlineTempLevel !== null;
  if (isOnline) { exitOnlinePlay(); return; }
  stopPlay();
  showHub();
});

document.getElementById('btn-win-edit').addEventListener('click', function() {
  document.getElementById('win-overlay').classList.add('hidden');
  const isOnline = document.getElementById('topbar-actions').dataset.onlineMode === '1';
  if (isOnline) { exitOnlinePlay(); return; }
  const btn = document.getElementById('btn-play');
  btn.textContent = 'Play'; btn.style.cssText = '';
  document.getElementById('hud').classList.add('hidden');
  canvas.style.cursor = 'crosshair';
  document.getElementById('statusbar').style.display = '';
  drawEditor();
});
document.getElementById('btn-win-retry').addEventListener('click', function() {
  document.getElementById('win-overlay').classList.add('hidden');
  const isOnline = document.getElementById('topbar-actions').dataset.onlineMode === '1';
  if (isOnline) { startPlayOnline(); return; }
  resetPlayState();
  playMode = true;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(function(ts) { lastTime = ts; gameLoop(ts); });
});
document.getElementById('btn-win-home').addEventListener('click', function() {
  document.getElementById('win-overlay').classList.add('hidden');
  const isOnline = document.getElementById('topbar-actions').dataset.onlineMode === '1';
  if (isOnline) { exitOnlinePlay(); return; }
  stopPlay();
  showHub();
});

// -------------------------------------------------------
// UPLOAD WIZARD
// -------------------------------------------------------
document.getElementById('hub-btn-upload').addEventListener('click', function() {
  if (!currentUser) { showAuthModal('login'); return; }
  openUploadWizard();
});
document.getElementById('upload-btn-cancel-1').addEventListener('click', closeUploadWizard);
document.getElementById('upload-step2-back').addEventListener('click', function() { showUploadStep(1); });

var _uploadLevelData = null;

function openUploadWizard() {
  _uploadLevelData = null;
  document.getElementById('upload-modal').classList.remove('hidden');
  showUploadStep(1);
  document.getElementById('upload-preview').classList.add('hidden');
  document.getElementById('upload-error').classList.add('hidden');
  document.getElementById('upload-file-chosen').classList.add('hidden');
  document.getElementById('upload-file-chosen').textContent = '';
  document.getElementById('upload-step1-next').disabled = true;
  var fi = document.getElementById('upload-file-input');
  if (fi) fi.value = '';
}
function closeUploadWizard() {
  document.getElementById('upload-modal').classList.add('hidden');
}
function showUploadStep(n) {
  [1,2,3,4,5,6].forEach(function(i) {
    var el = document.getElementById('upload-step-' + i);
    if (el) el.classList.toggle('hidden', i !== n);
  });
}

document.getElementById('upload-file-input').addEventListener('change', function() {
  var file = this.files[0];
  var prev    = document.getElementById('upload-preview');
  var err     = document.getElementById('upload-error');
  var chosen  = document.getElementById('upload-file-chosen');
  var nextBtn = document.getElementById('upload-step1-next');
  if (!file) return;
  chosen.textContent = file.name;
  chosen.classList.remove('hidden');
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!data.grid) throw new Error('missing grid');
      _uploadLevelData = data;
      prev.classList.remove('hidden'); err.classList.add('hidden'); nextBtn.disabled = false;
      document.getElementById('upload-preview-name').textContent = data.name || 'Untitled';
      var c = (data.coins||[]).length, en = (data.enemies||[]).length;
      document.getElementById('upload-preview-meta').textContent =
        (data.COLS||28)+'x'+(data.ROWS||18)+' · '+c+' coin'+(c!==1?'s':'')+' · '+en+' enem'+(en!==1?'ies':'y');
    } catch(ex) {
      _uploadLevelData = null;
      prev.classList.add('hidden'); err.classList.remove('hidden'); nextBtn.disabled = true;
    }
  };
  reader.readAsText(file);
});

document.getElementById('upload-step1-next').addEventListener('click', function() {
  if (!_uploadLevelData) return;
  document.getElementById('upload-preview-name-2').textContent = _uploadLevelData.name || 'Untitled';
  var c = (_uploadLevelData.coins||[]).length, en = (_uploadLevelData.enemies||[]).length;
  document.getElementById('upload-preview-meta-2').textContent =
    (_uploadLevelData.COLS||28)+'x'+(_uploadLevelData.ROWS||18)+' · '+c+' coin'+(c!==1?'s':'')+' · '+en+' enem'+(en!==1?'ies':'y');
  showUploadStep(2);
});

document.getElementById('upload-step2-next').addEventListener('click', function() { showUploadStep(3); });

// Step 3: destination choice - online vs private user
document.getElementById('upload-dest-online').addEventListener('click', function() { showUploadStep(4); });
document.getElementById('upload-dest-user').addEventListener('click', function() { showUploadStep(5); });

document.getElementById('upload-step3-dest-back').addEventListener('click', function() { showUploadStep(2); });
document.getElementById('upload-step4-back').addEventListener('click', function() { showUploadStep(3); });
document.getElementById('upload-step5-back').addEventListener('click', function() { showUploadStep(3); });

document.getElementById('upload-difficulty').addEventListener('input', function() {
  document.getElementById('upload-difficulty-val').textContent = this.value;
});

document.getElementById('upload-btn-submit').addEventListener('click', async function() {
  if (!currentUser) { closeUploadWizard(); showAuthModal('login'); return; }
  var levelData = _uploadLevelData;
  if (!levelData || !levelData.grid) { showUploadStep(1); return; }
  var difficulty = parseInt(document.getElementById('upload-difficulty').value) || 5;
  var submitBtn  = this;
  submitBtn.textContent = 'Uploading...'; submitBtn.disabled = true;
  try {
    var resp = await fetch(SUPABASE_URL + '/rest/v1/levels', {
      method: 'POST',
      headers: Object.assign({}, SUPABASE_HEADERS, { 'Prefer': 'return=minimal' }),
      body: JSON.stringify({
        name:       levelData.name || 'Untitled',
        author:     currentUser.username,
        user_id:    currentUser.id,
        difficulty: difficulty,
        likes: 0,
        dislikes: 0,
        data:       levelData
      })
    });
    if (!resp.ok) {
      var txt = await resp.text().catch(function() { return resp.status; });
      throw new Error(resp.status + ' ' + txt);
    }
    showUploadStep(6);
    loadOnlineLevels();
  } catch(e) { alert('Upload failed: ' + e.message); }
  finally { submitBtn.textContent = 'Publish!'; submitBtn.disabled = false; }
});

document.getElementById('upload-btn-send-private').addEventListener('click', async function() {
  if (!currentUser) { closeUploadWizard(); showAuthModal('login'); return; }
  var levelData = _uploadLevelData;
  if (!levelData || !levelData.grid) { showUploadStep(1); return; }
  var recipientUsername = document.getElementById('upload-recipient').value.trim();
  if (!recipientUsername) { document.getElementById('upload-private-error').textContent='Enter a username.'; document.getElementById('upload-private-error').classList.remove('hidden'); return; }
  if (recipientUsername.toLowerCase() === currentUser.username.toLowerCase()) { document.getElementById('upload-private-error').textContent='You cannot send a level to yourself.'; document.getElementById('upload-private-error').classList.remove('hidden'); return; }
  var btn = this;
  btn.textContent = 'Sending...'; btn.disabled = true;
  document.getElementById('upload-private-error').classList.add('hidden');
  try {
    // Look up recipient by username
    var userResp = await fetch(SUPABASE_URL + '/rest/v1/users?username=eq.' + encodeURIComponent(recipientUsername) + '&select=id,username', { headers: SUPABASE_HEADERS });
    if (!userResp.ok) throw new Error('User lookup failed');
    var users = await userResp.json();
    if (!users.length) throw new Error('User "' + recipientUsername + '" not found.');
    var recipientId = users[0].id;
    // Insert inbox message
    var msgResp = await fetch(SUPABASE_URL + '/rest/v1/inbox', {
      method: 'POST',
      headers: Object.assign({}, SUPABASE_HEADERS, { 'Prefer': 'return=minimal' }),
      body: JSON.stringify({
        from_user_id:   currentUser.id,
        from_username:  currentUser.username,
        to_user_id:     recipientId,
        type:           'level_share',
        subject:        currentUser.username + ' shared a level with you: ' + (levelData.name || 'Untitled'),
        level_data:     levelData
      })
    });
    if (!msgResp.ok) {
      var txt = await msgResp.text().catch(function() { return ''; });
      var friendlyMsg = 'Failed to send level.';
      if (txt.includes('inbox') || txt.includes('PGRST')) {
        friendlyMsg = 'The inbox feature is not set up on the server yet. Ask the creator to create the inbox table in Supabase.';
      } else {
        friendlyMsg = 'Server error (' + msgResp.status + '). Please try again later.';
      }
      throw new Error(friendlyMsg);
    }
    showUploadStep(6);
    document.getElementById('upload-done-msg').textContent = 'Level sent privately to ' + recipientUsername + '!';
  } catch(e) { document.getElementById('upload-private-error').textContent = e.message; document.getElementById('upload-private-error').classList.remove('hidden'); }
  finally { btn.textContent = 'Send Level'; btn.disabled = false; }
});

document.getElementById('upload-btn-done').addEventListener('click', closeUploadWizard);

// -------------------------------------------------------
// KEYBOARD ESC in online play
// -------------------------------------------------------
// (handled in the keydown listener further up in the file — patched below)

// -------------------------------------------------------
// SHOWHOMESCREEN / SHOWCREATESCREEN stubs (for any old refs)
// -------------------------------------------------------
function showHomeScreen()   { showHub(); }
function showCreateScreen() { showHub(); }
function showOnlineScreen() { showHub(); }

// -------------------------------------------------------
// IMPORT / EXPORT
// -------------------------------------------------------
function stripInternalMeta(obj) {
  // Remove runtime-only fields that shouldn't be re-imported as level data
  const clean = Object.assign({}, obj);
  ['_supabase_id','_supabase_author','_user_id','_created_at','_featured',
   '_admin_rating','_difficulty','_likes','_dislikes','_crazy','_isOnline','_impossible','_fromReportInbox'].forEach(k => delete clean[k]);
  return clean;
}

function isValidLevelData(d) {
  // Accept if it has a grid array (can be nested or flat)
  return d && Array.isArray(d.grid) && d.grid.length > 0;
}

function importLevelJSON(raw, errEl, onSuccess) {
  try {
    var parsed = JSON.parse(raw);
    // Could be: single level obj, array of levels, or {version, levels:[...]} autosave format
    var items;
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed.levels && Array.isArray(parsed.levels)) {
      items = parsed.levels; // autosave/exportAll wrapper format
    } else {
      items = [parsed];
    }
    items = items.map(stripInternalMeta).filter(isValidLevelData);
    if (!items.length) {
      if (errEl) { errEl.textContent = 'No valid level data found in file.'; errEl.style.display = ''; }
      return false;
    }
    items.forEach(function(d) { levelCollection.push(normalizeLevelData(d)); });
    scheduleAutoSave();
    document.getElementById('modal-overlay').classList.add('hidden');
    if (typeof onSuccess === 'function') onSuccess();
    setStatus('Imported ' + items.length + ' level(s).');
    return true;
  } catch(e) {
    if (errEl) { errEl.textContent = 'JSON parse error: ' + e.message; errEl.style.display = ''; }
    return false;
  }
}

function openImportModal(onSuccess) {
  var body = document.getElementById('modal-body');
  body.innerHTML =
    '<div style="display:flex;flex-direction:column;gap:8px;">'+
    '<p style="margin:0;font-size:12px;color:#aac;">Load a .json file <em>or</em> paste JSON:</p>'+
    '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:#1a1a2e;border:1px solid #334;border-radius:4px;padding:8px 10px;font-size:12px;color:#aac;">'+
    '+ Choose .json file'+
    '<input type="file" id="import-file-input" accept=".json,application/json" style="display:none;"/>'+
    '</label>'+
    '<div id="import-file-chosen" style="font-size:11px;color:#6af;display:none;"></div>'+
    '<p style="margin:0;font-size:11px;color:#556;text-align:center;">— or paste JSON below —</p>'+
    '<textarea id="import-json-input" style="width:100%;height:90px;font-family:monospace;font-size:11px;resize:vertical;box-sizing:border-box;background:#111;color:#eef;border:1px solid #334;border-radius:4px;padding:6px;" placeholder="Paste level JSON here..."></textarea>'+
    '<p id="import-error" style="color:#e04040;display:none;margin:0;font-size:12px;"></p>'+
    '</div>';
  document.getElementById('modal-title').textContent = 'Import Level(s)';
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-confirm').textContent = 'Import';
  document.getElementById('import-file-input').addEventListener('change', function() {
    var file = this.files[0]; if (!file) return;
    document.getElementById('import-file-chosen').textContent = '✓ ' + file.name;
    document.getElementById('import-file-chosen').style.display = '';
    var reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('import-json-input').value = e.target.result;
      document.getElementById('import-error').style.display = 'none';
    };
    reader.readAsText(file);
  });
  document.getElementById('modal-confirm').onclick = function() {
    var raw = document.getElementById('import-json-input').value.trim();
    var errEl = document.getElementById('import-error');
    if (!raw) { errEl.textContent = 'Please pick a file or paste JSON.'; errEl.style.display = ''; return; }
    importLevelJSON(raw, errEl, onSuccess);
  };
}
function exportAll() {
  if (!levelCollection.length) { setStatus('No levels to export.'); return; }
  saveCurrentEditorState();
  const json = JSON.stringify(levelCollection, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'dodgefield-levels.json'; a.click();
  URL.revokeObjectURL(url);
  setStatus('Exported ' + levelCollection.length + ' level(s).');
}

// -------------------------------------------------------
// VIRTUAL JOYSTICK
// -------------------------------------------------------
let joystickActive = false;
let vjoyDx = 0, vjoyDy = 0;

function initJoystick() {
  const wrap = document.getElementById('vjoystick-wrap');
  const base = document.getElementById('vjoy-base');
  const stick = document.getElementById('vjoy-stick');
  if (!base || !stick || !wrap) return;

  const DEAD = 8, MAX_R = 42;

  function getPos(e) {
    const t = e.touches ? e.touches[0] : e;
    const rect = base.getBoundingClientRect();
    return { x: t.clientX - rect.left - rect.width/2, y: t.clientY - rect.top - rect.height/2 };
  }
  function setStick(x, y) {
    const dist = Math.hypot(x, y);
    const cx = dist > MAX_R ? x/dist*MAX_R : x;
    const cy = dist > MAX_R ? y/dist*MAX_R : y;
    stick.style.transform = `translate(${cx}px,${cy}px)`;
    vjoyDx = Math.abs(x) < DEAD ? 0 : Math.max(-1, Math.min(1, x/MAX_R));
    vjoyDy = Math.abs(y) < DEAD ? 0 : Math.max(-1, Math.min(1, y/MAX_R));
  }
  function onStart(e) { e.preventDefault(); joystickActive=true; setStick(...Object.values(getPos(e))); }
  function onMove(e)  { e.preventDefault(); if (!joystickActive) return; const p=getPos(e); setStick(p.x,p.y); }
  function onEnd(e)   { joystickActive=false; vjoyDx=0; vjoyDy=0; stick.style.transform='translate(0,0)'; }
  base.addEventListener('touchstart', onStart, {passive:false});
  base.addEventListener('touchmove',  onMove,  {passive:false});
  base.addEventListener('touchend',   onEnd);
  base.addEventListener('mousedown',  onStart);
  window.addEventListener('mousemove', e=>{ if (joystickActive) onMove(e); });
  window.addEventListener('mouseup',   onEnd);
}

function toggleJoystick() {
  appSettings.joystick = !appSettings.joystick;
  joystickEnabled = appSettings.joystick;
  saveSettings();
  applyJoystickSetting();
  updateSettingsUI();
}

// -------------------------------------------------------
// D-PAD MOBILE CONTROLS
// -------------------------------------------------------
let dpadState = { up: false, down: false, left: false, right: false };

function initDpad() {
  const wrap = document.getElementById('dpad-wrap');
  if (!wrap) return;
  function setDir(dir, active) {
    dpadState[dir] = active;
  }
  ['up','down','left','right'].forEach(function(dir) {
    const btn = document.getElementById('dpad-' + dir);
    if (!btn) return;
    btn.addEventListener('touchstart', function(e) { e.preventDefault(); setDir(dir, true); }, { passive: false });
    btn.addEventListener('touchend',   function(e) { e.preventDefault(); setDir(dir, false); });
    btn.addEventListener('touchcancel',function(e) { e.preventDefault(); setDir(dir, false); });
    btn.addEventListener('mousedown',  function(e) { e.preventDefault(); setDir(dir, true); });
    btn.addEventListener('mouseup',    function() { setDir(dir, false); });
    btn.addEventListener('mouseleave', function() { setDir(dir, false); });
  });
}

function applyMobileControlsSetting() {
  const wrap = document.getElementById('dpad-wrap');
  if (wrap) wrap.style.display = appSettings.mobileControls ? '' : 'none';
  const btn = document.getElementById('hub-btn-mobile-controls');
  if (btn) btn.classList.toggle('active', appSettings.mobileControls);
}

function toggleMobileControls() {
  appSettings.mobileControls = !appSettings.mobileControls;
  saveSettings();
  applyMobileControlsSetting();
}

function updateSettingsUI() {
  applyJoystickSetting();
  applyMobileControlsSetting();
}
  const wrap = document.getElementById('vjoystick-wrap');
  const btn  = document.getElementById('btn-joystick-toggle');
  if (wrap) wrap.style.display = appSettings.joystick ? '' : 'none';
  if (btn)  btn.classList.toggle('active', appSettings.joystick);


// -------------------------------------------------------
// EXIT / CLOSE WARNING
// -------------------------------------------------------
let _exitConfirmed = false;

function showExitWarning(onLeave) {
  const overlay = document.getElementById('exit-warning');
  overlay.classList.remove('hidden');
  document.getElementById('exit-warning-save').onclick = function() {
    const name = (document.getElementById('exit-warning-filename').value.trim() || 'dodgefield-backup')
      .replace(/[^a-z0-9_\-]/gi, '_');
    saveCurrentEditorState();
    const json = JSON.stringify(levelCollection, null, 2);
    const blob = new Blob([json], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=name+'.json'; a.click();
    URL.revokeObjectURL(url);
    overlay.classList.add('hidden');
    _exitConfirmed = true;
    if (typeof onLeave === 'function') onLeave();
  };
  document.getElementById('exit-warning-leave').onclick = function() {
    overlay.classList.add('hidden');
    _exitConfirmed = true;
    if (typeof onLeave === 'function') onLeave();
  };
  document.getElementById('exit-warning-stay').onclick = function() {
    overlay.classList.add('hidden');
  };
}

window.addEventListener('beforeunload', function(e) {
  if (_exitConfirmed || !levelCollection.length) return;
  // Show custom overlay — but also set returnValue for browser's own dialog as fallback
  e.preventDefault();
  e.returnValue = '';
  // We can't reliably intercept with custom UI before unload, so we show our overlay
  // on pagehide/visibilitychange instead for a better UX
});

// On mobile or tab-close, show our custom overlay
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'hidden' && levelCollection.length && !_exitConfirmed) {
    // Auto-save is already happening, so just make sure it fires
    autoSave();
  }
});

// Intercept internal navigation away (e.g., clicking a link while on page)
// For actual tab closes we rely on beforeunload
// We add a button-level intercept for the home button when levels exist
const _origBtnHome = document.getElementById('btn-home');

// -------------------------------------------------------
// SUGGESTIONS SYSTEM
// -------------------------------------------------------
// Requires a Supabase table:
// CREATE TABLE suggestions (
//   id bigint generated always as identity primary key,
//   user_id text,
//   username text not null default 'Guest',
//   text text not null,
//   reply text,
//   replied_at timestamptz,
//   created_at timestamptz default now()
// );
// Enable RLS with policies: anon can INSERT, anon can SELECT own (by user_id), admin can SELECT all & UPDATE

var ADMIN_INBOX_USERNAMES = ['creator']; // add your username here for admin inbox access
var _inboxTab = 'my'; // 'my' or 'all'
var _suggestionsCache = null; // cache to track badge

function getGuestId() {
  var k = 'df_guest_id';
  var id = localStorage.getItem(k);
  if (!id) { id = 'guest_' + Math.random().toString(36).slice(2,10); localStorage.setItem(k, id); }
  return id;
}
function getSuggestUserId() {
  return currentUser ? String(currentUser.id) : getGuestId();
}
function getSuggestUsername() {
  return currentUser ? currentUser.username : 'Guest';
}
function isInboxAdmin() {
  return isAdminLoggedIn || (currentUser && ADMIN_INBOX_USERNAMES.includes(currentUser.username));
}

// Show/hide admin tab
function updateInboxTabs() {
  var adminTab = document.getElementById('inbox-tab-all');
  var reportsTab = document.getElementById('inbox-tab-reports');
  var levelsTab = document.getElementById('inbox-tab-levels');
  var isAdmin = isInboxAdmin();
  if (adminTab) adminTab.classList.toggle('hidden', !isAdmin);
  if (reportsTab) reportsTab.classList.toggle('hidden', !isAdmin);
  // Levels tab visible when logged in
  if (levelsTab) levelsTab.classList.toggle('hidden', !currentUser);
}

// Suggestion badge: count unreplied suggestions when admin, or count replies for player
async function refreshInboxBadge() {
  var badge = document.getElementById('hub-inbox-badge');
  if (!badge) return;
  try {
    var userId = getSuggestUserId();
    var url, resp, rows;
    if (isInboxAdmin()) {
      // Count unread (no reply) suggestions for admin
      url = SUPABASE_URL + '/rest/v1/suggestions?select=id&reply=is.null&order=created_at.desc';
      resp = await fetch(url, { headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'count=exact', 'Range-Unit':'items', 'Range':'0-0'}) });
      var count = parseInt(resp.headers.get('Content-Range') || '0/0') || 0;
      // fallback: parse body
      if (isNaN(count) || count === 0) {
        rows = await resp.json().catch(()=>[]);
        if (Array.isArray(rows)) count = rows.length;
      }
      badge.textContent = count > 0 ? count : '';
      badge.classList.toggle('hidden', count === 0);
    } else {
      // Count suggestions with replies for this user
      url = SUPABASE_URL + '/rest/v1/suggestions?user_id=eq.' + encodeURIComponent(userId) + '&reply=not.is.null&select=id';
      resp = await fetch(url, { headers: SUPABASE_HEADERS });
      rows = await resp.json().catch(()=>[]);
      var seenKey = 'df_seen_replies_' + userId;
      var seen = JSON.parse(localStorage.getItem(seenKey) || '[]');
      var seenSet = new Set(seen);
      var unread = (rows || []).filter(function(r) { return !seenSet.has(String(r.id)); });
      badge.textContent = unread.length > 0 ? unread.length : '';
      badge.classList.toggle('hidden', unread.length === 0);
    }
  } catch(e) { badge.classList.add('hidden'); }
}

// Open suggestion submit modal
document.getElementById('hub-btn-suggest').addEventListener('click', function() {
  if (!currentUser) { showAuthModal('login'); return; }
  var modal = document.getElementById('suggest-modal');
  var textarea = document.getElementById('suggest-text');
  var errEl = document.getElementById('suggest-error');
  var successEl = document.getElementById('suggest-success');
  textarea.value = '';
  document.getElementById('suggest-char-count').textContent = '0 / 1000';
  errEl.classList.add('hidden');
  successEl.classList.add('hidden');
  modal.classList.remove('hidden');
  textarea.focus();
});
document.getElementById('suggest-close').addEventListener('click', function() {
  document.getElementById('suggest-modal').classList.add('hidden');
});
document.getElementById('suggest-modal').addEventListener('click', function(e) {
  if (e.target === this) this.classList.add('hidden');
});
document.getElementById('suggest-text').addEventListener('input', function() {
  document.getElementById('suggest-char-count').textContent = this.value.length + ' / 1000';
});

document.getElementById('suggest-submit').addEventListener('click', async function() {
  var text = document.getElementById('suggest-text').value.trim();
  var errEl = document.getElementById('suggest-error');
  var successEl = document.getElementById('suggest-success');
  errEl.classList.add('hidden');
  successEl.classList.add('hidden');
  if (!currentUser) {
    errEl.textContent = 'You need to be signed in to send a suggestion.';
    errEl.classList.remove('hidden');
    return;
  }
  if (!text) { errEl.textContent = 'Please write something first!'; errEl.classList.remove('hidden'); return; }
  var btn = this; btn.textContent = 'Sending...'; btn.disabled = true;
  try {
    var resp = await fetch(SUPABASE_URL + '/rest/v1/suggestions', {
      method: 'POST',
      headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer': 'return=minimal'}),
      body: JSON.stringify({
        user_id: getSuggestUserId(),
        username: getSuggestUsername(),
        text: text
      })
    });
    if (!resp.ok) {
      var body = await resp.text().catch(()=>'');
      if (body.includes('relation') || body.includes('exist')) {
        throw new Error('The suggestions table does not exist yet. Please create it in Supabase first (see console for SQL).');
      }
      throw new Error('HTTP ' + resp.status + ': ' + body);
    }
    document.getElementById('suggest-text').value = '';
    document.getElementById('suggest-char-count').textContent = '0 / 1000';
    successEl.classList.remove('hidden');
    refreshInboxBadge();
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
    console.error('[Suggestions] Create table SQL:\nCREATE TABLE suggestions (\n  id bigint generated always as identity primary key,\n  user_id text,\n  username text not null default \'Guest\',\n  text text not null,\n  reply text,\n  replied_at timestamptz,\n  created_at timestamptz default now()\n);\nALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "Anyone can insert" ON suggestions FOR INSERT TO anon WITH CHECK (true);\nCREATE POLICY "Users can view their own" ON suggestions FOR SELECT TO anon USING (true);\nCREATE POLICY "Anyone can update" ON suggestions FOR UPDATE TO anon USING (true);');
  } finally {
    btn.textContent = 'Send Suggestion'; btn.disabled = false;
  }
});

// Open inbox modal
document.getElementById('hub-btn-inbox').addEventListener('click', function() {
  var modal = document.getElementById('inbox-modal');
  modal.classList.remove('hidden');
  updateInboxTabs();
  loadInbox(_inboxTab);
});
document.getElementById('inbox-close').addEventListener('click', function() {
  document.getElementById('inbox-modal').classList.add('hidden');
});
document.getElementById('inbox-modal').addEventListener('click', function(e) {
  if (e.target === this) this.classList.add('hidden');
});
document.getElementById('inbox-tab-received').addEventListener('click', function() {
  this.classList.add('active');
  document.getElementById('inbox-tab-levels').classList.remove('active');
  document.getElementById('inbox-tab-all').classList.remove('active');
  document.getElementById('inbox-tab-reports').classList.remove('active');
  _inboxTab = 'my';
  loadInbox('my');
});
document.getElementById('inbox-tab-levels').addEventListener('click', function() {
  this.classList.add('active');
  document.getElementById('inbox-tab-received').classList.remove('active');
  document.getElementById('inbox-tab-all').classList.remove('active');
  document.getElementById('inbox-tab-reports').classList.remove('active');
  _inboxTab = 'levels';
  loadInbox('levels');
});
document.getElementById('inbox-tab-all').addEventListener('click', function() {
  this.classList.add('active');
  document.getElementById('inbox-tab-received').classList.remove('active');
  document.getElementById('inbox-tab-levels').classList.remove('active');
  document.getElementById('inbox-tab-reports').classList.remove('active');
  _inboxTab = 'all';
  loadInbox('all');
});
document.getElementById('inbox-tab-reports').addEventListener('click', function() {
  this.classList.add('active');
  document.getElementById('inbox-tab-received').classList.remove('active');
  document.getElementById('inbox-tab-levels').classList.remove('active');
  document.getElementById('inbox-tab-all').classList.remove('active');
  _inboxTab = 'reports';
  loadInbox('reports');
});

async function loadInbox(tab) {
  var listEl = document.getElementById('inbox-list');
  var loadEl = document.getElementById('inbox-loading');
  var emptyEl = document.getElementById('inbox-empty');
  listEl.innerHTML = '';
  emptyEl.classList.add('hidden');
  loadEl.classList.remove('hidden');

  // Dedicated "Received Levels" tab
  if (tab === 'levels') {
    loadEl.classList.add('hidden');
    if (!currentUser) {
      emptyEl.classList.remove('hidden');
      emptyEl.querySelector('.hub-empty-text').textContent = 'Sign in to see levels sent to you.';
      return;
    }
    var shareRows = [];
    try {
      var shareResp = await fetch(
        SUPABASE_URL + '/rest/v1/inbox?to_user_id=eq.' + encodeURIComponent(currentUser.id) + '&type=eq.level_share&select=*&order=created_at.desc',
        { headers: SUPABASE_HEADERS }
      );
      if (shareResp.ok) shareRows = await shareResp.json();
    } catch(e) {}
    if (!shareRows.length) {
      emptyEl.classList.remove('hidden');
      emptyEl.querySelector('.hub-empty-text').textContent = 'No levels have been sent to you yet.';
      return;
    }
    shareRows.forEach(function(row) {
      var card = document.createElement('div');
      card.className = 'suggestion-card level-share-card';
      var dateStr = row.created_at ? new Date(row.created_at).toLocaleDateString() : '';
      var lvName = (row.level_data && row.level_data.name) ? row.level_data.name : 'Untitled';
      var fromUser = escHtml(row.from_username || 'Someone');
      card.innerHTML =
        '<div class="suggestion-meta">' +
          '<span class="suggestion-author">' + fromUser + ' sent you a level</span>' +
          '<span class="suggestion-date">' + dateStr + '</span>' +
        '</div>' +
        '<div class="suggestion-text"><strong>' + escHtml(lvName) + '</strong></div>' +
        '<div style="margin-top:8px;">' +
          '<button class="action-btn primary" style="font-size:11px;padding:5px 12px;" data-sharerow="' + row.id + '">Play Level</button>' +
        '</div>';
      card.querySelector('[data-sharerow]').addEventListener('click', function() {
        if (!row.level_data || !row.level_data.grid) { alert('Level data is missing.'); return; }
        document.getElementById('inbox-modal').classList.add('hidden');
        var norm = normalizeLevelData(row.level_data);
        norm._isOnline = true;
        _onlineTempLevel = norm;
        playOnlineLevel(norm);
      });
      listEl.appendChild(card);
    });
    // Update badge
    var badge = document.getElementById('inbox-levels-badge');
    if (badge) { badge.textContent = ''; badge.classList.add('hidden'); }
    return;
  }

  try {
    var url;
    if (tab === 'all' && isInboxAdmin()) {
      url = SUPABASE_URL + '/rest/v1/suggestions?select=*&order=created_at.desc';
    } else {
      var userId = getSuggestUserId();
      url = SUPABASE_URL + '/rest/v1/suggestions?user_id=eq.' + encodeURIComponent(userId) + '&select=*&order=created_at.desc';
    }
    var resp = await fetch(url, { headers: SUPABASE_HEADERS });
    var rows = await resp.json();
    if (!resp.ok) throw new Error('HTTP ' + resp.status);

    // Also update level shares badge for the dedicated tab
    if (tab === 'my' && currentUser) {
      try {
        var shareResp = await fetch(
          SUPABASE_URL + '/rest/v1/inbox?to_user_id=eq.' + encodeURIComponent(currentUser.id) + '&type=eq.level_share&select=id&order=created_at.desc',
          { headers: SUPABASE_HEADERS }
        );
        if (shareResp.ok) {
          var shareCount = (await shareResp.json()).length;
          var lvBadge = document.getElementById('inbox-levels-badge');
          if (lvBadge && shareCount > 0) { lvBadge.textContent = shareCount; lvBadge.classList.remove('hidden'); }
          else if (lvBadge) { lvBadge.textContent = ''; lvBadge.classList.add('hidden'); }
        }
      } catch(e) {}
    }

    loadEl.classList.add('hidden');

    if (!rows.length) {
      emptyEl.classList.remove('hidden');
      if (tab === 'all') emptyEl.querySelector('.hub-empty-text').textContent = 'No suggestions have been sent yet!';
      else emptyEl.querySelector('.hub-empty-text').textContent = 'No suggestions yet. You haven\'t sent any!';
      return;
    }

    // Mark replies as seen for badge
    var userId2 = getSuggestUserId();
    var seenKey = 'df_seen_replies_' + userId2;
    var seen = new Set(JSON.parse(localStorage.getItem(seenKey) || '[]'));
    rows.forEach(function(r) { if (r.reply) seen.add(String(r.id)); });
    localStorage.setItem(seenKey, JSON.stringify([...seen]));

    rows.forEach(function(row) {
      var card = document.createElement('div');
      card.className = 'suggestion-card' + (row.reply ? ' has-reply' : '');
      var dateStr = row.created_at ? new Date(row.created_at).toLocaleDateString() : '';
      var replyHtml = '';
      if (row.reply) {
        replyHtml = '<div class="suggestion-reply"><div class="suggestion-reply-label">Creator Reply:</div>' + escHtml(row.reply) + '</div>';
      }
      var adminReplyHtml = '';
      if (isInboxAdmin()) {
        adminReplyHtml = '<div class="suggestion-reply-actions">' +
          '<button class="action-btn" style="font-size:11px;padding:4px 10px;" onclick="openReplyBox(this, ' + row.id + ')">' + (row.reply ? 'Edit Reply' : 'Reply') + '</button>' +
          '</div>' +
          '<textarea class="suggestion-reply-area" id="reply-area-' + row.id + '" placeholder="Type your reply...">' + escHtml(row.reply || '') + '</textarea>' +
          '<div id="reply-btns-' + row.id + '" style="display:none;margin-top:6px;display:none;">' +
          '<button class="action-btn primary" style="font-size:11px;padding:4px 10px;" onclick="submitReply(' + row.id + ')">Send Reply</button>' +
          '<button class="action-btn" style="font-size:11px;padding:4px 10px;margin-left:6px;" onclick="cancelReply(' + row.id + ')">Cancel</button>' +
          '</div>';
      }
      card.innerHTML =
        '<div class="suggestion-meta">' +
          '<span class="suggestion-author">' + escHtml(row.username || 'Guest') + '</span>' +
          '<span class="suggestion-date">' + dateStr + '</span>' +
        '</div>' +
        '<div class="suggestion-text">' + escHtml(row.text) + '</div>' +
        replyHtml +
        adminReplyHtml;
      listEl.appendChild(card);
    });
    // Refresh badge
    refreshInboxBadge();
  } catch(e) {
    loadEl.classList.add('hidden');
    listEl.innerHTML = '<div class="hub-empty-text" style="padding:20px;color:#e04040;">Could not load: ' + escHtml(e.message) + '</div>';
  }
}

function openReplyBox(btn, id) {
  var area = document.getElementById('reply-area-' + id);
  var btns = document.getElementById('reply-btns-' + id);
  if (!area) return;
  area.classList.add('open');
  if (btns) btns.style.display = 'flex';
  area.focus();
}
function cancelReply(id) {
  var area = document.getElementById('reply-area-' + id);
  var btns = document.getElementById('reply-btns-' + id);
  if (area) area.classList.remove('open');
  if (btns) btns.style.display = 'none';
}
async function submitReply(id) {
  if (!isInboxAdmin()) return;
  var area = document.getElementById('reply-area-' + id);
  if (!area) return;
  var reply = area.value.trim();
  if (!reply) { alert('Reply cannot be empty.'); return; }
  var resp = await fetch(SUPABASE_URL + '/rest/v1/suggestions?id=eq.' + id, {
    method: 'PATCH',
    headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'}),
    body: JSON.stringify({ reply: reply, replied_at: new Date().toISOString() })
  });
  if (resp.ok) {
    loadInbox(_inboxTab);
    refreshInboxBadge();
  } else {
    alert('Failed to send reply: HTTP ' + resp.status);
  }
}

// -------------------------------------------------------
// REPORT SYSTEM
// -------------------------------------------------------
// Requires Supabase table (see console for SQL after first report attempt)
function openReportModal(levelId, levelName) {
  var modal = document.getElementById('report-modal');
  if (!modal) return;
  document.getElementById('report-level-name').textContent = '"' + levelName + '"';
  document.getElementById('report-text').value = '';
  document.getElementById('report-char-count').textContent = '0 / 500';
  document.getElementById('report-error').classList.add('hidden');
  document.getElementById('report-success').classList.add('hidden');
  document.getElementById('report-submit').disabled = false;
  document.getElementById('report-submit').textContent = 'Submit Report';
  modal.classList.remove('hidden');
  modal._levelId = levelId;
  modal._levelName = levelName;
  document.getElementById('report-text').focus();
}

document.getElementById('report-close').addEventListener('click', function() {
  document.getElementById('report-modal').classList.add('hidden');
});
document.getElementById('report-modal').addEventListener('click', function(e) {
  if (e.target === this) this.classList.add('hidden');
});
document.getElementById('report-text').addEventListener('input', function() {
  document.getElementById('report-char-count').textContent = this.value.length + ' / 500';
});
document.getElementById('report-submit').addEventListener('click', async function() {
  var modal = document.getElementById('report-modal');
  var reason = document.getElementById('report-text').value.trim();
  var errEl = document.getElementById('report-error');
  var successEl = document.getElementById('report-success');
  errEl.classList.add('hidden');
  successEl.classList.add('hidden');
  if (!reason) { errEl.textContent = 'Please describe the issue.'; errEl.classList.remove('hidden'); return; }
  var btn = this; btn.disabled = true; btn.textContent = 'Submitting...';
  try {
    var resp = await fetch(SUPABASE_URL + '/rest/v1/reports', {
      method: 'POST',
      headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'}),
      body: JSON.stringify({
        level_id: String(modal._levelId || ''),
        level_name: modal._levelName || '',
        user_id: getSuggestUserId(),
        username: getSuggestUsername(),
        reason: reason
      })
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status + ' — Check console for table SQL.');
    successEl.classList.remove('hidden');
    btn.textContent = 'Reported ✓';
    console.log('[Reports] SQL:\nCREATE TABLE reports (\n  id bigint generated always as identity primary key,\n  level_id text not null,\n  level_name text,\n  user_id text,\n  username text default \'Guest\',\n  reason text not null,\n  created_at timestamptz default now()\n);\nALTER TABLE reports ENABLE ROW LEVEL SECURITY;\nCREATE POLICY "insert" ON reports FOR INSERT TO anon WITH CHECK (true);\nCREATE POLICY "select" ON reports FOR SELECT TO anon USING (true);');
  } catch(e) {
    errEl.textContent = 'Error: ' + e.message; errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Submit Report';
  }
});

// Add reports tab to inbox for admins
var _inboxReportsCache = null;
var _origLoadInbox = loadInbox;
async function loadInboxWithReports(tab) {
  if (tab === 'reports') {
    var listEl = document.getElementById('inbox-list');
    var loadEl = document.getElementById('inbox-loading');
    var emptyEl = document.getElementById('inbox-empty');
    listEl.innerHTML = '';
    emptyEl.classList.add('hidden');
    loadEl.classList.remove('hidden');
    try {
      var resp = await fetch(SUPABASE_URL + '/rest/v1/reports?select=*&order=created_at.desc', { headers: SUPABASE_HEADERS });
      var rows = await resp.json();
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      loadEl.classList.add('hidden');
      if (!rows || !rows.length) {
        emptyEl.classList.remove('hidden');
        emptyEl.querySelector('.hub-empty-text').textContent = 'No reports yet!';
        return;
      }
      rows.forEach(function(row) {
        var card = document.createElement('div');
        card.className = 'suggestion-card';
        var dateStr = row.created_at ? new Date(row.created_at).toLocaleDateString() : '';
        var playDeleteHtml = '';
        if (row.level_id) {
          playDeleteHtml =
            '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">' +
            '<button class="action-btn primary" style="font-size:11px;padding:5px 12px;" data-report-play="' + row.level_id + '">Play Level</button>' +
            (isInboxAdmin() ? '<button class="action-btn" style="font-size:11px;padding:5px 12px;background:#882222;border-color:#aa3333;" data-report-del="' + row.level_id + '">Delete Level</button>' : '') +
            '</div>';
        }
        card.innerHTML =
          '<div class="suggestion-meta">' +
            '<span class="suggestion-author">Report - ' + escHtml(row.username || 'Guest') + '</span>' +
            '<span style="color:#e04040;font-size:10px;font-weight:700;">REPORT</span>' +
            '<span class="suggestion-date">' + dateStr + '</span>' +
          '</div>' +
          '<div style="font-size:10px;color:#8ab;margin-bottom:4px;">Level: <strong>' + escHtml(row.level_name || row.level_id || '?') + '</strong></div>' +
          '<div class="suggestion-text">' + escHtml(row.reason) + '</div>' +
          playDeleteHtml;
        // Attach play level handler
        var playBtn = card.querySelector('[data-report-play]');
        if (playBtn) {
          var lvId = row.level_id;
          var lvName = row.level_name || 'Reported Level';
          playBtn.addEventListener('click', async function() {
            try {
              var resp = await fetch(SUPABASE_URL + '/rest/v1/levels?id=eq.' + encodeURIComponent(lvId) + '&select=*', { headers: SUPABASE_HEADERS });
              var rows2 = await resp.json();
              if (!rows2 || !rows2.length) { alert('Level not found or was already deleted.'); return; }
              var row2 = rows2[0];
              var lv = row2.data || {};
              lv._supabase_id = row2.id;
              lv._supabase_author = row2.author || '';
              lv._user_id = row2.user_id;
              lv._created_at = row2.created_at;
              lv._featured = row2.featured || false;
              lv._crazy = row2.crazy || false;
              lv._crazy_points = row2.crazy_points || 0;
              lv._unreal = row2.unreal || false;
              lv._unreal_points = row2.unreal_points || 0;
              lv._impossible = row2.impossible || false;
              lv._impossible_points = row2.impossible_points || 0;
              lv._admin_rating = row2.admin_rating || 0;
              lv._difficulty = row2.difficulty || 0;
              lv._likes = row2.likes || 0;
              lv._dislikes = row2.dislikes || 0;
              lv._fromReportInbox = true; // flag for delete button
              document.getElementById('inbox-modal').classList.add('hidden');
              playOnlineLevel(lv);
            } catch(e) { alert('Could not load level: ' + e.message); }
          });
        }
        // Delete level button (admin only, visible only from report inbox)
        var delBtn = card.querySelector('[data-report-del]');
        if (delBtn) {
          var lvId2 = row.level_id;
          delBtn.addEventListener('click', async function() {
            if (!confirm('Permanently delete this level from the community board?')) return;
            try {
              var resp = await fetch(SUPABASE_URL + '/rest/v1/levels?id=eq.' + encodeURIComponent(lvId2), {
                method: 'DELETE',
                headers: Object.assign({}, adminAuthHeaders(), { 'Prefer': 'return=minimal' })
              });
              if (!resp.ok) throw new Error('HTTP ' + resp.status);
              onlineLevels = onlineLevels.filter(function(lv) { return String(lv._supabase_id) !== String(lvId2); });
              renderHubOnline();
              card.style.opacity = '0.5';
              delBtn.textContent = 'Deleted';
              delBtn.disabled = true;
            } catch(e) { alert('Delete failed: ' + e.message); }
          });
        }
        listEl.appendChild(card);
      });
    } catch(e) {
      loadEl.classList.add('hidden');
      listEl.innerHTML = '<div class="hub-empty-text" style="padding:20px;color:#e04040;">Could not load: ' + escHtml(e.message) + '</div>';
    }
    return;
  }
  return _origLoadInbox(tab);
}
// Override loadInbox globally
loadInbox = loadInboxWithReports;

// -------------------------------------------------------
// MULTIPLAYER SYSTEM
// -------------------------------------------------------

var MP = {
  // State
  roomCode: null,
  isHost: false,
  mySlot: 0,
  players: [],        // [{ user_id, username, slot, x, y, finished, alive }]
  roomStatus: 'idle', // idle | waiting | countdown | playing | finished
  pollInterval: null,
  countdownInterval: null,
  countdownVal: 5,
  selectedLevelData: null,
  selectedLevelName: null,
  _lastPollData: null,
  _posUpdateInterval: null,
  _myFinished: false,
  _inGame: false,

  // Player slot colors: host=red, p1=blue, p2=green, p3=purple, p4=yellow, p5=orange
  SLOT_COLORS: ['#e03030','#2244cc','#20aa40','#8822cc','#ccaa00','#cc6600'],
  SLOT_BORDER: ['#801010','#0d1e88','#107020','#550099','#886600','#884400'],

  init: function() {
    document.getElementById('hub-btn-create-room').addEventListener('click', MP.onCreateRoom);
    document.getElementById('hub-btn-join-room').addEventListener('click', MP.onJoinRoom);
    document.getElementById('hub-btn-exit-room').addEventListener('click', MP.onExitRoom);
    document.getElementById('hub-btn-start-game').addEventListener('click', MP.onStartGame);
    document.getElementById('join-room-confirm').addEventListener('click', MP.onJoinRoomConfirm);
    document.getElementById('join-room-cancel').addEventListener('click', function() {
      document.getElementById('join-room-modal').classList.add('hidden');
    });
    document.getElementById('join-room-code-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') MP.onJoinRoomConfirm();
    });
  },

  requireAccount: function() {
    if (!currentUser) { showAuthModal('login'); return false; }
    return true;
  },

  generateCode: function() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var code = '';
    for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  },

  onCreateRoom: async function() {
    if (!MP.requireAccount()) return;
    var code = MP.generateCode();
    try {
      document.getElementById('hub-mp-status').textContent = 'Creating room...';
      // Insert room
      var resp = await fetch(SUPABASE_URL + '/rest/v1/rooms', {
        method: 'POST',
        headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer': 'return=minimal'}),
        body: JSON.stringify({
          code: code,
          host_id: String(currentUser.id),
          host_username: currentUser.username,
          status: 'waiting',
          level_name: null,
          level_data: null,
          winner_username: null
        })
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      // Join as slot 0 (host)
      await MP.joinRoomAsPlayer(code, 0);
      MP.roomCode = code;
      MP.isHost = true;
      MP.mySlot = 0;
      MP._myFinished = false;
      MP._inGame = false;
      document.getElementById('hub-mp-status').textContent = '';
      MP.enterLobby();
    } catch(e) {
      document.getElementById('hub-mp-status').textContent = 'Error: ' + e.message;
    }
  },

  onJoinRoom: function() {
    if (!MP.requireAccount()) return;
    document.getElementById('join-room-code-input').value = '';
    document.getElementById('join-room-error').textContent = '';
    document.getElementById('join-room-modal').classList.remove('hidden');
    setTimeout(function() { document.getElementById('join-room-code-input').focus(); }, 50);
  },

  onJoinRoomConfirm: async function() {
    if (!MP.requireAccount()) return;
    var code = document.getElementById('join-room-code-input').value.trim().toUpperCase();
    if (code.length < 4) { document.getElementById('join-room-error').textContent = 'Enter a valid room code.'; return; }
    document.getElementById('join-room-error').textContent = 'Joining...';
    try {
      // Check room exists and is waiting
      var resp = await fetch(SUPABASE_URL + '/rest/v1/rooms?code=eq.' + encodeURIComponent(code) + '&select=*', {
        headers: SUPABASE_HEADERS
      });
      var rooms = await resp.json();
      if (!rooms || rooms.length === 0) { document.getElementById('join-room-error').textContent = 'Room not found.'; return; }
      var room = rooms[0];
      if (room.status !== 'waiting') { document.getElementById('join-room-error').textContent = 'Room is not accepting players.'; return; }
      // Check player count
      var pr = await fetch(SUPABASE_URL + '/rest/v1/room_players?room_code=eq.' + encodeURIComponent(code) + '&select=*', {
        headers: SUPABASE_HEADERS
      });
      var players = await pr.json();
      // Remove stale entries for this user if any
      var myExisting = players.filter(function(p) { return String(p.user_id) === String(currentUser.id); });
      for (var i = 0; i < myExisting.length; i++) {
        await fetch(SUPABASE_URL + '/rest/v1/room_players?id=eq.' + myExisting[i].id, {
          method: 'DELETE', headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'})
        });
      }
      players = players.filter(function(p) { return String(p.user_id) !== String(currentUser.id); });
      if (players.length >= 6) { document.getElementById('join-room-error').textContent = 'Room is full (max 6 players).'; return; }
      // Find next available slot
      var usedSlots = players.map(function(p) { return p.slot; });
      var slot = 0;
      while (usedSlots.indexOf(slot) !== -1) slot++;
      await MP.joinRoomAsPlayer(code, slot);
      MP.roomCode = code;
      MP.isHost = false;
      MP.mySlot = slot;
      MP._myFinished = false;
      MP._inGame = false;
      document.getElementById('join-room-modal').classList.add('hidden');
      document.getElementById('hub-mp-status').textContent = '';
      MP.enterLobby();
    } catch(e) {
      document.getElementById('join-room-error').textContent = 'Error: ' + e.message;
    }
  },

  joinRoomAsPlayer: async function(code, slot) {
    var resp = await fetch(SUPABASE_URL + '/rest/v1/room_players', {
      method: 'POST',
      headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer': 'return=minimal'}),
      body: JSON.stringify({
        room_code: code,
        user_id: String(currentUser.id),
        username: currentUser.username,
        slot: slot,
        x: 0, y: 0,
        finished: false,
        alive: true
      })
    });
    if (!resp.ok) throw new Error('Could not join room: HTTP ' + resp.status);
  },

  enterLobby: function() {
    // Hide hub-panels, show hub-lobby
    document.getElementById('hub-panels').style.display = 'none';
    document.getElementById('hub-lobby').classList.remove('hidden');
    document.getElementById('hub-lobby-room-code').textContent = MP.roomCode;
    if (MP.isHost) {
      document.getElementById('hub-lobby-host-tag').classList.remove('hidden');
      document.getElementById('hub-lobby-levels-list').classList.remove('hidden');
      document.getElementById('hub-btn-start-game').classList.remove('hidden');
      MP.renderMyLevelsInLobby();
    } else {
      document.getElementById('hub-lobby-host-tag').classList.add('hidden');
      document.getElementById('hub-lobby-levels-list').classList.add('hidden');
      document.getElementById('hub-btn-start-game').classList.add('hidden');
    }
    document.getElementById('hub-lobby-selected-level').classList.add('hidden');
    MP.selectedLevelData = null;
    MP.selectedLevelName = null;
    MP.updateStartButton();
    // Start polling
    MP.startPolling();
  },

  renderMyLevelsInLobby: function() {
    var container = document.getElementById('hub-lobby-my-levels');
    container.innerHTML = '';
    if (!levelCollection.length) {
      container.innerHTML = '<div style="padding:12px;font-size:11px;color:#556688;">No levels created yet.</div>';
      return;
    }
    levelCollection.forEach(function(lv, idx) {
      var card = document.createElement('div');
      card.className = 'lobby-level-card';
      var meta = (lv.COLS||28)+'x'+(lv.ROWS||18);
      card.innerHTML =
        '<div style="flex:1;">'+
          '<div class="lobby-level-card-name">'+escHtml(lv.name||'Untitled')+'</div>'+
          '<div class="lobby-level-card-meta">'+meta+'</div>'+
        '</div>'+
        '<button class="hub-btn" style="font-size:10px;padding:3px 9px;">Select</button>';
      card.querySelector('button').addEventListener('click', function() {
        MP.selectLevel(lv);
      });
      container.appendChild(card);
    });
  },

  selectLevel: function(lv) {
    MP.selectedLevelData = JSON.parse(JSON.stringify(lv));
    MP.selectedLevelName = lv.name || 'Untitled';
    document.getElementById('hub-lobby-sel-level-name').textContent = MP.selectedLevelName;
    document.getElementById('hub-lobby-selected-level').classList.remove('hidden');
    MP.updateStartButton();
  },

  updateStartButton: function() {
    var btn = document.getElementById('hub-btn-start-game');
    if (!btn) return;
    btn.disabled = !(MP.isHost && MP.selectedLevelData);
  },

  onStartGame: async function() {
    if (!MP.isHost || !MP.selectedLevelData || !MP.roomCode) return;
    try {
      // Push level data to room and set status to countdown
      await fetch(SUPABASE_URL + '/rest/v1/rooms?code=eq.' + encodeURIComponent(MP.roomCode), {
        method: 'PATCH',
        headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'}),
        body: JSON.stringify({
          status: 'countdown',
          level_name: MP.selectedLevelName,
          level_data: JSON.stringify(MP.selectedLevelData)
        })
      });
    } catch(e) {
      alert('Could not start game: ' + e.message);
    }
  },

  onExitRoom: async function() {
    await MP.cleanup(true);
    MP.exitLobby();
  },

  cleanup: async function(removePlayer) {
    MP.stopPolling();
    if (removePlayer && MP.roomCode && currentUser) {
      try {
        await fetch(SUPABASE_URL + '/rest/v1/room_players?room_code=eq.' + encodeURIComponent(MP.roomCode) + '&user_id=eq.' + encodeURIComponent(String(currentUser.id)), {
          method: 'DELETE',
          headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'})
        });
        // If host, delete the whole room
        if (MP.isHost) {
          await fetch(SUPABASE_URL + '/rest/v1/rooms?code=eq.' + encodeURIComponent(MP.roomCode), {
            method: 'DELETE',
            headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'})
          });
          await fetch(SUPABASE_URL + '/rest/v1/room_players?room_code=eq.' + encodeURIComponent(MP.roomCode), {
            method: 'DELETE',
            headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'})
          });
        }
      } catch(e) {}
    }
    MP.roomCode = null; MP.isHost = false; MP.mySlot = 0;
    MP.players = []; MP.roomStatus = 'idle';
    MP.selectedLevelData = null; MP.selectedLevelName = null;
    MP._myFinished = false; MP._inGame = false;
  },

  exitLobby: function() {
    document.getElementById('hub-lobby').classList.add('hidden');
    document.getElementById('hub-panels').style.display = '';
    document.getElementById('hub-mp-status').textContent = '';
    document.getElementById('mp-results-overlay').classList.add('hidden');
    renderHubMyLevels();
  },

  startPolling: function() {
    if (MP.pollInterval) clearInterval(MP.pollInterval);
    MP.pollInterval = setInterval(MP.poll, 600);
    MP.poll();
  },

  stopPolling: function() {
    if (MP.pollInterval) { clearInterval(MP.pollInterval); MP.pollInterval = null; }
    if (MP.countdownInterval) { clearInterval(MP.countdownInterval); MP.countdownInterval = null; }
    if (MP._posUpdateInterval) { clearInterval(MP._posUpdateInterval); MP._posUpdateInterval = null; }
  },

  poll: async function() {
    if (!MP.roomCode) return;
    try {
      // Fetch room status
      var rr = await fetch(SUPABASE_URL + '/rest/v1/rooms?code=eq.' + encodeURIComponent(MP.roomCode) + '&select=*', {
        headers: SUPABASE_HEADERS
      });
      var rooms = await rr.json();
      if (!rooms || rooms.length === 0) {
        // Room was deleted (host left)
        if (!MP.isHost) {
          MP.stopPolling();
          alert('The host has closed the room.');
          MP.exitLobby();
        }
        return;
      }
      var room = rooms[0];
      // Fetch players
      var pr = await fetch(SUPABASE_URL + '/rest/v1/room_players?room_code=eq.' + encodeURIComponent(MP.roomCode) + '&select=*&order=slot.asc', {
        headers: SUPABASE_HEADERS
      });
      MP.players = await pr.json();

      var prevStatus = MP.roomStatus;
      MP.roomStatus = room.status;

      // Update lobby UI
      if (room.status === 'waiting' || room.status === 'countdown') {
        MP.renderLobbyPlayers();
        if (room.status === 'countdown' && prevStatus !== 'countdown') {
          MP.startCountdown(room.level_data, room.level_name);
        }
      } else if (room.status === 'playing') {
        if (!MP._inGame) {
          // Someone triggered play without countdown (shouldn't happen but handle it)
          MP._inGame = true;
        }
        MP.renderRemotePlayers();
      } else if (room.status === 'finished') {
        if (MP._inGame) {
          MP._inGame = false;
          MP.showResults(room);
        }
      }
    } catch(e) {
      // Network hiccup — ignore
    }
  },

  renderLobbyPlayers: function() {
    var list = document.getElementById('hub-lobby-player-list');
    list.innerHTML = '';
    var sorted = MP.players.slice().sort(function(a,b) { return a.slot - b.slot; });
    sorted.forEach(function(p) {
      var row = document.createElement('div');
      row.className = 'lobby-player-row';
      var isHost = (p.slot === 0);
      var color = MP.SLOT_COLORS[p.slot] || '#888';
      row.innerHTML =
        '<div class="lobby-player-cube" style="background:'+color+';border-color:'+MP.SLOT_BORDER[p.slot]+';"></div>'+
        '<span>'+escHtml(p.username)+'</span>'+
        (isHost ? '<span class="lobby-player-host-badge">HOST</span>' : '');
      list.appendChild(row);
    });
    var countText = MP.players.length + '/6 player' + (MP.players.length !== 1 ? 's' : '');
    document.getElementById('hub-lobby-status-text').textContent = 'Waiting for players... (' + countText + ')';
  },

  startCountdown: function(levelDataJson, levelName) {
    // Parse and store level
    try { MP.selectedLevelData = JSON.parse(levelDataJson); } catch(e) { return; }
    MP.selectedLevelName = levelName;
    document.getElementById('hub-lobby-status-text').textContent = 'Starting in...';
    document.getElementById('hub-lobby-countdown').classList.remove('hidden');
    MP.countdownVal = 5;
    document.getElementById('hub-lobby-countdown-num').textContent = MP.countdownVal;
    if (MP.countdownInterval) clearInterval(MP.countdownInterval);
    MP.countdownInterval = setInterval(function() {
      MP.countdownVal--;
      document.getElementById('hub-lobby-countdown-num').textContent = MP.countdownVal;
      if (MP.countdownVal <= 0) {
        clearInterval(MP.countdownInterval);
        MP.countdownInterval = null;
        document.getElementById('hub-lobby-countdown').classList.add('hidden');
        MP.launchMultiplayerGame();
      }
    }, 1000);
  },

  launchMultiplayerGame: function() {
    MP._inGame = true;
    MP._myFinished = false;
    // Update status to playing (host only, but all try — only one will win the race)
    if (MP.isHost) {
      fetch(SUPABASE_URL + '/rest/v1/rooms?code=eq.' + encodeURIComponent(MP.roomCode), {
        method: 'PATCH',
        headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'}),
        body: JSON.stringify({ status: 'playing' })
      }).catch(function(){});
    }
    // Reset all player finished flags
    fetch(SUPABASE_URL + '/rest/v1/room_players?room_code=eq.' + encodeURIComponent(MP.roomCode), {
      method: 'PATCH',
      headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'}),
      body: JSON.stringify({ finished: false, x: 0, y: 0, alive: true })
    }).catch(function(){});

    // Launch the level
    var lv = MP.selectedLevelData;
    if (!lv) return;
    // Use the existing playOnlineLevel flow but intercept win
    lv._isMultiplayer = true;
    lv._isOnline = false; // don't mark beaten in supabase online levels
    playOnlineLevel(lv);

    // Start position broadcasting
    MP.startPosBroadcast();
  },

  startPosBroadcast: function() {
    if (MP._posUpdateInterval) clearInterval(MP._posUpdateInterval);
    MP._posUpdateInterval = setInterval(function() {
      if (!MP._inGame || !MP.roomCode || !currentUser) return;
      if (!player) return;
      fetch(SUPABASE_URL + '/rest/v1/room_players?room_code=eq.' + encodeURIComponent(MP.roomCode) + '&user_id=eq.' + encodeURIComponent(String(currentUser.id)), {
        method: 'PATCH',
        headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'}),
        body: JSON.stringify({ x: Math.round(player.x), y: Math.round(player.y) })
      }).catch(function(){});
    }, 80); // ~12fps position updates
  },

  renderRemotePlayers: function() {
    // Called during game loop via drawPlay hook — renders other players
    // Positions are read from MP.players
  },

  onPlayerWin: function() {
    if (!MP._inGame || MP._myFinished) return;
    MP._myFinished = true;
    // Mark this player as finished
    fetch(SUPABASE_URL + '/rest/v1/room_players?room_code=eq.' + encodeURIComponent(MP.roomCode) + '&user_id=eq.' + encodeURIComponent(String(currentUser.id)), {
      method: 'PATCH',
      headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'}),
      body: JSON.stringify({ finished: true })
    }).catch(function(){});
    // Mark room as finished (first to finish wins)
    fetch(SUPABASE_URL + '/rest/v1/rooms?code=eq.' + encodeURIComponent(MP.roomCode), {
      method: 'PATCH',
      headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'}),
      body: JSON.stringify({ status: 'finished', winner_username: currentUser.username })
    }).catch(function(){});
  },

  showResults: function(room) {
    if (MP._posUpdateInterval) { clearInterval(MP._posUpdateInterval); MP._posUpdateInterval = null; }
    // Exit game back to lobby view
    if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
    playMode = false;
    _onlineTempLevel = null;
    document.getElementById('editor-screen').classList.add('hidden');
    document.getElementById('hub-screen').style.display = '';
    document.getElementById('win-overlay').classList.add('hidden');
    var floatPause = document.getElementById('btn-pause-float');
    if (floatPause) floatPause.classList.add('hidden');
    var floatBtn = document.getElementById('online-float-exit');
    if (floatBtn) floatBtn.style.display = 'none';
    document.getElementById('topbar').style.display = '';
    document.getElementById('toolbar').style.display = '';
    document.getElementById('statusbar').style.display = '';

    // Show results overlay
    var overlay = document.getElementById('mp-results-overlay');
    var list = document.getElementById('mp-results-list');
    list.innerHTML = '';
    var sorted = MP.players.slice().sort(function(a,b) {
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      return a.slot - b.slot;
    });
    sorted.forEach(function(p, i) {
      var row = document.createElement('div');
      row.className = 'mp-result-row';
      var color = MP.SLOT_COLORS[p.slot] || '#888';
      var rankLabel = p.finished ? ('#' + (i+1)) : '-';
      row.innerHTML =
        '<div class="mp-result-rank">'+rankLabel+'</div>'+
        '<div class="mp-result-cube" style="background:'+color+';border-color:'+MP.SLOT_BORDER[p.slot]+';"></div>'+
        '<div class="mp-result-name">'+escHtml(p.username)+'</div>'+
        '<div class="mp-result-status">'+(p.finished ? 'Finished' : 'Did not finish')+'</div>';
      list.appendChild(row);
    });
    // Show winner
    document.getElementById('mp-results-title').textContent = room.winner_username ? (room.winner_username.toUpperCase() + ' WINS!') : 'RACE OVER';
    overlay.classList.remove('hidden');
    // Return to lobby after 5 seconds
    setTimeout(function() {
      overlay.classList.add('hidden');
      // Reset room back to waiting (host only)
      if (MP.isHost) {
        fetch(SUPABASE_URL + '/rest/v1/rooms?code=eq.' + encodeURIComponent(MP.roomCode), {
          method: 'PATCH',
          headers: Object.assign({}, SUPABASE_HEADERS, {'Prefer':'return=minimal'}),
          body: JSON.stringify({ status: 'waiting', winner_username: null, level_name: null, level_data: null })
        }).catch(function(){});
      }
      MP._inGame = false;
      MP.roomStatus = 'waiting';
      MP.selectedLevelData = null; MP.selectedLevelName = null;
      document.getElementById('hub-lobby-countdown').classList.add('hidden');
      document.getElementById('hub-lobby-selected-level').classList.add('hidden');
      document.getElementById('hub-lobby-status-text').textContent = 'Waiting for players...';
      MP.updateStartButton();
      MP.renderLobbyPlayers();
    }, 5000);
  },

  // Draw remote players on the canvas — called from drawPlay()
  drawRemotePlayers: function() {
    if (!MP._inGame || !MP.players.length) return;
    var myUserId = currentUser ? String(currentUser.id) : null;
    MP.players.forEach(function(p) {
      if (String(p.user_id) === myUserId) return; // skip self
      if (!p.x && !p.y) return;
      var color = MP.SLOT_COLORS[p.slot] || '#888';
      var border = MP.SLOT_BORDER[p.slot] || '#444';
      var px = p.x, py = p.y;
      var h = PLAYER_SIZE / 2;
      // Draw player cube
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = color;
      ctx.fillRect(px - h, py - h, PLAYER_SIZE, PLAYER_SIZE);
      ctx.strokeStyle = border;
      ctx.lineWidth = 2;
      ctx.strokeRect(px - h, py - h, PLAYER_SIZE, PLAYER_SIZE);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(px - h + 2, py - h + 2, PLAYER_SIZE / 2, 4);
      ctx.globalAlpha = 1;
      // Draw username label above
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(p.username, px + 1, py - h - 3);
      ctx.fillStyle = '#fff';
      ctx.fillText(p.username, px, py - h - 4);
      ctx.textAlign = 'left';
    });
  }
};

// Hook into drawPlay to render remote players
var _origDrawPlay = drawPlay;
drawPlay = function() {
  _origDrawPlay();
  if (MP._inGame) {
    ctx.save();
    var s = canvas._scale;
    if (currentCameraMode === 'follow' && player) {
      var zoom = currentCameraZoom;
      var vpW = (COLS * TILE) / zoom, vpH = (ROWS * TILE) / zoom;
      var camX = Math.max(0, Math.min(COLS * TILE - vpW, player.x - vpW / 2));
      var camY = Math.max(0, Math.min(ROWS * TILE - vpH, player.y - vpH / 2));
      ctx.scale(s * zoom, s * zoom); ctx.translate(-camX, -camY);
    } else {
      ctx.scale(s, s);
    }
    MP.drawRemotePlayers();
    ctx.restore();
  }
};

// Hook into win() to detect multiplayer win
var _origWin = win;
win = function() {
  if (MP._inGame && MP.roomCode) {
    MP.onPlayerWin();
    cancelAnimationFrame(animFrameId); animFrameId = null;
    playMode = false;
    var floatPause = document.getElementById('btn-pause-float');
    if (floatPause) floatPause.classList.add('hidden');
    document.getElementById('win-overlay').classList.add('hidden');
    document.getElementById('hud-msg').textContent = 'You finished! Waiting for others...';
    return;
  }
  _origWin();
};

// -------------------------------------------------------
// INIT
// -------------------------------------------------------
function init() {
  loadSettings();
  joystickEnabled = appSettings.joystick;

  var restored = autoLoad();
  if (!restored) levelCollection = [];

  // Restore session from localStorage
  var saved = null;
  try {
    var raw = localStorage.getItem('df_session_v2') || localStorage.getItem('df_session');
    if (raw) saved = JSON.parse(raw);
  } catch(e) {}
  if (saved && saved.id && saved.username) {
    currentUser = {id: saved.id, username: saved.username};
    saveSession(currentUser);
    isAdminLoggedIn = ADMIN_USERNAMES.includes(currentUser.username);
    loadBeaten(); loadVotes();
  } else {
    // Load guest beaten completions
    loadBeaten();
  }

  showHub();
  initJoystick();
  initDpad();
  applyJoystickSetting();
  applyMobileControlsSetting();
  var jBtn = document.getElementById('btn-joystick-toggle');
  if (jBtn) jBtn.classList.toggle('active', joystickEnabled);
  if (!currentUser) showAuthModal('login');
  loadOnlineLevels();
  MP.init();
}
init();
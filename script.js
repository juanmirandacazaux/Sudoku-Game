/* Simple Sudoku game:
 - generator: transforms canonical solved board and digs holes by difficulty
 - UI: select cells, enter numbers via keyboard or keypad, pencil mode
 - validation: checks rows, columns and 3x3 boxes, highlights conflicts
 - solve/hint/reset features
*/

// ---------- Utilities & generator ----------
const canonical = [
  1,2,3,4,5,6,7,8,9,
  4,5,6,7,8,9,1,2,3,
  7,8,9,1,2,3,4,5,6,
  2,3,4,5,6,7,8,9,1,
  5,6,7,8,9,1,2,3,4,
  8,9,1,2,3,4,5,6,7,
  3,4,5,6,7,8,9,1,2,
  6,7,8,9,1,2,3,4,5,
  9,1,2,3,4,5,6,7,8
];

function clone(a){ return a.slice(); }
function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
}
function permuteNumbers(board){
  const perm=[1,2,3,4,5,6,7,8,9]; shuffle(perm);
  return board.map(v=>perm[v-1]);
}
function swapRows(board, r1, r2){
  const b=clone(board);
  for(let c=0;c<9;c++){ const t=b[r1*9+c]; b[r1*9+c]=b[r2*9+c]; b[r2*9+c]=t; }
  return b;
}
function swapCols(board, c1, c2){
  const b=clone(board);
  for(let r=0;r<9;r++){ const t=b[r*9+c1]; b[r*9+c1]=b[r*9+c2]; b[r*9+c2]=t; }
  return b;
}
function transform(board){
  let b=clone(board);
  b=permuteNumbers(b);
  // swap rows within each block
  for(let br=0;br<3;br++){
    const base=br*3;
    const r1=base+Math.floor(Math.random()*3), r2=base+Math.floor(Math.random()*3);
    b=swapRows(b,r1,r2);
  }
  // swap cols within blocks
  for(let bc=0;bc<3;bc++){
    const base=bc*3;
    const c1=base+Math.floor(Math.random()*3), c2=base+Math.floor(Math.random()*3);
    b=swapCols(b,c1,c2);
  }
  // optionally swap block rows/cols
  if(Math.random()>0.4){ const a=Math.floor(Math.random()*3), c=Math.floor(Math.random()*3); for(let i=0;i<3;i++) b=swapRows(b,a*3+i,c*3+i); }
  if(Math.random()>0.4){ const a=Math.floor(Math.random()*3), c=Math.floor(Math.random()*3); for(let i=0;i<3;i++) b=swapCols(b,a*3+i,c*3+i); }
  return b;
}
function digHoles(solution, difficulty){
  const holes = difficulty==='easy'?36 : difficulty==='medium'?46 : 54;
  const board = clone(solution);
  const positions = [...Array(81).keys()]; shuffle(positions);
  for(let i=0;i<holes;i++) board[positions[i]] = 0;
  return board;
}

// ---------- Solver (backtracking) ----------
function isSafe(board, idx, val){
  const r=Math.floor(idx/9), c=idx%9;
  for(let i=0;i<9;i++){ if(board[r*9+i]===val) return false; if(board[i*9+c]===val) return false; }
  const br=Math.floor(r/3)*3, bc=Math.floor(c/3)*3;
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) if(board[(br+i)*9+(bc+j)]===val) return false;
  return true;
}
function solveBacktrack(board){
  const b=clone(board);
  function helper(pos){
    if(pos===81) return true;
    if(b[pos]!==0) return helper(pos+1);
    for(let v=1;v<=9;v++){
      if(isSafe(b,pos,v)){ b[pos]=v; if(helper(pos+1)) return true; b[pos]=0; }
    }
    return false;
  }
  return helper(0)? b : null;
}

// ---------- UI & State ----------
const boardEl = document.getElementById('board');
const newBtn = document.getElementById('newBtn');
const solveBtn = document.getElementById('solveBtn');
const clearBtn = document.getElementById('clearBtn');
const hintBtn = document.getElementById('hintBtn');
const validateBtn = document.getElementById('validateBtn');
const checkBtn = document.getElementById('checkBtn');
const difficultyEl = document.getElementById('difficulty');
const messageEl = document.getElementById('message');
const timerEl = document.getElementById('timer');
const keypad = document.getElementById('keypad');
const pencilToggle = document.getElementById('pencil');

let solution = null, initial = null, current = null, selected = null;
let pencil = false, pencilMarks = {};
let timerInterval = null, timeSeconds = 0;

function startTimer(){ stopTimer(); timeSeconds=0; timerInterval=setInterval(()=>{ timeSeconds++; const mm=String(Math.floor(timeSeconds/60)).padStart(2,'0'); const ss=String(timeSeconds%60).padStart(2,'0'); timerEl.textContent=`Tiempo: ${mm}:${ss}`; },1000); }
function stopTimer(){ if(timerInterval){ clearInterval(timerInterval); timerInterval=null; } }

function initGame(difficulty='medium'){
  const sol = transform(canonical);
  solution = clone(sol);
  initial = digHoles(solution, difficulty);
  current = clone(initial);
  pencilMarks = {}; selected = null; messageEl.textContent = 'New board generated';
  startTimer(); renderBoard();
}

function renderBoard(){
  boardEl.innerHTML='';
  for(let r=0;r<9;r++){
    for(let c=0;c<9;c++){
      const idx = r*9+c;
      const val = current[idx];
      const cell = document.createElement('div');
      cell.className='cell';
      cell.dataset.idx = idx;
      // block boundary classes
      if(c===2 || c===5) cell.classList.add('col-3');
      if(c===3 || c===6) cell.classList.add('col-4');
      if(r===2 || r===5) cell.classList.add('row-3');
      if(r===3 || r===6) cell.classList.add('row-4');
      if(initial[idx] !== 0) cell.classList.add('fixed');
      if(selected === idx) cell.classList.add('selected');
      if(selected !== null && current[selected] !== 0 && current[selected] === val && val !== 0) cell.classList.add('same');
      // conflicts
      if(val !== 0 && !isPlacementValid(current, idx, val)) cell.classList.add('conflict');

      if(val !== 0){
        const span = document.createElement('div'); span.textContent = val; cell.appendChild(span);
      } else {
        const marks = pencilMarks[idx];
        if(marks && marks.size){
          const small = document.createElement('small'); small.className='pencil'; small.textContent = Array.from(marks).sort().join(' ');
          cell.appendChild(small);
        }
      }

      cell.addEventListener('click', ()=> onCellClick(idx));
      cell.tabIndex = 0;
      cell.addEventListener('keydown', (e)=>{
        if(e.key >= '1' && e.key <= '9'){ onNumberInput(Number(e.key)); e.preventDefault(); }
        else if(e.key === 'Backspace' || e.key === 'Delete'){ onNumberInput(0); e.preventDefault(); }
        else if(e.key === 'ArrowRight'){ moveSelection(0,1); e.preventDefault(); }
        else if(e.key === 'ArrowLeft'){ moveSelection(0,-1); e.preventDefault(); }
        else if(e.key === 'ArrowUp'){ moveSelection(-1,0); e.preventDefault(); }
        else if(e.key === 'ArrowDown'){ moveSelection(1,0); e.preventDefault(); }
      });

      boardEl.appendChild(cell);
    }
  }
}

function isPlacementValid(boardState, idx, val){
  const b = boardState; const r = Math.floor(idx/9), c = idx%9;
  for(let i=0;i<9;i++){
    if(i!==c && b[r*9+i]===val) return false;
    if(i!==r && b[i*9+c]===val) return false;
  }
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for(let i=0;i<3;i++) for(let j=0;j<3;j++){ const ii=(br+i)*9+(bc+j); if(ii!==idx && b[ii]===val) return false; }
  return true;
}

function onCellClick(idx){
  if(selected === idx) selected = null; else selected = idx;
  renderBoard();
}

function moveSelection(dr,dc){
  if(selected === null) selected = 0;
  const r = Math.floor(selected/9), c = selected%9;
  let nr = (r+dr+9)%9, nc = (c+dc+9)%9;
  selected = nr*9+nc; renderBoard();
  const node = document.querySelector(`.cell[data-idx="${selected}"]`);
  if(node) node.focus();
}

function onNumberInput(num){
  if(selected === null){ messageEl.textContent = 'Select a cell first'; return; }
  if(initial[selected] !== 0){ messageEl.textContent = 'No se puede cambiar una celda fija'; return; }
  if(num === 0){ current[selected] = 0; delete pencilMarks[selected]; renderBoard(); return; }
  if(pencil){
    if(!pencilMarks[selected]) pencilMarks[selected] = new Set();
    if(pencilMarks[selected].has(num)) pencilMarks[selected].delete(num); else pencilMarks[selected].add(num);
  } else {
    current[selected] = num; delete pencilMarks[selected];
  }
  renderBoard();
}

// handle keypad clicks
document.querySelectorAll('.key').forEach(k=>{
  k.addEventListener('click', ()=> {
    const n = Number(k.textContent.trim());
    onNumberInput(n);
  });
});
pencilToggle.addEventListener('change', ()=> pencil = pencilToggle.checked);

// global keyboard
window.addEventListener('keydown', (e)=>{
  if(e.key >= '1' && e.key <= '9'){ onNumberInput(Number(e.key)); e.preventDefault(); }
  if(e.key === 'Delete' || e.key === 'Backspace'){ onNumberInput(0); }
});

// actions
newBtn.addEventListener('click', ()=> initGame(difficultyEl.value));
solveBtn.addEventListener('click', ()=> { if(solution) { current = clone(solution); renderBoard(); stopTimer(); messageEl.textContent='Solución mostrada'; }});
clearBtn.addEventListener('click', ()=> { for(let i=0;i<81;i++) if(initial[i]===0) current[i]=0; pencilMarks={}; renderBoard(); });
hintBtn.addEventListener('click', ()=> {
  if(selected === null){ messageEl.textContent='Selecciona una celda para recibir una pista'; return; }
  if(initial[selected] !== 0){ messageEl.textContent='La celda es fija'; return; }
  current[selected] = solution[selected]; renderBoard(); messageEl.textContent='Pista aplicada';
});
validateBtn.addEventListener('click', ()=> {
  // mark conflicts visually by re-rendering; we also show a message
  let ok = true;
  for(let i=0;i<81;i++){
    if(current[i] !== 0 && !isPlacementValid(current, i, current[i])) ok=false;
  }
  messageEl.textContent = ok? 'Sin conflictos detectados' : 'Hay conflictos (marcados en rojo)';
  renderBoard();
});
checkBtn.addEventListener('click', ()=> {
  if(current.indexOf(0) !== -1){ messageEl.textContent='El tablero no está completo'; return; }
  const solved = solveBacktrack(current);
  if(solved) { messageEl.textContent = '¡Tablero completo y válido!'; stopTimer(); } else { messageEl.textContent = 'Solución no válida'; }
});

// ---------- Init ----------
function start(){
  initGame(difficultyEl.value || 'medium');
}
start();

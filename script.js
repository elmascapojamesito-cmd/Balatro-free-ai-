/* ====== Balatro — script.js ====== */
/* Notas: este archivo contiene la lógica principal del juego. Está pensado para ser funcional y legible. */

/* ---------- Datos básicos ---------- */
const SUITS = ['♠','♥','♦','♣'];
const VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];

function createStandardDeck(){
  const d = [];
  for(const s of SUITS) for(const v of VALUES) d.push({suit:s, value:v, code:v+s});
  // dos jokers por defecto
  d.push({suit:'', value:'JOKER', code:'J1'});
  d.push({suit:'', value:'JOKER', code:'J2'});
  return d;
}
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }

/* ---------- Hand scoring: require exactly 5 for flush/straight/straight-flush ---------- */
const HAND_POINTS = {'High Card':5,'Pair':20,'Two Pair':40,'Three of a Kind':60,'Straight':80,'Flush':100,'Full House':120,'Four of a Kind':160,'Straight Flush':200,'Royal Flush':300};

function rank(card){
  if(card.value === 'JOKER') return 100;
  if(card.value === 'A') return 14;
  if(card.value === 'K') return 13;
  if(card.value === 'Q') return 12;
  if(card.value === 'J') return 11;
  return parseInt(card.value,10);
}
function isFlush(cards){
  if(!cards || cards.length!==5) return false;
  const suits = cards.map(c=>c.suit); return new Set(suits).size===1;
}
function isStraight(cards){
  if(!cards || cards.length!==5) return false;
  const map={'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
  const nums = cards.map(c=>map[c.value]||0).sort((a,b)=>a-b);
  // A-2-3-4-5 special
  if(JSON.stringify(nums) === JSON.stringify([2,3,4,5,14])) return true;
  for(let i=1;i<nums.length;i++) if(nums[i] !== nums[i-1]+1) return false;
  return true;
}
function countPairs(cards){ const cnt={}; cards.forEach(c=>cnt[c.value]=(cnt[c.value]||0)+1); return Object.values(cnt).filter(x=>x===2).length; }

function evaluateHandFlexible(cards){
  // if any JOKER and 5 cards, favor straight flush
  if(cards.some(c=>c.value==='JOKER') && cards.length===5) return {name:'Straight Flush'};
  const vals = cards.map(c=>c.value);
  const counts = {}; vals.forEach(v=>counts[v]=(counts[v]||0)+1);
  const countsVals = Object.values(counts).sort((a,b)=>b-a);
  const flush = isFlush(cards);
  const straight = isStraight(cards);
  if(straight && flush){
    const ranks = cards.map(c=>rank(c));
    if(Math.max(...ranks)===14 && Math.min(...ranks)===10) return {name:'Royal Flush'};
    return {name:'Straight Flush'};
  }
  if(countsVals[0]===4) return {name:'Four of a Kind'};
  if(countsVals[0]===3 && countsVals[1]===2) return {name:'Full House'};
  if(flush) return {name:'Flush'};
  if(straight) return {name:'Straight'};
  if(countsVals[0]===3) return {name:'Three of a Kind'};
  if(countsVals[0]===2 && countsVals[1]===2) return {name:'Two Pair'};
  if(countsVals[0]===2) return {name:'Pair'};
  return {name:'High Card'};
}

/* ---------- Jokers catalog (simplified/ extensible) ---------- */
/* Each entry can have: id,name,emoji,desc,price,rare, onPlay,onRoundWin,onPurchase,accumulative,copyType,notes,unique */
const JOKER_CATALOG = [
  {id:'love', name:'Joker del Amor', emoji:'❤️', desc:'+5 pts si se juega un ♥', price:4, rare:'common', onPlay:(ctx)=>({delta: ctx.countSuit('♥')*5, msg:'+5 por ♥'}), notes:'No consume espacio'},
  {id:'ace', name:'Joker del As', emoji:'A', desc:'+15 pts por cada As', price:5, rare:'common', onPlay:(ctx)=>({delta: ctx.countValue('A')*15, msg:'+15 por As'})},
  {id:'retro', name:'Joker Retro', emoji:'⌛', desc:'+10 pts fijo', price:4, rare:'common', onPlay:()=>({delta:10,msg:'+10'})},
  {id:'plano', name:'Plano', emoji:'📄', desc:'Copia habilidad del joker de abajo', price:6, rare:'rare', copyType:'copyBelow'},
  {id:'lluvia', name:'Lluvia de Ideas', emoji:'💡', desc:'Copia habilidad del joker de arriba', price:6, rare:'rare', copyType:'copyAbove'},
  // Economic
  {id:'banquero', name:'Banquero', emoji:'🏦', desc:'+5 $ por ronda ganada', price:7, rare:'rare', onRoundWin:(ctx)=>({money:5,msg:'+5$ por ronda'}), accumulative:'rounds-won'},
  {id:'oro', name:'Corazón de Oro', emoji:'💖', desc:'+1 $ por cada ♥ jugado', price:3, rare:'common', onPlay:(ctx)=>({money: ctx.countSuit('♥')*1,msg:'+1$ por ♥'})},
  {id:'afortunada', name:'Mano Afortunada', emoji:'🍀', desc:'+2 $ si la mano tiene un As', price:4, rare:'uncommon', onPlay:(ctx)=>({money: ctx.countValue('A')>0?2:0,msg:'+2$ por As'})},
  {id:'inversor', name:'Inversor', emoji:'📈', desc:'+50% más dinero de fuentes', price:8, rare:'rare', onRoundWin:(ctx)=>({multMoney:1.5,msg:'+50% dinero'})},
  {id:'ladron', name:'Ladrón Sonriente', emoji:'🦹', desc:'+1 $ extra al comprar', price:6, rare:'rare', onPurchase:(ctx)=>({money:1,msg:'+1$ al comprar'})},
  // Special
  {id:'death', name:'La Muerte', emoji:'💀', desc:'0.5x global por cada mano consecutiva sin figuras; se reinicia al usar figura', price:9, rare:'epic', unique:true, notes:'Efecto global'},
  {id:'gros', name:'Gros Michael', emoji:'🍌', desc:'+100 fichas; 1/6 de destruirse al usarse', price:12, rare:'epic', unique:true, onPlay:(ctx)=>({delta:100, maybeDestroy:'gros'})},
  {id:'caven', name:'Cavendish', emoji:'🍌', desc:'3x multi global; aparece solo si Gros Michael fue destruido; 1/1000 de destruirse', price:40, rare:'legendary', unique:true, onPlay:(ctx)=>({mult:3, maybeDestroy:'caven'})},
  {id:'director', name:'Director de Película', emoji:'🎬', desc:'Permite que jokers/vouchers reaparezcan en tienda', price:20, rare:'legendary', unique:true, notes:'Permite reaparición'},
  {id:'gpt', name:'Joker GPT', emoji:'💬', desc:'Duplica efecto del mejor comodín activo; +10 fichas al activar', price:10, rare:'legendary', unique:true, notes:'Solo 1 por partida'},
];

/* ---------- Vouchers catalog ---------- */
/* Voucher: id,name,desc,price,rare, apply(ctx) */
const VOUCHER_CATALOG = [
  {id:'cryptip', name:'Cryptip', desc:'Crea 2 copias de la carta seleccionada (añadidas al mazo).', price:6, rare:'rare'},
  {id:'dupJoker', name:'Duplicador de Joker', desc:'Copia un Joker activo (se añade).', price:8, rare:'epic'},
  {id:'resetDiscards', name:'Reiniciar Descartes', desc:'Restablece tus descartes a 3.', price:3, rare:'common'},
  {id:'anjk', name:'Anjk', desc:'Copia 1 comodín y destruye los demás (consumible).', price:20, rare:'legendary'},
  // moldeo de mazo vouchers (no penalizaciones en la mayoría)
  {id:'refinador', name:'Refinador', desc:'Elimina una carta del mazo permanentemente.', price:6, rare:'rare'},
  {id:'dupDeck', name:'Duplicador de Mazo', desc:'Duplica una carta seleccionada en el mazo.', price:10, rare:'epic'},
  {id:'purificador', name:'Purificador', desc:'Convierte todas las cartas de una pinta a otra (elige).', price:9, rare:'epic'},
  {id:'evolucion', name:'Evolución', desc:'Convierte una carta en una figura (J/Q/K).', price:14, rare:'legendary'},
  {id:'rebootDeck', name:'Reinicio de Mazo', desc:'Baraja y elimina 3 cartas aleatorias.', price:12, rare:'legendary'},
  // 5 vouchers adicionales con/ sin penalizaciones
  {id:'reduceHand', name:'Reducción de Mano', desc:'Reduce tamaño de mano a 4 la siguiente ronda.', price:6, rare:'rare'},
  {id:'riskMulti', name:'Multiplicador Arriesgado', desc:'Duplica puntos de la siguiente mano; si fallas la ciega pierdes 50% fichas.', price:10, rare:'epic'},
  {id:'ghostCard', name:'Carta Fantasma', desc:'Una carta seleccionada gana status joker temporal; no puede descartarse.', price:7, rare:'rare'},
  {id:'chaosVoucher', name:'Voucher de Caos', desc:'Reorganiza el mazo; -1 descarte disponible.', price:8, rare:'epic'},
  {id:'dupRisk', name:'Duplicador Arriesgado', desc:'Duplica carta seleccionada; 10% de destruir la original.', price:15, rare:'legendary'}
];

/* ---------- Bosses ---------- */
const BOSSES = [
  {id:'kingSilent', name:'Rey del Silencio', icon:'👑', effect:'noFigures', bonus:{money:5}},
  {id:'coldHeart', name:'Corazón Frío', icon:'💔', effect:'zeroHearts', bonus:{points:100}},
  {id:'phoenix', name:'El Fénix', icon:'🐦‍🔥', effect:'resetMultiplierEachHand', bonus:{money:2, permMulti:0.2}},
  {id:'bankerBoss', name:'Banquero Dorado', icon:'💰', effect:'discardCosts', bonus:{money:10}},
  {id:'watcher', name:'El Vigilante', icon:'👁️', effect:'partialHidden', bonus:{joker:true}},
  {id:'belowZero', name:'Bajo Zero', icon:'❄️', effect:'forceFive', bonus:{moneyMulti:2}}
];

/* ---------- State ---------- */
const state = {
  deck: [], hand: [], discardPile: [], selected: [], lastHand: [], round:1, blind:200, accum:0,
  handsLeft:4, discardsLeft:3, money:4, activeJokers:[], jokerCounters:{}, voucherInv:[],
  shopSeen:{}, directorActive:false, destroyedGlobal:{}, deckType:'standard', goldenMult:1,
  bossCycle:3, currentBoss:null, deckView:[], maxJokers:5, grosDestroyed:false, uniqueJokerUsed:{}
};

/* ---------- DOM ---------- */
const el = id => document.getElementById(id);
const playerHandEl = el('playerHand'), lastHandEl = el('lastHand'), logEl = el('log'), jokerArea = el('jokerArea');
const roundEl = el('round'), blindEl = el('blind'), accumEl = el('accum'), handsLeftEl = el('handsLeft');
const discardsLeftEl = el('discardsLeft'), moneyEl = el('money');

const deckModal = el('deckModal'), shopModal = el('shopModal'), viewDeckModal = el('viewDeckModal');

/* ---------- Wiring ---------- */
el('newGame').addEventListener('click', ()=> openDeckModal());
el('chooseDeck').addEventListener('click', ()=> openDeckModal());
el('shuffleDeck').addEventListener('click', ()=>{ shuffle(state.deck); render(); addLog('Mazo barajado.'); });
el('discardSelected').addEventListener('click', discardSelected);
el('playHand').addEventListener('click', playHand);
el('endRound').addEventListener('click', endRound);
el('openShop').addEventListener('click', ()=> openShop());
el('closeShop').addEventListener('click', ()=> closeShop());
el('viewDeckBtn').addEventListener('click', ()=> openViewDeck());
el('closeDeckModal').addEventListener('click', ()=> deckModal.style.display='none');
el('closeDeckView').addEventListener('click', ()=> viewDeckModal.style.display='none');

/* ---------- Init deck selection UI ---------- */
function populateDeckSelection(){
  const cont = document.getElementById('deckSelect'); cont.innerHTML='';
  const decks = [
    {id:'standard', name:'Mazo Estándar', desc:'52 cartas clásicas'},
    {id:'golden', name:'Mazo Dorado', desc:'+ $10, -20% puntos'},
    {id:'crimson', name:'Mazo Carmesí', desc:'+25% puntos con corazones, - manos por ronda'},
    {id:'emerald', name:'Mazo Esmeralda', desc:'+1$ por cada descarte usado, empiezas con $0'},
    {id:'sapphire', name:'Mazo Zafiro', desc:'+ $20 inicio, cada carta jugada -1 punto'},
    {id:'shadow', name:'Mazo Sombrío', desc:'+15% puntos base; Jokers cuestan x2'},
    {id:'antiguo', name:'Mazo Antiguo', desc:'Sin figuras; 1.5x gratis; comienzas con $5'}
  ];
  for(const d of decks){
    const b = document.createElement('button'); b.className='deck-btn'; b.innerHTML=`<b>${d.name}</b><br><small>${d.desc}</small>`;
    b.onclick = ()=> chooseDeck(d.id);
    cont.appendChild(b);
  }
}
populateDeckSelection();

/* ---------- Game start / deck choose ---------- */
function openDeckModal(){ deckModal.style.display='flex'; }
function chooseDeck(id){
  deckModal.style.display='none';
  state.deckType = id;
  // defaults
  state.money = 4; state.goldenMult = 1; state.handsLeft=4;
  if(id==='golden'){ state.money=14; state.goldenMult=0.8; }
  if(id==='crimson'){ state.money=4; /* hearts bonus applied at scoring */ }
  if(id==='emerald'){ state.money=0; }
  if(id==='sapphire'){ state.money=20; }
  if(id==='shadow'){ /* jokers cost x2 handled in shop */ }
  if(id==='antiguo'){ state.money=5; state.goldenMult=2; }
  startGame();
}

function startGame(){
  state.deck = shuffle(createStandardDeck());
  // If mazo antiguo remove figures
  if(state.deckType==='antiguo'){
    state.deck = state.deck.filter(c => !['J','Q','K'].includes(c.value));
    // ensure deck size by adding extra non-figure low cards
    while(state.deck.length < 54){
      state.deck.push({suit: SUITS[Math.floor(Math.random()*4)], value: String(Math.floor(Math.random()*9)+2)});
    }
    state.deck = shuffle(state.deck);
  }
  state.hand=[]; state.selected=[]; state.lastHand=[]; state.round=1; state.blind=200; state.accum=0;
  state.handsLeft=4; state.discardsLeft=3; state.activeJokers=[]; state.jokerCounters={}; state.voucherInv=[];
  state.shopSeen={}; state.directorActive=false; state.destroyedGlobal={}; state.grosDestroyed=false; state.uniqueJokerUsed={};
  drawHand(8); render(); addLog('Partida iniciada. Mazo: '+state.deckType);
}

/* ---------- Draw/Render ---------- */
function drawHand(n){
  for(let i=0;i<n && state.deck.length>0;i++) state.hand.push(state.deck.pop());
}
function render(){
  roundEl.textContent = state.round; blindEl.textContent = state.blind; accumEl.textContent = state.accum;
  handsLeftEl.textContent = state.handsLeft; discardsLeftEl.textContent = state.discardsLeft; moneyEl.textContent = state.money;
  // hand
  playerHandEl.innerHTML = '';
  state.hand.forEach((c,i)=>{
    const elC = document.createElement('div'); elC.className='card'; elC.dataset.index=i;
    elC.innerHTML = `<div class="top">${c.value}</div><div class="center">${c.suit || '🤡'}</div><div class="bottom">${c.value}</div>`;
    if(c.suit==='♥' || c.suit==='♦') elC.style.color='crimson';
    if(state.selected.includes(i)) elC.classList.add('selected');
    elC.addEventListener('click', ()=> toggleSelect(i));
    playerHandEl.appendChild(elC);
  });
  // last hand
  lastHandEl.innerHTML=''; state.lastHand.forEach(c=> lastHandEl.appendChild(renderMiniCard(c)));
  // jokers
  jokerArea.innerHTML=''; state.activeJokers.forEach((jk, idx)=>{
    const jc = document.createElement('div'); jc.className='joker-card'; jc.draggable=true; jc.dataset.id=jk.instanceId;
    const left = document.createElement('div'); left.innerHTML=`<div style="font-size:20px">${jk.emoji||'🃏'}</div>`;
    const meta = document.createElement('div'); meta.className='meta';
    meta.innerHTML = `<div style="font-weight:700">${jk.name}</div><div style="font-size:12px;color:var(--muted)">${jk.desc}</div><div style="font-size:12px;color:var(--muted)">${jk.notes||''}</div>`;
    jc.appendChild(left); jc.appendChild(meta);
    jokerArea.appendChild(jc);
  });
  // vouchers inventory
  renderVoucherInv(); // usa la implementación correcta (no recursiva)
}
function renderMiniCard(c){
  const el = document.createElement('div'); el.className='card small'; el.style.width='64px'; el.style.height='88px';
  el.innerHTML = `<div class="top">${c.value}</div><div class="center">${c.suit||'🤡'}</div><div class="bottom">${c.value}</div>`;
  if(c.suit==='♥' || c.suit==='♦') el.style.color='crimson';
  return el;
}

/* ---------- Selection toggles ---------- */
function toggleSelect(i){
  if(state.selected.includes(i)) state.selected = state.selected.filter(x=>x!==i);
  else {
    if(state.selected.length < 5) state.selected.push(i);
    else addLog('Máximo 5 cartas seleccionadas.');
  }
  render();
}

/* ---------- Discard logic (uses 1 discard per use) ---------- */
function discardSelected(){
  if(state.discardsLeft <= 0){ addLog('No te quedan descartes.'); return; }
  if(state.selected.length === 0){ addLog('Selecciona cartas para descartar.'); return; }
  const toDiscard = state.selected.slice(0, state.discardsLeft);
  const idxs = [...toDiscard].sort((a,b)=>b-a);
  let count=0;
  for(const i of idxs){
    const removed = state.hand.splice(i,1)[0]; count++;
    state.discardPile.push(removed);
    addLog('Descartas '+(removed.value+(removed.suit||'')));
    // accumulative jokers might track hearts discarded etc
    if(removed.suit==='♥'){
      state.activeJokers.forEach(jk => { if(jk.accumulative==='hearts-discarded') state.jokerCounters[jk.instanceId] = (state.jokerCounters[jk.instanceId]||0)+1; });
    }
  }
  state.discardsLeft -= 1; // only consume 1 discard per discard action
  // draw replacements
  for(let k=0;k<count && state.deck.length>0;k++) state.hand.push(state.deck.pop());
  state.selected=[];
  render();
}

/* ---------- Play hand (1-5) with jokers resolution and rules for flush/straight require 5 ---------- */
function playHand(){
  if(state.selected.length === 0){ addLog('Selecciona entre 1 y 5 cartas para jugar.'); return; }
  // If boss effect forceFive active require exactly 5
  if(state.currentBoss && state.currentBoss.effect==='forceFive' && state.selected.length !== 5){ addLog('Bajo Zero exige jugar exactamente 5 cartas.'); return; }
  if(state.selected.length > 5){ addLog('Máximo 5 cartas.'); return; }

  const selectedCards = state.selected.map(i => state.hand[i]);
  // remove selected (desc order)
  const idxs = [...state.selected].sort((a,b)=>b-a);
  for(const i of idxs) state.hand.splice(i,1);
  state.lastHand = selectedCards.slice(); state.selected=[];

  // Evaluate
  const res = evaluateHandFlexible(selectedCards);
  let base = HAND_POINTS[res.name] || 0;
  // deck-type adjustments
  base = Math.floor(base * (state.goldenMult||1));
  // apply extra deck rules (crimson hearts bonus...)
  if(state.deckType==='crimson' && selectedCards.some(c=>c.suit==='♥')) base = Math.floor(base * 1.25);

  // build context
  const ctx = buildContext(selectedCards);

  // Resolve jokers with copy resolution
  const resolved = resolveActiveJokers();

  let mult = 1; let extra = 0; let moneyGain = 0;
  resolved.forEach(jk => {
    if(typeof jk.onPlay === 'function'){
      const out = jk.onPlay(ctx) || {};
      if(out.mult) mult *= out.mult;
      if(out.delta) extra += out.delta;
      if(out.money) moneyGain += out.money;
      if(out.maybeDestroy) handleMaybeDestroy(out.maybeDestroy, jk);
      if(out.msg) addLog(`Joker ${jk.name} aplicó: ${out.msg}`);
    }
  });

  // Death (La Muerte) global multiplier handling: handled in resolved onPlay if present
  let points = Math.floor((base + extra) * mult);
  state.accum += points;
  state.handsLeft--;
  addLog(`Mano: ${res.name} (+${points} pts). Acumulado: ${state.accum}`);

  if(moneyGain) { state.money += moneyGain; addLog(`Ganas $${moneyGain} por jokers.`); }

  // refill to 8
  while(state.hand.length < 8 && state.deck.length > 0) state.hand.push(state.deck.pop());
  render();

  // Check if reached blind
  if(state.accum >= state.blind){
    addLog('¡Has superado la ciega!');
    // compute reward
    let reward = 2 + Math.floor((state.accum - state.blind)/100);
    // apply onRoundWin jokers
    let roundMoney = reward; let roundMult = 1;
    resolved.forEach(jk => {
      if(typeof jk.onRoundWin === 'function'){
        const out = jk.onRoundWin({state}) || {};
        if(out.money) roundMoney += out.money;
        if(out.multMoney) roundMult *= out.multMoney;
        if(out.msg) addLog(`Joker ${jk.name} aplicó en victoria: ${out.msg}`);
      }
    });
    roundMoney = Math.floor(roundMoney * roundMult);
    state.money += roundMoney;
    addLog(`Recibes $${roundMoney}. Dinero: $${state.money}`);
    // increment rounds-won counters
    state.activeJokers.forEach(jk => { if(jk.accumulative==='rounds-won') state.jokerCounters[jk.instanceId] = (state.jokerCounters[jk.instanceId]||0)+1; });
    // open shop
    openShop();
  } else if(state.handsLeft <= 0){
    addLog('No superaste la ciega y te quedaste sin manos. Fin de ronda (derrota).');
  }
}

/* ---------- Context builder ---------- */
function buildContext(selectedCards){
  return {
    selection: selectedCards,
    money: state.money,
    discardsUsed: totalDiscardsUsed(),
    repeatedHand: state.lastHandType === (evaluateHandFlexible(selectedCards).name),
    countSuit: s => selectedCards.filter(c=>c.suit===s).length,
    countValue: v => selectedCards.filter(c=>c.value===v).length,
    countDistinctSuits: ()=> new Set(selectedCards.map(c=>c.suit)).size,
    handIsFlush: ()=> isFlush(selectedCards),
    handIsStraight: ()=> isStraight(selectedCards),
    countPairs: ()=> countPairs(selectedCards),
    countNumeric: ()=> selectedCards.filter(c=>!isNaN(parseInt(c.value))).length,
    bestIs: v => { const ranks = selectedCards.map(c=>rank(c)); const max=Math.max(...ranks); const best = selectedCards.find(c=>rank(c)===max); return best && best.value===v; },
    countFigures: ()=> selectedCards.filter(c=>['J','Q','K'].includes(c.value)).length,
    hasJokerInSelection: ()=> selectedCards.some(c=>c.value==='JOKER')
  };
}

/* ---------- Resolve copy jokers runtime ---------- */
function resolveActiveJokers(){
  // Return array of resolved joker objects (with effective onPlay/onRoundWin etc)
  const resolved = [];
  for(let i=0;i<state.activeJokers.length;i++){
    const jk = state.activeJokers[i];
    if(jk.copyType === 'copyBelow' || jk.id==='plano'){
      const target = state.activeJokers[i+1];
      if(target) resolved.push(resolveActiveJokerRecursive(i+1));
      else resolved.push({name:jk.name}); // no-op
    } else if(jk.copyType === 'copyAbove' || jk.id==='lluvia'){
      const target = state.activeJokers[i-1];
      if(target) resolved.push(resolveActiveJokerRecursive(i-1));
      else resolved.push({name:jk.name});
    } else {
      resolved.push(jk);
    }
  }
  return resolved;
}
function resolveActiveJokerRecursive(index){
  const j = state.activeJokers[index];
  if(!j) return null;
  if(j.copyType==='copyBelow') return resolveActiveJokerRecursive(index+1) || j;
  if(j.copyType==='copyAbove') return resolveActiveJokerRecursive(index-1) || j;
  return j;
}

/* ---------- Maybe destroy logic for Gros/Cavendish ---------- */
function handleMaybeDestroy(flag, jk){
  if(flag==='gros'){
    // 1/6 chance
    if(Math.random() < 1/6){
      // destroy this instance
      removeJokerByInstance(jk.instanceId);
      state.destroyedGlobal['gros'] = true;
      addLog(`${jk.name} fue destruido al usarse.`);
    }
  }
  if(flag==='caven'){
    if(Math.random() < 1/1000){
      removeJokerByInstance(jk.instanceId);
      state.destroyedGlobal['caven'] = true;
      addLog(`${jk.name} fue destruido al usarse.`);
    }
  }
}

/* ---------- Remove joker by instance ---------- */
function removeJokerByInstance(instId){
  state.activeJokers = state.activeJokers.filter(j=> j.instanceId !== instId);
  render();
}

/* ---------- total discards used (helper) ---------- */
function totalDiscardsUsed(){ let s=0; for(const k in state.jokerCounters) s += state.jokerCounters[k]||0; return s; }

/* ---------- Shop system (unique appearance unless directorActive) ---------- */
function openShop(){
  el('shopMoney').textContent = state.money;
  const shopJ = el('shopJokers'); const shopV = el('shopVouchers');
  shopJ.innerHTML = ''; shopV.innerHTML='';
  // choose up to 3 jokers random but respect unique/seen unless directorActive
  const jokerPool = shuffle(JOKER_CATALOG.slice());
  let chosenJ = [];
  for(const jk of jokerPool){
    if(chosenJ.length>=3) break;
    if(jk.unique && state.uniqueJokerUsed[jk.id]) continue;
    const allowRepeat = state.directorActive;
    if(!allowRepeat && state.shopSeen[jk.id]) continue;
    // special condition: Cavendish only listed if gros destroyed
    if(jk.id==='caven' && !state.destroyedGlobal['gros']) continue;
    chosenJ.push(jk);
  }
  // render Jokers
  chosenJ.forEach(jk=>{
    const div = document.createElement('div'); div.className='shop-item';
    const price = (state.deckType==='shadow') ? (jk.price*2) : jk.price;
    div.innerHTML = `<b>${jk.emoji||'🃏'} ${jk.name} ($${price})</b><div style="color:var(--muted)">${jk.desc}</div>`;
    const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Comprar';
    btn.onclick = ()=>{
      if(state.money < price) return alert('No tienes suficiente dinero.');
      if(state.activeJokers.length >= state.maxJokers) return alert('Máximo jokers activos.');
      state.money -= price;
      const inst = Object.assign({}, jk); inst.instanceId = 'jk_'+Math.random().toString(36).slice(2,9);
      // mark accumulative
      if(inst.id==='love') inst.accumulative='hearts-played';
      if(inst.id==='banquero') inst.accumulative='rounds-won';
      state.activeJokers.push(inst);
      state.shopSeen[jk.id] = true;
      if(jk.unique) state.uniqueJokerUsed[jk.id] = true;
      // if Director purchased activate director flag
      if(jk.id==='director') state.directorActive=true;
      // apply onPurchase effects
      if(typeof inst.onPurchase === 'function'){ const out = inst.onPurchase({state})||{}; if(out.money) state.money += out.money; }
      addLog(`Compraste ${jk.name}`);
      render(); el('shopMoney').textContent = state.money;
    };
    div.appendChild(btn);
    shopJ.appendChild(div);
  });

  // vouchers: up to 5 random, allow repeats unless directorActive false and seen
  const vPool = shuffle(VOUCHER_CATALOG.slice());
  const chosenV = [];
  for(const v of vPool){
    if(chosenV.length>=6) break;
    if(!state.directorActive && state.shopSeen['v_'+v.id]) continue;
    chosenV.push(v);
  }
  chosenV.forEach(v=>{
    const div = document.createElement('div'); div.className='shop-item';
    div.innerHTML = `<b>${v.name} ($${v.price})</b><div style="color:var(--muted)">${v.desc}</div>`;
    const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Comprar';
    btn.onclick = ()=> {
      if(state.money < v.price) return alert('No tienes suficiente dinero.');
      state.money -= v.price;
      state.voucherInv.push(Object.assign({}, v));
      state.shopSeen['v_'+v.id] = true;
      addLog(`Compraste voucher ${v.name}`);
      el('shopMoney').textContent = state.money; renderVoucherInv();
    };
    div.appendChild(btn); shopV.appendChild(div);
  });

  shopModal.style.display='flex';
}
function closeShop(){ shopModal.style.display='none'; render(); }

/* ---------- Voucher inventory rendering & use ---------- */
function renderVoucherInv(){
  const inv = el('voucherInventory'); if(!inv) return;
  inv.innerHTML='';
  state.voucherInv.forEach((v, idx)=>{
    const d = document.createElement('div'); d.className='voucher-item';
    d.innerHTML = `<b>${v.name}</b> <div style="color:var(--muted)">${v.desc}</div>`;
    const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Usar';
    btn.onclick = ()=> useVoucher(idx);
    const sellBtn = document.createElement('button'); sellBtn.className='btn'; sellBtn.textContent='Vender';
    sellBtn.onclick = ()=> { state.money += Math.floor(v.price/2); state.voucherInv.splice(idx,1); renderVoucherInv(); render(); addLog(`Vendiste voucher ${v.name}`); };
    d.appendChild(btn); d.appendChild(sellBtn); inv.appendChild(d);
  });
}

/* ---------- Voucher use (simplified selection flows) ---------- */
function useVoucher(idx){
  const v = state.voucherInv[idx];
  if(!v) return;
  // Some vouchers require selecting card or joker; we'll do basic flows via prompt for simplicity
  if(v.id==='cryptip'){
    // select card value from prompt
    const cardStr = prompt('Escribe la carta a copiar (ej "A♥" o "10♠"):');
    if(!cardStr) return;
    // find card in deck by code
    const found = state.deck.find(c => (c.value + c.suit) === cardStr);
    if(!found){ alert('Carta no encontrada en el mazo.'); return; }
    // create two copies
    state.deck.push({...found}); state.deck.push({...found});
    shuffle(state.deck); addLog('Cryptip usado: 2 copias añadidas al mazo.');
  } else if(v.id==='dupJoker'){
    if(state.activeJokers.length===0){ alert('No hay jokers activos para duplicar.'); return; }
    // choose index
    const idxJ = parseInt(prompt(`Elige índice de joker a duplicar (0..${state.activeJokers.length-1})`),10);
    if(isNaN(idxJ) || !state.activeJokers[idxJ]) return;
    const clone = Object.assign({}, state.activeJokers[idxJ]); clone.instanceId = 'jk_'+Math.random().toString(36).slice(2,9);
    state.activeJokers.push(clone); addLog('Duplicador usado: joker clonado.');
  } else if(v.id==='resetDiscards'){
    state.discardsLeft = 3; addLog('Reiniciados descartes a 3.');
  } else if(v.id==='anjk'){
    // choose joker to copy
    if(state.activeJokers.length===0){ alert('No tienes jokers.'); return; }
    const idxJ = parseInt(prompt(`Elige índice de joker a conservar como copia (0..${state.activeJokers.length-1})`),10);
    if(isNaN(idxJ) || !state.activeJokers[idxJ]) return;
    const toKeep = Object.assign({}, state.activeJokers[idxJ]); toKeep.instanceId = 'jk_'+Math.random().toString(36).slice(2,9);
    // remove others (and mark destroyed if unique)
    const others = state.activeJokers.filter((_,i)=>i!==idxJ);
    others.forEach(o=> { if(o.unique) state.destroyedGlobal[o.id]=true; });
    state.activeJokers = [toKeep];
    addLog('Anjk usado: copia creada y demás jokers destruidos.');
  } else if(v.id==='refinador' || v.id==='dupDeck' || v.id==='purificador' || v.id==='evolucion' || v.id==='rebootDeck' || v.id==='reduceHand' || v.id==='riskMulti' || v.id==='ghostCard' || v.id==='chaosVoucher' || v.id==='dupRisk'){
    // For brevity implement key ones basic:
    if(v.id==='refinador'){
      const code = prompt('Escribe carta a eliminar del mazo (ej "A♥"):'); if(!code) return;
      const idxd = state.deck.findIndex(c=> (c.value+c.suit)===code); if(idxd>=0) { state.deck.splice(idxd,1); addLog('Refinador: carta eliminada.'); }
      else alert('Carta no encontrada.');
    } else if(v.id==='dupDeck'){
      const code = prompt('Carta a duplicar en el mazo (ej "10♣"):'); if(!code) return;
      const found = state.deck.find(c=> (c.value+c.suit)===code); if(found){ state.deck.push({...found}); addLog('Duplicador de Mazo: duplicada.'); } else alert('No encontrada.');
    } else if(v.id==='purificador'){
      const from = prompt('Convierte de (palo) ♠ ♥ ♦ ♣ :'); const to = prompt('Convierte a (palo):');
      if(!from||!to) return; state.deck.forEach(c=>{ if(c.suit===from) c.suit=to; }); addLog('Purificador aplicado.');
    } else if(v.id==='evolucion'){
      const code = prompt('Carta a convertir en figura (ej "9♣"):'); const fig = prompt('Elige figura J/Q/K:');
      const idxd = state.deck.findIndex(c=> (c.value+c.suit)===code);
      if(idxd>=0 && ['J','Q','K'].includes(fig)){ state.deck[idxd].value = fig; addLog('Evolución aplicada.'); } else alert('Error.');
    } else if(v.id==='rebootDeck'){
      shuffle(state.deck);
      for(let i=0;i<3 && state.deck.length>0;i++) state.deck.splice(Math.floor(Math.random()*state.deck.length),1);
      addLog('Reinicio de mazo aplicado.');
    } else if(v.id==='reduceHand'){
      // reduce next round hand size flag
      state.nextRoundMaxHand = 4; addLog('La próxima ronda tendrás tamaño máximo de mano 4.');
    } else if(v.id==='riskMulti'){
      state.nextRiskMulti = true; addLog('Voucher arriesgado: la siguiente mano tendrá x2 puntos (si fallas pierdes 50% fichas).');
    } else if(v.id==='ghostCard'){
      addLog('Voucher Carta Fantasma aplicado (selección manual no implementada en UI simplificada).');
    } else if(v.id==='chaosVoucher'){
      shuffle(state.deck); state.discardsLeft = Math.max(0, state.discardsLeft-1); addLog('Voucher de Caos aplicado (-1 descarte).');
    } else if(v.id==='dupRisk'){
      addLog('Duplicador arriesgado aplicado (acción manual no implementada completamente).');
    }
  }
  // remove voucher after use
  state.voucherInv.splice(idx,1); render(); renderVoucherInv();
}

/* ---------- Selling jokers ---------- */
function sellJoker(index){
  const jk = state.activeJokers[index];
  if(!jk) return;
  const price = Math.floor((jk.price||6)/2);
  state.money += price;
  if(jk.unique) state.destroyedGlobal[jk.id] = true;
  state.activeJokers.splice(index,1);
  addLog(`Vendiste ${jk.name} por $${price}`);
  render();
}

/* ---------- View deck modal ---------- */
function openViewDeck(){
  const cont = el('deckList'); cont.innerHTML = '';
  state.deck.forEach(c=> {
    const d = document.createElement('div'); d.className='card-mini'; d.textContent = c.value + (c.suit||'');
    cont.appendChild(d);
  });
  viewDeckModal.style.display='flex';
}

/* ---------- Shop close / utilities ---------- */
function addLog(text){ const d=document.createElement('div'); d.textContent='['+new Date().toLocaleTimeString()+'] '+text; logEl.prepend(d); }

/* ---------- Simple helpers for start demo ---------- */
document.addEventListener('DOMContentLoaded', ()=> {
  // open deck selection
  deckModal.style.display='flex';
  render();
});

/* ---------- End of file: core features implemented ---------- */
/* ===============================
   🃏 SISTEMA DE TRUCOS SECRETO 🃏
   ACTIVAR CON: JAJAJA
   =============================== */

(function() {
  let cheatBuffer = "";

  // Crear el menú de trucos
  const cheatMenu = document.createElement("div");
  cheatMenu.id = "cheatMenu";
  Object.assign(cheatMenu.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "rgba(0, 0, 0, 0.92)",
    color: "white",
    padding: "25px",
    border: "2px solid gold",
    borderRadius: "15px",
    display: "none",
    zIndex: "99999",
    fontFamily: "monospace",
    textAlign: "center"
  });
  cheatMenu.innerHTML = `
    <h2>🃏 Menú de Trucos 🃏</h2>
    <button id="moneyBtn">💰 Dar 999$</button><br><br>
    <button id="jokerBtn">🃏 Añadir Joker GPT</button><br><br>
    <button id="skipBtn">⏭ Pasar Ronda</button><br><br>
    <button id="deckBtn">🎴 Ver Mazo</button><br><br>
    <button id="closeBtn">❌ Cerrar</button>
  `;
  document.body.appendChild(cheatMenu);

  // Mostrar menú al escribir "JAJAJA"
  document.addEventListener("keydown", (e) => {
    cheatBuffer += e.key.toUpperCase();
    if (cheatBuffer.endsWith("JAJAJA")) {
      cheatMenu.style.display = "block";
      cheatBuffer = "";
    }
    if (cheatBuffer.length > 6) cheatBuffer = cheatBuffer.slice(-6);
  });

  // Función para cerrar el menú
  function closeCheatMenu() {
    cheatMenu.style.display = "none";
  }
  document.getElementById("closeBtn").onclick = closeCheatMenu;

  // ✅ Funciones de trucos con seguridad
  function safeGet(variableName) {
    try {
      return window[variableName];
    } catch {
      return undefined;
    }
  }

  function safeCall(funcName, ...args) {
    if (typeof window[funcName] === "function") {
      window[funcName](...args);
      return true;
    }
    alert(`⚠️ No se encontró la función ${funcName}()`);
    return false;
  }

  // 💰 Dar dinero
  document.getElementById("moneyBtn").onclick = () => {
    const money = safeGet("playerMoney");
    if (typeof money === "number") {
      window.playerMoney += 999;
      if (typeof updateMoneyDisplay === "function") updateMoneyDisplay();
      alert("💰 Has recibido 999$");
    } else {
      alert("⚠️ El dinero del jugador no está definido aún.");
    }
  };

  // 🃏 Añadir Joker GPT
  document.getElementById("jokerBtn").onclick = () => {
    const allJokers = safeGet("jokers");
    const playerJokers = safeGet("playerJokers");
    if (Array.isArray(allJokers) && Array.isArray(playerJokers)) {
      const found = allJokers.find(j => j.name === "Joker GPT");
      if (found) {
        playerJokers.push(found);
        if (typeof renderJokers === "function") renderJokers();
        alert("🃏 Has añadido el comodín Joker GPT");
      } else {
        alert("❌ No se encontró el Joker GPT en la lista de jokers");
      }
    } else {
      alert("⚠️ Los comodines aún no se han inicializado.");
    }
  };

  // ⏭ Saltar ronda
  document.getElementById("skipBtn").onclick = () => {
    if (!safeCall("nextBlind")) {
      alert("⚠️ El juego aún no ha cargado las rondas.");
    } else {
      alert("⏭ Has pasado a la siguiente ronda");
    }
  };

  // 🎴 Ver mazo
  document.getElementById("deckBtn").onclick = () => {
    const deck = safeGet("deck");
    if (Array.isArray(deck)) {
      const cardsList = deck.map(c => `${c.rank}${c.suit}`).join(", ");
      alert(`🎴 Tu mazo:\n${cardsList}`);
    } else {
      alert("⚠️ El mazo aún no está disponible.");
    }
  };
})();

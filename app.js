const COLORS=["black","white","red","blue","green"];
const ALL=["black","white","red","blue","green","gold"];
const LABEL={black:"Ónix",white:"Gyémánt",red:"Rubin",blue:"Zafír",green:"Smaragd",gold:"Arany"};
const ICON={black:"●",white:"●",red:"●",blue:"●",green:"●",gold:"★"};
let state=null, selectedAction=null, selectedColors=[];

function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}

function freshDecks(){
  return [1,2,3].map(t=>
    shuffle(
      CARD_DATA
        .filter(c=>c.tier===t)
        .map(c=>({...c,id:c.id+"-"+uid()}))
    )
  );
}

function initialState(names){
  const n=names.length;
  const bank={
    black:n===2?4:n===3?5:7,
    white:n===2?4:n===3?5:7,
    red:n===2?4:n===3?5:7,
    blue:n===2?4:n===3?5:7,
    green:n===2?4:n===3?5:7,
    gold:5
  };

  const decks=freshDecks();
  const market={1:[],2:[],3:[]};

  for(const t of [1,2,3]){
    for(let i=0;i<4;i++){
      market[t].push(decks[t-1].pop());
    }
  }

  return {
    version:2,
    turn:0,
    round:1,
    endTriggered:false,
    endTriggerIndex:null,
    winner:null,
    bank,
    decks,
    market,
    nobles:shuffle(NOBLE_DATA)
      .slice(0,n+1)
      .map(x=>({...x,claimedBy:null})),
    players:names.map((name,i)=>({
      id:"p"+i,
      name,
      tokens:{
        black:0,
        white:0,
        red:0,
        blue:0,
        green:0,
        gold:0
      },
      cards:[],
      reserved:[],
      nobles:[],
      points:0
    })),
    log:["A játék elkezdődött."]
  };
}

function save(){
  if(state){
    localStorage.setItem("splendor-prototype",JSON.stringify(state));
    toast("Játék mentve");
  }
}

function load(){
  try{
    const x=JSON.parse(localStorage.getItem("splendor-prototype"));
    if(x?.version===2){
      state=x;
      return true;
    }
  }catch(e){}
  return false;
}

function fmtReq(req){
  return Object.entries(req)
    .filter(([,v])=>v)
    .map(([c,v])=>pip(c,v))
    .join("");
}

function pip(c,n=1){
  return `<span class="pip"><i class="dot ${c}"></i>${n}</span>`;
}

function bonusCount(p,c){
  return p.cards.filter(x=>x.bonus===c).length;
}

function totalTokens(p){
  return ALL.reduce((s,c)=>s+p.tokens[c],0);
}

function affordability(p,card){
  let needGold=0;

  for(const c of COLORS){
    const need=Math.max(
      0,
      (card.cost[c]||0)-bonusCount(p,c)
    );

    const own=p.tokens[c];

    needGold+=Math.max(
      0,
      need-own
    );
  }

  return needGold<=p.tokens.gold;
}

function paymentFor(p,card){
  if(!affordability(p,card)) return null;

  const pay={
    black:0,
    white:0,
    red:0,
    blue:0,
    green:0,
    gold:0
  };

  let gold=0;

  for(const c of COLORS){
    const need=Math.max(
      0,
      (card.cost[c]||0)-bonusCount(p,c)
    );

    pay[c]=Math.min(
      p.tokens[c],
      need
    );

    gold+=need-pay[c];
  }

  pay.gold=gold;

  return pay;
}

function log(msg){
  state.log.push(msg);

  if(state.log.length>80){
    state.log.shift();
  }
}

function refill(t){
  while(
    state.market[t].length<4 &&
    state.decks[t-1].length
  ){
    state.market[t].push(
      state.decks[t-1].pop()
    );
  }
}

function claimNoble(p){
  const eligible=state.nobles.filter(n=>
    !n.claimedBy &&
    Object.entries(n.req).every(
      ([c,v])=>bonusCount(p,c)>=v
    )
  );

  if(!eligible.length) return;

  if(eligible.length===1){
    takeNoble(p,eligible[0]);
    return;
  }

  showNobleChoice(eligible);
}

function takeNoble(p,n){
  n.claimedBy=p.id;
  p.nobles.push(n);
  p.points+=n.points;

  log(
    `<b>${p.name}</b> megszerzett egy nemest (+${n.points} pont).`
  );
}

function endTurn(){
  const p=state.players[state.turn];

  if(totalTokens(p)>10){
    showDiscard();
    return;
  }

  claimNoble(p);

  if(!state.nobleChoice){
    checkEnd();
  }
}

function checkEnd(){
  if(!state.endTriggered){
    const trigger=state.players.findIndex(
      p=>p.points>=15
    );

    if(trigger!==-1){
      state.endTriggered=true;
      state.endTriggerIndex=state.turn;

      log(
        "Valaki elérte a 15 pontot – minden játékos befejezi az aktuális fordulót."
      );
    }
  }

  save();
  render();
}

function advance(){
  state.turn=
    (state.turn+1)%state.players.length;

  if(state.turn===0){
    state.round++;
  }

  /*
   * A játék akkor ér véget, amikor a 15 pontot
   * elérő játékos után minden játékos befejezte
   * ugyanazt a fordulót.
   *
   * endTriggerIndex azt a játékost jelöli,
   * akinek a köre közben először elérték
   * a 15 pontot.
   */

  if(
    state.endTriggered &&
    state.turn===state.endTriggerIndex
  ){
    const sorted=[...state.players].sort(
      (a,b)=>
        b.points-a.points ||
        a.cards.length-b.cards.length
    );

    state.winner=sorted[0].id;

    log(
      `<b>${sorted[0].name}</b> nyerte a játékot ${sorted[0].points} ponttal.`
    );

    render();
    save();
    return;
  }

  selectedAction=null;
  selectedColors=[];

  render();
  save();
}

function completeAction(){
  const p=state.players[state.turn];

  if(totalTokens(p)>10){
    showDiscard();
    return;
  }

  claimNoble(p);

  if(!state.nobleChoice){
    checkEnd();
  }
}

function take3(colors){
  const p=state.players[state.turn];

  if(
    colors.length!==3 ||
    new Set(colors).size!==3
  ){
    return toast(
      "Pontosan 3 különböző színt válassz."
    );
  }

  if(
    colors.some(c=>state.bank[c]<1)
  ){
    return toast(
      "Ebből a színből nincs elég zseton."
    );
  }

  colors.forEach(c=>{
    state.bank[c]--;
    p.tokens[c]++;
  });

  log(
    `<b>${p.name}</b> 3 különböző zsetont vett el.`
  );

  selectedColors=[];
  selectedAction=null;

  endTurn();

  if(!state.nobleChoice){
    advance();
  }
}

function take2(c){
  const p=state.players[state.turn];

  if(state.bank[c]<4){
    return toast(
      "2 azonos zsetonhoz legalább 4-nek kell lennie a bankban."
    );
  }

  state.bank[c]-=2;
  p.tokens[c]+=2;

  log(
    `<b>${p.name}</b> 2 ${LABEL[c]} zsetont vett el.`
  );

  selectedAction=null;

  endTurn();

  if(!state.nobleChoice){
    advance();
  }
}

function reserve(card,t){
  const p=state.players[state.turn];

  if(p.reserved.length>=3){
    return toast(
      "Legfeljebb 3 tartalék kártyád lehet."
    );
  }

  const idx=state.market[t].findIndex(
    x=>x.id===card.id
  );

  if(idx<0) return;

  p.reserved.push(card);

  state.market[t].splice(idx,1);
  refill(t);

  if(state.bank.gold>0){
    state.bank.gold--;
    p.tokens.gold++;
  }

  log(
    `<b>${p.name}</b> tartalékolt egy ${t}. szintű kártyát.`
  );

  selectedAction=null;

  endTurn();

  if(!state.nobleChoice){
    advance();
  }
}

function buy(card,source,t,idx){
  const p=state.players[state.turn];
  const pay=paymentFor(p,card);

  if(!pay){
    return toast(
      "Ezt a kártyát még nem tudod megvenni."
    );
  }

  for(const c of ALL){
    p.tokens[c]-=pay[c];
    state.bank[c]+=pay[c];
  }

  p.cards.push(card);
  p.points+=card.points;

  if(source==="market"){
    state.market[t].splice(idx,1);
    refill(t);
  }else{
    p.reserved=
      p.reserved.filter(
        x=>x.id!==card.id
      );
  }

  log(
    `<b>${p.name}</b> megvásárolt egy ${
      source==="market"
        ? `${t}. szintű`
        : "tartalék"
    } kártyát${
      card.points
        ? ` (+${card.points} pont)`
        : ""
    }.`
  );

  selectedAction=null;

  endTurn();

  if(!state.nobleChoice){
    advance();
  }
}

function showDiscard(){
  const p=state.players[state.turn];
  const discard={};

  const refresh=()=>{
    const returned=
      Object.values(discard)
        .reduce((a,b)=>a+b,0);

    document.getElementById(
      "discardCount"
    ).textContent=
      `Visszaadva: ${returned} · Marad: ${
        totalTokens(p)-returned
      } / 10`;

    document.getElementById(
      "discardConfirm"
    ).disabled=
      totalTokens(p)-returned>10;
  };

  actionArea.innerHTML=`
    <div class="panel" style="margin:0;background:#0f1929">
      <b>${p.name}</b>, 10 zsetonnál több van nálad.
      Add vissza a felesleget a bankba.
    </div>

    <div class="choice-grid" id="discardGrid"></div>

    <div class="selected-count" id="discardCount"></div>

    <button class="primary confirm" id="discardConfirm">
      Visszatenni a bankba
    </button>
  `;

  const grid=
    document.getElementById("discardGrid");

  for(const c of ALL){
    if(!p.tokens[c]) continue;

    const b=document.createElement("div");
    b.className="choice";

    b.innerHTML=`
      <div>
        ${pip(c)}
        ${LABEL[c]} · nálad: ${p.tokens[c]}
      </div>

      <div style="
        display:flex;
        gap:6px;
        justify-content:center;
        margin-top:8px
      ">
        <button type="button" data-minus>−</button>
        <b data-q>0</b>
        <button type="button" data-plus>+</button>
      </div>
    `;

    const q=b.querySelector("[data-q]");

    b.querySelector("[data-minus]").onclick=()=>{
      discard[c]=Math.max(
        0,
        (discard[c]||0)-1
      );

      q.textContent=discard[c];
      refresh();
    };

    b.querySelector("[data-plus]").onclick=()=>{
      if(
        (discard[c]||0)<p.tokens[c]
      ){
        discard[c]=(discard[c]||0)+1;
        q.textContent=discard[c];
        refresh();
      }
    };

    grid.appendChild(b);
  }

  document.getElementById(
    "discardConfirm"
  ).onclick=()=>{
    const returned=
      Object.values(discard)
        .reduce((a,b)=>a+b,0);

    if(totalTokens(p)-returned>10){
      return toast(
        "Legalább annyi zsetont adj vissza, hogy 10 maradjon."
      );
    }

    for(const [c,n] of Object.entries(discard)){
      p.tokens[c]-=n;
      state.bank[c]+=n;
    }

    endTurn();

    if(!state.nobleChoice){
      advance();
    }
  };

  refresh();
}

function showNobleChoice(eligible){
  const p=state.players[state.turn];

  state.nobleChoice=true;

  actionArea.innerHTML=`
    <div class="panel" style="margin:0;background:#0f1929">
      <b>${p.name}</b>, több nemes feltétele teljesül.
      Válassz egyet:
    </div>

    <div class="choice-grid" id="nobleChoices"></div>
  `;

  eligible.forEach(n=>{
    const b=document.createElement("button");

    b.className="choice";

    b.innerHTML=
      `+${n.points} pont · ${fmtReq(n.req)}`;

    b.onclick=()=>{
      takeNoble(p,n);

      delete state.nobleChoice;

      checkEnd();
      advance();
    };

    document
      .getElementById("nobleChoices")
      .appendChild(b);
  });
}

function cardHtml(c,extra=""){
  return `
    <div
      class="card ${c.bonus} ${extra}"
      data-card="${c.id}"
    >
      <div class="points">
        ${c.points||"·"}
      </div>

      <div class="bonus">
        <i class="dot ${c.bonus}"></i>
      </div>

      <div class="cost">
        ${
          Object.entries(c.cost)
            .filter(([,v])=>v)
            .map(([x,v])=>pip(x,v))
            .join("")
        }
      </div>
    </div>
  `;
}

function render(){
  if(!state){
    setup();
    return;
  }

  setupView.classList.add("hidden");
  gameView.classList.remove("hidden");

  const p=state.players[state.turn];

  turnBanner.innerHTML=
    state.winner
      ? `🏆 <b>${
          state.players.find(
            x=>x.id===state.winner
          ).name
        }</b> nyert – ${
          state.players.find(
            x=>x.id===state.winner
          ).points
        } pont`
      : `Most <b>${p.name}</b> következik · ${state.round}. forduló`;

  nobles.innerHTML=
    state.nobles.map(n=>`
      <div class="noble ${
        n.claimedBy
          ? "claimed"
          : ""
      }">
        <div class="noble-title">
          Nemes · ${n.points} pont
        </div>

        <div class="req">
          ${fmtReq(n.req)}
        </div>

        ${
          n.claimedBy
            ? `<small>${
                state.players.find(
                  x=>x.id===n.claimedBy
                )?.name||""
              }</small>`
            : ""
        }
      </div>
    `).join("");

  market.innerHTML=
    [3,2,1].map(t=>`
      <div class="tier">

        <div class="tier-title">
          ${t}. SZINT · ${state.decks[t-1].length} maradt
        </div>

        <div class="card-row">
          ${state.market[t]
            .map(c=>cardHtml(c))
            .join("")}
        </div>

      </div>
    `).join("");

  bank.innerHTML=
    ALL.map(c=>`
      <div class="bank-token">

        <button
          class="${c}"
          data-bank="${c}"
        >
          ${ICON[c]}
        </button>

        <small>
          ${LABEL[c]} · ${state.bank[c]}
        </small>

      </div>
    `).join("");

  players.innerHTML=
    state.players.map(x=>`
      <div class="player ${
        x.id===p.id
          ? "current"
          : ""
      }">

        <div class="player-name">
          ${x.name}
        </div>

        <div class="score">
          ${x.points}
          <span style="
            font-size:12px;
            color:var(--muted)
          ">
            pont
          </span>
        </div>

        <div class="mini-tokens">
          ${
            ALL.map(c=>`
              <span class="mini">
                ${pip(c,x.tokens[c])}
              </span>
            `).join("")
          }
        </div>

        <div class="mini-bonus">
          ${
            COLORS.map(c=>`
              <span class="mini">
                ${pip(c,bonusCount(x,c))}
              </span>
            `).join("")
          }
        </div>

        <div class="reserved">
          Tartalék: ${x.reserved.length}/3 ·
          Kártyák: ${x.cards.length} ·
          Nemesek: ${x.nobles.length}
        </div>

      </div>
    `).join("");

  logEl.innerHTML=
    state.log
      .map(x=>`
        <div class="log-item">
          ${x}
        </div>
      `)
      .join("");

  if(state.nobleChoice) return;

  actionArea.innerHTML="";

  document
    .querySelectorAll(".action-grid button")
    .forEach(b=>
      b.classList.toggle(
        "active",
        b.dataset.action===selectedAction
      )
    );

  if(selectedAction==="take3")
    renderTake3();

  if(selectedAction==="take2")
    renderTake2();

  if(selectedAction==="reserve")
    renderReserve();

  if(selectedAction==="buy")
    renderBuy();
}

function renderTake3(){
  actionArea.innerHTML=`
    <div class="selected-count">
      Válassz 3 különböző színt.
    </div>

    <div class="choice-grid" id="take3grid"></div>

    <button
      class="primary confirm"
      id="take3confirm"
    >
      Zsetonok elvétele
    </button>
  `;

  const g=
    document.getElementById("take3grid");

  COLORS.forEach(c=>{
    const b=document.createElement("button");

    b.className="choice";

    b.innerHTML=`
      ${pip(c)}
      ${LABEL[c]} (${state.bank[c]})
    `;

    b.disabled=
      state.bank[c]<1;

    b.onclick=()=>{
      if(selectedColors.includes(c)){
        selectedColors=
          selectedColors.filter(
            x=>x!==c
          );
      }else if(selectedColors.length<3){
        selectedColors.push(c);
      }

      renderTake3();
    };

    if(selectedColors.includes(c)){
      b.style.outline=
        "2px solid var(--gold)";
    }

    g.appendChild(b);
  });

  document.getElementById(
    "take3confirm"
  ).onclick=()=>{
    take3(selectedColors);
  };
}

function renderTake2(){
  actionArea.innerHTML=`
    <div class="selected-count">
      Válassz egy színt.
      Legalább 4 zsetonnak kell lennie
      a bankban.
    </div>

    <div class="choice-grid" id="take2grid"></div>
  `;

  const g=
    document.getElementById("take2grid");

  COLORS.forEach(c=>{
    const b=document.createElement("button");

    b.className="choice";

    b.innerHTML=`
      ${pip(c)}
      ${LABEL[c]} (${state.bank[c]})
    `;

    b.disabled=
      state.bank[c]<4;

    b.onclick=()=>{
      take2(c);
    };

    g.appendChild(b);
  });
}

function renderReserve(){
  const p=state.players[state.turn];

  if(p.reserved.length>=3){
    actionArea.innerHTML=`
      <div class="note">
        Már 3 kártyád van tartalékban.
      </div>
    `;
    return;
  }

  actionArea.innerHTML=`
    <div class="selected-count">
      Válassz egy középső kártyát
      tartalékoláshoz.
      Az arany csak akkor jár,
      ha még van a bankban.
    </div>
  `;

  const wrap=document.createElement("div");

  wrap.className="card-row";

  for(const t of [1,2,3]){
    state.market[t].forEach(c=>{
      const d=document.createElement("div");

      d.innerHTML=cardHtml(c);

      d.firstChild.onclick=()=>{
        reserve(c,t);
      };

      wrap.appendChild(
        d.firstChild
      );
    });
  }

  actionArea.appendChild(wrap);
}

function renderBuy(){
  const p=state.players[state.turn];

  actionArea.innerHTML=`
    <div class="selected-count">
      Vásárolj egy látható vagy
      saját tartalék kártyát.
    </div>
  `;

  const wrap=document.createElement("div");

  wrap.className="card-row";

  for(const t of [1,2,3]){
    state.market[t].forEach((c,idx)=>{
      const d=document.createElement("div");

      d.innerHTML=cardHtml(c);

      const el=d.firstChild;

      el.style.opacity=
        affordability(p,c)
          ? "1"
          : ".42";

      el.onclick=()=>{
        buy(c,"market",t,idx);
      };

      wrap.appendChild(el);
    });
  }

  p.reserved.forEach(c=>{
    const d=document.createElement("div");

    d.innerHTML=cardHtml(c);

    const el=d.firstChild;

    el.style.outline=
      "2px dashed #e6b84d";

    el.onclick=()=>{
      buy(c,"reserved");
    };

    wrap.appendChild(el);
  });

  actionArea.appendChild(wrap);
}

function setup(){
  setupView.classList.remove("hidden");
  gameView.classList.add("hidden");
  renderNames();
}

function renderNames(){
  const n=+playerCount.value;

  playerNames.innerHTML=
    Array.from(
      {length:n},
      (_,i)=>`
        <input
          id="pn${i}"
          placeholder="Játékos ${i+1}"
          value="Játékos ${i+1}"
        >
      `
    ).join("");
}

function toast(t){
  const x=
    document.getElementById("toast");

  x.textContent=t;

  x.classList.add("toast-show");

  setTimeout(
    ()=>x.classList.remove("toast-show"),
    1800
  );
}

const setupView=
  document.getElementById("setupView");

const gameView=
  document.getElementById("gameView");

const playerCount=
  document.getElementById("playerCount");

const playerNames=
  document.getElementById("playerNames");

const turnBanner=
  document.getElementById("turnBanner");

const nobles=
  document.getElementById("nobles");

const market=
  document.getElementById("market");

const bank=
  document.getElementById("bank");

const players=
  document.getElementById("players");

const actionArea=
  document.getElementById("actionArea");

const logEl=
  document.getElementById("log");

playerCount.onchange=
  renderNames;

document.getElementById(
  "startBtn"
).onclick=()=>{
  const names=
    Array.from(
      {length:+playerCount.value},
      (_,i)=>
        document
          .getElementById("pn"+i)
          .value
          .trim() ||
        `Játékos ${i+1}`
    );

  state=
    initialState(names);

  save();
  render();
};

document.getElementById(
  "newBtn"
).onclick=()=>{
  if(confirm("Biztosan új játékot kezdesz?")){
    localStorage.removeItem(
      "splendor-prototype"
    );

    state=null;
    selectedAction=null;
    selectedColors=[];

    setup();
  }
};

document.getElementById(
  "saveBtn"
).onclick=save;

document.getElementById(
  "clearLog"
).onclick=()=>{
  state.log=[];
  render();
};

document
  .querySelectorAll(".action-grid button")
  .forEach(b=>{
    b.onclick=()=>{
      if(state?.winner) return;
      if(state?.nobleChoice) return;

      selectedAction=
        selectedAction===b.dataset.action
          ? null
          : b.dataset.action;

      selectedColors=[];

      render();
    };
  });

window.addEventListener(
  "click",
  e=>{
    const btn=
      e.target.closest("[data-bank]");

    if(
      btn &&
      selectedAction==="take2"
    ){
      renderTake2();
    }
  }
);

if(load()){
  render();
}else{
  setup();
}

if("serviceWorker" in navigator){
  navigator.serviceWorker
    .register("sw.js")
    .catch(()=>{});
}

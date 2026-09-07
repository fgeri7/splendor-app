const COLORS=["black","white","red","blue","green"];
const ALL=["black","white","red","blue","green","gold"];
const LABEL={black:"Ónix",white:"Gyémánt",red:"Rubin",blue:"Zafír",green:"Smaragd",gold:"Arany"};
const ICON={black:"●",white:"●",red:"●",blue:"●",green:"●",gold:"★"};
let state=null, selectedAction=null, selectedColors=[];
let pendingReserveFeedback=null;
let pendingCardPurchaseFeedback=null;

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

  animateNobleGainFeedback(p.id,n.points);
}

function animateNobleGainFeedback(playerId,points){
  requestAnimationFrame(()=>{
    const panel=document.querySelector(`[data-player-id="${playerId}"]`);
    if(!panel) return;

    panel.classList.remove("noble-gain-feedback");
    void panel.offsetWidth;
    panel.classList.add("noble-gain-feedback");

    const score=panel.querySelector(".score");
    if(score){
      score.classList.remove("noble-points-pop");
      void score.offsetWidth;
      score.classList.add("noble-points-pop");
      setTimeout(()=>score.classList.remove("noble-points-pop"),650);
    }

    const nobleCount=panel.querySelector(".noble-stat");
    if(nobleCount){
      nobleCount.classList.remove("noble-count-pop");
      void nobleCount.offsetWidth;
      nobleCount.classList.add("noble-count-pop");
      setTimeout(()=>nobleCount.classList.remove("noble-count-pop"),650);
    }

    const nobles=panel.querySelectorAll(".mini-noble");
    const last=nobles[nobles.length-1];
    if(last){
      last.classList.remove("noble-card-pop");
      void last.offsetWidth;
      last.classList.add("noble-card-pop");
      setTimeout(()=>last.classList.remove("noble-card-pop"),700);
    }

    setTimeout(()=>panel.classList.remove("noble-gain-feedback"),700);
  });
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
  const previousTurn=state.turn;
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
  animateTurnChange(previousTurn, state.turn);
  save();
}


function animateTurnChange(previousTurn, nextTurn){
  if(previousTurn===nextTurn) return;

  const playersEls=document.querySelectorAll('#players .player');
  const previousPlayer=playersEls[previousTurn];
  const nextPlayer=playersEls[nextTurn];
  const banner=document.getElementById('turnBanner');

  if(previousPlayer){
    previousPlayer.classList.remove('turn-ending-feedback');
    void previousPlayer.offsetWidth;
    previousPlayer.classList.add('turn-ending-feedback');
  }

  if(nextPlayer){
    nextPlayer.classList.remove('turn-start-feedback');
    void nextPlayer.offsetWidth;
    nextPlayer.classList.add('turn-start-feedback');
  }

  if(banner){
    banner.classList.remove('turn-change-feedback');
    void banner.offsetWidth;
    banner.classList.add('turn-change-feedback');
  }

  window.setTimeout(()=>{
    previousPlayer?.classList.remove('turn-ending-feedback');
    nextPlayer?.classList.remove('turn-start-feedback');
    banner?.classList.remove('turn-change-feedback');
  },700);
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

function animateTokenTransfer(playerId, colors){
  if(!Array.isArray(colors) || !colors.length) return;

  // The bank and action controls are separated by scrolling, so do not
  // attempt a long screen-to-screen flight. Give feedback where the user
  // is interacting, then confirm the result in the player's panel.
  colors.forEach((color,i)=>{
    const choice = document.querySelector(
      `#actionArea .choice[data-color="${color}"]`
    );
    if(choice){
      choice.classList.remove("token-choice-picked");
      void choice.offsetWidth;
      choice.classList.add("token-choice-picked");
      choice.style.animationDelay=`${i*55}ms`;
      choice.addEventListener(
        "animationend",
        ()=>{
          choice.classList.remove("token-choice-picked");
          choice.style.animationDelay="";
        },
        {once:true}
      );
    }
  });

  // render()/advance() run synchronously, so the updated player panel is
  // available on the next frame.
  requestAnimationFrame(()=>{
    const panel=document.querySelector(
      `.player .mini-token[data-player-id="${playerId}"]`
    )?.closest(".player");

    if(!panel) return;

    panel.classList.remove("token-gain-feedback");
    void panel.offsetWidth;
    panel.classList.add("token-gain-feedback");

    const changed=new Set(colors);
    panel.querySelectorAll(".mini-token").forEach(token=>{
      if(changed.has(token.dataset.color)){
        token.classList.remove("token-gain-pop");
        void token.offsetWidth;
        token.classList.add("token-gain-pop");
        token.addEventListener(
          "animationend",
          ()=>token.classList.remove("token-gain-pop"),
          {once:true}
        );
      }
    });

    panel.addEventListener(
      "animationend",
      ()=>panel.classList.remove("token-gain-feedback"),
      {once:true}
    );
  });
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
  animateTokenTransfer(p.id, colors);

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
  animateTokenTransfer(p.id, [c]);

  endTurn();

  if(!state.nobleChoice){
    advance();
  }
}

function animateReserveFeedback(playerId, bonus, gotGold){
  requestAnimationFrame(()=>{
    const panel=document.querySelector(
      `.player .mini-token[data-player-id="${playerId}"]`
    )?.closest(".player");

    if(!panel) return;

    const reserved=panel.querySelector(".reserved-summary");
    const owned=panel.querySelector(".owned-card-label");
    const bonusCard=panel.querySelector(`.mini-card-bonus[data-card-bonus="${bonus}"]`);
    const gold=gotGold
      ? panel.querySelector('.mini-token[data-color="gold"]')
      : null;

    [reserved,owned,bonusCard,gold].filter(Boolean).forEach(el=>{
      el.classList.remove("reserve-gain-pop");
      void el.offsetWidth;
      el.classList.add("reserve-gain-pop");
      el.addEventListener(
        "animationend",
        ()=>el.classList.remove("reserve-gain-pop"),
        {once:true}
      );
    });

    panel.classList.remove("reserve-gain-feedback");
    void panel.offsetWidth;
    panel.classList.add("reserve-gain-feedback");
    panel.addEventListener(
      "animationend",
      ()=>panel.classList.remove("reserve-gain-feedback"),
      {once:true}
    );
  });
}

function reserve(card,t,hidden=false){
  const p=state.players[state.turn];

  if(p.reserved.length>=3){
    return toast(
      "Legfeljebb 3 tartalék kártyád lehet."
    );
  }

  if(hidden){
    if(!state.decks[t-1].length){
      return toast(
        "Ebben a pakliban már nincs kártya."
      );
    }

    card=state.decks[t-1].pop();

    p.reserved.push({
      ...card,
      hidden:true
    });
  }else{
    const idx=state.market[t].findIndex(
      x=>x.id===card.id
    );

    if(idx<0) return;

    p.reserved.push({
      ...card,
      hidden:false
    });

    state.market[t].splice(idx,1);
    refill(t);
  }

  const gotGold=state.bank.gold>0;
  if(gotGold){
    state.bank.gold--;
    p.tokens.gold++;
  }

  pendingReserveFeedback={
    playerId:p.id,
    bonus:card.bonus,
    gotGold
  };

  log(
    `<b>${p.name}</b> ${
      hidden
        ? `vakon tartalékolt egy ${t}. szintű kártyát`
        : `tartalékolt egy ${t}. szintű kártyát`
    }.`
  );

  selectedAction=null;

  endTurn();

  if(!state.nobleChoice){
    advance();
  }

  if(pendingReserveFeedback){
    const feedback=pendingReserveFeedback;
    pendingReserveFeedback=null;
    animateReserveFeedback(
      feedback.playerId,
      feedback.bonus,
      feedback.gotGold
    );
  }
}

function animateCardPurchaseFeedback(playerId, bonus, points){
  requestAnimationFrame(()=>{
    const panel=document.querySelector(
      `.player .mini-token[data-player-id="${playerId}"]`
    )?.closest(".player");

    if(!panel) return;

    const score=panel.querySelector(".score");
    const owned=panel.querySelector(".owned-card-label");
    const bonusCard=panel.querySelector(`.mini-card-bonus[data-card-bonus="${bonus}"]`);

    [score, owned, bonusCard].filter(Boolean).forEach(el=>{
      el.classList.remove("card-purchase-pop");
      void el.offsetWidth;
      el.classList.add("card-purchase-pop");
      el.addEventListener(
        "animationend",
        ()=>el.classList.remove("card-purchase-pop"),
        {once:true}
      );
    });

    panel.classList.remove("card-purchase-feedback");
    void panel.offsetWidth;
    panel.classList.add("card-purchase-feedback");
    panel.addEventListener(
      "animationend",
      ()=>panel.classList.remove("card-purchase-feedback"),
      {once:true}
    );
  });
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

  // Remember the purchase so the feedback can be applied after render().
  pendingCardPurchaseFeedback={
    playerId:p.id,
    bonus:card.bonus,
    points:card.points
  };

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

  if(pendingCardPurchaseFeedback){
    const feedback=pendingCardPurchaseFeedback;
    pendingCardPurchaseFeedback=null;
    animateCardPurchaseFeedback(
      feedback.playerId,
      feedback.bonus,
      feedback.points
    );
  }

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
    b.className="choice token-choice";
    b.dataset.color=c;

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

function renderGameOverOverlay(){
  const existing=document.getElementById("gameOverOverlay");
  if(existing) existing.remove();

  if(!state?.winner) return;

  const winner=state.players.find(p=>p.id===state.winner);
  if(!winner) return;

  const results=[...state.players].sort(
    (a,b)=>b.points-a.points || a.cards.length-b.cards.length
  );

  const overlay=document.createElement("div");
  overlay.id="gameOverOverlay";
  overlay.className="game-over-overlay";
  overlay.innerHTML=`
    <div class="game-over-card" role="dialog" aria-modal="true" aria-labelledby="gameOverTitle">
      <div class="game-over-crown" aria-hidden="true">♛</div>
      <div class="game-over-kicker">A JÁTÉK VÉGET ÉRT</div>
      <h2 id="gameOverTitle">🏆 ${winner.name} nyert!</h2>
      <div class="game-over-winner-score">
        <strong>${winner.points}</strong>
        <span>pont</span>
      </div>
      <div class="game-over-results">
        ${results.map((player,index)=>`
          <div class="game-over-result ${player.id===winner.id ? "winner" : ""}">
            <span class="result-place">${index===0 ? "🏆" : index===1 ? "🥈" : index===2 ? "🥉" : `${index+1}.`}</span>
            <span class="result-name">${player.name}</span>
            <strong>${player.points} pont</strong>
          </div>
        `).join("")}
      </div>
      <div class="game-over-actions">
        <button class="ghost game-over-menu" type="button" data-game-over-menu>Főmenü</button>
        <button class="primary game-over-new" type="button" data-game-over-new>Új játék</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector("[data-game-over-new]").onclick=()=>{
    showConfirm(
      "Új játék",
      "Biztosan új játékot kezdesz? A jelenlegi játék mentése törlődik.",
      resetToMenu
    );
  };
  overlay.querySelector("[data-game-over-menu]").onclick=resetToMenu;
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
          aria-label="${LABEL[c]} zseton, ${state.bank[c]} darab a bankban"
        >
          <span class="bank-token-mark ${c}" aria-hidden="true">${ICON[c]}</span>
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

        <div class="token-summary">
          <span class="summary-label">Zsetonok</span>
          <strong>${totalTokens(x)}</strong>
        </div>

        <div class="mini-tokens">
          ${
            ALL.map(c=>`
              <span class="mini-token" data-player-id="${x.id}" data-color="${c}">
                <i class="dot ${c}"></i><b>${x.tokens[c]}</b>
              </span>
            `).join("")
          }
        </div>

        <div class="bonus-row">
          <span class="summary-label">Kártyák</span>
          ${
            COLORS.map(c=>`
              <span class="mini-card-bonus mini-card-${c}" data-card-bonus="${c}" title="${LABEL[c]} kártyák: ${bonusCount(x,c)}">
                <i></i><b>${bonusCount(x,c)}</b>
              </span>
            `).join("")
          }
        </div>

        <div class="ownership-row">
          <div class="owned-stat">
            <span class="card-count-icon" aria-hidden="true"></span>
            <span class="owned-card-label"><b>${x.cards.length}</b> kártya</span>
          </div>
          <div class="owned-stat noble-stat">
            <span class="noble-count-icon" aria-hidden="true">♛</span>
            <span><b>${x.nobles.length}</b> nemes</span>
          </div>
        </div>

        <button class="reserved-summary ${x.id===p.id ? "can-open" : ""}" data-show-reserved="${x.id}" ${x.id===p.id ? "" : "disabled"}>
          Tartalék kártyák: ${x.reserved.length}/3${x.id===p.id ? " · Megnézem" : ""}
        </button>

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

  renderGameOverOverlay();

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

    b.className="choice token-choice";
    b.dataset.color=c;

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

function previewCardSelection(el, onConfirm){
  if(!el || el.classList.contains("selection-preview")) return;

  const row=el.closest(".card-row");
  if(!row) return onConfirm();

  row.classList.add("has-selection-preview");
  row.querySelectorAll(".card").forEach(card=>{
    if(card!==el) card.classList.add("selection-dim");
  });

  el.classList.add("selection-preview");

  window.setTimeout(()=>{
    row.classList.remove("has-selection-preview");
    row.querySelectorAll(".card").forEach(card=>{
      card.classList.remove("selection-dim","selection-preview");
    });
    onConfirm();
  },220);
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
      Válassz egy látható kártyát, vagy húzz vakon valamelyik pakli tetejéről.
    </div>

    <div class="reserve-blind">
      <div class="reserve-blind-title">🂠 Vak tartalékolás</div>
      <div class="reserve-blind-buttons">
        ${[3,2,1].map(t=>`
          <button class="choice" data-blind-reserve="${t}"
            ${state.decks[t-1].length===0 ? "disabled" : ""}>
            🂠 ${t}. szint
            <small>${state.decks[t-1].length} lap maradt</small>
          </button>
        `).join("")}
      </div>
    </div>

    <div class="selected-count">Látható kártyák</div>
  `;

  const wrap=document.createElement("div");
  wrap.className="card-row";

  for(const t of [3,2,1]){
    state.market[t].forEach(c=>{
      const d=document.createElement("div");
      d.innerHTML=cardHtml(c);
      const el=d.firstElementChild;
      el.onclick=()=>previewCardSelection(el,()=>reserve(c,t,false));
      wrap.appendChild(el);
    });
  }

  actionArea.appendChild(wrap);

  document.querySelectorAll("[data-blind-reserve]").forEach(btn=>{
    btn.onclick=()=>reserve(null,+btn.dataset.blindReserve,true);
  });
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

      const el=d.firstElementChild;

      el.style.opacity=
        affordability(p,c)
          ? "1"
          : ".42";

      el.onclick=()=>{
        if(!affordability(p,c)){
          buy(c,"market",t,idx);
          return;
        }
        previewCardSelection(el,()=>buy(c,"market",t,idx));
      };

      wrap.appendChild(el);
    });
  }

  p.reserved.forEach(c=>{
    const d=document.createElement("div");

    d.innerHTML=cardHtml(c);

    const el=d.firstElementChild;

    el.style.outline=
      "2px dashed #e6b84d";

    el.onclick=()=>{
      if(!affordability(p,c)){
        buy(c,"reserved");
        return;
      }
      previewCardSelection(el,()=>buy(c,"reserved"));
    };

    wrap.appendChild(el);
  });

  actionArea.appendChild(wrap);
}

function showReserved(playerId){
  const me=state.players.find(x=>x.id===playerId);
  const current=state.players[state.turn];
  if(!me || me.id!==current.id) return;

  const overlay=document.createElement("div");
  overlay.className="app-modal-backdrop";
  overlay.innerHTML=`
    <div class="app-modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <div>
          <div class="modal-eyebrow">${me.reserved.length}/3 TARTALÉK</div>
          <h3>${me.name} tartalék kártyái</h3>
        </div>
        <button class="modal-close" type="button" aria-label="Bezárás">×</button>
      </div>
      <div class="reserved-modal-grid">
        ${me.reserved.length ? me.reserved.map(c=>cardHtml(c,"reserved-card")).join("") : '<div class="modal-empty">Nincs tartalék kártyád.</div>'}
      </div>
      <button class="ghost wide modal-close-action" type="button">Bezárás</button>
    </div>
  `;

  document.body.appendChild(overlay);
  const close=()=>overlay.remove();
  overlay.addEventListener("click",e=>{ if(e.target===overlay) close(); });
  overlay.querySelectorAll(".modal-close,.modal-close-action").forEach(b=>b.addEventListener("click",close));
}

function showConfirm(title,message,onConfirm){
  const overlay=document.createElement("div");
  overlay.className="app-modal-backdrop";
  overlay.innerHTML=`
    <div class="app-modal confirm-modal" role="dialog" aria-modal="true">
      <div class="modal-head"><h3>${title}</h3><button class="modal-close" type="button" aria-label="Bezárás">×</button></div>
      <p>${message}</p>
      <div class="modal-actions">
        <button class="ghost" data-cancel type="button">Mégse</button>
        <button class="danger" data-confirm type="button">Új játék</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close=()=>overlay.remove();
  overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
  overlay.querySelector("[data-cancel]").onclick=close;
  overlay.querySelector(".modal-close").onclick=close;
  overlay.querySelector("[data-confirm]").onclick=()=>{close();onConfirm()};
}

function preventTextSelectionAndContextMenu(){
  document.addEventListener("selectstart", e => {
    const t=e.target;
    if (t && (t.matches?.("input,textarea,select") || t.isContentEditable)) return;
    e.preventDefault();
  });
  document.addEventListener("contextmenu", e => {
    const t=e.target;
    if (t && (t.matches?.("input,textarea,select") || t.isContentEditable)) return;
    e.preventDefault();
  });
  document.addEventListener("dragstart", e => e.preventDefault());
}

function preventPullToRefresh(){
  // Do not intercept touchmove: that can accidentally disable the page scroll.
  // Pull-to-refresh is disabled by CSS overscroll-behavior instead, while
  // normal vertical scrolling remains native.
  document.documentElement.style.overscrollBehaviorY="none";
  document.body.style.overscrollBehaviorY="none";
}

function resetToMenu(){
  document.getElementById("gameOverOverlay")?.remove();
  document.querySelectorAll(".app-modal-backdrop").forEach(x=>x.remove());
  localStorage.removeItem("splendor-prototype");
  state=null;
  selectedAction=null;
  selectedColors=[];
  pendingReserveFeedback=null;
  pendingCardPurchaseFeedback=null;
  setup();
}

function setup(){
  preventTextSelectionAndContextMenu();
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
  showConfirm(
    "Új játék",
    "Biztosan új játékot kezdesz? A jelenlegi játék mentése törlődik.",
    resetToMenu
  );
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

/* v3.24 – end-turn / pass button feedback. Visual-only; no gameplay changes. */
window.addEventListener("click",e=>{
  const btn=e.target.closest("button");
  if(!btn) return;
  const label=(btn.textContent||"").trim().toLowerCase();
  if(!/kör\s*(vége|befejez)/i.test(label)) return;

  btn.classList.remove("end-turn-feedback");
  void btn.offsetWidth;
  btn.classList.add("end-turn-feedback");
  window.setTimeout(()=>btn.classList.remove("end-turn-feedback"),650);
},{capture:true});

window.addEventListener("click",e=>{
  const reservedBtn=e.target.closest("[data-show-reserved]");
  if(reservedBtn && !reservedBtn.disabled){
    showReserved(reservedBtn.dataset.showReserved);
    return;
  }
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

preventPullToRefresh();

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

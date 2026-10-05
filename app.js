(function(){
'use strict';
const DATA = window.DATA;
const PEOPLE = DATA.people;
const $ = (s,el=document)=>el.querySelector(s);
const esc = s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STANCE_COLOR = {'-2':'#e4572e','-1':'#f59e0b','0':'#94a3b8','1':'#38bdf8','2':'#3b82f6'};
const STANCE_LABEL = {'-2':'軟體開發將被取代','-1':'偏悲觀（角色大幅縮水）','0':'中立／視情況','1':'偏樂觀（角色轉變但仍需要）','2':'軟體開發不會死、更重要'};
const sc = v=>STANCE_COLOR[String(Math.round(v))]||'#94a3b8';
// 點的顏色 = 他說話當下承認 AI 已攻下多少（退守程度），不是他嘴上說軟體開發會不會死
const CONC=[{l:'0 級：全手動——AI 沒用，人全包',c:'#64748b'},{l:'1 級：AI 當助手／補全，人逐行主導',c:'#38bdf8'},{l:'2 級：AI 起草，人逐項確認',c:'#22c55e'},{l:'3 級：AI 主導寫作，人退守審查／驗收',c:'#f59e0b'},{l:'4 級：全自動——AI 自主，人只設界線',c:'#e4572e'}];
const SPEC=d3.scaleLinear().domain([0,1,2,3,4]).range(CONC.map(x=>x.c)).clamp(true);
const ec=e=>e&&e.concession&&typeof e.concession.level==='number'?SPEC(e.concession.level):'#94a3b8';
const clv=e=>e&&e.concession&&typeof e.concession.level==='number'?e.concession.level:null;

// ---------- data prep ----------
function parseDate(s){const m=String(s).match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);return m?new Date(+m[1],(m[2]||1)-1,+(m[3]||1)):null}
function parseHorizon(h){
  if(!h) return null;
  const s=String(h);const ys=[...s.matchAll(/(20\d\d|21\d\d)(?:-(\d{2}))?/g)];
  if(!ys.length) return null;
  const ds=ys.map(m=>m[2]?new Date(+m[1],+m[2]-1,1):new Date(+m[1],6,1));
  return new Date(d3.mean(ds.map(d=>+d)));
}
const ALL=[];
PEOPLE.forEach((p,pi)=>p.entries.forEach(e=>{
  ALL.push(Object.assign({},e,{person:p.name,slug:p.slug,group:p.group,_d:parseDate(e.date),_h:parseHorizon(e.horizon),_pi:pi}));
}));
const GROUP_ORDER=['經典軟體工程大老','AI 實驗室與研究員','科技公司領袖','創辦人與新創圈','AI 預測團隊與網站','使用者自己的帳號'];
const groups=[...new Set(PEOPLE.map(p=>p.group))].sort((a,b)=>{const ia=GROUP_ORDER.indexOf(a),ib=GROUP_ORDER.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib)});
const sortedPeople=[].concat(...groups.map(g=>PEOPLE.filter(p=>p.group===g)));
const PCOLOR=(()=>{const pal=[...d3.schemeTableau10,...d3.schemeSet3];const m={};sortedPeople.forEach((p,i)=>m[p.slug]=pal[i%pal.length]);return m})();
const fmtD=d=>d?d.toISOString().slice(0,7):'';

// ---------- tooltip / drawer ----------
const tip=$('#tip');
function showTip(html,ev){tip.innerHTML=html;tip.hidden=false;const w=tip.offsetWidth,h=tip.offsetHeight;let x=ev.clientX+14,y=ev.clientY+14;if(x+w>innerWidth-8)x=ev.clientX-w-14;if(y+h>innerHeight-8)y=ev.clientY-h-14;tip.style.left=x+'px';tip.style.top=y+'px'}
function hideTip(){tip.hidden=true}
function entryTip(e){return `<b>${esc(e.person)}</b> · ${esc(e.date)}<br>${esc(e.summary_zh||e.quote_zh).slice(0,110)}…<br><span style="color:${ec(e)}">● ${clv(e)==null?'（尚未評估退守程度）':esc(CONC[clv(e)].l)}</span>${e.verified?'':' · 未完全查證'}`}
function concHtml(e){
  if(clv(e)==null)return '';const c=e.concession;
  return `<div class="conc" style="border-left:4px solid ${ec(e)}"><div><b style="color:${ec(e)}">退守程度 ${c.level} 級</b>${c.kind==='predicted'?' <span class="tag">預測情境</span>':''}<span class="tag ${c.confidence==='high'?'ok':c.confidence==='low'?'warn':''}">信心：${{high:'高',medium:'中',low:'低'}[c.confidence]||''}</span></div>
  <div>已攻陷：${esc(c.conceded_zh||'')}</div><div>仍堅守：${esc(c.holdout_zh||'')}</div><div class="cb">${esc(c.basis_zh||'')}</div></div>`}
function homeLink(pr){const u=pr&&pr.home;if(!u)return '';let h=u;try{h=new URL(u).hostname.replace(/^www\./,'')}catch(e){}return `<a class="homelink" href="${esc(u)}" target="_blank" rel="noopener">源頭入口 ↗ ${esc(h)}</a>`}
function entryCard(e){
  const shot=e.og_image?`<a href="${esc(e.source_url)}" target="_blank" rel="noopener"><img src="${esc(e.og_image)}" alt="來源預覽圖" loading="lazy"></a><div class="meta">來源預覽圖（og:image），版權屬原網站</div>`:'';
  return `<div class="entry"><div class="meta"><span class="dot" style="background:${ec(e)}"></span>${esc(e.date)} ·
    <span class="tag">${e.kind==='prediction'?'預言':'現況描述'}</span>${e.horizon?`<span class="tag">目標 ${esc(e.horizon)}</span>`:''}
    <span class="tag ${e.verified?'ok':'warn'}">${e.verified?'已查證':'未完全查證'}</span>${e.topic?`<span class="tag">${esc(e.topic)}</span>`:''}</div>
    ${concHtml(e)}<blockquote lang="en">${esc(e.quote_original)}</blockquote>${postImgs(e)}
    <div class="zh" style="color:var(--mute)">譯：${esc(e.quote_zh)}</div>
    <div class="meta" style="margin-top:.5rem">來源：${e.source_url?`<a href="${esc(e.source_url)}" target="_blank" rel="noopener">${esc(e.source_title||e.source_url)}</a>`:esc(e.source_title||'')}
    ${e.archive_url?` · <a href="${esc(e.archive_url)}" target="_blank" rel="noopener">存檔</a>`:''}
    ${e.note?`<br>備註：${esc(e.note)}`:''}</div>${shot}</div>`;
}
const DH=[];
function openDrawer(html,fresh){
  const d=$('#drawer'),body=$('#drawer-body');
  if(fresh)DH.length=0;else if(d.classList.contains('open')&&body.innerHTML)DH.push(body.innerHTML);
  body.innerHTML=html;d.classList.add('open');d.setAttribute('aria-hidden','false');$('#drawer-back').hidden=!DH.length;d.scrollTop=0}
function closeDrawer(){DH.length=0;$('#drawer').classList.remove('open');$('#drawer').setAttribute('aria-hidden','true')}
function showEntry(e){
  openDrawer(`<h2>${esc(e.person)}</h2><button id="see-all">看此人全部 ${PEOPLE[e._pi].entries.length} 則</button>${entryCard(e)}`);
  $('#see-all').onclick=()=>showPerson(e._pi);
}
function showPerson(pi){
  const p=PEOPLE[pi];
  openDrawer(`<h2>${esc(p.name)}</h2><p style="color:var(--mute)">${esc(p.profile_zh||'')}</p>${p.entries.map(x=>entryCard(Object.assign({},x))).join('')}`);
}
$('#drawer-close').onclick=closeDrawer;
$('#drawer-back').onclick=()=>{if(DH.length){$('#drawer-body').innerHTML=DH.pop();$('#drawer-back').hidden=!DH.length}};
$('#drawer-body').addEventListener('click',ev=>{
  const a=ev.target.closest('a.ev');if(!a)return;ev.preventDefault();
  if(a.dataset.e){const e=ALL.find(x=>x.id===a.dataset.e);if(e)showEntry(e)}
  else if(a.dataset.m){const m=RELEASES.find(x=>x.id===a.dataset.m);if(m)openDrawer(`<h2>${esc(m.name)}</h2>`+modelCard(m))}
});

// ---------- chart helpers ----------
function mkChart(host,h){
  const w=Math.max(320,host.clientWidth||900);
  const svg=d3.select(host).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('height',h).style('touch-action','none');
  return {svg,w,h};
}
function zoomButtons(bar,zoomTarget,zoom,resetFn){
  const b=(t,f)=>{const el=document.createElement('button');el.textContent=t;el.onclick=f;bar.appendChild(el);return el};
  b('＋放大',()=>zoomTarget.transition().duration(250).call(zoom.scaleBy,1.6));
  b('－縮小',()=>zoomTarget.transition().duration(250).call(zoom.scaleBy,1/1.6));
  b('重設',resetFn);
}
function stanceLegend(){
  return '<div class="spectrum"><div class="sp-title">點的顏色＝他說話當下承認 AI 已攻下多少（從全手動到全自動的光譜）</div>'+
  '<div class="sp-bar" style="background:linear-gradient(90deg,'+CONC.map(x=>x.c).join(',')+')"></div>'+
  '<div class="sp-ticks">'+CONC.map(x=>`<span>${esc(x.l)}</span>`).join('')+'</div>'+
  '<div class="sp-note"><i class="dot" style="background:#94a3b8"></i>灰＝未評估　<i class="dot ring"></i>空心＝未完全查證</div></div>';
}
function dotAttrs(sel,colorOf){
  const col=colorOf||(d=>ec(d));
  return sel.attr('r',6).attr('fill',d=>d.verified?col(d):'var(--bg)').attr('stroke',d=>col(d)).attr('stroke-width',2).attr('class','pt')
   .on('mousemove',(ev,d)=>showTip(entryTip(d),ev)).on('mouseleave',hideTip).on('click',(ev,d)=>{hideTip();showEntry(d)});
}


// ---------- model / tool release layer ----------
const norm=(arr,def)=>(arr||[]).map(m=>Object.assign({kind:def},m,{_d:parseDate(m.date)})).filter(m=>m._d);
const MODELS=norm(DATA.models,'model').map(m=>Object.assign(m,{kind:'model'}));
const TOOLS=norm(DATA.tools,'tool');
const RELEASES=MODELS.concat(TOOLS);
const VCOLOR={OpenAI:'#10a37f',Anthropic:'#d97757',Google:'#4285f4','Google DeepMind':'#4285f4',Meta:'#3b82f6',DeepSeek:'#6366f1',xAI:'#cbd5e1',GitHub:'#e2e8f0',Microsoft:'#38bdf8',Cursor:'#f5b942',Anysphere:'#f5b942',Cognition:'#f472b6',Codeium:'#34d399',Windsurf:'#34d399'};
const vc=v=>VCOLOR[v]||'#b58cff';
const KIND_LABEL={model:'AI 模型',tool:'軟體／產品',architecture:'架構／模式',protocol:'協定'};
const KIND_SYM={model:d3.symbolDiamond,tool:d3.symbolSquare,architecture:d3.symbolTriangle,protocol:d3.symbolCross};
const MS={showM:true,showT:true,min:3};
const LAYERS=new Set();
function modelCard(m){return `<div class="entry"><div class="meta"><i class="dot" style="background:${vc(m.vendor)}"></i>${esc(m.date)} · <span class="tag">${esc(m.vendor)}</span><span class="tag">${esc(KIND_LABEL[m.kind]||m.kind)}</span><span class="tag ${m.verified?'ok':'warn'}">${m.verified?'已查證':'未完全查證'}</span></div>
  <h3 style="margin:.2rem 0">${esc(m.name)}</h3><div class="zh">${esc(m.coding_note_zh||'')}</div>
  <div class="meta" style="margin-top:.5rem">來源：<a href="${esc(m.source_url)}" target="_blank" rel="noopener">${esc(m.source_title||m.source_url)}</a>${m.note?`<br>備註：${esc(m.note)}`:''}</div>${m.og_image?`<a href="${esc(m.source_url)}" target="_blank" rel="noopener"><img src="${esc(m.og_image)}" alt="來源預覽圖" loading="lazy"></a>`:''}</div>`}
function modelTip(m){return `<b style="color:${vc(m.vendor)}">${esc(m.vendor)} · ${esc(m.name)}</b> <span style="color:var(--mute)">${esc(KIND_LABEL[m.kind]||'')}</span><br>${esc(m.date)}<br>${esc((m.coding_note_zh||'').slice(0,90))}`}
function modelLayer(svg,getX,g){
  const gEl=svg.append('g').attr('clip-path',`url(#${g.clip})`);
  const layer={node:svg.node(),update(){
    const xs=getX();
    const list=RELEASES.filter(m=>m.importance>=MS.min&&(m.kind==='model'?MS.showM:MS.showT));
    gEl.selectAll('line').data(list,d=>d.id).join('line').attr('x1',d=>xs(d._d)).attr('x2',d=>xs(d._d)).attr('y1',g.top).attr('y2',g.bottom)
      .attr('stroke',d=>vc(d.vendor)).attr('stroke-width',d=>d.importance>=3?1.5:1).attr('opacity',d=>d.importance>=3?.45:.2).attr('stroke-dasharray',d=>d.kind==='model'?null:'3 3').style('pointer-events','none');
    if(g.rowY==null){gEl.selectAll('path,text').remove();return}
    const rowOf=d=>d.kind==='model'?g.rowY:g.rowY+16;
    gEl.selectAll('path').data(list,d=>d.id).join('path').attr('d',d=>d3.symbol(KIND_SYM[d.kind]||d3.symbolCircle,d.kind==='model'?90:60)())
      .attr('transform',d=>`translate(${xs(d._d)},${rowOf(d)})`).attr('fill',d=>vc(d.vendor)).attr('stroke','#0f1115').attr('class','pt')
      .on('mousemove',(ev,d)=>showTip(modelTip(d),ev)).on('mouseleave',hideTip).on('click',(ev,d)=>{hideTip();openDrawer(`<h2>${esc(d.name)}</h2>`+modelCard(d))});
    const lab=[];['model','tool'].forEach(k=>{let last=-1e9;list.filter(d=>d.importance>=3&&(k==='model'?d.kind==='model':d.kind!=='model')).forEach(d=>{const x=xs(d._d);if(x-last>105){last=x;lab.push(d)}})});
    gEl.selectAll('text').data(lab,d=>d.id).join('text').attr('x',d=>xs(d._d)+7).attr('y',d=>rowOf(d)+4).attr('font-size',10).attr('fill',d=>vc(d.vendor)).text(d=>d.name.slice(0,18));
  }};
  LAYERS.add(layer);return layer;
}
function modelControls(tb){
  if(!RELEASES.length)return;
  const mk=()=>{const x=document.createElement('button');tb.appendChild(x);return x};
  const a=MODELS.length?mk():null,t=TOOLS.length?mk():null,c=mk();
  const sync=()=>{
    if(a){a.textContent=(MS.showM?'◆ AI 模型：顯示':'◇ AI 模型：隱藏');a.classList.toggle('on',MS.showM)}
    if(t){t.textContent=(MS.showT?'■▲ 軟體／架構：顯示':'□△ 軟體／架構：隱藏');t.classList.toggle('on',MS.showT)}
    c.textContent=MS.min>=3?'僅重大里程碑（點此顯示全部）':'顯示全部（點此只看重大）';
  };
  const upd=()=>{sync();LAYERS.forEach(l=>l.node.isConnected?l.update():LAYERS.delete(l))};
  if(a)a.onclick=()=>{MS.showM=!MS.showM;upd()};if(t)t.onclick=()=>{MS.showT=!MS.showT;upd()};c.onclick=()=>{MS.min=MS.min>=3?2:3;upd()};
  sync();
}

// ---------- swimlane timeline (present / prediction) ----------
function swimlane(host,toolbar,entries,accessor,opts){
  host.innerHTML='';
  const ppl=sortedPeople.filter(p=>entries.some(e=>e.slug===p.slug));
  const laneH=30,mt=RELEASES.length?(TOOLS.length&&MODELS.length?76:58):34,ml=150,mr=20,mb=8;const ay=RELEASES.length?26:mt-6;
  const h=mt+ppl.length*laneH+mb+ (groups.length*0);
  const {svg,w}=mkChart(host,h);
  const laneY={};let y=mt;ppl.forEach(p=>{laneY[p.slug]=y+laneH/2;y+=laneH});
  const ds=entries.map(accessor).filter(Boolean);
  const [d0,d1]=opts.domain||[d3.min(ds),d3.max(ds)];
  const pad=(d1-d0)*0.04;
  const x0=d3.scaleTime().domain([new Date(+d0-pad),new Date(+d1+pad)]).range([ml,w-mr]);
  let xs=x0;
  svg.append('defs').append('clipPath').attr('id',opts.id+'clip').append('rect').attr('x',ml).attr('y',0).attr('width',w-ml-mr).attr('height',h);
  // lane bands
  ppl.forEach((p,i)=>{svg.append('rect').attr('x',0).attr('y',mt+i*laneH).attr('width',w).attr('height',laneH).attr('fill',i%2?'#ffffff05':'transparent');
    svg.append('text').attr('class','lane-label').attr('x',ml-8).attr('y',laneY[p.slug]+4).attr('text-anchor','end').text(p.name.replace(/\s*\(.*\)/,'').slice(0,16)).style('cursor','pointer').on('click',()=>showPerson(PEOPLE.indexOf(p)))});
  const gAxis=svg.append('g').attr('class','axis').attr('transform',`translate(0,${ay})`);
  const gGrid=svg.append('g').attr('clip-path',`url(#${opts.id}clip)`);
  const gPts=svg.append('g').attr('clip-path',`url(#${opts.id}clip)`);
  const mlayer=RELEASES.length?modelLayer(svg,()=>xs,{clip:opts.id+'clip',top:ay+4,bottom:h,rowY:ay+18}):null;
  const extra=opts.extra?opts.extra(svg,()=>xs,{mt,h,ml,w,mr}):null;
  const linesG=gPts.append('g');const ringsG=gPts.append('g');
  const ptData=entries.filter(e=>accessor(e));
  const pts=dotAttrs(gPts.selectAll('circle.pt0').data(ptData).join('circle').attr('class','pt0').attr('cy',e=>laneY[e.slug]),opts.colorOf);
  const bySlug=d3.group(ptData,e=>e.slug);
  function draw(){
    const ax=d3.axisTop(xs).ticks(Math.max(3,Math.floor((w-ml)/90))).tickSizeOuter(0);
    gAxis.call(ax);
    gGrid.selectAll('line').data(xs.ticks(Math.max(3,Math.floor((w-ml)/90)))).join('line').attr('class','grid-line').attr('x1',d=>xs(d)).attr('x2',d=>xs(d)).attr('y1',mt).attr('y2',h);
    pts.attr('cx',e=>xs(accessor(e)));
    if(opts.lines){linesG.selectAll('path').data([...bySlug.values()].filter(a=>a.length>1)).join('path').attr('fill','none').attr('stroke','#ffffff30').attr('stroke-width',1.5)
      .attr('d',a=>d3.line().x(e=>xs(accessor(e))).y(e=>laneY[e.slug])(a.slice().sort((p,q)=>accessor(p)-accessor(q))))}
    if(opts.rings){ringsG.selectAll('circle').data(opts.rings).join('circle').attr('r',11).attr('fill','none').attr('stroke','#fff').attr('stroke-width',2).attr('stroke-dasharray','3 2')
      .attr('cx',e=>xs(accessor(e))).attr('cy',e=>laneY[e.slug]).style('pointer-events','none')}
    if(extra) extra.update();
    if(mlayer) mlayer.update();
  }
  const zoom=d3.zoom().scaleExtent([1,80]).translateExtent([[ml,0],[w-mr,h]]).extent([[ml,0],[w-mr,h]])
    .on('zoom',ev=>{xs=ev.transform.rescaleX(x0);draw()});
  svg.call(zoom).on('dblclick.zoom',null);
  toolbar.innerHTML='';
  zoomButtons(toolbar,svg,zoom,()=>svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity));
  modelControls(toolbar);
  const yrs=d3.range(d3.min(ds).getFullYear(),d3.max(ds).getFullYear()+1);
  yrs.forEach(yr=>{const el=document.createElement('button');el.textContent=yr;el.onclick=()=>{
    const a=x0(new Date(yr,0,1)),b=x0(new Date(yr+1,0,1));const k=(w-ml-mr)/(b-a);
    svg.transition().duration(400).call(zoom.transform,d3.zoomIdentity.translate(ml-a*k,0).scale(k))};toolbar.appendChild(el)});
  draw();
}

// ---------- slides ----------
const slides=[];
function slide(id,title,html,render){slides.push({id,title,html,render})}

const nPeople=PEOPLE.length,nEntries=ALL.length,nVer=ALL.filter(e=>e.verified).length;
const dmin=d3.min(ALL,e=>e._d),dmax=d3.max(ALL,e=>e._d);

slide('title','封面',`<div class="title-slide"><div class="kicker">TRACKING SURVEY · 2023 → NOW</div>
<h1>軟體開發<br>將死？</h1>
<p class="lead">2023 年起，業界大老、AI 實驗室與預測團隊怎麼描述「現在」，又怎麼預言「未來」？一場追蹤每個人說法如何改變的調查。</p>
<p class="lead" style="color:var(--fg,#fff);font-weight:600;margin-bottom:.2em">製作：卡米哥 × Claude Code</p><p class="lead">資料更新日：${esc(DATA.generated)}　·　按 → 開始</p><p class="mute" style="max-width:760px;margin:1rem 0 0;font-size:.85rem;line-height:1.6"><b>分工與免責聲明：</b><b>卡米哥決定要呈現什麼、怎麼呈現；其他所有部分</b>（搜尋資料、查證、翻譯、分類與評分、撰寫文字、製作網站）<b>都由 Claude Code 負責</b>。資料<b>未經人工審查，不保證完全正確</b>，引文、日期與分數請以原始來源為準。</p></div>`);

slide('howto','怎麼讀這份簡報',`<div class="kicker">HOW TO READ</div><h2>五個色階、兩種發言、一個可信度標記</h2>
<p class="lead">每則發言都有原文引述、繁中翻譯、來源網址。我們替每則發言標上「立場分數」，方便在圖上比較。</p>
<div class="grid cards">
<div class="card"><h3>點的顏色：退守程度</h3><p style="font-size:.9rem;line-height:1.6">從「全手動開發」到「全自動開發」畫一條光譜，依他說話當下<b>承認 AI 已攻下多少</b>，把每則發言放在光譜上（藍＝人全包，紅＝AI 全自動）。不管他嘴上說「軟體開發不會死」，只要他其實承認 AI 已拿下更多，顏色就會往紅走，這樣才看得出退守。</p><div class="sp-bar" style="background:linear-gradient(90deg,${CONC.map(x=>x.c).join(',')})"></div></div>
<div class="card"><h3>兩種發言</h3><p><b>現況描述</b>：當時他認為「現在」是怎樣。</p><p><b>預言</b>：他說「未來某個時間會怎樣」，並有目標時間（horizon）。</p></div>
<div class="card"><h3>可信度</h3><p><span class="tag ok">已查證</span> 我們打開過來源，引述在頁面上找得到。</p><p><span class="tag warn">未完全查證</span> 只看到搜尋摘要或二手轉述，圖上以空心圓表示。</p></div>
<div class="card"><h3>模型與軟體發佈點</h3><p>◆ AI 模型發佈日；■ 軟體／產品（Cursor、Windsurf、Copilot…）；▲ 架構（function calling、agent…）；＋ 協定（MCP…）。顏色依廠商區分，虛線是軟體／架構。</p><p style="font-size:.85rem;color:var(--mute)">圖上可切換顯示、或只看重大里程碑。</p></div>
<div class="card"><h3>互動</h3><p>圖表可滾輪縮放、拖曳平移；點圓點看完整引述與來源；點人名看此人全部發言。</p></div>
</div>`);

slide('overview','資料總覽',`<div class="kicker">OVERVIEW</div><h2>目前收錄的資料</h2>
<div class="grid cards" style="margin-bottom:1rem">
<div class="card"><div class="stat">${nPeople}<small>位人物／團隊</small></div></div>
<div class="card"><div class="stat">${nEntries}<small>則發言</small></div></div>
<div class="card"><div class="stat">${Math.round(100*nVer/Math.max(1,nEntries))}%<small>已查證（${nVer}／${nEntries}）</small></div></div>
<div class="card"><div class="stat">${fmtD(dmin)}<small>最早　→　最新 ${fmtD(dmax)}</small></div></div></div>
<div class="toolbar"><span class="legend"><span><i class="dot" style="background:#38bdf8"></i>現況描述</span><span><i class="dot" style="background:#f5b942"></i>預言</span></span></div>
<div class="chart" id="c-year"></div>`,
(root)=>{
  const host=$('#c-year',root);host.innerHTML='';
  const {svg,w,h}=mkChart(host,280);const m={t:20,r:20,b:30,l:40};
  const yrs=d3.range(dmin.getFullYear(),dmax.getFullYear()+1);
  const rows=yrs.map(y=>({y,pre:ALL.filter(e=>e._d.getFullYear()===y&&e.kind==='present'),pred:ALL.filter(e=>e._d.getFullYear()===y&&e.kind==='prediction')}));
  const x=d3.scaleBand().domain(yrs).range([m.l,w-m.r]).padding(.3);
  const y=d3.scaleLinear().domain([0,d3.max(rows,r=>r.pre.length+r.pred.length)||1]).nice().range([h-m.b,m.t]);
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${h-m.b})`).call(d3.axisBottom(x));
  svg.append('g').attr('class','axis').attr('transform',`translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5));
  [['pre','#38bdf8','現況描述'],['pred','#f5b942','預言']].forEach(([k,c,name],i)=>{
    svg.selectAll('.b'+k).data(rows).join('rect').attr('x',r=>x(r.y)).attr('width',x.bandwidth())
      .attr('y',r=>y(r.pre.length+(k==='pred'?r.pred.length:0)- (k==='pred'?0:0)) ).attr('height',0).attr('fill',c).attr('rx',3)
      .each(function(r){const base=k==='pre'?0:r.pre.length;const cnt=r[k].length;d3.select(this).attr('y',y(base+cnt)).attr('height',y(base)-y(base+cnt))})
      .on('mousemove',(ev,r)=>showTip(`<b>${r.y}</b> ${name}：${r[k].length} 則`,ev)).on('mouseleave',hideTip);
  });
});

// ---------- global speaker-category filter ----------
const FILTER={groups:new Set(groups),rel:'core'};
const relOf=e=>e.dev_relevance||'core';
const relOK=e=>FILTER.rel==='all'||(FILTER.rel==='core'?relOf(e)==='core':relOf(e)!=='offtopic');
const F=()=>ALL.filter(e=>FILTER.groups.has(e.group)&&relOK(e));
function mountFilter(root){
  let bar=root.querySelector(':scope > .filterbar');
  if(!bar){bar=document.createElement('div');bar.className='filterbar';
    const anchor=root.querySelector('.toolbar,.tl-wrap,.chart,#wall');root.insertBefore(bar,anchor)}
  bar.innerHTML='<span class="fl">發言人分類：</span>'+groups.map(g=>{const n=ALL.filter(e=>e.group===g).length;
    return `<span class="chip${FILTER.groups.has(g)?'':' off'}" data-g="${esc(g)}">${esc(g)} <small>${n}</small></span>`}).join('')+
    '<button data-a="all">全選</button><button data-a="none">清除</button><span class="fl" style="margin-left:.8rem">內容：</span>'+
    [['core','只看直接談 AI 能不能做開發的事'],['dev','含次要相關'],['all','全部（含與開發無關）']].map(([k,t])=>`<button data-rel="${k}" class="${FILTER.rel===k?'on':''}">${t}</button>`).join('');
  bar.onclick=ev=>{
    const c=ev.target.closest('.chip'),b=ev.target.closest('button');
    if(b&&b.dataset.rel){FILTER.rel=b.dataset.rel}
    else if(c){const g=c.dataset.g;FILTER.groups.has(g)?FILTER.groups.delete(g):FILTER.groups.add(g)}
    else if(b&&b.dataset.a){b.dataset.a==='all'?groups.forEach(g=>FILTER.groups.add(g)):FILTER.groups.clear()}
    else return;
    rendered.clear();const sl=slides[cur];sl.render(sl.el);rendered.add(cur);
  };
}

// ---------- Facebook-style card timeline ----------
const TL={scale:'quarter',order:1,toggled:new Set()};
const keyOf=(d,scale)=>{if(!d)return '9999';const y=d.getFullYear(),m=d.getMonth();return scale==='year'?`${y}`:scale==='quarter'?`${y} Q${Math.floor(m/3)+1}`:`${y}-${String(m+1).padStart(2,'0')}`};
const labelOf=(k,scale)=>k==='9999'?'未指定時間':scale==='year'?`${k} 年`:scale==='quarter'?k:`${k.slice(0,4)} 年 ${+k.slice(5)} 月`;

const REG=DATA.regressions||{};
const REGV={scope:'範圍不同',topic:'談的是別的事',granularity:'評分粒度',single:'單次經驗',real:'真的倒退'};
const PUBS=(DATA.publications||[]).filter(p=>!p.hidden).map(p=>Object.assign({},p,{_d:parseDate(p.date)})).filter(p=>p._d);
const LONG=300;
const VERDICT={can:['能','#22c55e'],partial:['部分能','#a3e635'],will:['將能','#38bdf8'],cannot:['不能','#e4572e'],wont:['不會','#f59e0b']};
const FRAMES=['輸入法/自動補全','問答/搜尋輔助','結對夥伴','初階工程師/實習生','自主代理/員工','取代者','不可靠/玩具'];
const FCOLOR={'輸入法/自動補全':'#94a3b8','問答/搜尋輔助':'#a78bfa','結對夥伴':'#38bdf8','初階工程師/實習生':'#22c55e','自主代理/員工':'#f59e0b','取代者':'#e4572e','不可靠/玩具':'#64748b'};
const DEVTASKS=['需求/設計','寫程式','Code review','測試','除錯','文件','維運/部署','維護/重構','工程師角色/職缺','與 AI 協作的方式','學習寫程式/教育'];
function claimHtml(e){
  if(!e.focus_zh&&!e.ai_frame)return '';
  const v=e.ai_claim&&VERDICT[e.ai_claim.verdict];
  return `<div class="claim">${v?`<span class="vb" style="background:${v[1]}">AI ${v[0]}</span>`:''}${e.ai_claim&&e.ai_claim.task_zh?`<b>${esc(e.ai_claim.task_zh)}</b>`:''}${e.focus_zh?`<span class="fz">${esc(e.focus_zh)}</span>`:''}</div>`}
function postImgs(e){return ''}
function quoteItem(e,kind,side){
  const same=e.quote_zh===e.quote_original;
  const long=(e.quote_zh||'').length+(same?0:(e.quote_original||'').length)>LONG;
  return `<div class="tl-item ${side}" style="--c:${ec(e)}"><div class="tl-card${long?' clampable':''}" data-id="${esc(e.id)}">
  <div class="hd"><b class="who">${esc(e.person)}</b><span class="dt">${esc(kind==='prediction'?`說於 ${e.date}`:e.date)}</span>${kind==='prediction'&&e.horizon?`<span class="tag">預言目標 ${esc(e.horizon)}</span>`:''}${e.ai_frame?`<span class="frame" style="--f:${FCOLOR[e.ai_frame]||'#94a3b8'}">AI＝${esc(e.ai_frame)}</span>`:''}${e.verified?'':'<span class="tag warn">未完全查證</span>'}</div>
  ${claimHtml(e)}${clv(e)==null?'':`<div class="conc mini" style="border-left:4px solid ${ec(e)}"><b style="color:${ec(e)}">${clv(e)} 級</b>　已攻陷：${esc(e.concession.conceded_zh||'')}　仍堅守：${esc(e.concession.holdout_zh||'')}</div>`}<div class="qz">${esc(e.quote_zh)}</div>${same?'':`<div class="qo" lang="en">${esc(e.quote_original)}</div>`}${postImgs(e)}
  <div class="ft">${e.topic?`<span class="tp">${esc(e.topic)}</span>`:''}<span class="acts">${long?'<a href="#" data-more>展開全文</a>':''}<a href="#" data-detail>來源與詳情</a></span></div></div></div>`}
function pubHtml(p){
  const es=p.entry_ids.map(id=>ALL.find(e=>e.id===id)).filter(Boolean);
  return `<div class="tl-pub" data-p="${esc(p.id)}"><div class="ph">📄 ${esc(p.title_zh)} <small>${esc(p.date)}</small></div>
  <div class="pb">${esc(p.by)}</div><div class="pi">${esc(p.intro_zh||'')}</div>
  <ul class="pc">${es.map(e=>`<li><b>${esc(e.horizon?`預言 ${e.horizon}`:e.date)}</b>　${esc(e.quote_zh)}</li>`).join('')}</ul>
  <div class="pl"><a href="${esc(p.url)}" target="_blank" rel="noopener">原網站</a>${p.archive_url?` · <a href="${esc(p.archive_url)}" target="_blank" rel="noopener">存檔</a>`:''} · <a href="#" data-detail>完整原文與翻譯</a></div></div>`}
function cardTimeline(root,hostSel,tbSel,items,dateOf,opts){
  const host=$(hostSel,root),tb=$(tbSel,root);
  const rels=opts.releases?RELEASES.filter(m=>m.importance>=MS.min&&(m.kind==='model'?MS.showM:MS.showT)):[];
  function draw(){
    const sc=TL.scale;const gm=new Map();
    items.forEach(e=>{const d=dateOf(e);const k=keyOf(d,sc);(gm.get(k)||gm.set(k,{k,items:[],rels:[]}).get(k)).items.push(e)});
    rels.forEach(m=>{const k=keyOf(m._d,sc);if(gm.has(k))gm.get(k).rels.push(m)});
    const pubs=opts.pubs?PUBS.filter(p=>FILTER.groups.has(p.group)):[];
    pubs.forEach(p=>{const k=keyOf(p._d,sc);(gm.get(k)||gm.set(k,{k,items:[],rels:[],pubs:[]}).get(k));const g=gm.get(k);(g.pubs=g.pubs||[]).push(p)});
    let gl=[...gm.values()].sort((a,b)=>a.k<b.k?-1:1);if(TL.order<0)gl.reverse();
    host.innerHTML=`<div class="tl">${gl.map(g=>{
      const tk=sc+':'+opts.id+':'+g.k;const open=sc==='month'?!TL.toggled.has(tk):TL.toggled.has(tk);
      const cnt=[0,1,2,3,4].map(v=>g.items.filter(e=>clv(e)!=null&&Math.round(clv(e))===v).length);
      const people=[...new Set(g.items.map(e=>e.person.replace(/\s*[（(].*/,'')))];
      const its=g.items.slice().sort((a,b)=>dateOf(a)-dateOf(b));
      const seq=its.map(e=>({t:+dateOf(e),e})).concat(g.rels.map(m=>({t:+m._d,m}))).concat((g.pubs||[]).map(p=>({t:+p._d,p}))).sort((a,b)=>(a.t-b.t)*TL.order);
      let side=0;
      return `<section class="tl-group" data-k="${esc(g.k)}"><div class="tl-node"><button data-tk="${esc(tk)}">${open?'▾':'▸'} ${esc(labelOf(g.k,sc))} <small>${g.items.length} 則${(g.pubs||[]).length?` ＋${g.pubs.length} 發表`:''}</small></button></div>
      <div class="tl-sum"><div class="stancebar">${cnt.map((n,i)=>n?`<i style="flex:${n};background:${CONC[i].c}" title="${CONC[i].l}：${n}"></i>`:'').join('')}</div>
      <div class="tl-people">${esc(people.slice(0,8).join('、'))}${people.length>8?` 等 ${people.length} 位`:''}${g.rels.length?` · ◆ ${g.rels.length} 個發佈`:''}${(g.pubs||[]).length?` · 📄 ${g.pubs.length} 個預測網站發表`:''}</div></div>
      ${open?`<div class="tl-items">${seq.map(x=>x.p?pubHtml(x.p):x.m?`<div class="tl-rel" data-m="${esc(x.m.id)}" style="--c:${vc(x.m.vendor)}">${x.m.kind==='model'?'◆':x.m.kind==='tool'?'■':x.m.kind==='architecture'?'▲':'＋'} ${esc(x.m.vendor)} · ${esc(x.m.name)} <small>${esc(x.m.date.slice(5))}</small></div>`:
        quoteItem(x.e,opts.kind,(side++%2)?'right':'left')).join('')}</div>`:''}</section>`}).join('')}</div>`;
    host.querySelectorAll('[data-tk]').forEach(b=>b.onclick=()=>{const k=b.dataset.tk;TL.toggled.has(k)?TL.toggled.delete(k):TL.toggled.add(k);draw()});
    host.querySelectorAll('.tl-card').forEach(c=>{
      const more=c.querySelector('[data-more]');if(more)more.onclick=ev=>{ev.stopPropagation();c.classList.toggle('open');more.textContent=c.classList.contains('open')?'收合':'展開全文'};
      const det=c.querySelector('[data-detail]');if(det)det.onclick=ev=>{ev.preventDefault();ev.stopPropagation();showEntry(ALL.find(e=>e.id===c.dataset.id))}});
    host.querySelectorAll('.who').forEach(w=>{const id=w.closest('.tl-card').dataset.id;const e=ALL.find(x=>x.id===id);if(e){w.style.cursor='pointer';w.title='看個人介紹頁';w.onclick=ev=>{ev.stopPropagation();openProfile(e.slug)}}});
    host.querySelectorAll('.tl-pub').forEach(c=>{const d=c.querySelector('[data-detail]');if(d)d.onclick=ev=>{ev.preventDefault();const p=PUBS.find(x=>x.id===c.dataset.p);openDrawer(`<h2>${esc(p.title_zh)}</h2>`+p.entry_ids.map(id=>ALL.find(e=>e.id===id)).filter(Boolean).map(entryCard).join(''),true)}});
    host.querySelectorAll('.tl-rel').forEach(c=>c.onclick=()=>{const m=RELEASES.find(x=>x.id===c.dataset.m);openDrawer(`<h2>${esc(m.name)}</h2>`+modelCard(m))});
    if(!gl.length)host.innerHTML='<div class="pending">目前的篩選條件下沒有資料。</div>';
  }
  tb.innerHTML='';
  const btn=(t,f,on)=>{const b=document.createElement('button');b.textContent=t;b.onclick=f;if(on)b.classList.add('on');tb.appendChild(b);return b};
  const sync=()=>{tb.querySelectorAll('[data-s]').forEach(b=>b.classList.toggle('on',b.dataset.s===TL.scale))};
  [['year','年'],['quarter','季'],['month','月']].forEach(([k,t])=>{const b=btn('尺度：'+t,()=>{TL.scale=k;sync();draw()});b.dataset.s=k});
  btn(TL.order>0?'↓ 由舊到新':'↑ 由新到舊',function(){TL.order*=-1;this.textContent=TL.order>0?'↓ 由舊到新':'↑ 由新到舊';draw()});
  if(opts.releases&&RELEASES.length){
    const r1=btn('顯示模型／軟體發佈',function(){MS.showM=MS.showT=!(MS.showM&&MS.showT);rerender()},MS.showM&&MS.showT);
    function rerender(){rendered.clear();const sl=slides[cur];sl.render(sl.el);rendered.add(cur)}
  }
  const yrs=[...new Set(items.map(e=>dateOf(e)&&dateOf(e).getFullYear()).filter(Boolean))].sort();
  yrs.forEach(y=>btn(y,()=>{const g=[...host.querySelectorAll('.tl-group')].find(x=>x.dataset.k.startsWith(String(y)));if(g)g.scrollIntoView({behavior:'smooth',block:'start'})}));
  sync();draw();
}
function sc_(v){return sc(v)}

slide('present','時間軸 A：他們當時怎麼說',`<div class="kicker">TIMELINE · PRESENT</div><h2>「現在」的描述：一條時間線，一張張小卡</h2>
<div class="legend" id="lg-present"></div><div class="toolbar" id="tb-present"></div><div class="tl-wrap" id="c-present"></div>`,
(root)=>{
  $('#lg-present',root).innerHTML=stanceLegend().replace(/^<div class="legend">|<\/div>$/g,'');
  mountFilter(root);
  cardTimeline(root,'#c-present','#tb-present',F().filter(e=>e.kind==='present'),e=>e._d,{id:'pres',kind:'present',releases:true,pubs:true});
},true);

slide('predict','時間軸 B：他們預言的未來',`<div class="kicker">TIMELINE · PREDICTIONS</div><h2>「未來」的預言：依「預言的目標時間」排列</h2>
<p class="lead" style="margin:0 0 .4rem">卡片放在「他預言事情會發生」的時間點；卡上另標他是何時說的。只寫年份者以該年年中計。</p>
<div class="toolbar" id="tb-pred"></div><div class="tl-wrap" id="c-pred"></div>`,
(root)=>{
  mountFilter(root);
  cardTimeline(root,'#c-pred','#tb-pred',F().filter(e=>e.kind==='prediction'),e=>e._h,{id:'pred',kind:'prediction',releases:false});
},true);

slide('panorama','全景縮放圖',`<div class="kicker">PANORAMA</div><h2>所有發言與發佈點：一張可縮放的全景圖</h2>
${'<!--legend-->'}<div class="toolbar" id="tb-pano"></div><div class="chart chart-scroll" id="c-pano"></div>`,
(root)=>{
  root.querySelectorAll(':scope > .legend').forEach(x=>x.remove());$('#tb-pano',root).insertAdjacentHTML('beforebegin',stanceLegend());
  mountFilter(root);
  swimlane($('#c-pano',root),$('#tb-pano',root),F(),e=>e._d,{id:'pano'});
},true);

slide('scatter','預言「拉近」還是「推遠」？',`<div class="kicker">WHEN SAID vs. WHEN PREDICTED</div><h2>說話時間 × 預言目標：同一個目標，後來說的人怎麼變？</h2>
<p class="lead" style="margin:0 0 .4rem">橫軸＝說話時間，縱軸＝預言的目標時間。虛線是「當下」（y = x）；點離虛線越遠，代表預言越遙遠。可滾輪同時縮放兩個軸。</p>
<div class="toolbar" id="tb-sc"></div><div class="chart" id="c-sc"></div>`,
(root)=>{mountFilter(root);scatter(root,'#c-sc','#tb-sc',F().filter(e=>e.kind==='prediction'&&e._h))},true);

function scatter(root,hostSel,tbSel,preds){
  const host=$(hostSel,root);host.innerHTML='';
  if(!preds.length){host.innerHTML='<div class="pending">尚無資料。</div>';return}
  const {svg,w,h}=mkChart(host,Math.min(560,Math.max(360,innerHeight-330)));const m={t:14,r:20,b:34,l:56};
  const x0=d3.scaleTime().domain([new Date(dmin.getFullYear(),0,1),new Date(dmax.getFullYear()+1,0,1)]).range([m.l,w-m.r]);
  const y0=d3.scaleTime().domain([new Date(dmin.getFullYear(),0,1),new Date(d3.max(preds,e=>e._h).getFullYear()+1,0,1)]).range([h-m.b,m.t]);
  let xs=x0,ys=y0;
  svg.append('defs').append('clipPath').attr('id','scclip').append('rect').attr('x',m.l).attr('y',m.t).attr('width',w-m.l-m.r).attr('height',h-m.t-m.b);
  const gx=svg.append('g').attr('class','axis').attr('transform',`translate(0,${h-m.b})`),gy=svg.append('g').attr('class','axis').attr('transform',`translate(${m.l},0)`);
  const body=svg.append('g').attr('clip-path','url(#scclip)');
  const sl=RELEASES.length?modelLayer(svg,()=>xs,{clip:'scclip',top:m.t,bottom:h-m.b,rowY:null}):null;
  const diag=body.append('line').attr('stroke','#9aa3b2').attr('stroke-dasharray','5 4');
  const pts=dotAttrs(body.selectAll('circle').data(preds).join('circle'));
  svg.append('text').attr('x',w-m.r).attr('y',h-6).attr('text-anchor','end').attr('fill','#9aa3b2').attr('font-size',11).text('說話時間 →');
  svg.append('text').attr('x',m.l+8).attr('y',m.t+12).attr('fill','#9aa3b2').attr('font-size',11).text('↑ 預言目標');
  function draw(){gx.call(d3.axisBottom(xs).ticks(8));gy.call(d3.axisLeft(ys).ticks(8));
    pts.attr('cx',e=>xs(e._d)).attr('cy',e=>ys(e._h));
    const a=new Date(Math.max(+xs.domain()[0],+ys.domain()[0])),b=new Date(Math.min(+xs.domain()[1],+ys.domain()[1]));
    if(sl)sl.update();
    diag.attr('x1',xs(a)).attr('y1',ys(a)).attr('x2',xs(b)).attr('y2',ys(b))}
  const zoom=d3.zoom().scaleExtent([1,40]).translateExtent([[m.l,m.t],[w-m.r,h-m.b]]).extent([[m.l,m.t],[w-m.r,h-m.b]])
    .on('zoom',ev=>{xs=ev.transform.rescaleX(x0);ys=ev.transform.rescaleY(y0);draw()});
  svg.call(zoom).on('dblclick.zoom',null);
  const tb=$(tbSel,root);tb.innerHTML='';zoomButtons(tb,svg,zoom,()=>svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity));
  modelControls(tb);
  tb.insertAdjacentHTML('beforeend','<span class="sp"></span>'+stanceLegend());
  draw();
}

slide('stance','退守曲線',`<div class="kicker">THE RETREAT CURVE</div><h2>每個人承認 AI 攻下多少：從全手動退向全自動</h2>
<p class="lead" style="margin:0 0 .4rem">縱軸是光譜位置（0 全手動 → 4 全自動）。即使嘴上說「軟體開發不會死」，曲線往上就代表他在退守。點下方人名開關折線。</p>
<div class="toolbar" id="chips"></div><div class="toolbar" id="tb-st"></div><div class="chart" id="c-st"></div>`,
(root)=>{
  const host=$('#c-st',root);host.innerHTML='';
  const chipsEl=$('#chips',root);chipsEl.innerHTML='';
  mountFilter(root);
  const cand=sortedPeople.filter(p=>p.entries.length>=2&&FILTER.groups.has(p.group));
  const on=new Set(cand.slice().sort((a,b)=>b.entries.length-a.entries.length).slice(0,5).map(p=>p.slug));
  const {svg,w,h}=mkChart(host,Math.min(520,Math.max(340,innerHeight-380)));const m={t:16,r:20,b:34,l:44};
  const x0=d3.scaleTime().domain([new Date(dmin.getFullYear(),0,1),new Date(dmax.getFullYear()+1,0,1)]).range([m.l,w-m.r]);
  const y=d3.scaleLinear().domain([-0.3,4.3]).range([h-m.b,m.t]);
  let xs=x0;
  svg.append('defs').append('clipPath').attr('id','stclip').append('rect').attr('x',m.l).attr('y',0).attr('width',w-m.l-m.r).attr('height',h);
  const gx=svg.append('g').attr('class','axis').attr('transform',`translate(0,${h-m.b})`);
  svg.append('g').attr('class','axis').attr('transform',`translate(${m.l},0)`).call(d3.axisLeft(y).tickValues([0,1,2,3,4]).tickFormat(v=>({0:'0 全手動',4:'4 全自動'}[v]||v)));
  [0,1,2,3,4].forEach(v=>svg.append('line').attr('class','grid-line').attr('x1',m.l).attr('x2',w-m.r).attr('y1',y(v)).attr('y2',y(v)));
  const stl=RELEASES.length?modelLayer(svg,()=>xs,{clip:'stclip',top:m.t,bottom:h-m.b,rowY:null}):null;
  const body=svg.append('g').attr('clip-path','url(#stclip)');
  function draw(){
    gx.call(d3.axisBottom(xs).ticks(8));body.selectAll('*').remove();if(stl)stl.update();
    cand.filter(p=>on.has(p.slug)).forEach(p=>{
      const es=ALL.filter(e=>e.slug===p.slug&&clv(e)!=null&&relOK(e)).sort((a,b)=>a._d-b._d);
      body.append('path').datum(es).attr('fill','none').attr('stroke',PCOLOR[p.slug]).attr('stroke-width',2).attr('opacity',.8)
        .attr('d',d3.line().x(e=>xs(e._d)).y(e=>y(clv(e))).curve(d3.curveMonotoneX));
      body.selectAll('.c'+p.slug).data(es).join('circle').attr('cx',e=>xs(e._d)).attr('cy',e=>y(clv(e))).attr('r',5.5)
        .attr('fill',e=>e.verified?ec(e):'var(--bg)').attr('stroke',PCOLOR[p.slug]).attr('stroke-width',2).attr('class','pt')
        .on('mousemove',(ev,e)=>showTip(entryTip(e),ev)).on('mouseleave',hideTip).on('click',(ev,e)=>{hideTip();showEntry(e)});
    });
  }
  cand.forEach(p=>{const c=document.createElement('span');c.className='chip'+(on.has(p.slug)?'':' off');
    c.innerHTML=`<i class="dot" style="background:${PCOLOR[p.slug]}"></i>${esc(p.name.replace(/\s*\(.*\)/,''))}`;
    c.onclick=()=>{on.has(p.slug)?on.delete(p.slug):on.add(p.slug);c.classList.toggle('off');draw()};chipsEl.appendChild(c)});
  const zoom=d3.zoom().scaleExtent([1,60]).translateExtent([[m.l,0],[w-m.r,h]]).extent([[m.l,0],[w-m.r,h]]).on('zoom',ev=>{xs=ev.transform.rescaleX(x0);draw()});
  svg.call(zoom).on('dblclick.zoom',null);
  const tb=$('#tb-st',root);tb.innerHTML='';zoomButtons(tb,svg,zoom,()=>svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity));modelControls(tb);
  draw();
},true);

slide('heat','各陣營的退守程度',`<div class="kicker">CONSENSUS MAP</div><h2>各類人物在每一年，平均承認 AI 攻下多少</h2>
<p class="lead" style="margin:0 0 .6rem">格內數字＝光譜平均位置（0 全手動 → 4 全自動），括號內＝發言數。空白代表該年沒有資料。</p>
<div class="chart" id="c-heat" style="padding:.5rem"></div>`,
(root)=>{
  const host=$('#c-heat',root);host.innerHTML='';
  const yrs=d3.range(dmin.getFullYear(),dmax.getFullYear()+1);
  mountFilter(root);const gs=groups.filter(g=>FILTER.groups.has(g));
  const {svg,w,h}=mkChart(host,60+Math.max(1,gs.length)*54);const ml=190,mt=34;
  const cw=(w-ml-16)/yrs.length,rh=48;
  const col=SPEC;
  yrs.forEach((yr,i)=>svg.append('text').attr('x',ml+i*cw+cw/2).attr('y',22).attr('text-anchor','middle').attr('fill','#9aa3b2').text(yr));
  gs.forEach((g,gi)=>{
    svg.append('text').attr('x',ml-10).attr('y',mt+gi*rh+rh/2+4).attr('text-anchor','end').attr('class','lane-label').text(g);
    yrs.forEach((yr,i)=>{
      const es=ALL.filter(e=>e.group===g&&e._d.getFullYear()===yr&&clv(e)!=null&&relOK(e));
      const g2=svg.append('g');
      g2.append('rect').attr('x',ml+i*cw+2).attr('y',mt+gi*rh+2).attr('width',cw-4).attr('height',rh-4).attr('rx',8).attr('fill',es.length?col(d3.mean(es,e=>clv(e))):'#ffffff08');
      if(es.length){g2.append('text').attr('x',ml+i*cw+cw/2).attr('y',mt+gi*rh+rh/2+5).attr('text-anchor','middle').attr('fill','#fff').attr('font-weight',600).text(`${d3.mean(es,e=>clv(e)).toFixed(1)} (${es.length})`);
        g2.style('cursor','pointer').on('mousemove',ev=>showTip(`<b>${esc(g)}</b> ${yr}<br>${es.length} 則，平均 ${d3.mean(es,e=>clv(e)).toFixed(2)}<br>${[...new Set(es.map(e=>e.person))].map(esc).join('、')}`,ev)).on('mouseleave',hideTip)
          .on('click',()=>{hideTip();openDrawer(`<h2>${esc(g)} · ${yr}</h2>${es.map(entryCard).join('')}`)})}
    });
  });
},true);



slide('frames','他們把 AI 當成什麼',`<div class="kicker">HOW THEY FRAME AI</div><h2>從「比較快的輸入法」到「員工」：對 AI 角色的看法怎麼變</h2>
<p class="lead" style="margin:0 0 .4rem">每則發言依他怎麼看待 AI 在開發中的角色歸類。點色塊看是哪些人、原話是什麼。</p>
<div class="toolbar" id="tb-fr"></div><div class="chart" id="c-fr"></div><div class="legend" id="lg-fr" style="margin-top:.6rem"></div>`,
(root)=>{
  mountFilter(root);
  const host=$('#c-fr',root),tb=$('#tb-fr',root);let pct=false;
  $('#lg-fr',root).innerHTML=FRAMES.map(f=>`<span><i class="dot" style="background:${FCOLOR[f]}"></i>${f}</span>`).join('');
  const es=F().filter(e=>e.ai_frame);
  if(!es.length){host.innerHTML='<div class="pending">目前的篩選條件下沒有標註「AI 角色」的發言。</div>';tb.innerHTML='';return}
  const half=e=>`${e._d.getFullYear()}H${e._d.getMonth()<6?1:2}`;
  const bins=[...new Set(es.map(half))].sort();
  function draw(){
    host.innerHTML='';
    const w=Math.max(360,host.clientWidth||900),h=380,m={t:16,r:16,b:34,l:44};
    const svg=d3.select(host).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('height',h);
    const x=d3.scaleBand().domain(bins).range([m.l,w-m.r]).padding(.25);
    const data=bins.map(b=>{const g=es.filter(e=>half(e)===b);const o={b,n:g.length};FRAMES.forEach(f=>o[f]=g.filter(e=>e.ai_frame===f).length);return o});
    const y=d3.scaleLinear().domain([0,pct?1:d3.max(data,d=>d.n)]).nice().range([h-m.b,m.t]);
    svg.append('g').attr('class','axis').attr('transform',`translate(0,${h-m.b})`).call(d3.axisBottom(x));
    svg.append('g').attr('class','axis').attr('transform',`translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickFormat(pct?d3.format('.0%'):d3.format('d')));
    data.forEach(d=>{let acc=0;FRAMES.forEach(f=>{const n=d[f];if(!n)return;const v0=acc,v1=acc+(pct?n/d.n:n);acc=v1;
      svg.append('rect').attr('x',x(d.b)).attr('width',x.bandwidth()).attr('y',y(v1)).attr('height',y(v0)-y(v1)).attr('fill',FCOLOR[f]).attr('stroke','#0f1115').style('cursor','pointer')
        .on('mousemove',ev=>showTip(`<b>${d.b}</b>　AI＝${f}：${n} 則`,ev)).on('mouseleave',hideTip)
        .on('click',()=>{hideTip();openDrawer(`<h2>${d.b}　AI＝${esc(f)}</h2>`+es.filter(e=>half(e)===d.b&&e.ai_frame===f).map(entryCard).join(''),true)})})});
  }
  tb.innerHTML='';const bt=document.createElement('button');bt.textContent='切換：則數／比例';bt.onclick=()=>{pct=!pct;draw()};tb.appendChild(bt);
  draw();
},true);

slide('tasks','AI 能不能做：依開發任務',`<div class="kicker">CAN / CAN'T BY TASK</div><h2>每一種開發任務，他們說 AI 能還是不能</h2>
<p class="lead" style="margin:0 0 .4rem">列＝開發任務，欄＝年份。每格的色條是該年對此任務說「能／部分能／將能／不能／不會」的發言比例。點格子看原話。</p>
<div class="legend" id="lg-tk"></div><div class="chart" id="c-tk" style="padding:.5rem"></div>`,
(root)=>{
  mountFilter(root);
  const host=$('#c-tk',root);host.innerHTML='';
  $('#lg-tk',root).innerHTML=Object.entries(VERDICT).map(([k,v])=>`<span><i class="dot" style="background:${v[1]}"></i>${v[0]}</span>`).join('');
  const es=F().filter(e=>e.ai_claim&&e.dev_tasks&&e.dev_tasks.length);
  if(!es.length){host.innerHTML='<div class="pending">目前的篩選條件下沒有標註的發言。</div>';return}
  const yrs=d3.range(2023,dmax.getFullYear()+1);const tasks=DEVTASKS.filter(t=>es.some(e=>e.dev_tasks.includes(t)));
  const w=Math.max(560,host.clientWidth||900),ml=170,mt=30,rh=50,cw=(w-ml-10)/yrs.length,h=mt+tasks.length*rh+8;
  const svg=d3.select(host).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('height',h);
  yrs.forEach((y,i)=>svg.append('text').attr('x',ml+i*cw+cw/2).attr('y',20).attr('text-anchor','middle').attr('fill','#9aa3b2').text(y));
  tasks.forEach((t,j)=>{svg.append('text').attr('class','lane-label').attr('x',ml-10).attr('y',mt+j*rh+rh/2+4).attr('text-anchor','end').text(t);
    yrs.forEach((y,i)=>{
      const g=es.filter(e=>e.dev_tasks.includes(t)&&e._d.getFullYear()===y);const x0=ml+i*cw+3,y0=mt+j*rh+4;
      svg.append('rect').attr('x',x0).attr('y',y0).attr('width',cw-6).attr('height',rh-8).attr('rx',8).attr('fill','#ffffff08');
      if(!g.length)return;let acc=0;
      Object.keys(VERDICT).forEach(v=>{const n=g.filter(e=>e.ai_claim.verdict===v).length;if(!n)return;const wv=(cw-6)*n/g.length;
        svg.append('rect').attr('x',x0+acc).attr('y',y0+8).attr('width',wv).attr('height',rh-24).attr('fill',VERDICT[v][1]);acc+=wv});
      svg.append('text').attr('x',x0+(cw-6)/2).attr('y',y0+rh-10).attr('text-anchor','middle').attr('font-size',10).attr('fill','#9aa3b2').text(g.length+' 則');
      svg.append('rect').attr('x',x0).attr('y',y0).attr('width',cw-6).attr('height',rh-8).attr('fill','transparent').style('cursor','pointer')
        .on('mousemove',ev=>showTip(`<b>${t}　${y}</b><br>`+Object.keys(VERDICT).map(v=>{const n=g.filter(e=>e.ai_claim.verdict===v).length;return n?`${VERDICT[v][0]}：${n}`:''}).filter(Boolean).join('　'),ev)).on('mouseleave',hideTip)
        .on('click',()=>{hideTip();openDrawer(`<h2>${t}　${y}</h2>`+g.sort((a,b)=>a._d-b._d).map(entryCard).join(''),true)});
    })});
},true);


// ---------- key shifts per person ----------
const ISSUES={
 review:{label:'要不要逐行 review',get:e=>e.positions&&e.positions.review,vals:{line_by_line:['堅持人逐行 review','#38bdf8'],alt_audit:['不逐行，改用其他稽核方式（測試／規格／AI 審／抽查／問責）','#f59e0b'],none:['不需要 review','#e4572e']}},
 hand_coding:{label:'還要不要自己手寫程式',get:e=>e.positions&&e.positions.hand_coding,vals:{hand_code:['堅持自己手寫','#38bdf8'],ai_assisted:['AI 輔助、人仍動手寫','#22c55e'],no_hand_code:['不再手寫，由 AI 寫','#e4572e']}},
 engineer_demand:{label:'工程師的需求',get:e=>e.positions&&e.positions.engineer_demand,vals:{same_or_more:['工程師不變或更多','#38bdf8'],changed_role:['角色轉變','#f59e0b'],fewer:['需要更少的工程師','#e4572e']}},
 ai_frame:{label:'把 AI 當成什麼',get:e=>e.ai_frame,vals:Object.fromEntries(FRAMES.map(f=>[f,[f,FCOLOR[f]]]))}
};
slide('shifts','關鍵轉折：誰在什麼時候改口',`<div class="kicker">KEY SHIFTS</div><h2>同一個人，什麼時候從「要逐行 review」變成「不用逐行、但要有稽核」</h2>
<p class="lead" style="margin:0 0 .4rem">每個議題一張圖：每人一條橫軸，圓點是他說話的時間，顏色是當時的立場，虛線圈標出立場改變的那一刻。下方列出每個人的轉折：什麼時候說了什麼、又在什麼時候改說什麼。</p>
<div class="toolbar" id="tb-issue"></div><div class="toolbar" id="tb-shift"></div><div class="legend" id="lg-shift"></div><div class="chart chart-scroll" id="c-shift"></div><div id="shift-list"></div>`,
(root)=>{
  mountFilter(root);
  const tbI=$('#tb-issue',root);tbI.innerHTML='';
  let cur=root._issue||'review';
  Object.entries(ISSUES).forEach(([k,v])=>{const b=document.createElement('button');b.textContent=v.label;b.classList.toggle('on',k===cur);b.onclick=()=>{root._issue=k;draw(k);tbI.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b))};tbI.appendChild(b)});
  function draw(k){
    const iss=ISSUES[k];cur=k;
    $('#lg-shift',root).innerHTML=Object.values(iss.vals).map(v=>`<span><i class="dot" style="background:${v[1]}"></i>${esc(v[0])}</span>`).join('');
    const host=$('#c-shift',root),list=$('#shift-list',root);host.innerHTML='';list.innerHTML='';
    const es=F().filter(e=>iss.get(e)&&iss.vals[iss.get(e)]);
    if(!es.length){host.innerHTML='<div class="pending">目前的篩選條件下，還沒有可標示此議題立場的發言（分類標註進行中或資料不足）。</div>';$('#tb-shift',root).innerHTML='';return}
    const by=d3.group(es,e=>e.slug);const shifts=[];
    by.forEach(a=>{const ss=a.slice().sort((p,q)=>p._d-q._d);for(let i=1;i<ss.length;i++)if(iss.get(ss[i])!==iss.get(ss[i-1]))shifts.push({from:ss[i-1],to:ss[i]})});
    swimlane(host,$('#tb-shift',root),es,e=>e._d,{id:'shift',colorOf:e=>iss.vals[iss.get(e)][1],lines:true,rings:shifts.map(x=>x.to)});
    const who=[...by.keys()];
    list.innerHTML=`<h3 style="margin:1rem 0 .4rem">轉折點（${shifts.length} 處）</h3>`+(shifts.length?'<div class="grid cards" style="grid-template-columns:repeat(auto-fill,minmax(340px,1fr))">'+shifts.sort((a,b)=>a.to._d-b.to._d).map((x,i)=>{
      const months=Math.round((x.to._d-x.from._d)/2629800000);
      const side=(e,c)=>`<div class="shs" style="border-left:4px solid ${iss.vals[iss.get(e)][1]}"><div class="meta">${esc(e.date)}・<b>${esc(iss.vals[iss.get(e)][0])}</b></div><div class="zh">${esc(e.quote_zh.length>150?e.quote_zh.slice(0,150)+'…':e.quote_zh)}</div><a href="#" data-i="${ALL.indexOf(e)}" class="shl">看完整原文與來源</a></div>`;
      return `<div class="card"><h3>${esc(x.to.person)} <small style="color:var(--mute);font-weight:400">${months>0?`相隔約 ${months} 個月`:'同月內'}</small></h3>${side(x.from)}<div class="arrow">↓ 改口</div>${side(x.to)}</div>`}).join('')+'</div>':'<p class="lead">這個議題上沒有人在資料中出現立場改變（每人只有單一立場，或同一立場重複）。</p>');
    list.querySelectorAll('.shl').forEach(a=>a.onclick=ev=>{ev.preventDefault();showEntry(ALL[+a.dataset.i])});
  }
  draw(cur);
},true);

// ---------- SDLC topic slides ----------
const T=DATA.topics;
const SCORE_COLOR=['#475569','#38bdf8','#22c55e','#f59e0b','#e4572e'];
const WRITER={human:{l:'人寫',c:'#94a3b8'},human_ai_assist:{l:'人寫＋AI 輔助',c:'#38bdf8'},ai_supervised:{l:'AI 寫（人監督）',c:'#f59e0b'},ai_autonomous:{l:'AI 自主',c:'#e4572e'}};
const REVIEWER={human_line_by_line:'人逐行看',human_spot_check:'人抽查',ai:'AI 審',tests_spec_only:'只靠測試／規格',none:'不審'};
const ACT_LABEL={coding:'寫程式',review:'Code review',docs:'文件／註解',testing:'測試',debugging:'除錯',design:'設計／需求',ops:'部署維運',maintenance:'維護／遷移'};
const STATUS={holding:['堅守中','#22c55e'],retreating:['節節後退','#f59e0b'],fallen:['已淪陷','#e4572e']};
const M0=new Date(2023,0,1),NM=45;
const monthOf=i=>new Date(2023,i,1);
const idxOf=d=>(d.getFullYear()-2023)*12+d.getMonth();
const fmtM=i=>{const d=monthOf(i);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`};
const TC={i:NM-1,timer:null,subs:new Set()};
function evList(evs){return (evs||[]).map(x=>{
  const t=esc(x.title||x.ref);
  if(x.type==='entry'&&ALL.some(a=>a.id===x.ref))return `<li><a href="#" class="ev" data-e="${esc(x.ref)}">💬 ${t}</a></li>`;
  if((x.type==='tool'||x.type==='model')&&RELEASES.some(a=>a.id===x.ref))return `<li><a href="#" class="ev" data-m="${esc(x.ref)}">◆ ${t}</a></li>`;
  return x.url?`<li><a href="${esc(x.url)}" target="_blank" rel="noopener">🔗 ${t}</a></li>`:`<li>${t}</li>`}).join('')}
const CONF={high:['高','ok'],medium:['中',''],low:['低','warn']};
function levelAt(st,i){let lv=null;st.levels.forEach(l=>{if(idxOf(parseDate(l.date))<=i)lv=l});return lv}
function stageDrawer(st){
  const hs=STATUS[st.holdout_status]||['','#94a3b8'];
  openDrawer(`<h2>${esc(st.name_zh)}</h2><p style="color:var(--mute)">${esc(st.desc_zh)}</p>
  <div class="entry" style="border-color:${hs[1]}"><div class="meta"><span class="tag" style="color:${hs[1]};border-color:${hs[1]}">人類堡壘：${hs[0]}</span></div><div class="zh">${esc(st.human_holdout_zh)}</div></div>
  <h3>攻破程度的演進</h3>`+st.levels.map(l=>`<div class="entry"><div class="meta"><span class="dot" style="background:${SCORE_COLOR[l.score]}"></span>${esc(l.date)} · <b>${l.score} 級</b>（${esc(T.scale[l.score].label_zh)}）<span class="tag ${(CONF[l.confidence]||[])[1]}">信心：${(CONF[l.confidence]||[l.confidence])[0]}</span></div>
    <div class="zh"><b>${esc(l.summary_zh)}</b></div><div class="zh" style="color:var(--mute);margin-top:.3rem">${esc(l.rationale_zh)}</div><ul class="evl">${evList(l.evidence)}</ul></div>`).join('')+
  `<h3>還沒解決的問題</h3><div class="zh">${esc(st.open_questions_zh||'')}</div><p class="meta">分數為編輯判斷，非量測值。</p>`,true);
}
function modeDrawer(m){
  openDrawer(`<h2>${esc(m.name_zh)}</h2><div class="meta"><span class="tag">${esc(ACT_LABEL[m.activity]||m.activity)}</span><span class="tag" style="color:${WRITER[m.writer].c}">寫：${WRITER[m.writer].l}</span><span class="tag">審：${esc(REVIEWER[m.reviewer])}</span><span class="tag">${esc(m.start)} → ${esc(m.end||'現在')}</span></div>
  <div class="zh" style="margin:.6rem 0">${esc(m.desc_zh)}</div>
  ${(m.exemplar_ids||[]).length?`<h3>代表工具</h3><ul class="evl">${m.exemplar_ids.map(id=>RELEASES.some(r=>r.id===id)?`<li><a href="#" class="ev" data-m="${esc(id)}">◆ ${esc(RELEASES.find(r=>r.id===id).name)}</a></li>`:'').join('')}</ul>`:''}
  <h3>證據</h3><ul class="evl">${evList(m.evidence)}</ul>
  ${(m.voices||[]).length?`<h3>相關人物發言</h3><ul class="evl">${m.voices.map(v=>{const e=ALL.find(a=>a.id===v.entry_id);return e?`<li><a href="#" class="ev" data-e="${esc(v.entry_id)}">💬 ${esc(e.person)}：${esc(e.summary_zh.slice(0,50))}</a> <span class="tag">${esc(v.stance_on_mode_zh||'')}</span></li>`:''}).join('')}</ul>`:''}`,true);
}
function cursorControl(root,cb){
  let bar=root.querySelector(':scope > .cursor');
  if(!bar){bar=document.createElement('div');bar.className='cursor';const a=root.querySelector('.toolbar,.chart,.stagegrid');root.insertBefore(bar,a)}
  bar.innerHTML=`<button class="play">▶ 播放</button><input type="range" min="0" max="${NM-1}" value="${TC.i}"><b class="cl"></b>`;
  const r=bar.querySelector('input'),lb=bar.querySelector('.cl'),pb=bar.querySelector('.play');
  const set=i=>{TC.i=i;r.value=i;lb.textContent=fmtM(i);TC.subs.forEach(f=>f.node.isConnected?f.fn():TC.subs.delete(f))};
  lb.textContent=fmtM(TC.i);
  const sub={node:bar,fn:cb};TC.subs.add(sub);
  r.oninput=()=>set(+r.value);
  pb.onclick=()=>{if(TC.timer){clearInterval(TC.timer);TC.timer=null;pb.textContent='▶ 播放';return}
    if(TC.i>=NM-1)set(0);pb.textContent='⏸ 暫停';TC.timer=setInterval(()=>{if(!bar.isConnected||TC.i>=NM-1){clearInterval(TC.timer);TC.timer=null;pb.textContent='▶ 播放';return}set(TC.i+1)},220)};
  cb();
}
const EDIT_NOTE='<div class="editnote">⚠ 攻破程度為編輯判斷（非量測值）：每個分數都列出理由、證據與信心，並納入反方證據。點任何卡片看細節。</div>';

if(T){
slide('sdlc','軟體開發週期：每個階段被 AI 攻破了多少',`<div class="kicker">TOPIC · SDLC</div><h2>把軟體開發拆開，看每一段被 AI 攻下多少</h2>${EDIT_NOTE}
<div class="scalelegend" id="sl-sdlc"></div><div class="stagegrid" id="sg"></div>`,
(root)=>{
  $('#sl-sdlc',root).innerHTML=T.scale.map(x=>`<span><i class="dot" style="background:${SCORE_COLOR[x.score]}"></i><b>${x.score}</b> ${esc(x.label_zh)}</span>`).join('');
  const sts=T.stages.slice().sort((a,b)=>a.order-b.order);
  function draw(){
    $('#sg',root).innerHTML=sts.map(st=>{
      const lv=levelAt(st,TC.i);const sc0=lv?lv.score:0;const hs=STATUS[st.holdout_status]||['','#94a3b8'];
      const pts=st.levels.map(l=>[idxOf(parseDate(l.date)),l.score]);
      const X=i=>4+i/(NM-1)*132,Y=s=>34-s*8;
      let path=`M${X(0)},${Y(0)}`;let prev=0;pts.forEach(([i,s])=>{path+=` L${X(i)},${Y(prev)} L${X(i)},${Y(s)}`;prev=s});path+=` L${X(NM-1)},${Y(prev)}`;
      return `<div class="stage" data-id="${esc(st.id)}" style="--c:${SCORE_COLOR[sc0]}"><div class="sn">${st.order}. ${esc(st.name_zh)}</div>
      <div class="gauge">${[1,2,3,4].map(k=>`<i style="background:${k<=sc0?SCORE_COLOR[sc0]:'var(--line)'}"></i>`).join('')}</div>
      <div class="sv"><b style="color:${SCORE_COLOR[sc0]}">${sc0} 級</b> ${esc(T.scale[sc0].label_zh)}</div>
      <svg viewBox="0 0 140 38" class="spark"><path d="${path}" fill="none" stroke="${SCORE_COLOR[sc0]}" stroke-width="1.6" opacity=".8"/><line x1="${X(TC.i)}" x2="${X(TC.i)}" y1="0" y2="38" stroke="#f5b942"/></svg>
      <div class="zh clamp3">${esc(lv?lv.summary_zh:'AI 尚未涉入。')}</div>
      <div class="hold" style="color:${hs[1]}">堡壘：${hs[0]}</div></div>`}).join('');
    root.querySelectorAll('.stage').forEach(c=>c.onclick=()=>stageDrawer(T.stages.find(s=>s.id===c.dataset.id)));
  }
  cursorControl(root,draw);
},true);

slide('modes','開發模式的漸變：誰寫、誰審',`<div class="kicker">TOPIC · WHO WRITES × WHO REVIEWS</div><h2>從「人寫、人審」一路滑向「AI 寫、測試審」</h2>${EDIT_NOTE}
<div class="toolbar" id="tb-modes"></div><div class="chart" id="c-modes"></div>`,
(root)=>{
  const host=$('#c-modes',root),tb=$('#tb-modes',root);
  const sel=new Set(['coding','review']);
  tb.innerHTML='';
  Object.keys(ACT_LABEL).forEach(a=>{const b=document.createElement('button');b.textContent=ACT_LABEL[a];b.classList.toggle('on',sel.has(a));
    b.onclick=()=>{sel.has(a)?sel.delete(a):sel.add(a);b.classList.toggle('on');draw()};tb.appendChild(b)});
  const wk=Object.keys(WRITER),rk=Object.keys(REVIEWER);
  function draw(){
    host.innerHTML='';
    const ms=T.modes.filter(m=>sel.has(m.activity));
    const ml=130,mt=44,cw=Math.max(150,((host.clientWidth||900)-ml-10)/wk.length),ch=96,w=ml+cw*wk.length+10,h=mt+ch*rk.length+10;
    const svg=d3.select(host).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('height',h);
    wk.forEach((k,i)=>{svg.append('text').attr('x',ml+i*cw+cw/2).attr('y',24).attr('text-anchor','middle').attr('fill',WRITER[k].c).attr('font-weight',700).text('寫：'+WRITER[k].l)});
    rk.forEach((k,j)=>{svg.append('text').attr('x',ml-10).attr('y',mt+j*ch+ch/2+4).attr('text-anchor','end').attr('class','lane-label').text('審：'+REVIEWER[k]);
      wk.forEach((_,i)=>svg.append('rect').attr('x',ml+i*cw+2).attr('y',mt+j*ch+2).attr('width',cw-4).attr('height',ch-4).attr('rx',10).attr('fill',(i+j)%2?'#ffffff05':'#ffffff0a'))});
    const slot={};const pos=m=>{const k=m.writer+'|'+m.reviewer;const n=slot[k]=(slot[k]||0)+1;
      return {x:ml+wk.indexOf(m.writer)*cw+cw/2,y:mt+rk.indexOf(m.reviewer)*ch+18+(n-1)*24}};
    const P=ms.map(m=>Object.assign({m},pos(m)));
    const g=svg.append('g');
    Object.keys(ACT_LABEL).filter(a=>sel.has(a)).forEach(a=>{const seq=P.filter(p=>p.m.activity===a).sort((x,y)=>x.m.start<y.m.start?-1:1);
      if(seq.length>1)g.append('path').attr('class','flow').attr('data-a',a).attr('fill','none').attr('stroke','#f5b94288').attr('stroke-dasharray','5 4').attr('stroke-width',1.5).attr('d',d3.line().curve(d3.curveMonotoneY)(seq.map(p=>[p.x,p.y+9])))});
    const nodes=g.selectAll('g.mn').data(P).join('g').attr('class','mn').style('cursor','pointer').on('click',(ev,p)=>modeDrawer(p.m))
      .on('mousemove',(ev,p)=>showTip(`<b>${esc(p.m.name_zh)}</b><br>${esc(p.m.start)} → ${esc(p.m.end||'現在')}`,ev)).on('mouseleave',hideTip);
    nodes.append('rect').attr('x',p=>p.x-cw/2+8).attr('y',p=>p.y).attr('width',cw-16).attr('height',20).attr('rx',10).attr('fill',p=>WRITER[p.m.writer].c);
    nodes.append('text').attr('x',p=>p.x).attr('y',p=>p.y+14).attr('text-anchor','middle').attr('font-size',11).attr('fill','#0f1115').attr('font-weight',600).text(p=>(ACT_LABEL[p.m.activity]||'').slice(0,4)+'｜'+p.m.name_zh.slice(0,Math.floor(cw/13)-5));
    function upd(){nodes.attr('opacity',p=>{const s=idxOf(parseDate(p.m.start)),e=p.m.end?idxOf(parseDate(p.m.end)):NM;return TC.i<s?.13:TC.i>e?.35:1})
      .select('rect').attr('stroke',p=>{const s=idxOf(parseDate(p.m.start)),e=p.m.end?idxOf(parseDate(p.m.end)):NM;return TC.i>=s&&TC.i<=e?'#fff':'none'}).attr('stroke-width',2)}
    upd();
    cursorControl(root,upd);
  }
  draw();
},true);

slide('gantt','各活動的分工接力',`<div class="kicker">TOPIC · HANDOFFS BY ACTIVITY</div><h2>每一種開發活動：分工模式如何一棒接一棒</h2>${EDIT_NOTE}
<div class="legend" id="lg-g"></div><div class="chart" id="c-gantt"></div>`,
(root)=>{
  $('#lg-g',root).innerHTML=Object.values(WRITER).map(x=>`<span><i class="dot" style="background:${x.c}"></i>寫：${x.l}</span>`).join('')+'<span style="color:var(--mute)">條內文字＝誰審；白線＝目前時間游標</span>';
  const host=$('#c-gantt',root);host.innerHTML='';
  const acts=Object.keys(ACT_LABEL).filter(a=>T.modes.some(m=>m.activity===a));
  const laneOf={};const rows={};
  acts.forEach(a=>{const ms=T.modes.filter(m=>m.activity===a).sort((x,y)=>x.start<y.start?-1:1);const ends=[];
    ms.forEach(m=>{const s=idxOf(parseDate(m.start)),e=m.end?idxOf(parseDate(m.end)):NM;let l=ends.findIndex(x=>x<=s);if(l<0){l=ends.length;ends.push(e)}else ends[l]=e;laneOf[m.id]=l});rows[a]=ends.length});
  const ml=120,mt=34,lh=24,gap=14,w=Math.max(720,host.clientWidth||900);
  let y=mt;const ys={};acts.forEach(a=>{ys[a]=y;y+=rows[a]*lh+gap});const h=y+6;
  const svg=d3.select(host).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('height',h);
  const x=d3.scaleLinear().domain([0,NM]).range([ml,w-14]);
  d3.range(0,NM,6).concat([NM]).forEach(i=>{svg.append('line').attr('class','grid-line').attr('x1',x(i)).attr('x2',x(i)).attr('y1',mt-8).attr('y2',h);
    svg.append('text').attr('x',x(i)).attr('y',18).attr('text-anchor','middle').attr('fill','#9aa3b2').attr('font-size',11).text(i>=NM?'現在':fmtM(i))});
  acts.forEach(a=>{svg.append('text').attr('class','lane-label').attr('x',ml-10).attr('y',ys[a]+14).attr('text-anchor','end').text(ACT_LABEL[a])});
  const bars=svg.selectAll('g.gb').data(T.modes.filter(m=>acts.includes(m.activity))).join('g').attr('class','gb').style('cursor','pointer')
    .on('click',(ev,m)=>modeDrawer(m)).on('mousemove',(ev,m)=>showTip(`<b>${esc(m.name_zh)}</b><br>寫：${WRITER[m.writer].l}　審：${esc(REVIEWER[m.reviewer])}<br>${esc(m.start)} → ${esc(m.end||'現在')}`,ev)).on('mouseleave',hideTip);
  bars.append('rect').attr('x',m=>x(idxOf(parseDate(m.start)))).attr('y',m=>ys[m.activity]+laneOf[m.id]*lh).attr('height',lh-3).attr('rx',6)
    .attr('width',m=>Math.max(6,x(m.end?idxOf(parseDate(m.end)):NM)-x(idxOf(parseDate(m.start))))).attr('fill',m=>WRITER[m.writer].c).attr('opacity',.9);
  bars.append('text').attr('x',m=>x(idxOf(parseDate(m.start)))+6).attr('y',m=>ys[m.activity]+laneOf[m.id]*lh+14).attr('font-size',10.5).attr('fill','#0f1115').attr('font-weight',600)
    .text(m=>`審：${REVIEWER[m.reviewer]}｜${m.name_zh}`).each(function(m){const wpx=x(m.end?idxOf(parseDate(m.end)):NM)-x(idxOf(parseDate(m.start)))-10;let t=d3.select(this).text();while(this.getComputedTextLength()>wpx&&t.length>2){t=t.slice(0,-1);d3.select(this).text(t+'…')}if(wpx<24)d3.select(this).text('')});
  const cur=svg.append('line').attr('y1',mt-8).attr('y2',h).attr('stroke','#fff').attr('stroke-width',2);
  const upd=()=>cur.attr('x1',x(TC.i)).attr('x2',x(TC.i));
  cursorControl(root,upd);
},true);

slide('fortress','堡壘攻防：人類守住了什麼',`<div class="kicker">TOPIC · THE FORTRESS</div><h2>寫程式、審程式、測試：人類的防線退到哪裡</h2>${EDIT_NOTE}
<div class="toolbar" id="tb-fort"></div><div id="fort"></div>`,
(root)=>{
  const tb=$('#tb-fort',root),el=$('#fort',root);let cur=T.handoffs[0].activity;
  function draw(){
    tb.innerHTML='';T.handoffs.forEach(h=>{const b=document.createElement('button');b.textContent=h.title_zh;b.classList.toggle('on',h.activity===cur);b.onclick=()=>{cur=h.activity;draw()};tb.appendChild(b)});
    const h=T.handoffs.find(x=>x.activity===cur);
    el.innerHTML=`<div class="card" style="margin:.6rem 0"><h3>${esc(h.title_zh)}</h3><p class="zh" style="line-height:1.8">${esc(h.story_zh)}</p></div>
    <div class="tl" style="max-width:820px">${h.timeline.map((t,i)=>`<div class="tl-item ${i%2?'right':'left'}" style="--c:${SCORE_COLOR[Math.min(4,1+Math.floor(i*3/Math.max(1,h.timeline.length-1)))]}"><div class="tl-card" style="cursor:default"><div class="meta"><b>${esc(t.date)}</b></div><div class="zh">${esc(t.event_zh)}</div><ul class="evl">${evList(t.evidence)}</ul></div></div>`).join('')}</div>
    <div class="card" style="margin:1rem 0"><h3>反方證據與分歧</h3><ul class="evl">${(T.meta.disagreements_zh||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`;
    el.addEventListener('click',ev=>{const a=ev.target.closest('a.ev');if(!a)return;ev.preventDefault();
      if(a.dataset.e){const e=ALL.find(x=>x.id===a.dataset.e);if(e)showEntry(e)}else if(a.dataset.m){const m=RELEASES.find(x=>x.id===a.dataset.m);if(m)openDrawer(`<h2>${esc(m.name)}</h2>`+modelCard(m),true)}},{once:true});
  }
  draw();
},true);
}

// ---------- group pages + person profile pages ----------
const PROFILES=DATA.profiles||{};
const GROUP_INTRO={
 '經典軟體工程大老':'定義了現代軟體開發的方法、語言、作業系統與工具的人。他們的說法之所以重要，是因為整個產業的工作方式，很大程度上就是他們過去幾十年定下來的。',
 'AI 實驗室與研究員':'打造最前沿模型、或負責替大眾定調「AI 能做什麼」的人。他們最清楚模型的能力邊界，但也身處商業與研究的競爭之中。',
 '科技公司領袖':'掌握開發者平台、雲端與 AI 產品的公司決策者。他們的說法直接影響招募、投資與工具採用，同時也帶有明確的商業利益。',
 '創辦人與新創圈':'直接販售 AI 開發工具或平台的創辦人與投資人。他們離開發者最近，也最有動機讓大家相信「軟體開發正在改變」。',
 'AI 預測團隊與網站':'以資料、情境與預測市場，系統性地推估 AI 何時能做到什麼的團隊與網站。他們的預測本身，也隨時間被修訂。',
 '使用者自己的帳號':'本調查作者自己的帳號，作為對照組。'};
const pinfo=slug=>{const p=PEOPLE.find(x=>x.slug===slug);return {p,pr:PROFILES[slug]}};
const initials=n=>n.replace(/[（(].*/,'').trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
function personSeries(p){return ALL.filter(e=>e.slug===p.slug&&clv(e)!=null).sort((a,b)=>a._d-b._d)}
function miniSpark(p){
  const es=personSeries(p);if(es.length<1)return '<div class="mini-empty">尚無退守評分</div>';
  const W=150,H=34,x0=+dmin,x1=+new Date(dmax.getFullYear()+1,0,1);
  const X=d=>4+(+d-x0)/(x1-x0)*(W-8),Y=v=>H-4-v/4*(H-8);
  return `<svg viewBox="0 0 ${W} ${H}" class="spark">${es.length>1?`<path d="${es.map((e,i)=>(i?'L':'M')+X(e._d).toFixed(1)+','+Y(clv(e)).toFixed(1)).join(' ')}" fill="none" stroke="#ffffff55" stroke-width="1.3"/>`:''}${es.map(e=>`<circle cx="${X(e._d).toFixed(1)}" cy="${Y(clv(e)).toFixed(1)}" r="2.6" fill="${ec(e)}"/>`).join('')}</svg>`}
groups.filter(g=>g!=='使用者自己的帳號').forEach(g=>{
  slide('grp'+groups.indexOf(g),g,`<div class="kicker">PEOPLE · ${esc(g)}</div><h2>${esc(g)}</h2><p class="lead" style="margin:0 0 .8rem">${esc(GROUP_INTRO[g]||'')}</p><div class="grid cards pcards"></div>`,
  (root)=>{
    const ps=PEOPLE.filter(p=>p.group===g).sort((a,b)=>b.entries.length-a.entries.length);
    root.querySelector('.pcards').innerHTML=ps.map(p=>{const pr=PROFILES[p.slug]||{};const es=personSeries(p);const last=es[es.length-1];
      return `<div class="card click pcard" data-slug="${esc(p.slug)}"><div class="pc-head"><div class="avatar">${esc(initials(p.name))}</div><div><h3>${esc(pr.name||p.name)}</h3><div class="ptag">${esc(pr.tagline_zh||p.profile_zh||'')}</div></div></div>
      ${miniSpark(p)}<div class="pmeta">${p.entries.length} 則發言${last?`　最新退守程度 <b style="color:${ec(last)}">${clv(last)} 級</b>`:''}</div><div class="pimp">${esc((pr.importance_zh||'').slice(0,90))}${(pr.importance_zh||'').length>90?'…':''}</div><div class="plink">看個人介紹頁 →</div></div>`}).join('');
    root.querySelectorAll('.pcard').forEach(c=>c.onclick=()=>openProfile(c.dataset.slug));
  },true);
});

const profEl=document.createElement('section');profEl.id='profile';profEl.hidden=true;document.body.appendChild(profEl);
let profBack=null;
// ---------- AI 2027 prediction curve (for accuracy comparison) ----------
const A27=ALL.filter(e=>e.slug==='ai-futures-project'&&e.date==='2025-04-03'&&e._h&&clv(e)!=null).sort((a,b)=>a._h-b._h);
const A27REV=ALL.filter(e=>e.slug==='ai-futures-project'&&e.date>'2025-04-03'&&e._h&&e.kind==='prediction'&&clv(e)!=null).sort((a,b)=>a._d-b._d);
const shortTopic=t=>(t||'').replace(/^AI 2027 情境：/,'').replace(/^AI 2027 原版：/,'');
function a27At(d){let lv=null;A27.forEach(e=>{if(+e._h<=+d)lv=clv(e)});return lv}
function a27Compare(ser){
  const pts=ser.filter(e=>(e.concession&&e.concession.kind!=='predicted')&&+e._d>=+new Date(2025,6,1)&&a27At(e._d)!=null);
  if(!pts.length)return '';
  const diff=d3.mean(pts,e=>clv(e)-a27At(e._d));
  const w=Math.abs(diff)<0.25?'和 AI 2027 的預測大致同步':diff>0?`比 AI 2027 預測的進度<b>超前</b>約 ${diff.toFixed(1)} 級`:`比 AI 2027 預測的進度<b>落後</b>約 ${(-diff).toFixed(1)} 級`;
  return `<p class="mute">對照：他在 2025 年 7 月之後描述「現況」的 ${pts.length} 則發言，平均${w}（以光譜位置比較；AI 2027 曲線是它對當時狀態的預測）。</p>`}
function personChart(host,ser,opt){
  opt=opt||{};
  const w=Math.max(360,host.clientWidth||860),h=opt.h||300,m={t:34,r:16,b:30,l:70};
  const svg=d3.select(host).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('height',h);
  const x0=ser.length?Math.min(+ser[0]._d,+new Date(2023,0,1)):+new Date(2023,0,1);
  const x=d3.scaleTime().domain([new Date(x0),new Date(2028,0,1)]).range([m.l,w-m.r]),y=d3.scaleLinear().domain([-0.3,4.3]).range([h-m.b,m.t]);
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${h-m.b})`).call(d3.axisBottom(x).ticks(8));
  svg.append('g').attr('class','axis').attr('transform',`translate(${m.l},0)`).call(d3.axisLeft(y).tickValues([0,1,2,3,4]).tickFormat(v=>({0:'0 全手動',4:'4 全自動'}[v]||v)));
  [0,1,2,3,4].forEach(v=>svg.append('line').attr('class','grid-line').attr('x1',m.l).attr('x2',w-m.r).attr('y1',y(v)).attr('y2',y(v)));
  RELEASES.filter(r=>r.importance>=3&&(r.kind==='model'?MS.showM:MS.showT)).forEach(r=>svg.append('line').attr('x1',x(r._d)).attr('x2',x(r._d)).attr('y1',m.t).attr('y2',h-m.b).attr('stroke',vc(r.vendor)).attr('opacity',.18));
  // today
  const tx=x(new Date());svg.append('line').attr('x1',tx).attr('x2',tx).attr('y1',m.t-6).attr('y2',h-m.b).attr('stroke','#e8e6e3').attr('stroke-dasharray','2 3').attr('opacity',.6);
  svg.append('text').attr('x',tx-3).attr('y',h-m.b-6).attr('text-anchor','end').attr('font-size',10).attr('fill','#e8e6e3').text('今天');
  if(opt.ai2027!==false&&A27.length){
    // AI 2027 predicted curve: from publication (2025-04) step through milestones
    const pts=[[new Date(2025,3,3),A27[0]?clv(A27[0]):2]];A27.forEach(e=>pts.push([e._h,clv(e)]));pts.push([new Date(2028,0,1),clv(A27[A27.length-1])]);
    svg.append('path').attr('fill','none').attr('stroke','#f5b942').attr('stroke-width',2.2).attr('stroke-dasharray','6 4').attr('opacity',.9)
      .attr('d',d3.line().curve(d3.curveStepAfter).x(p=>x(p[0])).y(p=>y(p[1]))(pts));
    const seen=new Set();
    A27.forEach((e,i)=>{const k=+e._h;const X=x(e._h);
      svg.append('line').attr('x1',X).attr('x2',X).attr('y1',m.t-4).attr('y2',h-m.b).attr('stroke','#f5b942').attr('opacity',.35);
      svg.append('rect').attr('x',X-5).attr('y',y(clv(e))-5).attr('width',10).attr('height',10).attr('transform',`rotate(45 ${X} ${y(clv(e))})`).attr('fill','#0f1115').attr('stroke','#f5b942').attr('stroke-width',2).attr('class','pt')
        .on('mousemove',ev=>showTip(`<b style="color:#f5b942">AI 2027 預測（2025-04 發表）</b><br>${esc(e.horizon)}：${esc(shortTopic(e.topic))}`,ev)).on('mouseleave',hideTip).on('click',()=>{hideTip();showEntry(e)});
      if(!seen.has(k)){seen.add(k);svg.append('text').attr('x',X+3).attr('y',m.t-22+(seen.size%3)*9).attr('font-size',9.5).attr('fill','#f5b942').text('AI 2027：'+String(e.horizon).replace(/ .*/,''))}});
    A27REV.forEach(e=>{if(+e._h>+new Date(2028,0,1))return;const X=x(e._h);
      svg.append('path').attr('d',d3.symbol(d3.symbolDiamond,70)()).attr('transform',`translate(${X},${y(4)})`).attr('fill','none').attr('stroke','#f97316').attr('stroke-width',1.5).attr('class','pt')
        .on('mousemove',ev=>showTip(`<b style="color:#f97316">AI Futures 之後的修訂（${esc(e.date)} 發表）</b><br>預測時間：${esc(e.horizon)}<br>${esc(shortTopic(e.topic))}`,ev)).on('mouseleave',hideTip).on('click',()=>{hideTip();showEntry(e)})});
  }
  if(!ser.length){svg.append('text').attr('x',(m.l+w)/2).attr('y',h/2).attr('text-anchor','middle').attr('fill','#9aa3b2').text('這位人物沒有可評分的發言');return}
  const serP=ser.filter(e=>e.kind==='present');const offT=e=>{const r=REG[`${e.slug}|concession|${e.id}`];return r&&r.verdict==='topic'};const serL=serP.filter(e=>!offT(e));
  if(serL.length>1&&!opt.noLine)svg.append('path').datum(serL).attr('fill','none').attr('stroke','#ffffff66').attr('stroke-width',1.6).attr('d',d3.line().x(e=>x(e._d)).y(e=>y(clv(e))).curve(d3.curveMonotoneX));
  if(opt.median){const q=d3.rollups(ser,v=>d3.median(v,clv),e=>new Date(e._d.getFullYear(),Math.floor(e._d.getMonth()/3)*3+1,15)).sort((a,b)=>a[0]-b[0]);
    svg.append('path').datum(q).attr('fill','none').attr('stroke','#fff').attr('stroke-width',3).attr('d',d3.line().x(d=>x(d[0])).y(d=>y(d[1])).curve(d3.curveMonotoneX));
    q.forEach(d=>svg.append('circle').attr('cx',x(d[0])).attr('cy',y(d[1])).attr('r',3.5).attr('fill','#fff'))}
  svg.selectAll('path.ppd').data(ser.filter(e=>e.kind!=='present')).join('path').attr('class','ppd pt').attr('d',d3.symbol(d3.symbolDiamond,(opt.r||7)*(opt.r||7)*3.2)()).attr('transform',e=>`translate(${x(e._d)},${y(clv(e))})`).attr('fill',e=>e.verified?ec(e):'var(--bg)').attr('stroke',e=>ec(e)).attr('stroke-width',2).attr('opacity',opt.median?.75:1)
    .on('mousemove',(ev,d)=>showTip('<b>預言</b>（以說出口的日期標示）<br>'+entryTip(d),ev)).on('mouseleave',hideTip).on('click',(ev,d)=>{hideTip();showEntry(d)});
  dotAttrs(svg.selectAll('circle.pp').data(serP).join('circle').attr('class','pp').attr('cx',e=>x(e._d)).attr('cy',e=>y(clv(e))),ec).attr('r',opt.r||7).attr('opacity',e=>offT(e)?.35:(opt.median?.75:1));
}
const A27LEGEND='<div class="legend" style="margin:.3rem 0"><span><i class="dot" style="background:#f5b942"></i>橘色虛線與方塊＝AI 2027（2025-04 發表）預測各時間點會到達的光譜位置</span><span style="color:#f97316">◇ 空心菱形＝AI Futures 之後修訂的「自動化程式設計師」預測時間</span><span>● 圓點＝描述現況的說法，以線相連（顏色＝退守程度）；在橘線上方＝比 AI 2027 預測更快，下方＝更慢</span><span>◆ 實心菱形＝預言，以說出口的日期標示，不和現況連線，也不拿來判斷倒退</span><span>淡色圓點＝這句談的是別的事（沒有表態 AI 能做到多少），不連進線</span></div>';

const MK_DEF=[['tool','■ 開發工具上市'],['a27','🔶 AI 2027 預測會在這時發生的事'],['model','◆ AI 模型上市'],['architecture','▲ 架構'],['protocol','＋ 協定'],['rev','◇ AI Futures 之後修訂的預測']];
const MK={tool:true,a27:true,model:false,architecture:false,protocol:false,rev:false};
try{Object.assign(MK,JSON.parse(localStorage.getItem('mkToggles')||'{}'))}catch(e){}
const mkClasses=()=>Object.keys(MK).filter(k=>!MK[k]).map(k=>'hide-'+k).join(' ');
const mkToggles=()=>`<div class="mktog"><span class="fl">時間線上的標記（點擊開關）：</span>${MK_DEF.map(([k,t])=>`<button data-mk="${k}" class="${MK[k]?'on':''}">${t}</button>`).join('')}</div>`;
function applyMk(){document.querySelectorAll('.tl.pl').forEach(el=>{MK_DEF.forEach(([k])=>el.classList.toggle('hide-'+k,!MK[k]))});
  document.querySelectorAll('.mktog button').forEach(b=>b.classList.toggle('on',!!MK[b.dataset.mk]));try{localStorage.setItem('mkToggles',JSON.stringify(MK))}catch(e){}}
function personTimelineHtml(shown){
  const items=shown.map(e=>({t:+e._d,e}));
  if(!items.length)return '';
  const lo=Math.min(d3.min(items,i=>i.t),+new Date(2023,0,1)),hi=+new Date();
  RELEASES.filter(r=>+r._d>=lo&&+r._d<=hi).forEach(r=>items.push({t:+r._d,r}));
  A27.forEach(e=>items.push({t:+e._h,a:e}));
  A27REV.forEach(e=>items.push({t:+e._d,v:e}));
  const p27=PUBS.find(p=>p.id==='pub-ai2027');if(p27)items.push({t:+p27._d,p:p27});
  items.sort((a,b)=>a.t-b.t||(a.e?1:0)-(b.e?1:0));
  let side=0,lastY=null,html='';
  items.forEach(x=>{
    const y=new Date(x.t).getFullYear();
    if(y!==lastY){lastY=y;html+=`<div class="tl-node"><button>${y}</button></div>`}
    if(x.e){html+=quoteItem(x.e,'present',(side++%2)?'right':'left');return}
    if(x.r){const r=x.r;html+=`<div class="tl-rel mk-${r.kind}" data-m="${esc(r.id)}" style="--c:${vc(r.vendor)}">${r.kind==='model'?'◆':r.kind==='tool'?'■':r.kind==='architecture'?'▲':'＋'} ${esc(r.date)}　${esc(r.vendor)} · ${esc(r.name)}</div>`;return}
    if(x.a){html+=`<div class="tl-a27 mk-a27" data-e="${esc(x.a.id)}">🔶 AI 2027 預測（2025-04 發表）：<b>${esc(x.a.horizon)}</b>　${esc(shortTopic(x.a.topic))}</div>`;return}
    if(x.v){html+=`<div class="tl-a27 rev mk-rev" data-e="${esc(x.v.id)}">◇ ${esc(x.v.date)} AI Futures 修訂：${esc(shortTopic(x.v.topic))} → <b>${esc(x.v.horizon)}</b></div>`;return}
    if(x.p){html+=`<div class="tl-a27 pub mk-a27" data-e="${esc(x.p.entry_ids[0]||'')}">📄 2025-04-03　AI 2027 網站發布</div>`;return}
  });
  return html;
}
function regressHtml(p,ser){
  const pres=ser.filter(e=>e.kind==='present'),nPred=ser.length-pres.length;
  if(!pres.length)return nPred?`<p class="mute">這位只有預言（${nPred} 則，用菱形標示），沒有描述現況的發言，所以不判斷進退。</p>`:'';
  const f=pres[0],l=pres[pres.length-1];
  let h=`<p class="mute"><b>只比較描述現況的發言：</b>`+(f!==l?`從 ${esc(f.date)} 的 <b style="color:${ec(f)}">${clv(f)} 級</b> 到 ${esc(l.date)} 的 <b style="color:${ec(l)}">${clv(l)} 級</b>（${clv(l)>clv(f)?'往全自動方向退守':clv(l)<clv(f)?'往手動方向回擺':'沒有明顯變化'}）。`:`只有 1 則描述現況的發言。`)+(nPred?`另有 ${nPred} 則預言，用菱形標示，不和現況比較。`:'')+`</p>`;
  const drops=[];for(let i=1;i<pres.length;i++)if(clv(pres[i])<clv(pres[i-1])-0.01){const r=REG[`${p.slug}|concession|${pres[i].id}`];drops.push({a:pres[i-1],b:pres[i],r})}
  if(drops.length){const cnt={};drops.forEach(d=>{const k=d.r?d.r.verdict:'none';cnt[k]=(cnt[k]||0)+1});
    const real=(cnt.real||0);
    h+=`<details class="regchk"><summary>倒退檢查：描述現況的發言之間有 ${drops.length} 次分數下降，逐一檢查後${real?`有 <b class="warn">${real} 次是真的倒退</b>`:'<b>沒有真的倒退</b>'}（${Object.entries(cnt).map(([k,v])=>`${REGV[k]||'未分類'} ${v}`).join('、')}）</summary><ul>`+
      drops.map(d=>`<li><b>${esc(d.a.date)} ${clv(d.a)} 級 → ${esc(d.b.date)} ${clv(d.b)} 級</b>　<span class="tag rv-${d.r?d.r.verdict:'none'}">${d.r?REGV[d.r.verdict]:'未分類'}</span>　${d.r?esc(d.r.note_zh):''}</li>`).join('')+`</ul></details>`}
  return h}
function profileHtml(slug,inSlide){
  const {p,pr}=pinfo(slug);if(!p)return '';
  const prf=pr||{};const es=p.entries.map(x=>ALL.find(a=>a.id===x.id)||x).slice().sort((a,b)=>a.date<b.date?-1:1);
  const shown=es.filter(e=>FILTER.rel==='all'||relOf(e)!=='offtopic');
  const ser=personSeries(p);const first=ser[0],last=ser[ser.length-1];
  const L=prf.links||{};const linkHtml=[['website','網站'],['wikipedia','Wikipedia'],['blog','部落格'],['x','X'],['github','GitHub']].filter(([k])=>L[k]).map(([k,t])=>`<a href="${esc(L[k])}" target="_blank" rel="noopener">${t}</a>`).join(' · ');
  return `<div class="prof-inner${inSlide?' inslide':''}">${inSlide?'':`<button class="pback">← 回到簡報</button>`}
  <div class="prof-head"><div class="avatar big">${esc(initials(p.name))}</div><div><div class="kicker">${esc(p.group)}${prf.kind&&prf.kind!=='person'?' · '+esc(prf.kind==='team'?'團隊':'網站／機構'):''}</div><h1>${esc(prf.name||p.name)}${prf.name_zh&&prf.name_zh!==(prf.name||p.name)?` <small>${esc(prf.name_zh)}</small>`:''}</h1>
  <p class="tag1">${esc(prf.tagline_zh||p.profile_zh||'')}</p>${homeLink(prf)}${(prf.roles||[]).length?`<div class="roles">${prf.roles.map(r=>`<span class="tag">${esc(r)}</span>`).join('')}</div>`:''}<div class="plinks">${linkHtml}</div></div></div>
  <div class="psec"><h3>他的流程：承認 AI 攻下多少，以及 AI 2027 當初怎麼預測</h3>${stanceLegend()}${A27LEGEND}<div class="chart pchart"></div>
  ${regressHtml(p,ser)}${a27Compare(ser)}</div>
  <div class="pgrid"><div>
  ${prf.importance_zh?`<div class="psec"><h3>在領域內為什麼重要</h3><p>${esc(prf.importance_zh)}</p></div>`:'<div class="psec"><p class="mute">這位人物的背景資料尚未整理（或未能查證）。</p></div>'}
  ${prf.role_in_debate_zh?`<div class="psec"><h3>在這場討論中的角色</h3><p>${esc(prf.role_in_debate_zh)}</p></div>`:''}
  </div><div>${(prf.known_for||[]).length?`<div class="psec"><h3>代表事蹟</h3><ul class="kf">${prf.known_for.map(k=>`<li>${k.year?`<b>${esc(k.year)}</b>　`:''}${esc(k.text_zh)}${k.source_url?` <a href="${esc(k.source_url)}" target="_blank" rel="noopener">來源</a>`:''}</li>`).join('')}</ul></div>`:''}</div></div>
  ${(prf.verified===false||prf.note)?`<div class="psec"><p class="mute">資料備註：${esc(prf.note||'部分背景資料未完全查證')}</p></div>`:''}
  <div class="psec"><h3>他的發言（${shown.length} 則，依時間）</h3>${mkToggles()}<div class="tl pl ${mkClasses()}">${personTimelineHtml(shown)}</div></div></div>`;
}
function wireProfile(root,slug){
  const {p}=pinfo(slug);if(!p)return;
  root.querySelectorAll('.tl-card').forEach(c=>{const d=c.querySelector('[data-detail]');if(d)d.onclick=ev=>{ev.preventDefault();ev.stopPropagation();showEntry(ALL.find(e=>e.id===c.dataset.id))};
    const m=c.querySelector('[data-more]');if(m)m.onclick=ev=>{ev.preventDefault();ev.stopPropagation();c.classList.toggle('open');m.textContent=c.classList.contains('open')?'收合':'展開全文'}});
  root.querySelectorAll('.tl-rel').forEach(c=>c.onclick=()=>{const m=RELEASES.find(x=>x.id===c.dataset.m);if(m)openDrawer(`<h2>${esc(m.name)}</h2>`+modelCard(m),true)});
  root.querySelectorAll('.tl-a27').forEach(c=>c.onclick=()=>{const e=ALL.find(x=>x.id===c.dataset.e);if(e)showEntry(e)});
  root.querySelectorAll('.mktog button').forEach(b=>b.onclick=()=>{MK[b.dataset.mk]=!MK[b.dataset.mk];applyMk()});
  const host=root.querySelector('.pchart');host.innerHTML='';personChart(host,personSeries(p));
}
function openProfile(slug,fromHash){
  const i=slides.findIndex(s=>s.id==='p-'+slug);
  if(i>=0&&!fromHash){go(i);return}
  profEl.innerHTML=profileHtml(slug,false);if(!profEl.innerHTML)return;
  profEl.hidden=false;profEl.scrollTop=0;document.body.classList.add('inprofile');
  profEl.querySelector('.pback').onclick=()=>closeProfile();
  wireProfile(profEl,slug);
  if(!fromHash)history.replaceState(null,'','#person/'+slug);
}
function closeProfile(){profEl.hidden=true;document.body.classList.remove('inprofile');history.replaceState(null,'','#'+slides[cur].id);closeDrawer()}

slide('own','我自己的聲音',`<div class="kicker">MY OWN VOICE · 郭佳甯／卡米哥</div><h2>我在同一段時間裡怎麼說</h2>
<p class="lead" style="margin:0 0 .6rem">來源：Medium @etrexkuo、Facebook 匯出檔中的留言、瀏覽器擴充功能收集的個人頁貼文（2024-09 起）與分享到個人頁的卡米哥貼文；附圖也一併看過並附在條目上。</p>
<div class="toolbar" id="tb-own"></div><div class="chart" id="c-own"></div><div id="own-list"></div>`,
(root)=>{
  const own=ALL.filter(e=>e.group==='使用者自己的帳號');
  if(!own.length){$('#c-own',root).innerHTML='<div class="pending">尚無資料。</div>';return}
  const ppl=sortedPeople.filter(p=>p.group==='使用者自己的帳號');
  swimlane($('#c-own',root),$('#tb-own',root),own.map(e=>e),e=>e._d,{id:'own',domain:[new Date(2025,0,1),new Date(2026,0,15)]});
  $('#own-list',root).innerHTML=stanceLegend()+own.map(entryCard).join('');
},true);

slide('teams','預測團隊與網站',`<div class="kicker">FORECASTING TEAMS · AI 2027 &amp; AFTER</div><h2>預測網站與它們的修訂</h2>
<p class="lead" style="margin:0 0 .6rem">AI 2027 等團隊隨時間修訂他們的預測。上圖：橫軸＝發表時間、縱軸＝預測的目標時間（不同里程碑混在一起，點開看細節）。下方：每一次修訂的完整紀錄。</p><div class="toolbar" id="tb-tm"></div><div class="chart" id="c-tm" style="margin-bottom:1rem"></div><div id="teams"></div>`,
(root)=>{
  const ps=PEOPLE.filter(p=>p.group==='AI 預測團隊與網站');
  const el=$('#teams',root);
  if(!ps.length){el.innerHTML='<div class="pending">研究進行中，資料抵達後會自動出現在這裡。</div>';return}
  const tp=ALL.filter(e=>e.group==='AI 預測團隊與網站'&&e.kind==='prediction'&&e._h);
  if(tp.length)scatter(root,'#c-tm','#tb-tm',tp);else $('#c-tm',root).innerHTML='';
  el.innerHTML=ps.map(p=>`<h3 style="color:var(--accent)">${esc(p.name)}</h3><p style="color:var(--mute)">${esc(p.profile_zh||'')}</p>`+p.entries.map(entryCard).join('')).join('');
},true);

slide('sources','來源索引',`<div class="kicker">SOURCES</div><h2>所有發言與來源網址</h2>
<div class="toolbar"><input type="search" id="q" placeholder="搜尋人名、關鍵字…"><button data-f="all" class="on">全部</button><button data-f="present">現況</button><button data-f="prediction">預言</button><button data-f="unver">未完全查證</button></div>
<div class="chart" style="overflow:auto;max-height:calc(100vh - 250px)"><table><thead><tr><th data-k="date">日期</th><th data-k="person">人物</th><th>類型</th><th>摘要</th><th>來源</th></tr></thead><tbody id="src-body"></tbody></table></div>`,
(root)=>{
  let f='all',q='',key='date',dir=1;
  const body=$('#src-body',root);
  function draw(){
    const rows=ALL.filter(e=>(f==='all'||(f==='unver'?!e.verified:e.kind===f))&&(!q||(e.person+e.summary_zh+e.quote_original+e.topic).toLowerCase().includes(q))).sort((a,b)=>(a[key]>b[key]?1:-1)*dir);
    body.innerHTML=rows.map((e,i)=>`<tr><td style="white-space:nowrap">${esc(e.date)}</td><td>${esc(e.person)}</td><td>${e.kind==='prediction'?'預言':'現況'}${e.verified?'':' <span class="tag warn">未</span>'}</td>
      <td><a href="#" data-i="${ALL.indexOf(e)}" class="ent">${esc(e.summary_zh)}</a></td><td>${e.source_url?`<a href="${esc(e.source_url)}" target="_blank" rel="noopener">${esc((e.source_title||e.source_url).slice(0,50))}</a>`:esc((e.source_title||'').slice(0,50))}</td></tr>`).join('');
    body.querySelectorAll('.ent').forEach(a=>a.onclick=ev=>{ev.preventDefault();showEntry(ALL[+a.dataset.i])});
  }
  $('#q',root).oninput=ev=>{q=ev.target.value.toLowerCase();draw()};
  root.querySelectorAll('.toolbar button').forEach(b=>b.onclick=()=>{f=b.dataset.f;root.querySelectorAll('.toolbar button').forEach(x=>x.classList.toggle('on',x===b));draw()});
  root.querySelectorAll('th[data-k]').forEach(th=>th.onclick=()=>{key===th.dataset.k?dir*=-1:(key=th.dataset.k,dir=1);draw()});
  draw();
});

slide('todo','目前的限制與待補',`<div class="kicker">LIMITS</div><h2>這份調查還缺什麼</h2>
<div class="grid cards">
<div class="card"><h3>查證程度</h3><p>「已查證」只代表在能讀取的頁面上找得到引述；很多來源（CNBC、Fortune 等）擋機器讀取，尚未逐字比對原始逐字稿。</p></div>
<div class="card"><h3>時間覆蓋不均</h3><p>2023–2024 的發言明顯比 2025 之後少，「觀點如何改變」在早期的弧線偏薄。</p></div>
<div class="card"><h3>來源預覽圖</h3><p>${ALL.filter(e=>e.og_image).length}／${ALL.length} 則發言附來源預覽圖（og:image，與 Slack／Notion 連結預覽相同），圖片版權屬原網站；其餘請點來源網址或存檔連結。</p></div>
<div class="card"><h3>Facebook</h3><p>作者的個人帳號已透過 Facebook 匯出檔和瀏覽器擴充功能收錄（2023 起）；粉絲專頁本身沒有另外收集，只收錄分享到個人帳號的貼文；沒有日期的貼文未收錄，部分貼文只抓到「查看更多」前的內容。</p></div>
<div class="card"><h3>退守程度、流程階段與攻破程度</h3><p>每則發言的退守程度（0 到 4 級）、各流程的 S1–S5 階段（含 Code review 的「推論」格），以及 SDLC 各階段的「攻破程度」（0 到 4 級）都是編輯判斷，不是本人說的、也不是量測值，僅供比較與討論。</p></div>
</div>`);


// ---------- data sources slide ----------
function srcType(e){const u=(e.source_url||'').toLowerCase();
  if(!u||u.includes('facebook.com'))return 'Facebook（作者自己的帳號）';
  if(/(^https?:\/\/)?(www\.)?(x|twitter)\.com/.test(u.replace(/^https?:\/\//,'')))return 'X（Twitter）貼文';
  if(u.includes('youtube.com')||u.includes('youtu.be'))return 'YouTube 影片';
  if(/lexfridman|dwarkesh|transcript|podcast|sequoiacap|latent\.space|20vc|pragmaticengineer|stratechery|youtube/.test(u))return '訪談／Podcast 逐字稿';
  if(/medium\.com|substack|simonwillison|martinfowler|world\.hey|kentbeck|yegge|addyosmani|antirez|charity\.wtf|paulgraham|blog|newsletter|lesswrong|ai-2027|aifutures|metr\.org|epoch\.ai|situational-awareness|normaltech|futuresearch|theaidigest/.test(u))return '部落格／電子報／官方網站';
  if(/techcrunch|fortune|cnbc|theregister|businessinsider|bloomberg|reuters|axios|wired|time\.com|semafor|itpro|entrepreneur|officechai|thenewstack|geekwire|venturebeat|theverge|benzinga|yahoo|capacity|techloy|storyboard18|sfstandard|dataconomy|observenow|cnbctv|ciodive|bitcot|singjupost|myustimes|entechonline|slashdot/.test(u))return '新聞報導（二手）';
  return '其他網站';}
slide('datasrc','資料來源',`<div class="kicker">DATA SOURCES</div><h2>這份調查的資料從哪裡來</h2><div id="ds"></div>`,(root)=>{
  const rows=d3.rollups(ALL,v=>v.length,srcType).sort((a,b)=>b[1]-a[1]);const max=d3.max(rows,r=>r[1]);
  const nShot=ALL.filter(e=>e.og_image).length,nVer=ALL.filter(e=>e.verified).length,nCore=ALL.filter(e=>relOf(e)==='core').length;
  const ppl=PEOPLE.filter(p=>p.group!=='AI 預測團隊與網站').length,fc=PEOPLE.filter(p=>p.group==='AI 預測團隊與網站').length;
  root.querySelector('#ds').innerHTML=`<div class="grid cards" style="margin-bottom:1rem">
  <div class="card"><div class="stat">${ppl}<small>位人物（含作者自己）</small></div></div>
  <div class="card"><div class="stat">${fc}<small>個預測團隊／網站</small></div></div>
  <div class="card"><div class="stat">${ALL.length}<small>則發言，其中 ${nCore} 則直接談 AI 能不能做開發</small></div></div>
  <div class="card"><div class="stat">${Math.round(100*nVer/ALL.length)}%<small>已查證（Claude Code 打開來源核對引文，非人工審查）</small></div></div>
  <div class="card"><div class="stat">${Math.round(100*nShot/ALL.length)}%<small>附來源預覽圖</small></div></div>
  <div class="card"><div class="stat">${MODELS.length}＋${TOOLS.length}<small>個模型＋軟體／架構發佈點</small></div></div></div>
  <div class="two"><div class="card"><h3>來源類型</h3>${rows.map(([k,n])=>`<div class="srow"><span>${esc(k)}</span><i style="width:${Math.round(100*n/max)}%"></i><b>${n}</b></div>`).join('')}</div>
  <div class="card"><h3>怎麼收集與判讀</h3><ul class="kf" style="font-size:.9rem">
  <li>每則發言都保留<b>原文逐字引述</b>、繁中翻譯、日期與來源網址；能截圖的都截圖，X 貼文以公開嵌入資料重建卡片（圖上標示）。</li>
  <li>期間：2023 年至今；人物依「軟體開發大佬／模型大師／新創與其他」分組，另有預測網站。</li>
  <li>作者自己的資料：Medium、Facebook 匯出檔留言、瀏覽器擴充功能收集的貼文與附圖。</li>
  <li>只保留談「AI 能／不能／如何做開發相關的事」的發言；談模型進步、AGI、AI 研發加速的另外標為無關。</li>
  <li><b>退守程度</b>（全手動 0 → 全自動 4 的光譜位置）是編輯判斷，每則都附理由與信心。</li>
  <li>模型與工具發佈日對照官方公告；部分 OpenAI 頁面擋機器讀取，標為未完全查證。</li></ul></div></div>`;
});

// ---------- forecast sites ----------
function predArrows(host,entries,opt){
  opt=opt||{};const es=entries.filter(e=>e._h).sort((a,b)=>a._d-b._d||a._h-b._h);
  if(!es.length){host.innerHTML='<div class="pending">沒有帶預測時間的說法。</div>';return}
  const w=Math.max(360,host.clientWidth||860),rh=26,m={t:26,r:150,b:28,l:16},h=m.t+es.length*rh+m.b;
  const xmax=d3.max(es,e=>+e._h);const dom=[new Date(Math.min(d3.min(es,e=>+e._d),+new Date(2024,0,1))),new Date(Math.max(xmax,+new Date(2028,0,1))+1000*3600*24*120)];
  const x=d3.scaleTime().domain(dom).range([m.l,w-m.r]);
  const svg=d3.select(host).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('height',h);
  svg.append('g').attr('class','axis').attr('transform',`translate(0,${h-m.b})`).call(d3.axisBottom(x).ticks(8));
  svg.append('defs').append('marker').attr('id','arr').attr('viewBox','0 0 10 10').attr('refX',8).attr('refY',5).attr('markerWidth',7).attr('markerHeight',7).attr('orient','auto').append('path').attr('d','M0,0L10,5L0,10z').attr('fill','#f5b942');
  const tx=x(new Date());svg.append('line').attr('x1',tx).attr('x2',tx).attr('y1',m.t-10).attr('y2',h-m.b).attr('stroke','#e8e6e3').attr('stroke-dasharray','2 3');
  svg.append('text').attr('x',tx+3).attr('y',m.t-12).attr('font-size',10).attr('fill','#e8e6e3').text('今天');
  es.forEach((e,i)=>{const Y=m.t+i*rh+rh/2;const off=relOf(e)==='offtopic';
    const g=svg.append('g').style('cursor','pointer').on('click',()=>showEntry(e)).on('mousemove',ev=>showTip(`<b>${esc(e.person)}</b><br>${esc(e.date)} 發表 → 預測 ${esc(e.horizon)}<br>${esc((e.quote_zh||'').slice(0,120))}`,ev)).on('mouseleave',hideTip);
    g.append('circle').attr('cx',x(e._d)).attr('cy',Y).attr('r',4).attr('fill','#9aa3b2');
    g.append('line').attr('x1',x(e._d)).attr('x2',x(e._h)).attr('y1',Y).attr('y2',Y).attr('stroke',off?'#64748b':'#f5b942').attr('stroke-width',2).attr('stroke-dasharray',off?'4 3':null).attr('marker-end','url(#arr)');
    g.append('text').attr('x',x(e._h)+8).attr('y',Y+4).attr('font-size',11).attr('fill',off?'#9aa3b2':'#e8e6e3').text(`${e.horizon}｜${(opt.label?opt.label(e):shortTopic(e.topic)).slice(0,22)}`);
  });
}
const PRED_LEGEND='<div class="legend"><span>● 發表時間 → 箭頭指向「預測會發生的時間」</span><span style="color:#f5b942">實線＝與軟體開發直接相關</span><span style="color:#9aa3b2">虛線＝一般 AGI／AI 研發（與開發較無關，但列出時間點供對照）</span></div>';
slide('ai2027','AI 2027',`<div class="kicker">FORECAST · AI 2027</div><div id="a27"></div>`,(root)=>{
  const p=PEOPLE.find(x=>x.slug==='ai-futures-project');const pr=PROFILES['ai-futures-project']||{};
  const all=ALL.filter(e=>e.slug==='ai-futures-project');
  const orig=all.filter(e=>e.date==='2025-04-03').sort((a,b)=>(a._h||0)-(b._h||0));
  const pub=PUBS.find(x=>x.id==='pub-ai2027');
  root.querySelector('#a27').innerHTML=`<h2>AI 2027：2025 年 4 月 3 日發表，寫下了 AI 取代程式設計師的時間表</h2>
  <p class="lead" style="max-width:none">${esc(pr.importance_zh||'')}</p>${homeLink(pr)}
  <div class="two"><div class="card"><h3>發表當時預言的時間點</h3><ul class="kf">${orig.map(e=>`<li><b>${esc(e.horizon||'')}</b>　${esc(e.quote_zh)}${relOf(e)==='offtopic'?' <span class="tag">一般 AI 研發，非開發</span>':''}</li>`).join('')}</ul>
  ${pub?`<p class="meta"><a href="${esc(pub.url)}" target="_blank" rel="noopener">原網站</a>${pub.archive_url?` · <a href="${esc(pub.archive_url)}" target="_blank" rel="noopener">2025-04 存檔</a>`:''}</p>`:''}</div>
  <div class="card"><h3>之後怎麼修訂</h3><ul class="kf">${all.filter(e=>e.date>'2025-04-03').sort((a,b)=>a._d-b._d).map(e=>`<li><b>${esc(e.date)}</b>　${esc(shortTopic(e.topic))}${e.horizon?` → <b style="color:#f5b942">${esc(e.horizon)}</b>`:''}</li>`).join('')}</ul></div></div>
  <h3 style="margin:1rem 0 .3rem">預測如何移動：每條箭頭從「發表時間」指向「預測時間」</h3>${PRED_LEGEND}<div class="chart" id="a27arr"></div>
  <h3 style="margin:1.2rem 0 .3rem">準不準？所有人描述「現況」的說法 vs AI 2027 的預測曲線</h3>${A27LEGEND}<p class="mute">白線＝每季所有人說法的中位數。白線在橘線下方，代表大家描述的現況比 AI 2027 預測的進度慢。</p><div class="chart" id="a27acc"></div>`;
  predArrows(root.querySelector('#a27arr'),all);
  const ser=ALL.filter(e=>e.group!=='AI 預測團隊與網站'&&relOf(e)==='core'&&clv(e)!=null&&e.concession.kind!=='predicted'&&+e._d>=+new Date(2024,0,1)).sort((a,b)=>a._d-b._d);
  personChart(root.querySelector('#a27acc'),ser,{noLine:true,median:true,r:5,h:340});
},true);
const FC_ORDER=['ai-2027-tracker'];
const FC_OTHERS=['metr','leopold-aschenbrenner','epoch-ai','ai-as-normal-technology','ai-digest','futuresearch','forecasting-research-institute','manifold','titotal','vitalik-buterin'];
slide('fc-overview','預測網站總覽',`<div class="kicker">FORECASTS · SUMMARY</div><h2>總整理：各預測團體說「什麼時候會發生」</h2>${PRED_LEGEND}<div class="chart" id="fcall"></div>`,(root)=>{
  const es=ALL.filter(e=>e.group==='AI 預測團隊與網站'&&e._h);
  predArrows(root.querySelector('#fcall'),es,{label:e=>e.person.replace(/[（(].*/,'')+'：'+shortTopic(e.topic)});
},true);
FC_ORDER.filter(sl=>PEOPLE.some(p=>p.slug===sl)).forEach(sl=>{
  const p=PEOPLE.find(x=>x.slug===sl);const pr=PROFILES[sl]||{};
  slide('fc-'+sl,pr.name||p.name,`<div class="kicker">FORECAST · ${esc(pr.name||p.name)}</div><div class="fcs"></div>`,(root)=>{
    const es=ALL.filter(e=>e.slug===sl).sort((a,b)=>a._d-b._d);
    root.querySelector('.fcs').innerHTML=`<div class="prof-head"><div class="avatar big">${esc(initials(p.name))}</div><div><h1 style="font-size:clamp(1.6rem,3.5vw,2.4rem)">${esc(pr.name||p.name)}</h1><p class="tag1">${esc(pr.tagline_zh||p.profile_zh||'')}</p>${homeLink(pr)}</div></div>
    <div class="two"><div class="psec"><h3>為什麼重要</h3><p>${esc(pr.importance_zh||'')}</p>${pr.role_in_debate_zh?`<h3>在這場討論中的角色</h3><p>${esc(pr.role_in_debate_zh)}</p>`:''}</div>
    <div class="psec"><h3>他們說過什麼（${es.length} 則）</h3><ul class="kf">${es.map(e=>`<li><b>${esc(e.date)}</b>${e.horizon?` → <b style="color:#f5b942">預測 ${esc(e.horizon)}</b>`:''}　${esc(e.quote_zh.length>160?e.quote_zh.slice(0,160)+'…':e.quote_zh)}${relOf(e)==='offtopic'?' <span class="tag">非開發</span>':''}</li>`).join('')}</ul></div></div>
    <h3>預測時間點</h3>${PRED_LEGEND}<div class="chart fcarr"></div>`;
    predArrows(root.querySelector('.fcarr'),es);
  },true);
});


slide('fc-others','其他預測團體',`<div class="kicker">FORECASTS · OTHERS</div><h2>其他預測團體：他們是誰、預測什麼時候會發生</h2><div id="fco"></div>`,(root)=>{
  const ps=FC_OTHERS.map(sl=>PEOPLE.find(p=>p.slug===sl)).filter(Boolean);
  root.querySelector('#fco').innerHTML=`${PRED_LEGEND}<div class="chart" id="fcoarr"></div>
  <div class="grid cards fcocards" style="margin-top:1rem">${ps.map(p=>{const pr=PROFILES[p.slug]||{};const es=ALL.filter(e=>e.slug===p.slug).sort((a,b)=>a._d-b._d);
    return `<div class="card"><h3>${esc(pr.name||p.name)}</h3><div class="ptag">${esc(pr.tagline_zh||p.profile_zh||'')}</div>${homeLink(pr)}
    <p style="font-size:.84rem;line-height:1.6;margin:.5rem 0">${esc(pr.importance_zh||'')}</p>
    <ul class="kf" style="font-size:.82rem">${es.map(e=>`<li><a href="#" class="fce" data-e="${esc(e.id)}"><b>${esc(e.date)}</b>${e.horizon?` → <b style="color:#f5b942">預測 ${esc(e.horizon)}</b>`:''}　${esc(shortTopic(e.topic))}</a>${relOf(e)==='offtopic'?' <span class="tag">非開發</span>':''}</li>`).join('')}</ul>
    ${pr.note?`<div class="mute" style="font-size:.75rem">備註：${esc(pr.note)}</div>`:''}</div>`}).join('')}</div>`;
  root.querySelectorAll('.fce').forEach(a=>a.onclick=ev=>{ev.preventDefault();showEntry(ALL.find(e=>e.id===a.dataset.e))});
  predArrows(root.querySelector('#fcoarr'),ALL.filter(e=>FC_OTHERS.includes(e.slug)),{label:e=>e.person.replace(/[（(].*/,'')+'：'+shortTopic(e.topic)});
},true);

// ---------- section dividers + one slide per person ----------
const PERSON_SECTIONS=[
 {id:'sec-me',title:'第一位：我自己',sub:'郭佳甯（卡米哥）和我的時間軸，作為對照組',slugs:['etrexkuo']},
 {id:'sec-vet',title:'軟體開發大佬',sub:'從 DHH 開始：定義了現代軟體開發方式的人',slugs:['dhh','kent-beck','uncle-bob','martin-fowler','simon-willison','mitchell-hashimoto','addy-osmani','steve-yegge','grady-booch','linus-torvalds','antirez','john-carmack','brian-kernighan','dave-farley','jeff-atwood','charity-majors']},
 {id:'sec-lab',title:'模型大師',sub:'打造模型、或替大眾定調 AI 能做什麼的人',slugs:['andrej-karpathy','dario-amodei','sam-altman','boris-cherny','greg-brockman','demis-hassabis','francois-chollet','ilya-sutskever','yann-lecun']},
 {id:'sec-start',title:'新創公司與其他',sub:'販售 AI 開發工具的創辦人、投資人與科技公司領袖',slugs:['amjad-masad','guillermo-rauch','jarred-sumner','scott-wu','thomas-dohmke','paul-graham','matt-welsh','jensen-huang','satya-nadella','sundar-pichai','mark-zuckerberg','marc-benioff','patrick-collison','emad-mostaque']}];
{const listed=new Set(PERSON_SECTIONS.flatMap(s=>s.slugs));
 PEOPLE.filter(p=>p.group!=='AI 預測團隊與網站'&&!listed.has(p.slug)).forEach(p=>PERSON_SECTIONS[3].slugs.push(p.slug));}
PERSON_SECTIONS.forEach(sec=>{
  sec.slugs=sec.slugs.filter(sl=>PEOPLE.some(p=>p.slug===sl));
  slide(sec.id,sec.title,`<div class="title-slide"><div class="kicker">PEOPLE</div><h1 style="font-size:clamp(2.2rem,6vw,4.4rem)">${esc(sec.title)}</h1><p class="lead">${esc(sec.sub)}</p>
  <div class="secnames">${sec.slugs.map(sl=>{const p=PEOPLE.find(x=>x.slug===sl);const pr=PROFILES[sl]||{};return `<a href="#p-${sl}" class="chip">${esc(pr.name||p.name)}</a>`}).join('')}</div></div>`);
  sec.slugs.forEach(sl=>{const p=PEOPLE.find(x=>x.slug===sl);const pr=PROFILES[sl]||{};
    slide('p-'+sl,pr.name||p.name,`<div class="profslide"></div>`,(root)=>{const el=root.querySelector('.profslide');el.innerHTML=profileHtml(sl,true);wireProfile(el,sl)},true)});
});
slide('sec-fc','先看預言：AI 2027 與其他預測網站',`<div class="title-slide"><div class="kicker">FORECASTS</div><h1 style="font-size:clamp(2.2rem,6vw,4.4rem)">先看預言</h1><p class="lead">在介紹每個人之前，依序看 AI 2027、追蹤它的 AI 2027 Tracker、以及其他預測團體說了什麼、預測什麼時候會發生。之後每個人的時間軸上，都會疊上 AI 2027 的預測，讓你看預測準不準。</p></div>`);
slide('sec-analysis','綜合分析',`<div class="title-slide"><div class="kicker">INSIGHT</div><h1 style="font-size:clamp(2.2rem,6vw,4.4rem)">綜合分析</h1><p class="lead">看完全部發言後的總結，不用圖表：開發方式怎麼一季一季變過來、每一步為什麼會發生，以及那條一路往後退的「人類最後防線」。</p>
<div class="secnames"><a href="#insight-flow" class="chip">開發的變遷（按季）</a><a href="#insight-why" class="chip">因果鏈</a><a href="#insight-rust" class="chip">趨勢：用 Rust 重寫</a><a href="#insight-why-rust" class="chip">為什麼是 Rust</a><a href="#insight-next" class="chip">驗收框架之後（推測）</a><a href="#insight-death" class="chip">軟體開發將死？</a><a href="#insight-jit" class="chip">程式碼只是快取</a></div></div>`);
{const pl=(sl,n)=>`<a href="#p-${sl}">${n}</a>`;const C=i=>['#64748b','#38bdf8','#22c55e','#f59e0b','#e4572e'][i];
const Q=(q,c,title,items,why)=>`<li style="--c:${c}"><span class="q">${q}</span><span class="st">${title}</span><ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul>${why?`<div class="why">為什麼：${why}</div>`:''}</li>`;
slide('method','怎麼挑人、怎麼做、偏在哪裡',`<div class="insight"><div class="kicker">METHOD · 先讀這頁</div><h2>先說清楚：怎麼挑人、怎麼做，以及可能偏在哪裡</h2>
<div class="key" style="border-color:#e4572e;background:#e4572e14"><b>分工與免責聲明：</b><b>卡米哥決定要呈現什麼、怎麼呈現；其他所有部分</b>（搜尋資料、查證、翻譯、分類與評分、撰寫文字、製作網站）<b>都由 Claude Code 負責</b>。資料<b>未經人工審查，不保證完全正確</b>，引文、日期與分數請以原始來源為準。</div>
<div class="chain" style="align-items:stretch">
<div style="--c:#38bdf8;flex:1 1 300px"><b>挑人標準</b>
<ul>
<li><b>起點：</b>作者第一個提問直接點名 DHH、Kent Beck、Uncle Bob、OpenAI、AI 研究者和頂尖公司。</li>
<li><b>擴充：</b>Claude 列出候選名單，作者增刪；條件是在軟體開發或 AI 領域有公開影響力、2023 年起有可查證的公開發言。</li>
<li><b>對照組：</b>加入作者自己的 Facebook 和 Medium，看一位第一線實作者同一時間怎麼說。</li>
<li><b>預測：</b>加入 AI 2027 和後續的預測網站；Metaculus 因資料來源有爭議被移除。</li>
<li><b>中途補人：</b>為了查證「老將早期怎麼說」補進 Torvalds、antirez、Carmack 等人；為了 Rust 主題補進 Jarred Sumner、Mitchell Hashimoto。</li>
<li><b>結果：</b>40 位人物（含作者）加 12 個預測團隊。</li>
</ul></div>
<div style="--c:#22c55e;flex:1 1 300px"><b>製作方法</b>
<ul>
<li>每則發言保留原文、繁中翻譯、日期、來源網址，能截圖就截圖；搜尋、查證、翻譯、分類與撰寫全部由 Claude Code 完成，未經人工審查；卡米哥決定要呈現什麼、怎麼呈現。</li>
<li>只收「AI 能／不能／怎麼做開發相關的事」，談模型進步或 AGI 的另外標為無關。</li>
<li>每則發言評兩種分數：<b>退守程度</b>（0 全手動 → 4 全自動）和各流程的 <b>S1–S5 階段</b>。兩者都是編輯判斷，附理由與信心。</li>
<li>預言以「說出口的日期」標示，並和現況分開；判斷倒退只比較前後兩則描述現況的發言。</li>
<li>規則：說了「AI 寫程式」就推論 Code review 至少在 S3（標「推論」、可關閉）；說「反正不讀」就算 Code review S4。</li>
<li>每個人的時間軸疊上 AI 2027 的預測，對照準不準。</li>
</ul></div>
</div>
<h3>取樣和立場的偏誤：根據這次的提問方式評估</h3>
<div class="chart" style="overflow:auto"><table class="mig jobs"><thead><tr><th>偏誤</th><th>從哪裡來</th><th>可能把結論推向哪裡</th></tr></thead><tbody>
<tr><td><b>名人取樣</b></td><td>名單從點名知名人物開始，再由 Claude 補「有影響力」的人。40 位人物中只有 1 位女性（Charity Majors），幾乎全是美國或歐洲的英文發言，只有作者一位華語使用者。</td><td>呈現的是「高能見度人物怎麼說」，不是一般開發者的實際情況。一般開發者的資料（如 Stack Overflow 調查：2025 年只有 14.1% 每天使用 agent）明顯比這群人保守。</td></tr>
<tr><td><b>商業利益</b></td><td>超過一半的人任職於銷售 AI 產品、或投資 AI 的公司（各大實驗室、GitHub、Vercel、Replit、Cognition、Bun／Anthropic 等）。</td><td>偏向「AI 進展很快」的說法。人物頁的「在這場討論中的角色」有標出利益關係。</td></tr>
<tr><td><b>題目和量尺的框架</b></td><td>標題是「軟體開發將死？」；退守程度和 S1–S5 都只有一個方向：從人做走向 AI 做。</td><td>容易把每句話都讀成「AI 又攻下一塊」，很難表達「AI 在這件事上根本不重要」這種立場。</td></tr>
<tr><td><b>作者自己的比重</b></td><td>作者提供了自己<b>全部的</b> Facebook 貼文（匯出檔加上瀏覽器擴充功能收集），<b>收錄哪些是 Claude Code 依「有沒有談 AI 做開發」挑選的</b>，不是作者決定的。結果作者有 37 則直接談開發的發言，佔全部 277 則的 13%，是發言最多的一位。</td><td>作者的資料是「全部貼文」，其他人只有公開、而且被搜尋到的發言，兩邊的完整度不同。所以作者的發言數偏多，早期的說法也比較容易被收到，跟其他人比較「誰比較早說」時要留意這一點。</td></tr>
<tr><td><b>時間和來源不均</b></td><td>2023–2024 只有 60 則，2025 年後有 217 則；來源以 X 貼文和部落格為主，聳動、好引用的句子比較容易被收進來。</td><td>早期的轉變弧線偏薄，極端說法的比例可能偏高。</td></tr>
<tr><td><b>單一編碼者</b></td><td>所有翻譯、退守程度和階段判斷都由 Claude Code 完成，沒有人工逐條審查，也沒有第二個人獨立評分；卡米哥只決定要呈現什麼、怎麼呈現。</td><td>分數有主觀性，同一句話換一個人評，可能差半級到一級。</td></tr>
</tbody></table></div>
<div class="key"><b>怎麼讀這份簡報：</b>它回答的是「2023 年以來，這群高能見度、多半有利益關係的英語圈人物，怎麼描述 AI 對開發的影響、說法怎麼變」，不是「所有軟體開發者怎麼想」。整體偏向「AI 進展很快」的那一側。資料裡也收了懷疑方（Booch、LeCun、Atwood、Chollet、AI as Normal Technology、METR 的實驗），但人數較少。看到結論時，請一併看人物頁的利益說明和每則發言的原文。</div></div>`);
slide('insight-flow','開發的變遷（按季）',`<div class="insight"><div class="kicker">INSIGHT · 1</div><h2>開發的變遷：從程式碼補全到「不讀程式碼」</h2>
<p class="mute">時間以「季」標記，不寫具體日期。色點代表那一季主流實踐落在哪一階段（同 S1–S5 色階）。人名可點，會跳到個人頁。</p>
<ol class="qt">
${Q('2023 Q1–Q2',C(1),'補全與聊天：AI 是比較快的輸入法',[
 `實際用法是 Copilot 補全一段、ChatGPT 問問題。程式由人寫，也由人逐行讀（寫程式 S1–S2）。`,
 `老將的反應是否定：${pl('uncle-bob','Uncle Bob')}說「它沒有創造力」，${pl('grady-booch','Booch')}說「隨機鸚鵡」，${pl('john-carmack','Carmack')}說今天還是手寫。`,
 `最早的退守來自 ${pl('kent-beck','Kent Beck')}：他說「90% 技能的價值歸零，剩下 10% 放大 1000 倍」。他承認了打字和語法會被取代，但沒有說判斷會被取代。`,
 `同期的預言派（${pl('matt-welsh','Matt Welsh')}「程式設計將死」、${pl('emad-mostaque','Mostaque')}「五年內沒有程式設計師」）講得很早也很極端，但跟當時的實踐完全脫節。`],
 '模型一次只能可靠地生成幾行到一個函式，脈絡很短，所以只能拿來補全和問答。')}
${Q('2023 Q3–2024 Q2',C(1),'工具論：寫程式本來就是最簡單的部分',[
 `${pl('uncle-bob','Uncle Bob')}說「完全沒改變我寫程式的方式，就像以前問 Stack Overflow」。${pl('antirez','antirez')} 說它是「知道很多事的傻瓜學者」。`,
 `${pl('charity-majors','Charity Majors')}把防線往後移：「寫程式是軟體工程最容易的部分，難的是維運、理解與治理」。`,
 `生產力的說法開始出現，但都是傳聞：${pl('paul-graham','Paul Graham')} 轉述有人生產力提高 10 倍，也有人說 22 歲的工程師靠 AI 已經追上 28 歲的。`,
 `前端是例外：${pl('guillermo-rauch','Rauch')} 說 v0 生成的前端「比我自己寫的還好」，這是第一個「AI 寫整頁」的現況說法。`],
 '模型可以寫一段完整的函式，但不能維護整個專案，所以大家把價值移到「寫程式以外」的部分。')}
${Q('2024 Q2–Q4',C(2),'AI 寫、人逐行 review 成為大公司的標準說法',[
 `${pl('sundar-pichai','Google')} 說：超過四分之一的新程式碼由 AI 生成，「再由工程師審查並採用」。${pl('steve-yegge','Yegge')} 說公司「只需要資深的人寫提示、審查成果」。Devin 也在這時上市。`,
 `寫程式和 review 的分工在這時定型：AI 寫，人逐行看，責任在人（Code review S3）。`,
 `異數：${pl('amjad-masad','Amjad Masad')} 說「別看它，那是目的碼，你現在用英文寫程式」。這是資料中第一個「不看程式碼」的現況說法，比主流早了將近兩年。`,
 `${pl('etrexkuo','卡米哥')}在 2024 Q3 參照自動駕駛分級，自製「自動寫程式等級表」0–5 級，第 4 級就是「系統依高階描述生成大部分程式碼，開發人員主要負責審核和微調」。2024 Q4 開始調整做法：Cursor 做大量工作時會罷工；AI 生成的程式碼與專案慣例不同時，應該改專案慣例，而不是改 prompt。`],
 'Claude 3.5 Sonnet 加上 Cursor 讓生成單位從「一行」變成「一個檔案、一個功能」，量開始多到需要 review 流程來接住。')}
${Q('2025 Q1',C(3),'Agent 與 vibe coding：拋棄式專案可以不看',[
 `${pl('andrej-karpathy','Karpathy')} 提出 vibe coding：「忘記程式碼的存在」，但他明說只適合「週末的拋棄式專案」。`,
 `${pl('etrexkuo','卡米哥')}發現 Cursor agent「短時間內生成數千行規模的專案」，並開始為 AI 設計程式碼庫：縮小專案、優先讓 AI 複製而不是共用、讓資料夾結構取代大檔案。`,
 `${pl('dario-amodei','Dario')} 預言「三到六個月內 AI 寫 90% 程式碼」。${pl('simon-willison','Willison')} 劃出界線：「vibe coding 不等於借助 LLM 寫程式」。`,
 `結果分成兩軌：拋棄式和原型可以不看（S5），正式產品仍然逐行看（S3）。`],
 'Agent 能自己讀檔、改多個檔、跑指令，但長任務還不穩定，所以只敢在不重要的地方放手。')}
${Q('2025 Q2–Q3',C(2),'Agent 進入正式流程，但信任還沒到',[
 `Claude Code、Codex、Copilot coding agent 先後推出，交付形式是「AI 開 PR、跑 CI、人審」。${pl('boris-cherny','Cherny')} 說他約 80% 的程式碼由 AI 寫。`,
 `${pl('kent-beck','Kent Beck')} 把 augmented coding 和 vibe coding 分開：他仍在乎程式碼、測試與覆蓋率，「只是我不太自己打那些程式碼」。`,
 `${pl('etrexkuo','卡米哥')}最早點出下一個瓶頸：「AI 開發速度越來越快，人類需要一些方法快速確認 AI 寫的程式是否滿足需求」。`,
 `反方證據也很多：${pl('dhh','DHH')} 說「我不讓它駕駛我的程式碼」，METR 實驗發現用 AI 反而慢 19%，${pl('martin-fowler','Fowler')} 說 LLM「說測試全綠，我一跑卻有失敗」，${pl('andrej-karpathy','Karpathy')} 說補全仍是他的甜蜜點。`],
 '工具已經可以端到端完成任務，但會偷懶、說謊、遺忘原則，所以人不敢放掉逐行 review。')}
${Q('2025 Q4',C(3),'轉折點：2025 年 11 月下旬之後，很多人不再親手寫',[
 `<b>關鍵日期：2025-11-24</b>，Claude Opus 4.5 發表（同月有 GPT-5.1）。${pl('steve-yegge','Yegge')} 稱之為「AI 寫程式跨過事件視界的那一天」。`,
 `${pl('simon-willison','Willison')}：從「大多能跑但要非常小心盯著」，變成「幾乎每次都照你的指示做」。${pl('andrej-karpathy','Karpathy')}：11 月還是 80% 手寫，12 月變成 80% 由 agent 寫。${pl('greg-brockman','Brockman')}：12 月起 Codex 幾乎寫了所有程式碼。${pl('boris-cherny','Cherny')}：過去 30 天的貢獻 100% 由 Claude Code 寫。`,
 `同一季就出現了答案的雛形：${pl('simon-willison','Willison')} 說 agent「只要有現成的測試套件可以對照，就會出奇地有效」；${pl('etrexkuo','卡米哥')}說「只有可執行的驗收測試可以保護你」。`],
 '模型的長任務連貫性和指令遵循跨過了門檻。改變的不是「能不能寫」，而是「需不需要盯」。')}
${Q('2026 Q1',C(3),'老將集體轉向；產出暴增，review 變成瓶頸',[
 `一年前最抗拒的一群在同一季轉向：${pl('antirez','antirez')}「自己動手寫已不再合理」，${pl('linus-torvalds','Torvalds')}「把中間人，也就是我自己，拿掉」，${pl('uncle-bob','Uncle Bob')}「我是在小心監督一個強大的工具」，${pl('dhh','DHH')}「受監督的協作今天就已實現」，${pl('grady-booch','Booch')}「就像編譯器出現的時候」。`,
 `產出量級跳升：${pl('paul-graham','PG')} 轉述有人「每小時一千行」，${pl('dario-amodei','Dario')} 說「90% 由 AI 寫」在某些地方已經成真。`,
 `瓶頸立刻轉到驗收：${pl('thomas-dohmke','Dohmke')}「review 越來越成為瓶頸，你必須把那個步驟從流程中拿掉」；${pl('dave-farley','Dave Farley')}「我無法仔細讀完 12,000 行，信任必須來自可執行的規格與持續驗證，而不是逐行人工檢查」。`,
 `${pl('francois-chollet','Chollet')} 把它理論化：agentic coding 本質上就是機器學習，規格與測試是目標函數，agent 負責最佳化。`],
 '人不再打字之後，人一天能「讀」的行數就成了產能的天花板。')}
${Q('2026 Q2',C(3),'不逐行 review，改用測試架構鎖住成果',[
 `${pl('uncle-bob','Uncle Bob')}：「我不審查代理寫的程式碼。我量測測試覆蓋率、相依結構、循環複雜度、模組大小、突變測試。」寫出這句的人，就是兩年前說 AI「沒改變我寫程式的方式」的同一個人。`,
 `${pl('charity-majors','Charity Majors')} 把問題改寫成：「要具備什麼條件，你才會放心不讀程式碼就把它上線？更好的評測、測試、功能旗標、護欄、可觀測性？」`,
 `${pl('kent-beck','Kent Beck')}：「我們累積程式碼的速度比累積信任還快。」${pl('simon-willison','Willison')}：95% 的程式碼不是他自己打的。${pl('sundar-pichai','Pichai')}：工程師在「指揮完全自主的任務小組」。`],
 '逐行 review 跟不上產出，只好把信任的來源從「人讀過」換成「機器驗過」。')}
${Q('2026 Q3',C(3),'「不讀程式碼」成為主流說法，人的位置移到判斷與負責',[
 `${pl('uncle-bob','Uncle Bob')}：「完全不讀，改用極端的約束包圍代理：單元測試、gherkin、QA、品質指標、突變測試」。${pl('amjad-masad','Amjad')}：「2026 年中，大多數工程師都不看程式碼了」。${pl('charity-majors','Charity')}：「code review 被高估了」。`,
 `${pl('dhh','DHH')}：「鉛筆放下了。手寫程式碼已不再是具經濟可行性的技能。」他一年前還說「不讓它駕駛」。`,
 `但新的底線也成形了：${pl('addy-osmani','Addy Osmani')}「不需要閱讀所有程式碼，但每個變更仍需要某種審查、需要一個為出貨負責的人」；${pl('francois-chollet','Chollet')}「委派寫程式，但絕不委派理解」；${pl('guillermo-rauch','Rauch')} 列出「如果你不讀程式碼（自己讀或透過代理人詢問都算）」就會出現的風險。`,
 `仍然堅守的人：${pl('linus-torvalds','Torvalds')} 自己的小專案已交給 agent，但在 Linux 核心上仍把 AI 當成協助人審的工具（Code review S2），${pl('jeff-atwood','Atwood')} 說「它不知道自己在做什麼」。`],
 '問題已經不是「AI 能不能寫」，而是「怎麼在不讀的情況下仍然知道它是對的」。')}
</ol></div>`);
slide('insight-why','因果鏈',`<div class="insight"><div class="kicker">INSIGHT · 2</div><h2>為什麼會這樣變：一條因果鏈</h2>
<div class="chain">
<div style="--c:${C(1)}"><b>① 能力跨過門檻</b>長任務的連貫性和指令遵循在 2025 Q4 跨過「不必盯著」的線。</div><i>→</i>
<div style="--c:${C(2)}"><b>② 不再親手寫</b>2025 Q4–2026 Q1，lab 內部先轉，老將跟著轉：「自己寫已不合理」。</div><i>→</i>
<div style="--c:${C(3)}"><b>③ 產出暴增</b>每小時千行、一天萬行、一人做完團隊的專案。</div><i>→</i>
<div style="--c:${C(3)}"><b>④ 驗收跟不上</b>逐行 review 成為瓶頸：「程式碼累積得比信任快」。</div><i>→</i>
<div style="--c:${C(4)}"><b>⑤ 用機器鎖住成果</b>可執行規格、驗收測試、突變測試、品質指標、可觀測性、功能旗標。</div><i>→</i>
<div style="--c:${C(4)}"><b>⑥ 人移到判斷與負責</b>決定做什麼、守住架構與理解、為出貨簽名。</div>
</div>
<div class="key"><b>每一環都比上一環晚一到兩季。</b>「AI 寫為主」（寫程式 S3 以上）在 2025 年就已是多數說法；「不再親手寫、只看結果」則集中在 2025 Q4–2026 Q1。Code review 的轉變（不逐行看）要到 2026 Q2–Q3 才成為主流說法，而且到目前（2026 Q3）仍未在資料中過半。所以 review 這一關落後寫程式大約兩到三季。</div>
<h3>防線一路往後退</h3>
<ol>
<li>「AI 沒有創造力、是隨機鸚鵡」（2023 Q1）</li>
<li>「AI 只是比較快的輸入法、補全、Stack Overflow」（2023–2024）</li>
<li>「寫程式本來就是最簡單的部分，難的是維運和理解」（2024 Q2）</li>
<li>「AI 可以寫，但人要逐行讀」（2024 Q4–2025）</li>
<li>「不用逐行讀，但要有測試和指標鎖住」（2026 Q1–Q2）</li>
<li>「委派寫程式，不委派理解；人負責決定做什麼和為結果負責」（2026 Q3）</li>
</ol>
<p class="mute">每一次退守，說話的人都把剛被攻下的那一塊重新定義成「本來就不是重點」。</p></div>`);
slide('insight-more','其他觀察',`<div class="insight"><div class="kicker">INSIGHT · 5</div><h2>其他觀察</h2>
<ul>
<li><b>把預言和現況分開比，沒有人真的倒退。</b>如果拿某人早期的預言去比他後來描述的現況，很容易誤判成「立場倒退」（例如 Zuckerberg 2025 年預言「AI 能當中階工程師」，2026 年只說「期待 AI 幫團隊加快開發」）。只比較描述現況的發言時，資料中一共出現 46 次分數或階段下降，逐一檢查後：19 次是後一句談的是別的事，14 次是談的範圍不同（最典型的是 Karpathy：2 月的 vibe coding 他明說只適合週末拋棄式專案，10 月講的是正式工作），10 次只是同一立場的評分粒度差異，3 次是單次經驗（都是卡米哥某一次工具失敗的紀錄）。<b>真的立場倒退：0 次。</b>每個人頁的圖表都只把描述現況的發言連成線，預言用菱形另外標示，下方的「倒退檢查」列出每一次下降的判讀。</li>
<li><b>實踐者比預言者更準。</b>2023 年就喊「程式設計將死」的人（Welsh、Mostaque），時間點都太早。真正推動轉變的，是工具在某一季突然「可以不用盯」。比較有參考價值的訊號是「實際在用的人什麼時候改口」，不是大膽的預言。</li>
<li><b>lab 內部大約領先老將兩到三季。</b>Dario 在 2025 Q1 預言「三到六個月寫 90%」，到 2026 Q1 在 Anthropic 內部成真，但他自己也說這是「很弱的指標」。老將（DHH、Uncle Bob、antirez、Torvalds）集中在 2025 Q4–2026 Q1 轉向，比 lab 內部晚了大約兩到三季。</li>
<li><b>「寫程式」被攻下，不等於「軟體工程」被攻下。</b>Dario 自己也區分「寫完所有程式碼」和「端到端完成工程師的任務」（測試、環境、部署、迭代產品）。資料中需求／設計幾乎全部停在 S1（人定義），維運部署的現況說法也很少。</li>
<li><b>AI 2027 的方向對，速度慢了。</b>2025 Q1 的情境把超人類程式設計師（SC）放在 2027 年 3 月。作者之後把 AC 中位數一路延後到 2028–2032，最近又往前調到 2027 年 11 月。他們自評實際進度約為情境速度的 65%–90%。寫程式這一塊現在已接近「AI 寫、人只看結果」，但距離「公司寧願解雇所有工程師」還很遠。</li>
<li><b>review 的爭議其實是「信任從哪裡來」。</b>主張不讀程式碼的人（Uncle Bob、Farley、Charity），並不是主張不驗證，而是主張把驗證從人眼移到機器。主張要讀的人（Osmani、Chollet、Rauch）在意的則是理解和責任歸屬。兩邊在 2026 Q3 的交集是：可以不逐行讀，但一定要有人能解釋系統、為出貨負責。</li>
<li><b>受影響最大的是中間層。</b>Fowler 和 Willison 在 2026 Q1–Q2 都指出：最辛苦的是中階工程師，因為他們的經驗在沒有 LLM 的時代形成，又還不夠資深到能駕馭 LLM。就業的預言則仍然兩極：從「需求減少 90%」（Dario）到「工程師多 100 倍」（Cherny）都有。</li>
<li><b>卡米哥的軌跡在幾個節點上走得比較早。</b>2023 Q1 就用 Copilot 做「註解驅動開發」，並開玩笑說未來工程師看到前人親手寫 code，會像看到「不詠唱就瞬發魔法」；2024 Q3 參照自動駕駛分級，自製「自動寫程式等級表」（0–5 級，以誰寫、誰監控、誰負責修正和專案規模分級），是本調查 S1–S5 階梯的早期原型；2024 Q4 改專案慣例來配合 AI，2025 Q1 為 AI 的可維護性設計專案結構，2025 Q2 點出驗收速度的問題，2025 Q4 說「只有可執行的驗收測試可以保護你」。最後這點比 Farley（2026 Q1）和 Uncle Bob（2026 Q2）早一到兩季，和 Willison 同一季。</li>
</ul></div>`);
slide('insight-next','驗收框架之後（推測）',`<div class="insight"><div class="kicker">INSIGHT · 5 · 推測</div><h2>人類完成驗收框架之後，會怎樣？</h2>
<p class="mute">以下是根據資料走向所做的推測，不是任何人的發言。每一步都附上它延伸自哪些人的說法。</p>
<ol class="qt">
${Q('下一步',C(3),'驗收框架本身也交給 AI 寫，瓶頸移到「規格」',[
 `Uncle Bob 已經用代理寫單元、驗收、屬性與突變測試。測試也由 AI 寫之後，問題就變成「誰來驗收這些驗收」。`,
 `人只剩兩件事：定義驗收條件，以及判斷條件寫得對不對。Chollet 說「規格與測試就是目標函數」，正是這個狀態。`])}
${Q('副作用',C(3),'鑽漏洞會成為主要風險，「防作弊的驗收」成為新專業',[
 `Fowler 碰過「測試全綠，一跑卻失敗」。被最佳化的指標會被鑽漏洞（Goodhart 定律）。`,
 `突變測試、屬性測試、可觀測性、功能旗標這類「讓 AI 鑽不了漏洞」的手段會變成核心技能，可能出現「驗收工程師」這種職種。`])}
${Q('形式',C(4),'程式碼變成目的碼，事實來源改為規格加測試',[
 `Amjad 說「那是目的碼」，Chollet 說「需要新的事實來源產物」。`,
 `選語言和架構的標準會從「人讀得懂」轉成「機器容易驗證」。「為 AI 設計專案結構」（卡米哥，2025 Q1）會繼續往這個方向走。`])}
${Q('再下一關',C(3),'需求／設計和維運開始被攻下',[
 `需求／設計在資料中幾乎都還停在 S1，但已經有跡象：Altman 說 Codex 提的功能點子比他自己想的好；Booch 說交付管線是自動化的低垂果實；卡米哥設想錯誤追蹤接上程式碼管理，「服務自己進化」。`])}
${Q('最後防線',C(4),'剩下「決定要什麼」與「為結果負責」',[
 `「要什麼」是價值判斷，「誰負責」是法律與信任問題，這兩件事很難交給機器。`,
 `卡米哥（2025 Q1）：「每個軟體最終都需要有人負責。」Addy Osmani（2026 Q3）：「每個變更仍需要一個為出貨決定負責的人。」`])}
${Q('經濟',C(4),'開發成本趨近 0，軟體變成商品',[
 `Yegge 說會有「智慧販賣機」：送進規格就拿到實作。Kent Beck 說「每家小企業都成為軟體公司」。`,
 `卡米哥問過「軟體建立的護城河會不會消失」。價值會移到資料、通路、信任和領域知識。`])}
${Q('人力',C(4),'職缺分兩段：先減少，再以不同名字擴散',[
 `第一段：做同樣的工作，需要的人頭大幅減少（Benioff 已經從 9,000 人減到約 5,000 人；Dario 說需求減少 90%）。`,
 `第二段：軟體擴散到各行各業，總需求上升（Jensen、Chollet、Cherny）。但回來的不一定叫「工程師」，Cherny 說會叫 builder。`,
 `長期隱憂是養成管道斷掉。Chollet 說：AI 唯一能讓人貶值的方式，是讓人無法隨時間累積能力。`])}
</ol></div>`);
slide('insight-death','軟體開發將死？',`<div class="insight"><div class="kicker">INSIGHT · 6 · 結論</div><h2>軟體開發將死？</h2>
<p class="mute">「死」至少有三種意思，答案各不相同。先定義，再分別回答。</p>
<div class="deaths">
<div style="--c:${C(4)}"><div class="dn">第一種死</div><b>技藝之死</b><div class="def">定義：人不再親手做這件事。就像手洗衣服、手抄書，事情還在，但不再由人的手完成。</div><div class="ans">答案：<em>手寫程式已經死了；逐行 review 正在死。</em></div><ul>
<li>2025 Q4（Opus 4.5 之後）lab 內部先不再親手寫。2026 Q1 老將跟上：antirez「自己動手寫已不再合理」，Torvalds「把中間人，也就是我自己，拿掉」。</li>
<li>DHH（2026 Q3）：「鉛筆放下了，手寫程式碼已不再是具經濟可行性的技能。」</li>
<li>逐行 review 從 2026 Q2 開始被測試和指標取代（Uncle Bob、Charity Majors），但在資料中還沒過半。</li></ul></div>
<div style="--c:${C(3)}"><div class="dn">第二種死</div><b>職業之死</b><div class="def">定義：以「軟體工程師」為業的人數或職缺大幅、持續下降，或這個職稱消失。</div><div class="ans">答案：<em>目前仍是預言，尚未發生。</em></div><ul>
<li>已到期的極端預言沒有應驗（Mostaque 說外包和三級程式設計師一兩年內消失）。</li>
<li>正在發生的是溫和版本：個別公司縮編或凍結招聘（Benioff），新人與實習先受衝擊，中階最難適應。</li>
<li>關鍵預言集中在 2026 年底到 2027 年（見下表），反方預言則說人數會更多（Chollet、Scott Wu、Jensen）。職稱可能先死，人數不一定。</li></ul></div>
<div style="--c:${C(2)}"><div class="dn">第三種死</div><b>活動之死</b><div class="def">定義：不再需要有人決定軟體要做什麼、確認它是對的、為它負責，也就是「開發」這件事本身被完全自動化。</div><div class="ans">答案：<em>沒有死，也看不到近期會死。</em></div><ul>
<li>資料中需求／設計幾乎全在 S1（人定義）。連最激進的人都把人放在「定義與負責」：Cherny 說每個人都會變成 PM，Uncle Bob 說要「從更高的層次管理」。</li>
<li>Dario 也區分「寫完所有程式碼」和「端到端完成工程師的任務」。AI 2027 的 AC 里程碑（公司寧願解雇所有工程師）在最新估計中仍未到。</li>
<li>反而是做軟體的人變多了：Cherny 說會多 100 倍，Kent Beck 說每家小企業都成為軟體公司。</li></ul></div>
</div>
<p><b>一句話：</b>寫程式的「手」死了，寫程式的「職業」正在被重新定義而且可能縮小，但做軟體的「事」反而擴散到更多人身上。</p>
<h3>第二種死的證據：職缺預言（誰說、何時說、說會在何時發生）</h3>
<p class="mute">「到期」是以今天（${new Date().toISOString().slice(0,7)}）對照預言的目標時間。點人名可以看原話和來源。</p>
<div class="chart" style="overflow:auto"><table class="mig jobs"><thead><tr><th>說的人</th><th>何時說</th><th>預言目標</th><th>說了什麼</th><th>對照現況</th></tr></thead><tbody class="jobrows"></tbody></table></div>
<div class="key"><b>要追蹤的時間點：</b>2026 年底（AI 2027「初階市場動盪」、Cherny「工程師頭銜開始消失」）和 2027 年 7 月（AI 2027「招募幾乎停止」）。下一版簡報要回頭檢查這些預言。</div></div>`,root=>{
  const now=new Date().toISOString().slice(0,7);
  const R=[
   ['emad-mostaque-2023-07-18-02','2025','down','到期。資料中沒有任何人描述外包或三級程式設計師已經消失，未應驗。'],
   ['emad-mostaque-2023-07-03-01','2028','down','未到期。但 2026 年仍有大量程式設計師；轉變是「不手寫」，而不是「沒有人」。'],
   ['aifutures-2025-04-03-late2026','2026 年底','down','即將到期。Hassabis 也預言 2026 年初階與實習會受衝擊，Kent Beck 描述企業反射式縮招；但資料中還沒有「市場動盪」的直接數據。'],
   ['demis-hassabis-2026-01-20-01','2026','down','進行中。資料中只有零星現況（凍結招聘、縮編）。'],
   ['boris-cherny-2026-02-19-01','2026 年底','down','未到期。Cherny 自己在 2026 Q2 改口：「我不認為我們還會叫他們工程師，但寫程式的人會多 100 倍。」'],
   ['aifutures-2025-04-03-jul2027-hiring','2027 年 7 月','down','未到期。作者之後把相關時間線往後延；最新 AC 估計為 2027 年 11 月。'],
   ['sam-altman-2025-03-01','未定','down','沒有時間點，無法驗證。'],
   ['dario-amodei-2026-02-13-03','未定','down','沒有時間點；他把它描述成光譜的另一端。'],
   ['aidigest-2026-06-26-timeline','2029 年前','down','未到期（薪資下降）。'],
   ['marc-benioff-2025-09-02-03','現況','down','已發生（單一公司縮編）：9,000 人減到約 5,000 人。'],
   ['jensen-huang-2026-06-07-06','現況','up','反方現況：產出太驚人，反而想雇更多工程師。'],
   ['francois-chollet-2024-06-11-02','2029','up','未到期。他在 2026 Q3 仍然維持「主要是增加需求」。'],
   ['scott-wu-2025-08-cheeky-more-engineers','2027–2029','up','未到期（傑文斯悖論）。'],
   ['amjad-masad-2026-08-platformer-jobs','未定','mix','工作會變多，但公司會變小，也一定會有裁員。'],
  ];
  root.querySelector('.jobrows').innerHTML=R.map(([id,h,dir,st])=>{const e=ALL.find(x=>x.id===id);if(!e)return '';
    return `<tr><td><a href="#" data-e="${esc(id)}"><b>${esc(e.person.replace(/[（(].*/,''))}</b></a></td><td>${esc(e.date.slice(0,7))}</td><td><span class="tag" style="color:${dir==='down'?C(4):dir==='up'?C(2):C(3)}">${dir==='down'?'↓':dir==='up'?'↑':'↕'} ${esc(h)}</span></td><td>${esc(e.quote_zh)}</td><td class="mute">${esc(st)}</td></tr>`}).join('');
  root.querySelectorAll('.jobrows a[data-e]').forEach(a=>a.onclick=ev=>{ev.preventDefault();showEntry(ALL.find(x=>x.id===a.dataset.e))});
});
slide('insight-jit','程式碼只是快取（推測）',`<div class="insight"><div class="kicker">INSIGHT · 7 · 推測 · 卡米哥</div><h2>程式碼只是快取</h2>
<p class="mute">這是卡米哥在本調查討論中（2026-10）提出的推測，不屬於公開發言，所以沒有列進時間軸。</p>
<div class="key"><b>核心主張：規格才是軟體本身，程式碼只是規格的快取。</b>
<ul>
<li>LLM 想要確定的結果時，就會自己寫程式來跑。即時寫、即時執行的程式碼，可能會佔一半以上。</li>
<li>規格一改，舊架構就可能不相容。照新規格整套重新生成，會比在現有程式碼上修補更便宜，因為基於現況做開發反而比較難。</li>
<li>所以每次開發都可能換語言、換框架。程式碼像機器語言，沒有人讀，只往效能優化。</li>
<li>需要的時候才生成。再激進一點：如果一套軟體每秒都有新的部署，是不是就不需要任何程式碼快取了？</li>
</ul></div>
<h3>把程式碼當快取，會發生什麼事</h3>
<ul>
<li><b>需要時才生成：</b>LLM 直接做一件事很貴，而且結果不確定。一旦需要確定性或要重複執行，就生成一段程式碼來做。</li>
<li><b>常用的留著：</b>同一份規格沒變，就重用上次生成的程式碼，不必每次重新生成。</li>
<li><b>規格變了就丟：</b>舊的程式碼直接作廢、重新生成，不去修補。這就是快取失效。</li>
<li><b>沒人讀：</b>快取的內容不需要給人看。越常用的部分，就越往效能優化，可讀性無所謂。</li>
<li><b>可以換實作：</b>重新生成時，換語言、換框架都可以，只要行為一樣。</li>
</ul>
<h3>三段光譜</h3>
<div class="chain">
<div style="--c:${C(2)}"><b>① 重新生成取代修補</b>規格改了就整套重生，可以換語言、換框架。</div><i>→</i>
<div style="--c:${C(3)}"><b>② 程式碼只是快取</b>需要時才生成，常用的留著，規格變了就丟。</div><i>→</i>
<div style="--c:${C(4)}"><b>③ 無快取</b>每個請求本身就是一份新規格，生成一次、跑一次就丟，「部署」這個概念也消失。</div>
</div>
<p class="mute">快取值不值得留＝同一版規格下，同一段程式被重複執行的次數。規格每秒都變、但流量很大時，快取仍然划算，只是壽命只有一秒。真正不需要快取的，是個人化、一次性的軟體：每個使用者、每個當下要的東西都不一樣。</p>
<h3>成立的條件</h3>
<ul>
<li><b>成本與延遲：</b>生成一段程式要幾秒，執行一個請求只要幾毫秒。要走到第 ③ 段，生成成本必須再降好幾個數量級。</li>
<li><b>行為一致：</b>每次生成的程式都可能不一樣，所以驗收不能只靠事後跑，必須內建在生成過程裡（型別、契約、形式化驗證）。驗收測試也必須跟語言、框架無關，是黑箱的，不然一換語言，測試就一起作廢。</li>
<li><b>資料與安全：</b>資料、schema 和對外介面不能每次重新生成，換架構時要遷移。每個請求都即時生成程式碼，攻擊面也會變大，prompt injection 會直接變成程式碼注入。</li>
</ul>
<h3>資料中的前兆</h3>
<ul>
<li>卡米哥（2025 Q1）：LLM 直接做資料轉換不能保證正確，叫它生成程式碼來轉換比較好，因為「對的地方就是 100% 正確，錯的位置可預期」。這是「要確定性就依賴程式」最早的版本。</li>
<li>卡米哥（2025 Q2）：叫 ChatGPT 扮演 LINE Bot 的 API server，把規格寫在 prompt 裡、丟 webhook request 給它，它就照規格回應。他問：「只要需求寫在 prompt 就可以直接試用了，根本就不用生 code？」這是第 ③ 段「無快取、LLM 本身就是服務」最早的版本。</li>
<li>卡米哥（2025 Q1、Q4）：優先讓 AI 複製程式碼而不是共用；改不動的專案「就預期該大幅度重寫了」；原型「溝通目的達成後就可以丟了」；網站應該讓 Agent 直接操作，前端只是終端機。</li>
<li>Fowler（2026 Q2）：遺留系統遷移，「直接搬到新平台」應該永遠是第一步。Emad（2026 Q1）：「一兩週內複製出任何一套軟體。」DHH（2026 Q2）：「系統是被固定住的黑盒子」這個概念，很可能很快就會過時。</li>
<li>Amjad（2024 Q3）：「那是目的碼。」Yegge 的智慧販賣機、Chollet 的「agentic coding 就是最佳化」，前提都是每次從規格重新求解。</li>
</ul>
<p><b>結論：</b>不管走到哪一段，長期保存的都只剩下規格、驗收、資料和對外介面，程式碼只是可以隨時丟掉重建的快取。如果這個推測成立，前面的「驗收框架」就不只是品管工具，而是軟體本身唯一長期保存的部分。</p>
<h3>下一步推論：所有的 service 都會變成 agent</h3>
<p>一個 service 拆開來，就是規格、資料、對外介面、驗收和程式碼快取。把這幾樣接起來的執行者，要負責收到請求、判斷快取能不能用、不能用就生成新的、跑驗收、留下紀錄。這個執行者就是 agent。所以：<b>service ＝ agent ＋ 規格 ＋ 資料 ＋ 程式碼快取</b>。</p>
<ul>
<li><b>Agent 是控制面，程式碼快取是資料面：</b>大部分請求還是直接打到快取的程式碼，因為這樣又快又便宜，結果也確定。只有快取沒命中、規格改了、或遇到新情況時，才由 agent 接手。從外面看，大部分時間還是「程式在跑」，只是程式不再是本體，而是 agent 的產物。</li>
<li><b>呼叫端也會變成 agent：</b>卡米哥說過，網站應該讓 Agent 直接操作，前端只是終端機（2025 Q4）；也說過與其做 GUI，不如做 API 讓客戶用 Claude Code 串（2026 Q1）。兩端都是 agent 的話，介面可以在每次呼叫時協商，不必事先固定（MCP 就是這個方向）。所以連「對外介面要長期保存」這一點也會鬆動。</li>
<li><b>最後不能動的錨點：</b>資料（狀態一定要延續）、權限與金流（誰能做什麼、誰付錢），以及責任。出事時要追得到責任，所以需要稽核紀錄：當時跑的是哪一版快取、依據哪一版規格。</li>
</ul>
<div class="key">程式碼只是快取 → service 變成 agent → 呼叫端也是 agent → 軟體之間是 agent 對 agent，固定的只剩資料、權限、金流和責任。</div>

<h3>前例：Voyager（2023）已經用「程式碼快取」玩 Minecraft</h3>
<p><a href="https://arxiv.org/abs/2305.16291" target="_blank" rel="noopener">Voyager: An Open-Ended Embodied Agent with Large Language Models</a>（Guanzhi Wang、Linxi "Jim" Fan、Anima Anandkumar 等，NVIDIA、Caltech 等，2023 年 5 月）。它是第一個在 Minecraft 裡由 LLM 驅動、沒有人介入、持續探索並學習新技能的 agent。它的動作不是按鍵，而是<b>自己寫的可執行程式</b>（JavaScript，透過 Mineflayer API 控制角色）。</p>
<div class="chain">
<div style="--c:${C(1)}"><b>① 自動課程</b>agent 依目前的狀態和能力，自己決定下一個要學的任務。</div><i>→</i>
<div style="--c:${C(3)}"><b>② 查技能庫</b>每個技能都是一段程式，用「技能描述」的 embedding 當索引，遇到類似情況就取出重用。</div><i>→</i>
<div style="--c:${C(4)}"><b>③ 迭代生成</b>沒有合適的技能就由 GPT-4 寫新程式，再根據遊戲環境回饋和執行錯誤反覆修正。</div><i>→</i>
<div style="--c:${C(2)}"><b>④ 自我驗收</b>另一個 GPT-4 當評審，判斷任務有沒有完成；失敗時還會建議怎麼改。</div><i>→</i>
<div style="--c:${C(3)}"><b>⑤ 存回技能庫</b>通過驗收的程式存成新技能。簡單的技能可以組合成複雜的技能。</div>
</div>
<div class="chart" style="overflow:auto"><table class="mig jobs"><thead><tr><th>Voyager</th><th>「程式碼只是快取」的對應</th></tr></thead><tbody>
<tr><td>技能庫：一段段可執行程式</td><td>程式碼快取</td></tr>
<tr><td>用技能描述的 embedding 查找</td><td>用規格查快取</td></tr>
<tr><td>找不到就由 GPT-4 寫新程式</td><td>快取沒命中就生成</td></tr>
<tr><td>環境回饋、執行錯誤、評審 GPT-4</td><td>驗收</td></tr>
<tr><td>自動課程：自己決定下一步</td><td>agent 當控制面</td></tr>
<tr><td>技能可以組合成更複雜的技能</td><td>快取可以重用、可以疊加</td></tr>
</tbody></table></div>
<p>論文報告的結果：和先前最好的方法相比，取得的獨特物品多 3.3 倍、移動距離長 2.3 倍、解鎖關鍵科技樹里程碑最多快 15.3 倍。把技能庫帶到新的 Minecraft 世界，也能用來解決沒見過的任務。</p>
<div class="key"><b>和本頁推測的差別：</b>Voyager 證明了「agent ＋ 程式碼快取 ＋ 驗收」在 2023 年就行得通。但 Minecraft 的規則不會變，所以它的技能是累積式的，幾乎不會失效，只會越存越多。本頁推測的重點在另一半：<b>規格會變，快取要失效、丟掉重建</b>，甚至每次換語言、換框架。這一半在 Voyager 裡沒有出現，才是這個推測的新意。</div>

<h3>終點：寫程式的概念消失，變成新的常識</h3>
<p>卡米哥的推論：當程式碼只是快取，「寫程式」這個步驟對使用者來說就看不見了。對電腦提出需求，電腦就應該立即照需求完成工作，這會變成一種新的常識。等工程師開發，反而會被當成不正常。</p>
<ul>
<li><b>歷史上有類似的例子：</b>「計算員」曾是一種職業，電腦出現後「計算」變成按一下就有；雲端文件自動儲存，年輕一輩已經不太有「存檔」的習慣；對多數開發者來說，「編譯」也已經半隱形。一件事被機器吸收後，連概念都會跟著淡出。</li>
<li><b>資料中已經有人往這個方向說：</b>${pl('andrej-karpathy','Karpathy')}（2023）：「最熱門的新程式語言是英文。」${pl('jensen-huang','Jensen Huang')}（2023）：「現在人人都是程式設計師，你只要對電腦說話就行了。」${pl('satya-nadella','Nadella')}（2023）：每次對 ChatGPT 下提示，本質上就是在寫程式。${pl('dhh','DHH')}（2026）：最美的程式語言是英文。${pl('boris-cherny','Cherny')}（2026）：「軟體工程師」這個頭銜會開始消失，被「builder」取代。${pl('etrexkuo','卡米哥')}（2025）：叫 LLM 扮演 web server，「根本就不用生 code」。</li>
</ul>
<div class="key"><b>兩點補充：</b>
<ol style="margin:.3rem 0 0 1.1rem">
<li><b>消失的是「寫程式」，不是「把需求說清楚」。</b>需求講不清楚，電腦一樣做不出你要的東西。「寫程式」比較可能被「表達需求、確認結果」取代，成為每個人都要有的基本能力，就像現在每個人都要會打字、會搜尋。</li>
<li><b>「寫程式」會變成專業的少數，而不是完全消失。</b>就像現在還有人寫組合語言、開手排車，但那已經不是大眾的常識。做模型、做底層系統、做驗收框架的人，仍然會直接面對程式碼。</li>
</ol>
<p style="margin:.4rem 0 0">「立即完成」要成立，仍然要回到本頁的「成立的條件」：生成的成本和延遲要再降好幾個數量級，驗收也要內建在生成過程裡。</p></div>
</div>`);
slide('insight-rust','趨勢：讓 agent 用 Rust 重寫',`<div class="insight"><div class="kicker">INSIGHT · 3 · 趨勢</div><h2>趨勢：程式碼不必好讀之後，大家開始讓 agent 用 Rust 重寫</h2>
<p class="mute">前面的因果鏈走到「人不再逐行讀程式碼」。程式碼不必給人讀之後，2026 年出現了一連串真實案例：用 coding agent 把整個專案改寫成 Rust。</p>
<h3>真實案例</h3>
<div class="chart" style="overflow:auto"><table class="mig jobs"><thead><tr><th>時間</th><th>專案</th><th>做了什麼</th><th>怎麼確認是對的</th></tr></thead><tbody>
<tr><td>2025 Q2</td><td>${pl('kent-beck','Kent Beck')} 的 B+ tree</td><td>AI 直接寫 Rust 連試三次都卡在所有權系統；改成先寫 Python 版，再整套翻成 Rust（2025 年 11 月轉折點之前的模型）</td><td>先在 Python 裡讓完整測試通過，再逐一翻譯測試</td></tr>
<tr><td>2026 Q1</td><td>Ladybird 瀏覽器</td><td>用 Claude Code 和 Codex 把 JavaScript 引擎 LibJS 的 lexer、parser、AST 和 bytecode 產生器從 C++ 移植到 Rust，約兩週、2.5 萬行；人下了數百個小 prompt 引導</td><td>要求兩條管線逐位元組相同：Rust 版產生的 AST 和 bytecode 必須與 C++ 版完全一致，結果零回歸</td></tr>
<tr><td>2026 Q3</td><td>Bun（JavaScript 執行環境）</td><td>作者 ${pl('jarred-sumner','Jarred Sumner')} 用 agent 從 Zig 改寫成 Rust：約 11 天、新增約 100 萬行、以 API 價格估約 16.5 萬美元，Linux 啟動快 10%</td><td>與語言無關、有一百萬個斷言的測試套件，加上對抗式 code review</td></tr>
<tr><td>2026 Q3</td><td>${pl('dhh','DHH')} 的 HEY</td><td>重做成 6 個原生 App，後端由 agent 用 Rust 重寫；自評 CPU 少約 99%、記憶體少約 95%</td><td>DHH 不看程式碼，由編譯器、測試和實際結果把關</td></tr>
</tbody></table></div>
<h3>兩個理由，各自對應本調查的推測</h3>
<div class="chain">
<div style="--c:${C(4)}"><b>① 反正不讀，所以只要效能</b>DHH 一向最講究程式碼要美，對 Rust 的評價是：看它就像「往眼睛裡倒酸液」，要有血有肉的人用眼睛去看它「是不人道的」。但他還是選了 Rust：「我愛 Rust！Rust 太棒了……只要你永遠、永遠、永遠不必自己去看它。」<br><span class="mute" style="font-size:.78rem">「倒酸液」「不人道」出自 Global Nerdy 對 Rails World 2026 演講的轉述。</span><br>他說最美的程式語言是英文。<br><span class="mute">對應：程式碼不必給人讀，只往效能優化（後面「程式碼只是快取」頁的推測之一）。</span></div>
<div style="--c:${C(3)}"><b>② 編譯器變成免費的驗收</b>${pl('jarred-sumner','Jarred Sumner')} 列出 Bun 的 bug 大多是 use-after-free、double-free、錯誤路徑忘了釋放：「在 safe Rust 裡，這些都會變成編譯錯誤。」<br><span class="mute">對應：卡米哥在本調查討論中提出，適合 AI 的語言應該是靜態分析強、強型別的語言，因為問題能在執行前就被找出來。</span></div>
</div>
<h3>為什麼現在才發生</h3>
<ul>
<li><b>改寫變便宜了：</b>${pl('simon-willison','Simon Willison')}（2026 Q3）：「大家都知道絕對不要把大型軟體從頭重寫……但由當今前沿模型驅動的 coding agent 改變了這個算式。」</li>
<li><b>語言不再綁死：</b>${pl('mitchell-hashimoto','Mitchell Hashimoto')}（2026 Q2）：「程式語言以前是綁死的，現在越來越不是了。」</li>
<li><b>驗收已經和語言脫鉤：</b>Bun 能改寫，靠的是一套<b>跟語言無關</b>的測試套件；Ladybird 靠的是新舊版輸出逐位元組比對。長期保存的是驗收，程式碼可以換語言重建；最後一頁「程式碼只是快取」會把這個方向推到底。</li>
</ul>
<h3>Code review 的位置</h3>
<p>這些案例裡，沒有人逐行讀完新寫出來的程式碼。DHH 明說不看；Jarred Sumner 抽查了不少程式碼，但百萬行不可能逐行讀完，主要靠測試和對抗式審查；Ladybird 靠新舊版輸出比對。在本調查的階梯上，這些都算 <b style="color:${C(3)}">Code review S4</b>：不逐行審查，改用測試、編譯器或其他方式把關。</p>
</div>`);
slide('insight-why-rust','為什麼是 Rust',`<div class="insight"><div class="kicker">INSIGHT · 4 · 為什麼是 Rust</div><h2>為什麼是 Rust：各語言在執行前能抓到哪些錯</h2>
<p class="mute">AI 寫的程式碼沒人逐行讀，所以「執行前能自動抓出多少錯」就變成選語言的重要標準。下表比較主流語言在<b>編譯或靜態檢查階段</b>能擋下哪些錯誤（以語言本身和標準工具為準，不含額外的第三方分析器）。</p>
<div class="chart" style="overflow:auto"><table class="mig langs"><thead><tr><th>錯誤類型</th><th>Python／Ruby／JS</th><th>TypeScript</th><th>Go</th><th>Java／C#</th><th>Kotlin</th><th>C／C++</th><th>Rust</th></tr></thead><tbody>
<tr><td>語法錯誤</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td><td>✓</td></tr>
<tr><td>型別不符（字串傳給要整數的函式）</td><td>✗（型別提示可選）</td><td>✓（但 any、強制轉型會漏）</td><td>✓</td><td>✓</td><td>✓</td><td>✓（但可強制轉型）</td><td>✓</td></tr>
<tr><td>空值（null／nil）存取</td><td>✗</td><td>△（需開 strictNullChecks）</td><td>✗</td><td>✗</td><td>✓</td><td>✗</td><td>✓（沒有 null，用 Option）</td></tr>
<tr><td>忘了處理錯誤</td><td>✗</td><td>✗</td><td>△（可以忽略回傳的 err）</td><td>△（Java 受檢例外）</td><td>✗</td><td>✗</td><td>✓（Result 不處理會警告）</td></tr>
<tr><td>漏掉某種情況（列舉沒處理完）</td><td>✗</td><td>△</td><td>✗</td><td>△（新版 switch）</td><td>✓</td><td>✗</td><td>✓（match 必須窮舉）</td></tr>
<tr><td>記憶體錯誤（釋放後使用、重複釋放）</td><td>不會發生（有 GC）</td><td>不會發生（有 GC）</td><td>不會發生（有 GC）</td><td>不會發生（有 GC）</td><td>不會發生（有 GC）</td><td>✗</td><td>✓（所有權與借用檢查）</td></tr>
<tr><td>資料競爭（多執行緒同時改同一份資料）</td><td>✗</td><td>✗</td><td>✗（只有執行時偵測）</td><td>✗</td><td>✗</td><td>✗</td><td>✓（Send／Sync）</td></tr>
<tr><td>邏輯錯誤（算錯、需求理解錯）</td><td>✗</td><td>✗</td><td>✗</td><td>✗</td><td>✗</td><td>✗</td><td>✗</td></tr>
</tbody></table></div>
<p class="mute">✓ 編譯或靜態檢查時擋下　△ 部分擋下或要額外設定　✗ 要到執行時才發現。Haskell、OCaml 等語言在型別、空值、窮舉上也很強，但生態系和訓練資料比較少。</p>
<h3>Rust 多抓到的，主要是三類</h3>
<ul>
<li><b>記憶體錯誤，而且不用垃圾回收：</b>其他語言要嘛靠 GC（有執行時成本），要嘛像 C／C++ 一樣到執行時才爆。Rust 用所有權規則在編譯時就擋下，同時保有 C 等級的效能。這正是 Bun 的 bug 大宗，也是 DHH 能把 CPU 和記憶體大幅降下來的原因。</li>
<li><b>資料競爭：</b>多執行緒的錯誤最難重現、最難除錯，幾乎所有主流語言都要到執行時才可能發現；Rust 在編譯時就拒絕。</li>
<li><b>空值和沒處理的錯誤、沒處理完的情況：</b>沒有 null，錯誤用 Result 表示，列舉必須窮舉。AI 最常漏掉的「邊界情況」，在 Rust 裡會變成編譯錯誤。</li>
</ul>
<h3>為什麼這對 AI 特別重要</h3>
<ul>
<li><b>回饋迴路：</b>agent 寫完就編譯，編譯器的錯誤訊息很具體、常附修正建議，agent 可以自己讀、自己改，不需要人介入。編譯器等於一位不會累的審查者。</li>
<li><b>人的弱點正好被補上：</b>人寫 Rust 痛苦，是因為要一直滿足所有權規則；agent 不怕煩，可以反覆嘗試直到通過。DHH 說「只要不必自己看」，指的就是這點。</li>
<li><b>效能是附加的紅利：</b>沒有 GC、接近 C 的速度，讓「反正不讀，只要效能」的選擇更划算。</li>
</ul>
<div class="key"><b>但不是「所有問題」：</b>表格最後一列全部是 ✗。邏輯錯誤、需求理解錯誤，沒有任何語言能在編譯時抓到，仍然需要測試和驗收。所以 Rust 不是取代測試，而是讓測試只需要處理「邏輯」這一層：編譯器擋掉記憶體、型別、空值、競爭這些機械性錯誤，測試套件負責行為是否正確。這也是 Bun 和 Ladybird 兩層並用的原因。</div></div>`);}


// ---------- glossary ----------
const GLOSSARY=[
 {t:'SC（超人類程式設計師）',re:/\bSC\b|超人類程式設計師|Superhuman coder/i,cat:'AI 2027 的里程碑',d:'Superhuman Coder。AI 2027 的定義：在 AI 研究相關的程式任務上，能做到最頂尖人類程式設計師的工作，而且更快、便宜到可以同時跑大量副本的 AI 系統。原版情境預測在 2027 年 3 月達成。'},
 {t:'AC（自動化程式設計師）',re:/\bAC\b|自動化程式設計師|Automated Coder/i,cat:'AI 2027 的里程碑',d:'Automated Coder。AI Futures Project 在 2026 年的時間線更新中使用：AGI 公司寧可解雇所有人類軟體工程師，也不願停止用 AI 做軟體工程的那個時間點。'},
 {t:'SAR（超人類 AI 研究員）',re:/\bSAR\b|超人類 AI 研究員/,cat:'AI 2027 的里程碑',d:'Superhuman AI Researcher。和 SC 一樣，但涵蓋所有認知型的 AI 研究任務（不只寫程式）。原版預測 2027 年 8 月。'},
 {t:'SIAR（超智慧 AI 研究員）',re:/\bSIAR\b|超智慧 AI 研究員/,cat:'AI 2027 的里程碑',d:'Superintelligent AI Researcher。在 AI 研究上遠勝最頂尖人類研究員的 AI。原版預測 2027 年 11 月。'},
 {t:'ASI（超人工智慧）',re:/\bASI\b|超人工智慧/,cat:'AI 2027 的里程碑',d:'Artificial Superintelligence。在每一項認知任務上都遠勝最頂尖人類的 AI。原版預測 2027 年 12 月。'},
 {t:'AGI（通用人工智慧）',re:/\bAGI\b|通用人工智慧/,cat:'AI 2027 的里程碑',d:'Artificial General Intelligence。大致指能做大多數人類認知工作的 AI；各方定義不一致，所以不同人說的「AGI 何時到來」常常不是同一件事。'},
 {t:'OpenBrain／Agent-1、2、3',re:/OpenBrain|Agent-[123]/,cat:'AI 2027 的里程碑',d:'AI 2027 情境裡虛構的領先 AI 公司與它依序推出的模型，不是真實存在的公司或產品。'},
 {t:'中位數 vs 眾數',re:/中位數|眾數|median|modal/i,cat:'預測方法',d:'中位數：預測者認為「之前發生與之後發生的機率各一半」的時間點。眾數：預測者認為「最可能」的單一年份。AI 2027 後來加註：2027 是眾數，中位數其實更晚。'},
 {t:'時間跨度（time horizon）',re:/時間跨度|time horizon|任務長度/i,cat:'預測方法',d:'METR 的指標：AI 代理能以 50% 成功率完成「人類專家需要多久才能做完」的任務長度。METR 2025 年 3 月報告：這個長度在 2019–2024 年大約每 7 個月倍增。'},
 {t:'倍增時間',re:/倍增/,cat:'預測方法',d:'某個指標（例如時間跨度）變成兩倍所需的時間。倍增時間越短，代表進步越快。'},
 {t:'AI 研發進展乘數',re:/進展乘數|progress multiplier|快 50%/i,cat:'預測方法',d:'AI 2027 的用語：例如「1.5 倍」代表有 AI 協助時，一週能做到原本 1.5 週的 AI 研究進度。屬於 AI 研發，不是一般軟體開發。'},
 {t:'RCT（隨機對照試驗）',re:/\bRCT\b|隨機對照/,cat:'預測方法',d:'把受試者隨機分組比較的實驗方法。METR 2025 年 7 月的 RCT 發現：資深開源開發者使用當時的 AI 工具，完成任務反而多花 19% 的時間。'},
 {t:'預測市場（Manifold）',re:/Manifold|預測市場/,cat:'預測方法',d:'讓大量參與者對未來事件下注或給機率的平台，用群眾預測的彙總當作預測值。'},
 {t:'LLM（大型語言模型）',re:/\bLLM\b|大型語言模型/,cat:'AI 開發用語',d:'Large Language Model。用大量文字訓練、能理解與產生文字（包括程式碼）的模型，例如 GPT、Claude、Gemini。'},
 {t:'Agent（AI 代理）',re:/\bagents?\b|代理|Agentic/i,cat:'AI 開發用語',d:'能自己規劃步驟、呼叫工具（讀寫檔案、執行指令、查資料），連續完成多步驟任務的 AI，不只是一問一答。'},
 {t:'Vibe coding',re:/vibe ?coding/i,cat:'AI 開發用語',d:'Andrej Karpathy 在 2025 年 2 月提出的說法：完全順著感覺讓 AI 寫程式，接受它的修改、幾乎不看程式碼本身。他自己說適合拋棄式的週末專案。'},
 {t:'Agentic engineering',re:/agentic engineering/i,cat:'AI 開發用語',d:'Karpathy 在 2026 年初用來和 vibe coding 區分的說法：由人規劃、指揮並監督多個 AI 代理完成工程工作，仍然重視品質與理解。'},
 {t:'Prompt（提示詞）',re:/\bprompts?\b|提示詞/i,cat:'AI 開發用語',d:'給 AI 的指示文字。'},
 {t:'Function calling',re:/function calling/i,cat:'AI 開發用語',d:'OpenAI 在 2023 年 6 月推出的 API 功能：模型可以輸出結構化的「呼叫某個函式」請求，讓程式去執行，是 AI 代理使用工具的基礎。'},
 {t:'MCP（Model Context Protocol）',re:/\bMCP\b/,cat:'AI 開發用語',d:'Anthropic 在 2024 年 11 月提出的開放協定，讓 AI 應用用統一方式連接外部工具與資料來源（MCP Server 提供工具，MCP Host／Client 是使用工具的 AI 應用）。'},
 {t:'SWE-bench／SWE-bench Verified',re:/SWE-bench/i,cat:'AI 開發用語',d:'用真實 GitHub issue 測 AI 修 bug 能力的基準：模型要產生能通過測試的修改。Verified 是經人工確認題目可解的子集。'},
 {t:'Code review',re:/code review|逐行 review|程式碼審查/i,cat:'AI 開發用語',d:'合併程式碼前由他人檢查正確性、可讀性與安全性。本簡報特別追蹤「逐行人工審查」是否被測試、規格、AI 審查等其他稽核方式取代。'},
 {t:'TDD（測試驅動開發）',re:/\bTDD\b|測試驅動/,cat:'AI 開發用語',d:'Test-Driven Development，先寫測試再寫程式的開發方法，由 Kent Beck 推廣。'},
 {t:'DORA 報告',re:/\bDORA\b/,cat:'AI 開發用語',d:'Google 的 DevOps Research and Assessment 團隊每年發表的軟體交付研究報告。'},
 {t:'GitHub Copilot',re:/Copilot/,cat:'開發工具',d:'GitHub 的 AI 寫程式助手，從程式碼自動補全起家，後來加入聊天、代理模式與程式碼審查。'},
 {t:'Cursor／Windsurf',re:/Cursor|Windsurf/,cat:'開發工具',d:'內建 AI 的程式編輯器（IDE），可以讓 AI 跨多個檔案修改程式並執行指令。'},
 {t:'Claude Code',re:/Claude Code|\bCC\b/,cat:'開發工具',d:'Anthropic 的命令列 AI 寫程式代理，能在專案中自行讀寫檔案、執行指令與測試。本簡報中「CC」指它（依上下文推測）。'},
 {t:'Codex',re:/\bCodex\b/,cat:'開發工具',d:'OpenAI 的 AI 寫程式代理產品（包含命令列與雲端版本）。'},
 {t:'Devin',re:/\bDevin\b/,cat:'開發工具',d:'Cognition 在 2024 年 3 月推出、以「自主 AI 軟體工程師」為訴求的代理。'},
 {t:'退守程度（光譜 0–4）',re:/退守|光譜|全手動|全自動/,cat:'本簡報自訂的指標',d:'本調查自訂：依一個人說話當下「承認 AI 已攻下多少」把發言放在光譜上——0 全手動、1 AI 當助手、2 AI 起草人逐項確認、3 AI 主導人審查驗收、4 全自動。是編輯判斷，不是量測值。'},
 {t:'AI 2027 預測曲線',re:/AI 2027 預測曲線|橘色虛線/,cat:'本簡報自訂的指標',d:'把 AI 2027 原版情境在各時間點描述的狀態，對應到同一條光譜（2025 年中 2.5、2026 年底 3.5、2027 年 3 月起 4）。這個對應是本調查的判斷，不是 AI 2027 自己的說法。'},
 {t:'攻破程度（0–4 級）',re:/攻破|攻陷/,cat:'本簡報自訂的指標',d:'軟體開發週期各階段被 AI 拿下的程度：0 未涉入、1 建議／補全、2 起草人確認、3 主導人抽查驗收、4 自主人只設界線。編輯判斷，附理由與信心。'},
];
const GLOSS_CATS=['AI 2027 的里程碑','預測方法','AI 開發用語','開發工具','本簡報自訂的指標'];
slide('glossary','名詞解釋',`<div class="kicker">GLOSSARY</div><h2>先認識這些名詞</h2><p class="lead" style="margin:0 0 .6rem">之後每一頁的右下角也會列出該頁出現的名詞。</p><div class="glossgrid">${GLOSS_CATS.map(c=>`<div class="card"><h3>${c}</h3>${GLOSSARY.filter(g=>g.cat===c).map(g=>`<div class="gi"><b>${esc(g.t)}</b><div>${esc(g.d)}</div></div>`).join('')}</div>`).join('')}</div>`);
const glossEl=document.createElement('aside');glossEl.id='gloss';document.body.appendChild(glossEl);
let glossOpen=true;try{glossOpen=localStorage.getItem('glossOpen')!=='0'}catch(e){}
function updateGloss(el){
  if(!el||el.id==='s-glossary'||el.id==='s-title'){glossEl.hidden=true;return}
  const txt=el.textContent||'';const hits=GLOSSARY.filter(g=>g.re.test(txt));
  if(!hits.length){glossEl.hidden=true;return}
  glossEl.hidden=false;
  glossEl.innerHTML=`<button class="gtog">${glossOpen?'▾':'▸'} 本頁名詞（${hits.length}）</button>${glossOpen?`<div class="glist">${hits.map(g=>`<div class="gi"><b>${esc(g.t)}</b><div>${esc(g.d)}</div></div>`).join('')}</div>`:''}`;
  glossEl.querySelector('.gtog').onclick=()=>{glossOpen=!glossOpen;try{localStorage.setItem('glossOpen',glossOpen?'1':'0')}catch(e){}updateGloss(el)};
}


// ---------- process-by-process discussion (who does / who checks) ----------
const PROC=[
 {k:'Code review',id:'proc-review',name:'Code review（程式碼審查）',st:['人類開發、人類 review','人類開發、AI review','AI 開發、人類 review','AI 開發、AI review（人只看結果）','不 review 了'],turn:3,turnText:'大家開始認為可以不用人逐行 review'},
 {k:'寫程式',id:'proc-code',name:'寫程式',st:['人手寫','人寫、AI 補全／建議','AI 寫、人逐行看','AI 寫、人只看結果或測試','AI 自主寫、人不看'],turn:2,turnText:'大家開始認為程式主要由 AI 來寫'},
 {k:'測試',id:'proc-test',name:'測試',st:['人寫測試、人判讀','人寫測試、AI 協助','AI 寫測試、人審','AI 寫並自跑測試、人看結果','全自動、不經人'],turn:2,turnText:'大家開始認為測試主要由 AI 來寫'},
 {k:'除錯',id:'proc-debug',name:'除錯',st:['人除錯','人除錯、AI 協助','AI 除錯、人確認','AI 除錯並驗證、人看結果','AI 自主修復、不經人'],turn:2,turnText:'大家開始認為除錯主要交給 AI'},
 {k:'需求/設計',id:'proc-design',name:'需求與設計',st:['人定義','人定義、AI 協助','AI 起草、人決定','AI 決定、人驗收','AI 自主決定'],turn:2,turnText:'大家開始認為需求與設計可由 AI 起草'},
 {k:'文件',id:'proc-docs',name:'文件／註解',st:['人寫','人寫、AI 協助','AI 寫、人審','AI 寫、人只看結果','AI 自主產生、不經人'],turn:2,turnText:'大家開始認為文件主要由 AI 來寫'},
 {k:'維運/部署',id:'proc-ops',name:'部署與維運',st:['人操作','人操作、AI 協助','AI 操作、人核准','AI 操作並驗證、人看結果','AI 自主部署、不經人'],turn:2,turnText:'大家開始認為部署維運可交給 AI 操作'},
 {k:'維護/重構',id:'proc-maint',name:'維護／重構／遷移',st:['人做','人做、AI 協助','AI 做、人審','AI 做、人只看結果','AI 自主維護、不經人'],turn:2,turnText:'大家開始認為維護重構主要交給 AI'}];
const STAGE_COLOR=['#64748b','#38bdf8','#22c55e','#f59e0b','#e4572e'];
const GCOLOR={'經典軟體工程大老':'#38bdf8','AI 實驗室與研究員':'#a78bfa','科技公司領袖':'#f472b6','創辦人與新創圈':'#34d399','AI 預測團隊與網站':'#f5b942','使用者自己的帳號':'#ffffff'};
const stIdx=v=>v?(+String(v).replace('S',''))-1:null;
// 推論：說「AI 寫程式」（寫程式 S3+）卻沒講 review 的發言，Code review 至少在 S3（已不是人類開發）
let INFER=true;try{INFER=localStorage.getItem('procInfer')!=='0'}catch(_){}
function procPoints(k){
  const pts=ALL.filter(e=>e.process_stages&&e.process_stages[k]&&stIdx(e.process_stages[k].stage)!=null&&FILTER.groups.has(e.group)).map(e=>({e,s:stIdx(e.process_stages[k].stage),pred:e.process_stages[k].kind==='predicted',ps:e.process_stages[k]}));
  if(k==='Code review'&&INFER){
    ALL.forEach(e=>{const w=e.process_stages&&e.process_stages['寫程式'];if(!w||(e.process_stages[k])||!FILTER.groups.has(e.group))return;const wi=stIdx(w.stage);if(wi==null||wi<2)return;
      const pred=w.kind==='predicted';
      // 已明確說過 review S3+ 的人，之後的推論點不會把他往回拉
      if(pts.some(p=>!p.inf&&p.e.slug===e.slug&&p.pred===pred&&p.s>=2&&+p.e._d<=+e._d))return;
      pts.push({e,s:2,pred,inf:true,ps:{stage:'S3',kind:w.kind,confidence:w.confidence,basis_zh:`推論：這句話把寫程式放在 ${w.stage}「${PROC.find(P=>P.k==='寫程式').st[wi]}」，程式已由 AI 寫，所以 Code review 至少在 S3（不再是「人類開發」）。原判斷：${w.basis_zh||''}`}})});
  }
  return pts.sort((a,b)=>a.e._d-b.e._d)}
const qKey=d=>`${d.getFullYear()} Q${Math.floor(d.getMonth()/3)+1}`;
function yearMajority(P,pts){
  const pres=pts.filter(p=>!p.pred);const yrs=[...new Set(pres.map(p=>p.e._d.getFullYear()))].sort();
  return P.st.map((_,i)=>{for(const y of yrs){const g=pres.filter(p=>p.e._d.getFullYear()===y);if(g.length<3)continue;const sh=g.filter(p=>p.s>=i).length/g.length;if(sh>0.5)return {y,share:sh,n:g.length}}return null});
}
// positions of all people as of date d (latest PRESENT statement on or before d)
function positionsAt(pts,d){const m=new Map();pts.forEach(p=>{if(!p.pred&&+p.e._d<=+d)m.set(p.e.slug,p.s)});return m}
function distBar(pos){const n=pos.size;if(!n)return '';const c=[0,0,0,0,0];pos.forEach(s=>c[s]++);
  return `<span class="dbar" title="${c.map((x,i)=>`S${i+1}：${x}`).join('　')}（共 ${n} 人）">${c.map((x,i)=>x?`<i style="flex:${x};background:${STAGE_COLOR[i]}"></i>`:'').join('')}</span>`}
function procSlideHtml(P){return `<div class="kicker">PROCESS · ${esc(P.k)}</div><h2>${esc(P.name)}：從「${esc(P.st[0])}」到「${esc(P.st[4])}」</h2>
  <div class="turn"></div>
  <div class="ladder">${P.st.map((t,i)=>`<span style="--c:${STAGE_COLOR[i]}"><b>S${i+1}</b> ${esc(t)}</span>`).join('<i>→</i>')}</div>
  <h3 style="margin:.9rem 0 .3rem">目前位置：每個人最後一次描述現況時站在哪一階段</h3><div class="board"></div>
  <h3 style="margin:1rem 0 .3rem">逐人遷移表：第一次說出每個階段的時間，以及說這句話時大家的分布</h3>
  <div class="legend"><span>實線格＝描述當時的現況</span><span>◇ 虛線格＝預言（以說出口的日期計）</span><span>格內色條＝那一天所有已發言者當時所在階段的分布</span><span>點日期展開原話</span><span class="inf-l" style="color:#9aa3b2">回擺只算同一人前後兩則「描述現況」的發言，而且談的是同一件事；◇ 預言不和現況比較；下降但談的範圍不同或只是評分粒度差異的，在路徑上標 ≠（滑過可看理由），不算倒退</span>${P.k==='Code review'?'<span class="inf-l">斜線格「推論」＝沒講 review，但說了 AI 寫程式（寫程式 S3+），所以至少在 S3</span><label class="inftg"><input type="checkbox" class="infcb"> 包含推論</label>':''}</div>
  <div class="ptable"></div>
  <h3 style="margin:1rem 0 .3rem">每一年的說法分布（只算描述現況的）</h3><div class="chart pshare"></div>
  <details class="adv"><summary>進階：時間軸散點圖</summary><div class="toolbar tb-proc"></div><div class="chart pchart-proc"></div></details>`}
function renderProc(root,P){
  mountFilter(root);
  const cb=root.querySelector('.infcb');if(cb){cb.checked=INFER;cb.onchange=()=>{INFER=cb.checked;try{localStorage.setItem('procInfer',INFER?'1':'0')}catch(_){};const d=root.querySelector('details.adv');d.dataset.done='';d.open=false;renderProc(root,P)}}
  const pts=procPoints(P.k);
  const tEl=root.querySelector('.turn');
  if(!pts.length){tEl.innerHTML='<div class="pending">目前的篩選條件下，沒有談到這個流程的發言。</div>';['.board','.ptable','.pshare'].forEach(q=>root.querySelector(q).innerHTML='');return}
  const pres=pts.filter(p=>!p.pred);
  const first=P.st.map((_,i)=>pres.find(p=>p.s>=i)||null);const maj=yearMajority(P,pts);
  const nowY=new Date().getFullYear();
  const tp=first[P.turn],tm=maj[P.turn];
  const reachers=[...new Set(pres.filter(p=>p.s>=P.turn).map(p=>p.e.slug))].length;
  tEl.innerHTML=`<div class="turnbig"><div class="tb-l">轉變點</div><div><b>${esc(P.turnText)}（S${P.turn+1}「${esc(P.st[P.turn])}」以上）</b><br>
    最早有人說這已是現況：<b class="hl">${tp?esc(tp.e.date):'尚無'}</b>${tp?`（${esc(tp.e.person)}）`:''}　·　成為多數說法：<b class="hl">${tm?tm.y+' 年':'尚未過半'}</b>${tm?`（當年 ${tm.n} 則現況說法中 ${Math.round(tm.share*100)}%${tm.y===nowY?'；今年資料到 '+(new Date().getMonth()+1)+' 月':''}）`:''}　·　至今共 <b class="hl">${reachers}</b> 人說過已到此階段</div></div>`;
  // ---- per-person data
  const byP=d3.group(pts,p=>p.e.slug);
  const people=[...byP.entries()].map(([sl,a])=>{a=a.slice().sort((x,y)=>x.e._d-y.e._d);const pr=a.filter(p=>!p.pred);
    const firstsP=P.st.map((_,i)=>pr.find(p=>p.s===i)||null);const firstsF=P.st.map((_,i)=>a.find(p=>p.pred&&p.s===i)||null);
    const trail=[];pr.forEach(p=>{if(!trail.length||trail[trail.length-1].s!==p.s)trail.push(p)});
    trail.forEach((x,i)=>{if(i&&x.s<trail[i-1].s){x.rv=REG[`${sl}|${P.k}|${x.e.id}`]||null}});
    const back=trail.some(x=>x.rv===null||(x.rv&&x.rv.verdict==='real'));const single=trail.some(x=>x.rv&&x.rv.verdict==='single');
    const reach=pr.find(p=>p.s>=P.turn)||null,reachF=a.find(p=>p.pred&&p.s>=P.turn)||null;
    const latest=pr.length?pr[pr.length-1]:null,latestF=a.filter(p=>p.pred).pop()||null;
    return {sl,name:a[0].e.person.replace(/[（(].*/,''),group:a[0].e.group,a,firstsP,firstsF,trail,back,single,reach,reachF,latest,latestF}});
  people.sort((x,y)=>((x.reach?+x.reach.e._d:9e15)-(y.reach?+y.reach.e._d:9e15))||((x.reachF?+x.reachF.e._d:9e15)-(y.reachF?+y.reachF.e._d:9e15))||x.name.localeCompare(y.name));
  // ---- board
  const col=i=>people.filter(p=>p.latest?p.latest.s===i:(p.latestF&&p.latestF.s===i));
  root.querySelector('.board').innerHTML=`<div class="bcols">${P.st.map((t,i)=>`<div class="bcol" style="--c:${STAGE_COLOR[i]}"><div class="bh">S${i+1} ${esc(t)} <small>${col(i).length} 人</small></div>${col(i).map(p=>`<div class="chipc${p.latest?'':' onlypred'}" data-sl="${esc(p.sl)}" style="--g:${GCOLOR[p.group]||'#94a3b8'}"><b>${esc(p.name)}</b>${p.back?'<span class="tag warn">回擺</span>':''}${p.single?'<span class="tag">單次經驗</span>':''}
      <div class="trail">${p.trail.map(x=>`<span style="color:${STAGE_COLOR[x.s]}">S${x.s+1}${x.inf?'<sup title="推論">推</sup>':''}${x.rv&&x.rv.verdict!=='real'?`<sup class="rvs" title="${esc(REGV[x.rv.verdict]+'，不算倒退：'+x.rv.note_zh)}">≠</sup>`:''}</span><small>${esc(x.e.date.slice(0,7))}</small>`).join('<i>→</i>')}${p.latestF?`${p.trail.length?'　':''}<span class="pf">◇ 預言 S${p.latestF.s+1} <small>${esc(p.latestF.e.date.slice(0,7))}</small></span>`:''}</div></div>`).join('')}</div>`).join('')}</div>`;
  // ---- table
  const reachRank=new Map();P.st.forEach((_,i)=>{const seen=[];pres.forEach(p=>{if(p.s>=i&&!seen.includes(p.e.slug))seen.push(p.e.slug)});reachRank.set(i,seen)});
  const cell=(p,i,pred)=>{if(!p)return '';const pos=positionsAt(pts,p.e._d);const atOrAbove=[...pos.values()].filter(s=>s>=i).length;
    const rank=pred?null:reachRank.get(i).indexOf(p.e.slug)+1;
    return `<div class="tc${pred?' pred':''}${p.inf?' inf':''}" style="--c:${STAGE_COLOR[i]}"><a href="#" data-e="${esc(p.e.id)}" data-sl="${esc(p.e.slug)}">${pred?'◇ ':''}${esc(p.e.date)}</a>${p.inf?'<span class="tag inf">推論</span>':''}${distBar(pos)}<div class="tcn">${pred?'預言；':''}${rank?`第 ${rank} 位到 S${i+1}+　`:''}當時 ${atOrAbove}/${pos.size} 人在 S${i+1}+</div></div>`};
  root.querySelector('.ptable').innerHTML=`<div class="chart" style="overflow:auto"><table class="mig"><thead><tr><th>人物</th>${P.st.map((t,i)=>{const f=first[i];const ppl=new Set(pts.filter(p=>p.s===i).map(p=>p.e.slug)).size;
      return `<th style="color:${STAGE_COLOR[i]}">S${i+1} ${esc(t)}<div class="thsum">最早到此階段以上：${f?esc(f.e.person.replace(/[（(].*/,''))+' '+esc(f.e.date.slice(0,7)):'—'}<br>此階段以上過半：${maj[i]?maj[i].y+' 年':'—'}　說過：${ppl} 人</div></th>`}).join('')}</tr></thead>
    <tbody>${people.map(p=>`<tr data-sl="${esc(p.sl)}"><td><b>${esc(p.name)}</b><br><span class="mute" style="font-size:.72rem">${esc(p.group)}</span>${p.back?'<br><span class="tag warn">回擺</span>':''}${p.single?'<br><span class="tag">單次經驗</span>':''}</td>${P.st.map((_,i)=>`<td>${cell(p.firstsP[i],i,false)}${cell(p.firstsF[i],i,true)}</td>`).join('')}</tr><tr class="qrow" data-q="${esc(p.sl)}" hidden><td colspan="6"></td></tr>`).join('')}</tbody></table></div>`;
  const openQ=(sl,id)=>{const row=root.querySelector(`tr.qrow[data-q="${CSS.escape(sl)}"]`);const e=ALL.find(x=>x.id===id);if(!row||!e)return;
    const same=row.dataset.open===id&&!row.hidden;root.querySelectorAll('tr.qrow').forEach(r=>{r.hidden=true;r.dataset.open=''});if(same)return;
    const pp=pts.find(x=>x.e.id===id);const ps=pp?pp.ps:(e.process_stages&&e.process_stages[P.k]);
    row.firstElementChild.innerHTML=`<div class="qbox"><div class="meta"><b>${esc(e.person)}</b> · ${esc(e.date)}${ps?`　<b style="color:${STAGE_COLOR[stIdx(ps.stage)]}">${esc(ps.stage)} ${esc(P.st[stIdx(ps.stage)])}</b>${ps.kind==='predicted'?' <span class="tag">預言</span>':''}${pp&&pp.inf?' <span class="tag inf">推論</span>':''} <span class="tag">信心：${{high:'高',medium:'中',low:'低'}[ps.confidence]||''}</span>`:''}</div>
      <div class="qz">${esc(e.quote_zh)}</div>${e.quote_zh===e.quote_original?'':`<div class="qo">${esc(e.quote_original)}</div>`}${postImgs(e)}
      ${ps?`<div class="mute" style="font-size:.78rem">階段判斷：${esc(ps.basis_zh||'')}</div>`:''}<div class="meta">${e.source_url?`<a href="${esc(e.source_url)}" target="_blank" rel="noopener">${esc(e.source_title||'來源')}</a>`:esc(e.source_title||'')} · <a href="#" class="more">詳情</a></div></div>`;
    row.hidden=false;row.dataset.open=id;row.querySelector('.more').onclick=ev=>{ev.preventDefault();showEntry(e)}};
  root.querySelectorAll('.ptable a[data-e]').forEach(a=>a.onclick=ev=>{ev.preventDefault();openQ(a.dataset.sl,a.dataset.e)});
  root.querySelectorAll('.board .chipc').forEach(c=>c.onclick=()=>{const row=root.querySelector(`.ptable tr[data-sl="${CSS.escape(c.dataset.sl)}"]`);if(row){row.scrollIntoView({behavior:'smooth',block:'center'});row.classList.add('flash');setTimeout(()=>row.classList.remove('flash'),1500)}});
  // ---- yearly distribution
  const sh=root.querySelector('.pshare');sh.innerHTML='';const yrs=[...new Set(pres.map(p=>p.e._d.getFullYear()))].sort();
  if(yrs.length){const w2=Math.max(480,sh.clientWidth||900),h2=210,m2={t:12,r:16,b:30,l:44};
    const s2=d3.select(sh).append('svg').attr('viewBox',`0 0 ${w2} ${h2}`).attr('height',h2);
    const xb=d3.scaleBand().domain(yrs).range([m2.l,w2-m2.r]).padding(.3),yb=d3.scaleLinear().domain([0,1]).range([h2-m2.b,m2.t]);
    s2.append('g').attr('class','axis').attr('transform',`translate(0,${h2-m2.b})`).call(d3.axisBottom(xb).tickFormat(y=>y===nowY?`${y}（至 ${new Date().getMonth()+1} 月）`:y));
    s2.append('g').attr('class','axis').attr('transform',`translate(${m2.l},0)`).call(d3.axisLeft(yb).ticks(4).tickFormat(d3.format('.0%')));
    yrs.forEach(y=>{const g=pres.filter(p=>p.e._d.getFullYear()===y);let acc=0;[0,1,2,3,4].forEach(i=>{const n=g.filter(p=>p.s===i).length;if(!n)return;const v0=acc,v1=acc+n/g.length;acc=v1;
      s2.append('rect').attr('x',xb(y)).attr('width',xb.bandwidth()).attr('y',yb(v1)).attr('height',yb(v0)-yb(v1)).attr('fill',STAGE_COLOR[i]).attr('stroke','#0f1115')
        .on('mousemove',ev=>showTip(`<b>${y}</b>　S${i+1} ${esc(P.st[i])}：${n}／${g.length} 則`,ev)).on('mouseleave',hideTip);
      if((yb(v0)-yb(v1))>16)s2.append('text').attr('x',xb(y)+xb.bandwidth()/2).attr('y',(yb(v0)+yb(v1))/2+4).attr('text-anchor','middle').attr('font-size',11).attr('fill','#0f1115').attr('font-weight',700).text(`S${i+1} ${Math.round(n/g.length*100)}%`)});
      s2.append('text').attr('x',xb(y)+xb.bandwidth()+4).attr('y',m2.t+10).attr('font-size',10).attr('fill','#9aa3b2').text(`${g.length} 則`)});}
  // ---- advanced scatter (lazy)
  const det=root.querySelector('details.adv');det.ontoggle=()=>{if(det.open&&!det.dataset.done){det.dataset.done=1;procScatter(root,P,pts,tp)}};
}
function procScatter(root,P,pts,tp){
  const host=root.querySelector('.pchart-proc');host.innerHTML='';
  const w=Math.max(560,host.clientWidth||900),rh=56,m={t:22,r:16,b:28,l:290},h=m.t+5*rh+m.b;
  const svg=d3.select(host).append('svg').attr('viewBox',`0 0 ${w} ${h}`).attr('height',h);
  const x0=d3.scaleTime().domain([new Date(2023,0,1),new Date(2028,0,1)]).range([m.l,w-m.r]);let xs=x0;
  svg.append('defs').append('clipPath').attr('id','pc'+P.id).append('rect').attr('x',m.l).attr('y',0).attr('width',w-m.l-m.r).attr('height',h);
  const Y=i=>m.t+(4-i)*rh+rh/2;
  P.st.forEach((t,i)=>{svg.append('rect').attr('x',0).attr('y',m.t+(4-i)*rh).attr('width',w).attr('height',rh).attr('fill',i%2?'#ffffff05':'transparent');
    svg.append('text').attr('x',m.l-10).attr('y',Y(i)+4).attr('text-anchor','end').attr('font-size',11.5).attr('fill',STAGE_COLOR[i]).text(`S${i+1} ${t}`)});
  const gx=svg.append('g').attr('class','axis').attr('transform',`translate(0,${h-m.b})`);
  const body=svg.append('g').attr('clip-path',`url(#pc${P.id})`);
  const jit=new Map();pts.forEach(p=>{const k=p.s+'|'+qKey(p.e._d);const n=jit.get(k)||0;jit.set(k,n+1);p.j=((n%5)-2)*8});
  const dots=body.selectAll('g.pd').data(pts).join('g').attr('class','pd').style('cursor','pointer')
    .on('mousemove',(ev,p)=>showTip(`<b>${esc(p.e.person)}</b> · ${esc(p.e.date)}${p.pred?'（預言）':''}<br><b style="color:${STAGE_COLOR[p.s]}">S${p.s+1} ${esc(P.st[p.s])}</b><br>${esc((p.e.quote_zh||'').slice(0,110))}…`,ev)).on('mouseleave',hideTip).on('click',(ev,p)=>{hideTip();showEntry(p.e)});
  dots.append('circle').attr('r',6).attr('fill',p=>p.pred?'var(--bg)':GCOLOR[p.e.group]||'#94a3b8').attr('stroke',p=>GCOLOR[p.e.group]||'#94a3b8').attr('stroke-width',2);
  dots.append('text').attr('font-size',9).attr('fill','#cbd5e1').attr('dy',-9).attr('text-anchor','middle').text(p=>initials(p.e.person));
  function draw(){gx.call(d3.axisBottom(xs).ticks(8));dots.attr('transform',p=>`translate(${xs(p.e._d)},${Y(p.s)+p.j})`)}
  const zoom=d3.zoom().scaleExtent([1,30]).translateExtent([[m.l,0],[w-m.r,h]]).extent([[m.l,0],[w-m.r,h]]).on('zoom',ev=>{xs=ev.transform.rescaleX(x0);draw()});
  svg.call(zoom).on('dblclick.zoom',null);
  const tb=root.querySelector('.tb-proc');tb.innerHTML='';zoomButtons(tb,svg,zoom,()=>svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity));
  draw();
}
const PROC_USED=PROC.filter(P=>ALL.some(e=>e.process_stages&&e.process_stages[P.k]));
PROC_USED.forEach(P=>slide(P.id,P.name,procSlideHtml(P),(root)=>renderProc(root,P),true));
slide('sec-process','軟體開發流程逐一討論',`<div class="title-slide"><div class="kicker">PROCESS</div><h1 style="font-size:clamp(2.2rem,6vw,4.4rem)">軟體開發流程，逐一討論</h1><p class="lead">每個流程都用同一把尺：誰來做、誰來檢查——從「人做人檢查」到「AI 做、不檢查」五個階段。每一頁最上方標出轉變點：最早有人說這已是現況的時間，以及這成為多數說法的那一年（當年至少 3 則描述現況的說法、超過一半）。</p>
<div class="secnames">${PROC_USED.map(P=>`<a href="#${P.id}" class="chip">${esc(P.name)}</a>`).join('')}</div></div>`);

// ---------- final slide order ----------
{const order=['title','method','datasrc','glossary','sec-fc','ai2027',...FC_ORDER.map(s=>'fc-'+s),'fc-others',
  ...PERSON_SECTIONS.flatMap(s=>[s.id,...s.slugs.map(sl=>'p-'+sl)]),
  'sec-process','sdlc',...PROC_USED.map(P=>P.id),'modes','gantt','fortress','sec-analysis','insight-flow','insight-why','insight-rust','insight-why-rust','insight-next','insight-death','insight-jit','sources','todo'];
 const byId=new Map(slides.map(s=>[s.id,s]));const re=order.map(id=>byId.get(id)).filter(Boolean);
 slides.length=0;re.forEach(s=>slides.push(s));}

// ---------- deck engine ----------
const deck=$('#deck');let cur=-1;const rendered=new Set();
slides.forEach((s,i)=>{const el=document.createElement('section');el.className='slide';el.id='s-'+s.id;el.innerHTML=s.html;deck.appendChild(el);s.el=el});
function go(i,push){
  i=Math.max(0,Math.min(slides.length-1,i));if(i===cur)return;
  hideTip();
  slides.forEach((s,j)=>{s.el.classList.toggle('active',j===i);s.el.classList.toggle('before',j<i)});
  cur=i;const s=slides[i];
  if(s.render&&(!rendered.has(i))){try{s.render(s.el)}catch(err){console.error(err);s.el.insertAdjacentHTML('beforeend',`<div class="pending">此頁圖表載入失敗：${esc(err.message)}</div>`)}rendered.add(i)}
  $('#crumb').textContent=`軟體開發將死？ · ${s.title}`;
  setTimeout(()=>updateGloss(s.el),60);
  $('#progress i').style.width=(100*(i+1)/slides.length)+'%';
  $('#pageno').textContent=`${i+1} / ${slides.length}`;
  if(push!==false)history.replaceState(null,'','#'+s.id);
  s.el.scrollTop=0;
}
function goHash(){const id=location.hash.slice(1);
  if(id.startsWith('person/')){if(cur<0)go(0,false);openProfile(id.slice(7),true);return}
  if(!profEl.hidden){profEl.hidden=true;document.body.classList.remove('inprofile')}
  const i=slides.findIndex(s=>s.id===id);go(i<0?0:i,false)}
$('#prev').onclick=()=>go(cur-1);$('#next').onclick=()=>go(cur+1);
$('#btn-fs').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
function outline(open){const o=$('#outline');o.hidden=!open;if(open){$('#outline-list').innerHTML=slides.map((s,i)=>`<button data-i="${i}" class="${i===cur?'cur':''}">${i+1}. ${esc(s.title)}</button>`).join('');
  o.querySelectorAll('button').forEach(b=>b.onclick=()=>{outline(false);go(+b.dataset.i)})}}
$('#btn-outline').onclick=()=>outline($('#outline').hidden);
$('#outline').onclick=ev=>{if(ev.target.id==='outline')outline(false)};
addEventListener('keydown',ev=>{
  if(ev.target.tagName==='INPUT')return;
  const k=ev.key;
  if(k==='ArrowRight'||k==='PageDown'||(k===' '&&!ev.shiftKey)){ev.preventDefault();go(cur+1)}
  else if(k==='ArrowLeft'||k==='PageUp'||(k===' '&&ev.shiftKey)){ev.preventDefault();go(cur-1)}
  else if(k==='Home')go(0);else if(k==='End')go(slides.length-1);
  else if(k==='o'||k==='O')outline($('#outline').hidden);
  else if(k==='f'||k==='F')$('#btn-fs').click();
  else if(k==='Escape'){if(!profEl.hidden&&!$('#drawer').classList.contains('open'))closeProfile();else{closeDrawer();outline(false)}}
});
let tx=null;
deck.addEventListener('touchstart',e=>{tx=e.touches[0].clientX},{passive:true});
deck.addEventListener('touchend',e=>{if(tx==null)return;const dx=e.changedTouches[0].clientX-tx;tx=null;if(Math.abs(dx)>80&&!e.target.closest('svg'))go(cur+(dx<0?1:-1))},{passive:true});
addEventListener('hashchange',goHash);
let rt;addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{rendered.clear();const s=slides[cur];if(s.render){s.render(s.el);rendered.add(cur)}},250)});
goHash();
})();

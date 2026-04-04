import { useState, useRef, useEffect } from "react";

/* ── Tax bracket definitions (width, rate) ── */
const FED_BRACKETS=[[55867,.15],[55866,.205],[43173,.26],[65094,.29],[1e9,.33]];
const ONT_BRACKETS=[[51446,.0505],[51448,.0915],[47106,.1116],[70000,.1216],[1e9,.1316]];
function bTx(i,b){let t=0,r=i;for(const[w,rt]of b){t+=Math.min(r,w)*rt;r-=w;if(r<=0)break}return t}

/* CRA 2025 constants - not user-adjustable */
const CPP_RATE=0.0595,CPP_MAX=68500,CPP_EXEMPT=3500;
const EI_RATE=0.0158,EI_MAX=63200;
const FED_BPA=15705,ONT_BPA=11141;

function tTax(G){
  const f=Math.max(0,bTx(G,FED_BRACKETS)-FED_BPA*0.15);
  const o=Math.max(0,bTx(G,ONT_BRACKETS)-ONT_BPA*0.0505);
  const c=Math.max(0,Math.min(G,CPP_MAX)-CPP_EXEMPT)*CPP_RATE;
  const e=Math.min(G,EI_MAX)*EI_RATE;
  return{f,o,c,e,t:f+o+c+e};
}
function solveG(E){let G=E*1.5;for(let i=0;i<30;i++){const t=tTax(G);const n=E+t.t;if(Math.abs(n-G)<.5){G=n;break}G=n}return G}

/* ── Categories ── */
const CATS=[
  {key:"Housing",color:"#2a9d8f",items:[
    {k:"rent",l:"rent",s:100,d:2800},{k:"tIns",l:"tenant ins",s:10,d:25},
    {k:"rPrk",l:"parking",s:25,d:75},{k:"strg",l:"storage",s:10,d:0},
    {k:"hydr",l:"hydro",s:25,d:90},{k:"gas_",l:"gas/heat",s:10,d:50},
    {k:"watr",l:"water",s:10,d:0},{k:"inet",l:"internet",s:10,d:80}]},
  {key:"Food",color:"#457bb5",items:[
    {k:"groc",l:"groceries",s:50,d:700},{k:"dine",l:"dining out",s:25,d:200},
    {k:"deli",l:"takeout",s:25,d:100},{k:"coff",l:"coffee",s:10,d:70},
    {k:"snck",l:"snacks",s:10,d:40},{k:"alc_",l:"alcohol",s:10,d:50}]},
  {key:"Transport",color:"#8b5fb0",items:[
    {k:"carP",l:"car pmt",s:50,d:1200},{k:"chrg",l:"charging",s:10,d:80},
    {k:"cIns",l:"auto ins",s:25,d:280},{k:"mnt_",l:"maint",s:25,d:60},
    {k:"tire",l:"tires",s:10,d:30},{k:"cWsh",l:"car wash",s:5,d:20},
    {k:"park",l:"parking",s:25,d:75},{k:"reg_",l:"plates/reg",s:5,d:10},
    {k:"toll",l:"407 tolls",s:10,d:0}]},
  {key:"Household",color:"#7a8e5a",items:[
    {k:"clea",l:"cleaning",s:10,d:30},{k:"papr",l:"paper/bags",s:5,d:15},
    {k:"kitc",l:"kitchen",s:10,d:15},{k:"toil",l:"toiletries",s:10,d:40},
    {k:"ligh",l:"bulbs/batt",s:5,d:5},{k:"smAp",l:"sm. appliances",s:10,d:10}]},
  {key:"Personal",color:"#3a9e6e",items:[
    {k:"hair",l:"haircuts",s:10,d:80},{k:"skin",l:"skincare",s:10,d:40},
    {k:"cosm",l:"cosmetics",s:10,d:25},{k:"gym_",l:"gym",s:10,d:80}]},
  {key:"Clothing",color:"#6a8ab5",items:[
    {k:"clth",l:"clothes",s:25,d:100},{k:"shoe",l:"shoes",s:25,d:30},
    {k:"work",l:"work attire",s:25,d:25},{k:"drCl",l:"dry clean",s:10,d:15}]},
  {key:"Entertain",color:"#9a7ab0",items:[
    {k:"entr",l:"events",s:25,d:80},{k:"movi",l:"movies",s:10,d:30},
    {k:"hobb",l:"hobbies",s:25,d:50},{k:"dOut",l:"dining dates",s:25,d:60}]},
  {key:"Pet",color:"#d4845a",items:[
    {k:"pFoo",l:"food/treats",s:10,d:75},{k:"vet_",l:"vet",s:25,d:75},
    {k:"grmg",l:"grooming",s:10,d:90},{k:"pIns",l:"pet ins",s:10,d:50},
    {k:"flea",l:"flea/hw",s:10,d:40},{k:"pSup",l:"supplies",s:5,d:15},
    {k:"pBrd",l:"boarding",s:25,d:0}]},
  {key:"Bills",color:"#5b9ec9",items:[
    {k:"ph_2",l:"2 phones",s:10,d:120},{k:"strm",l:"streaming",s:5,d:45},{k:"apps",l:"apps/subs",s:5,d:20},
    {k:"clud",l:"cloud",s:5,d:10},{k:"news",l:"news",s:5,d:10},
    {k:"soft",l:"software",s:5,d:10}]},
  {key:"Medical",color:"#c95858",items:[
    {k:"dent",l:"dental",s:10,d:30},{k:"vis_",l:"vision",s:10,d:15},
    {k:"rx__",l:"prescriptions",s:10,d:20},{k:"supp",l:"supplements",s:10,d:30},
    {k:"ther",l:"therapy",s:25,d:0},{k:"walI",l:"walk-in",s:10,d:10}]},
  {key:"Insurance",color:"#8a7a5a",items:[
    {k:"lIns",l:"life ins",s:10,d:0},{k:"dIns",l:"disability",s:10,d:0}]},
  {key:"Gifts",color:"#b07a8a",items:[
    {k:"bday",l:"birthdays",s:10,d:40},{k:"holi",l:"holidays",s:25,d:60},
    {k:"char",l:"donations",s:10,d:0}]},
  {key:"Savings",color:"#c47a3a",items:[
    {k:"tfsa",l:"TFSA",s:50,d:250},{k:"rrsp",l:"RRSP",s:50,d:150},
    {k:"emrg",l:"emerg fund",s:50,d:100},{k:"inv_",l:"investing",s:50,d:0},
    {k:"vacF",l:"vacation",s:25,d:50}]},
];

const EC="#b8892a",TC="#7a8a7a",CC="#6a8e6a",EIC="#8a7a6a",FC="#7a6a8a",OC="#8a6a6a";
const CONNS=[
  {from:"g-exp",to:"eq2-Expenses",color:EC},
  {from:"g-tax",to:"tax-Tax",color:TC},
  {from:"tx-cpp",to:"def-cpp",color:CC},
  {from:"tx-ei",to:"def-ei",color:EIC},
  {from:"tx-fed",to:"def-fed",color:FC},
  {from:"tx-ont",to:"def-ont",color:OC},
  ...CATS.map(c=>({from:`eq2-${c.key}`,to:`d-${c.key}`,color:c.color})),
];

const INIT={};
CATS.forEach(c=>c.items.forEach(i=>{INIT[i.k]=i.d}));

/* ── Atoms ── */
function Pill({name,id,color}){
  return <span data-var={id} style={{...st.pill,borderColor:color,color}}>{name}</span>;
}
function Num({value,onChange,step=50,min=0,max=99999,pre="$",suf=""}){
  return(<span style={st.stepper}>
    <button style={st.sBtn} onClick={()=>onChange(Math.min(max,value+step))}>
      <svg width="10" height="4" viewBox="0 0 10 4"><path d="M1.5 3.5L5 .5L8.5 3.5" stroke="#b5ad9e" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>
    </button>
    <span style={st.sVal}>{pre}{value.toLocaleString()}{suf}</span>
    <button style={st.sBtn} onClick={()=>onChange(Math.max(min,value-step))}>
      <svg width="10" height="4" viewBox="0 0 10 4"><path d="M1.5.5L5 3.5L8.5.5" stroke="#b5ad9e" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>
    </button>
  </span>);
}
const Op=({c})=><span style={st.op}>{c}</span>;

export default function App(){
  const[s,setS]=useState(INIT);
  const up=(k,v)=>setS(p=>({...p,[k]:v}));

  const tots={};
  CATS.forEach(c=>{tots[c.key]=c.items.reduce((a,i)=>a+s[i.k],0)*12});
  const Ev=Object.values(tots).reduce((a,b)=>a+b,0);
  const Gv=solveG(Ev);
  const tax=tTax(Gv);
  const tEff=Gv>0?(tax.t/Gv*100):0;
  const $$=v=>"$"+Math.round(v).toLocaleString();

  const cRef=useRef(null),svgRef=useRef(null);
  useEffect(()=>{
    const draw=()=>{
      const cont=cRef.current,svg=svgRef.current;
      if(!cont||!svg)return;
      const cr=cont.getBoundingClientRect();
      svg.setAttribute("width",cr.width);svg.setAttribute("height",cr.height);
      while(svg.firstChild)svg.removeChild(svg.firstChild);

      /* markers - small clean triangles */
      const defs=document.createElementNS("http://www.w3.org/2000/svg","defs");
      CONNS.forEach(({from,color})=>{
        const m=document.createElementNS("http://www.w3.org/2000/svg","marker");
        m.setAttribute("id",`a-${from}`);m.setAttribute("markerWidth","6");m.setAttribute("markerHeight","4");
        m.setAttribute("refX","6");m.setAttribute("refY","2");m.setAttribute("orient","auto");
        m.setAttribute("markerUnits","userSpaceOnUse");m.setAttribute("overflow","visible");
        const ar=document.createElementNS("http://www.w3.org/2000/svg","path");
        ar.setAttribute("d","M0,0 L6,2 L0,4 Z");ar.setAttribute("fill",color);
        m.appendChild(ar);defs.appendChild(m);
      });
      svg.appendChild(defs);

      const mkPath=(d,color,from)=>{
        const p=document.createElementNS("http://www.w3.org/2000/svg","path");
        p.setAttribute("d",d);p.setAttribute("stroke",color);p.setAttribute("stroke-width","1.2");
        p.setAttribute("fill","none");p.setAttribute("opacity","0.5");
        p.setAttribute("marker-end",`url(#a-${from})`);
        svg.appendChild(p);
      };

      const resolve=(id)=>{
        const el=cont.querySelector(`[data-var="${id}"]`);
        if(!el)return null;
        const r=el.getBoundingClientRect();
        return{cx:r.left-cr.left+r.width/2,top:r.top-cr.top,bot:r.bottom-cr.top,left:r.left-cr.left};
      };

      /* resolve all arrows */
      const arrows=[];
      CONNS.forEach(conn=>{
        const s=resolve(conn.from),t=resolve(conn.to);
        if(!s||!t)return;
        arrows.push({...conn,s,t});
      });

      /* sort by vertical distance - longest connections get leftmost channels */
      arrows.sort((a,b)=>(b.t.top-b.s.bot)-(a.t.top-a.s.bot));

      const n=arrows.length;
      arrows.forEach((d,i)=>{
        const x1=d.s.cx, y1=d.s.bot;
        const x2=d.t.left-2, y2=d.t.top+(d.t.bot-d.t.top)/2;
        /* channel x: longest connections bow furthest left */
        const maxCh=cr.width<500?35:60;
        const ch=6+(n>1?i*(maxCh/(n-1)):maxCh/2);
        const r=8;
        /* stagger turn based on channel - rightmost channels turn first */
        const topY=y1+8+(ch-8)*0.12;

        const goLeft=x1-ch;
        const runDown=y2-topY;

        if(goLeft<r*2+4||runDown<r*2+4){
          mkPath(`M${x1},${y1} C${x1},${y1+(y2-y1)*0.5} ${x2-20},${y2} ${x2},${y2}`,d.color,d.from);
        } else {
          mkPath(
            `M${x1},${y1}`+
            ` L${x1},${topY-r}`+
            ` A${r},${r} 0 0,0 ${x1-r},${topY}`+
            ` L${ch+r},${topY}`+
            ` A${r},${r} 0 0,0 ${ch},${topY+r}`+
            ` L${ch},${y2-r}`+
            ` A${r},${r} 0 0,0 ${ch+r},${y2}`+
            ` L${x2},${y2}`,
            d.color,d.from);
        }
      });
    };
    const t=setTimeout(draw,150);
    window.addEventListener("resize",draw);
    return()=>{clearTimeout(t);window.removeEventListener("resize",draw)};
  });

  return(
    <div style={st.pg}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}body{background:#f6f4f0}
        button{background:none;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
        .cat-grid{display:flex;flex-direction:column;gap:10px;max-width:700px;margin:0 auto}
        @media(max-width:600px){
          .board-wrap{padding-left:40px!important;padding-right:8px!important}
        }
      `}</style>

      <div style={st.hero}>
        <div style={st.hL}>REQUIRED GROSS INCOME</div>
        <div style={st.hN}>{$$(Gv)}</div>
        <div style={st.hS}>{$$(Gv/12)} /mo · {tEff.toFixed(1)}% eff. tax</div>
      </div>

      <div ref={cRef} style={st.board} className="board-wrap">
        <svg ref={svgRef} style={st.svg}/>

        {/* REQUIRED GROSS INCOME */}
        <div style={st.rc}><div style={st.eq}>
          <div style={st.tag}>Required Gross Income</div>
          <div style={st.ml}>
            <span style={st.dv}>G</span> <Op c="="/>{" "}
            <Pill name="Expenses" id="g-exp" color={EC}/>{" "}<Op c="+"/>{" "}
            <Pill name="Tax" id="g-tax" color={TC}/>
          </div>
        </div></div>

        {/* TAX */}
        <div style={st.rc}><div style={st.eq}>
          <div style={st.tag}>Progressive Tax (ON + Federal)</div>
          <div style={{...st.ml,fontSize:14,marginBottom:4}}>
            <Pill name="Tax" id="tax-Tax" color={TC}/> <Op c="="/>{" "}
            <Pill name="Federal" id="tx-fed" color={FC}/>{" "}<Op c="+"/>{" "}
            <Pill name="Ontario" id="tx-ont" color={OC}/>{" "}<Op c="+"/>{" "}
            <Pill name="CPP" id="tx-cpp" color={CC}/>{" "}<Op c="+"/>{" "}
            <Pill name="EI" id="tx-ei" color={EIC}/>
          </div>
          <div style={{marginTop:4,fontSize:12,fontWeight:600,color:"#555"}}>
            Total: {$$(tax.t)} ({tEff.toFixed(1)}% effective)
          </div>
        </div></div>

        {/* TAX SUB-DEFINITIONS - CRA constants + live G dependency */}
        <div style={st.rc}><div style={st.eq}>
          <div style={{...st.subEq,marginBottom:6}}>
            <Pill name="CPP" id="def-cpp" color={CC}/><Op c="="/>
            <span style={st.cnst}>5.95%</span><Op c="×"/>
            <Op c="("/><span style={st.it2}>min</span><Op c="("/>
            <span style={st.it2}>G</span><Op c=","/>
            <span style={st.cnst}>$68,500</span>
            <Op c=")"/><Op c="−"/><span style={st.cnst}>$3,500</span><Op c=")"/>
            <Op c="="/><span style={st.eqResult}>{$$(tax.c)}</span>
          </div>
          <div style={{...st.subEq,marginBottom:6}}>
            <Pill name="EI" id="def-ei" color={EIC}/><Op c="="/>
            <span style={st.cnst}>1.58%</span><Op c="×"/>
            <span style={st.it2}>min</span><Op c="("/>
            <span style={st.it2}>G</span><Op c=","/>
            <span style={st.cnst}>$63,200</span><Op c=")"/>
            <Op c="="/><span style={st.eqResult}>{$$(tax.e)}</span>
          </div>
          <div style={{...st.subEq,marginBottom:6}}>
            <Pill name="Federal" id="def-fed" color={FC}/><Op c="="/>
            <span style={st.it2}>Σ brackets</span><Op c="("/><span style={st.it2}>G</span><Op c=")"/>
            <Op c="−"/><span style={st.cnst}>$15,705</span><Op c="×"/><span style={st.cnst}>15%</span>
            <Op c="="/><span style={st.eqResult}>{$$(tax.f)}</span>
          </div>
          <div style={st.subEq}>
            <Pill name="Ontario" id="def-ont" color={OC}/><Op c="="/>
            <span style={st.it2}>Σ brackets</span><Op c="("/><span style={st.it2}>G</span><Op c=")"/>
            <Op c="−"/><span style={st.cnst}>$11,141</span><Op c="×"/><span style={st.cnst}>5.05%</span>
            <Op c="="/><span style={st.eqResult}>{$$(tax.o)}</span>
          </div>
          <div style={{fontSize:9,color:"#bbb",marginTop:6,fontStyle:"italic"}}>Constants set by CRA/Ontario - not adjustable</div>
        </div></div>

        {/* EXPENSES */}
        <div style={st.rc}><div style={st.eq}>
          <div style={st.tag}>Total Annual Expenses</div>
          <div style={{...st.ml,fontSize:14}}>
            <Pill name="Expenses" id="eq2-Expenses" color={EC}/> <Op c="="/>{" "}
            {CATS.map((c,i)=><span key={c.key} style={{display:"inline-flex",alignItems:"center",gap:2}}>
              {i>0&&<Op c="+"/>}<Pill name={c.key} id={`eq2-${c.key}`} color={c.color}/>
            </span>)}
          </div>
          <div style={st.rr}>= {$$(Ev)}/yr · {$$(Ev/12)}/mo</div>
        </div></div>

        {/* CATEGORY CARDS */}
        <div className="cat-grid">
        {CATS.map(cat=>{
          const mo=cat.items.reduce((a,i)=>a+s[i.k],0);
          return(
            <div key={cat.key} style={{position:"relative"}}><div style={st.eq}>
              <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"4px 6px",lineHeight:1.6}}>
                <Pill name={cat.key} id={`d-${cat.key}`} color={cat.color}/>
                <Op c="="/>
                <Op c="("/>
                {cat.items.map((item,i)=>(
                  <span key={item.k} style={{display:"inline-flex",alignItems:"center",gap:2}}>
                    {i>0&&<Op c="+"/>}
                    <span style={st.inlineItem}>
                      <span style={st.gL2}>{item.l}</span>
                      <Num value={s[item.k]} onChange={v=>up(item.k,v)} step={item.s}/>
                    </span>
                  </span>
                ))}
                <Op c=")"/><Op c="×"/><span style={st.opNum}>12</span>
                <Op c="="/>
                <span style={st.eqResult}>{$$(tots[cat.key])}/yr</span>
                <span style={{fontSize:11,color:"#bbb",marginLeft:4}}>{$$(mo)}/mo</span>
              </div>
            </div></div>
          );
        })}
        </div>
      </div>
      <div style={{height:32}}/>
    </div>
  );
}

const st={
  pg:{minHeight:"100vh",background:"#f6f4f0",fontFamily:"'DM Sans',system-ui,sans-serif",padding:0,maxWidth:960,margin:"0 auto",color:"#1c1c1c"},
  hero:{textAlign:"center",padding:"20px 16px 14px",background:"#fff",borderBottom:"1px solid #e8e4dd",position:"sticky",top:0,zIndex:30},
  hL:{fontSize:11,letterSpacing:"0.14em",color:"#aaa",fontWeight:500,marginBottom:2},
  hN:{fontSize:"clamp(32px,8vw,52px)",fontWeight:300,color:"#1c1c1c",letterSpacing:"-0.02em",lineHeight:1.15,fontFamily:"'Source Serif 4',Georgia,serif"},
  hS:{fontSize:13,color:"#999",marginTop:4},
  board:{position:"relative",padding:"12px 14px 8px 70px"},
  svg:{position:"absolute",top:0,left:0,pointerEvents:"none",zIndex:10},
  rc:{display:"flex",justifyContent:"center",marginBottom:12,position:"relative"},
  eq:{flex:1,background:"rgba(255,255,255,0.92)",borderRadius:10,padding:"8px 12px 10px"},
  tag:{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#c0b8a8",marginBottom:2},
  ml:{fontFamily:"'Source Serif 4',Georgia,serif",fontSize:15,display:"flex",flexWrap:"wrap",alignItems:"center",gap:"4px 6px",lineHeight:1.5,color:"#1c1c1c"},
  pill:{display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:12,border:"1.5px solid",fontSize:12,fontWeight:500,fontFamily:"'DM Sans',sans-serif",fontStyle:"normal",whiteSpace:"nowrap",background:"#fff",position:"relative",zIndex:25,lineHeight:1.3},
  dv:{fontSize:17,fontStyle:"italic",fontWeight:600,fontFamily:"'Source Serif 4',Georgia,serif",color:"#1c1c1c"},
  op:{fontStyle:"normal",color:"#ccc",fontSize:13,padding:"0 1px"},
  it:{fontStyle:"italic",fontFamily:"'Source Serif 4',Georgia,serif"},
  rr:{fontSize:12,color:"#b5ad9e",fontFamily:"'DM Sans',sans-serif",marginTop:3,textAlign:"right"},
  inlineItem:{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:0},
  gL2:{fontSize:8,color:"#b0a89a",textTransform:"uppercase",letterSpacing:"0.04em",fontWeight:500,lineHeight:1},
  opNum:{fontSize:13,fontWeight:500,fontFamily:"'Source Serif 4',serif",color:"#888"},
  eqResult:{fontSize:13,fontWeight:600,fontFamily:"'DM Sans'",color:"#1c1c1c"},
  cnst:{fontSize:12,fontFamily:"'Source Serif 4',serif",color:"#555",fontWeight:500},
  subEq:{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"3px 5px",lineHeight:1.5},
  it2:{fontSize:12,fontStyle:"italic",fontFamily:"'Source Serif 4',serif",color:"#888"},
  stepper:{display:"inline-flex",flexDirection:"column",alignItems:"center",position:"relative",zIndex:25},
  sBtn:{padding:"6px 12px",display:"flex",alignItems:"center",justifyContent:"center",minHeight:28,minWidth:36},
  sVal:{fontSize:13,fontWeight:500,fontFamily:"'DM Sans',sans-serif",color:"#333",background:"#f0ede8",border:"1px solid #e0dbd3",borderRadius:4,padding:"2px 6px",minWidth:40,textAlign:"center",fontStyle:"normal",lineHeight:1.3},
};

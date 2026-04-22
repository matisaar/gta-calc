import { useState, useRef, useEffect } from "react";
import { supabase, ARROW_TABLE } from "./supabase";

/* ── Generic tax helpers ── */
function bTx(income,brackets){let t=0,r=income;for(const[w,rt]of brackets){t+=Math.min(r,w)*rt;r-=w;if(r<=0)break}return t}
function bDetail(income,brackets){const d=[];let r=income;for(const[w,rt]of brackets){const amt=Math.max(0,Math.min(r,w));d.push({width:w,rate:rt,amt,tax:amt*rt});r-=w;if(r<=0)break}return d}
function solveGross(expenses,taxFn){let G=expenses*1.6;for(let i=0;i<40;i++){const t=taxFn(G).total;const n=expenses+t;if(Math.abs(n-G)<1){G=n;break}G=n}return G}

/* ── Shared colors ── */
const CC1="#6a8e6a",CC2="#8a7a6a",CC3="#7a6a8a",CC4="#8a6a6a",CC5="#7a8a5a",CC6="#6a7a8a";
const EC="#b8892a",TC="#7a8a7a";

/* ── Country configurations ── */
const COUNTRIES={

gta:{
  name:"GTA, Canada",sym:"$",
  taxLabel:"Progressive Tax (ON + Federal)",
  taxNote:"CRA/Ontario 2025 rates",
  taxFn(G){
    const brk=[[55867,.15],[55866,.205],[43173,.26],[65094,.29],[1e9,.33]];
    const obrk=[[51446,.0505],[51448,.0915],[47106,.1116],[70000,.1216],[1e9,.1316]];
    const fed=Math.max(0,bTx(G,brk)-15705*0.15);
    const ont=Math.max(0,bTx(G,obrk)-11141*0.0505);
    const cpp=Math.max(0,Math.min(G,68500)-3500)*0.0595;
    const ei=Math.min(G,63200)*0.0158;
    return{components:[
      {name:"Federal",color:CC3,amount:fed,brackets:brk,bracketDetail:bDetail(G,brk),formula:"bracket tax on G - $15,705 x 15%"},
      {name:"Ontario",color:CC4,amount:ont,brackets:obrk,bracketDetail:bDetail(G,obrk),formula:"bracket tax on G - $11,141 x 5.05%"},
      {name:"CPP",color:CC1,amount:cpp,formula:"5.95% x (min(G, $68,500) - $3,500)"},
      {name:"EI",color:CC2,amount:ei,formula:"1.58% x min(G, $63,200)"},
    ],total:fed+ont+cpp+ei};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:100,d:2800},{k:"tIns",l:"tenant ins",s:10,d:25},{k:"rPrk",l:"parking",s:25,d:75},
      {k:"strg",l:"storage",s:10,d:0},{k:"hydr",l:"hydro",s:25,d:90},{k:"gas_",l:"gas/heat",s:10,d:50},
      {k:"watr",l:"water",s:10,d:0},{k:"inet",l:"internet",s:10,d:80}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:700},{k:"dine",l:"dining out",s:25,d:200},{k:"deli",l:"takeout",s:25,d:100},
      {k:"coff",l:"coffee",s:10,d:70},{k:"snck",l:"snacks",s:10,d:40},{k:"alc_",l:"alcohol",s:10,d:50}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1200},{k:"chrg",l:"charging",s:10,d:80},{k:"cIns",l:"auto ins",s:25,d:280},
      {k:"mnt_",l:"maint",s:25,d:60},{k:"tire",l:"tires",s:10,d:30},{k:"cWsh",l:"car wash",s:5,d:20},
      {k:"park",l:"parking",s:25,d:75},{k:"reg_",l:"plates/reg",s:5,d:10},{k:"toll",l:"407 tolls",s:10,d:0}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:30},{k:"papr",l:"paper/bags",s:5,d:15},{k:"kitc",l:"kitchen",s:10,d:15},
      {k:"toil",l:"toiletries",s:10,d:40},{k:"ligh",l:"bulbs/batt",s:5,d:5},{k:"smAp",l:"sm. appliances",s:10,d:10}]},
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
      {k:"pFoo",l:"food/treats",s:10,d:75},{k:"vet_",l:"vet",s:25,d:75},{k:"grmg",l:"grooming",s:10,d:90},
      {k:"pIns",l:"pet ins",s:10,d:50},{k:"flea",l:"flea/hw",s:10,d:40},{k:"pSup",l:"supplies",s:5,d:15},
      {k:"pBrd",l:"boarding",s:25,d:0}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"2 phones",s:10,d:120},{k:"strm",l:"streaming",s:5,d:45},{k:"apps",l:"apps/subs",s:5,d:20},
      {k:"clud",l:"cloud",s:5,d:10},{k:"news",l:"news",s:5,d:10},{k:"soft",l:"software",s:5,d:10}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:30},{k:"vis_",l:"vision",s:10,d:15},{k:"rx__",l:"prescriptions",s:10,d:20},
      {k:"supp",l:"supplements",s:10,d:30},{k:"ther",l:"therapy",s:25,d:0},{k:"walI",l:"walk-in",s:10,d:10}]},
    {key:"Insurance",color:"#8a7a5a",items:[
      {k:"lIns",l:"life ins",s:10,d:0},{k:"dIns",l:"disability",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:40},{k:"holi",l:"holidays",s:25,d:60},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"tfsa",l:"TFSA",s:50,d:250},{k:"rrsp",l:"RRSP",s:50,d:150},{k:"emrg",l:"emerg fund",s:50,d:100},
      {k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:50}]},
  ]
},

calgary:{
  name:"Calgary, Canada",sym:"$",
  taxLabel:"Progressive Tax (AB + Federal)",
  taxNote:"CRA/Alberta 2025 rates",
  taxFn(G){
    const brk=[[55867,.15],[55866,.205],[43173,.26],[65094,.29],[1e9,.33]];
    const abrk=[[148269,.10],[29754,.12],[59507,.13],[89261,.14],[1e9,.15]];
    const fed=Math.max(0,bTx(G,brk)-15705*0.15);
    const ab=Math.max(0,bTx(G,abrk)-21003*0.10);
    const cpp=Math.max(0,Math.min(G,68500)-3500)*0.0595;
    const ei=Math.min(G,63200)*0.0158;
    return{components:[
      {name:"Federal",color:CC3,amount:fed,brackets:brk,bracketDetail:bDetail(G,brk),formula:"bracket tax on G - $15,705 x 15%"},
      {name:"Alberta",color:CC4,amount:ab,brackets:abrk,bracketDetail:bDetail(G,abrk),formula:"bracket tax on G - $21,003 x 10%"},
      {name:"CPP",color:CC1,amount:cpp,formula:"5.95% x (min(G, $68,500) - $3,500)"},
      {name:"EI",color:CC2,amount:ei,formula:"1.58% x min(G, $63,200)"},
    ],total:fed+ab+cpp+ei};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:100,d:1800},{k:"tIns",l:"tenant ins",s:10,d:25},{k:"rPrk",l:"parking",s:25,d:50},
      {k:"hydr",l:"electric",s:25,d:120},{k:"gas_",l:"gas/heat",s:10,d:80},{k:"watr",l:"water",s:10,d:40},
      {k:"inet",l:"internet",s:10,d:80}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:650},{k:"dine",l:"dining out",s:25,d:180},{k:"deli",l:"takeout",s:25,d:100},
      {k:"coff",l:"coffee",s:10,d:60},{k:"snck",l:"snacks",s:10,d:35},{k:"alc_",l:"alcohol",s:10,d:50}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:800},{k:"chrg",l:"charging",s:25,d:60},{k:"cIns",l:"auto ins",s:25,d:200},
      {k:"mnt_",l:"maint",s:25,d:60},{k:"tire",l:"tires",s:10,d:30},{k:"cWsh",l:"car wash",s:5,d:15},
      {k:"park",l:"parking",s:25,d:50},{k:"reg_",l:"plates/reg",s:5,d:10}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:25},{k:"papr",l:"paper/bags",s:5,d:15},{k:"kitc",l:"kitchen",s:10,d:15},
      {k:"toil",l:"toiletries",s:10,d:35},{k:"ligh",l:"bulbs/batt",s:5,d:5},{k:"smAp",l:"sm. appliances",s:10,d:10}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:60},{k:"skin",l:"skincare",s:10,d:30},
      {k:"cosm",l:"cosmetics",s:10,d:20},{k:"gym_",l:"gym",s:10,d:60}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:80},{k:"shoe",l:"shoes",s:25,d:25},
      {k:"work",l:"work attire",s:25,d:25},{k:"drCl",l:"dry clean",s:10,d:10}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:25,d:70},{k:"movi",l:"movies",s:10,d:25},
      {k:"hobb",l:"hobbies",s:25,d:50},{k:"dOut",l:"dining dates",s:25,d:50}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:70},{k:"vet_",l:"vet",s:25,d:70},{k:"grmg",l:"grooming",s:10,d:80},
      {k:"pIns",l:"pet ins",s:10,d:45},{k:"flea",l:"flea/hw",s:10,d:35},{k:"pSup",l:"supplies",s:5,d:15},
      {k:"pBrd",l:"boarding",s:25,d:0}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"2 phones",s:10,d:110},{k:"strm",l:"streaming",s:5,d:45},{k:"apps",l:"apps/subs",s:5,d:20},
      {k:"clud",l:"cloud",s:5,d:10},{k:"news",l:"news",s:5,d:10},{k:"soft",l:"software",s:5,d:10}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:25},{k:"vis_",l:"vision",s:10,d:15},{k:"rx__",l:"prescriptions",s:10,d:20},
      {k:"supp",l:"supplements",s:10,d:25},{k:"ther",l:"therapy",s:25,d:0},{k:"walI",l:"walk-in",s:10,d:10}]},
    {key:"Insurance",color:"#8a7a5a",items:[
      {k:"lIns",l:"life ins",s:10,d:0},{k:"dIns",l:"disability",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:35},{k:"holi",l:"holidays",s:25,d:50},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"tfsa",l:"TFSA",s:50,d:250},{k:"rrsp",l:"RRSP",s:50,d:200},{k:"emrg",l:"emerg fund",s:50,d:100},
      {k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:50}]},
  ]
},

texas:{
  name:"Texas, USA",sym:"$",
  taxLabel:"US Federal Tax + FICA (in CAD)",
  taxNote:"IRS 2025 rates, no state tax (1 USD = 1.36 CAD)",
  taxFn(G){
    const std=20400;const taxable=Math.max(0,G-std);
    const brk=[[16218,.10],[49708,.12],[74630,.22],[127772,.24],[72386,.32],[511122,.35],[1e9,.37]];
    const fed=bTx(taxable,brk);
    const ss=Math.min(G,239496)*0.062;
    const med=G*0.0145+Math.max(0,G-272000)*0.009;
    return{components:[
      {name:"Federal",color:CC3,amount:fed,brackets:brk,bracketDetail:bDetail(taxable,brk),formula:"bracket tax on (G - $20,400 std ded.)"},
      {name:"Soc. Security",color:CC1,amount:ss,formula:"6.2% x min(G, $239,496)"},
      {name:"Medicare",color:CC2,amount:med,formula:"1.45% x G + 0.9% over $272k"},
    ],total:fed+ss+med};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:100,d:2450},{k:"tIns",l:"renter ins",s:10,d:25},{k:"rPrk",l:"parking",s:25,d:0},
      {k:"hydr",l:"electric",s:25,d:200},{k:"gas_",l:"gas",s:10,d:55},{k:"watr",l:"water",s:10,d:40},
      {k:"inet",l:"internet",s:10,d:95}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:815},{k:"dine",l:"dining out",s:25,d:340},{k:"deli",l:"takeout",s:25,d:165},
      {k:"coff",l:"coffee",s:10,d:80},{k:"snck",l:"snacks",s:10,d:55},{k:"alc_",l:"alcohol",s:10,d:70}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:815},{k:"chrg",l:"charging",s:25,d:65},{k:"cIns",l:"auto ins",s:25,d:270},
      {k:"mnt_",l:"maint",s:25,d:80},{k:"tire",l:"tires",s:10,d:35},{k:"toll",l:"tolls",s:10,d:40},
      {k:"park",l:"parking",s:25,d:55},{k:"reg_",l:"registration",s:5,d:10}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:35},{k:"papr",l:"paper/bags",s:5,d:20},{k:"kitc",l:"kitchen",s:10,d:20},
      {k:"toil",l:"toiletries",s:10,d:50},{k:"ligh",l:"bulbs/batt",s:5,d:5},{k:"smAp",l:"sm. appliances",s:10,d:15}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:80},{k:"skin",l:"skincare",s:10,d:50},
      {k:"cosm",l:"cosmetics",s:10,d:35},{k:"gym_",l:"gym",s:10,d:70}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:110},{k:"shoe",l:"shoes",s:25,d:35},
      {k:"work",l:"work attire",s:25,d:25},{k:"drCl",l:"dry clean",s:10,d:15}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:25,d:135},{k:"movi",l:"movies",s:10,d:40},
      {k:"hobb",l:"hobbies",s:25,d:80},{k:"dOut",l:"dining dates",s:25,d:80}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:95},{k:"vet_",l:"vet",s:25,d:80},{k:"grmg",l:"grooming",s:10,d:95},
      {k:"pIns",l:"pet ins",s:10,d:55},{k:"flea",l:"flea/hw",s:10,d:50},{k:"pSup",l:"supplies",s:5,d:20},
      {k:"pBrd",l:"boarding",s:25,d:0}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"2 phones",s:10,d:190},{k:"strm",l:"streaming",s:5,d:70},{k:"apps",l:"apps/subs",s:5,d:25},
      {k:"clud",l:"cloud",s:5,d:15},{k:"news",l:"news",s:5,d:15},{k:"soft",l:"software",s:5,d:15}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"hins",l:"health ins",s:25,d:340},{k:"dent",l:"dental",s:10,d:55},{k:"vis_",l:"vision",s:10,d:20},
      {k:"rx__",l:"prescriptions",s:10,d:40},{k:"supp",l:"supplements",s:10,d:40},{k:"coPA",l:"copays",s:10,d:35}]},
    {key:"Insurance",color:"#8a7a5a",items:[
      {k:"lIns",l:"life ins",s:10,d:0},{k:"dIns",l:"disability",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:55},{k:"holi",l:"holidays",s:25,d:80},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"k401",l:"401(k)",s:50,d:410},{k:"roth",l:"Roth IRA",s:50,d:200},{k:"emrg",l:"emerg fund",s:50,d:135},
      {k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:70}]},
  ]
},

thailand:{
  name:"Bangkok, Thailand",sym:"$",
  taxLabel:"Thai Personal Income Tax (in CAD)",
  taxNote:"Thai Revenue Dept 2025 rates (1 THB = 0.038 CAD)",
  taxFn(G){
    const expDed=Math.min(G*0.5,3800);const personal=2280;
    const taxable=Math.max(0,G-expDed-personal);
    const brk=[[5700,0],[5700,.05],[7600,.10],[9500,.15],[9500,.20],[38000,.25],[114000,.30],[1e12,.35]];
    const pit=bTx(taxable,brk);
    const ssc=Math.min(G/12,570)*12*0.05;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(taxable,brk),formula:"brackets on (G - 50% exp ded - $2,280 personal)"},
      {name:"Soc. Security",color:CC1,amount:ssc,formula:"5% x min(monthly, $570) x 12"},
    ],total:pit+ssc};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:570},{k:"elec",l:"electric",s:10,d:95},
      {k:"watr",l:"water",s:10,d:10},{k:"inet",l:"internet",s:10,d:25},{k:"cond",l:"condo fees",s:10,d:75}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:25,d:230},{k:"strt",l:"street food",s:25,d:150},{k:"dine",l:"dining out",s:25,d:115},
      {k:"coff",l:"coffee",s:10,d:55},{k:"deli",l:"delivery",s:25,d:75},{k:"alc_",l:"alcohol",s:10,d:55}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1200},{k:"chrg",l:"charging",s:10,d:30},{k:"cIns",l:"auto ins",s:25,d:180},
      {k:"mnt_",l:"maint",s:25,d:40},{k:"tire",l:"tires",s:10,d:25},{k:"cWsh",l:"car wash",s:5,d:10},
      {k:"park",l:"parking",s:25,d:40},{k:"reg_",l:"registration",s:5,d:5},{k:"toll",l:"tolls",s:10,d:30}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:20},{k:"papr",l:"supplies",s:5,d:10},{k:"kitc",l:"kitchen",s:5,d:10},
      {k:"toil",l:"toiletries",s:10,d:30},{k:"lndr",l:"laundry",s:5,d:15}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:20},{k:"skin",l:"skincare",s:10,d:40},
      {k:"cosm",l:"cosmetics",s:10,d:20},{k:"gym_",l:"gym",s:10,d:80}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:75},{k:"shoe",l:"shoes",s:10,d:20},{k:"work",l:"work attire",s:10,d:20}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:75},{k:"movi",l:"movies",s:10,d:10},
      {k:"hobb",l:"hobbies",s:10,d:55},{k:"dOut",l:"social",s:10,d:75}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:55},{k:"vet_",l:"vet",s:10,d:20},
      {k:"grmg",l:"grooming",s:10,d:20},{k:"pSup",l:"supplies",s:5,d:10}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:25},{k:"strm",l:"streaming",s:5,d:15},
      {k:"apps",l:"apps/subs",s:5,d:10},{k:"clud",l:"cloud",s:5,d:5}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"hins",l:"health ins",s:10,d:115},{k:"dent",l:"dental",s:10,d:20},{k:"rx__",l:"pharmacy",s:10,d:15},
      {k:"supp",l:"supplements",s:10,d:20},{k:"hosp",l:"hospital",s:10,d:20}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"lIns",l:"life ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:20},{k:"holi",l:"holidays",s:10,d:40},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"pvdf",l:"provident fund",s:25,d:115},{k:"emrg",l:"emerg fund",s:25,d:75},
      {k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:10,d:40}]},
  ]
},

china:{
  name:"Shanghai, China",sym:"$",
  taxLabel:"China Individual Income Tax (in CAD)",
  taxNote:"China tax bureau 2025 rates (1 CNY = 0.19 CAD)",
  taxFn(G){
    const std=11400;const siRate=0.175;const siCap=85049;
    const siBase=Math.min(G,siCap);const si=siBase*siRate;
    const taxable=Math.max(0,G-std-si);
    const brk=[[6840,.03],[20520,.10],[29640,.20],[22800,.25],[45600,.30],[57000,.35],[1e12,.45]];
    const pit=bTx(taxable,brk);
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(taxable,brk),formula:"brackets on (G - $11,400 - social ins)"},
      {name:"Pension",color:CC1,amount:siBase*0.08,formula:"8% x min(G, $85,049)"},
      {name:"Medical",color:CC2,amount:siBase*0.02,formula:"2% x min(G, $85,049)"},
      {name:"Unemploy.",color:CC5,amount:siBase*0.005,formula:"0.5% x min(G, $85,049)"},
      {name:"Housing Fund",color:CC6,amount:siBase*0.07,formula:"7% x min(G, $85,049)"},
    ],total:pit+si};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1330},{k:"mgmt",l:"mgmt fee",s:10,d:95},{k:"elec",l:"electric",s:10,d:55},
      {k:"gas_",l:"gas",s:10,d:30},{k:"watr",l:"water",s:10,d:10},{k:"inet",l:"internet",s:10,d:15}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:570},{k:"cant",l:"canteen",s:25,d:380},{k:"dine",l:"dining out",s:25,d:380},
      {k:"deli",l:"delivery",s:25,d:285},{k:"coff",l:"coffee/tea",s:10,d:95},{k:"alc_",l:"alcohol",s:10,d:95}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:850},{k:"chrg",l:"charging",s:10,d:35},{k:"cIns",l:"auto ins",s:25,d:190},
      {k:"mnt_",l:"maint",s:25,d:40},{k:"tire",l:"tires",s:10,d:25},{k:"cWsh",l:"car wash",s:5,d:10},
      {k:"park",l:"parking",s:25,d:45},{k:"reg_",l:"registration",s:5,d:5},{k:"toll",l:"tolls",s:10,d:15}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:95},{k:"papr",l:"supplies",s:5,d:40},{k:"kitc",l:"kitchen",s:10,d:40},
      {k:"toil",l:"toiletries",s:10,d:75}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:40},{k:"skin",l:"skincare",s:10,d:95},
      {k:"cosm",l:"cosmetics",s:10,d:55},{k:"gym_",l:"gym",s:10,d:75}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:190},{k:"shoe",l:"shoes",s:10,d:55},{k:"work",l:"work attire",s:10,d:55}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:95},{k:"movi",l:"movies",s:10,d:40},
      {k:"hobb",l:"hobbies",s:10,d:95},{k:"dOut",l:"social",s:10,d:150}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:95},{k:"vet_",l:"vet",s:10,d:55},
      {k:"grmg",l:"grooming",s:10,d:40},{k:"pSup",l:"supplies",s:5,d:20}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:15},{k:"strm",l:"streaming",s:5,d:30},
      {k:"apps",l:"apps/subs",s:5,d:20},{k:"clud",l:"cloud",s:5,d:10}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:40},{k:"rx__",l:"pharmacy",s:10,d:40},
      {k:"supp",l:"supplements",s:10,d:55},{k:"hosp",l:"hospital copay",s:10,d:40}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"cIns",l:"commercial ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:55},{k:"holi",l:"holidays",s:25,d:190},{k:"red_",l:"red envelopes",s:10,d:95}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:50,d:380},{k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:95}]},
  ]
},

greece:{
  name:"Athens, Greece",sym:"$",
  taxLabel:"Greek Income Tax + EFKA (in CAD)",
  taxNote:"Greek tax authority 2025 rates (1 EUR = 1.50 CAD)",
  taxFn(G){
    const brk=[[15000,.09],[15000,.20],[15000,.26],[15000,.34],[1e9,.44]];
    const pit=Math.max(0,bTx(G,brk)-1166);
    const efkaCap=139716;const efka=Math.min(G,efkaCap)*0.1337;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"bracket tax on G - $1,166 tax credit"},
      {name:"EFKA",color:CC1,amount:efka,formula:"13.37% x min(G, $139,716)"},
    ],total:pit+efka};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1050},{k:"elec",l:"electric",s:10,d:120},{k:"gas_",l:"gas/heat",s:10,d:60},
      {k:"watr",l:"water",s:10,d:30},{k:"inet",l:"internet",s:10,d:55},{k:"cond",l:"building fees",s:10,d:75}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:525},{k:"dine",l:"dining out",s:25,d:225},{k:"deli",l:"takeout",s:25,d:120},
      {k:"coff",l:"coffee",s:10,d:90},{k:"snck",l:"snacks",s:10,d:45},{k:"alc_",l:"alcohol",s:10,d:60}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1150},{k:"chrg",l:"charging",s:10,d:50},{k:"cIns",l:"auto ins",s:25,d:150},
      {k:"mnt_",l:"maint",s:25,d:45},{k:"tire",l:"tires",s:10,d:25},{k:"cWsh",l:"car wash",s:5,d:15},
      {k:"park",l:"parking",s:25,d:30},{k:"reg_",l:"registration",s:5,d:10},{k:"toll",l:"tolls",s:10,d:25}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:30},{k:"papr",l:"supplies",s:5,d:15},{k:"kitc",l:"kitchen",s:5,d:15},
      {k:"toil",l:"toiletries",s:10,d:45}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:45},{k:"skin",l:"skincare",s:10,d:40},
      {k:"cosm",l:"cosmetics",s:10,d:25},{k:"gym_",l:"gym",s:10,d:55}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:90},{k:"shoe",l:"shoes",s:10,d:30},{k:"work",l:"work attire",s:10,d:25}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:75},{k:"movi",l:"movies",s:10,d:25},
      {k:"hobb",l:"hobbies",s:10,d:45},{k:"dOut",l:"social",s:10,d:60}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:90},{k:"vet_",l:"vet",s:10,d:45},
      {k:"grmg",l:"grooming",s:10,d:30},{k:"pSup",l:"supplies",s:5,d:15}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:35},{k:"strm",l:"streaming",s:5,d:30},
      {k:"apps",l:"apps/subs",s:5,d:15},{k:"clud",l:"cloud",s:5,d:10}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:30},{k:"vis_",l:"vision",s:10,d:15},{k:"rx__",l:"pharmacy",s:10,d:25},
      {k:"supp",l:"supplements",s:10,d:25},{k:"priv",l:"private doctor",s:10,d:30}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"lIns",l:"life ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:40},{k:"holi",l:"holidays",s:25,d:75},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:75},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:60}]},
  ]
},

estonia:{
  name:"Tallinn, Estonia",sym:"$",
  taxLabel:"Estonian Flat Tax + Social (in CAD)",
  taxNote:"Estonian tax authority 2025 rates (1 EUR = 1.50 CAD)",
  taxFn(G){
    const exempt=12600;
    const taxable=Math.max(0,G-exempt);
    const pit=taxable*0.20;
    const pension=G*0.02;
    const unemp=G*0.016;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,formula:"20% x (G - $12,600 exempt)"},
      {name:"Pension II",color:CC1,amount:pension,formula:"2% x G (funded pension)"},
      {name:"Unemploy.",color:CC2,amount:unemp,formula:"1.6% x G"},
    ],total:pit+pension+unemp};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1040},{k:"elec",l:"electric",s:10,d:130},{k:"gas_",l:"heating",s:10,d:200},
      {k:"watr",l:"water",s:10,d:35},{k:"inet",l:"internet",s:10,d:45},{k:"cond",l:"building fees",s:10,d:60}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:450},{k:"dine",l:"dining out",s:25,d:180},{k:"deli",l:"takeout",s:25,d:105},
      {k:"coff",l:"coffee",s:10,d:75},{k:"snck",l:"snacks",s:10,d:40},{k:"alc_",l:"alcohol",s:10,d:60}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1150},{k:"chrg",l:"charging",s:10,d:55},{k:"cIns",l:"auto ins",s:25,d:140},
      {k:"mnt_",l:"maint",s:25,d:40},{k:"tire",l:"tires",s:10,d:30},{k:"cWsh",l:"car wash",s:5,d:15},
      {k:"park",l:"parking",s:25,d:25},{k:"reg_",l:"registration",s:5,d:10},{k:"toll",l:"tolls",s:10,d:0}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:25},{k:"papr",l:"supplies",s:5,d:15},{k:"kitc",l:"kitchen",s:5,d:15},
      {k:"toil",l:"toiletries",s:10,d:40}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:40},{k:"skin",l:"skincare",s:10,d:30},
      {k:"cosm",l:"cosmetics",s:10,d:25},{k:"gym_",l:"gym",s:10,d:65}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:75},{k:"shoe",l:"shoes",s:10,d:25},{k:"work",l:"work attire",s:10,d:25}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:60},{k:"movi",l:"movies",s:10,d:25},
      {k:"hobb",l:"hobbies",s:10,d:45},{k:"dOut",l:"social",s:10,d:55}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:75},{k:"vet_",l:"vet",s:10,d:40},
      {k:"grmg",l:"grooming",s:10,d:25},{k:"pSup",l:"supplies",s:5,d:15}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:30},{k:"strm",l:"streaming",s:5,d:25},
      {k:"apps",l:"apps/subs",s:5,d:15},{k:"clud",l:"cloud",s:5,d:10}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:25},{k:"vis_",l:"vision",s:10,d:15},{k:"rx__",l:"pharmacy",s:10,d:15},
      {k:"supp",l:"supplements",s:10,d:25},{k:"priv",l:"private doctor",s:10,d:25}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"lIns",l:"life ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:30},{k:"holi",l:"holidays",s:25,d:60},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"pIII",l:"Pension III",s:25,d:75},{k:"emrg",l:"emerg fund",s:25,d:75},
      {k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:45}]},
  ]
},

shenzhen:{
  name:"Shenzhen, China",sym:"$",
  taxLabel:"China Individual Income Tax (in CAD)",
  taxNote:"China tax bureau 2025 rates (1 CNY = 0.19 CAD)",
  taxFn(G){
    const std=11400;const siRate=0.153;const siCap=62702;
    const siBase=Math.min(G,siCap);const si=siBase*siRate;
    const taxable=Math.max(0,G-std-si);
    const brk=[[6840,.03],[20520,.10],[29640,.20],[22800,.25],[45600,.30],[57000,.35],[1e12,.45]];
    const pit=bTx(taxable,brk);
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(taxable,brk),formula:"brackets on (G - $11,400 - social ins)"},
      {name:"Pension",color:CC1,amount:siBase*0.08,formula:"8% x min(G, $62,702)"},
      {name:"Medical",color:CC2,amount:siBase*0.02,formula:"2% x min(G, $62,702)"},
      {name:"Unemploy.",color:CC5,amount:siBase*0.003,formula:"0.3% x min(G, $62,702)"},
      {name:"Housing Fund",color:CC6,amount:siBase*0.05,formula:"5% x min(G, $62,702)"},
    ],total:pit+si};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1140},{k:"mgmt",l:"mgmt fee",s:10,d:75},{k:"elec",l:"electric",s:10,d:55},
      {k:"gas_",l:"gas",s:10,d:25},{k:"watr",l:"water",s:10,d:10},{k:"inet",l:"internet",s:10,d:15}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:475},{k:"cant",l:"canteen",s:25,d:340},{k:"dine",l:"dining out",s:25,d:340},
      {k:"deli",l:"delivery",s:25,d:250},{k:"coff",l:"coffee/tea",s:10,d:75},{k:"alc_",l:"alcohol",s:10,d:75}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:850},{k:"chrg",l:"charging",s:10,d:30},{k:"cIns",l:"auto ins",s:25,d:170},
      {k:"mnt_",l:"maint",s:25,d:40},{k:"tire",l:"tires",s:10,d:25},{k:"cWsh",l:"car wash",s:5,d:10},
      {k:"park",l:"parking",s:25,d:40},{k:"reg_",l:"registration",s:5,d:5},{k:"toll",l:"tolls",s:10,d:15}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:75},{k:"papr",l:"supplies",s:5,d:30},{k:"kitc",l:"kitchen",s:10,d:30},
      {k:"toil",l:"toiletries",s:10,d:60}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:35},{k:"skin",l:"skincare",s:10,d:75},
      {k:"cosm",l:"cosmetics",s:10,d:45},{k:"gym_",l:"gym",s:10,d:60}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:170},{k:"shoe",l:"shoes",s:10,d:45},{k:"work",l:"work attire",s:10,d:45}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:75},{k:"movi",l:"movies",s:10,d:30},
      {k:"hobb",l:"hobbies",s:10,d:75},{k:"dOut",l:"social",s:10,d:130}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:75},{k:"vet_",l:"vet",s:10,d:45},
      {k:"grmg",l:"grooming",s:10,d:30},{k:"pSup",l:"supplies",s:5,d:15}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:15},{k:"strm",l:"streaming",s:5,d:25},
      {k:"apps",l:"apps/subs",s:5,d:15},{k:"clud",l:"cloud",s:5,d:10}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:35},{k:"rx__",l:"pharmacy",s:10,d:35},
      {k:"supp",l:"supplements",s:10,d:45},{k:"hosp",l:"hospital copay",s:10,d:35}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"cIns",l:"commercial ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:45},{k:"holi",l:"holidays",s:25,d:170},{k:"red_",l:"red envelopes",s:10,d:75}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:50,d:340},{k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:75}]},
  ]
},

panama:{
  name:"Panama City, Panama",sym:"$",
  taxLabel:"Panama Income Tax (in CAD)",
  taxNote:"DGI 2025 rates (1 USD = 1.36 CAD)",
  taxFn(G){
    const brk=[[14960,0],[53040,.15],[1e9,.25]];
    const pit=bTx(G,brk);
    const ss=G*0.0975;
    const edu=G*0.0125;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"0% to $14,960, 15% to $68k, 25% over"},
      {name:"Soc. Security",color:CC1,amount:ss,formula:"9.75% x G"},
      {name:"Educ. Ins.",color:CC2,amount:edu,formula:"1.25% x G"},
    ],total:pit+ss+edu};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1360},{k:"elec",l:"electric",s:10,d:135},{k:"watr",l:"water",s:10,d:20},
      {k:"inet",l:"internet",s:10,d:65},{k:"cond",l:"building fees",s:10,d:70}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:545},{k:"dine",l:"dining out",s:25,d:270},{k:"deli",l:"takeout",s:25,d:135},
      {k:"coff",l:"coffee",s:10,d:55},{k:"snck",l:"snacks",s:10,d:35},{k:"alc_",l:"alcohol",s:10,d:55}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1500},{k:"chrg",l:"charging",s:10,d:45},{k:"cIns",l:"auto ins",s:25,d:150},
      {k:"mnt_",l:"maint",s:25,d:40},{k:"tire",l:"tires",s:10,d:25},{k:"cWsh",l:"car wash",s:5,d:10},
      {k:"park",l:"parking",s:25,d:30},{k:"reg_",l:"registration",s:5,d:10},{k:"toll",l:"tolls",s:10,d:15}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:55},{k:"papr",l:"supplies",s:5,d:15},{k:"kitc",l:"kitchen",s:5,d:15},
      {k:"toil",l:"toiletries",s:10,d:40}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:40},{k:"skin",l:"skincare",s:10,d:30},
      {k:"cosm",l:"cosmetics",s:10,d:20},{k:"gym_",l:"gym",s:10,d:55}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:80},{k:"shoe",l:"shoes",s:10,d:25},{k:"work",l:"work attire",s:10,d:20}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:80},{k:"movi",l:"movies",s:10,d:20},
      {k:"hobb",l:"hobbies",s:10,d:50},{k:"dOut",l:"social",s:10,d:70}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:55},{k:"vet_",l:"vet",s:10,d:40},
      {k:"grmg",l:"grooming",s:10,d:25},{k:"pSup",l:"supplies",s:5,d:10}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:45},{k:"strm",l:"streaming",s:5,d:25},
      {k:"apps",l:"apps/subs",s:5,d:15},{k:"clud",l:"cloud",s:5,d:10}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"hins",l:"health ins",s:25,d:135},{k:"dent",l:"dental",s:10,d:40},{k:"rx__",l:"pharmacy",s:10,d:20},
      {k:"supp",l:"supplements",s:10,d:25},{k:"hosp",l:"hospital",s:10,d:25}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"lIns",l:"life ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:30},{k:"holi",l:"holidays",s:25,d:55},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:50,d:135},{k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:70}]},
  ]
},

costarica:{
  name:"San Jose, Costa Rica",sym:"$",
  taxLabel:"Costa Rica Income Tax (in CAD)",
  taxNote:"Hacienda 2025 rates (1 CRC = 0.0027 CAD)",
  taxFn(G){
    const brk=[[30100,0],[14060,.10],[33340,.15],[77500,.20],[1e9,.25]];
    const pit=bTx(G,brk);
    const ccss=G*0.1067;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"progressive brackets on G"},
      {name:"CCSS",color:CC1,amount:ccss,formula:"10.67% x G (social security)"},
    ],total:pit+ccss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:950},{k:"elec",l:"electric",s:10,d:80},{k:"watr",l:"water",s:10,d:15},
      {k:"inet",l:"internet",s:10,d:80},{k:"cond",l:"building fees",s:10,d:40}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:430},{k:"dine",l:"dining out",s:25,d:175},{k:"deli",l:"takeout",s:25,d:95},
      {k:"coff",l:"coffee",s:10,d:45},{k:"snck",l:"snacks",s:10,d:25},{k:"alc_",l:"alcohol",s:10,d:40}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1700},{k:"chrg",l:"charging",s:10,d:35},{k:"cIns",l:"auto ins",s:25,d:120},
      {k:"mnt_",l:"maint",s:25,d:35},{k:"tire",l:"tires",s:10,d:25},{k:"cWsh",l:"car wash",s:5,d:10},
      {k:"park",l:"parking",s:25,d:20},{k:"reg_",l:"registration",s:5,d:10},{k:"toll",l:"tolls",s:10,d:10}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:40},{k:"papr",l:"supplies",s:5,d:10},{k:"kitc",l:"kitchen",s:5,d:10},
      {k:"toil",l:"toiletries",s:10,d:30}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:25},{k:"skin",l:"skincare",s:10,d:25},
      {k:"cosm",l:"cosmetics",s:10,d:15},{k:"gym_",l:"gym",s:10,d:80}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:65},{k:"shoe",l:"shoes",s:10,d:20},{k:"work",l:"work attire",s:10,d:15}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:55},{k:"movi",l:"movies",s:10,d:15},
      {k:"hobb",l:"hobbies",s:10,d:35},{k:"dOut",l:"social",s:10,d:50}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:45},{k:"vet_",l:"vet",s:10,d:30},
      {k:"grmg",l:"grooming",s:10,d:15},{k:"pSup",l:"supplies",s:5,d:10}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:40},{k:"strm",l:"streaming",s:5,d:20},
      {k:"apps",l:"apps/subs",s:5,d:10},{k:"clud",l:"cloud",s:5,d:5}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"hins",l:"health ins",s:10,d:80},{k:"dent",l:"dental",s:10,d:20},{k:"rx__",l:"pharmacy",s:10,d:15},
      {k:"supp",l:"supplements",s:10,d:15},{k:"hosp",l:"hospital",s:10,d:15}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"lIns",l:"life ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:20},{k:"holi",l:"holidays",s:25,d:40},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:80},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:40}]},
  ]
},

florida:{
  name:"Florida, USA",sym:"$",
  taxLabel:"US Federal Tax + FICA (in CAD)",
  taxNote:"IRS 2025 rates, no state tax (1 USD = 1.36 CAD)",
  taxFn(G){
    const std=20400;const taxable=Math.max(0,G-std);
    const brk=[[16218,.10],[49708,.12],[74630,.22],[127772,.24],[72386,.32],[511122,.35],[1e9,.37]];
    const fed=bTx(taxable,brk);
    const ss=Math.min(G,239496)*0.062;
    const med=G*0.0145+Math.max(0,G-272000)*0.009;
    return{components:[
      {name:"Federal",color:CC3,amount:fed,brackets:brk,bracketDetail:bDetail(taxable,brk),formula:"bracket tax on (G - $20,400 std ded.)"},
      {name:"Soc. Security",color:CC1,amount:ss,formula:"6.2% x min(G, $239,496)"},
      {name:"Medicare",color:CC2,amount:med,formula:"1.45% x G + 0.9% over $272k"},
    ],total:fed+ss+med};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:100,d:2720},{k:"tIns",l:"renter ins",s:10,d:35},{k:"rPrk",l:"parking",s:25,d:0},
      {k:"hydr",l:"electric",s:25,d:245},{k:"gas_",l:"gas",s:10,d:40},{k:"watr",l:"water",s:10,d:55},
      {k:"inet",l:"internet",s:10,d:95}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:815},{k:"dine",l:"dining out",s:25,d:340},{k:"deli",l:"takeout",s:25,d:175},
      {k:"coff",l:"coffee",s:10,d:85},{k:"snck",l:"snacks",s:10,d:55},{k:"alc_",l:"alcohol",s:10,d:70}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:815},{k:"chrg",l:"charging",s:25,d:70},{k:"cIns",l:"auto ins",s:25,d:340},
      {k:"mnt_",l:"maint",s:25,d:80},{k:"tire",l:"tires",s:10,d:35},{k:"toll",l:"tolls",s:10,d:55},
      {k:"park",l:"parking",s:25,d:55},{k:"reg_",l:"registration",s:5,d:10}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:40},{k:"papr",l:"paper/bags",s:5,d:20},{k:"kitc",l:"kitchen",s:10,d:20},
      {k:"toil",l:"toiletries",s:10,d:50},{k:"ligh",l:"bulbs/batt",s:5,d:5},{k:"smAp",l:"sm. appliances",s:10,d:15}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:80},{k:"skin",l:"skincare",s:10,d:50},
      {k:"cosm",l:"cosmetics",s:10,d:35},{k:"gym_",l:"gym",s:10,d:100}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:110},{k:"shoe",l:"shoes",s:25,d:35},
      {k:"work",l:"work attire",s:25,d:25},{k:"drCl",l:"dry clean",s:10,d:15}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:25,d:150},{k:"movi",l:"movies",s:10,d:40},
      {k:"hobb",l:"hobbies",s:25,d:80},{k:"dOut",l:"dining dates",s:25,d:95}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:95},{k:"vet_",l:"vet",s:25,d:95},{k:"grmg",l:"grooming",s:10,d:95},
      {k:"pIns",l:"pet ins",s:10,d:55},{k:"flea",l:"flea/hw",s:10,d:50},{k:"pSup",l:"supplies",s:5,d:20},
      {k:"pBrd",l:"boarding",s:25,d:0}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"2 phones",s:10,d:190},{k:"strm",l:"streaming",s:5,d:70},{k:"apps",l:"apps/subs",s:5,d:25},
      {k:"clud",l:"cloud",s:5,d:15},{k:"news",l:"news",s:5,d:15},{k:"soft",l:"software",s:5,d:15}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"hins",l:"health ins",s:25,d:380},{k:"dent",l:"dental",s:10,d:55},{k:"vis_",l:"vision",s:10,d:20},
      {k:"rx__",l:"prescriptions",s:10,d:40},{k:"supp",l:"supplements",s:10,d:40},{k:"coPA",l:"copays",s:10,d:35}]},
    {key:"Insurance",color:"#8a7a5a",items:[
      {k:"lIns",l:"life ins",s:10,d:0},{k:"dIns",l:"disability",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:55},{k:"holi",l:"holidays",s:25,d:80},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"k401",l:"401(k)",s:50,d:410},{k:"roth",l:"Roth IRA",s:50,d:200},{k:"emrg",l:"emerg fund",s:50,d:135},
      {k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:70}]},
  ]
},

santateresa:{
  name:"Santa Teresa, Costa Rica",sym:"$",
  taxLabel:"Costa Rica Income Tax (in CAD)",
  taxNote:"Hacienda 2025 rates (1 CRC = 0.0027 CAD)",
  taxFn(G){
    const brk=[[30100,0],[14060,.10],[33340,.15],[77500,.20],[1e9,.25]];
    const pit=bTx(G,brk);
    const ccss=G*0.1067;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"progressive brackets on G"},
      {name:"CCSS",color:CC1,amount:ccss,formula:"10.67% x G (social security)"},
    ],total:pit+ccss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1225},{k:"elec",l:"electric",s:10,d:95},{k:"watr",l:"water",s:10,d:15},
      {k:"inet",l:"internet",s:10,d:80},{k:"cond",l:"HOA/maint",s:10,d:55}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:540},{k:"dine",l:"dining out",s:25,d:270},{k:"deli",l:"takeout",s:25,d:135},
      {k:"coff",l:"coffee",s:10,d:55},{k:"snck",l:"snacks",s:10,d:30},{k:"alc_",l:"alcohol",s:10,d:55}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1700},{k:"chrg",l:"charging",s:10,d:35},{k:"cIns",l:"auto ins",s:25,d:120},
      {k:"mnt_",l:"maint",s:25,d:35},{k:"tire",l:"tires",s:10,d:25},{k:"cWsh",l:"car wash",s:5,d:10},
      {k:"park",l:"parking",s:25,d:10},{k:"reg_",l:"registration",s:5,d:10},{k:"toll",l:"tolls",s:10,d:0}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:55},{k:"papr",l:"supplies",s:5,d:10},{k:"kitc",l:"kitchen",s:5,d:10},
      {k:"toil",l:"toiletries",s:10,d:30},{k:"pest",l:"pest control",s:5,d:15}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:25},{k:"skin",l:"skincare",s:10,d:30},
      {k:"cosm",l:"cosmetics",s:10,d:15},{k:"gym_",l:"gym/yoga",s:10,d:80}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:55},{k:"shoe",l:"shoes",s:10,d:15},{k:"work",l:"surf/active",s:10,d:30}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:55},{k:"surf",l:"surf lessons",s:25,d:80},
      {k:"hobb",l:"hobbies",s:10,d:40},{k:"dOut",l:"social",s:10,d:70}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:45},{k:"vet_",l:"vet",s:10,d:35},
      {k:"grmg",l:"grooming",s:10,d:15},{k:"pSup",l:"supplies",s:5,d:10}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:40},{k:"strm",l:"streaming",s:5,d:20},
      {k:"apps",l:"apps/subs",s:5,d:10},{k:"clud",l:"cloud",s:5,d:5}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"hins",l:"health ins",s:10,d:95},{k:"dent",l:"dental",s:10,d:20},{k:"rx__",l:"pharmacy",s:10,d:15},
      {k:"supp",l:"supplements",s:10,d:15},{k:"hosp",l:"hospital",s:10,d:15}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"lIns",l:"life ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:20},{k:"holi",l:"holidays",s:25,d:40},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:80},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:55}]},
  ]
},

barcelona:{
  name:"Barcelona, Spain",sym:"$",
  taxLabel:"Spanish IRPF + Social (in CAD)",
  taxNote:"AEAT 2025 rates (1 EUR = 1.50 CAD)",
  taxFn(G){
    const brk=[[18750,.285],[16500,.387],[17250,.447],[42000,.447],[1e9,.495]];
    const pit=bTx(G,brk);
    const ssCap=66600;const ss=Math.min(G,ssCap)*0.0635;
    return{components:[
      {name:"IRPF",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"state+regional brackets on G"},
      {name:"Soc. Security",color:CC1,amount:ss,formula:"6.35% x min(G, $66,600)"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1650},{k:"elec",l:"electric",s:10,d:120},{k:"gas_",l:"gas/heat",s:10,d:60},
      {k:"watr",l:"water",s:10,d:45},{k:"inet",l:"internet",s:10,d:55},{k:"cond",l:"community fees",s:10,d:75}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:525},{k:"dine",l:"dining out",s:25,d:270},{k:"deli",l:"takeout",s:25,d:120},
      {k:"coff",l:"coffee",s:10,d:75},{k:"snck",l:"snacks",s:10,d:40},{k:"alc_",l:"alcohol",s:10,d:55}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1150},{k:"chrg",l:"charging",s:10,d:50},{k:"cIns",l:"auto ins",s:25,d:150},
      {k:"mnt_",l:"maint",s:25,d:40},{k:"tire",l:"tires",s:10,d:25},{k:"cWsh",l:"car wash",s:5,d:15},
      {k:"park",l:"parking",s:25,d:35},{k:"reg_",l:"registration",s:5,d:10},{k:"toll",l:"tolls",s:10,d:20}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:30},{k:"papr",l:"supplies",s:5,d:15},{k:"kitc",l:"kitchen",s:5,d:15},
      {k:"toil",l:"toiletries",s:10,d:40}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:45},{k:"skin",l:"skincare",s:10,d:40},
      {k:"cosm",l:"cosmetics",s:10,d:25},{k:"gym_",l:"gym",s:10,d:75}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:90},{k:"shoe",l:"shoes",s:10,d:30},{k:"work",l:"work attire",s:10,d:25}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:75},{k:"movi",l:"movies",s:10,d:25},
      {k:"hobb",l:"hobbies",s:10,d:50},{k:"dOut",l:"social",s:10,d:70}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:75},{k:"vet_",l:"vet",s:10,d:45},
      {k:"grmg",l:"grooming",s:10,d:30},{k:"pSup",l:"supplies",s:5,d:15}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:25},{k:"strm",l:"streaming",s:5,d:25},
      {k:"apps",l:"apps/subs",s:5,d:15},{k:"clud",l:"cloud",s:5,d:10}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:35},{k:"vis_",l:"vision",s:10,d:15},{k:"rx__",l:"pharmacy",s:10,d:20},
      {k:"supp",l:"supplements",s:10,d:25},{k:"priv",l:"private doctor",s:10,d:25}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:75}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:40},{k:"holi",l:"holidays",s:25,d:75},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:75},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:60}]},
  ]
},

lisbon:{
  name:"Lisbon, Portugal",sym:"$",
  taxLabel:"Portuguese IRS + Social (in CAD)",
  taxNote:"AT 2025 rates (1 EUR = 1.50 CAD)",
  taxFn(G){
    const brk=[[11985,.21],[7560,.26],[14925,.325],[18750,.375],[9480,.435],[12450,.45],[1e9,.48]];
    const pit=bTx(G,brk);
    const ss=G*0.11;
    return{components:[
      {name:"IRS",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"progressive brackets on G"},
      {name:"Soc. Security",color:CC1,amount:ss,formula:"11% x G"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1575},{k:"elec",l:"electric",s:10,d:105},{k:"gas_",l:"gas/heat",s:10,d:45},
      {k:"watr",l:"water",s:10,d:30},{k:"inet",l:"internet",s:10,d:45},{k:"cond",l:"condominium",s:10,d:60}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:450},{k:"dine",l:"dining out",s:25,d:210},{k:"deli",l:"takeout",s:25,d:105},
      {k:"coff",l:"coffee",s:10,d:55},{k:"snck",l:"snacks",s:10,d:30},{k:"alc_",l:"alcohol",s:10,d:45}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1150},{k:"chrg",l:"charging",s:10,d:45},{k:"cIns",l:"auto ins",s:25,d:130},
      {k:"mnt_",l:"maint",s:25,d:35},{k:"tire",l:"tires",s:10,d:25},{k:"cWsh",l:"car wash",s:5,d:12},
      {k:"park",l:"parking",s:25,d:25},{k:"reg_",l:"registration",s:5,d:10},{k:"toll",l:"tolls",s:10,d:25}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:25},{k:"papr",l:"supplies",s:5,d:12},{k:"kitc",l:"kitchen",s:5,d:12},
      {k:"toil",l:"toiletries",s:10,d:35}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:35},{k:"skin",l:"skincare",s:10,d:35},
      {k:"cosm",l:"cosmetics",s:10,d:20},{k:"gym_",l:"gym",s:10,d:60}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:75},{k:"shoe",l:"shoes",s:10,d:25},{k:"work",l:"work attire",s:10,d:20}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:55},{k:"movi",l:"movies",s:10,d:15},
      {k:"hobb",l:"hobbies",s:10,d:40},{k:"dOut",l:"social",s:10,d:55}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:65},{k:"vet_",l:"vet",s:10,d:35},
      {k:"grmg",l:"grooming",s:10,d:25},{k:"pSup",l:"supplies",s:5,d:12}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:25},{k:"strm",l:"streaming",s:5,d:22},
      {k:"apps",l:"apps/subs",s:5,d:12},{k:"clud",l:"cloud",s:5,d:8}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:25},{k:"vis_",l:"vision",s:10,d:12},{k:"rx__",l:"pharmacy",s:10,d:18},
      {k:"supp",l:"supplements",s:10,d:20},{k:"priv",l:"private doctor",s:10,d:25}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:55}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:30},{k:"holi",l:"holidays",s:25,d:65},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:60},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:50}]},
  ]
},

/* ── US Cities ── */
nashville:{
  name:"Nashville, TN",sym:"$",
  taxLabel:"US Federal + FICA (in CAD)",
  taxNote:"IRS 2025 rates, no state tax (1 USD = 1.36 CAD)",
  taxFn(G){
    const std=20400;const taxable=Math.max(0,G-std);
    const brk=[[16218,.10],[49708,.12],[74630,.22],[127772,.24],[72386,.32],[511122,.35],[1e9,.37]];
    const fed=bTx(taxable,brk);const ss=Math.min(G,239496)*0.062;const med=G*0.0145+Math.max(0,G-272000)*0.009;
    return{components:[
      {name:"Federal",color:CC3,amount:fed,brackets:brk,bracketDetail:bDetail(taxable,brk),formula:"bracket tax on (G - $20,400 std ded.)"},
      {name:"Soc. Security",color:CC1,amount:ss,formula:"6.2% x min(G, $239,496)"},
      {name:"Medicare",color:CC2,amount:med,formula:"1.45% x G + 0.9% over $272k"},
    ],total:fed+ss+med};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:100,d:2040},{k:"tIns",l:"renter ins",s:10,d:30},{k:"hydr",l:"electric",s:25,d:190},
      {k:"gas_",l:"gas",s:10,d:55},{k:"watr",l:"water",s:10,d:45},{k:"inet",l:"internet",s:10,d:90}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:780},{k:"dine",l:"dining out",s:25,d:300},{k:"deli",l:"takeout",s:25,d:150},
      {k:"coff",l:"coffee",s:10,d:75},{k:"snck",l:"snacks",s:10,d:50},{k:"alc_",l:"alcohol",s:10,d:65}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:815},{k:"chrg",l:"charging",s:25,d:60},{k:"cIns",l:"auto ins",s:25,d:230},
      {k:"mnt_",l:"maint",s:25,d:70},{k:"tire",l:"tires",s:10,d:35},{k:"toll",l:"tolls",s:10,d:20},
      {k:"park",l:"parking",s:25,d:45},{k:"reg_",l:"registration",s:5,d:10}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:30},{k:"papr",l:"supplies",s:5,d:18},{k:"kitc",l:"kitchen",s:10,d:18},
      {k:"toil",l:"toiletries",s:10,d:45}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:70},{k:"skin",l:"skincare",s:10,d:45},
      {k:"cosm",l:"cosmetics",s:10,d:30},{k:"gym_",l:"gym",s:10,d:65}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:100},{k:"shoe",l:"shoes",s:25,d:30},{k:"work",l:"work attire",s:25,d:25}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:25,d:120},{k:"movi",l:"movies",s:10,d:35},
      {k:"hobb",l:"hobbies",s:25,d:70},{k:"dOut",l:"dining dates",s:25,d:75}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:85},{k:"vet_",l:"vet",s:25,d:75},{k:"grmg",l:"grooming",s:10,d:85},
      {k:"pIns",l:"pet ins",s:10,d:50},{k:"flea",l:"flea/hw",s:10,d:45},{k:"pSup",l:"supplies",s:5,d:18}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"2 phones",s:10,d:175},{k:"strm",l:"streaming",s:5,d:60},{k:"apps",l:"apps/subs",s:5,d:22},
      {k:"clud",l:"cloud",s:5,d:12},{k:"news",l:"news",s:5,d:12},{k:"soft",l:"software",s:5,d:12}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"hins",l:"health ins",s:25,d:350},{k:"dent",l:"dental",s:10,d:50},{k:"vis_",l:"vision",s:10,d:18},
      {k:"rx__",l:"prescriptions",s:10,d:35},{k:"supp",l:"supplements",s:10,d:35},{k:"coPA",l:"copays",s:10,d:30}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"lIns",l:"life ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:50},{k:"holi",l:"holidays",s:25,d:70},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"k401",l:"401(k)",s:50,d:410},{k:"roth",l:"Roth IRA",s:50,d:200},{k:"emrg",l:"emerg fund",s:50,d:130},
      {k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:65}]},
  ]
},

vegas:{
  name:"Las Vegas, NV",sym:"$",
  taxLabel:"US Federal + FICA (in CAD)",
  taxNote:"IRS 2025 rates, no state tax (1 USD = 1.36 CAD)",
  taxFn(G){
    const std=20400;const taxable=Math.max(0,G-std);
    const brk=[[16218,.10],[49708,.12],[74630,.22],[127772,.24],[72386,.32],[511122,.35],[1e9,.37]];
    const fed=bTx(taxable,brk);const ss=Math.min(G,239496)*0.062;const med=G*0.0145+Math.max(0,G-272000)*0.009;
    return{components:[
      {name:"Federal",color:CC3,amount:fed,brackets:brk,bracketDetail:bDetail(taxable,brk),formula:"bracket tax on (G - $20,400 std ded.)"},
      {name:"Soc. Security",color:CC1,amount:ss,formula:"6.2% x min(G, $239,496)"},
      {name:"Medicare",color:CC2,amount:med,formula:"1.45% x G + 0.9% over $272k"},
    ],total:fed+ss+med};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:100,d:1900},{k:"tIns",l:"renter ins",s:10,d:25},{k:"hydr",l:"electric",s:25,d:230},
      {k:"gas_",l:"gas",s:10,d:40},{k:"watr",l:"water",s:10,d:50},{k:"inet",l:"internet",s:10,d:90}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:750},{k:"dine",l:"dining out",s:25,d:320},{k:"deli",l:"takeout",s:25,d:160},
      {k:"coff",l:"coffee",s:10,d:80},{k:"snck",l:"snacks",s:10,d:50},{k:"alc_",l:"alcohol",s:10,d:75}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:815},{k:"chrg",l:"charging",s:25,d:55},{k:"cIns",l:"auto ins",s:25,d:290},
      {k:"mnt_",l:"maint",s:25,d:70},{k:"tire",l:"tires",s:10,d:35},{k:"toll",l:"tolls",s:10,d:0},
      {k:"park",l:"parking",s:25,d:35},{k:"reg_",l:"registration",s:5,d:12}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:30},{k:"papr",l:"supplies",s:5,d:18},{k:"kitc",l:"kitchen",s:10,d:18},
      {k:"toil",l:"toiletries",s:10,d:45}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:70},{k:"skin",l:"skincare",s:10,d:45},
      {k:"cosm",l:"cosmetics",s:10,d:30},{k:"gym_",l:"gym",s:10,d:60}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:95},{k:"shoe",l:"shoes",s:25,d:30},{k:"work",l:"work attire",s:25,d:20}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:25,d:160},{k:"movi",l:"movies",s:10,d:35},
      {k:"hobb",l:"hobbies",s:25,d:80},{k:"dOut",l:"dining dates",s:25,d:100}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:85},{k:"vet_",l:"vet",s:25,d:80},{k:"grmg",l:"grooming",s:10,d:85},
      {k:"pIns",l:"pet ins",s:10,d:50},{k:"flea",l:"flea/hw",s:10,d:45},{k:"pSup",l:"supplies",s:5,d:18}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"2 phones",s:10,d:175},{k:"strm",l:"streaming",s:5,d:60},{k:"apps",l:"apps/subs",s:5,d:22},
      {k:"clud",l:"cloud",s:5,d:12},{k:"news",l:"news",s:5,d:12},{k:"soft",l:"software",s:5,d:12}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"hins",l:"health ins",s:25,d:380},{k:"dent",l:"dental",s:10,d:55},{k:"vis_",l:"vision",s:10,d:20},
      {k:"rx__",l:"prescriptions",s:10,d:38},{k:"supp",l:"supplements",s:10,d:38},{k:"coPA",l:"copays",s:10,d:32}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"lIns",l:"life ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:50},{k:"holi",l:"holidays",s:25,d:75},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"k401",l:"401(k)",s:50,d:410},{k:"roth",l:"Roth IRA",s:50,d:200},{k:"emrg",l:"emerg fund",s:50,d:130},
      {k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:65}]},
  ]
},

scottsdale:{
  name:"Scottsdale, AZ",sym:"$",
  taxLabel:"US Federal + AZ 2.5% + FICA (in CAD)",
  taxNote:"IRS+AZ 2025 rates (1 USD = 1.36 CAD)",
  taxFn(G){
    const std=20400;const taxable=Math.max(0,G-std);
    const brk=[[16218,.10],[49708,.12],[74630,.22],[127772,.24],[72386,.32],[511122,.35],[1e9,.37]];
    const fed=bTx(taxable,brk);const az=Math.max(0,G-18100)*0.025;
    const ss=Math.min(G,239496)*0.062;const med=G*0.0145+Math.max(0,G-272000)*0.009;
    return{components:[
      {name:"Federal",color:CC3,amount:fed,brackets:brk,bracketDetail:bDetail(taxable,brk),formula:"bracket tax on (G - $20,400 std ded.)"},
      {name:"Arizona",color:CC4,amount:az,formula:"2.5% x (G - $18,100)"},
      {name:"Soc. Security",color:CC1,amount:ss,formula:"6.2% x min(G, $239,496)"},
      {name:"Medicare",color:CC2,amount:med,formula:"1.45% x G + 0.9% over $272k"},
    ],total:fed+az+ss+med};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:100,d:2310},{k:"tIns",l:"renter ins",s:10,d:28},{k:"hydr",l:"electric",s:25,d:250},
      {k:"gas_",l:"gas",s:10,d:40},{k:"watr",l:"water",s:10,d:55},{k:"inet",l:"internet",s:10,d:95}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:800},{k:"dine",l:"dining out",s:25,d:340},{k:"deli",l:"takeout",s:25,d:165},
      {k:"coff",l:"coffee",s:10,d:85},{k:"snck",l:"snacks",s:10,d:55},{k:"alc_",l:"alcohol",s:10,d:70}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:815},{k:"chrg",l:"charging",s:25,d:55},{k:"cIns",l:"auto ins",s:25,d:245},
      {k:"mnt_",l:"maint",s:25,d:75},{k:"tire",l:"tires",s:10,d:35},{k:"toll",l:"tolls",s:10,d:15},
      {k:"park",l:"parking",s:25,d:40},{k:"reg_",l:"registration",s:5,d:10}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:35},{k:"papr",l:"supplies",s:5,d:20},{k:"kitc",l:"kitchen",s:10,d:20},
      {k:"toil",l:"toiletries",s:10,d:48}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:80},{k:"skin",l:"skincare",s:10,d:50},
      {k:"cosm",l:"cosmetics",s:10,d:35},{k:"gym_",l:"gym",s:10,d:75}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:110},{k:"shoe",l:"shoes",s:25,d:35},{k:"work",l:"work attire",s:25,d:25}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:25,d:140},{k:"movi",l:"movies",s:10,d:38},
      {k:"hobb",l:"hobbies",s:25,d:85},{k:"dOut",l:"dining dates",s:25,d:90}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:90},{k:"vet_",l:"vet",s:25,d:85},{k:"grmg",l:"grooming",s:10,d:90},
      {k:"pIns",l:"pet ins",s:10,d:55},{k:"flea",l:"flea/hw",s:10,d:48},{k:"pSup",l:"supplies",s:5,d:20}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"2 phones",s:10,d:185},{k:"strm",l:"streaming",s:5,d:65},{k:"apps",l:"apps/subs",s:5,d:24},
      {k:"clud",l:"cloud",s:5,d:14},{k:"news",l:"news",s:5,d:14},{k:"soft",l:"software",s:5,d:14}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"hins",l:"health ins",s:25,d:360},{k:"dent",l:"dental",s:10,d:55},{k:"vis_",l:"vision",s:10,d:20},
      {k:"rx__",l:"prescriptions",s:10,d:38},{k:"supp",l:"supplements",s:10,d:38},{k:"coPA",l:"copays",s:10,d:32}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"lIns",l:"life ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:55},{k:"holi",l:"holidays",s:25,d:80},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"k401",l:"401(k)",s:50,d:410},{k:"roth",l:"Roth IRA",s:50,d:200},{k:"emrg",l:"emerg fund",s:50,d:135},
      {k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:70}]},
  ]
},

austin:{
  name:"Austin, TX",sym:"$",
  taxLabel:"US Federal + FICA (in CAD)",
  taxNote:"IRS 2025 rates, no state tax (1 USD = 1.36 CAD)",
  taxFn(G){
    const std=20400;const taxable=Math.max(0,G-std);
    const brk=[[16218,.10],[49708,.12],[74630,.22],[127772,.24],[72386,.32],[511122,.35],[1e9,.37]];
    const fed=bTx(taxable,brk);const ss=Math.min(G,239496)*0.062;const med=G*0.0145+Math.max(0,G-272000)*0.009;
    return{components:[
      {name:"Federal",color:CC3,amount:fed,brackets:brk,bracketDetail:bDetail(taxable,brk),formula:"bracket tax on (G - $20,400 std ded.)"},
      {name:"Soc. Security",color:CC1,amount:ss,formula:"6.2% x min(G, $239,496)"},
      {name:"Medicare",color:CC2,amount:med,formula:"1.45% x G + 0.9% over $272k"},
    ],total:fed+ss+med};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:100,d:2175},{k:"tIns",l:"renter ins",s:10,d:30},{k:"hydr",l:"electric",s:25,d:210},
      {k:"gas_",l:"gas",s:10,d:45},{k:"watr",l:"water",s:10,d:50},{k:"inet",l:"internet",s:10,d:95}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:800},{k:"dine",l:"dining out",s:25,d:340},{k:"deli",l:"takeout",s:25,d:170},
      {k:"coff",l:"coffee",s:10,d:85},{k:"snck",l:"snacks",s:10,d:55},{k:"alc_",l:"alcohol",s:10,d:70}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:815},{k:"chrg",l:"charging",s:25,d:60},{k:"cIns",l:"auto ins",s:25,d:255},
      {k:"mnt_",l:"maint",s:25,d:75},{k:"tire",l:"tires",s:10,d:35},{k:"toll",l:"tolls",s:10,d:35},
      {k:"park",l:"parking",s:25,d:50},{k:"reg_",l:"registration",s:5,d:10}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:35},{k:"papr",l:"supplies",s:5,d:20},{k:"kitc",l:"kitchen",s:10,d:20},
      {k:"toil",l:"toiletries",s:10,d:48}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:80},{k:"skin",l:"skincare",s:10,d:48},
      {k:"cosm",l:"cosmetics",s:10,d:32},{k:"gym_",l:"gym",s:10,d:70}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:105},{k:"shoe",l:"shoes",s:25,d:35},{k:"work",l:"work attire",s:25,d:25}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:25,d:140},{k:"movi",l:"movies",s:10,d:38},
      {k:"hobb",l:"hobbies",s:25,d:80},{k:"dOut",l:"dining dates",s:25,d:85}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:90},{k:"vet_",l:"vet",s:25,d:80},{k:"grmg",l:"grooming",s:10,d:90},
      {k:"pIns",l:"pet ins",s:10,d:55},{k:"flea",l:"flea/hw",s:10,d:48},{k:"pSup",l:"supplies",s:5,d:20}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"2 phones",s:10,d:185},{k:"strm",l:"streaming",s:5,d:65},{k:"apps",l:"apps/subs",s:5,d:24},
      {k:"clud",l:"cloud",s:5,d:14},{k:"news",l:"news",s:5,d:14},{k:"soft",l:"software",s:5,d:14}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"hins",l:"health ins",s:25,d:355},{k:"dent",l:"dental",s:10,d:52},{k:"vis_",l:"vision",s:10,d:20},
      {k:"rx__",l:"prescriptions",s:10,d:38},{k:"supp",l:"supplements",s:10,d:38},{k:"coPA",l:"copays",s:10,d:32}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"lIns",l:"life ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:55},{k:"holi",l:"holidays",s:25,d:78},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"k401",l:"401(k)",s:50,d:410},{k:"roth",l:"Roth IRA",s:50,d:200},{k:"emrg",l:"emerg fund",s:50,d:135},
      {k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:68}]},
  ]
},

raleigh:{
  name:"Raleigh, NC",sym:"$",
  taxLabel:"US Federal + NC 4.25% + FICA (in CAD)",
  taxNote:"IRS+NC 2025 rates (1 USD = 1.36 CAD)",
  taxFn(G){
    const std=20400;const taxable=Math.max(0,G-std);
    const brk=[[16218,.10],[49708,.12],[74630,.22],[127772,.24],[72386,.32],[511122,.35],[1e9,.37]];
    const fed=bTx(taxable,brk);const nc=Math.max(0,G-16592)*0.0425;
    const ss=Math.min(G,239496)*0.062;const med=G*0.0145+Math.max(0,G-272000)*0.009;
    return{components:[
      {name:"Federal",color:CC3,amount:fed,brackets:brk,bracketDetail:bDetail(taxable,brk),formula:"bracket tax on (G - $20,400 std ded.)"},
      {name:"N. Carolina",color:CC4,amount:nc,formula:"4.25% x (G - $16,592)"},
      {name:"Soc. Security",color:CC1,amount:ss,formula:"6.2% x min(G, $239,496)"},
      {name:"Medicare",color:CC2,amount:med,formula:"1.45% x G + 0.9% over $272k"},
    ],total:fed+nc+ss+med};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:100,d:1770},{k:"tIns",l:"renter ins",s:10,d:25},{k:"hydr",l:"electric",s:25,d:175},
      {k:"gas_",l:"gas",s:10,d:45},{k:"watr",l:"water",s:10,d:40},{k:"inet",l:"internet",s:10,d:88}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:720},{k:"dine",l:"dining out",s:25,d:270},{k:"deli",l:"takeout",s:25,d:135},
      {k:"coff",l:"coffee",s:10,d:70},{k:"snck",l:"snacks",s:10,d:45},{k:"alc_",l:"alcohol",s:10,d:55}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:815},{k:"chrg",l:"charging",s:25,d:55},{k:"cIns",l:"auto ins",s:25,d:220},
      {k:"mnt_",l:"maint",s:25,d:65},{k:"tire",l:"tires",s:10,d:32},{k:"toll",l:"tolls",s:10,d:15},
      {k:"park",l:"parking",s:25,d:35},{k:"reg_",l:"registration",s:5,d:10}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:28},{k:"papr",l:"supplies",s:5,d:16},{k:"kitc",l:"kitchen",s:10,d:16},
      {k:"toil",l:"toiletries",s:10,d:42}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:65},{k:"skin",l:"skincare",s:10,d:40},
      {k:"cosm",l:"cosmetics",s:10,d:28},{k:"gym_",l:"gym",s:10,d:55}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:90},{k:"shoe",l:"shoes",s:25,d:28},{k:"work",l:"work attire",s:25,d:22}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:25,d:100},{k:"movi",l:"movies",s:10,d:30},
      {k:"hobb",l:"hobbies",s:25,d:60},{k:"dOut",l:"dining dates",s:25,d:65}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:80},{k:"vet_",l:"vet",s:25,d:70},{k:"grmg",l:"grooming",s:10,d:80},
      {k:"pIns",l:"pet ins",s:10,d:45},{k:"flea",l:"flea/hw",s:10,d:42},{k:"pSup",l:"supplies",s:5,d:16}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"2 phones",s:10,d:170},{k:"strm",l:"streaming",s:5,d:58},{k:"apps",l:"apps/subs",s:5,d:20},
      {k:"clud",l:"cloud",s:5,d:12},{k:"news",l:"news",s:5,d:12},{k:"soft",l:"software",s:5,d:12}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"hins",l:"health ins",s:25,d:330},{k:"dent",l:"dental",s:10,d:48},{k:"vis_",l:"vision",s:10,d:18},
      {k:"rx__",l:"prescriptions",s:10,d:32},{k:"supp",l:"supplements",s:10,d:32},{k:"coPA",l:"copays",s:10,d:28}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"lIns",l:"life ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:45},{k:"holi",l:"holidays",s:25,d:65},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"k401",l:"401(k)",s:50,d:410},{k:"roth",l:"Roth IRA",s:50,d:200},{k:"emrg",l:"emerg fund",s:50,d:120},
      {k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:60}]},
  ]
},

/* ── Europe ── */
zurich:{
  name:"Zurich, Switzerland",sym:"$",
  taxLabel:"Swiss Fed + Cantonal + Social (in CAD)",
  taxNote:"Swiss 2025 rates (1 CHF = 1.55 CAD)",
  taxFn(G){
    const brk=[[22544,.077],[24955,.088],[24955,.264],[1e9,.132]];
    const fed=bTx(G,brk);const cantonal=G*0.12;
    const ahv=G*0.053;const alv=Math.min(G,233850)*0.011;
    return{components:[
      {name:"Federal",color:CC3,amount:fed,brackets:brk,bracketDetail:bDetail(G,brk),formula:"progressive federal brackets"},
      {name:"Cantonal/Mun.",color:CC4,amount:cantonal,formula:"~12% effective cantonal+municipal"},
      {name:"AHV/IV/EO",color:CC1,amount:ahv,formula:"5.3% social contributions"},
      {name:"ALV",color:CC2,amount:alv,formula:"1.1% x min(G, $233,850)"},
    ],total:fed+cantonal+ahv+alv};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:100,d:3250},{k:"elec",l:"electric",s:10,d:125},{k:"gas_",l:"gas/heat",s:10,d:110},
      {k:"watr",l:"water",s:10,d:40},{k:"inet",l:"internet",s:10,d:75},{k:"cond",l:"building fees",s:10,d:80}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:850},{k:"dine",l:"dining out",s:25,d:450},{k:"deli",l:"takeout",s:25,d:200},
      {k:"coff",l:"coffee",s:10,d:110},{k:"snck",l:"snacks",s:10,d:55},{k:"alc_",l:"alcohol",s:10,d:85}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1085},{k:"chrg",l:"charging",s:10,d:65},{k:"cIns",l:"auto ins",s:25,d:200},
      {k:"mnt_",l:"maint",s:25,d:85},{k:"tire",l:"tires",s:10,d:45},{k:"cWsh",l:"car wash",s:5,d:22},
      {k:"park",l:"parking",s:25,d:80},{k:"reg_",l:"registration",s:5,d:15},{k:"toll",l:"tolls",s:10,d:25}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:45},{k:"papr",l:"supplies",s:5,d:22},{k:"kitc",l:"kitchen",s:5,d:22},
      {k:"toil",l:"toiletries",s:10,d:55}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:100},{k:"skin",l:"skincare",s:10,d:65},
      {k:"cosm",l:"cosmetics",s:10,d:40},{k:"gym_",l:"gym",s:10,d:130}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:130},{k:"shoe",l:"shoes",s:10,d:45},{k:"work",l:"work attire",s:10,d:35}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:25,d:150},{k:"movi",l:"movies",s:10,d:32},
      {k:"hobb",l:"hobbies",s:10,d:80},{k:"dOut",l:"social",s:10,d:100}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:100},{k:"vet_",l:"vet",s:25,d:120},
      {k:"grmg",l:"grooming",s:10,d:110},{k:"pSup",l:"supplies",s:5,d:25}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:55},{k:"strm",l:"streaming",s:5,d:28},
      {k:"apps",l:"apps/subs",s:5,d:18},{k:"clud",l:"cloud",s:5,d:12}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"hins",l:"health ins",s:25,d:620},{k:"dent",l:"dental",s:10,d:75},{k:"vis_",l:"vision",s:10,d:25},
      {k:"rx__",l:"pharmacy",s:10,d:35},{k:"supp",l:"supplements",s:10,d:30}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"lIns",l:"life ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:55},{k:"holi",l:"holidays",s:25,d:85},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"pilr",l:"Pillar 3a",s:50,d:450},{k:"emrg",l:"emerg fund",s:50,d:200},
      {k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:90}]},
  ]
},

prague:{
  name:"Prague, Czech Rep.",sym:"$",
  taxLabel:"Czech Flat Tax + Social (in CAD)",
  taxNote:"Czech 2025 rates (1 CZK = 0.058 CAD)",
  taxFn(G){
    const brk=[[112262,.15],[1e9,.23]];
    const pit=Math.max(0,bTx(G,brk)-1789);
    const ss=Math.min(G,116000)*0.11;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"15% to $112k, 23% above - $1,789 credit"},
      {name:"Social/Health",color:CC1,amount:ss,formula:"11% x min(G, $116,000)"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1200},{k:"elec",l:"electric",s:10,d:110},{k:"gas_",l:"gas/heat",s:10,d:85},
      {k:"watr",l:"water",s:10,d:25},{k:"inet",l:"internet",s:10,d:30},{k:"cond",l:"building fees",s:10,d:55}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:400},{k:"dine",l:"dining out",s:25,d:200},{k:"deli",l:"takeout",s:25,d:95},
      {k:"coff",l:"coffee",s:10,d:60},{k:"snck",l:"snacks",s:10,d:30},{k:"alc_",l:"alcohol",s:10,d:50}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:975},{k:"chrg",l:"charging",s:10,d:40},{k:"cIns",l:"auto ins",s:25,d:120},
      {k:"mnt_",l:"maint",s:25,d:35},{k:"tire",l:"tires",s:10,d:22},{k:"cWsh",l:"car wash",s:5,d:10},
      {k:"park",l:"parking",s:25,d:30},{k:"reg_",l:"registration",s:5,d:8},{k:"toll",l:"tolls",s:10,d:15}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:22},{k:"papr",l:"supplies",s:5,d:12},{k:"kitc",l:"kitchen",s:5,d:12},
      {k:"toil",l:"toiletries",s:10,d:32}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:30},{k:"skin",l:"skincare",s:10,d:28},
      {k:"cosm",l:"cosmetics",s:10,d:18},{k:"gym_",l:"gym",s:10,d:55}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:70},{k:"shoe",l:"shoes",s:10,d:22},{k:"work",l:"work attire",s:10,d:18}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:55},{k:"movi",l:"movies",s:10,d:15},
      {k:"hobb",l:"hobbies",s:10,d:38},{k:"dOut",l:"social",s:10,d:50}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:55},{k:"vet_",l:"vet",s:10,d:35},
      {k:"grmg",l:"grooming",s:10,d:22},{k:"pSup",l:"supplies",s:5,d:12}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:22},{k:"strm",l:"streaming",s:5,d:22},
      {k:"apps",l:"apps/subs",s:5,d:12},{k:"clud",l:"cloud",s:5,d:8}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:22},{k:"vis_",l:"vision",s:10,d:12},{k:"rx__",l:"pharmacy",s:10,d:12},
      {k:"supp",l:"supplements",s:10,d:18},{k:"priv",l:"private doctor",s:10,d:22}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:45}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:28},{k:"holi",l:"holidays",s:25,d:55},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:70},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:50}]},
  ]
},

warsaw:{
  name:"Warsaw, Poland",sym:"$",
  taxLabel:"Polish PIT + Social (in CAD)",
  taxNote:"Polish 2025 rates (1 PLN = 0.34 CAD)",
  taxFn(G){
    const free=10200;const taxable=Math.max(0,G-free);
    const brk=[[40800,.12],[1e9,.32]];
    const pit=bTx(taxable,brk);
    const ss=Math.min(G,79805)*0.1371;const health=(G-Math.min(G,79805)*0.1371)*0.09;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(taxable,brk),formula:"12% to $40,800, 32% above (- $10,200 free)"},
      {name:"Social Ins.",color:CC1,amount:ss,formula:"13.71% x min(G, $79,805)"},
      {name:"Health",color:CC2,amount:health,formula:"9% x (G - social)"},
    ],total:pit+ss+health};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1050},{k:"elec",l:"electric",s:10,d:90},{k:"gas_",l:"gas/heat",s:10,d:75},
      {k:"watr",l:"water",s:10,d:20},{k:"inet",l:"internet",s:10,d:25},{k:"cond",l:"building fees",s:10,d:45}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:350},{k:"dine",l:"dining out",s:25,d:170},{k:"deli",l:"takeout",s:25,d:85},
      {k:"coff",l:"coffee",s:10,d:50},{k:"snck",l:"snacks",s:10,d:25},{k:"alc_",l:"alcohol",s:10,d:40}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:975},{k:"chrg",l:"charging",s:10,d:35},{k:"cIns",l:"auto ins",s:25,d:100},
      {k:"mnt_",l:"maint",s:25,d:30},{k:"tire",l:"tires",s:10,d:20},{k:"cWsh",l:"car wash",s:5,d:8},
      {k:"park",l:"parking",s:25,d:25},{k:"reg_",l:"registration",s:5,d:8},{k:"toll",l:"tolls",s:10,d:12}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:20},{k:"papr",l:"supplies",s:5,d:10},{k:"kitc",l:"kitchen",s:5,d:10},
      {k:"toil",l:"toiletries",s:10,d:28}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:25},{k:"skin",l:"skincare",s:10,d:22},
      {k:"cosm",l:"cosmetics",s:10,d:15},{k:"gym_",l:"gym",s:10,d:45}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:60},{k:"shoe",l:"shoes",s:10,d:20},{k:"work",l:"work attire",s:10,d:15}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:45},{k:"movi",l:"movies",s:10,d:12},
      {k:"hobb",l:"hobbies",s:10,d:30},{k:"dOut",l:"social",s:10,d:42}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:48},{k:"vet_",l:"vet",s:10,d:28},
      {k:"grmg",l:"grooming",s:10,d:18},{k:"pSup",l:"supplies",s:5,d:10}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:18},{k:"strm",l:"streaming",s:5,d:20},
      {k:"apps",l:"apps/subs",s:5,d:10},{k:"clud",l:"cloud",s:5,d:6}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:18},{k:"vis_",l:"vision",s:10,d:10},{k:"rx__",l:"pharmacy",s:10,d:10},
      {k:"supp",l:"supplements",s:10,d:15},{k:"priv",l:"private doctor",s:10,d:18}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:35}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:22},{k:"holi",l:"holidays",s:25,d:45},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:60},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:42}]},
  ]
},

bucharest:{
  name:"Bucharest, Romania",sym:"$",
  taxLabel:"Romanian Flat Tax + Social (in CAD)",
  taxNote:"ANAF 2025 rates (1 RON = 0.30 CAD)",
  taxFn(G){
    const pit=G*0.10;const pension=G*0.25;const health=G*0.10;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,formula:"10% flat x G"},
      {name:"Pension",color:CC1,amount:pension,formula:"25% x G"},
      {name:"Health",color:CC2,amount:health,formula:"10% x G"},
    ],total:pit+pension+health};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:900},{k:"elec",l:"electric",s:10,d:70},{k:"gas_",l:"gas/heat",s:10,d:60},
      {k:"watr",l:"water",s:10,d:15},{k:"inet",l:"internet",s:10,d:18},{k:"cond",l:"building fees",s:10,d:35}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:280},{k:"dine",l:"dining out",s:25,d:135},{k:"deli",l:"takeout",s:25,d:65},
      {k:"coff",l:"coffee",s:10,d:40},{k:"snck",l:"snacks",s:10,d:20},{k:"alc_",l:"alcohol",s:10,d:30}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:975},{k:"chrg",l:"charging",s:10,d:30},{k:"cIns",l:"auto ins",s:25,d:80},
      {k:"mnt_",l:"maint",s:25,d:25},{k:"tire",l:"tires",s:10,d:18},{k:"cWsh",l:"car wash",s:5,d:6},
      {k:"park",l:"parking",s:25,d:18},{k:"reg_",l:"registration",s:5,d:6},{k:"toll",l:"tolls",s:10,d:10}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:15},{k:"papr",l:"supplies",s:5,d:8},{k:"kitc",l:"kitchen",s:5,d:8},
      {k:"toil",l:"toiletries",s:10,d:22}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:18},{k:"skin",l:"skincare",s:10,d:18},
      {k:"cosm",l:"cosmetics",s:10,d:12},{k:"gym_",l:"gym",s:10,d:40}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:50},{k:"shoe",l:"shoes",s:10,d:18},{k:"work",l:"work attire",s:10,d:12}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:35},{k:"movi",l:"movies",s:10,d:10},
      {k:"hobb",l:"hobbies",s:10,d:25},{k:"dOut",l:"social",s:10,d:35}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:35},{k:"vet_",l:"vet",s:10,d:22},
      {k:"grmg",l:"grooming",s:10,d:12},{k:"pSup",l:"supplies",s:5,d:8}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:12},{k:"strm",l:"streaming",s:5,d:18},
      {k:"apps",l:"apps/subs",s:5,d:8},{k:"clud",l:"cloud",s:5,d:5}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:15},{k:"vis_",l:"vision",s:10,d:8},{k:"rx__",l:"pharmacy",s:10,d:8},
      {k:"supp",l:"supplements",s:10,d:12},{k:"priv",l:"private doctor",s:10,d:15}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:25}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:18},{k:"holi",l:"holidays",s:25,d:35},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:50},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:35}]},
  ]
},

malta:{
  name:"Malta",sym:"$",
  taxLabel:"Maltese Income Tax + NI (in CAD)",
  taxNote:"Malta 2025 rates (1 EUR = 1.50 CAD)",
  taxFn(G){
    const brk=[[14250,0],[9750,.15],[16500,.25],[1e9,.35]];
    const pit=bTx(G,brk);const ni=Math.min(G,40500)*0.10;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"0-35% progressive brackets"},
      {name:"Nat. Insurance",color:CC1,amount:ni,formula:"10% x min(G, $40,500)"},
    ],total:pit+ni};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1350},{k:"elec",l:"electric",s:10,d:120},{k:"gas_",l:"gas/heat",s:10,d:30},
      {k:"watr",l:"water",s:10,d:15},{k:"inet",l:"internet",s:10,d:38},{k:"cond",l:"building fees",s:10,d:40}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:450},{k:"dine",l:"dining out",s:25,d:225},{k:"deli",l:"takeout",s:25,d:105},
      {k:"coff",l:"coffee",s:10,d:55},{k:"snck",l:"snacks",s:10,d:30},{k:"alc_",l:"alcohol",s:10,d:50}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1200},{k:"chrg",l:"charging",s:10,d:45},{k:"cIns",l:"auto ins",s:25,d:140},
      {k:"mnt_",l:"maint",s:25,d:40},{k:"tire",l:"tires",s:10,d:25},{k:"cWsh",l:"car wash",s:5,d:12},
      {k:"park",l:"parking",s:25,d:25},{k:"reg_",l:"registration",s:5,d:10},{k:"toll",l:"tolls",s:10,d:0}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:25},{k:"papr",l:"supplies",s:5,d:12},{k:"kitc",l:"kitchen",s:5,d:12},
      {k:"toil",l:"toiletries",s:10,d:35}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:30},{k:"skin",l:"skincare",s:10,d:30},
      {k:"cosm",l:"cosmetics",s:10,d:20},{k:"gym_",l:"gym",s:10,d:65}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:75},{k:"shoe",l:"shoes",s:10,d:25},{k:"work",l:"work attire",s:10,d:20}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:55},{k:"movi",l:"movies",s:10,d:15},
      {k:"hobb",l:"hobbies",s:10,d:40},{k:"dOut",l:"social",s:10,d:55}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:55},{k:"vet_",l:"vet",s:10,d:35},
      {k:"grmg",l:"grooming",s:10,d:22},{k:"pSup",l:"supplies",s:5,d:12}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:28},{k:"strm",l:"streaming",s:5,d:22},
      {k:"apps",l:"apps/subs",s:5,d:12},{k:"clud",l:"cloud",s:5,d:8}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:28},{k:"vis_",l:"vision",s:10,d:12},{k:"rx__",l:"pharmacy",s:10,d:15},
      {k:"supp",l:"supplements",s:10,d:20},{k:"priv",l:"private doctor",s:10,d:25}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:50}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:30},{k:"holi",l:"holidays",s:25,d:55},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:65},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:50}]},
  ]
},

valencia:{
  name:"Valencia, Spain",sym:"$",
  taxLabel:"Spanish IRPF + Social (in CAD)",
  taxNote:"AEAT 2025 rates (1 EUR = 1.50 CAD)",
  taxFn(G){
    const brk=[[18750,.285],[16500,.387],[17250,.447],[42000,.447],[1e9,.495]];
    const pit=bTx(G,brk);const ss=Math.min(G,66600)*0.0635;
    return{components:[
      {name:"IRPF",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"state+regional brackets"},
      {name:"Soc. Security",color:CC1,amount:ss,formula:"6.35% x min(G, $66,600)"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1125},{k:"elec",l:"electric",s:10,d:100},{k:"gas_",l:"gas/heat",s:10,d:45},
      {k:"watr",l:"water",s:10,d:35},{k:"inet",l:"internet",s:10,d:48},{k:"cond",l:"community fees",s:10,d:55}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:425},{k:"dine",l:"dining out",s:25,d:200},{k:"deli",l:"takeout",s:25,d:90},
      {k:"coff",l:"coffee",s:10,d:55},{k:"snck",l:"snacks",s:10,d:30},{k:"alc_",l:"alcohol",s:10,d:40}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1100},{k:"chrg",l:"charging",s:10,d:42},{k:"cIns",l:"auto ins",s:25,d:120},
      {k:"mnt_",l:"maint",s:25,d:35},{k:"tire",l:"tires",s:10,d:22},{k:"cWsh",l:"car wash",s:5,d:12},
      {k:"park",l:"parking",s:25,d:25},{k:"reg_",l:"registration",s:5,d:8},{k:"toll",l:"tolls",s:10,d:15}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:25},{k:"papr",l:"supplies",s:5,d:12},{k:"kitc",l:"kitchen",s:5,d:12},
      {k:"toil",l:"toiletries",s:10,d:32}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:35},{k:"skin",l:"skincare",s:10,d:32},
      {k:"cosm",l:"cosmetics",s:10,d:20},{k:"gym_",l:"gym",s:10,d:55}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:70},{k:"shoe",l:"shoes",s:10,d:22},{k:"work",l:"work attire",s:10,d:18}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:55},{k:"movi",l:"movies",s:10,d:15},
      {k:"hobb",l:"hobbies",s:10,d:38},{k:"dOut",l:"social",s:10,d:50}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:60},{k:"vet_",l:"vet",s:10,d:35},
      {k:"grmg",l:"grooming",s:10,d:22},{k:"pSup",l:"supplies",s:5,d:12}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:22},{k:"strm",l:"streaming",s:5,d:22},
      {k:"apps",l:"apps/subs",s:5,d:12},{k:"clud",l:"cloud",s:5,d:8}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:28},{k:"vis_",l:"vision",s:10,d:12},{k:"rx__",l:"pharmacy",s:10,d:15},
      {k:"supp",l:"supplements",s:10,d:20},{k:"priv",l:"private doctor",s:10,d:22}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:55}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:30},{k:"holi",l:"holidays",s:25,d:55},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:60},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:45}]},
  ]
},

porto:{
  name:"Porto, Portugal",sym:"$",
  taxLabel:"Portuguese IRS + Social (in CAD)",
  taxNote:"Portuguese 2025 rates (1 EUR = 1.50 CAD)",
  taxFn(G){
    const brk=[[11625,.135],[10485,.18],[15038,.23],[15038,.26],[21825,.3275],[24405,.37],[24780,.435],[45900,.45],[1e9,.48]];
    const pit=bTx(G,brk);const ss=G*0.11;
    return{components:[
      {name:"IRS",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"progressive 13.5-48% brackets"},
      {name:"Soc. Security",color:CC1,amount:ss,formula:"11% x G"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1100},{k:"elec",l:"electric",s:10,d:95},{k:"gas_",l:"gas/heat",s:10,d:50},
      {k:"watr",l:"water",s:10,d:30},{k:"inet",l:"internet",s:10,d:48},{k:"cond",l:"building fees",s:10,d:45}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:400},{k:"dine",l:"dining out",s:25,d:180},{k:"deli",l:"takeout",s:25,d:80},
      {k:"coff",l:"coffee",s:10,d:45},{k:"snck",l:"snacks",s:10,d:25},{k:"alc_",l:"alcohol",s:10,d:40}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1050},{k:"chrg",l:"charging",s:10,d:42},{k:"cIns",l:"auto ins",s:25,d:100},
      {k:"mnt_",l:"maint",s:25,d:30},{k:"tire",l:"tires",s:10,d:22},{k:"cWsh",l:"car wash",s:5,d:10},
      {k:"park",l:"parking",s:25,d:22},{k:"reg_",l:"registration",s:5,d:8},{k:"toll",l:"tolls",s:10,d:15}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:22},{k:"papr",l:"supplies",s:5,d:10},{k:"kitc",l:"kitchen",s:5,d:10},
      {k:"toil",l:"toiletries",s:10,d:30}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:30},{k:"skin",l:"skincare",s:10,d:28},
      {k:"cosm",l:"cosmetics",s:10,d:18},{k:"gym_",l:"gym",s:10,d:55}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:65},{k:"shoe",l:"shoes",s:10,d:22},{k:"work",l:"work attire",s:10,d:18}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:45},{k:"movi",l:"movies",s:10,d:12},
      {k:"hobb",l:"hobbies",s:10,d:35},{k:"dOut",l:"social",s:10,d:45}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:55},{k:"vet_",l:"vet",s:10,d:30},
      {k:"grmg",l:"grooming",s:10,d:18},{k:"pSup",l:"supplies",s:5,d:10}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:25},{k:"strm",l:"streaming",s:5,d:22},
      {k:"apps",l:"apps/subs",s:5,d:12},{k:"clud",l:"cloud",s:5,d:8}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:25},{k:"vis_",l:"vision",s:10,d:12},{k:"rx__",l:"pharmacy",s:10,d:12},
      {k:"supp",l:"supplements",s:10,d:18},{k:"priv",l:"private doctor",s:10,d:20}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:50}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:28},{k:"holi",l:"holidays",s:25,d:50},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:55},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:42}]},
  ]
},

algarve:{
  name:"Algarve, Portugal",sym:"$",
  taxLabel:"Portuguese IRS + Social (in CAD)",
  taxNote:"Portuguese 2025 rates (1 EUR = 1.50 CAD)",
  taxFn(G){
    const brk=[[11625,.135],[10485,.18],[15038,.23],[15038,.26],[21825,.3275],[24405,.37],[24780,.435],[45900,.45],[1e9,.48]];
    const pit=bTx(G,brk);const ss=G*0.11;
    return{components:[
      {name:"IRS",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"progressive 13.5-48% brackets"},
      {name:"Soc. Security",color:CC1,amount:ss,formula:"11% x G"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1050},{k:"elec",l:"electric",s:10,d:90},{k:"gas_",l:"gas/heat",s:10,d:40},
      {k:"watr",l:"water",s:10,d:28},{k:"inet",l:"internet",s:10,d:45},{k:"cond",l:"building fees",s:10,d:40}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:380},{k:"dine",l:"dining out",s:25,d:165},{k:"deli",l:"takeout",s:25,d:70},
      {k:"coff",l:"coffee",s:10,d:40},{k:"snck",l:"snacks",s:10,d:22},{k:"alc_",l:"alcohol",s:10,d:35}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1050},{k:"chrg",l:"charging",s:10,d:40},{k:"cIns",l:"auto ins",s:25,d:95},
      {k:"mnt_",l:"maint",s:25,d:28},{k:"tire",l:"tires",s:10,d:20},{k:"cWsh",l:"car wash",s:5,d:8},
      {k:"park",l:"parking",s:25,d:15},{k:"reg_",l:"registration",s:5,d:8},{k:"toll",l:"tolls",s:10,d:20}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:20},{k:"papr",l:"supplies",s:5,d:10},{k:"kitc",l:"kitchen",s:5,d:10},
      {k:"toil",l:"toiletries",s:10,d:28}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:28},{k:"skin",l:"skincare",s:10,d:25},
      {k:"cosm",l:"cosmetics",s:10,d:15},{k:"gym_",l:"gym",s:10,d:48}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:60},{k:"shoe",l:"shoes",s:10,d:20},{k:"work",l:"work attire",s:10,d:15}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:40},{k:"movi",l:"movies",s:10,d:12},
      {k:"hobb",l:"hobbies",s:10,d:35},{k:"dOut",l:"social",s:10,d:42}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:50},{k:"vet_",l:"vet",s:10,d:28},
      {k:"grmg",l:"grooming",s:10,d:15},{k:"pSup",l:"supplies",s:5,d:10}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:25},{k:"strm",l:"streaming",s:5,d:22},
      {k:"apps",l:"apps/subs",s:5,d:12},{k:"clud",l:"cloud",s:5,d:8}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:22},{k:"vis_",l:"vision",s:10,d:10},{k:"rx__",l:"pharmacy",s:10,d:10},
      {k:"supp",l:"supplements",s:10,d:15},{k:"priv",l:"private doctor",s:10,d:18}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:48}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:25},{k:"holi",l:"holidays",s:25,d:48},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:50},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:40}]},
  ]
},

crete:{
  name:"Crete, Greece",sym:"$",
  taxLabel:"Greek Income Tax + Social (in CAD)",
  taxNote:"Greek 2025 AADE rates (1 EUR = 1.50 CAD)",
  taxFn(G){
    const brk=[[15000,.09],[15000,.22],[15000,.28],[15000,.36],[1e9,.44]];
    const pit=bTx(G,brk);const ss=G*0.1387;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"9-44% progressive brackets"},
      {name:"Social Ins.",color:CC1,amount:ss,formula:"13.87% x G"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:900},{k:"elec",l:"electric",s:10,d:110},{k:"gas_",l:"gas/heat",s:10,d:35},
      {k:"watr",l:"water",s:10,d:22},{k:"inet",l:"internet",s:10,d:42},{k:"cond",l:"building fees",s:10,d:30}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:380},{k:"dine",l:"dining out",s:25,d:175},{k:"deli",l:"takeout",s:25,d:75},
      {k:"coff",l:"coffee",s:10,d:45},{k:"snck",l:"snacks",s:10,d:22},{k:"alc_",l:"alcohol",s:10,d:35}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1100},{k:"chrg",l:"charging",s:10,d:42},{k:"cIns",l:"auto ins",s:25,d:110},
      {k:"mnt_",l:"maint",s:25,d:30},{k:"tire",l:"tires",s:10,d:22},{k:"cWsh",l:"car wash",s:5,d:8},
      {k:"park",l:"parking",s:25,d:15},{k:"reg_",l:"registration",s:5,d:8},{k:"toll",l:"tolls",s:10,d:10}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:20},{k:"papr",l:"supplies",s:5,d:10},{k:"kitc",l:"kitchen",s:5,d:10},
      {k:"toil",l:"toiletries",s:10,d:28}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:25},{k:"skin",l:"skincare",s:10,d:25},
      {k:"cosm",l:"cosmetics",s:10,d:15},{k:"gym_",l:"gym",s:10,d:45}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:60},{k:"shoe",l:"shoes",s:10,d:20},{k:"work",l:"work attire",s:10,d:15}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:40},{k:"movi",l:"movies",s:10,d:12},
      {k:"hobb",l:"hobbies",s:10,d:30},{k:"dOut",l:"social",s:10,d:40}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:50},{k:"vet_",l:"vet",s:10,d:28},
      {k:"grmg",l:"grooming",s:10,d:15},{k:"pSup",l:"supplies",s:5,d:10}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:25},{k:"strm",l:"streaming",s:5,d:22},
      {k:"apps",l:"apps/subs",s:5,d:12},{k:"clud",l:"cloud",s:5,d:8}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:22},{k:"vis_",l:"vision",s:10,d:10},{k:"rx__",l:"pharmacy",s:10,d:10},
      {k:"supp",l:"supplements",s:10,d:15},{k:"priv",l:"private doctor",s:10,d:18}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:48}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:25},{k:"holi",l:"holidays",s:25,d:48},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:50},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:40}]},
  ]
},

dubrovnik:{
  name:"Dubrovnik, Croatia",sym:"$",
  taxLabel:"Croatian Income Tax + Social (in CAD)",
  taxNote:"Croatian 2025 rates (1 EUR = 1.50 CAD)",
  taxFn(G){
    const brk=[[70200,.20],[1e9,.30]];const pit=bTx(G,brk);
    const ss=G*0.20;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"20% to $70,200, 30% above"},
      {name:"Soc. Contributions",color:CC1,amount:ss,formula:"20% pension+health"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1150},{k:"elec",l:"electric",s:10,d:100},{k:"gas_",l:"gas/heat",s:10,d:55},
      {k:"watr",l:"water",s:10,d:25},{k:"inet",l:"internet",s:10,d:35},{k:"cond",l:"building fees",s:10,d:40}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:420},{k:"dine",l:"dining out",s:25,d:210},{k:"deli",l:"takeout",s:25,d:90},
      {k:"coff",l:"coffee",s:10,d:50},{k:"snck",l:"snacks",s:10,d:28},{k:"alc_",l:"alcohol",s:10,d:42}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1100},{k:"chrg",l:"charging",s:10,d:42},{k:"cIns",l:"auto ins",s:25,d:110},
      {k:"mnt_",l:"maint",s:25,d:32},{k:"tire",l:"tires",s:10,d:22},{k:"cWsh",l:"car wash",s:5,d:10},
      {k:"park",l:"parking",s:25,d:20},{k:"reg_",l:"registration",s:5,d:8},{k:"toll",l:"tolls",s:10,d:15}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:22},{k:"papr",l:"supplies",s:5,d:10},{k:"kitc",l:"kitchen",s:5,d:10},
      {k:"toil",l:"toiletries",s:10,d:30}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:28},{k:"skin",l:"skincare",s:10,d:25},
      {k:"cosm",l:"cosmetics",s:10,d:15},{k:"gym_",l:"gym",s:10,d:50}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:65},{k:"shoe",l:"shoes",s:10,d:22},{k:"work",l:"work attire",s:10,d:15}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:50},{k:"movi",l:"movies",s:10,d:12},
      {k:"hobb",l:"hobbies",s:10,d:32},{k:"dOut",l:"social",s:10,d:48}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:50},{k:"vet_",l:"vet",s:10,d:28},
      {k:"grmg",l:"grooming",s:10,d:15},{k:"pSup",l:"supplies",s:5,d:10}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:25},{k:"strm",l:"streaming",s:5,d:22},
      {k:"apps",l:"apps/subs",s:5,d:12},{k:"clud",l:"cloud",s:5,d:8}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:22},{k:"vis_",l:"vision",s:10,d:10},{k:"rx__",l:"pharmacy",s:10,d:10},
      {k:"supp",l:"supplements",s:10,d:15},{k:"priv",l:"private doctor",s:10,d:18}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:42}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:25},{k:"holi",l:"holidays",s:25,d:50},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:55},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:42}]},
  ]
},

/* ── Latin America ── */
medellin:{
  name:"Medellin, Colombia",sym:"$",
  taxLabel:"Colombian Income Tax + Social (in CAD)",
  taxNote:"DIAN 2025 rates (1 COP = 0.00032 CAD)",
  taxFn(G){
    const brk=[[17920,0],[10432,.19],[10432,.28],[14592,.33],[20800,.35],[20800,.37],[1e9,.39]];
    const pit=bTx(G,brk);const ss=G*0.08;const health=G*0.04;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"0-39% progressive brackets"},
      {name:"Pension",color:CC1,amount:ss,formula:"8% x G (employee share)"},
      {name:"Health",color:CC2,amount:health,formula:"4% x G"},
    ],total:pit+ss+health};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:650},{k:"elec",l:"electric",s:10,d:45},{k:"gas_",l:"gas",s:10,d:20},
      {k:"watr",l:"water",s:10,d:15},{k:"inet",l:"internet",s:10,d:25},{k:"cond",l:"admin fees",s:10,d:55}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:250},{k:"dine",l:"dining out",s:25,d:120},{k:"deli",l:"takeout",s:25,d:55},
      {k:"coff",l:"coffee",s:10,d:30},{k:"snck",l:"snacks",s:10,d:18},{k:"alc_",l:"alcohol",s:10,d:25}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1300},{k:"chrg",l:"charging",s:10,d:25},{k:"cIns",l:"auto ins",s:25,d:65},
      {k:"mnt_",l:"maint",s:25,d:22},{k:"tire",l:"tires",s:10,d:15},{k:"cWsh",l:"car wash",s:5,d:5},
      {k:"park",l:"parking",s:25,d:15},{k:"reg_",l:"registration",s:5,d:5},{k:"toll",l:"tolls",s:10,d:10}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:12},{k:"papr",l:"supplies",s:5,d:6},{k:"kitc",l:"kitchen",s:5,d:6},
      {k:"toil",l:"toiletries",s:10,d:18}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:15},{k:"skin",l:"skincare",s:10,d:15},
      {k:"cosm",l:"cosmetics",s:10,d:10},{k:"gym_",l:"gym",s:10,d:32}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:40},{k:"shoe",l:"shoes",s:10,d:15},{k:"work",l:"work attire",s:10,d:10}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:30},{k:"movi",l:"movies",s:10,d:8},
      {k:"hobb",l:"hobbies",s:10,d:20},{k:"dOut",l:"social",s:10,d:30}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:28},{k:"vet_",l:"vet",s:10,d:15},
      {k:"grmg",l:"grooming",s:10,d:10},{k:"pSup",l:"supplies",s:5,d:6}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:15},{k:"strm",l:"streaming",s:5,d:15},
      {k:"apps",l:"apps/subs",s:5,d:8},{k:"clud",l:"cloud",s:5,d:5}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:12},{k:"vis_",l:"vision",s:10,d:6},{k:"rx__",l:"pharmacy",s:10,d:6},
      {k:"supp",l:"supplements",s:10,d:10},{k:"priv",l:"private doctor",s:10,d:12}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:35}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:15},{k:"holi",l:"holidays",s:25,d:30},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:40},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:30}]},
  ]
},

mexicocity:{
  name:"Mexico City, Mexico",sym:"$",
  taxLabel:"Mexican ISR + Social (in CAD)",
  taxNote:"SAT 2025 rates (1 MXN = 0.076 CAD)",
  taxFn(G){
    const brk=[[5366,.0192],[45508,.064],[80061,.1088],[93188,.16],[111512,.1792],[224688,.2136],[455036,.2352],[967948,.30],[1e9,.35]];
    const pit=bTx(G,brk);const ss=G*0.04;
    return{components:[
      {name:"ISR",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"1.92-35% progressive brackets"},
      {name:"Social Ins.",color:CC1,amount:ss,formula:"~4% employee social"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:950},{k:"elec",l:"electric",s:10,d:40},{k:"gas_",l:"gas",s:10,d:25},
      {k:"watr",l:"water",s:10,d:10},{k:"inet",l:"internet",s:10,d:30},{k:"cond",l:"building fees",s:10,d:45}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:300},{k:"dine",l:"dining out",s:25,d:150},{k:"deli",l:"takeout",s:25,d:65},
      {k:"coff",l:"coffee",s:10,d:38},{k:"snck",l:"snacks",s:10,d:20},{k:"alc_",l:"alcohol",s:10,d:30}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1200},{k:"chrg",l:"charging",s:10,d:30},{k:"cIns",l:"auto ins",s:25,d:75},
      {k:"mnt_",l:"maint",s:25,d:25},{k:"tire",l:"tires",s:10,d:18},{k:"cWsh",l:"car wash",s:5,d:5},
      {k:"park",l:"parking",s:25,d:25},{k:"reg_",l:"registration",s:5,d:8},{k:"toll",l:"tolls",s:10,d:15}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:15},{k:"papr",l:"supplies",s:5,d:8},{k:"kitc",l:"kitchen",s:5,d:8},
      {k:"toil",l:"toiletries",s:10,d:22}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:18},{k:"skin",l:"skincare",s:10,d:18},
      {k:"cosm",l:"cosmetics",s:10,d:12},{k:"gym_",l:"gym",s:10,d:38}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:50},{k:"shoe",l:"shoes",s:10,d:18},{k:"work",l:"work attire",s:10,d:12}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:38},{k:"movi",l:"movies",s:10,d:8},
      {k:"hobb",l:"hobbies",s:10,d:25},{k:"dOut",l:"social",s:10,d:35}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:30},{k:"vet_",l:"vet",s:10,d:18},
      {k:"grmg",l:"grooming",s:10,d:12},{k:"pSup",l:"supplies",s:5,d:6}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:18},{k:"strm",l:"streaming",s:5,d:18},
      {k:"apps",l:"apps/subs",s:5,d:8},{k:"clud",l:"cloud",s:5,d:5}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:15},{k:"vis_",l:"vision",s:10,d:8},{k:"rx__",l:"pharmacy",s:10,d:8},
      {k:"supp",l:"supplements",s:10,d:12},{k:"priv",l:"private doctor",s:10,d:15}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:40}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:18},{k:"holi",l:"holidays",s:25,d:35},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:45},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:35}]},
  ]
},

playadelcarmen:{
  name:"Playa del Carmen, MX",sym:"$",
  taxLabel:"Mexican ISR + Social (in CAD)",
  taxNote:"SAT 2025 rates (1 MXN = 0.076 CAD)",
  taxFn(G){
    const brk=[[5366,.0192],[45508,.064],[80061,.1088],[93188,.16],[111512,.1792],[224688,.2136],[455036,.2352],[967948,.30],[1e9,.35]];
    const pit=bTx(G,brk);const ss=G*0.04;
    return{components:[
      {name:"ISR",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"1.92-35% progressive brackets"},
      {name:"Social Ins.",color:CC1,amount:ss,formula:"~4% employee social"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:1100},{k:"elec",l:"electric",s:10,d:50},{k:"gas_",l:"gas",s:10,d:20},
      {k:"watr",l:"water",s:10,d:10},{k:"inet",l:"internet",s:10,d:35},{k:"cond",l:"building fees",s:10,d:50}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:320},{k:"dine",l:"dining out",s:25,d:175},{k:"deli",l:"takeout",s:25,d:75},
      {k:"coff",l:"coffee",s:10,d:42},{k:"snck",l:"snacks",s:10,d:22},{k:"alc_",l:"alcohol",s:10,d:35}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1200},{k:"chrg",l:"charging",s:10,d:28},{k:"cIns",l:"auto ins",s:25,d:70},
      {k:"mnt_",l:"maint",s:25,d:22},{k:"tire",l:"tires",s:10,d:15},{k:"cWsh",l:"car wash",s:5,d:5},
      {k:"park",l:"parking",s:25,d:15},{k:"reg_",l:"registration",s:5,d:8},{k:"toll",l:"tolls",s:10,d:10}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:12},{k:"papr",l:"supplies",s:5,d:6},{k:"kitc",l:"kitchen",s:5,d:6},
      {k:"toil",l:"toiletries",s:10,d:20}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:15},{k:"skin",l:"skincare",s:10,d:15},
      {k:"cosm",l:"cosmetics",s:10,d:10},{k:"gym_",l:"gym",s:10,d:45}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:45},{k:"shoe",l:"shoes",s:10,d:15},{k:"work",l:"work attire",s:10,d:10}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:45},{k:"movi",l:"movies",s:10,d:10},
      {k:"hobb",l:"hobbies",s:10,d:30},{k:"dOut",l:"social",s:10,d:40}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:28},{k:"vet_",l:"vet",s:10,d:15},
      {k:"grmg",l:"grooming",s:10,d:10},{k:"pSup",l:"supplies",s:5,d:6}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:18},{k:"strm",l:"streaming",s:5,d:18},
      {k:"apps",l:"apps/subs",s:5,d:8},{k:"clud",l:"cloud",s:5,d:5}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:12},{k:"vis_",l:"vision",s:10,d:6},{k:"rx__",l:"pharmacy",s:10,d:6},
      {k:"supp",l:"supplements",s:10,d:10},{k:"priv",l:"private doctor",s:10,d:12}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:38}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:15},{k:"holi",l:"holidays",s:25,d:32},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:42},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:32}]},
  ]
},

buenosaires:{
  name:"Buenos Aires, Argentina",sym:"$",
  taxLabel:"Argentine Income Tax + Social (in CAD)",
  taxNote:"AFIP 2025 rates (1 ARS = 0.0012 CAD)",
  taxFn(G){
    const brk=[[5760,.05],[11520,.09],[17280,.12],[23040,.15],[34560,.19],[46080,.23],[69120,.27],[92160,.31],[1e9,.35]];
    const pit=bTx(G,brk);const ss=G*0.17;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"5-35% progressive brackets"},
      {name:"Social/Jub./Obra",color:CC1,amount:ss,formula:"17% employee social"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:600},{k:"elec",l:"electric",s:10,d:20},{k:"gas_",l:"gas",s:10,d:12},
      {k:"watr",l:"water",s:10,d:8},{k:"inet",l:"internet",s:10,d:18},{k:"cond",l:"expensas",s:10,d:55}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:220},{k:"dine",l:"dining out",s:25,d:100},{k:"deli",l:"takeout",s:25,d:45},
      {k:"coff",l:"coffee",s:10,d:25},{k:"snck",l:"snacks",s:10,d:15},{k:"alc_",l:"alcohol",s:10,d:22}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1800},{k:"chrg",l:"charging",s:10,d:18},{k:"cIns",l:"auto ins",s:25,d:50},
      {k:"mnt_",l:"maint",s:25,d:18},{k:"tire",l:"tires",s:10,d:12},{k:"cWsh",l:"car wash",s:5,d:5},
      {k:"park",l:"parking",s:25,d:18},{k:"reg_",l:"registration",s:5,d:5},{k:"toll",l:"tolls",s:10,d:12}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:10},{k:"papr",l:"supplies",s:5,d:5},{k:"kitc",l:"kitchen",s:5,d:5},
      {k:"toil",l:"toiletries",s:10,d:15}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:12},{k:"skin",l:"skincare",s:10,d:12},
      {k:"cosm",l:"cosmetics",s:10,d:8},{k:"gym_",l:"gym",s:10,d:30}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:40},{k:"shoe",l:"shoes",s:10,d:15},{k:"work",l:"work attire",s:10,d:10}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:25},{k:"movi",l:"movies",s:10,d:6},
      {k:"hobb",l:"hobbies",s:10,d:18},{k:"dOut",l:"social",s:10,d:25}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:22},{k:"vet_",l:"vet",s:10,d:12},
      {k:"grmg",l:"grooming",s:10,d:8},{k:"pSup",l:"supplies",s:5,d:5}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:10},{k:"strm",l:"streaming",s:5,d:12},
      {k:"apps",l:"apps/subs",s:5,d:6},{k:"clud",l:"cloud",s:5,d:4}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:10},{k:"vis_",l:"vision",s:10,d:5},{k:"rx__",l:"pharmacy",s:10,d:5},
      {k:"supp",l:"supplements",s:10,d:8},{k:"priv",l:"private doctor",s:10,d:10}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"prepaid health",s:10,d:45}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:12},{k:"holi",l:"holidays",s:25,d:25},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:35},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:25}]},
  ]
},

montevideo:{
  name:"Montevideo, Uruguay",sym:"$",
  taxLabel:"Uruguayan IRPF + Social (in CAD)",
  taxNote:"DGI 2025 rates (1 UYU = 0.032 CAD)",
  taxFn(G){
    const brk=[[23040,0],[11520,.10],[17280,.15],[1e9,.24]];
    const pit=bTx(G,brk);const ss=G*0.1875;
    return{components:[
      {name:"IRPF",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"0/10/15/24% progressive"},
      {name:"Social (BPS)",color:CC1,amount:ss,formula:"18.75% employee share"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:850},{k:"elec",l:"electric",s:10,d:75},{k:"gas_",l:"gas",s:10,d:30},
      {k:"watr",l:"water",s:10,d:20},{k:"inet",l:"internet",s:10,d:35},{k:"cond",l:"gastos comunes",s:10,d:60}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:380},{k:"dine",l:"dining out",s:25,d:175},{k:"deli",l:"takeout",s:25,d:75},
      {k:"coff",l:"coffee",s:10,d:42},{k:"snck",l:"snacks",s:10,d:22},{k:"alc_",l:"alcohol",s:10,d:35}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1600},{k:"chrg",l:"charging",s:10,d:25},{k:"cIns",l:"auto ins",s:25,d:60},
      {k:"mnt_",l:"maint",s:25,d:22},{k:"tire",l:"tires",s:10,d:15},{k:"cWsh",l:"car wash",s:5,d:6},
      {k:"park",l:"parking",s:25,d:22},{k:"reg_",l:"registration",s:5,d:8},{k:"toll",l:"tolls",s:10,d:12}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:15},{k:"papr",l:"supplies",s:5,d:8},{k:"kitc",l:"kitchen",s:5,d:8},
      {k:"toil",l:"toiletries",s:10,d:22}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:22},{k:"skin",l:"skincare",s:10,d:20},
      {k:"cosm",l:"cosmetics",s:10,d:12},{k:"gym_",l:"gym",s:10,d:42}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:55},{k:"shoe",l:"shoes",s:10,d:20},{k:"work",l:"work attire",s:10,d:12}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:35},{k:"movi",l:"movies",s:10,d:10},
      {k:"hobb",l:"hobbies",s:10,d:25},{k:"dOut",l:"social",s:10,d:35}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:35},{k:"vet_",l:"vet",s:10,d:20},
      {k:"grmg",l:"grooming",s:10,d:12},{k:"pSup",l:"supplies",s:5,d:8}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:22},{k:"strm",l:"streaming",s:5,d:18},
      {k:"apps",l:"apps/subs",s:5,d:10},{k:"clud",l:"cloud",s:5,d:6}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:18},{k:"vis_",l:"vision",s:10,d:8},{k:"rx__",l:"pharmacy",s:10,d:8},
      {k:"supp",l:"supplements",s:10,d:12},{k:"priv",l:"private doctor",s:10,d:15}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"mutualista",s:10,d:30}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:18},{k:"holi",l:"holidays",s:25,d:35},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:45},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:35}]},
  ]
},

/* ── Asia / Middle East / Africa ── */
kualalumpur:{
  name:"Kuala Lumpur, Malaysia",sym:"$",
  taxLabel:"Malaysian Tax + EPF (in CAD)",
  taxNote:"LHDN 2025 rates (1 MYR = 0.30 CAD)",
  taxFn(G){
    const brk=[[7500,0],[7500,.01],[7500,.03],[15000,.06],[15000,.11],[15000,.19],[30000,.25],[30000,.26],[60000,.28],[1e9,.30]];
    const pit=bTx(G,brk);const epf=G*0.11;const socso=Math.min(G,14760)*0.005;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"0-30% progressive brackets"},
      {name:"EPF",color:CC1,amount:epf,formula:"11% x G"},
      {name:"SOCSO",color:CC2,amount:socso,formula:"0.5% x min(G, $14,760)"},
    ],total:pit+epf+socso};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:750},{k:"elec",l:"electric",s:10,d:50},{k:"gas_",l:"gas",s:5,d:10},
      {k:"watr",l:"water",s:10,d:10},{k:"inet",l:"internet",s:10,d:30},{k:"cond",l:"building fees",s:10,d:35}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:250},{k:"dine",l:"dining out",s:25,d:130},{k:"deli",l:"takeout",s:25,d:60},
      {k:"coff",l:"coffee",s:10,d:35},{k:"snck",l:"snacks",s:10,d:18},{k:"alc_",l:"alcohol",s:10,d:30}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1050},{k:"chrg",l:"charging",s:10,d:22},{k:"cIns",l:"auto ins",s:25,d:50},
      {k:"mnt_",l:"maint",s:25,d:18},{k:"tire",l:"tires",s:10,d:12},{k:"cWsh",l:"car wash",s:5,d:5},
      {k:"park",l:"parking",s:25,d:15},{k:"reg_",l:"registration",s:5,d:5},{k:"toll",l:"tolls",s:10,d:12}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:10},{k:"papr",l:"supplies",s:5,d:5},{k:"kitc",l:"kitchen",s:5,d:5},
      {k:"toil",l:"toiletries",s:10,d:15}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:12},{k:"skin",l:"skincare",s:10,d:12},
      {k:"cosm",l:"cosmetics",s:10,d:8},{k:"gym_",l:"gym",s:10,d:35}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:40},{k:"shoe",l:"shoes",s:10,d:15},{k:"work",l:"work attire",s:10,d:10}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:25},{k:"movi",l:"movies",s:10,d:6},
      {k:"hobb",l:"hobbies",s:10,d:18},{k:"dOut",l:"social",s:10,d:28}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:25},{k:"vet_",l:"vet",s:10,d:12},
      {k:"grmg",l:"grooming",s:10,d:10},{k:"pSup",l:"supplies",s:5,d:5}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:15},{k:"strm",l:"streaming",s:5,d:15},
      {k:"apps",l:"apps/subs",s:5,d:8},{k:"clud",l:"cloud",s:5,d:5}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:10},{k:"vis_",l:"vision",s:10,d:5},{k:"rx__",l:"pharmacy",s:10,d:5},
      {k:"supp",l:"supplements",s:10,d:8},{k:"priv",l:"private doctor",s:10,d:10}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:35}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:12},{k:"holi",l:"holidays",s:25,d:25},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:40},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:28}]},
  ]
},

bali:{
  name:"Bali, Indonesia",sym:"$",
  taxLabel:"Indonesian PPh + Social (in CAD)",
  taxNote:"DJP 2025 rates (1 IDR = 0.000085 CAD)",
  taxFn(G){
    const brk=[[5100,.05],[20400,.15],[29495,.25],[84916,.30],[1e9,.35]];
    const pit=bTx(G,brk);const ss=G*0.03;
    return{components:[
      {name:"PPh 21",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"5-35% progressive brackets"},
      {name:"BPJS/Social",color:CC1,amount:ss,formula:"~3% employee social"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:680},{k:"elec",l:"electric",s:10,d:35},{k:"gas_",l:"gas",s:5,d:8},
      {k:"watr",l:"water",s:10,d:8},{k:"inet",l:"internet",s:10,d:22},{k:"cond",l:"staff/gardener",s:10,d:40}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:200},{k:"dine",l:"dining out",s:25,d:100},{k:"deli",l:"takeout",s:25,d:42},
      {k:"coff",l:"coffee",s:10,d:28},{k:"snck",l:"snacks",s:10,d:12},{k:"alc_",l:"alcohol",s:10,d:25}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1500},{k:"chrg",l:"charging",s:10,d:18},{k:"cIns",l:"auto ins",s:25,d:35},
      {k:"mnt_",l:"maint",s:25,d:15},{k:"tire",l:"tires",s:10,d:10},{k:"cWsh",l:"car wash",s:5,d:4},
      {k:"park",l:"parking",s:25,d:8},{k:"reg_",l:"registration",s:5,d:5},{k:"toll",l:"tolls",s:10,d:5}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:8},{k:"papr",l:"supplies",s:5,d:4},{k:"kitc",l:"kitchen",s:5,d:4},
      {k:"toil",l:"toiletries",s:10,d:12}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:8},{k:"skin",l:"skincare",s:10,d:10},
      {k:"cosm",l:"cosmetics",s:10,d:6},{k:"gym_",l:"gym",s:10,d:30}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:30},{k:"shoe",l:"shoes",s:10,d:10},{k:"work",l:"work attire",s:10,d:8}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:20},{k:"movi",l:"movies",s:10,d:5},
      {k:"hobb",l:"hobbies",s:10,d:15},{k:"dOut",l:"social",s:10,d:22}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:20},{k:"vet_",l:"vet",s:10,d:10},
      {k:"grmg",l:"grooming",s:10,d:6},{k:"pSup",l:"supplies",s:5,d:4}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:10},{k:"strm",l:"streaming",s:5,d:12},
      {k:"apps",l:"apps/subs",s:5,d:6},{k:"clud",l:"cloud",s:5,d:4}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:8},{k:"vis_",l:"vision",s:10,d:4},{k:"rx__",l:"pharmacy",s:10,d:4},
      {k:"supp",l:"supplements",s:10,d:6},{k:"priv",l:"private doctor",s:10,d:8}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:30}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:10},{k:"holi",l:"holidays",s:25,d:20},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:35},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:25}]},
  ]
},

hochiminh:{
  name:"Ho Chi Minh City, VN",sym:"$",
  taxLabel:"Vietnamese PIT + Social (in CAD)",
  taxNote:"Vietnam 2025 rates (1 VND = 0.000054 CAD)",
  taxFn(G){
    const brk=[[3240,.05],[3240,.10],[5400,.15],[8640,.20],[8640,.25],[11880,.30],[1e9,.35]];
    const pit=bTx(G,brk);const ss=G*0.105;
    return{components:[
      {name:"PIT",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"5-35% progressive brackets"},
      {name:"Social/Health/UE",color:CC1,amount:ss,formula:"10.5% x G"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:600},{k:"elec",l:"electric",s:10,d:30},{k:"gas_",l:"gas",s:5,d:6},
      {k:"watr",l:"water",s:10,d:5},{k:"inet",l:"internet",s:10,d:15},{k:"cond",l:"building fees",s:10,d:30}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:180},{k:"dine",l:"dining out",s:25,d:85},{k:"deli",l:"takeout",s:25,d:35},
      {k:"coff",l:"coffee",s:10,d:22},{k:"snck",l:"snacks",s:10,d:10},{k:"alc_",l:"alcohol",s:10,d:18}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1800},{k:"chrg",l:"charging",s:10,d:15},{k:"cIns",l:"auto ins",s:25,d:30},
      {k:"mnt_",l:"maint",s:25,d:12},{k:"tire",l:"tires",s:10,d:8},{k:"cWsh",l:"car wash",s:5,d:3},
      {k:"park",l:"parking",s:25,d:10},{k:"reg_",l:"registration",s:5,d:4},{k:"toll",l:"tolls",s:10,d:5}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:6},{k:"papr",l:"supplies",s:5,d:3},{k:"kitc",l:"kitchen",s:5,d:3},
      {k:"toil",l:"toiletries",s:10,d:10}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:6},{k:"skin",l:"skincare",s:10,d:8},
      {k:"cosm",l:"cosmetics",s:10,d:5},{k:"gym_",l:"gym",s:10,d:25}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:25},{k:"shoe",l:"shoes",s:10,d:8},{k:"work",l:"work attire",s:10,d:6}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:15},{k:"movi",l:"movies",s:10,d:4},
      {k:"hobb",l:"hobbies",s:10,d:10},{k:"dOut",l:"social",s:10,d:18}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:15},{k:"vet_",l:"vet",s:10,d:8},
      {k:"grmg",l:"grooming",s:10,d:5},{k:"pSup",l:"supplies",s:5,d:3}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:8},{k:"strm",l:"streaming",s:5,d:10},
      {k:"apps",l:"apps/subs",s:5,d:5},{k:"clud",l:"cloud",s:5,d:3}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:6},{k:"vis_",l:"vision",s:10,d:3},{k:"rx__",l:"pharmacy",s:10,d:3},
      {k:"supp",l:"supplements",s:10,d:5},{k:"priv",l:"private doctor",s:10,d:6}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:25}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:8},{k:"holi",l:"holidays",s:25,d:15},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:30},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:20}]},
  ]
},

chiangmai:{
  name:"Chiang Mai, Thailand",sym:"$",
  taxLabel:"Thai Income Tax (in CAD)",
  taxNote:"Thai Revenue 2025 rates (1 THB = 0.038 CAD)",
  taxFn(G){
    const ex=5700;const brk=[[5700,0],[11400,.05],[11400,.10],[15200,.15],[26600,.20],[19000,.25],[1e9,.30]];
    const pit=bTx(Math.max(0,G-ex),brk);
    return{components:[
      {name:"PIT",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(Math.max(0,G-ex),brk),formula:"0-30% progressive (- $5,700 exempt)"},
    ],total:pit};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:500},{k:"elec",l:"electric",s:10,d:45},{k:"gas_",l:"gas",s:5,d:8},
      {k:"watr",l:"water",s:10,d:6},{k:"inet",l:"internet",s:10,d:22},{k:"cond",l:"building fees",s:10,d:15}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:160},{k:"dine",l:"dining out",s:25,d:85},{k:"deli",l:"takeout",s:25,d:38},
      {k:"coff",l:"coffee",s:10,d:25},{k:"snck",l:"snacks",s:10,d:10},{k:"alc_",l:"alcohol",s:10,d:20}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:850},{k:"chrg",l:"charging",s:10,d:18},{k:"cIns",l:"auto ins",s:25,d:38},
      {k:"mnt_",l:"maint",s:25,d:12},{k:"tire",l:"tires",s:10,d:8},{k:"cWsh",l:"car wash",s:5,d:3},
      {k:"park",l:"parking",s:25,d:8},{k:"reg_",l:"registration",s:5,d:4},{k:"toll",l:"tolls",s:10,d:5}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:6},{k:"papr",l:"supplies",s:5,d:3},{k:"kitc",l:"kitchen",s:5,d:3},
      {k:"toil",l:"toiletries",s:10,d:10}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:6},{k:"skin",l:"skincare",s:10,d:8},
      {k:"cosm",l:"cosmetics",s:10,d:5},{k:"gym_",l:"gym",s:10,d:25}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:22},{k:"shoe",l:"shoes",s:10,d:8},{k:"work",l:"work attire",s:10,d:5}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:15},{k:"movi",l:"movies",s:10,d:5},
      {k:"hobb",l:"hobbies",s:10,d:12},{k:"dOut",l:"social",s:10,d:18}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:15},{k:"vet_",l:"vet",s:10,d:10},
      {k:"grmg",l:"grooming",s:10,d:5},{k:"pSup",l:"supplies",s:5,d:3}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:10},{k:"strm",l:"streaming",s:5,d:12},
      {k:"apps",l:"apps/subs",s:5,d:5},{k:"clud",l:"cloud",s:5,d:3}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:8},{k:"vis_",l:"vision",s:10,d:4},{k:"rx__",l:"pharmacy",s:10,d:4},
      {k:"supp",l:"supplements",s:10,d:6},{k:"priv",l:"private doctor",s:10,d:8}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:28}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:8},{k:"holi",l:"holidays",s:25,d:18},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:30},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:22}]},
  ]
},

dubai:{
  name:"Dubai, UAE",sym:"$",
  taxLabel:"No Income Tax (in CAD)",
  taxNote:"UAE has 0% personal income tax (1 AED = 0.37 CAD)",
  taxFn(G){
    return{components:[
      {name:"Income Tax",color:CC3,amount:0,formula:"0% - no personal income tax"},
    ],total:0};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:100,d:2700},{k:"elec",l:"DEWA electric",s:10,d:150},{k:"gas_",l:"gas",s:5,d:15},
      {k:"watr",l:"DEWA water",s:10,d:35},{k:"inet",l:"internet",s:10,d:75},{k:"cond",l:"service charge",s:10,d:120}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:550},{k:"dine",l:"dining out",s:25,d:350},{k:"deli",l:"takeout",s:25,d:150},
      {k:"coff",l:"coffee",s:10,d:75},{k:"snck",l:"snacks",s:10,d:35},{k:"alc_",l:"alcohol",s:10,d:80}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1100},{k:"chrg",l:"charging",s:10,d:40},{k:"cIns",l:"auto ins",s:25,d:110},
      {k:"mnt_",l:"maint",s:25,d:45},{k:"tire",l:"tires",s:10,d:28},{k:"cWsh",l:"car wash",s:5,d:15},
      {k:"park",l:"parking",s:25,d:40},{k:"reg_",l:"registration",s:5,d:25},{k:"toll",l:"salik/tolls",s:10,d:55}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:35},{k:"papr",l:"supplies",s:5,d:15},{k:"kitc",l:"kitchen",s:5,d:15},
      {k:"toil",l:"toiletries",s:10,d:38}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:50},{k:"skin",l:"skincare",s:10,d:45},
      {k:"cosm",l:"cosmetics",s:10,d:30},{k:"gym_",l:"gym",s:10,d:85}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:100},{k:"shoe",l:"shoes",s:10,d:35},{k:"work",l:"work attire",s:10,d:25}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:25,d:120},{k:"movi",l:"movies",s:10,d:22},
      {k:"hobb",l:"hobbies",s:10,d:60},{k:"dOut",l:"social",s:10,d:80}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:65},{k:"vet_",l:"vet",s:10,d:55},
      {k:"grmg",l:"grooming",s:10,d:45},{k:"pSup",l:"supplies",s:5,d:15}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:55},{k:"strm",l:"streaming",s:5,d:25},
      {k:"apps",l:"apps/subs",s:5,d:15},{k:"clud",l:"cloud",s:5,d:10}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"hins",l:"health ins",s:25,d:250},{k:"dent",l:"dental",s:10,d:45},{k:"vis_",l:"vision",s:10,d:18},
      {k:"rx__",l:"pharmacy",s:10,d:18},{k:"supp",l:"supplements",s:10,d:22}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"lIns",l:"life ins",s:10,d:0}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:40},{k:"holi",l:"holidays",s:25,d:75},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:50,d:150},{k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:75}]},
  ]
},

tbilisi:{
  name:"Tbilisi, Georgia",sym:"$",
  taxLabel:"Georgian Flat Tax + Pension (in CAD)",
  taxNote:"Georgian 2025 rates (1 GEL = 0.51 CAD)",
  taxFn(G){
    const pit=G*0.20;const pension=G*0.02;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,formula:"20% flat x G"},
      {name:"Pension",color:CC1,amount:pension,formula:"2% x G"},
    ],total:pit+pension};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:550},{k:"elec",l:"electric",s:10,d:25},{k:"gas_",l:"gas/heat",s:10,d:18},
      {k:"watr",l:"water",s:10,d:6},{k:"inet",l:"internet",s:10,d:15},{k:"cond",l:"building fees",s:10,d:15}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:200},{k:"dine",l:"dining out",s:25,d:100},{k:"deli",l:"takeout",s:25,d:42},
      {k:"coff",l:"coffee",s:10,d:25},{k:"snck",l:"snacks",s:10,d:10},{k:"alc_",l:"alcohol",s:10,d:22}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:900},{k:"chrg",l:"charging",s:10,d:15},{k:"cIns",l:"auto ins",s:25,d:35},
      {k:"mnt_",l:"maint",s:25,d:12},{k:"tire",l:"tires",s:10,d:8},{k:"cWsh",l:"car wash",s:5,d:3},
      {k:"park",l:"parking",s:25,d:10},{k:"reg_",l:"registration",s:5,d:4},{k:"toll",l:"tolls",s:10,d:5}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:6},{k:"papr",l:"supplies",s:5,d:3},{k:"kitc",l:"kitchen",s:5,d:3},
      {k:"toil",l:"toiletries",s:10,d:10}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:8},{k:"skin",l:"skincare",s:10,d:8},
      {k:"cosm",l:"cosmetics",s:10,d:5},{k:"gym_",l:"gym",s:10,d:22}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:30},{k:"shoe",l:"shoes",s:10,d:10},{k:"work",l:"work attire",s:10,d:8}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:18},{k:"movi",l:"movies",s:10,d:4},
      {k:"hobb",l:"hobbies",s:10,d:12},{k:"dOut",l:"social",s:10,d:18}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:18},{k:"vet_",l:"vet",s:10,d:10},
      {k:"grmg",l:"grooming",s:10,d:5},{k:"pSup",l:"supplies",s:5,d:3}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:8},{k:"strm",l:"streaming",s:5,d:10},
      {k:"apps",l:"apps/subs",s:5,d:5},{k:"clud",l:"cloud",s:5,d:3}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:8},{k:"vis_",l:"vision",s:10,d:4},{k:"rx__",l:"pharmacy",s:10,d:3},
      {k:"supp",l:"supplements",s:10,d:5},{k:"priv",l:"private doctor",s:10,d:8}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:22}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:8},{k:"holi",l:"holidays",s:25,d:18},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:28},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:20}]},
  ]
},

budva:{
  name:"Budva, Montenegro",sym:"$",
  taxLabel:"Montenegrin Tax + Social (in CAD)",
  taxNote:"Montenegro 2025 rates (1 EUR = 1.50 CAD)",
  taxFn(G){
    const brk=[[12600,.09],[1e9,.15]];const pit=bTx(G,brk);
    const ss=G*0.243;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"9% to $12,600, 15% above"},
      {name:"Soc. Contributions",color:CC1,amount:ss,formula:"24.3% employee social"},
    ],total:pit+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:850},{k:"elec",l:"electric",s:10,d:70},{k:"gas_",l:"gas/heat",s:10,d:35},
      {k:"watr",l:"water",s:10,d:15},{k:"inet",l:"internet",s:10,d:30},{k:"cond",l:"building fees",s:10,d:25}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:350},{k:"dine",l:"dining out",s:25,d:165},{k:"deli",l:"takeout",s:25,d:70},
      {k:"coff",l:"coffee",s:10,d:40},{k:"snck",l:"snacks",s:10,d:20},{k:"alc_",l:"alcohol",s:10,d:30}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1100},{k:"chrg",l:"charging",s:10,d:38},{k:"cIns",l:"auto ins",s:25,d:90},
      {k:"mnt_",l:"maint",s:25,d:28},{k:"tire",l:"tires",s:10,d:18},{k:"cWsh",l:"car wash",s:5,d:8},
      {k:"park",l:"parking",s:25,d:15},{k:"reg_",l:"registration",s:5,d:6},{k:"toll",l:"tolls",s:10,d:10}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:15},{k:"papr",l:"supplies",s:5,d:6},{k:"kitc",l:"kitchen",s:5,d:6},
      {k:"toil",l:"toiletries",s:10,d:22}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:18},{k:"skin",l:"skincare",s:10,d:15},
      {k:"cosm",l:"cosmetics",s:10,d:10},{k:"gym_",l:"gym",s:10,d:38}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:50},{k:"shoe",l:"shoes",s:10,d:18},{k:"work",l:"work attire",s:10,d:12}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:32},{k:"movi",l:"movies",s:10,d:8},
      {k:"hobb",l:"hobbies",s:10,d:22},{k:"dOut",l:"social",s:10,d:32}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:35},{k:"vet_",l:"vet",s:10,d:18},
      {k:"grmg",l:"grooming",s:10,d:10},{k:"pSup",l:"supplies",s:5,d:6}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:18},{k:"strm",l:"streaming",s:5,d:18},
      {k:"apps",l:"apps/subs",s:5,d:8},{k:"clud",l:"cloud",s:5,d:5}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:15},{k:"vis_",l:"vision",s:10,d:6},{k:"rx__",l:"pharmacy",s:10,d:6},
      {k:"supp",l:"supplements",s:10,d:10},{k:"priv",l:"private doctor",s:10,d:12}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:35}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:18},{k:"holi",l:"holidays",s:25,d:35},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:42},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:32}]},
  ]
},

singapore:{
  name:"Singapore",sym:"$",
  taxLabel:"Singapore Tax + CPF (in CAD)",
  taxNote:"IRAS 2025 rates (1 SGD = 1.02 CAD)",
  taxFn(G){
    const brk=[[20400,0],[10200,.02],[10200,.035],[10200,.07],[10200,.115],[10200,.15],[10200,.18],[10200,.19],[20400,.195],[20400,.20],[51000,.22],[1e9,.24]];
    const pit=bTx(G,brk);const cpf=Math.min(G,73440)*0.20;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"0-24% progressive brackets"},
      {name:"CPF",color:CC1,amount:cpf,formula:"20% x min(G, $73,440)"},
    ],total:pit+cpf};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:100,d:3200},{k:"elec",l:"electric",s:10,d:100},{k:"gas_",l:"gas",s:5,d:20},
      {k:"watr",l:"water",s:10,d:25},{k:"inet",l:"internet",s:10,d:45},{k:"cond",l:"condo fees",s:10,d:80}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:500},{k:"dine",l:"dining out",s:25,d:280},{k:"deli",l:"takeout",s:25,d:120},
      {k:"coff",l:"coffee",s:10,d:65},{k:"snck",l:"snacks",s:10,d:30},{k:"alc_",l:"alcohol",s:10,d:65}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:2500},{k:"chrg",l:"charging",s:10,d:35},{k:"cIns",l:"auto ins",s:25,d:120},
      {k:"mnt_",l:"maint",s:25,d:50},{k:"tire",l:"tires",s:10,d:28},{k:"cWsh",l:"car wash",s:5,d:15},
      {k:"park",l:"parking",s:25,d:80},{k:"reg_",l:"COE/reg",s:5,d:200},{k:"toll",l:"ERP/tolls",s:10,d:45}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:30},{k:"papr",l:"supplies",s:5,d:12},{k:"kitc",l:"kitchen",s:5,d:12},
      {k:"toil",l:"toiletries",s:10,d:35}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:35},{k:"skin",l:"skincare",s:10,d:35},
      {k:"cosm",l:"cosmetics",s:10,d:22},{k:"gym_",l:"gym",s:10,d:85}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:85},{k:"shoe",l:"shoes",s:10,d:30},{k:"work",l:"work attire",s:10,d:22}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:60},{k:"movi",l:"movies",s:10,d:18},
      {k:"hobb",l:"hobbies",s:10,d:40},{k:"dOut",l:"social",s:10,d:65}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:55},{k:"vet_",l:"vet",s:10,d:50},
      {k:"grmg",l:"grooming",s:10,d:35},{k:"pSup",l:"supplies",s:5,d:12}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:35},{k:"strm",l:"streaming",s:5,d:22},
      {k:"apps",l:"apps/subs",s:5,d:12},{k:"clud",l:"cloud",s:5,d:8}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:35},{k:"vis_",l:"vision",s:10,d:15},{k:"rx__",l:"pharmacy",s:10,d:15},
      {k:"supp",l:"supplements",s:10,d:18},{k:"priv",l:"private doctor",s:10,d:32}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:80}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:35},{k:"holi",l:"holidays",s:25,d:65},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:50,d:120},{k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:60}]},
  ]
},

tokyo:{
  name:"Tokyo, Japan",sym:"$",
  taxLabel:"Japanese Tax + Social (in CAD)",
  taxNote:"NTA 2025 rates (1 JPY = 0.0091 CAD)",
  taxFn(G){
    const brk=[[17836,.05],[17836,.10],[26754,.20],[26754,.23],[36400,.33],[36400,.40],[1e9,.45]];
    const pit=bTx(G,brk);const local=G*0.10;const ss=G*0.15;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"5-45% progressive brackets"},
      {name:"Resident Tax",color:CC4,amount:local,formula:"~10% flat municipal/pref"},
      {name:"Social Ins.",color:CC1,amount:ss,formula:"~15% health+pension+employment"},
    ],total:pit+local+ss};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:100,d:1600},{k:"elec",l:"electric",s:10,d:80},{k:"gas_",l:"gas",s:10,d:40},
      {k:"watr",l:"water",s:10,d:22},{k:"inet",l:"internet",s:10,d:45},{k:"cond",l:"management fee",s:10,d:55}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:450},{k:"dine",l:"dining out",s:25,d:250},{k:"deli",l:"takeout",s:25,d:100},
      {k:"coff",l:"coffee",s:10,d:55},{k:"snck",l:"snacks",s:10,d:25},{k:"alc_",l:"alcohol",s:10,d:45}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1000},{k:"chrg",l:"charging",s:10,d:35},{k:"cIns",l:"auto ins",s:25,d:85},
      {k:"mnt_",l:"maint",s:25,d:35},{k:"tire",l:"tires",s:10,d:22},{k:"cWsh",l:"car wash",s:5,d:10},
      {k:"park",l:"parking",s:25,d:120},{k:"reg_",l:"shaken/reg",s:5,d:30},{k:"toll",l:"tolls",s:10,d:25}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:25},{k:"papr",l:"supplies",s:5,d:10},{k:"kitc",l:"kitchen",s:5,d:10},
      {k:"toil",l:"toiletries",s:10,d:30}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:40},{k:"skin",l:"skincare",s:10,d:35},
      {k:"cosm",l:"cosmetics",s:10,d:20},{k:"gym_",l:"gym",s:10,d:75}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:75},{k:"shoe",l:"shoes",s:10,d:28},{k:"work",l:"work attire",s:10,d:20}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:55},{k:"movi",l:"movies",s:10,d:18},
      {k:"hobb",l:"hobbies",s:10,d:35},{k:"dOut",l:"social",s:10,d:55}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:50},{k:"vet_",l:"vet",s:10,d:45},
      {k:"grmg",l:"grooming",s:10,d:30},{k:"pSup",l:"supplies",s:5,d:10}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:35},{k:"strm",l:"streaming",s:5,d:22},
      {k:"apps",l:"apps/subs",s:5,d:12},{k:"clud",l:"cloud",s:5,d:8}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:25},{k:"vis_",l:"vision",s:10,d:12},{k:"rx__",l:"pharmacy",s:10,d:12},
      {k:"supp",l:"supplements",s:10,d:15},{k:"priv",l:"private doctor",s:10,d:18}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"private health",s:10,d:55}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:30},{k:"holi",l:"holidays",s:25,d:60},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"iDCo",l:"iDeCo",s:50,d:150},{k:"emrg",l:"emerg fund",s:50,d:80},
      {k:"inv_",l:"investing",s:50,d:0},{k:"vacF",l:"vacation",s:25,d:50}]},
  ]
},

capetown:{
  name:"Cape Town, S. Africa",sym:"$",
  taxLabel:"South African Tax + UIF (in CAD)",
  taxNote:"SARS 2025 rates (1 ZAR = 0.074 CAD)",
  taxFn(G){
    const brk=[[17094,.18],[9990,.26],[10360,.31],[11100,.36],[22200,.39],[25900,.41],[1e9,.45]];
    const pit=Math.max(0,bTx(G,brk)-1221);const uif=Math.min(G,12802)*0.01;
    return{components:[
      {name:"Income Tax",color:CC3,amount:pit,brackets:brk,bracketDetail:bDetail(G,brk),formula:"18-45% progressive - $1,221 rebate"},
      {name:"UIF",color:CC1,amount:uif,formula:"1% x min(G, $12,802)"},
    ],total:pit+uif};
  },
  cats:[
    {key:"Housing",color:"#2a9d8f",items:[
      {k:"rent",l:"rent",s:50,d:850},{k:"elec",l:"electric",s:10,d:65},{k:"gas_",l:"gas",s:5,d:15},
      {k:"watr",l:"water",s:10,d:18},{k:"inet",l:"internet",s:10,d:35},{k:"cond",l:"levies/rates",s:10,d:45}]},
    {key:"Food",color:"#457bb5",items:[
      {k:"groc",l:"groceries",s:50,d:280},{k:"dine",l:"dining out",s:25,d:130},{k:"deli",l:"takeout",s:25,d:55},
      {k:"coff",l:"coffee",s:10,d:30},{k:"snck",l:"snacks",s:10,d:15},{k:"alc_",l:"alcohol",s:10,d:28}]},
    {key:"Transport",color:"#8b5fb0",items:[
      {k:"carP",l:"car pmt",s:50,d:1100},{k:"chrg",l:"charging",s:10,d:22},{k:"cIns",l:"auto ins",s:25,d:60},
      {k:"mnt_",l:"maint",s:25,d:22},{k:"tire",l:"tires",s:10,d:12},{k:"cWsh",l:"car wash",s:5,d:5},
      {k:"park",l:"parking",s:25,d:12},{k:"reg_",l:"registration",s:5,d:5},{k:"toll",l:"e-toll",s:10,d:8}]},
    {key:"Household",color:"#7a8e5a",items:[
      {k:"clea",l:"cleaning",s:10,d:12},{k:"papr",l:"supplies",s:5,d:5},{k:"kitc",l:"kitchen",s:5,d:5},
      {k:"toil",l:"toiletries",s:10,d:15}]},
    {key:"Personal",color:"#3a9e6e",items:[
      {k:"hair",l:"haircuts",s:10,d:15},{k:"skin",l:"skincare",s:10,d:12},
      {k:"cosm",l:"cosmetics",s:10,d:8},{k:"gym_",l:"gym",s:10,d:35}]},
    {key:"Clothing",color:"#6a8ab5",items:[
      {k:"clth",l:"clothes",s:25,d:40},{k:"shoe",l:"shoes",s:10,d:15},{k:"work",l:"work attire",s:10,d:10}]},
    {key:"Entertain",color:"#9a7ab0",items:[
      {k:"entr",l:"events",s:10,d:28},{k:"movi",l:"movies",s:10,d:6},
      {k:"hobb",l:"hobbies",s:10,d:18},{k:"dOut",l:"social",s:10,d:28}]},
    {key:"Pet",color:"#d4845a",items:[
      {k:"pFoo",l:"food/treats",s:10,d:25},{k:"vet_",l:"vet",s:10,d:15},
      {k:"grmg",l:"grooming",s:10,d:8},{k:"pSup",l:"supplies",s:5,d:5}]},
    {key:"Bills",color:"#5b9ec9",items:[
      {k:"ph_2",l:"phone",s:10,d:15},{k:"strm",l:"streaming",s:5,d:12},
      {k:"apps",l:"apps/subs",s:5,d:6},{k:"clud",l:"cloud",s:5,d:4}]},
    {key:"Medical",color:"#c95858",items:[
      {k:"dent",l:"dental",s:10,d:12},{k:"vis_",l:"vision",s:10,d:5},{k:"rx__",l:"pharmacy",s:10,d:5},
      {k:"supp",l:"supplements",s:10,d:8},{k:"priv",l:"private doctor",s:10,d:10}]},
    {key:"Insurance",color:"#8a7a5a",items:[{k:"pIns",l:"medical aid",s:10,d:55}]},
    {key:"Gifts",color:"#b07a8a",items:[
      {k:"bday",l:"birthdays",s:10,d:12},{k:"holi",l:"holidays",s:25,d:25},{k:"char",l:"donations",s:10,d:0}]},
    {key:"Savings",color:"#c47a3a",items:[
      {k:"emrg",l:"emerg fund",s:25,d:38},{k:"inv_",l:"investing",s:25,d:0},{k:"vacF",l:"vacation",s:25,d:25}]},
  ]
},

};

function mkInit(cats){const o={};cats.forEach(c=>c.items.forEach(i=>{o[i.k]=i.d}));return o}

/* ── Dashboard: compute all countries at defaults ── */
function computeAllCountries(useFam){
  return Object.entries(COUNTRIES).map(([k,c])=>{
    let allCats=c.cats;
    if(useFam){allCats=allCats.map(cat=>{const extra=FAM[cat.key];return extra?{...cat,items:[...cat.items,...extra]}:cat})}
    const init=useFam?{...mkInit(c.cats),...mkFamInit()}:mkInit(c.cats);
    const catTots={};
    allCats.forEach(cat=>{catTots[cat.key]=cat.items.reduce((a,i)=>a+(init[i.k]||0),0)*12});
    const Ev=Object.values(catTots).reduce((a,b)=>a+b,0);
    const Gv=solveGross(Ev,G=>c.taxFn(G));
    const tax=c.taxFn(Gv);
    const tEff=Gv>0?tax.total/Gv*100:0;
    return{key:k,name:c.name,gross:Gv,expenses:Ev,tax:tax.total,tEff,catTots};
  }).sort((a,b)=>a.gross-b.gross);
}

/* ── Family-mode extra items (wife + 2 kids) ── */
const FAM={
  Housing:[
    {k:"fRnt",l:"bigger unit +",s:100,d:500}],
  Food:[
    {k:"fGrc",l:"family groc +",s:50,d:500},{k:"fSnk",l:"kids snacks",s:25,d:60},
    {k:"fLun",l:"school lunch",s:25,d:120}],
  Transport:[
    {k:"fCar",l:"wife car pmt",s:50,d:600},{k:"fFul",l:"wife charging",s:25,d:80},
    {k:"fIns",l:"wife auto ins",s:25,d:200},{k:"fMnt",l:"wife maint",s:10,d:40}],
  Household:[
    {k:"fLdy",l:"extra laundry",s:10,d:20},{k:"fSup",l:"kids supplies",s:10,d:25}],
  Personal:[
    {k:"fHai",l:"wife haircuts",s:10,d:60},{k:"fSki",l:"wife skincare",s:10,d:40},
    {k:"fCos",l:"wife cosmetics",s:10,d:30},{k:"fGym",l:"wife gym",s:10,d:75}],
  Clothing:[
    {k:"fWCl",l:"wife clothes",s:25,d:80},{k:"fWSh",l:"wife shoes",s:10,d:25},
    {k:"fKCl",l:"kids clothes",s:25,d:80},{k:"fKSh",l:"kids shoes",s:10,d:40}],
  Entertain:[
    {k:"fKAc",l:"kids activities",s:25,d:150},{k:"fKSp",l:"kids sports",s:25,d:120},
    {k:"fKBd",l:"kids birthday",s:10,d:30},{k:"fFam",l:"family outings",s:25,d:120}],
  Bills:[
    {k:"fPhn",l:"wife phone",s:10,d:60},{k:"fKTb",l:"kids tablet/app",s:5,d:15},
    {k:"fBAS",l:"b/a school care",s:100,d:1000}],
  Medical:[
    {k:"fKDr",l:"kids doctor",s:10,d:25},{k:"fKDn",l:"kids dental",s:10,d:25},
    {k:"fKRx",l:"kids pharmacy",s:10,d:15}],
  Gifts:[
    {k:"fKGf",l:"kids gifts",s:10,d:30}],
  Savings:[
    {k:"fRES",l:"kids RESP/edu",s:50,d:200}],
};
function mkFamInit(){const o={};Object.values(FAM).forEach(arr=>arr.forEach(i=>{o[i.k]=i.d}));return o}
function mkFamZero(){const o={};Object.values(FAM).forEach(arr=>arr.forEach(i=>{o[i.k]=0}));return o}

/* ── Atoms ── */
function Pill({name,id,color}){
  return <span data-var={id} style={{...st.pill,borderColor:color,color}}>{name}</span>;
}
function Num({value,onChange,step=50,min=0,max=9999999,pre="$"}){
  return(<span style={st.stepper}>
    <button style={st.sBtn} onClick={()=>onChange(Math.min(max,value+step))}>
      <svg width="10" height="4" viewBox="0 0 10 4"><path d="M1.5 3.5L5 .5L8.5 3.5" stroke="#b5ad9e" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>
    </button>
    <span style={st.sVal}>{pre}{value.toLocaleString()}</span>
    <button style={st.sBtn} onClick={()=>onChange(Math.max(min,value-step))}>
      <svg width="10" height="4" viewBox="0 0 10 4"><path d="M1.5.5L5 3.5L8.5.5" stroke="#b5ad9e" strokeWidth="1.3" fill="none" strokeLinecap="round"/></svg>
    </button>
  </span>);
}
const Op=({c})=><span style={st.op}>{c}</span>;

export default function App(){
  const[ckey,setCkey]=useState("gta");
  const[fam,setFam]=useState(false);
  const[dash,setDash]=useState(false);
  const country=COUNTRIES[ckey];
  const baseCats=country.cats;
  const cats=fam?baseCats.map(c=>{
    const extra=FAM[c.key];
    return extra?{...c,items:[...c.items,...extra]}:c;
  }):baseCats;
  const[s,setS]=useState(()=>mkInit(baseCats));
  const up=(k,v)=>setS(p=>({...p,[k]:v}));
  const switchCountry=(k)=>{setCkey(k);const base=mkInit(COUNTRIES[k].cats);setS(p=>{const o={...base};if(fam){const fi=mkFamInit();Object.assign(o,fi)}return o})};
  const toggleFam=()=>{setFam(f=>{const next=!f;setS(p=>{const o={...p};if(next){const fi=mkFamInit();Object.keys(fi).forEach(k=>{if(!(k in o)||o[k]===0)o[k]=fi[k]});} else {const fz=mkFamZero();Object.assign(o,fz);}return o});return next})};

  const tots={};
  cats.forEach(c=>{tots[c.key]=c.items.reduce((a,i)=>a+(s[i.k]||0),0)*12});
  const Ev=Object.values(tots).reduce((a,b)=>a+b,0);
  const Gv=solveGross(Ev,G=>country.taxFn(G));
  const tax=country.taxFn(Gv);
  const tEff=Gv>0?(tax.total/Gv*100):0;
  const fmt=v=>"$"+Math.round(v).toLocaleString();

  const conns=[
    {from:"g-exp",to:"eq2-Expenses",color:EC},
    {from:"g-tax",to:"tax-Tax",color:TC},
    ...tax.components.map((c,i)=>({from:"tx-"+i,to:"def-"+i,color:c.color})),
    ...cats.map(c=>({from:"eq2-"+c.key,to:"d-"+c.key,color:c.color})),
  ].map(c=>({...c,id:c.from+"->"+c.to}));

  // Manual arrow tweaks: { [connId]: {dx, dy} } — midpoint offset in px.
  const[offsets,setOffsets]=useState({});
  const offsetsRef=useRef(offsets);
  useEffect(()=>{offsetsRef.current=offsets},[offsets]);

  // Load saved offsets from Supabase once.
  useEffect(()=>{
    if(!supabase)return;
    let cancelled=false;
    (async()=>{
      const{data,error}=await supabase.from(ARROW_TABLE).select("conn_id,dx,dy");
      if(cancelled)return;
      if(error){console.warn("[supabase] load offsets failed",error);return}
      const m={};(data||[]).forEach(r=>{m[r.conn_id]={dx:r.dx||0,dy:r.dy||0}});
      setOffsets(m);
    })();
    return()=>{cancelled=true};
  },[]);

  const saveOffset=async(connId,dx,dy)=>{
    if(!supabase)return;
    const{error}=await supabase.from(ARROW_TABLE).upsert(
      {conn_id:connId,dx,dy,updated_at:new Date().toISOString()},
      {onConflict:"conn_id"}
    );
    if(error)console.warn("[supabase] save offset failed",error);
  };

  const cRef=useRef(null),svgRef=useRef(null);
  useEffect(()=>{
    const draw=()=>{
      const cont=cRef.current,svg=svgRef.current;
      if(!cont||!svg)return;
      svg.setAttribute("width",cont.scrollWidth);svg.setAttribute("height",cont.scrollHeight);
      while(svg.firstChild)svg.removeChild(svg.firstChild);
      const cr=cont.getBoundingClientRect();
      const pos=id=>{const el=cont.querySelector('[data-var="'+id+'"]');if(!el)return null;const r=el.getBoundingClientRect();return{cx:r.left-cr.left+r.width/2,top:r.top-cr.top,bot:r.bottom-cr.top}};
      const NS="http://www.w3.org/2000/svg";
      conns.forEach(conn=>{
        const sP=pos(conn.from),tP=pos(conn.to);if(!sP||!tP)return;
        const x1=sP.cx,y1=sP.bot+1,x2=tP.cx,y2=tP.top-1,dy=y2-y1;if(dy<6)return;
        const cp=Math.min(Math.max(18,dy*0.4),120);
        const off=offsetsRef.current[conn.id]||{dx:0,dy:0};
        // Shift both control points so the curve midpoint moves by (off.dx, off.dy).
        // For cubic with P0=(x1,y1), P1=(x1,y1+cp), P2=(x2,y2-cp), P3=(x2,y2),
        // mid B(0.5) shifts by (3/4)*controlShift, so controlShift = (4/3)*offset.
        const ax=off.dx*4/3, ay=off.dy*4/3;
        const c1x=x1+ax, c1y=y1+cp+ay, c2x=x2+ax, c2y=y2-cp+ay;
        const path=document.createElementNS(NS,"path");
        path.setAttribute("d","M"+x1+","+y1+" C"+c1x+","+c1y+" "+c2x+","+c2y+" "+x2+","+y2);
        path.setAttribute("stroke",conn.color);path.setAttribute("stroke-width","1.5");
        path.setAttribute("fill","none");path.setAttribute("opacity","0.38");
        path.style.pointerEvents="none";
        svg.appendChild(path);
        const a=4.5;const tri=document.createElementNS(NS,"polygon");
        tri.setAttribute("points",x2+","+y2+" "+(x2-a)+","+(y2-a*1.7)+" "+(x2+a)+","+(y2-a*1.7));
        tri.setAttribute("fill",conn.color);tri.setAttribute("opacity","0.45");
        tri.style.pointerEvents="none";
        svg.appendChild(tri);

        // Draggable midpoint handle.
        const mx=(x1+x2)/2+off.dx, my=(y1+y2)/2+off.dy;
        const hit=document.createElementNS(NS,"circle");
        hit.setAttribute("cx",mx);hit.setAttribute("cy",my);hit.setAttribute("r","14");
        hit.setAttribute("fill","transparent");
        hit.style.cursor="grab";hit.style.pointerEvents="all";hit.style.touchAction="none";
        const dot=document.createElementNS(NS,"circle");
        dot.setAttribute("cx",mx);dot.setAttribute("cy",my);dot.setAttribute("r","4");
        dot.setAttribute("fill",conn.color);
        dot.setAttribute("opacity","0.35");
        dot.setAttribute("stroke","#fff");dot.setAttribute("stroke-width","1");
        dot.style.pointerEvents="none";
        const onDown=(e)=>{
          e.preventDefault();e.stopPropagation();
          hit.setPointerCapture&&hit.setPointerCapture(e.pointerId);
          const sx=e.clientX,sy=e.clientY;
          const start=offsetsRef.current[conn.id]||{dx:0,dy:0};
          dot.setAttribute("opacity","0.9");hit.style.cursor="grabbing";
          const onMove=(ev)=>{
            const ndx=start.dx+(ev.clientX-sx);
            const ndy=start.dy+(ev.clientY-sy);
            setOffsets(p=>({...p,[conn.id]:{dx:ndx,dy:ndy}}));
          };
          const onUp=(ev)=>{
            window.removeEventListener("pointermove",onMove);
            window.removeEventListener("pointerup",onUp);
            window.removeEventListener("pointercancel",onUp);
            const final=offsetsRef.current[conn.id]||{dx:0,dy:0};
            saveOffset(conn.id,final.dx,final.dy);
          };
          window.addEventListener("pointermove",onMove);
          window.addEventListener("pointerup",onUp);
          window.addEventListener("pointercancel",onUp);
        };
        hit.addEventListener("pointerdown",onDown);
        // Double-click to reset this arrow.
        hit.addEventListener("dblclick",(e)=>{
          e.preventDefault();e.stopPropagation();
          setOffsets(p=>{const n={...p};delete n[conn.id];return n});
          saveOffset(conn.id,0,0);
        });
        svg.appendChild(hit);
        svg.appendChild(dot);
      });
    };
    const raf=()=>requestAnimationFrame(draw);
    const timer=setTimeout(raf,120);
    window.addEventListener("resize",raf);
    return()=>{clearTimeout(timer);window.removeEventListener("resize",raf)};
  });

  if(dash){
    const allData=computeAllCountries(fam);
    const maxG=Math.max(...allData.map(d=>d.gross));
    const catKeys=[...new Set(allData.flatMap(d=>Object.keys(d.catTots)))];
    const catColors={Housing:"#2a9d8f",Food:"#457bb5",Transport:"#8b5fb0",Household:"#7a8e5a",Personal:"#3a9e6e",Clothing:"#6a8ab5",Entertain:"#9a7ab0",Pet:"#d4845a",Bills:"#5b9ec9",Medical:"#c95858",Insurance:"#8a7a5a",Gifts:"#b07a8a",Savings:"#c47a3a"};
    return(
    <div style={{...st.pg,padding:0}}>
      <style>{"\
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@400;500;600&display=swap');\
        *{box-sizing:border-box;margin:0;padding:0}body{background:#f6f4f0}\
        button{background:none;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent}\
      "}</style>
      <div style={{textAlign:"center",padding:"16px 16px 12px",background:"#1c1c1c",borderBottom:"2px solid #333",position:"sticky",top:0,zIndex:30}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",maxWidth:900,margin:"0 auto"}}>
          <button onClick={()=>setDash(false)} style={{color:"#888",fontSize:12,fontFamily:"'DM Sans',sans-serif",padding:"6px 14px",borderRadius:8,border:"1px solid #444",background:"#2a2a2a"}}>
            &larr; Back
          </button>
          <div>
            <div style={{fontSize:10,letterSpacing:"0.14em",color:"#666",fontWeight:500,fontFamily:"'DM Sans',sans-serif"}}>COMPARISON DASHBOARD</div>
            <div style={{fontSize:16,color:"#e8e4dd",fontFamily:"'Source Serif 4',Georgia,serif",fontWeight:300}}>{allData.length} Regions{fam?" - Family of 4":""}</div>
          </div>
          <button onClick={toggleFam} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,border:"1.5px solid "+(fam?"#7a9a6a":"#555"),background:fam?"#2a3a2a":"#2a2a2a",fontSize:11,fontWeight:600,fontFamily:"'DM Sans',sans-serif",color:fam?"#9aba8a":"#777",cursor:"pointer"}}>
            <span style={{width:28,height:16,borderRadius:8,background:fam?"#7a9a6a":"#555",position:"relative"}}>
              <span style={{position:"absolute",top:2,left:fam?14:2,width:12,height:12,borderRadius:6,background:fam?"#fff":"#999",transition:"left 0.2s"}}/>
            </span>
            Family
          </button>
        </div>
      </div>

      <div style={{padding:"16px 12px",maxWidth:900,margin:"0 auto"}}>
        {/* Gross income ranking */}
        <div style={{background:"#fff",borderRadius:12,padding:"16px 14px",marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#c0b8a8",marginBottom:10}}>Required Gross Income (CAD/yr) - sorted lowest to highest</div>
          {allData.map((d,i)=>{
            const pct=maxG>0?d.gross/maxG*100:0;
            const isLowest=i===0;
            return(
            <div key={d.key} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <div style={{width:120,fontSize:11,fontWeight:500,color:isLowest?"#2a9d8f":"#666",fontFamily:"'DM Sans',sans-serif",textAlign:"right",flexShrink:0}}>{d.name}</div>
              <div style={{flex:1,height:22,background:"#f6f4f0",borderRadius:4,overflow:"hidden",position:"relative"}}>
                <div style={{height:"100%",width:pct+"%",background:isLowest?"linear-gradient(90deg,#2a9d8f,#3dbda8)":"linear-gradient(90deg,#ddd,#ccc)",borderRadius:4,transition:"width 0.3s"}}/>
              </div>
              <div style={{width:85,fontSize:12,fontWeight:600,color:isLowest?"#2a9d8f":"#333",fontFamily:"'DM Sans',sans-serif",textAlign:"right",flexShrink:0}}>{fmt(d.gross)}</div>
            </div>
          );})}
        </div>

        {/* Monthly expense comparison */}
        <div style={{background:"#fff",borderRadius:12,padding:"16px 14px",marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#c0b8a8",marginBottom:10}}>Monthly Expenses (CAD)</div>
          {allData.map((d)=>{
            const mo=d.expenses/12;
            return(
            <div key={d.key} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <div style={{width:120,fontSize:11,fontWeight:500,color:"#666",fontFamily:"'DM Sans',sans-serif",textAlign:"right",flexShrink:0}}>{d.name}</div>
              <div style={{flex:1,height:22,background:"#f6f4f0",borderRadius:4,overflow:"hidden",display:"flex"}}>
                {catKeys.map(ck=>{
                  const cv=(d.catTots[ck]||0)/12;
                  const w=mo>0?cv/mo*100:0;
                  if(w<0.5)return null;
                  return <div key={ck} style={{width:w+"%",height:"100%",background:catColors[ck]||"#999",opacity:0.7}} title={ck+": $"+Math.round(cv)+"/mo"}/>;
                })}
              </div>
              <div style={{width:70,fontSize:12,fontWeight:600,color:"#333",fontFamily:"'DM Sans',sans-serif",textAlign:"right",flexShrink:0}}>{fmt(mo)}</div>
            </div>
          );})}
          <div style={{display:"flex",flexWrap:"wrap",gap:"4px 10px",marginTop:10,justifyContent:"center"}}>
            {catKeys.filter(ck=>catColors[ck]).map(ck=>(
              <div key={ck} style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:"#999",fontFamily:"'DM Sans',sans-serif"}}>
                <span style={{width:8,height:8,borderRadius:2,background:catColors[ck],opacity:0.7,flexShrink:0}}/>{ck}
              </div>
            ))}
          </div>
        </div>

        {/* Tax comparison */}
        <div style={{background:"#fff",borderRadius:12,padding:"16px 14px",marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#c0b8a8",marginBottom:10}}>Effective Tax Rate</div>
          {[...allData].sort((a,b)=>a.tEff-b.tEff).map((d,i)=>{
            const isLowest=i===0;
            return(
            <div key={d.key} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <div style={{width:120,fontSize:11,fontWeight:500,color:isLowest?"#2a9d8f":"#666",fontFamily:"'DM Sans',sans-serif",textAlign:"right",flexShrink:0}}>{d.name}</div>
              <div style={{flex:1,height:22,background:"#f6f4f0",borderRadius:4,overflow:"hidden",position:"relative"}}>
                <div style={{height:"100%",width:Math.min(d.tEff*2,100)+"%",background:isLowest?"linear-gradient(90deg,#2a9d8f,#3dbda8)":"linear-gradient(90deg,#c95858,#e07070)",borderRadius:4,opacity:0.6}}/>
              </div>
              <div style={{width:85,fontSize:12,fontWeight:600,color:isLowest?"#2a9d8f":"#c95858",fontFamily:"'DM Sans',sans-serif",textAlign:"right",flexShrink:0}}>{d.tEff.toFixed(1)}%</div>
            </div>
          );})}
        </div>

        {/* Detailed table */}
        <div style={{background:"#fff",borderRadius:12,padding:"16px 14px",marginBottom:16,overflowX:"auto"}}>
          <div style={{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#c0b8a8",marginBottom:10}}>Category Breakdown (Monthly CAD)</div>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"'DM Sans',sans-serif"}}>
            <thead>
              <tr style={{borderBottom:"2px solid #e8e4dd"}}>
                <th style={{textAlign:"left",padding:"6px 4px",fontSize:10,color:"#aaa",fontWeight:500}}>Region</th>
                {catKeys.map(ck=><th key={ck} style={{textAlign:"right",padding:"6px 3px",fontSize:9,color:catColors[ck]||"#aaa",fontWeight:600,whiteSpace:"nowrap"}}>{ck}</th>)}
                <th style={{textAlign:"right",padding:"6px 4px",fontSize:10,color:"#555",fontWeight:600}}>Total</th>
              </tr>
            </thead>
            <tbody>
              {allData.map((d)=>(
                <tr key={d.key} style={{borderBottom:"1px solid #f0ede8"}}>
                  <td style={{padding:"5px 4px",fontWeight:500,color:"#555",whiteSpace:"nowrap",fontSize:10}}>{d.name}</td>
                  {catKeys.map(ck=><td key={ck} style={{textAlign:"right",padding:"5px 3px",color:"#777",fontSize:10}}>{d.catTots[ck]?fmt(d.catTots[ck]/12):"-"}</td>)}
                  <td style={{textAlign:"right",padding:"5px 4px",fontWeight:600,color:"#333"}}>{fmt(d.expenses/12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary cards */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12,marginBottom:16}}>
          {allData.map(d=>(
            <div key={d.key} style={{background:"#fff",borderRadius:10,padding:"14px 12px",borderLeft:"3px solid #2a9d8f"}}>
              <div style={{fontSize:11,fontWeight:600,color:"#555",fontFamily:"'DM Sans',sans-serif",marginBottom:6}}>{d.name}</div>
              <div style={{fontSize:20,fontWeight:300,color:"#1c1c1c",fontFamily:"'Source Serif 4',Georgia,serif"}}>{fmt(d.gross/12)}<span style={{fontSize:10,color:"#aaa"}}>/mo gross</span></div>
              <div style={{fontSize:11,color:"#999",marginTop:4}}>{fmt(d.expenses/12)}/mo expenses - {d.tEff.toFixed(1)}% tax</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{height:32}}/>
    </div>
    );
  }

  return(
    <div style={st.pg}>
      <style>{"\
        @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,wght@0,300;0,400;0,600;1,300;1,400&family=DM+Sans:wght@400;500;600&display=swap');\
        *{box-sizing:border-box;margin:0;padding:0}body{background:#f6f4f0}\
        button{background:none;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent}\
        .cat-grid{display:flex;flex-direction:column;gap:10px;max-width:700px;margin:0 auto}\
        select{-webkit-appearance:none;appearance:none;background:#f6f4f0;border:1px solid #ddd;border-radius:8px;\
          padding:6px 28px 6px 12px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;color:#555;\
          cursor:pointer;outline:none;background-image:url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23999' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\");\
          background-repeat:no-repeat;background-position:right 10px center}\
        select:hover{border-color:#bbb}\
      "}</style>

      <div style={st.hero}>
        <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:12,marginBottom:6}}>
          <select value={ckey} onChange={e=>switchCountry(e.target.value)}>
            {Object.entries(COUNTRIES).map(([k,v])=><option key={k} value={k}>{v.name}</option>)}
          </select>
          <button onClick={toggleFam} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,border:"1.5px solid "+(fam?"#7a9a6a":"#ddd"),background:fam?"#f0f5ec":"#fff",fontSize:11,fontWeight:600,fontFamily:"'DM Sans',sans-serif",color:fam?"#5a7a4a":"#aaa",cursor:"pointer",transition:"all 0.2s"}}>
            <span style={{width:28,height:16,borderRadius:8,background:fam?"#7a9a6a":"#ccc",position:"relative",transition:"background 0.2s"}}>
              <span style={{position:"absolute",top:2,left:fam?14:2,width:12,height:12,borderRadius:6,background:"#fff",transition:"left 0.2s",boxShadow:"0 1px 2px rgba(0,0,0,0.15)"}}/>
            </span>
            Family
          </button>
          <button onClick={()=>setDash(true)} style={{padding:"5px 12px",borderRadius:20,border:"1.5px solid #6a7a8a",background:"#1a1a2e",fontSize:11,fontWeight:600,fontFamily:"'DM Sans',sans-serif",color:"#aab",cursor:"pointer",transition:"all 0.2s"}}>Dashboard</button>
        </div>
        <div style={st.hL}>REQUIRED GROSS INCOME (CAD)</div>
        <div style={st.hN}>{fmt(Gv)}</div>
        <div style={st.hS}>{fmt(Gv/12)} /mo  {tEff.toFixed(1)}% eff. tax{fam?" - Family of 4":""}</div>
      </div>

      <div ref={cRef} style={st.board}>
        <svg ref={svgRef} style={st.svg}/>

        <div style={st.rc}><div style={st.eq}>
          <div style={st.tag}>Required Gross Income (CAD)</div>
          <div style={st.ml}>
            <span style={st.dv}>G</span> <Op c="="/>{" "}
            <Pill name="Expenses" id="g-exp" color={EC}/>{" "}<Op c="+"/>{" "}
            <Pill name="Tax" id="g-tax" color={TC}/>
          </div>
        </div></div>

        <div style={st.rc}><div style={st.eq}>
          <div style={st.tag}>{country.taxLabel}</div>
          <div style={{...st.ml,fontSize:14,marginBottom:4}}>
            <Pill name="Tax" id="tax-Tax" color={TC}/> <Op c="="/>{" "}
            {tax.components.map((c,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:2}}>
              {i>0&&<Op c="+"/>}<Pill name={c.name} id={"tx-"+i} color={c.color}/>
            </span>)}
          </div>
          <div style={{marginTop:4,fontSize:12,fontWeight:600,color:"#555"}}>
            Total: {fmt(tax.total)} ({tEff.toFixed(1)}% effective)
          </div>
        </div></div>

        {tax.components.map((comp,ci)=>{
          const hasBrk=comp.brackets&&comp.bracketDetail;
          return(
            <div key={ci} style={st.rc}><div style={st.eq}>
              <div style={{...st.subEq,marginBottom:hasBrk?4:0}}>
                <Pill name={comp.name} id={"def-"+ci} color={comp.color}/><Op c="="/>
                <span style={st.it2}>{comp.formula}</span>
                <Op c="="/><span style={st.eqResult}>{fmt(comp.amount)}</span>
              </div>
              {hasBrk&&<div style={st.brkWrap}>
                {comp.bracketDetail.map((b,i)=>(
                  <div key={i} style={st.brkRow}>
                    <span style={st.brkLabel}>
                      {b.rate===0?"Exempt":i===0?"First":i===comp.bracketDetail.length-1&&b.width>1e8?"Over":"Next"}{" "}
                      {b.width>1e8?"$"+Math.round(comp.brackets.slice(0,i).reduce((a,x)=>a+x[0],0)).toLocaleString()
                        :"$"+Math.round(b.width).toLocaleString()}
                    </span>
                    <span style={st.brkRate}>@ {b.rate===0?"0%":(b.rate*100).toFixed(b.rate*100%1===0?0:1)+"%"}</span>
                    <span style={st.brkAmt}>{fmt(b.amt)}</span>
                    <span style={st.brkTax}>= {fmt(b.tax)}</span>
                  </div>
                ))}
              </div>}
            </div></div>
          );
        })}
        <div style={{fontSize:9,color:"#bbb",textAlign:"center",marginBottom:8,fontStyle:"italic"}}>{country.taxNote}</div>

        <div style={st.rc}><div style={st.eq}>
          <div style={st.tag}>Total Annual Expenses (CAD)</div>
          <div style={{...st.ml,fontSize:14}}>
            <Pill name="Expenses" id="eq2-Expenses" color={EC}/> <Op c="="/>{" "}
            {cats.map((c,i)=><span key={c.key} style={{display:"inline-flex",alignItems:"center",gap:2}}>
              {i>0&&<Op c="+"/>}<Pill name={c.key} id={"eq2-"+c.key} color={c.color}/>
            </span>)}
          </div>
          <div style={st.rr}>= {fmt(Ev)}/yr  {fmt(Ev/12)}/mo</div>
        </div></div>

        <div className="cat-grid">
        {cats.map(cat=>{
          const mo=cat.items.reduce((a,i)=>a+(s[i.k]||0),0);
          const famKeys=FAM[cat.key]?new Set(FAM[cat.key].map(x=>x.k)):null;
          return(
            <div key={cat.key} style={{position:"relative"}}><div style={st.eq}>
              <div style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"4px 6px",lineHeight:1.6}}>
                <Pill name={cat.key} id={"d-"+cat.key} color={cat.color}/>
                <Op c="="/>
                <Op c="("/>
                {cat.items.map((item,i)=>{
                  const isFam=famKeys&&famKeys.has(item.k);
                  return(
                  <span key={item.k} style={{display:"inline-flex",alignItems:"center",gap:2}}>
                    {i>0&&<Op c="+"/>}
                    <span style={{...st.inlineItem,...(isFam?{background:"#edf5e8",borderRadius:6,padding:"1px 4px"}:{})}}>
                      <span style={{...st.gL2,...(isFam?{color:"#7a9a6a"}:{})}}>{item.l}</span>
                      <Num value={s[item.k]||0} onChange={v=>up(item.k,v)} step={item.s} pre="$"/>
                    </span>
                  </span>
                );})}
                <Op c=")"/><Op c="x"/><span style={st.opNum}>12</span>
                <Op c="="/>
                <span style={st.eqResult}>{fmt(tots[cat.key])}/yr</span>
                <span style={{fontSize:11,color:"#bbb",marginLeft:4}}>{fmt(mo)}/mo</span>
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
  hero:{textAlign:"center",padding:"16px 16px 12px",background:"#fff",borderBottom:"1px solid #e8e4dd",position:"sticky",top:0,zIndex:30},
  hL:{fontSize:11,letterSpacing:"0.14em",color:"#aaa",fontWeight:500,marginBottom:2},
  hN:{fontSize:"clamp(32px,8vw,52px)",fontWeight:300,color:"#1c1c1c",letterSpacing:"-0.02em",lineHeight:1.15,fontFamily:"'Source Serif 4',Georgia,serif"},
  hS:{fontSize:13,color:"#999",marginTop:4},
  board:{position:"relative",padding:"12px 12px 8px",zIndex:0},
  svg:{position:"absolute",top:0,left:0,pointerEvents:"none",zIndex:3},
  rc:{display:"flex",justifyContent:"center",marginBottom:12},
  eq:{flex:1,background:"#fff",borderRadius:10,padding:"8px 12px 10px"},
  tag:{fontSize:10,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.1em",color:"#c0b8a8",marginBottom:2},
  ml:{fontFamily:"'Source Serif 4',Georgia,serif",fontSize:15,display:"flex",flexWrap:"wrap",alignItems:"center",gap:"4px 6px",lineHeight:1.5,color:"#1c1c1c"},
  pill:{display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:12,border:"1.5px solid",fontSize:12,fontWeight:500,fontFamily:"'DM Sans',sans-serif",fontStyle:"normal",whiteSpace:"nowrap",background:"#fff",position:"relative",zIndex:25,lineHeight:1.3},
  dv:{fontSize:17,fontStyle:"italic",fontWeight:600,fontFamily:"'Source Serif 4',Georgia,serif",color:"#1c1c1c"},
  op:{fontStyle:"normal",color:"#ccc",fontSize:13,padding:"0 1px"},
  rr:{fontSize:12,color:"#b5ad9e",fontFamily:"'DM Sans',sans-serif",marginTop:3,textAlign:"right"},
  inlineItem:{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:0},
  gL2:{fontSize:8,color:"#b0a89a",textTransform:"uppercase",letterSpacing:"0.04em",fontWeight:500,lineHeight:1},
  opNum:{fontSize:13,fontWeight:500,fontFamily:"'Source Serif 4',serif",color:"#888"},
  eqResult:{fontSize:13,fontWeight:600,fontFamily:"'DM Sans'",color:"#1c1c1c"},
  subEq:{display:"flex",alignItems:"center",flexWrap:"wrap",gap:"3px 5px",lineHeight:1.5},
  brkWrap:{display:"flex",flexDirection:"column",gap:2,marginLeft:4,marginTop:2},
  brkRow:{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#777",fontFamily:"'DM Sans',sans-serif",lineHeight:1.4},
  brkLabel:{minWidth:90,color:"#999",fontSize:10},
  brkRate:{minWidth:52,color:"#888",fontWeight:500,fontSize:10},
  brkAmt:{minWidth:60,textAlign:"right",color:"#aaa",fontSize:10},
  brkTax:{fontWeight:600,color:"#555",fontSize:11},
  it2:{fontSize:12,fontStyle:"italic",fontFamily:"'Source Serif 4',serif",color:"#888"},
  stepper:{display:"inline-flex",flexDirection:"column",alignItems:"center",position:"relative",zIndex:25},
  sBtn:{padding:"6px 12px",display:"flex",alignItems:"center",justifyContent:"center",minHeight:28,minWidth:36},
  sVal:{fontSize:13,fontWeight:500,fontFamily:"'DM Sans',sans-serif",color:"#333",background:"#f0ede8",border:"1px solid #e0dbd3",borderRadius:4,padding:"2px 6px",minWidth:40,textAlign:"center",fontStyle:"normal",lineHeight:1.3},
};

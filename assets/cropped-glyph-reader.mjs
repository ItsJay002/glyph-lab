// Conservative shape matching for straight, separated glyphs on a plain background.
// No language model or word guessing: ambiguous shapes reject the entire reading.
const GRID=41, SCALE=20, MAX_GLYPHS=256;
const reject=()=>{throw Error('unclear');};
function runs(values){const out=[];for(let i=0;i<values.length;i++)if(values[i]){if(!out.length||i>out.at(-1)[1]+1)out.push([i,i]);else out.at(-1)[1]=i;}return out;}
function foreground(pixels,w,h,fraction){
 const border=[];
 for(let x=0;x<w;x++)for(const y of [0,h-1]){const i=(y*w+x)*4;border.push([pixels[i],pixels[i+1],pixels[i+2]]);}
 for(let y=0;y<h;y++)for(const x of [0,w-1]){const i=(y*w+x)*4;border.push([pixels[i],pixels[i+1],pixels[i+2]]);}
 const bg=[0,1,2].map(c=>border.map(p=>p[c]).sort((a,b)=>a-b)[Math.floor(border.length/2)]);
 const strength=new Float32Array(w*h);let peak=0;
 for(let i=0;i<w*h;i++){const v=Math.max(...bg.map((b,c)=>Math.abs(pixels[i*4+c]-b)))*pixels[i*4+3]/255;strength[i]=v;peak=Math.max(peak,v);}
 if(peak<70)reject();
 const mask=Uint8Array.from(strength,v=>v>peak*fraction?1:0);
 // Remove disconnected panel rules and very small specks before finding text rows.
 const seen=new Int32Array(w*h),queue=new Int32Array(w*h);let component=0;
 for(let start=0;start<mask.length;start++){
  if(!mask[start]||seen[start])continue;
  component++;let head=0,tail=1,left=w,right=0,top=h,bottom=0;queue[0]=start;seen[start]=component;
  while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;const next=ny*w+nx;if(mask[next]&&!seen[next]){seen[next]=component;queue[tail++]=next;}}
  }
  const cw=right-left+1,ch=bottom-top+1;
  const rule=Math.max(cw,ch)>=64&&Math.max(cw/ch,ch/cw)>4&&tail/(cw*ch)<.2;
  let frame=false;
  if(cw>=64&&ch>=64){
   let onEdge=0;for(let i=0;i<tail;i++){const x=queue[i]%w,y=Math.floor(queue[i]/w);if(Math.min(x-left,right-x,y-top,bottom-y)<=2)onEdge++;}
   if(onEdge/tail>.92){let inside=0;for(let y=top+3;y<bottom-2&&inside<8;y++)for(let x=left+3;x<right-2&&inside<8;x++)if(mask[y*w+x]&&seen[y*w+x]!==component)inside++;frame=inside>=8;}
  }
  if(rule||frame||tail<4&&cw<3&&ch<3)for(let i=0;i<tail;i++)mask[queue[i]]=0;
 }
 return mask;
}
// Locate rows first so labels, small stars, and UI separators are not read as glyphs.
function rows(mask,w,h){
 const row=new Uint32Array(h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)row[y]+=mask[y*w+x];
 const output=[];
 for(const [top,bottom] of runs(row)){
  if(bottom-top<17)continue;
  const col=new Uint32Array(w);for(let y=top;y<=bottom;y++)for(let x=0;x<w;x++)col[x]+=mask[y*w+x];
  const boxes=[];
  for(const [left,right] of runs(col)){
   let t=h,b=-1,count=0;for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(mask[y*w+x]){t=Math.min(t,y);b=Math.max(b,y);count++;}
   if(count<8||b-t<4&&right-left<4)continue;
   boxes.push({left,right,top:t,bottom:b});
  }
  output.push(boxes);
 }
 return output;
}
function distance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return (x-a[0]-t*dx)**2+(y-a[1]-t*dy)**2;}
export function prepareShapes(shapes){
 const edges=[],keys=new Map();
 const templates=shapes.map(shape=>{
  const indexes=shape.map(([a,b])=>{const key=[a.join(','),b.join(',')].sort().join(':');if(!keys.has(key)){keys.set(key,edges.length);edges.push([a,b]);}return keys.get(key);});
  const points=new Set();for(const [a,b] of shape){const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*SCALE);for(let i=0;i<=n;i++){const x=Math.round((a[0]+(b[0]-a[0])*i/n)*SCALE),y=Math.round((a[1]+(b[1]-a[1])*i/n)*SCALE);points.add(y*GRID+x);}}
  return {indexes,points:Uint16Array.from(points)};
 });return {edges,templates};
}
function match(mask,w,box,prepared){
 const {left,right,top,bottom}=box,points=[],occupied=new Set();
 for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(mask[y*w+x]){
  const px=(x-left)/(right-left)*2,py=(y-top)/(bottom-top)*2;
  const key=Math.round(py*SCALE)*GRID+Math.round(px*SCALE);
  if(!occupied.has(key)){occupied.add(key);points.push([px,py]);}
 }
 if(points.length<30||points.length>GRID*GRID*.4)reject();
 const field=new Float32Array(GRID*GRID);
 for(let y=0;y<GRID;y++)for(let x=0;x<GRID;x++){let best=Infinity;for(const [px,py] of points)best=Math.min(best,(x/SCALE-px)**2+(y/SCALE-py)**2);field[y*GRID+x]=best;}
 const edgeDistances=prepared.edges.map(([a,b])=>Float32Array.from(points,([x,y])=>distance(x,y,a,b)));
 let best=Infinity,second=Infinity,id=-1;
 for(let i=0;i<prepared.templates.length;i++){
  const t=prepared.templates[i];let reverse=0;for(const p of t.points)reverse+=field[p];reverse/=t.points.length;
  if(reverse>second)continue;
  let forward=0;for(let p=0;p<points.length;p++){let d=Infinity;for(const e of t.indexes)d=Math.min(d,edgeDistances[e][p]);forward+=d;}
  const score=reverse+forward/points.length;
  if(score<best){second=best;best=score;id=i;}else if(score<second)second=score;
 }
 if(best>.01||second-best<.004||second<best*1.8)reject();
 return id;
}
function readRows(mask,w,h,prepared,progress){
 const found=[],bands=rows(mask,w,h),matched=new Set();
 for(const boxes of bands){
  const candidates=[];
  for(const box of boxes){
   const cw=box.right-box.left,ch=box.bottom-box.top;
   if(cw<17||ch<17||cw/ch<.78||cw/ch>1.28){candidates.push({...box,id:null});continue;}
   let id;try{id=match(mask,w,box,prepared);}catch{id=null;}
   candidates.push({...box,id});
  }
  const good=candidates.filter(c=>c.id!==null);
  if(!good.length)continue;
  const size=good.map(c=>c.bottom-c.top).sort((a,b)=>a-b)[Math.floor(good.length/2)];
  const relevant=candidates.filter(c=>c.bottom-c.top>=size*.55);
  // Never return a partial message from a row containing uncertain or cut-off glyphs.
  if(relevant.some(c=>c.id===null||c.left===0||c.right===w-1||c.top===0||c.bottom===h-1))reject();
  if(relevant.some(c=>(c.bottom-c.top)/size<.75||(c.bottom-c.top)/size>1.33))reject();
  const row={cells:relevant,left:relevant[0].left,top:Math.min(...relevant.map(c=>c.top)),bottom:Math.max(...relevant.map(c=>c.bottom)),size};
  found.push(row);matched.add(boxes);
  if(found.reduce((n,r)=>n+r.cells.length,0)>MAX_GLYPHS)reject();
  progress(Math.min(90,found.reduce((n,r)=>n+r.cells.length,0)));
 }
 if(!found.length)reject();
 // A neighbouring row of damaged glyphs must not disappear from the message.
 for(const boxes of bands){
  if(matched.has(boxes))continue;
  for(const box of boxes)for(const row of found){
   const height=box.bottom-box.top,right=row.cells.at(-1).right;
   const gap=box.top>row.bottom?box.top-row.bottom:row.top-box.bottom;
   if(height>=row.size*.7&&height<=row.size*1.4&&gap>=0&&gap<=row.size*1.5&&box.right>=row.left-row.size*.5&&box.left<=right+row.size*.5)reject();
  }
 }
 for(let i=1;i<found.length;i++){
  const a=found[i-1],b=found[i];
  if(b.top-a.bottom>a.size*1.5||Math.abs(a.left-b.left)>a.size*.5||b.size/a.size<.75||b.size/a.size>1.33)throw Error('multiple');
 }
 return found.flatMap(row=>row.cells.map(c=>c.id));
}
export function readCroppedGlyphs(pixels,w,h,prepared,progress=()=>{}){
 let ids,agreements=0,multiple=false;
 // Anti-aliased screenshots lose thin strokes at high thresholds; glowing images
 // need a higher threshold. Accept only two complete, agreeing readings.
 for(const fraction of [.45,.60,.78]){
  let candidate;
  try{candidate=readRows(foreground(pixels,w,h,fraction),w,h,prepared,progress);}catch(error){multiple ||= error.message==='multiple';continue;}
  if(ids&&(ids.length!==candidate.length||ids.some((id,i)=>id!==candidate[i])))reject();ids=candidate;agreements++;
 }
 if(agreements<2){if(multiple)throw Error('multiple');reject();}
 return ids;
}

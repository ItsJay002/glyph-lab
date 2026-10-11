// A visible verification strip checks shape recognition; it contains no plaintext.
export const MAGIC = 0xeacc;
export const MAX_IMAGE_TOKENS = 600;
export function checksum(ids) {
 let crc=0xffffffff;
 for(const id of ids) for(const b of [id&255,id>>8]) {
  crc^=b; for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
 }
 return (crc^0xffffffff)>>>0;
}
export function stripBits(ids) {
 return [MAGIC,ids.length,checksum(ids)>>>16,checksum(ids)&65535].flatMap(n=>Array.from({length:16},(_,i)=>(n>>>(15-i))&1));
}
export function readStrip(rgba,width,height) {
 const bits=[];
 for(let i=0;i<64;i++) {
  let sum=0;
  for(let dy=2;dy<5;dy++)for(let dx=2;dx<5;dx++)sum+=rgba[((height-32+dy)*width+72+i*10+dx)*4+1];
  const g=sum/9;
  if(g>175)bits.push(1);else if(g<70)bits.push(0);else throw Error('unclear');
 }
 const word=n=>bits.slice(n,n+16).reduce((v,b)=>(v<<1)|b,0);
 const count=word(16);
 if(word(0)!==MAGIC||count<1||count>MAX_IMAGE_TOKENS)throw Error('unsupported');
 return {count,crc:((word(32)<<16)|word(48))>>>0};
}
export function drawTransmission(canvas,ids,alphabet) {
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image export unavailable.');
 const columns=12,cell=88,rows=Math.ceil(ids.length/columns);
 canvas.width=1200;canvas.height=Math.max(630,230+rows*cell+90);
 ctx.fillStyle='#171c17';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.fillStyle='#d4f5ae';ctx.font='bold 34px sans-serif';ctx.fillText('e/acc.world',72,78);
 ctx.font='14px monospace';ctx.fillText('TRANSMISSION / ACCELERANDO-8192',72,112);
 ctx.strokeStyle='#b4eda7';ctx.lineWidth=2.6;ctx.lineCap='square';
 ids.forEach((id,i)=>{const x=84+i%columns*cell,y=170+Math.floor(i/columns)*cell;ctx.beginPath();for(const [a,b] of alphabet.shapes[id]){ctx.moveTo(x+a[0]*28,y+a[1]*28);ctx.lineTo(x+b[0]*28,y+b[1]*28);}ctx.stroke();});
 ctx.font='14px monospace';ctx.fillStyle='#99ac8d';ctx.fillText(`${ids.length} TOKENS / EXACT TEXT, NEW FORM`,72,canvas.height-62);
 ctx.fillStyle='#b4eda7';stripBits(ids).forEach((bit,i)=>{if(bit)ctx.fillRect(72+i*10,canvas.height-32,7,7);});
 return canvas;
}
export function rasterDimensions(bytes) {
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length>=24&&v.getUint32(0)===0x89504e47&&v.getUint32(4)===0x0d0a1a0a&&v.getUint32(12)===0x49484452)return {width:v.getUint32(16),height:v.getUint32(20),type:'image/png'};
 if(bytes[0]===255&&bytes[1]===216){
  let p=2;while(p+4<=bytes.length){if(bytes[p++]!==255)throw Error('Invalid JPG.');while(bytes[p]===255)p++;const marker=bytes[p++];if(marker===0xda||marker===0xd9)break;if(marker===1||(marker>=0xd0&&marker<=0xd7))continue;if(p+2>bytes.length)break;const length=v.getUint16(p);if(length<2||p+length>bytes.length)break;if([0xc0,0xc1,0xc2].includes(marker)&&length>=8)return {width:v.getUint16(p+5),height:v.getUint16(p+3),type:'image/jpeg'};p+=length;
  }
 }
 throw Error('Choose a JPG, PNG, or SVG image.');
}
export function validateDimensions({width,height}) {
 if(width<24||height<24||width>6000||height>12000||width*height>16000000||height/width>8)throw Error('That image is too small or too large. Try a different image.');
}
// SVG paths must use the exact exported M/L grammar; no scripts or rendering needed.
export function matchSVGPaths(paths,width,height,shapes) {
 if(!paths.length||paths.length>2000)throw Error('unsupported');
 const cols=Math.min(16,paths.length),rows=Math.ceil(paths.length/cols);
 if(width!==cols*62+32||height!==rows*62+32)throw Error('cropped');
 const signature=segments=>segments.map(([a,b])=>[a,b].map(p=>p.join(',')).sort().join(':')).sort().join(';');
 const lookup=new Map(shapes.map((s,i)=>[signature(s),i]));
 return paths.map((d,i)=>{
  const number='-?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';const re=new RegExp(`M(${number})[ ,]+(${number})L(${number})[ ,]+(${number})`,'g');
  const matches=[...d.matchAll(re)];if(!matches.length||d.replace(re,'').trim())throw Error('unsupported');
  const x=28+i%cols*62,y=28+Math.floor(i/cols)*62;
  const segments=matches.map(m=>[[Number(m[1]),Number(m[2])],[Number(m[3]),Number(m[4])]].map(([a,b])=>{
   const px=(a-x)/18,py=(b-y)/18;if(!Number.isInteger(px)||!Number.isInteger(py)||px<0||px>2||py<0||py>2)throw Error('unclear');return [px,py];
  }));
  const id=lookup.get(signature(segments));if(id===undefined)throw Error('unclear');return id;
 });
}

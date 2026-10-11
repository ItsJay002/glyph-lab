import {readStrip,checksum} from './transmission.mjs';
import {prepareShapes,readCroppedGlyphs} from './cropped-glyph-reader.mjs';
import {decodeGlyphInput} from './glyph-codec.mjs';
import {GlyphTokenizer} from './tokenizer.mjs';
let dictionary;
function Canvas(w,h){if(typeof OffscreenCanvas !== 'undefined')return new OffscreenCanvas(w,h);const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
async function loadBitmap(file){if(typeof createImageBitmap === 'function'){try{return await createImageBitmap(file);}catch{}}const url=URL.createObjectURL(file);try{const image=new Image();image.src=url;await new Promise((ok,no)=>{image.onload=ok;image.onerror=()=>no(Error('Unsupported image.'));});image.close=()=>{};return image;}finally{URL.revokeObjectURL(url);}}

const SIZE=48,WORDS=SIZE*SIZE/32;
function mask(pixels) {const bits=new Uint32Array(WORDS);let count=0;for(let i=0;i<SIZE*SIZE;i++)if(pixels[i*4+1]>115&&pixels[i*4+1]-pixels[i*4+2]>20){bits[i>>>5]|=1<<(i&31);count++;}return {bits,count};}
function pop(x){x=x-((x>>>1)&0x55555555);x=(x&0x33333333)+((x>>>2)&0x33333333);return (((x+(x>>>4))&0x0f0f0f0f)*0x01010101)>>>24;}
async function setup(){
 const response=await fetch(new URL('./alphabet.json',import.meta.url));if(!response.ok)throw Error('dictionary');
 const alphabet=await response.json(),canvas=Canvas(SIZE,SIZE),ctx=canvas.getContext('2d',{willReadFrequently:true});
 const templates=[];
 for(const shape of alphabet.shapes){
  ctx.fillStyle='#171c17';ctx.fillRect(0,0,SIZE,SIZE);ctx.strokeStyle='#b4eda7';ctx.lineWidth=2.6*SIZE/72;ctx.lineCap='square';ctx.beginPath();
  for(const [a,b] of shape){ctx.moveTo((8+a[0]*28)*SIZE/72,(8+a[1]*28)*SIZE/72);ctx.lineTo((8+b[0]*28)*SIZE/72,(8+b[1]*28)*SIZE/72);}ctx.stroke();templates.push(mask(ctx.getImageData(0,0,SIZE,SIZE).data));
 }
 return {templates,tokenizer:new GlyphTokenizer(alphabet),prepared:prepareShapes(alphabet.shapes)};
}
export async function readImage(file,notify=()=>{}) {
 const data={file};let result;const send=value=>{notify(value);result=value;};
 let bitmap;
 try{
  dictionary??=setup();const {templates,tokenizer,prepared}=await dictionary;
  bitmap=await loadBitmap(data.file);const h=Math.round(bitmap.height*1200/bitmap.width);
  const canvas=Canvas(1200,h),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,1200,h);let strip;
  try{strip=readStrip(ctx.getImageData(0,0,1200,h).data,1200,h);}catch{
   const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),w=Math.round(bitmap.width*scale),height=Math.round(bitmap.height*scale);
   const cropped=Canvas(w,height),cx=cropped.getContext('2d',{willReadFrequently:true});cx.drawImage(bitmap,0,0,w,height);bitmap.close();bitmap=null;
   const ids=readCroppedGlyphs(cx.getImageData(0,0,w,height).data,w,height,prepared,progress=>send({progress}));
   const {text}=decodeGlyphInput(ids.join(','),'ids',tokenizer);
   if(!text.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text))throw Error('unclear');
   send({text,count:ids.length,reading:true});return result;
  }
  bitmap.close();bitmap=null;
  const {count,crc}=strip;
  if(170+Math.ceil(count/12)*88>h-60)throw Error('cropped');
  const cell=Canvas(SIZE,SIZE),c=cell.getContext('2d',{willReadFrequently:true}),ids=[];
  for(let i=0;i<count;i++){
   c.drawImage(canvas,76+i%12*88,162+Math.floor(i/12)*88,72,72,0,0,SIZE,SIZE);
   const target=mask(c.getImageData(0,0,SIZE,SIZE).data);if(target.count<20)throw Error('unclear');
   let best=Infinity,second=Infinity,bestId=-1;
   for(let id=0;id<templates.length;id++){
    const t=templates[id];let different=0;for(let w=0;w<WORDS;w++)different+=pop(target.bits[w]^t.bits[w]);
    const score=different/(target.count+t.count);
    if(score<best){second=best;best=score;bestId=id;}else if(score<second)second=score;
   }
   if(best>.18||second-best<.012)throw Error('unclear');ids.push(bestId);
   if(i%12===0)send({progress:Math.round(100*(i+1)/count)});
  }
  if(checksum(ids)!==crc)throw Error('unclear');
  const {text}=decodeGlyphInput(ids.join(','),'ids',tokenizer);
  send({text,count});
 }catch(error){send({error:error.message==='multiple'?'Found more than one glyph message. Crop to the one you want to read.':'Couldn’t read that one. Try cropping closer to the glyphs or use a sharper image.'});}
 finally{bitmap?.close();}
 return result;
}

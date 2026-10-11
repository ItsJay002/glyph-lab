import {readImage} from './raster-reader.mjs'; self.onmessage=async({data})=>{await readImage(data.file,value=>self.postMessage(value));};

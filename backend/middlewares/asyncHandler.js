import {safeError} from './safeError.js';
export default fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res,next)).catch(e=>safeError(e,req,res,next));

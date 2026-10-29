import {PDFDict,PDFArray,PDFName} from 'pdf-lib';
import {fail} from './marketplace.js';
export function checkPrintPdf(pdf){
 const blocked=new Set(['JS','JavaScript','OpenAction','AA','Launch','EmbeddedFiles','RichMedia','XFA']),seen=new Set();let count=0;
 const visit=(value,depth=0)=>{
  if(++count>100000||depth>40)fail('PDF is too complex to print. Export a flattened PDF.');
  if(!value||seen.has(value))return;seen.add(value);
  if(value instanceof PDFName){if(blocked.has(value.decodeText()))fail('Interactive scripts or attachments are not accepted. Export a flattened PDF.');}
  else if(value instanceof PDFDict)for(const [key,child] of value.entries()){visit(key,depth+1);visit(child,depth+1);}
  else if(value instanceof PDFArray)for(const child of value.asArray())visit(child,depth+1);
  else if(value.dict instanceof PDFDict)visit(value.dict,depth+1);
 };
 for(const [,object] of pdf.context.enumerateIndirectObjects())visit(object);
}

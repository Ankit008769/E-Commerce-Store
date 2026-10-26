import os from 'node:os';
import {randomUUID} from 'node:crypto';
export const workerIdentity={host:os.hostname(),pid:process.pid,token:randomUUID()};
export function ownerIsStopped(owner){
 // No time-based lease stealing: a paused worker must never lose its stock.
 // Cross-host / unknown ownership fails closed. Run workers in the same OS PID
 // namespace; multi-host recovery needs a transactional coordinator.
 if(!owner?.token||owner.host!==workerIdentity.host||!Number.isInteger(owner.pid)||owner.pid<=0)return false;
 try{process.kill(owner.pid,0);return false;}catch(e){return e.code==='ESRCH';}
}

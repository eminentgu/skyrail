// Simulator only. A real executor must drain actions, release keys and observe before granting.
export function transition(state,expectedEpoch,owner){
  if(expectedEpoch!==state.epoch) throw Object.assign(new Error('控制状态已变化，请重试'),{status:409});
  if(!['none','human','agent'].includes(owner))throw Object.assign(new Error('无效控制者'),{status:400});
  return {owner,epoch:state.epoch+1,mode:'simulation'};
}

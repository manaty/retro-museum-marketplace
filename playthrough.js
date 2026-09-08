// Evidence is written only by an authenticated operator/test runner to the
// private catalog bucket. Submission bodies and author repositories cannot set it.
export const PLAYTHROUGH_CHECKS=['interactiveControls','matchCompletion','replay','noWinnerCompletion','localization','soundControls'];
export function verifiedPlaythrough(value,{hash,source}){
 if(!value||value.schemaVersion!==1||value.sha256!==hash||value.sourceCommit!==source.commit)return null;
 if(!['human','agent'].includes(value.reviewer?.kind)||typeof value.reviewer?.name!=='string'||!value.reviewer.name.trim())return null;
 if(!Number.isFinite(Date.parse(value.checkedAt))||Date.parse(value.checkedAt)>Date.now()+60000)return null;
 if(!PLAYTHROUGH_CHECKS.every(key=>value.checks?.[key]===true))return null;
 if(typeof value.evidenceUrl!=='string'||!/^https:\/\/github\.com\/manaty\//.test(value.evidenceUrl)||typeof value.scope!=='string'||value.scope.length<30)return null;
 return {schemaVersion:1,sha256:hash,sourceCommit:source.commit,reviewer:value.reviewer,checkedAt:value.checkedAt,checks:Object.fromEntries(PLAYTHROUGH_CHECKS.map(key=>[key,true])),evidenceUrl:value.evidenceUrl,scope:value.scope.slice(0,3000)};
}

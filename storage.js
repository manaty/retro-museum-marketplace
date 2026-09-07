import {Storage} from '@google-cloud/storage';
import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';import {resolve,dirname} from 'node:path';
export class Store{
 constructor(bucket,local){this.bucket=bucket?new Storage().bucket(bucket):null;this.root=resolve(local||'.local/store');}
 file(key){if(!/^[a-zA-Z0-9][a-zA-Z0-9_./-]*$/.test(key)||key.split('/').some(x=>!x||x==='..'||x==='.'))throw Error('Invalid storage key');return this.bucket?.file(key);}
 async put(key,value,{create=false}={}){const file=this.file(key),bytes=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value));if(file){await file.save(bytes,{resumable:false,metadata:{contentType:'application/json',cacheControl:'no-store'},...(create?{preconditionOpts:{ifGenerationMatch:0}}:{})});}else{const path=resolve(this.root,key);await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:create?'wx':'w'});}}
 async bytes(key){const file=this.file(key);return file?(await file.download())[0]:readFile(resolve(this.root,key));}
 async get(key){try{return JSON.parse(await this.bytes(key));}catch(e){if(['ENOENT',404].includes(e.code))return null;throw e;}}
 async list(prefix){this.file(prefix+'x');if(this.bucket){const [files]=await this.bucket.getFiles({prefix,maxResults:500});return files.map(x=>x.name);}try{return (await readdir(resolve(this.root,prefix))).map(x=>prefix+x);}catch(e){if(e.code==='ENOENT')return [];throw e;}}
}

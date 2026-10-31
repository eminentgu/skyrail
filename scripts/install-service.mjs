import {mkdir,writeFile,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
const root=path.resolve(import.meta.dirname,'..');
const helper=path.join(root,'.data/Skyrail Mac.app/Contents/MacOS/SkyrailMac');
if(!process.env.SKYRAIL_REMOTE_HOST||!/^[a-z0-9.-]+$/i.test(process.env.SKYRAIL_REMOTE_HOST))throw Error('Set SKYRAIL_REMOTE_HOST to your HTTPS hostname');
await access(helper);
const directory=path.join(os.homedir(),'Library/LaunchAgents');
await mkdir(directory,{recursive:true});
const escape=value=>String(value).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const string=value=>`<string>${escape(value)}</string>`;
const domain=`gui/${process.getuid()}`;
const common={PATH:process.env.PATH,SKYRAIL_NODE:process.execPath,...(process.env.CODEX_BIN?{CODEX_BIN:process.env.CODEX_BIN}:{})};
for(const [suffix,args,extra] of [
 ['service',[helper,'--run-service',root],{SKYRAIL_MANAGED_SERVICE:'1'}],
 ['gateway',[process.execPath,path.join(root,'apps/remote-gateway/server.mjs')],{SKYRAIL_REMOTE_HOST:process.env.SKYRAIL_REMOTE_HOST}]
]){
 const label=`local.skyrail.${suffix}`;
 const filename=path.join(directory,`${label}.plist`);
 const environment={...common,...extra};
 const plist=`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key>${string(label)}<key>ProgramArguments</key><array>${args.map(string).join('')}</array><key>WorkingDirectory</key>${string(root)}<key>EnvironmentVariables</key><dict>${Object.entries(environment).map(([k,v])=>`<key>${escape(k)}</key>${string(v)}`).join('')}</dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>5</integer><key>StandardOutPath</key>${string(path.join(root,`.data/${label}.out.log`))}<key>StandardErrorPath</key>${string(path.join(root,`.data/${label}.err.log`))}</dict></plist>`;
 await writeFile(filename,plist,{mode:0o600});
 try{execFileSync('launchctl',['bootout',`${domain}/${label}`],{stdio:'ignore'})}catch{}
 // Wait for the previous registration to disappear; bootstrap otherwise races it.
 for(let n=0;n<30;n++){try{execFileSync('launchctl',['print',`${domain}/${label}`],{stdio:'ignore'});await new Promise(r=>setTimeout(r,100))}catch{break}}
 // Migrate the earlier wrapper, which could leave its Node child orphaned.
 // Match this checkout and exact Node executable; never stop unrelated services.
 const expected=`${process.execPath} ${path.join(root,suffix==='service'?'apps/local-service/server.mjs':'apps/remote-gateway/server.mjs')}`;
 const processes=execFileSync('ps',['-axo','pid=,command='],{encoding:'utf8'}).split('\n');
 for(const line of processes){const match=line.match(/^\s*(\d+)\s+(.+)$/);if(match?.[2]!==expected)continue;const pid=Number(match[1]);try{const current=execFileSync('ps',['-p',String(pid),'-o','command='],{encoding:'utf8'}).trim();if(current===expected)process.kill(pid,'SIGTERM')}catch{}}
 // Allow the old listener and native input queue to finish shutting down.
 await new Promise(r=>setTimeout(r,1200));
 execFileSync('launchctl',['bootstrap',domain,filename],{stdio:'inherit'});
 console.log(`Installed ${label}`);
}

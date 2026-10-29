import fs from 'node:fs';
import path from 'node:path';
// The page is static: site/ is copied to dist/ (what Cloudflare Pages serves), and told where its API is:
// the same site (functions/api, on Cloudflare) unless API_BASE names another address.
const API_BASE=(process.env.API_BASE??'').replace(/\/$/,'');
const root=process.cwd(),site=path.join(root,'site'),dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
for(const name of fs.readdirSync(site))fs.cpSync(path.join(site,name),path.join(dist,name),{recursive:true});
fs.writeFileSync(path.join(dist,'config.js'),`export const API_BASE=${JSON.stringify(API_BASE)};\n`);
console.log(`Built the invitation page; its API is ${API_BASE||'on the same address'}.`);

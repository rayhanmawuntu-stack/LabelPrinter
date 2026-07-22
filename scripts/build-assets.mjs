import {readFile, writeFile} from 'node:fs/promises';
import process from 'node:process';

const styles=[
  'style-01.css','style-02.css','style-03.css','style-04.css','style-05.css',
  'style-03b.css','style-05b.css','style-06.css','style-07.css','style-08.css',
  'style-09.css','style-10.css','style-11.css','style-12.css','style-13.css',
  'style-14.css','style-15.css','style-16.css','style-17.css','style-18.css',
  'style-19.css','style-20.css','style-21.css','style-22.css','style-23.css',
  'style-24.css','style-25.css','style-26.css','style-27.css','style-28.css',
  'style-29.css','style-30.css','style-31.css','style-32.css','style-33.css',
  'style-34.css','style-35.css','style-36.css','style-37.css','style-38.css',
  'style-39.css','style-40.css','style-41.css','style-42.css','style-43.css',
  'style-44.css','style-45.css','style-46.css','style-47.css','style-48.css',
  'style-49.css','style-50.css','style-51.css','style-52.css','style-53.css',
  'style-54.css','style-55.css'
];

const coreScripts=[
  'no-mock.js','app-01.js','app-sanitize.js','app-theme.js','app-palette.js',
  'app-performance.js','app-02.js','app-03.js','app-03b.js','app-awb.js',
  'app-print-logo.js','app-04.js','app-04b.js','app-analytics-fast.js','app-05.js',
  'app-invoice-memory.js','app-validation.js','app-fixed-backend.js',
  'app-sync-awb-recovery.js','app-sync-fast.js'
];

const trackingScripts=['app-tracking-tab-v2.js','app-tracking-settings.js'];
const importScripts=['app-import.js'];

const analyticsScripts=[
  'app-monthly-report-graphs.js','app-report-export.js',
  'app-report-tracking-columns.js','app-report-pdf-v2.js'
];

const partials=['body-01.html','body-02.html','body-03.html','body-04.html'];
const checkOnly=process.argv.includes('--check');

async function combine(paths,{directory,separator,header}){
  const sources=await Promise.all(paths.map(async file=>{
    const content=await readFile(new URL(`../${directory}/${file}`,import.meta.url),'utf8');
    return `${header(file)}\n${content.trim()}\n`;
  }));
  return sources.join(separator);
}

const outputs=new Map([
  ['../assets/app.bundle.css',await combine(styles,{
    directory:'assets',separator:'\n',header:file=>`/* Source: ${file} */`
  })],
  ['../assets/app-core.bundle.js',await combine(coreScripts,{
    directory:'assets',separator:'\n;\n',header:file=>`/* Source: ${file} */`
  })],
  ['../assets/app-analytics.bundle.js',await combine(analyticsScripts,{
    directory:'assets',separator:'\n;\n',header:file=>`/* Source: ${file} */`
  })],
  ['../assets/app-tracking.bundle.js',await combine(trackingScripts,{
    directory:'assets',separator:'\n;\n',header:file=>`/* Source: ${file} */`
  })],
  ['../assets/app-import.bundle.js',await combine(importScripts,{
    directory:'assets',separator:'\n;\n',header:file=>`/* Source: ${file} */`
  })],
  ['../partials/app-shell.html',await combine(partials,{
    directory:'partials',separator:'\n',header:file=>`<!-- Source: ${file} -->`
  })]
]);

let stale=false;
for(const [relativePath,content] of outputs){
  const url=new URL(relativePath,import.meta.url);
  const expected=`${content.trim()}\n`;
  if(checkOnly){
    let actual='';
    try{actual=await readFile(url,'utf8')}catch{}
    if(actual!==expected){
      console.error(`${relativePath.replace('../','')} is stale. Run npm run build.`);
      stale=true;
    }
  }else{
    await writeFile(url,expected);
    console.log(`Built ${relativePath.replace('../','')}`);
  }
}

if(stale)process.exitCode=1;

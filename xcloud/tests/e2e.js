const {chromium}=require('/workspace/pwtest/node_modules/playwright-core');
const fs=require('fs');
const BASE=process.env.BASE||'http://127.0.0.1:8931/xcloud/';
const OUT=process.env.OUT||'/workspace/xcloud/screens';
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const res=[];const ok=(n,c)=>{res.push([n,!!c]);console.log((c?'PASS ':'FAIL ')+n);};
 for(const [tag,vp,mob] of [['desktop',{width:1440,height:900},false],['mobile',{width:390,height:844},true]]){
  const ctx=await b.newContext({viewport:vp,isMobile:mob,hasTouch:mob,deviceScaleFactor:mob?2:1,acceptDownloads:true,geolocation:{latitude:45.6983,longitude:9.6773},permissions:['geolocation']});
  const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  await p.goto(BASE,{waitUntil:'networkidle'});
  await p.waitForSelector('.kpi');ok(tag+' dashboard',await p.locator('.kpi').count()===8);
  await p.screenshot({path:`${OUT}/${tag}-dashboard.png`,fullPage:!mob});
  // dipendenti
  await p.goto(BASE+'#/dipendenti');await p.waitForSelector('#eName');await p.fill('#eName','Nuovo Test (demo)');await p.fill('#eMan','Saldatore');await p.click('#eAdd');
  ok(tag+' add employee',await p.locator('text=Nuovo Test (demo)').count()>0);
  await p.screenshot({path:`${OUT}/${tag}-dipendenti.png`,fullPage:!mob});
  // timbrature
  await p.goto(BASE+'#/timbrature');await p.waitForSelector('#pIn');await p.click('#pIn');await p.waitForTimeout(300);
  ok(tag+' punch in',await p.locator('text=in servizio').count()>0);
  await p.click('#geoT');await p.waitForSelector('#mOk');ok(tag+' geo legal modal',await p.locator('#mGo').isDisabled());
  await p.screenshot({path:`${OUT}/${tag}-timbrature-avviso-geo.png`});
  await p.check('#mOk');await p.click('#mGo');await p.waitForTimeout(200);
  // switch tenant to Bergamo company to test in-sede
  await p.selectOption('#tenantSel',{index:1});await p.waitForTimeout(200);
  await p.goto(BASE+'#/timbrature');await p.waitForSelector('#pIn');
  const geoOn=await p.isChecked('#geoT');
  if(!geoOn){await p.click('#geoT');await p.check('#mOk');await p.click('#mGo');await p.waitForTimeout(200);}
  await p.click('#pIn');await p.waitForTimeout(800);
  ok(tag+' geo in sede (Bergamo)',await p.locator('td >> text=in sede').count()>0);
  const st=await p.evaluate(()=>JSON.stringify(window.__xcloud.state().punches));
  ok(tag+' no coords stored',!/latitude|longitude|45\.69/.test(st));
  await p.screenshot({path:`${OUT}/${tag}-timbrature.png`,fullPage:!mob});
  // annunci
  await p.goto(BASE+'#/annunci');await p.waitForSelector('#aFrom');await p.selectOption('#aFrom','Terni');await p.waitForTimeout(150);
  const t1=await p.textContent('#aInfo');ok(tag+' km filter Terni 50km -> 2 annunci',/^2 annunci/.test(t1));
  await p.fill('#aKm','500');await p.dispatchEvent('#aKm','input');const t2=await p.textContent('#aInfo');ok(tag+' km filter 500',/annunci entro 500/.test(t2));
  await p.fill('#nT','Operaio età massima 30 anni bella presenza');await p.dispatchEvent('#nT','input');ok(tag+' lint discrim',await p.locator('#nLint .note').count()===1);
  await p.fill('#nT','');await p.dispatchEvent('#nT','input');
  await p.selectOption('#aFrom','Milano');await p.fill('#aKm','100');await p.dispatchEvent('#aKm','input');
  await p.screenshot({path:`${OUT}/${tag}-annunci.png`,fullPage:!mob});
  // galleria
  await p.goto(BASE+'#/galleria');await p.waitForSelector('#gFile');
  await p.setInputFiles('#gFile','/workspace/xcloud/tests/cantiere.jpg');await p.waitForSelector('.gal figure',{timeout:8000});
  ok(tag+' gallery upload',await p.locator('.gal figure').count()>=1);
  await p.screenshot({path:`${OUT}/${tag}-galleria.png`,fullPage:!mob});
  // fatture
  await p.goto(BASE+'#/fatture');await p.waitForSelector('#iNew');await p.click('#iNew');await p.waitForSelector('#fXml');
  const [d]=await Promise.all([p.waitForEvent('download'),p.click('#fXml')]);const fp=`/workspace/xcloud/tests/${tag}-fattura.xml`;await d.saveAs(fp);
  ok(tag+' xml download '+d.suggestedFilename(),fs.readFileSync(fp,'utf8').includes('NON INVIATO A SDI'));
  await p.screenshot({path:`${OUT}/${tag}-fatture.png`,fullPage:!mob});
  await p.evaluate(()=>{window.print=()=>{};});await p.click('#fPdf');await p.emulateMedia({media:'print'});await p.waitForTimeout(200);
  if(!mob){await p.pdf({path:'/workspace/xcloud/tests/fattura-prova.pdf',format:'A4'});ok('pdf generated',fs.statSync('/workspace/xcloud/tests/fattura-prova.pdf').size>1000);}
  await p.emulateMedia({media:'screen'});
  // RBAC
  await p.goto(BASE+'#/fatture');await p.selectOption('#roleSel','dip');await p.waitForTimeout(150);ok(tag+' RBAC deny fatture',await p.locator('text=Accesso non consentito').count()>0);
  await p.selectOption('#roleSel','titolare');
  for(const v of ['comunicazioni','pagamenti','creator','legale','aziende','dati']){await p.goto(BASE+'#/'+v);await p.waitForTimeout(150);await p.screenshot({path:`${OUT}/${tag}-${v}.png`,fullPage:!mob});}
  ok(tag+' no js errors '+errs.join('|'),errs.filter(e=>!/fonts|favicon|ERR_/.test(e)).length===0);
  await ctx.close();
 }
 await b.close();
 const f=res.filter(r=>!r[1]).length;console.log(`\n${res.length-f}/${res.length} passed`);process.exit(f?1:0);
})();

(function(){
 var KEY='aria18',b=document.body,g=document.getElementById('gate');
 function ok(){try{return localStorage.getItem(KEY)==='1'}catch(e){return false}}
 if(!ok()){g.hidden=false;b.classList.add('locked');var y=document.getElementById('gate-yes');y.focus();
  y.addEventListener('click',function(){try{localStorage.setItem(KEY,'1')}catch(e){}g.hidden=true;b.classList.remove('locked')});}
 // filtro regione + ricerca
 var chips=[].slice.call(document.querySelectorAll('.chip')),rows=[].slice.call(document.querySelectorAll('#g-beach .row')),
 q=document.getElementById('q'),qn=document.getElementById('qn'),reg='';
 if(!q){return}
 var items=[].slice.call(document.querySelectorAll('#naturismo [data-q],#lifestyle [data-q]'));
 function apply(){var t=(q.value||'').toLowerCase().trim(),n=0;
  rows.forEach(function(r){var s=(!reg||r.dataset.reg===reg);r.classList.toggle('hide',!s)});
  items.forEach(function(el){var inReg=el.classList.contains('row')?(!reg||el.dataset.reg===reg):true;var m=!t||el.dataset.q.indexOf(t)>-1;el.classList.toggle('hide',!(inReg&&m));if(inReg&&m)n++});
  qn.textContent=t?(n+(n===1?' risultato':' risultati')):''}
 chips.forEach(function(c){c.addEventListener('click',function(){reg=c.dataset.r;chips.forEach(function(x){x.classList.toggle('on',x===c)});apply()})});
 q.addEventListener('input',apply);
 // ricerca località → link pubblici
 var f=document.getElementById('srch-trip'),out=document.getElementById('trip-out');
 f.addEventListener('submit',function(ev){ev.preventDefault();var p=document.getElementById('place').value.trim();if(!p)return;
  var bk='https://www.booking.com/searchresults.it.html?ss='+encodeURIComponent(p).replace(/%20/g,'+');
  var ab='https://www.airbnb.it/s/'+encodeURIComponent(p.replace(/\s+/g,'-'))+'/homes';
  var mp='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(p);
  out.textContent='';[['Alloggi · Booking.com',bk],['Alloggi · Airbnb',ab],['Mappa',mp]].forEach(function(x){var a=document.createElement('a');a.href=x[1];a.target='_blank';a.rel='noopener nofollow';a.textContent=x[0];out.appendChild(a)})});
})();

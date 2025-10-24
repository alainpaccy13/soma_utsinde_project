(function(){
  var state={};
  var startBtn=document.getElementById('startBtn');
  var quizEl=document.getElementById('quiz');
  var actionsEl=document.getElementById('actions');
  var submitBtn=document.getElementById('submitBtn');
  var retryBtn=document.getElementById('retryBtn');
  var resultEl=document.getElementById('result');
  var yearEl=document.getElementById('year');
  var reportEl=document.getElementById('report');
  var overallGaugeEl=document.getElementById('overallGauge');
  var eligibilityBadgeEl=document.getElementById('eligibilityBadge');
  var eligibilityTextEl=document.getElementById('eligibilityText');
  var summaryChartCanvas=document.getElementById('summaryChart');
  var userNameEl=document.getElementById('userName');
  var logoutBtnEl=document.getElementById('logoutBtn');
  var logoutLinkEl=document.getElementById('logoutLink');
  var accountEl=document.getElementById('account');
  var accountBtn=document.getElementById('accountBtn');
  var accountMenu=document.getElementById('accountMenu');
  var accountLogoutBtn=document.getElementById('accountLogoutBtn');

  // Footer year
  if(yearEl){ yearEl.textContent=new Date().getFullYear(); }

  function shuffle(arr){
    for(var i=arr.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));
      var t=arr[i];arr[i]=arr[j];arr[j]=t;
    }
    return arr;
  }

  function fetchJSON(url, opts){
    return fetch(url, opts).then(function(r){ return r.ok ? r.json() : Promise.reject(r); });
  }

  function initAuthUI(){
    var token=null; try{ token=localStorage.getItem('auth_token'); }catch(_){ }
    var loginLinks=document.querySelectorAll('a[href="login.html"]');
    if(!token){
      if(userNameEl) userNameEl.textContent='';
      if(logoutBtnEl) logoutBtnEl.style.display='none';
      if(logoutLinkEl) logoutLinkEl.style.display='none';
      loginLinks.forEach(function(a){ a.style.display=''; });
      return;
    }
    fetchJSON('/api/me', { headers:{ 'Authorization':'Bearer '+token }})
      .then(function(data){ if(data && data.user){ if(userNameEl){ userNameEl.textContent='Hi, '+data.user.name; } if(logoutBtnEl){ logoutBtnEl.style.display='inline-block'; } if(logoutLinkEl){ logoutLinkEl.style.display='inline'; } if(accountEl){ accountEl.style.display='inline-block'; } loginLinks.forEach(function(a){ a.style.display='none'; }); } })
      .catch(function(){ if(userNameEl) userNameEl.textContent=''; if(logoutBtnEl) logoutBtnEl.style.display='none'; if(logoutLinkEl) logoutLinkEl.style.display='none'; loginLinks.forEach(function(a){ a.style.display=''; }); });
    var doLogout=function(){ try{ localStorage.removeItem('auth_token'); }catch(_){ } window.location.href='index.html'; };
    if(logoutBtnEl){ logoutBtnEl.addEventListener('click', doLogout); }
    if(logoutLinkEl){ logoutLinkEl.addEventListener('click', function(e){ e.preventDefault(); doLogout(); }); }
    if(accountLogoutBtn){ accountLogoutBtn.addEventListener('click', doLogout); }
    if(accountBtn && accountMenu){
      accountBtn.addEventListener('click', function(){ var vis = accountMenu.style.display==='block'; accountMenu.style.display = vis? 'none':'block'; });
      document.addEventListener('click', function(e){ if(accountEl && !accountEl.contains(e.target)){ if(accountMenu) accountMenu.style.display='none'; } });
    }
  }

  function ensureAuthForQuiz(){
    if(quizEl){
      var token=null; try{ token=localStorage.getItem('auth_token'); }catch(_){ }
      if(!token){ window.location.href='login.html?next=quiz.html'; }
    }
  }

  // Normalize questions from either `questions` or `drivingTestQuestions`
  function normalizeBank(){
    var bank=[];
    var src = Array.isArray(window.questions) ? window.questions : (Array.isArray(window.drivingTestQuestions) ? window.drivingTestQuestions : []);
    for(var i=0;i<src.length;i++){
      var item=src[i];
      var qText=item.question || '';
      var opts=item.options || [];
      // Clean labels like "(a) ", "a) ", "A) " from options for display
      var cleanedOpts = opts.map(function(op){
        if(typeof op!== 'string') return op;
        return op.replace(/^\s*[\(\[]?[a-dA-D]\)?\s*/,'').trim();
      });
      var answerIndex = -1;
      if(typeof item.answer === 'number'){
        answerIndex = item.answer;
      } else if(typeof item.correctAnswer === 'string'){
        var letter = item.correctAnswer.trim().toLowerCase().replace(/[^a-d]/g,'');
        var map = {a:0,b:1,c:2,d:3};
        if(letter in map) answerIndex = map[letter];
      }
      bank.push({ question:qText, options: cleanedOpts, answer: answerIndex });
    }
    state.bank = bank;
  }

  function pickQuestions(){
    var n=Math.min(20, Array.isArray(state.bank)?state.bank.length:0);
    var indices=[]; for(var i=0;i<state.bank.length;i++) indices.push(i);
    shuffle(indices);
    indices=indices.slice(0,n);
    state.selection=indices.map(function(idx){return state.bank[idx];});
  }

  function render(){
    quizEl.innerHTML='';
    state.selection.forEach(function(q,qi){
      var card=document.createElement('fieldset');
      card.className='card';
      var legend=document.createElement('legend');
      legend.className='q';
      legend.textContent=(qi+1)+'. '+q.question;
      card.appendChild(legend);
      var opts=document.createElement('div');
      opts.className='options';
      q.options.forEach(function(opt,oi){
        var label=document.createElement('label');
        label.className='option';
        var input=document.createElement('input');
        input.type='radio';
        input.name='q'+qi;
        input.value=String(oi);
        var span=document.createElement('span');
        span.textContent=opt;
        label.appendChild(input);
        label.appendChild(span);
        opts.appendChild(label);
      });
      card.appendChild(opts);
      quizEl.appendChild(card);
    });
  }

  function score(){
    var correct=0;
    var total=state.selection.length;
    var nodes=quizEl.querySelectorAll('fieldset');
    state.selection.forEach(function(q,qi){
      var chosen=-1;
      var inputs=nodes[qi].querySelectorAll('input[type="radio"]');
      for(var i=0;i<inputs.length;i++) if(inputs[i].checked){chosen=parseInt(inputs[i].value,10);break;}
      var labels=nodes[qi].querySelectorAll('.option');
      for(var j=0;j<labels.length;j++) labels[j].classList.remove('correct','incorrect');
      if(chosen===q.answer){
        correct++;
        if(chosen>-1) labels[chosen].classList.add('correct');
      } else {
        if(chosen>-1) labels[chosen].classList.add('incorrect');
        if(q.answer>-1 && q.answer<labels.length) labels[q.answer].classList.add('correct');
      }
    });
    return {correct:correct,total:total};
  }

  function renderGauge(container, percent){
    if(!container) return;
    container.innerHTML='';
    var size=180; var stroke=14; var r=(size-stroke)/2; var c=2*Math.PI*r; var val=Math.max(0,Math.min(100,Math.round(percent)));
    var svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 '+size+' '+size);
    var bg=document.createElementNS('http://www.w3.org/2000/svg','circle');
    bg.setAttribute('cx', size/2); bg.setAttribute('cy', size/2); bg.setAttribute('r', r);
    bg.setAttribute('fill','none'); bg.setAttribute('stroke','#22314e'); bg.setAttribute('stroke-width', stroke);
    var fg=document.createElementNS('http://www.w3.org/2000/svg','circle');
    fg.setAttribute('cx', size/2); fg.setAttribute('cy', size/2); fg.setAttribute('r', r);
    fg.setAttribute('fill','none'); fg.setAttribute('stroke','#2563eb'); fg.setAttribute('stroke-width', stroke);
    fg.setAttribute('stroke-linecap','round'); fg.setAttribute('transform','rotate(-90 '+size/2+' '+size/2+')');
    fg.setAttribute('stroke-dasharray', c); fg.setAttribute('stroke-dashoffset', ((100-val)/100)*c);
    var text=document.createElementNS('http://www.w3.org/2000/svg','text');
    text.setAttribute('x', size/2); text.setAttribute('y', size/2+6); text.setAttribute('text-anchor','middle'); text.setAttribute('fill','#e6eaf2'); text.setAttribute('font-size','28'); text.setAttribute('font-weight','700');
    text.textContent=val+'%';
    svg.appendChild(bg); svg.appendChild(fg); svg.appendChild(text);
    container.appendChild(svg);
  }

  function renderReport(s){
    if(!reportEl) return;
    var pct=Math.round((s.correct/s.total)*100);
    if(overallGaugeEl) renderGauge(overallGaugeEl, pct);
    var ok=pct>=80;
    if(eligibilityBadgeEl){
      eligibilityBadgeEl.className='eligibility-badge '+(ok?'ok':'no');
      eligibilityBadgeEl.textContent=ok?'OK':'NO';
    }
    if(eligibilityTextEl){
      eligibilityTextEl.textContent=ok?'You are eligible to take the Provisional Exam.':'Keep practicing. Aim for at least 80% to be eligible for the Provisional Exam.';
    }
    if(summaryChartCanvas && window.Chart){
      if(state.summaryChart){ try{ state.summaryChart.destroy(); }catch(e){} }
      state.summaryChart=new Chart(summaryChartCanvas.getContext('2d'),{
        type:'doughnut',
        data:{
          labels:['Correct','Incorrect'],
          datasets:[{ data:[s.correct, s.total - s.correct], backgroundColor:['#22c55e','#ef4444'], borderColor:'#0f172a', borderWidth:2 }]
        },
        options:{
          plugins:{ legend:{ labels:{ color:'#e6eaf2' } } },
          cutout:'60%',
          animation:{ duration:700 }
        }
      });
    }
    reportEl.classList.remove('hidden');
  }

  function renderHistory(attempts){
    var canvas=document.getElementById('historyChart');
    if(!canvas || !window.Chart) return;
    var labels=attempts.map(function(a){ var d=new Date(a.ts); return (d.getMonth()+1)+'/'+d.getDate(); });
    var data=attempts.map(function(a){ return Math.round((a.correct/a.total)*100); });
    if(state.historyChart){ try{ state.historyChart.destroy(); }catch(e){} }
    state.historyChart=new Chart(canvas.getContext('2d'),{
      type:'line',
      data:{ labels:labels, datasets:[{ label:'% score', data:data, borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.2)', tension:.3 }] },
      options:{ scales:{ x:{ ticks:{ color:'#e6eaf2' } }, y:{ ticks:{ color:'#e6eaf2' }, suggestedMin:0, suggestedMax:100 } }, plugins:{ legend:{ labels:{ color:'#e6eaf2' } } } }
    });
  }

  function setDisabled(dis){
    var inputs=quizEl.querySelectorAll('input');
    for(var i=0;i<inputs.length;i++) inputs[i].disabled=dis;
    submitBtn.disabled=dis;
  }

  function start(){
    normalizeBank();
    if(!Array.isArray(state.bank)||state.bank.length===0){
      resultEl.classList.remove('hidden');
      resultEl.textContent='No questions available. Please add items in questions.js';
      return;
    }
    pickQuestions();
    render();
    document.getElementById('intro').classList.add('hidden');
    quizEl.classList.remove('hidden');
    actionsEl.classList.remove('hidden');
    resultEl.classList.add('hidden');
    resultEl.textContent='';
    if(reportEl) reportEl.classList.add('hidden');
    setDisabled(false);
  }

  function submit(){
    var s=score();
    setDisabled(true);
    resultEl.classList.remove('hidden');
    var pct=Math.round((s.correct/s.total)*100);
    resultEl.innerHTML='<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">'
      +'<div class="gauge" id="miniGauge"></div>'
      +'<div><div style="font-weight:700">Score: '+s.correct+' / '+s.total+'</div>'
      +'<div style="opacity:.9">'+pct+'%</div></div>'
      +'</div>';
    var mg=document.getElementById('miniGauge');
    if(mg) renderGauge(mg, pct);
    state.lastScore=s;
    renderReport(s);
    var token=null; try{ token=localStorage.getItem('auth_token'); }catch(_){ }
    if(token){
      fetch('/api/attempts',{ method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+token }, body: JSON.stringify({correct:s.correct,total:s.total,ts:Date.now()}) })
      .catch(function(){});
    }
  }

  function retry(){
    setDisabled(false);
    resultEl.classList.add('hidden');
    resultEl.textContent='';
    if(reportEl) reportEl.classList.add('hidden');
    if(state.summaryChart){ try{ state.summaryChart.destroy(); }catch(e){} state.summaryChart=null; }
    pickQuestions();
    render();
  }

  if(startBtn) startBtn.addEventListener('click', start);
  if(submitBtn) submitBtn.addEventListener('click', submit);
  if(retryBtn) retryBtn.addEventListener('click', retry);

  // Slideshow
  var slideImages=[
    'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=1200&auto=format&fit=crop', // car
    'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?q=80&w=1200&auto=format&fit=crop', // motorcycle
    'https://images.unsplash.com/photo-1511396274084-9a2b0e9b7d0e?q=80&w=1200&auto=format&fit=crop'  // driving road
  ];
  var slidesC=document.getElementById('slides');
  var dotsC=document.getElementById('dots');
  var prev=document.getElementById('prevSlide');
  var next=document.getElementById('nextSlide');
  var current=0; var timer=null; var INTERVAL=5000;

  function buildSlides(){
    if(!slidesC||!dotsC) return;
    slidesC.innerHTML='';
    dotsC.innerHTML='';
    for(var i=0;i<slideImages.length;i++){
      var s=document.createElement('div');
      s.className='slide'+(i===0?' active':'');
      s.style.backgroundImage='url('+slideImages[i]+')';
      var cap=document.createElement('div');
      cap.className='slide-caption';
      cap.textContent=i===0?"Car Theory Practice":i===1?"Motorcycle Theory Practice":"Soma Utsinde";
      s.appendChild(cap);
      slidesC.appendChild(s);
      var d=document.createElement('button');
      d.className='dot'+(i===0?' active':'');
      (function(idx){ d.addEventListener('click', function(){ goTo(idx); restart(); }); })(i);
      dotsC.appendChild(d);
    }
  }

  function sync(){
    var s=slidesC?slidesC.children:[];
    var d=dotsC?dotsC.children:[];
    for(var i=0;i<s.length;i++) s[i].classList.toggle('active', i===current);
    for(var j=0;j<d.length;j++) d[j].classList.toggle('active', j===current);
  }
  function goTo(i){ current=(i+slideImages.length)%slideImages.length; sync(); }
  function nextSlide(){ goTo(current+1); }
  function prevSlideFn(){ goTo(current-1); }
  function startAuto(){ if(timer) clearInterval(timer); timer=setInterval(nextSlide, INTERVAL); }
  function restart(){ startAuto(); }

  buildSlides();
  startAuto();
  if(next) next.addEventListener('click', function(){ nextSlide(); restart(); });
  if(prev) prev.addEventListener('click', function(){ prevSlideFn(); restart(); });

  function saveLastScore(s){
    try{ localStorage.setItem('lastScore', JSON.stringify(s)); }catch(e){}
  }

  var _origSubmit=submit;
  submit=function(){
    _origSubmit();
    if(state && state.lastScore){ saveLastScore({correct:state.lastScore.correct,total:state.lastScore.total,ts:Date.now()});
      var link=document.createElement('a'); link.href='report.html'; link.className='btn'; link.style.marginLeft='8px'; link.textContent='View Report';
      if(resultEl && !resultEl.querySelector('a[href="report.html"]')){ resultEl.appendChild(link); }
    }
  };

  function loadAndRenderReportIfPresent(){
    if(reportEl && !quizEl){
      var raw=null; try{ raw=localStorage.getItem('lastScore'); }catch(e){}
      var token=null; try{ token=localStorage.getItem('auth_token'); }catch(_){ }
      if(raw){ try{ var s=JSON.parse(raw); if(s && typeof s.correct==='number' && typeof s.total==='number'){ renderReport(s); } }catch(_){ } }
      if(token){
        function loadRange(range){
          fetchJSON('/api/attempts?range='+range, { headers:{ 'Authorization':'Bearer '+token }})
            .then(function(data){ if(data && Array.isArray(data.attempts)) renderHistory((range==='week'?data.attempts.reverse():data.attempts.reverse())); });
        }
        loadRange('week');
        var w=document.getElementById('histWeekly'); var a=document.getElementById('histAll');
        if(w&&a){
          w.addEventListener('click', function(){ w.classList.add('primary'); a.classList.remove('primary'); loadRange('week'); });
          a.addEventListener('click', function(){ a.classList.add('primary'); w.classList.remove('primary'); loadRange('all'); });
        }
        fetchJSON('/api/eligibility', { headers:{ 'Authorization':'Bearer '+token }})
          .then(function(info){ if(eligibilityTextEl && typeof info.average==='number'){ eligibilityTextEl.textContent = (info.eligible?'Eligible • ':'Not eligible • ')+ 'Avg last 7 days: '+info.average+'% over '+info.attempts+' attempts'; if(eligibilityBadgeEl){ eligibilityBadgeEl.className='eligibility-badge '+(info.eligible?'ok':'no'); eligibilityBadgeEl.textContent=info.eligible?'OK':'NO'; } } });
      } else if(!raw){
        var s0={correct:0,total:1}; renderReport(s0);
        if(eligibilityTextEl){ eligibilityTextEl.textContent='No recent score. Take the quiz to generate your report.'; }
        var link=document.createElement('a'); link.href='quiz.html'; link.className='btn primary'; link.style.marginTop='8px'; link.textContent='Take Quiz'; if(reportEl && !reportEl.querySelector('a[href="quiz.html"]')){ reportEl.appendChild(link); }
      }
    }
  }

  loadAndRenderReportIfPresent();
  initAuthUI();
  ensureAuthForQuiz();
})();

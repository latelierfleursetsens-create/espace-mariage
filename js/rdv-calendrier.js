// Le calendrier fait référence. Firestore contient une copie pour la fiche et les mails.
var rdvCurrent = null, rdvKnown = false, rdvSequence = 0, rdvMonths = 36;
function rdvConfigured(){return /^https:\/\//.test((window.RDV_CONFIG||{}).endpoint||'');}
function rdvParisToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
function rdvDateIndisponible(value){
  if(rdvCurrent && value===rdvCurrent.date)return false;
  var d=new Date(value+'T12:00:00Z');
  return !value||isNaN(d.getTime())||d.toISOString().slice(0,10)!==value||d.getUTCDay()!==1||d.getUTCDate()>7||value<rdvParisToday();
}
function rdvDates(){
  var today=rdvParisToday(), out=[], parts=today.split('-').map(Number);
  for(var n=0;n<rdvMonths;n++){
    var d=new Date(Date.UTC(parts[0],parts[1]-1+n,1,12));
    d.setUTCDate(1+(8-d.getUTCDay())%7);
    var value=d.toISOString().slice(0,10);if(value>=today)out.push(value);
  }
  if(rdvCurrent&&out.indexOf(rdvCurrent.date)<0)out.push(rdvCurrent.date);
  return out.sort();
}
function rdvFillDates(selected){
  var select=$('rdvDateSouhaitee');
  select.innerHTML='<option value="">Choisir un premier lundi</option>';
  rdvDates().forEach(function(value){var option=new Option(dateFR(value)+(rdvCurrent&&rdvCurrent.date===value?' — votre rendez-vous':''),value);select.add(option);});
  select.value=selected||'';
}
async function rdvApi(body){
  if(!rdvConfigured())throw new Error('La réservation en ligne n’est pas encore activée. Contactez Élodie pour un rendez-vous.');
  if(!current)throw new Error('Reconnectez-vous à votre espace.');
  var token=await current.getIdToken();
  var controller=new AbortController(), timer=setTimeout(function(){controller.abort();},50000);
  try{
    var response=await fetch(window.RDV_CONFIG.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({},body,{idToken:token})),signal:controller.signal,cache:'no-store'});
    var result=await response.json();
    if(!response.ok||!result.ok){var error=new Error(result.message||'Le calendrier est indisponible.');error.code=result.code;throw error;}
    return result;
  }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw new Error('Connexion au calendrier interrompue. Réessayez : votre éventuelle réservation sera retrouvée sans doublon.');throw e;}
  finally{clearTimeout(timer);}
}
function rdvApply(data,appointment){
  data.souhaiteRdvTelephonique=appointment?'oui':'non';
  data.rdvDateSouhaitee=appointment?appointment.date:'';
  data.rdvHeureSouhaitee=appointment?appointment.time:'';
  data.rdvCalendarEventId=appointment?appointment.id:'';
  data.rdvCalendarICalUID=appointment?appointment.iCalUID:'';
  data.rdvCalendarRevision=appointment?appointment.revision:'';
  data.rdvCalendarSynced=true;
}
async function rdvLoad(){
  rdvCurrent=null;rdvKnown=false;
  if(!rdvConfigured()){$('rdvStatus').textContent='La réservation en ligne sera bientôt disponible. Vous pouvez transmettre votre projet sans rendez-vous et contacter Élodie.';rdvFillDates('');return;}
  try{
    var result=await rdvApi({action:'status'});rdvCurrent=result.appointment;rdvKnown=true;rdvMonths=result.months||36;
    // Ne pas transformer une ancienne demande non synchronisée en réservation.
    if(rdvCurrent||project.rdvCalendarSynced)rdvApply(project,rdvCurrent);
    $('rdvStatus').textContent=rdvCurrent?'Votre rendez-vous actuel : '+dateFR(rdvCurrent.date)+(rdvCurrent.time?' à '+rdvCurrent.time:' — journée entière')+'.':(project.souhaiteRdvTelephonique==='oui'?'Votre ancien souhait de rendez-vous n’est pas une réservation synchronisée. Contactez Élodie s’il a déjà été confirmé, sinon choisissez un créneau libre.':'Aucun rendez-vous réservé pour le moment.');
  }catch(e){$('rdvStatus').textContent=e.message;}
  rdvFillDates(project.rdvDateSouhaitee||'');
}
async function updateRdvHours(dateValue,selected){
  var seq=++rdvSequence, select=$('rdvHeureSouhaitee'), dateInput=$('rdvDateSouhaitee');
  select.setCustomValidity('');dateInput.setCustomValidity('');
  select.innerHTML='<option value="">Chargement des disponibilités…</option>';
  if(!dateValue){select.innerHTML='<option value="">Choisissez d’abord une date</option>';return;}
  if(rdvDateIndisponible(dateValue)){dateInput.setCustomValidity('Choisissez un premier lundi du mois.');select.innerHTML='<option value="">Date indisponible</option>';return;}
  // Un RDV déplacé par Élodie hors des lundis reste consultable et conservable.
  var d=new Date(dateValue+'T12:00:00Z'), standard=d.getUTCDay()===1&&d.getUTCDate()<=7&&dateValue>=rdvParisToday();
  try{
    var result=standard?await rdvApi({action:'slots',date:dateValue}):{slots:[]};
    if(seq!==rdvSequence)return;
    var hours=result.slots.slice();
    if(rdvCurrent&&rdvCurrent.date===dateValue&&hours.indexOf(rdvCurrent.time)<0)hours.push(rdvCurrent.time);
    hours.sort();select.innerHTML='<option value="">Choisir une heure libre</option>';
    hours.forEach(function(hour){select.add(new Option((hour?hour.replace(':',' h '):'Journée entière')+(rdvCurrent&&rdvCurrent.date===dateValue&&rdvCurrent.time===hour?' — votre rendez-vous':''),hour||'all-day'));});
    select.value=selected||(rdvCurrent&&rdvCurrent.date===dateValue&&!rdvCurrent.time?'all-day':'');
    $('rdvHelp').textContent=hours.length?'Horaires de Paris. Le créneau est réservé uniquement après « Confirmer et envoyer ».':'Aucun créneau libre à cette date. Choisissez un autre premier lundi.';
    if(result.appointment&&rdvCurrent&&result.appointment.revision!==rdvCurrent.revision)$('rdvHelp').textContent='Votre rendez-vous a changé dans l’agenda. Cliquez sur « Actualiser mon rendez-vous ».';
  }catch(e){if(seq!==rdvSequence)return;select.innerHTML='<option value="">Disponibilités indisponibles</option>';select.setCustomValidity('Les disponibilités doivent être vérifiées avant réservation.');$('rdvHelp').textContent=e.message;}
}
function updateRdvVisibility(){
  var show=!!document.querySelector('[name=souhaiteRdvTelephonique][value="oui"]:checked');
  $('rdvDetails').classList.toggle('hidden',!show);
  $('rdvDateSouhaitee').required=show;$('rdvHeureSouhaitee').required=show;
  if(!show){++rdvSequence;$('rdvDateSouhaitee').setCustomValidity('');$('rdvHeureSouhaitee').setCustomValidity('');}
  $('rdvCancelNote').classList.toggle('hidden',show||!rdvCurrent);
}
async function rdvRefresh(){
  $('rdvRefresh').disabled=true;
  try{
    await rdvLoad();
    if(!rdvKnown)return;
    document.querySelectorAll('[name=souhaiteRdvTelephonique]').forEach(function(r){r.checked=r.value===(project.souhaiteRdvTelephonique||'');});
    updateRdvVisibility();await updateRdvHours($('rdvDateSouhaitee').value,project.rdvHeureSouhaitee||'');
    renderPlanning();renderDashboard();
  }finally{$('rdvRefresh').disabled=false;}
}
function initRdv(){
  document.querySelectorAll('[name=souhaiteRdvTelephonique]').forEach(function(r){r.addEventListener('change',updateRdvVisibility);});
  $('rdvDateSouhaitee').addEventListener('change',function(){updateRdvHours(this.value,'');});
  $('rdvRefresh').onclick=rdvRefresh;
  $('rdvAvailabilityRefresh').onclick=function(){updateRdvHours($('rdvDateSouhaitee').value,$('rdvHeureSouhaitee').value);};
  rdvFillDates('');
}
async function rdvCommit(data){
  var wants=data.souhaiteRdvTelephonique==='oui';
  if(!rdvConfigured()){
    if(wants||project.rdvCalendarEventId)throw new Error('La réservation en ligne n’est pas encore activée. Contactez Élodie.');
    return;
  }
  if(!rdvKnown)throw new Error('Cliquez sur « Actualiser mon rendez-vous » pour vérifier le calendrier avant d’envoyer votre fiche.');
  var hour=data.rdvHeureSouhaitee==='all-day'?'':data.rdvHeureSouhaitee;
  var intent=!wants?'cancel':(rdvCurrent&&data.rdvDateSouhaitee===rdvCurrent.date&&hour===rdvCurrent.time?'keep':'book');
  // Conserver le même identifiant et la même révision en cas de nouvelle tentative.
  if(!data._rdvOperation){Object.defineProperty(data,'_rdvOperation',{value:{id:crypto.randomUUID(),revision:rdvCurrent?rdvCurrent.revision:null,intent:intent},enumerable:false});}
  var op=data._rdvOperation;
  var result=await rdvApi({action:'commit',intent:op.intent,operationId:op.id,revision:op.revision,date:data.rdvDateSouhaitee,time:hour,details:{prenom:data.prenom,nom:data.nom,tel:data.tel,dateMariage:data.dateMariage}});
  rdvCurrent=result.appointment;rdvApply(data,rdvCurrent);
  $('rdvStatus').textContent=rdvCurrent?'Votre rendez-vous est enregistré : '+dateFR(rdvCurrent.date)+(rdvCurrent.time?' à '+rdvCurrent.time:' — journée entière')+'.':'Aucun rendez-vous réservé pour le moment.';
  updateRdvVisibility();
}

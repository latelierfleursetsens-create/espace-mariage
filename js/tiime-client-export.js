/* En-têtes et ordre repris du modèle CSV Tiime fourni le 27/09/2026. */
var TIIME_CLIENT_HEADERS=['Nom du client','Adresse','Code postal','Ville','Pays (le pays doit etre renseigne en Francais)','Numero TVA intracom','SIRET','Mail','Tel'];
var TIIME_POSTAL_COUNTRIES=['France','Belgique','Luxembourg','Suisse'];

function tiimePostalFieldsHtml(){
  return '<label>Ville de l’adresse postale *<input name="villePostale" autocomplete="address-level2" maxlength="120" required></label>'+
    '<label>Pays de l’adresse postale *<select name="paysPostal" autocomplete="country-name" required><option value="">Choisissez un pays</option>'+
    TIIME_POSTAL_COUNTRIES.map(function(country){return '<option value="'+country+'">'+country+'</option>';}).join('')+
    '<option value="autre">Autre pays</option></select></label>'+
    '<label class="hidden" id="paysPostalAutreBox">Nom du pays en français *<input name="paysPostalAutre" maxlength="80" placeholder="Ex. : Pays-Bas, Royaume-Uni" disabled></label>';
}
function selectedPostalCountry(){
  var form=document.getElementById('projectForm');
  return String(form.elements.paysPostal.value==='autre'?form.elements.paysPostalAutre.value:form.elements.paysPostal.value).trim();
}
function syncTiimePostalFields(){
  var form=document.getElementById('projectForm'),other=form.elements.paysPostal.value==='autre';
  var otherInput=form.elements.paysPostalAutre,city=form.elements.villePostale,postal=form.elements.codePostal;
  document.getElementById('paysPostalAutreBox').classList.toggle('hidden',!other);
  otherInput.disabled=!other;otherInput.required=other;
  otherInput.setCustomValidity(other&&otherInput.value&&!otherInput.value.trim()?'Renseignez le nom du pays en français.':'');
  city.setCustomValidity(city.value&&!city.value.trim()?'Renseignez la ville de votre adresse postale.':'');
  var country=selectedPostalCountry(),digits=country==='France'?5:['Belgique','Luxembourg','Suisse'].indexOf(country)>=0?4:0;
  postal.maxLength=digits||16;postal.setAttribute('inputmode',digits?'numeric':'text');
  postal.pattern=digits?'[0-9]{'+digits+'}':'[A-Za-z0-9][A-Za-z0-9 \\-]{0,15}';
  postal.title=digits?'Saisissez un code postal à '+digits+' chiffres':'Saisissez le code postal de votre adresse (lettres et chiffres acceptés).';
}
function restoreTiimePostalFields(data){
  var form=document.getElementById('projectForm'),country=String(data.paysPostal||'').trim();
  form.elements.paysPostal.value=TIIME_POSTAL_COUNTRIES.indexOf(country)>=0?country:country?'autre':'';
  form.elements.paysPostalAutre.value=country&&TIIME_POSTAL_COUNTRIES.indexOf(country)<0?country:'';
  // Ne pas déduire la ville postale du lieu du mariage, ni le pays d’un ancien dossier.
  form.elements.villePostale.value=data.villePostale||'';
  syncTiimePostalFields();
}
function initTiimePostalFields(){
  var form=document.getElementById('projectForm'),city=form.elements.ville;
  city.closest('label').insertAdjacentHTML('beforebegin',tiimePostalFieldsHtml());
  ['input','change'].forEach(function(type){form.addEventListener(type,function(event){
    if(event.target.matches('[name="paysPostal"],[name="paysPostalAutre"],[name="villePostale"]'))syncTiimePostalFields();
  });});
  syncTiimePostalFields();
}
function tiimeCsvCell(value){
  var text=String(value==null?'':value).replace(/\u0000/g,'').trim();
  return '"'+text.replace(/"/g,'""')+'"';
}
function tiimeClientCsvText(data){
  var values=[
    [data.prenom,data.nom].filter(Boolean).join(' ').replace(/\s+/g,' ').trim(),
    String(data.adressePostale||'').trim(),String(data.codePostal||'').trim(),
    String(data.villePostale||'').trim(),String(data.paysPostal||'').trim(),
    '', '', String(data.email||'').trim(),String(data.tel||'').trim()
  ];
  var required=[[0,'nom de la cliente'],[1,'adresse postale'],[2,'code postal'],[3,'ville de l’adresse postale'],[4,'pays de l’adresse postale']];
  var missing=required.filter(function(item){return !values[item[0]];}).map(function(item){return item[1];});
  if(missing.length)throw new Error('Informations à compléter : '+missing.join(', ')+'.');
  if(values[4]==='autre')throw new Error('Renseignez le nom du pays en français.');
  // Une valeur commençant par une formule n’est jamais transmise à un tableur.
  // Les numéros de téléphone internationaux ordinaires restent inchangés.
  values.forEach(function(value,index){
    if(/^[=+@-]/.test(value)&&!(index===8&&/^\+[0-9 ()\-.]+$/.test(value)))throw new Error('Valeur à vérifier dans la colonne « '+TIIME_CLIENT_HEADERS[index]+' ».');
  });
  // Même séparateur et mêmes en-têtes que le modèle. UTF-8, sans ligne sep= ajoutée.
  return TIIME_CLIENT_HEADERS.join(';')+'\r\n'+values.map(tiimeCsvCell).join(';')+'\r\n';
}
function buildTiimeClientCsvAttachment(data){
  var text=tiimeClientCsvText(data),bytes=new TextEncoder().encode(text),binary='';
  for(var i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
  var name=excelSafeName([data.prenom,data.nom].filter(Boolean).join(' ')).replace(/\s+/g,'_');
  return {name:'Client_Tiime_'+name+'.csv',content:btoa(binary)};
}
function tiimeClientEmailHtml(attachment,error){
  if(!attachment)return '<div style="margin-top:18px;padding:15px;border:1px solid #e7c89f;border-radius:12px;background:#fff8ee;"><strong>Import client Tiime non joint</strong><p style="line-height:1.6;">'+emailEsc(error||'Les coordonnées sont incomplètes.')+' Le récapitulatif Excel et les inspirations restent disponibles.</p></div>';
  return '<div style="margin-top:18px;padding:15px;border:1px solid #eaded8;border-radius:12px;background:#fffaf8;"><strong>Fichier client pour Tiime</strong>'+
    '<p style="line-height:1.6;">La pièce jointe <strong>'+emailEsc(attachment.name)+'</strong> contient les coordonnées de cette cliente, selon votre modèle Tiime.</p>'+
    '<p style="line-height:1.6;">Dans Tiime : <strong>Facturation → Clients → Importer mes clients</strong>, sélectionnez directement ce CSV. Vérifiez d’abord si la cliente existe déjà pour éviter de créer une fiche en double.</p></div>';
}

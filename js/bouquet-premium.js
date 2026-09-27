/* Choix explicite des fleurs pour chaque taille de bouquet de mariée. */
var standaloneLegacyPremium=false;

function isBridalBouquet(label){return /^Bouquet de mariée taille /.test(label||'');}
function bouquetRows(){return Array.from(document.querySelectorAll('[data-bouquet-row]'));}
function bouquetQuantity(row){return clampQuantity(row.querySelector('[data-qty-item]').value);}
function bouquetChoice(row){var input=row.querySelector('[data-bouquet-choice]:checked');return input?input.value:'';}
function bouquetFlowerQuantity(value){return Math.max(0,Math.min(30,Math.round(Number(value)||0)));}

function bouquetCustomizationHtml(label){
  if(!isBridalBouquet(label))return '';
  var key='bouquet-'+NEEDS_CATEGORIES[0].items.indexOf(label);
  var options=[
    ['avec','Oui, avec des fleurs premium','Je choisis les fleurs et leur quantité ci-dessous.'],
    ['sans','Non, sans fleurs premium','Je souhaite un bouquet sans rose, pivoine ni autre fleur premium.'],
    ['conseil','J’ai besoin des conseils d’Élodie','Je souhaite être guidée à partir de mes envies ou de mes photos d’inspiration.']
  ].map(function(item){return '<label class="bouquet-answer"><input type="radio" name="'+key+'-choix" value="'+item[0]+'" data-bouquet-choice required><span><strong>'+item[1]+'</strong><small>'+item[2]+'</small></span></label>';}).join('');
  var flowers=PREMIUM_FLOWERS.map(function(item,index){
    var id=key+'-fleur-'+index;
    return '<div class="bouquet-flower"><label for="'+id+'">'+esc(item.name)+'<small>'+esc(item.note)+'</small></label><div class="bouquet-flower-qty">'+
      '<button type="button" class="qty-btn" data-bouquet-minus aria-label="Retirer une fleur : '+esc(item.name)+'">−</button>'+
      '<input id="'+id+'" type="number" min="0" max="30" step="1" value="0" inputmode="numeric" data-bouquet-flower="'+esc(item.name)+'" aria-label="Quantité de '+esc(item.name)+' par bouquet">'+
      '<button type="button" class="qty-btn" data-bouquet-plus aria-label="Ajouter une fleur : '+esc(item.name)+'">+</button></div></div>';
  }).join('');
  return '<fieldset class="bouquet-customization hidden" data-bouquet-box disabled><legend>🌸 Choisissez les fleurs de ce bouquet *</legend>'+
    '<p class="bouquet-explanation"><strong>Vous souhaitez des roses, des pivoines ou de l’hortensia stabilisé ?</strong> Ce sont des fleurs premium : elles sont en supplément du prix de base du bouquet et doivent être demandées ici, même si elles figurent sur votre photo d’inspiration.</p>'+
    '<p class="bouquet-price">Roses et pivoines stabilisées de 6 cm : <strong>+6 € par fleur</strong>. Autres fleurs premium : <strong>sur devis</strong>.</p>'+
    '<div class="bouquet-answers">'+options+'</div>'+
    '<div class="bouquet-flower-details hidden" data-bouquet-details><h4>Quelles fleurs souhaitez-vous ajouter ?</h4>'+
      '<p data-bouquet-quantity-help>Indiquez la quantité de chaque fleur pour un bouquet.</p>'+
      '<div class="bouquet-flower-grid">'+flowers+'</div>'+
      '<label class="bouquet-other hidden" data-bouquet-other-box>Quelle autre fleur souhaitez-vous ? *<input data-bouquet-other type="text" maxlength="160" placeholder="Ex. : orchidée stabilisée"></label>'+
      '<p class="bouquet-supplement" data-bouquet-supplement aria-live="polite"></p></div>'+
    '<p class="bouquet-advice hidden" data-bouquet-advice>Votre demande de conseils sera transmise à Élodie. Ajoutez vos photos dans la rubrique « Inspirations » en bas de la fiche : la composition et le supplément éventuel seront précisés avec vous avant le devis.</p>'+
    '<p class="bouquet-status" data-bouquet-status aria-live="polite">Une réponse est nécessaire pour ce bouquet.</p></fieldset>';
}

function syncBouquetRow(row){
  if(!row)return;
  var qty=bouquetQuantity(row),active=qty>0,choice=bouquetChoice(row),withFlowers=active&&choice==='avec';
  var box=row.querySelector('[data-bouquet-box]');
  box.classList.toggle('hidden',!active);box.disabled=!active;
  row.querySelectorAll('[data-bouquet-choice]').forEach(function(input){input.required=active;});
  row.querySelector('[data-bouquet-details]').classList.toggle('hidden',!withFlowers);
  row.querySelector('[data-bouquet-advice]').classList.toggle('hidden',!(active&&choice==='conseil'));
  var total=0,rosePivoine=0,onQuote=false,otherQty=0;
  row.querySelectorAll('[data-bouquet-flower]').forEach(function(input){
    var n=bouquetFlowerQuantity(input.value),name=input.getAttribute('data-bouquet-flower');
    input.disabled=!withFlowers;input.setCustomValidity('');total+=n;
    if(name==='Rose'||name==='Pivoine')rosePivoine+=n;else if(n>0)onQuote=true;
    if(name==='Autre')otherQty=n;
    var flower=input.closest('.bouquet-flower');flower.classList.toggle('is-selected',withFlowers&&n>0);
    flower.querySelector('[data-bouquet-minus]').disabled=!withFlowers||n===0;
    flower.querySelector('[data-bouquet-plus]').disabled=!withFlowers||n===30;
  });
  var firstFlower=row.querySelector('[data-bouquet-flower]');
  if(withFlowers&&!total)firstFlower.setCustomValidity('Ajoutez au moins une fleur premium, ou choisissez « Sans fleurs premium » ou « J’ai besoin des conseils d’Élodie ».');
  var other=row.querySelector('[data-bouquet-other]'),otherActive=withFlowers&&otherQty>0;
  row.querySelector('[data-bouquet-other-box]').classList.toggle('hidden',!otherActive);
  other.disabled=!otherActive;other.required=otherActive;
  other.setCustomValidity(otherActive&&!other.value.trim()?'Précisez le nom de la fleur souhaitée.':'');
  row.querySelector('[data-bouquet-quantity-help]').textContent='Indiquez la quantité de chaque fleur pour un bouquet.'+(qty>1?' Cette composition sera appliquée aux '+qty+' bouquets de cette taille. Pour des compositions différentes, précisez votre souhait dans « Autres demandes ».':'');
  var supplement=rosePivoine?'Supplément roses et pivoines : '+euro(rosePivoine*6)+' par bouquet'+(qty>1?' (soit '+euro(rosePivoine*6*qty)+' pour '+qty+' bouquets)':'')+'.':'';
  if(onQuote)supplement+=(supplement?' ':'')+'Autres fleurs sélectionnées : supplément sur devis.';
  row.querySelector('[data-bouquet-supplement]').textContent=supplement;
  row.querySelector('[data-bouquet-supplement]').classList.toggle('hidden',!supplement);
  var incomplete=!choice||(choice==='avec'&&(!total||(otherActive&&!other.value.trim())));
  var status=!choice?'Une réponse est nécessaire pour ce bouquet.':choice==='sans'?'Votre choix : sans fleurs premium.':choice==='conseil'?'Votre choix : conseils d’Élodie demandés.':!total?'Ajoutez au moins une fleur ci-dessus.':otherActive&&!other.value.trim()?'Précisez le nom de l’autre fleur souhaitée.':'Sélection pour un bouquet : '+premiumFlowersText(Object.keys(bouquetRowData(row).fleursQuantites),other.value,bouquetRowData(row).fleursQuantites)+'.';
  row.querySelector('[data-bouquet-status]').textContent=status;
  row.classList.toggle('bouquet-incomplete',active&&incomplete);
  var legacy=document.getElementById('premiumFlowerSection');
  if(legacy)legacy.classList.toggle('hidden',!standaloneLegacyPremium||bouquetRows().some(function(item){return bouquetQuantity(item)>0;}));
}

function bouquetRowData(row){
  var choice=bouquetChoice(row),quantities={},other='';
  if(choice==='avec'){
    row.querySelectorAll('[data-bouquet-flower]').forEach(function(input){var n=bouquetFlowerQuantity(input.value);if(n>0)quantities[input.getAttribute('data-bouquet-flower')]=n;});
    if(quantities.Autre)other=row.querySelector('[data-bouquet-other]').value.trim();
  }
  return {choix:choice,fleursQuantites:quantities,autre:other};
}
function collectBouquetCustomizations(){
  var out={};bouquetRows().forEach(function(row){if(bouquetQuantity(row)>0)out[row.getAttribute('data-bouquet-row')]=bouquetRowData(row);});return out;
}
function bouquetComparable(configs){
  return Object.keys(configs).sort().reduce(function(out,label){
    var config=configs[label]||{},flowers=config.fleursQuantites||{};
    out[label]={choix:config.choix||'',autre:config.autre||'',fleursQuantites:Object.keys(flowers).sort().reduce(function(q,name){q[name]=Number(flowers[name])||0;return q;},{})};return out;
  },{});
}
function bouquetCompositionText(config){
  if(config.choix==='sans')return 'Sans fleurs premium';
  if(config.choix==='conseil')return 'Conseils d’Élodie demandés pour choisir les fleurs (composition et supplément à confirmer)';
  return premiumFlowersText(Object.keys(config.fleursQuantites||{}),config.autre,config.fleursQuantites)+' par bouquet';
}
function bouquetPremiumData(configs,quantities){
  var totals={},other=[],texts=[];
  Object.keys(configs).forEach(function(label){
    var config=configs[label],qty=Number(quantities[label])||1;
    texts.push(label+(qty>1?' × '+qty:'')+' : '+bouquetCompositionText(config));
    Object.keys(config.fleursQuantites).forEach(function(name){totals[name]=(totals[name]||0)+config.fleursQuantites[name]*qty;});
    if(config.autre)other.push(label+' : '+config.autre);
  });
  return {flowers:Object.keys(totals),quantities:totals,other:other.join(' ; '),text:texts.join('\n')};
}
function validateBouquetCustomizations(){
  var invalid=null;
  bouquetRows().forEach(function(row){
    syncBouquetRow(row);
    if(bouquetQuantity(row)>0&&!invalid)invalid=Array.from(row.querySelectorAll('[data-bouquet-box] input')).find(function(input){return input.willValidate&&!input.validity.valid;});
  });
  if(invalid){invalid.scrollIntoView({block:'center'});invalid.focus({preventScroll:true});invalid.reportValidity();return false;}return true;
}
function restoreBouquetCustomizations(data){
  var saved=data.bouquetsPersonnalises,hasSaved=!!saved&&typeof saved==='object'&&Object.keys(saved).length>0;
  var rows=bouquetRows(),selected=rows.filter(function(row){return bouquetQuantity(row)>0;});
  var oldFlowers=collectPremiumFlowerQuantities(),oldOther=String(data.fleursPremiumAutre||data.premiumFleursAutre||'');
  var legacyText=data.fleursAimees||premiumFlowersText(Object.keys(oldFlowers),oldOther,oldFlowers);
  var hasLegacy=!hasSaved&&(Object.keys(oldFlowers).length>0||!!legacyText);
  var structuredLegacy=!!data.fleursPremiumQuantites||Array.isArray(data.fleursPremium)||Array.isArray(data.premiumFleurs);
  var canInherit=hasLegacy&&structuredLegacy&&selected.length===1&&bouquetQuantity(selected[0])===1&&Object.keys(oldFlowers).length>0;
  standaloneLegacyPremium=hasLegacy&&selected.length===0;
  var reference=document.getElementById('bouquetLegacyReference');
  if(reference)reference.remove();
  rows.forEach(function(row){
    var label=row.getAttribute('data-bouquet-row'),config=hasSaved?saved[label]:null;
    // Only a single bouquet can inherit global quantities without guessing a distribution.
    if(!config&&canInherit&&bouquetQuantity(row)===1){config={choix:'avec',fleursQuantites:oldFlowers,autre:oldOther||document.querySelector('[name="premiumFleursAutre"]').value};}
    config=config||{};
    row.querySelectorAll('[data-bouquet-choice]').forEach(function(input){input.checked=input.value===config.choix;});
    row.querySelectorAll('[data-bouquet-flower]').forEach(function(input){input.value=String(bouquetFlowerQuantity((config.fleursQuantites||{})[input.getAttribute('data-bouquet-flower')]));});
    row.querySelector('[data-bouquet-other]').value=config.autre||'';
    syncBouquetRow(row);
  });
  if(hasLegacy&&!canInherit){
    reference=document.createElement('div');reference.id='bouquetLegacyReference';reference.className='bouquet-legacy-reference';
    var title=document.createElement('strong');title.textContent='Vos fleurs précédemment demandées';
    var detail=document.createElement('p');detail.textContent=legacyText;
    var help=document.createElement('p');help.textContent='Si vous sélectionnez des bouquets de mariée, précisez les fleurs pour chacun dans les encadrés ci-dessous. Ces anciens choix ne sont pas ajoutés automatiquement à chaque bouquet.';
    reference.append(title,detail,help);rows[0].before(reference);
  }
}
function initBouquetCustomizations(){
  var choices=document.getElementById('choices');
  choices.addEventListener('click',function(event){
    var button=event.target.closest('[data-bouquet-plus],[data-bouquet-minus]');if(!button)return;
    var input=button.closest('.bouquet-flower').querySelector('[data-bouquet-flower]');
    input.value=String(bouquetFlowerQuantity(bouquetFlowerQuantity(input.value)+(button.hasAttribute('data-bouquet-plus')?1:-1)));
    syncBouquetRow(button.closest('[data-bouquet-row]'));
  });
  ['input','change'].forEach(function(type){choices.addEventListener(type,function(event){
    var row=event.target.closest('[data-bouquet-row]');if(!row)return;
    if(event.target.matches('[data-bouquet-flower]'))event.target.value=String(bouquetFlowerQuantity(event.target.value));
    if(event.target.matches('[data-bouquet-choice],[data-bouquet-flower],[data-bouquet-other]'))syncBouquetRow(row);
  });});
  bouquetRows().forEach(syncBouquetRow);
}

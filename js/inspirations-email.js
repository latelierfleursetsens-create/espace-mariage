/* Copies des inspirations pour le mail administratrice ; les originaux sont conservés. */
var INSPIRATION_EMAIL_LIMITS={perImage:1200*1024,total:9*1024*1024,download:20*1024*1024,timeout:12000};

function inspirationSafeUrl(value){
  try{var url=new URL(String(value||''));return url.protocol==='https:'&&!url.username&&!url.password?url.href:'';}catch(_){return '';}
}
function inspirationBytes(blob){
  return new Promise(function(resolve,reject){
    var reader=new FileReader();reader.onerror=function(){reject(new Error('Lecture du fichier impossible.'));};
    reader.onload=function(){resolve(new Uint8Array(reader.result));};reader.readAsArrayBuffer(blob);
  });
}
function inspirationBase64(blob){
  return new Promise(function(resolve,reject){
    var reader=new FileReader();reader.onerror=function(){reject(new Error('Lecture du fichier impossible.'));};
    reader.onload=function(){resolve(String(reader.result).split(',')[1]||'');};reader.readAsDataURL(blob);
  });
}
function inspirationMime(bytes,blob,photo){
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
  if(bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71)return 'image/png';
  if(bytes[0]===71&&bytes[1]===73&&bytes[2]===70)return 'image/gif';
  if(bytes[0]===82&&bytes[1]===73&&bytes[8]===87&&bytes[9]===69)return 'image/webp';
  if(bytes[0]===73&&bytes[1]===73&&bytes[2]===42||bytes[0]===77&&bytes[1]===77&&bytes[3]===42)return 'image/tiff';
  if(bytes[0]===66&&bytes[1]===77)return 'image/bmp';
  var type=String(blob.type||'').split(';')[0].toLowerCase();
  if(type.indexOf('image/')===0)return type;
  if(type&&type!=='application/octet-stream')return '';
  var stored=String(photo.mime||'').toLowerCase();if(stored.indexOf('image/')===0)return stored;
  var name=String(photo.storedName||photo.path||photo.storagePath||photo.name||'').toLowerCase();
  var extension=(name.match(/\.([a-z0-9]+)$/)||[])[1];
  return {jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',webp:'image/webp',heic:'image/heic',heif:'image/heif',tif:'image/tiff',tiff:'image/tiff',bmp:'image/bmp'}[extension]||'';
}
function inspirationJpeg(blob){
  return new Promise(function(resolve,reject){
    var url=URL.createObjectURL(blob),img=new Image(),done=false;
    var timeout=setTimeout(function(){finish(new Error('Préparation de la photo trop longue.'));},8000);
    function finish(error,result){if(done)return;done=true;clearTimeout(timeout);URL.revokeObjectURL(url);if(error)reject(error);else resolve(result);}
    img.onerror=function(){finish(new Error('Conversion en JPEG indisponible pour ce format.'));};
    img.onload=function(){
      if(done)return;
      try{
        var width=img.naturalWidth||img.width,height=img.naturalHeight||img.height;
        if(!width||!height)throw new Error('Dimensions de la photo invalides.');
        var canvas=document.createElement('canvas'),scale=Math.min(1,1800/Math.max(width,height));
        canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
        var context=canvas.getContext('2d');if(!context)throw new Error('Conversion de photo indisponible.');
        context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
        var qualities=[0.86,0.74,0.6];
        function encode(index){
          if(done)return;
          canvas.toBlob(function(result){
            if(!result||!result.size)return finish(new Error('La photo n’a pas pu être préparée.'));
            if(result.size<=INSPIRATION_EMAIL_LIMITS.perImage)return finish(null,result);
            if(index+1<qualities.length)return encode(index+1);
            finish(new Error('La photo reste trop volumineuse.'));
          },'image/jpeg',qualities[index]);
        }
        encode(0);
      }catch(error){finish(error);}
    };
    img.src=url;
  });
}
// ZIP standard sans compression, utilisé pour préserver un HEIC non convertible.
function inspirationZip(bytes,filename){
  var name=new TextEncoder().encode(filename),crc=0xffffffff;
  for(var i=0;i<bytes.length;i++){crc^=bytes[i];for(var bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  crc=(crc^0xffffffff)>>>0;
  var localSize=30+name.length,centralSize=46+name.length,offset=localSize+bytes.length;
  var out=new Uint8Array(offset+centralSize+22),view=new DataView(out.buffer);
  function u16(at,value){view.setUint16(at,value,true);}function u32(at,value){view.setUint32(at,value,true);}
  u32(0,0x04034b50);u16(4,20);u16(6,0x800);u16(12,33);u32(14,crc);u32(18,bytes.length);u32(22,bytes.length);u16(26,name.length);out.set(name,30);out.set(bytes,localSize);
  u32(offset,0x02014b50);u16(offset+4,20);u16(offset+6,20);u16(offset+8,0x800);u16(offset+14,33);u32(offset+16,crc);u32(offset+20,bytes.length);u32(offset+24,bytes.length);u16(offset+28,name.length);out.set(name,offset+46);
  var end=offset+centralSize;u32(end,0x06054b50);u16(end+8,1);u16(end+10,1);u32(end+12,centralSize);u32(end+16,offset);
  return new Blob([out],{type:'application/zip'});
}
async function downloadInspiration(url){
  var controller=new AbortController(),timeout=setTimeout(function(){controller.abort();},INSPIRATION_EMAIL_LIMITS.timeout);
  try{
    var response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error('Photo inaccessible au moment de l’envoi.');
    if(Number(response.headers.get('content-length'))>INSPIRATION_EMAIL_LIMITS.download)throw new Error('Fichier trop volumineux pour l’e-mail.');
    var blob=await response.blob();
    if(!blob.size)throw new Error('Photo vide.');
    if(blob.size>INSPIRATION_EMAIL_LIMITS.download)throw new Error('Fichier trop volumineux pour l’e-mail.');
    return blob;
  }finally{clearTimeout(timeout);}
}
async function buildInspirationEmailAttachments(data){
  var photos=Array.isArray(data.photos)?data.photos:[],result={attachments:[],photos:[],bytes:0};
  var client=excelSafeName([data.prenom,data.nom].filter(Boolean).join(' ')).replace(/\s+/g,'_');
  for(var index=0;index<photos.length;index++){
    var photo=photos[index]||{},url=inspirationSafeUrl(photo.url||photo.downloadURL),entry={label:'Inspiration '+(index+1),originalName:photo.name||'',url:url,attached:false};
    result.photos.push(entry);
    try{
      if(!url&&(photo.path||photo.storagePath)){url=inspirationSafeUrl(await storage.ref(photo.path||photo.storagePath).getDownloadURL());entry.url=url;}
      if(!url)throw new Error('Lien de la photo indisponible.');
      var blob=await downloadInspiration(url),signature=await inspirationBytes(blob.slice(0,32)),mime=inspirationMime(signature,blob,photo);
      if(!mime)throw new Error('Format de photo non reconnu.');
      var extensions={'image/jpeg':'jpg','image/png':'png','image/gif':'gif','image/bmp':'bmp','image/tiff':'tif'};
      var extension=extensions[mime],attachmentBlob=blob;
      if(!extension||blob.size>INSPIRATION_EMAIL_LIMITS.perImage){
        try{attachmentBlob=await inspirationJpeg(blob);extension='jpg';}
        catch(_){
          if(!extension){
            var originalExtension={'image/heic':'heic','image/heif':'heif','image/webp':'webp','image/avif':'avif'}[mime];
            if(!originalExtension)throw new Error('Ce format ne peut pas être joint à l’e-mail.');
            if(blob.size+result.bytes>INSPIRATION_EMAIL_LIMITS.total)throw new Error('Photo trop volumineuse pour les pièces jointes.');
            attachmentBlob=inspirationZip(await inspirationBytes(blob),'Inspiration_'+(index+1)+'.'+originalExtension);extension='zip';
          }
        }
      }
      if(attachmentBlob.size+result.bytes>INSPIRATION_EMAIL_LIMITS.total)throw new Error('Poids total des pièces jointes atteint.');
      var name='Inspiration_'+String(index+1).padStart(2,'0')+'_'+client+'.'+extension;
      var content=await inspirationBase64(attachmentBlob);if(!content)throw new Error('Photo vide après préparation.');
      result.attachments.push({name:name,content:content});result.bytes+=attachmentBlob.size;
      entry.attached=true;entry.attachmentName=name;entry.archived=extension==='zip';
    }catch(error){entry.reason=error&&error.name==='AbortError'?'Téléchargement de la photo trop long.':String(error&&error.message||'Photo indisponible au moment de l’envoi.');}
  }
  return result;
}
function inspirationEmailHtml(result){
  if(!result.photos.length)return '<div style="margin-top:18px;color:#806f75;">Aucune photo d’inspiration fournie.</div>';
  var attached=result.attachments.length,missing=result.photos.length-attached;
  return '<div style="border:1px solid #eaded8;border-radius:14px;padding:18px 20px;margin-top:18px;">'+
    '<h3 style="margin:0 0 12px;color:#6f2638;">📷 Photos d’inspiration</h3>'+
    '<p style="line-height:1.6;">'+attached+' photo(s) préparée(s) en pièces jointes. Les liens ci-dessous permettent aussi de retrouver les originaux.</p>'+
    (missing?'<p style="color:#8a3d20;font-weight:700;">'+missing+' photo(s) n’ont pas pu être jointes. Consultez leurs liens ci-dessous ou la fiche cliente.</p>':'')+
    '<ul style="padding-left:20px;line-height:1.7;">'+result.photos.map(function(photo){return '<li><strong>'+emailEsc(photo.label)+'</strong>'+ (photo.originalName?' — '+emailEsc(photo.originalName):'')+'<br>'+
      (photo.attached?'Pièce jointe : '+emailEsc(photo.attachmentName)+(photo.archived?' (photo originale dans un ZIP)':''):'Non jointe : '+emailEsc(photo.reason))+
      (photo.url?' — <a href="'+emailEsc(photo.url)+'" style="color:#6f2638;">Ouvrir l’original</a>':'')+'</li>';}).join('')+'</ul></div>';
}

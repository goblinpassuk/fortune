/* Fortune Teller Designer — offline, framework-free, SVG-first application. */
(() => {
  'use strict';

  const DEFAULT_NUMBERS = ['1','2','3','4','5','6','7','8'];
  const CORNER_NAMES = ['Top left','Top right','Bottom right','Bottom left'];
  const AUTO_COLORS = ['#45b95f','#2ca7c9','#ef5261','#ee8a2e','#7450d8','#b54db2','#f5ad27','#168765'];
  const CUSTOM_THEME_KEY = 'fortune-teller-custom-themes';
  const DEFAULT_ROTATIONS = [-90,90,0,180,90,-90,180,0];
  const THEMES = {
    'Classic Hearts': {
      accent:'#45b95f', font:"'Comic Sans MS', 'Comic Sans', cursive", icons:['♥','♥','♥','♥'], colors:['#45b95f','#ef5261','#7450d8','#f5ad27'],
      fortunes:['Squint only one of your eyes.','Give your mum or dad three kisses.','Sing a song for four minutes.','Go down the slide three times.','Go and find six rocks.','Jump seven times.','Slap your knee eight times.','Take two hands and give yourself a hug.']
    }
  };

  const $ = id => document.getElementById(id);
  const elements = {};
  let state;
  let toastTimer;
  let previewZoom=null;

  function freshState(themeName='Classic Hearts') {
    const t=THEMES[themeName];
    const numberColors=t.numberColors?[...t.numberColors]:t.colors.flatMap(color=>[color,color]);
    const savedIcons=t.savedIcons?t.savedIcons.map(icon=>({...icon})):t.icons.map(value=>({type:themeName==='Classic Hearts'?'text':'emoji',value,data:''}));
    const fortuneStyles=(t.fortuneStyles||DEFAULT_ROTATIONS.map(angle=>({angle,size:'auto',bold:true,italic:false}))).map(style=>({...style}));
    return {version:4,name:`${themeName} Fortune Teller`,theme:themeName,numbers:[...DEFAULT_NUMBERS],fortunes:[...t.fortunes],fortuneStyles,icons:savedIcons,numberColors,accent:t.accent,font:t.font,showNumbers:t.showNumbers??true,foldLines:t.foldLines??true,cutLine:true};
  }
  function escapeXML(value) { return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c])); }
  function safeName(ext) { const base=(state.name||'fortune-teller').trim().replace(/[<>:"/\\|?*\x00-\x1F]/g,'').replace(/\s+/g,'-').slice(0,60)||'fortune-teller';return `${base}.${ext}`; }
  function wrapText(text,maxChars,maxLines) {
    const words=String(text).trim().split(/\s+/).filter(Boolean),lines=[];let line='',used=0;
    for(const word of words){const candidate=(line+' '+word).trim();if(candidate.length<=maxChars||!line)line=candidate;else{lines.push(line);line=word;if(lines.length===maxLines-1)break;}}
    if(line&&lines.length<maxLines)lines.push(line);used=lines.join(' ').split(/\s+/).filter(Boolean).length;
    if(used<words.length&&lines.length)lines[lines.length-1]=lines[lines.length-1].replace(/[.…]*$/,'')+'…';return lines.length?lines:[''];
  }
  function fittedFortune(text,x,y,color,index) {
    // Fit into a conservative 31 × 25 mm box centred inside the triangular panel.
    // Try large type first, reducing only when wrapping would exceed five lines.
    const style=state.fortuneStyles[index]||{angle:0,size:'auto',bold:true,italic:false},source=String(text).trim();let size=style.size==='auto'?5.1:Number(style.size),lines=[];
    if(style.size==='auto')while(size>=2.35){const maxChars=Math.max(9,Math.floor(31/(size*.58))),maxLines=Math.max(4,Math.floor(25/(size*1.12)));lines=wrapText(source,maxChars,maxLines);if(!lines.some(line=>line.endsWith('…'))&&lines.length*size*1.12<=25)break;size-=.2;}
    size=Math.max(2.35,Math.round(size*100)/100);const maxChars=Math.max(9,Math.floor(31/(size*.58))),maxLines=Math.max(4,Math.floor(25/(size*1.12)));lines=wrapText(source,maxChars,maxLines);const lh=size*1.12;
    const tspans=lines.map((line,i)=>`<tspan x="${x}" dy="${i?lh:0}">${escapeXML(line)}</tspan>`).join('');
    const weight=style.bold?800:400,italic=style.italic?'italic':'normal';
    return `<text class="svg-edit" data-edit="fortune" data-index="${index}" x="${x}" y="${y-((lines.length-1)*lh/2)}" text-anchor="middle" dominant-baseline="middle" font-size="${size}" font-weight="${weight}" font-style="${italic}" fill="${color}" transform="rotate(${Number(style.angle)||0} ${x} ${y})">${tspans}</text>`;
  }
  function iconMarkup(icon,x,y,index) {
    if(icon.type==='image'||icon.type==='svg') return `<image class="svg-edit" data-edit="icon" data-index="${index}" href="${escapeXML(icon.data)}" x="${x-13}" y="${y-13}" width="26" height="26" preserveAspectRatio="xMidYMid meet"/>`;
    const size=icon.type==='emoji'?17:(String(icon.value).length<=2?20:7);
    return `<text class="svg-edit" data-edit="icon" data-index="${index}" x="${x}" y="${y+.5}" text-anchor="middle" dominant-baseline="middle" font-size="${size}" font-weight="800" fill="${state.numberColors[index*2]}">${escapeXML(icon.value||'❤')}</text>`;
  }

  function buildSVG() {
    // 180 mm square on A4: 15 mm side margins, vertically centred.
    const L=15,R=195,T=58.5,B=238.5,CX=105,CY=148.5,Q1=60,Q2=150,Y1=103.5,Y2=193.5;
    const fortunePanels=[
      {p:`${Q1},${Y1} ${CX},${T} ${CX},${CY}`,x:90,y:103.5,r:-90,q:0}, {p:`${CX},${T} ${Q2},${Y1} ${CX},${CY}`,x:120,y:103.5,r:90,q:1},
      {p:`${Q2},${Y1} ${R},${CY} ${CX},${CY}`,x:150,y:133.5,r:0,q:1}, {p:`${R},${CY} ${Q2},${Y2} ${CX},${CY}`,x:150,y:163.5,r:180,q:2},
      {p:`${Q2},${Y2} ${CX},${B} ${CX},${CY}`,x:120,y:193.5,r:90,q:2}, {p:`${CX},${B} ${Q1},${Y2} ${CX},${CY}`,x:84,y:193.5,r:180,q:3},
      {p:`${Q1},${Y2} ${L},${CY} ${CX},${CY}`,x:60,y:163.5,r:180,q:3}, {p:`${L},${CY} ${Q1},${Y1} ${CX},${CY}`,x:60,y:133.5,r:0,q:0}
    ];
    // The coloured choice triangles sit outside the white fortune diamond.
    const colorPanels=[
      {p:`${Q1},${T} ${CX},${T} ${Q1},${Y1}`,q:0}, {p:`${CX},${T} ${Q2},${T} ${Q2},${Y1}`,q:1},
      {p:`${Q2},${Y1} ${R},${Y1} ${R},${CY}`,q:1}, {p:`${R},${CY} ${R},${Y2} ${Q2},${Y2}`,q:2},
      {p:`${Q2},${Y2} ${Q2},${B} ${CX},${B}`,q:2}, {p:`${CX},${B} ${Q1},${B} ${Q1},${Y2}`,q:3},
      {p:`${Q1},${Y2} ${L},${Y2} ${L},${CY}`,q:3}, {p:`${L},${CY} ${L},${Y1} ${Q1},${Y1}`,q:0}
    ];
    const numberPoints=[[78,70,0],[132,70,0],[184,126,90],[184,171,90],[132,227,0],[78,227,0],[26,171,90],[26,126,90]];
    const iconPoints=[[37.5,81,0],[172.5,81,1],[172.5,216,2],[37.5,216,3]];
    return `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297" role="img" aria-label="Printable traditional paper fortune teller">
      <rect width="210" height="297" fill="#fff"/>
      <g font-family="${escapeXML(state.font)}">
        ${colorPanels.map((o,i)=>`<polygon class="svg-edit" data-edit="color" data-index="${i}" points="${o.p}" fill="${state.numberColors[i]}" stroke="#222" stroke-width=".42"/>`).join('')}
        ${fortunePanels.map(o=>`<polygon points="${o.p}" fill="#fff" stroke="none"/>`).join('')}
        <path d="M105 58.5L60 103.5L15 148.5L60 193.5L105 238.5L150 193.5L195 148.5L150 103.5Z" fill="none" stroke="#222" stroke-width=".72"/>
        ${state.foldLines?`<g fill="none" stroke="#777" stroke-width=".42"><path d="M105 58.5V238.5M15 148.5H195"/><path d="M60 103.5L105 148.5L150 103.5M150 193.5L105 148.5L60 193.5"/></g>`:''}
        ${state.cutLine?`<rect x="15" y="58.5" width="180" height="180" fill="none" stroke="#111" stroke-width=".8"/>`:''}
        ${iconPoints.map(p=>iconMarkup(state.icons[p[2]],p[0],p[1],p[2])).join('')}
        ${state.showNumbers?numberPoints.map((p,i)=>`<text class="svg-edit" data-edit="number" data-index="${i}" x="${p[0]}" y="${p[1]}" text-anchor="middle" dominant-baseline="middle" font-size="4.2" font-weight="800" fill="#fff" fill-opacity=".9" transform="rotate(${p[2]} ${p[0]} ${p[1]})">${escapeXML(state.numbers[i])}</text>`).join(''):''}
        ${fortunePanels.map((o,i)=>fittedFortune(state.fortunes[i],o.x,o.y,'#222',i)).join('')}
        <text x="105" y="22" text-anchor="middle" font-size="7" font-weight="800" fill="#222">${escapeXML(state.name)}</text>
        <text x="105" y="30" text-anchor="middle" font-size="3.4" fill="#555">CUT OUT · FOLD EACH CORNER TO THE CENTRE · TURN OVER · REPEAT · FOLD IN HALF</text>
        <text x="195" y="276" text-anchor="end" font-size="3" fill="#666">A4 · Print at 100% / actual size</text>
      </g>
      <style>.svg-edit{cursor:pointer}.svg-edit:hover{filter:brightness(.88);stroke-width:.8}</style>
    </svg>`;
  }

  function render(){
    const pageY=window.scrollY,editorY=document.querySelector('.editor-panel')?.scrollTop??0;
    const svg=buildSVG();elements.preview.innerHTML=svg;if(elements.printDesign)elements.printDesign.innerHTML=svg;
    window.scrollTo({top:pageY,left:0,behavior:'auto'});
    const editor=document.querySelector('.editor-panel');if(editor)editor.scrollTop=editorY;
  }
  function makeEditors(){
    elements.outside.innerHTML=CORNER_NAMES.map((name,i)=>`<div class="corner-editor" data-corner="${i}"><strong>${name}</strong><div class="corner-editor-row"><select class="icon-type" data-index="${i}" aria-label="${name} icon type"><option value="emoji">Emoji</option><option value="text">Text</option><option value="image">Image</option><option value="svg">SVG icon</option></select><input class="icon-value" data-index="${i}" type="text" maxlength="12" aria-label="${name} icon value"></div><input class="icon-file" data-index="${i}" type="file" accept="image/*,.svg,image/svg+xml" hidden></div>`).join('');
    elements.colors.innerHTML=Array.from({length:8},(_,i)=>`<label>No. ${i+1}<input type="color" data-index="${i}"></label>`).join('');
    elements.numbers.innerHTML=Array.from({length:8},(_,i)=>`<label>${i+1}<input type="text" inputmode="numeric" maxlength="4" data-index="${i}"></label>`).join('');
    const angles=[-180,-90,0,90,180],sizes=['auto',3,3.5,4,4.5,5,5.5,6,7];
    elements.fortunes.innerHTML=Array.from({length:8},(_,i)=>`<div class="fortune-item"><span class="fortune-index">${i+1}</span><div class="fortune-content"><textarea maxlength="120" data-index="${i}" aria-label="Fortune ${i+1}"></textarea><div class="fortune-options"><select class="fortune-angle" data-index="${i}" aria-label="Fortune ${i+1} angle">${angles.map(a=>`<option value="${a}">${a}°</option>`).join('')}</select><select class="fortune-size" data-index="${i}" aria-label="Fortune ${i+1} font size">${sizes.map(s=>`<option value="${s}">${s==='auto'?'Auto size':s+' mm'}</option>`).join('')}</select><label class="mini-check" title="Bold"><input class="fortune-bold" data-index="${i}" type="checkbox"><b>B</b></label><label class="mini-check" title="Italic"><input class="fortune-italic" data-index="${i}" type="checkbox"><i>I</i></label></div></div></div>`).join('');
  }
  function populateEditors(){
    elements.projectName.value=state.name;elements.theme.value=state.theme;elements.accent.value=state.accent;elements.font.value=state.font;elements.showNumbers.checked=state.showNumbers!==false;elements.fold.checked=state.foldLines;elements.cut.checked=state.cutLine;
    [...elements.outside.querySelectorAll('.corner-editor')].forEach((box,i)=>{const icon=state.icons[i];box.querySelector('.icon-type').value=icon.type;const input=box.querySelector('.icon-value'),file=box.querySelector('.icon-file');input.value=icon.value||'';input.hidden=icon.type==='image'||icon.type==='svg';file.hidden=!input.hidden;file.accept=icon.type==='svg'?'.svg,image/svg+xml':'image/*';});
    [...elements.colors.querySelectorAll('input')].forEach((el,i)=>el.value=state.numberColors[i]);
    [...elements.numbers.querySelectorAll('input')].forEach((el,i)=>el.value=state.numbers[i]);
    [...elements.fortunes.querySelectorAll('textarea')].forEach((el,i)=>el.value=state.fortunes[i]);render();
    state.fortuneStyles.forEach((style,i)=>{elements.fortunes.querySelector(`.fortune-angle[data-index="${i}"]`).value=String(style.angle);elements.fortunes.querySelector(`.fortune-size[data-index="${i}"]`).value=String(style.size);elements.fortunes.querySelector(`.fortune-bold[data-index="${i}"]`).checked=style.bold;elements.fortunes.querySelector(`.fortune-italic[data-index="${i}"]`).checked=style.italic;});
  }
  function changed(){ $('saveStatus').textContent='Unsaved changes';render(); }
  function readUpload(file,index,type){
    if(!file)return; if(file.size>3*1024*1024){showToast('Please choose a file smaller than 3 MB');return;}
    const reader=new FileReader();reader.onload=()=>{state.icons[index]={type,value:'',data:String(reader.result)};changed();showToast('Corner icon updated');};reader.onerror=()=>showToast('Could not read that image');reader.readAsDataURL(file);
  }
  function bindInputs(){
    elements.projectName.oninput=e=>{state.name=e.target.value;changed();};
    elements.theme.onchange=e=>{state=freshState(e.target.value);populateEditors();updateDeleteThemeButton();changed();showToast(`${e.target.value} theme applied`);};
    elements.accent.oninput=e=>{state.accent=e.target.value;changed();};
    elements.font.onchange=e=>{state.font=e.target.value;changed();};elements.showNumbers.onchange=e=>{state.showNumbers=e.target.checked;changed();};elements.fold.onchange=e=>{state.foldLines=e.target.checked;changed();};elements.cut.onchange=e=>{state.cutLine=e.target.checked;changed();};
    elements.colors.oninput=e=>{if(e.target.matches('input')){state.numberColors[+e.target.dataset.index]=e.target.value;changed();}};
    elements.numbers.oninput=e=>{if(e.target.matches('input')){state.numbers[+e.target.dataset.index]=e.target.value;changed();}};
    elements.fortunes.oninput=e=>{const i=+e.target.dataset.index;if(e.target.matches('textarea'))state.fortunes[i]=e.target.value;else if(e.target.matches('.fortune-bold'))state.fortuneStyles[i].bold=e.target.checked;else if(e.target.matches('.fortune-italic'))state.fortuneStyles[i].italic=e.target.checked;changed();};
    elements.fortunes.onchange=e=>{const i=+e.target.dataset.index;if(e.target.matches('.fortune-angle'))state.fortuneStyles[i].angle=Number(e.target.value);else if(e.target.matches('.fortune-size'))state.fortuneStyles[i].size=e.target.value==='auto'?'auto':Number(e.target.value);else return;changed();};
    elements.outside.onchange=e=>{const i=+e.target.dataset.index;if(e.target.matches('.icon-type')){const type=e.target.value;state.icons[i]={type,value:type==='emoji'?'❤':'Label',data:''};populateEditors();changed();}else if(e.target.matches('.icon-file'))readUpload(e.target.files[0],i,state.icons[i].type);};
    elements.outside.oninput=e=>{if(e.target.matches('.icon-value')){const i=+e.target.dataset.index;state.icons[i].value=e.target.value;changed();}};
    elements.preview.onclick=e=>{const target=e.target.closest('[data-edit]');if(!target)return;const i=+target.dataset.index,type=target.dataset.edit;let field;if(type==='fortune')field=elements.fortunes.querySelector(`[data-index="${i}"]`);if(type==='number')field=elements.numbers.querySelector(`[data-index="${i}"]`);if(type==='icon')field=elements.outside.querySelector(`[data-corner="${i}"] input:not([hidden])`);if(type==='color')field=elements.colors.querySelector(`[data-index="${i}"]`);if(field){field.scrollIntoView({behavior:'smooth',block:'center'});field.focus();if(type==='color')field.click();}};
  }
  function download(blob,name){const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function saveProject(){download(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),safeName('json'));$('saveStatus').textContent='Saved locally';showToast('Project saved as JSON');}
  function validateProject(data){if(!data||!Array.isArray(data.numbers)||data.numbers.length!==8||!Array.isArray(data.fortunes)||data.fortunes.length!==8)throw new Error('Not a valid Fortune Teller Designer project.');const base=freshState(THEMES[data.theme]?data.theme:'Classic Hearts');const merged={...base,...data};if(!Array.isArray(merged.icons)||merged.icons.length!==4)merged.icons=base.icons;if(!Array.isArray(merged.numberColors)||merged.numberColors.length!==8)merged.numberColors=Array.isArray(data.cornerColors)&&data.cornerColors.length===4?data.cornerColors.flatMap(color=>[color,color]):base.numberColors;if(!Array.isArray(merged.fortuneStyles)||merged.fortuneStyles.length!==8)merged.fortuneStyles=base.fortuneStyles;return merged;}
  async function loadProject(file){try{state=validateProject(JSON.parse(await file.text()));populateEditors();$('saveStatus').textContent='Loaded';showToast('Project loaded');}catch(err){showToast(err.message||'Could not load project');}}
  function svgBlob(){return new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${buildSVG()}`],{type:'image/svg+xml;charset=utf-8'});}
  // Canvas is used only as the browser's transient SVG raster encoder; the design and preview remain SVG.
  function rasterize(type='image/png',quality=.96,scale=4){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(svgBlob());img.onload=()=>{const canvas=document.createElement('canvas');canvas.width=794*scale;canvas.height=1123*scale;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Export failed')),type,quality);};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Export failed'));};img.src=url;});}
  const bytes=s=>new TextEncoder().encode(s);function concat(parts){const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){out.set(p,at);at+=p.length;}return out;}
  function makePDF(buffer){const img=new Uint8Array(buffer),parts=[bytes('%PDF-1.4\n')],offsets=[0];const add=(n,c)=>{offsets[n]=parts.reduce((s,p)=>s+p.length,0);parts.push(bytes(`${n} 0 obj\n${c}\nendobj\n`));};add(1,'<< /Type /Catalog /Pages 2 0 R >>');add(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');add(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.276 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>');offsets[4]=parts.reduce((s,p)=>s+p.length,0);parts.push(bytes(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width 2382 /Height 3369 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`),img,bytes('\nendstream\nendobj\n'));const stream='q\n595.276 0 0 841.89 0 0 cm\n/Im0 Do\nQ';add(5,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);const start=parts.reduce((s,p)=>s+p.length,0);let xref='xref\n0 6\n0000000000 65535 f \n';for(let i=1;i<=5;i++)xref+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;xref+=`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;parts.push(bytes(xref));return new Blob([concat(parts)],{type:'application/pdf'});}
  async function exportPNG(){try{download(await rasterize(),safeName('png'));showToast('PNG exported');}catch(e){showToast(e.message);}}
  async function exportPDF(){try{const jpg=await rasterize('image/jpeg',.97,3);download(makePDF(await jpg.arrayBuffer()),safeName('pdf'));showToast('A4 PDF exported');}catch(e){showToast(e.message);}}
  function loadCustomThemes(){
    try{const saved=JSON.parse(localStorage.getItem(CUSTOM_THEME_KEY)||'{}');for(const [name,theme] of Object.entries(saved)){if(name&&theme&&Array.isArray(theme.fortunes))THEMES[name]=theme;}}
    catch(_error){localStorage.removeItem(CUSTOM_THEME_KEY);}
  }
  function customThemesForStorage(){const custom={};for(const [name,theme] of Object.entries(THEMES)){if(theme.custom)custom[name]=theme;}return custom;}
  function refreshThemeOptions(selected=state?.theme||'Classic Hearts'){
    elements.theme.innerHTML=Object.entries(THEMES).map(([name,theme])=>`<option value="${escapeXML(name)}">${escapeXML(name)}${theme.custom?' ★':''}</option>`).join('');
    elements.theme.value=selected;updateDeleteThemeButton();
  }
  function updateDeleteThemeButton(){const button=$('deleteThemeButton'),theme=THEMES[elements.theme?.value];if(button)button.disabled=!theme?.custom;}
  function saveCurrentTheme(){
    const requested=prompt('Name this custom theme:',state.name.replace(/ Fortune Teller$/i,'').trim()||'My Theme');if(requested===null)return;const name=requested.trim();
    if(!name){showToast('Enter a theme name');return;}if(THEMES[name]&&!THEMES[name].custom){showToast('Please use a different name from a built-in theme');return;}
    THEMES[name]={custom:true,accent:state.accent,font:state.font,icons:state.icons.map(icon=>icon.value||'★'),savedIcons:state.icons.map(icon=>({...icon})),numberColors:[...state.numberColors],fortunes:[...state.fortunes],fortuneStyles:state.fortuneStyles.map(style=>({...style})),showNumbers:state.showNumbers,foldLines:state.foldLines};
    try{localStorage.setItem(CUSTOM_THEME_KEY,JSON.stringify(customThemesForStorage()));state.theme=name;refreshThemeOptions(name);showToast(`Theme “${name}” saved`);}
    catch(_error){showToast('Theme is too large to save in this browser');}
  }
  function deleteCurrentTheme(){
    const name=elements.theme.value,theme=THEMES[name];if(!theme?.custom)return;
    if(!confirm(`Delete the custom theme “${name}”? This cannot be undone.`))return;
    delete THEMES[name];localStorage.setItem(CUSTOM_THEME_KEY,JSON.stringify(customThemesForStorage()));state=freshState('Classic Hearts');refreshThemeOptions('Classic Hearts');populateEditors();$('saveStatus').textContent='Theme deleted';showToast(`Theme “${name}” deleted`);
  }
  function showToast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2400);}
  function applyPreviewZoom(value){
    previewZoom=value;if(value===null){elements.preview.removeAttribute('data-zoom');elements.preview.style.width='';$('zoomLabel').textContent='Fit';return;}
    const available=Math.max(280,elements.previewViewport.clientWidth-8);elements.preview.dataset.zoom=String(value);elements.preview.style.width=`${Math.round(available*value/100)}px`;$('zoomLabel').textContent=`${value}%`;
  }
  function changePreviewZoom(delta){const current=previewZoom??100;applyPreviewZoom(Math.max(50,Math.min(250,current+delta)));}
  function toggleExpandedPreview(){const expanded=$('previewTitle').closest('.preview-panel').classList.toggle('expanded');$('expandPreviewButton').textContent=expanded?'✕':'⛶';$('expandPreviewButton').title=expanded?'Close expanded preview':'Expand preview';if(previewZoom===null)applyPreviewZoom(null);}
  function setMode(mode){document.documentElement.dataset.mode=mode;localStorage.setItem('fortune-teller-mode',mode);$('modeButton').textContent=mode==='dark'?'☀':'☾';}
  function init(){
    Object.assign(elements,{preview:$('preview'),previewViewport:$('previewViewport'),printArea:$('printArea'),printDesign:$('printDesign'),projectName:$('projectName'),theme:$('themeSelect'),outside:$('outsideFields'),colors:$('numberColorFields'),numbers:$('numberFields'),fortunes:$('fortuneFields'),accent:$('accentColor'),font:$('fontSelect'),showNumbers:$('showNumbers'),fold:$('foldLines'),cut:$('cutLine')});
    loadCustomThemes();makeEditors();state=freshState();refreshThemeOptions();populateEditors();bindInputs();
    $('newButton').onclick=()=>{if(!confirm('Start a new project? Unsaved changes will be lost.'))return;state=freshState();populateEditors();$('saveStatus').textContent='New project';};$('saveButton').onclick=saveProject;$('loadButton').onclick=()=>$('fileInput').click();$('fileInput').onchange=e=>{if(e.target.files[0])loadProject(e.target.files[0]);e.target.value='';};
    $('autoColorsButton').onclick=()=>{state.numberColors=[state.accent,...AUTO_COLORS.slice(1)];populateEditors();changed();showToast('Automatic number colours applied');};
    $('saveThemeButton').onclick=saveCurrentTheme;
    $('deleteThemeButton').onclick=deleteCurrentTheme;
    $('zoomOutButton').onclick=()=>changePreviewZoom(-25);$('zoomInButton').onclick=()=>changePreviewZoom(25);$('zoomLevelButton').onclick=()=>applyPreviewZoom(null);$('expandPreviewButton').onclick=toggleExpandedPreview;
    $('viewInstructionsButton').onclick=()=>{elements.printArea.classList.add('instructions-preview');document.body.style.overflow='hidden';};$('closeInstructionsButton').onclick=()=>{elements.printArea.classList.remove('instructions-preview');document.body.style.overflow='';};
    window.addEventListener('resize',()=>{if(previewZoom!==null)applyPreviewZoom(previewZoom);});document.addEventListener('keydown',event=>{if(event.key==='Escape'&&elements.printArea.classList.contains('instructions-preview')){$('closeInstructionsButton').click();return;}if(event.key==='Escape'&&$('previewTitle').closest('.preview-panel').classList.contains('expanded'))toggleExpandedPreview();});
    $('svgButton').onclick=()=>{download(svgBlob(),safeName('svg'));showToast('SVG exported');};$('pngButton').onclick=exportPNG;$('pdfButton').onclick=exportPDF;$('printButton').onclick=()=>{elements.printArea.classList.remove('instructions-preview');document.body.style.overflow='';elements.printArea.classList.toggle('include-instructions',$('printInstructions').checked);window.print();};$('modeButton').onclick=()=>setMode(document.documentElement.dataset.mode==='dark'?'light':'dark');setMode(localStorage.getItem('fortune-teller-mode')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'));
  }
  document.addEventListener('DOMContentLoaded',init);
})();

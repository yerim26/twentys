// Exhibition navigation always reloads a screen, clearing its in-memory session.
export function goToRound(round=1,room){
 let target=new URL('../',import.meta.url),destination=window;
 try{if(window.top!==window&&window.top.location.origin===location.origin){target=new URL(window.top.location.href);destination=window.top;}}catch{}
 target.search='';target.hash='';
 if(round===1&&/\/round2(?:\/index\.html)?\/?$/.test(target.pathname))target.searchParams.set('round','1');
 if(round!==1){target.searchParams.set('round',String(round));target.searchParams.set('room',room);}
 destination.location.assign(target.href);
}

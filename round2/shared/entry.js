import {installInactivityReset} from './inactivity.js';
installInactivityReset();
const params=new URL(location.href).searchParams;
const round=params.get('round');
const legacyRound2=!round&&/\/round2(?:\/index\.html)?\/?$/.test(location.pathname);
const puzzle=legacyRound2||round==='2'||round==='3'||(round!=='1'&&(params.has('room')||params.has('stage')));
await import(puzzle?'./app.js':'../round1/app.js');

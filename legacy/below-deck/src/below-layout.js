// Hand-authored 320 x 180 rooms. Feet and solid edges share the same pixel grid.
// The route runs toward the stern (left), then climbs back to the flight deck.
export const BELOW_W = 320, BELOW_H = 180;
const block = (x, y, w, h, kind = 'steel', extra = {}) => ({ x, y, w, h, kind, ...extra });
const spikes = (x, y, w, h = 6) => ({ x, y, w, h, kind: 'spikes' });
export const BELOW_ROOMS = [
  { name: 'THE BILGE', subtitle: 'A LONG WAY BACK', spawn: [292, 160], exit: [0, 122, 12, 38],
    hint: 'ARROWS MOVE   K / SPACE JUMP   HOLD FOR HEIGHT', theme: 'bilge',
    solids: [block(0,160,320,20), block(224,144,24,16), block(160,136,32,24), block(96,136,32,24), block(40,144,24,16)], hazards: [] },
  { name: 'SEVERED WALKWAY', subtitle: 'ONE DASH. MAKE IT COUNT.', spawn: [292,152], exit: [0,114,12,38],
    hint: 'ARROWS + J DASH   LAND TO RECHARGE', theme: 'bilge',
    solids: [block(248,152,72,28), block(168,136,32,44), block(104,120,32,60), block(0,152,64,28)],
    hazards: [spikes(64,174,40), spikes(136,174,32), spikes(200,174,48)], refills: [[226,113]] },
  { name: 'CARGO TRANSFER', subtitle: 'CATCH THE LIFT', spawn: [292,152], exit: [0,114,12,38],
    hint: 'MOVING PLATFORMS CARRY YOUR MOMENTUM', theme: 'cargo',
    solids: [block(232,152,88,28), block(0,152,80,28), block(126,132,56,12,'mover',{axis:'x',range:48,period:220}), block(136,64,48,12)],
    hazards: [spikes(80,174,152)], refills: [[156,100]], token: [158,50] },
  { name: 'SERVICE CHIMNEY', subtitle: 'GO UP TO GO BACK', spawn: [292,160], exit: [0,74,12,38],
    hint: 'HOLD L + UP TO CLIMB   K WALL JUMP', theme: 'shaft',
    solids: [block(240,160,80,20), block(208,96,16,84), block(144,80,64,16), block(0,112,104,68)],
    hazards: [spikes(104,174,104), spikes(224,174,16)], refills: [[130,67]] },
  { name: 'PRESSURE LINE', subtitle: 'LISTEN TO THE PIPES', spawn: [292,152], exit: [0,114,12,38],
    hint: 'AMBER VENTS WARN BEFORE STEAM   WAIT / DASH', theme: 'engine',
    solids: [block(0,152,320,28), block(208,112,32,8), block(112,96,40,8), block(40,112,32,8)],
    hazards: [184,88].map((x,i)=>({x,y:108,w:16,h:44,kind:'steam',offset:i*65,period:180,on:62,warning:30})), refills: [[164,80]] },
  { name: 'BROKEN GANTRIES', subtitle: 'KEEP YOUR FEET MOVING', spawn: [292,144], exit: [0,90,12,38],
    hint: 'CRACKED PLATES FALL   GREEN CELLS REFILL DASH', theme: 'cargo',
    solids: [block(264,144,56,36), block(208,128,32,8,'crumble'), block(152,104,32,8,'crumble'), block(88,112,32,8,'crumble'), block(0,128,48,52)],
    hazards: [spikes(48,174,216)], refills: [[132,77]], token:[224,99] },
  { name: 'AFT ENGINE', subtitle: 'THE LAST CROSSING', spawn: [292,152], exit: [0,90,12,38],
    hint: 'CHAIN JUMPS + DASHES   EVERY ROOM SAVES', theme: 'engine',
    solids: [block(264,152,56,28), block(208,120,32,12), block(144,104,40,12,'mover',{axis:'y',range:16,period:190}), block(88,104,32,8,'crumble'), block(0,128,48,52)],
    hazards: [spikes(48,174,216), {x:126,y:116,w:10,h:56,kind:'steam',offset:80,period:210,on:60,warning:32}], refills: [[198,83],[68,89]] },
  { name: 'HOME STRETCH', subtitle: 'YOUR RIDE IS STILL HERE', spawn: [292,160], exit: [36,42,36,40],
    hint: 'CLIMB TO THE HELICOPTER', theme: 'open',
    solids: [block(256,160,64,20), block(208,136,32,44), block(152,112,32,68), block(0,80,112,100)],
    hazards: [], refills: [[132,70]], helicopter: [52,80] },
];
export function makeBelowRoom(index) {
  const room = structuredClone(BELOW_ROOMS[index]);
  // Broken overhead decks frame each route. Their solid undersides also make
  // direction and dash height matter, rather than eight open horizontal jumps.
  const overhead=[
    [[0,0,80,48],[80,0,40,24],[160,0,48,40],[272,0,48,32]],
    [[0,0,64,64],[64,0,48,24],[152,0,48,24],[280,0,40,48]],
    [[0,0,32,80],[112,0,32,24],[240,0,80,40]],
    [[0,0,112,32],[144,0,64,24],[256,0,64,64]],
    [[0,0,56,56],[112,0,16,32],[256,0,64,40]],
    [[0,0,64,32],[128,0,48,24],[272,0,48,64]],
    [[0,0,48,56],[208,0,32,64],[288,0,32,64]],
    [],
  ][index];
  room.solids.push(...overhead.map(([x,y,w,h])=>block(x,y,w,h)));
  room.solids.forEach((p,i)=>{p.id=i;p.baseX=p.x;p.baseY=p.y;p.dx=p.dy=0;p.crack=0;p.gone=false;});
  room.refills=(room.refills||[]).map(([x,y])=>({x,y,cooldown:0}));
  return room;
}
export function steamState(h, ticks) {
  const t=(ticks+h.offset)%h.period;
  return t<h.on?'active':t>=h.period-h.warning?'warning':'off';
}

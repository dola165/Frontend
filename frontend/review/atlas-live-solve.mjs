import {readFile,writeFile} from 'node:fs/promises';
import {findWalkingRoute,isWalkable} from '../src/components/map/walkingGraph.ts';
const data=JSON.parse(await readFile('review/atlas-verification/live-osm.json','utf8'));
const ways=data.elements.filter(e=>e.type==='way'&&isWalkable(e.tags)).sort((a,b)=>b.nodes.length-a.nodes.length);
const nodes=new Map(data.elements.filter(e=>e.type==='node').map(n=>[n.id,[n.lon,n.lat]]));
for(const way of ways){const origin=nodes.get(way.nodes[0]);const destination=nodes.get(way.nodes[Math.floor(way.nodes.length*.65)]);try{const route=findWalkingRoute(data.elements,origin,destination);if(route.distanceKm<.12)continue;await writeFile('review/atlas-verification/live-route.json',JSON.stringify({origin,destination,route}));console.log(JSON.stringify({origin,destination,distanceKm:route.distanceKm,pathNodes:route.coordinates.length,steps:route.steps.length}));break;}catch{}}

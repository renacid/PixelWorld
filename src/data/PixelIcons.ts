/** 編集用ドット配列と色。rowsを16×16へ差し替え可能。image指定時はpublic内の画像を使用。 */
import type { SkillId, ItemId } from '../game/types';
export type PixelIcon = { rows: string[]; color: string; image?: string };
const make=(color:string,rows:string[]):PixelIcon=>({color,rows:rows.flatMap(row=>[...Array(2)].map(()=>[...row].map(c=>c+c).join('')))});
export const SKILL_ICONS:Record<SkillId,PixelIcon>={
 icePillar:make('#78cbe9',['...w....','..wwg...','..wwgg..','..wwgg..','..wwgg..','.gwwggg.','.gggggg.','..gggg..']),
 thunderArmor:make('#ac78e1',['.gg..gg.','gggggggg','gg.wg.gg','ggwwgggg','.ggwggg.','.gggggg.','..gggg..','...gg...']),
 iceLance:make('#63badb',['......wg','.....wgg','....wgg.','...wg...','..wg....','.wg.....','gg......','g.......']),
 fireWall:make('#e97448',['.g.g.g..','.gwgwg..','ggwgwgg.','gwgwgwgg','gggggggg','gggggggg','gggggggg','........']),
 tornadoSummon:make('#55bfa5',['.gggggg.','g......g','.gggggg.','..gggg..','...gg...','..gg....','.g......','gggggggg']),
 earthquake:make('#a98157',['...g....','gg.g.ggg','..g.g...','...g....','ggg.g.gg','...g.g..','gggggggg','gggggggg']),
 summonSpirit:make('#aa825f',['..gggg..','.gwwggg.','ggwwgggg','gggggggg','.g.gg.g.','...g....','.gggggg.','..gggg..']),
 iceShield:make('#66bddc',['.gggggg.','gwwggwwg','gwggggwg','gggwgggg','.gwwwgg.','.ggwggg.','..gggg..','...gg...']),
 sweep:make('#bf9652',['...sss..','.ss...s.','s......s','.....ss.','...ss...','..ss....','.gg.....','gg......']),
 vacuumSlash:make('#59ac98',['......ss','.....ss.','gg..ss..','..gss...','..ssgggg','.ss.....','gg..gg..','g.......']),
 attack:make('#c5aa59',['......ss','.....ss.','....ss..','...ss...','g.ss....','.gg.....','.ggg....','g..g....']),
 fireball:make('#ef683b',['....g...','...gg...','.g.ggg..','.gggwg..','gggwwgg.','ggwwwgg.','.ggwgg..','..ggg...']),
 thunder:make('#a274df',['....gg..','...gg...','..gg....','.ggggg..','....gg..','...gg...','..gg....','.g......']),
 chainLightning:make('#ac78e1',['..g...g.','.gg..gg.','gggggg..','..g..g..','.gg.gg..','gggggg..','..g..g..','.g...g..']),
 tornado:make('#4bae8c',['..gggg..','.g....g.','gggggggg','...gg...','..gggg..','...gg...','....g...','...g....']),
 firerain:make('#e67537',['.g...g..','.wg..wg.','..g...g.','...g....','g..wg...','wg..g..g','.g.....w','.......g']),
 warp:make('#8870d2',['..gggg..','.g....g.','g..gg..g','g.g..g.g','g.g..g.g','g..gg..g','.g....g.','..gggg..']),
 icestone:make('#5ba5d2',['...gg...','..gwwg..','.gwwwgg.','ggwwgggg','ggwggggg','.gggggg.','..gggg..','...gg...']),
 groundbreak:make('#718f42',['........','g...g...','.g.g....','..g..gg.','gg.g.g..','...gg...','gggggggg','.gggggg.'])};
export const ITEM_ICONS:Record<ItemId,PixelIcon>={
 powerPotion:make('#ce663e',['..gggg..','...ww...','..gwwg..','.gggggg.','.ggwggg.','.gwwwgg.','.ggwggg.','..gggg..']),
 potion:make('#58a354',['......g.','....ggg.','...gwg..','.gggg...','ggggg...','.gg.g...','....g...','...g....']),
 healingPotion:make('#e96870',['..gggg..','...ww...','..gwwg..','.gwwwwg.','.ggwggg.','.gwwwgg.','.ggwggg.','..gggg..']),
 ether:make('#629ee3',['...g....','...gg...','..gwgg..','..gwgg..','.gwwggg.','.gwgggg.','..gggg..','........']),
 etherMedium:make('#536ed1',['...gg...','..gwwg..','..gwwg..','.gwwwgg.','ggwwwggg','ggwwgggg','.gggggg.','..gggg..']),
 hourglass:make('#be9252',['gggggggg','.gwwwwg.','..gwwg..','...gg...','...gg...','..gwwg..','.gggggg.','gggggggg']),
 scope:make('#ae72c8',['..gggg..','...ww...','..gwwg..','.gggggg.','.ggwwgg.','.gwggwg.','.ggwwgg.','..gggg..']),
 summon:make('#66ae81',['........','..gggg..','.gwwggg.','ggwwgggg','gggggggg','.g.gg.g.','.g.g..g.','...g....'])};
export function pixelIcon(d:PixelIcon):string {if(d.image)return '<img class="pixel-icon" alt="" draggable="false" src="'+import.meta.env.BASE_URL+d.image+'">';return '<svg class="pixel-icon" aria-hidden="true" viewBox="0 0 16 16" shape-rendering="crispEdges">'+d.rows.flatMap((row,y)=>[...row].map((c,x)=>c==='.'?'':'<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="'+(c==='s'?'#dbe3ec':c==='w'?'#fff5c9':d.color)+'"/>')).join('')+'</svg>';}

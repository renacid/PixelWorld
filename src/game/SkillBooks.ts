import type { Attribute, MapState } from './types';
import type { Random } from './Random';
export const BOOK_ATTRIBUTES: Attribute[] = ['fire','ice','thunder','wind','earth'];
/** 書の生成時に3属性を固定。選択画面の開閉では抽選しない。 */
export function rollBookAttributes(rng: Random): Attribute[] {
 const pool=[...BOOK_ATTRIBUTES], result:Attribute[]=[];
 while(result.length<3)result.push(pool.splice(rng.int(0,pool.length-1),1)[0]);
 return result;
}
export function initializeBooks(map:MapState,rng:Random):void {
 for(const object of map.objects)if(object.type==='skillBook'&&!object.bookAttributes)object.bookAttributes=rollBookAttributes(rng);
}

export function validBookAttributes(value:unknown):value is Attribute[]{return Array.isArray(value)&&value.length===3&&new Set(value).size===3&&value.every(a=>BOOK_ATTRIBUTES.includes(a));}

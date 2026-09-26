import { validSave } from './SaveManager';
import type { SaveData } from './types';
declare const __SAVE_BUILD__: string;
/** 同じアプリ版だけで使える持ち運び用セーブ。チェック値はコピー欠損の検出用。 */
function checksum(text:string):string{let n=2166136261;for(let i=0;i<text.length;i++)n=Math.imul(n^text.charCodeAt(i),16777619);return (n>>>0).toString(16);}
export function exportSave(state:SaveData):string{
 const json=JSON.stringify({build:__SAVE_BUILD__,state}),bytes=new TextEncoder().encode(json);
 let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 const data=btoa(binary);return 'PW1.'+checksum(data)+'.'+data;
}
export function importSave(text:string):SaveData{
 if(text.length>12_000_000)throw new Error('セーブ文字列が大きすぎます。');
 const [prefix,hash,data,...extra]=text.trim().split('.');
 if(prefix!=='PW1'||!data||extra.length||checksum(data)!==hash)throw new Error('文字列が欠けているか、形式が異なります。全文をコピーしてください。');
 let value;try{value=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data),c=>c.charCodeAt(0))));}catch{throw new Error('セーブ文字列を読み込めません。');}
 if(value.build!==__SAVE_BUILD__)throw new Error('異なるアプリ版のセーブです。更新前のデータは使用できません。');
 if(!validSave(value.state)||value.state.status!=='playing')throw new Error('再開可能な進行データではありません。');
 return value.state;
}

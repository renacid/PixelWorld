/** 静的配信とGitHub Pagesのサブパス向けVite設定。 */
import { defineConfig } from 'vite';
// @ts-ignore Node実行専用。ブラウザ用tsconfigにNode型を混ぜない。
import { createHash } from 'node:crypto';
// @ts-ignore Node実行専用。
import { readFileSync, readdirSync } from 'node:fs';
// @ts-ignore Node実行専用。
import { join } from 'node:path';
// ソース更新でセーブ互換番号が自動更新される。公開時は必ず再ビルドする。
const files=(dir:string):string[]=>readdirSync(dir,{withFileTypes:true}).flatMap((e:{name:string;isDirectory:()=>boolean})=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]).sort();
const build=createHash('sha256');for(const path of files('src'))build.update(path).update(readFileSync(path));
export default defineConfig({ base: './', define:{__SAVE_BUILD__:JSON.stringify(build.digest('hex').slice(0,24))} });

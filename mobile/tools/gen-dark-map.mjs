// يولّد packages/shared/src/darkMap.ts من لوحة الويب (ShoppingPlatformFrontend/theme.palette.js)
// الاستعمال (من مجلد mobile/):  node tools/gen-dark-map.mjs
// أعد تشغيله كلما تغيّرت لوحة الألوان في الويب ليبقى الوضع الداكن في التطبيق مطابقاً له.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const webDir = path.resolve(import.meta.dirname, '../../ShoppingPlatformFrontend')
const webRequire = createRequire(path.join(webDir, 'package.json'))

// theme.palette.js يستورد 'tailwindcss/colors' بصيغة ESM لا يحلّها node، فنستبدلها بـrequire من مجلد الويب
const source = fs
  .readFileSync(path.join(webDir, 'theme.palette.js'), 'utf8')
  .replace("import defaultColors from 'tailwindcss/colors'", `import { createRequire } from 'node:module'\nconst defaultColors = createRequire(${JSON.stringify(pathToFileURL(path.join(webDir, 'package.json')).href)})('tailwindcss/colors')`)
const tmp = path.join(os.tmpdir(), `palette-${Date.now()}.mjs`)
fs.writeFileSync(tmp, source)
const { themeVars } = await import(pathToFileURL(tmp).href)
fs.unlinkSync(tmp)
void webRequire

const hex = (triple) => '#' + triple.split(' ').map((v) => Number(v).toString(16).padStart(2, '0')).join('').toUpperCase()
// الترتيب: العائلات الملوّنة أولاً ثم الرمادي والحالات والأساسي والسطح (الأخيرة تتغلب عند تكرار اللون نفسه)
const order = (name) => (name.startsWith('--c-gray') ? 2 : name.startsWith('--c-primary') || /^--c-(success|warning|error|info)/.test(name) ? 3 : name.startsWith('--c-surface') ? 4 : 1)
const names = Object.keys(themeVars.light).sort((a, b) => order(a) - order(b))
const map = {}
for (const n of names) map[hex(themeVars.light[n])] = hex(themeVars.dark[n])
const changed = Object.entries(map).filter(([l, d]) => l !== d).sort(([a], [b]) => a.localeCompare(b))

const out = [
  '// مولَّد من theme.palette.js في الويب (الوضع الفاتح ← الداكن). لا يُعدَّل يدوياً؛ أعد توليده بـ: node tools/gen-dark-map.mjs',
  '// المفتاح: لون الوضع الفاتح بحروف كبيرة، والقيمة: مقابله في الوضع الداكن.',
  'export const DARK_HEX_MAP: Readonly<Record<string, string>> = {',
  ...changed.map(([l, d]) => `  '${l}': '${d}',`),
  '};',
  '',
].join('\n')
const target = path.resolve(import.meta.dirname, '../packages/shared/src/darkMap.ts')
fs.writeFileSync(target, out)
console.log(`${changed.length} لوناً ← ${path.relative(process.cwd(), target)}`)

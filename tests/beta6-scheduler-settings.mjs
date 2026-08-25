import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/navimower-map-card.js', import.meta.url), 'utf8');
for (const needle of ['schedule_view_mode','Automatic','Navimower','Native','set_schedule_queue','data-queue-up','data-queue-down','data-queue-add','data-setting-switch','data-setting-select','data-setting-number','data-setting-time']) {
  if (!source.includes(needle)) throw new Error(`Missing beta6 runtime feature: ${needle}`);
}
console.log('beta6 scheduler/settings regression passed');

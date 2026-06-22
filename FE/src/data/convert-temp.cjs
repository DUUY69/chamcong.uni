
const fs = require('fs');

// Raw data from kenzouno1/DiaGioiHanhChinhVN GitHub
// We need to convert from {Id, Name, Districts:[{Id, Name, Wards:[{Id, Name}]}]}
// to {code, name, districts:[{code, name, wards:[{code, name}]}]}

// Read the raw data that was fetched
const rawData = require('./raw-data.json');

const provinces = rawData.map(p => ({
  code: p.Id,
  name: p.Name,
  districts: (p.Districts || []).map(d => ({
    code: d.Id,
    name: d.Name,
    wards: (d.Wards || []).map(w => ({
      code: w.Id,
      name: w.Name,
    })),
  })),
}));

const output = `export const provinces = ${JSON.stringify(provinces, null, 2)};\n`;
fs.writeFileSync('./vietnam-address-data.js', output, 'utf8');
console.log('Done! Total provinces:', provinces.length);
provinces.forEach(p => {
  if (p.code === '79') {
    console.log('HCM districts:', p.districts.length);
  }
});

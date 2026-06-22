
const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching data from kenzouno1/DiaGioiHanhChinhVN...');
  const rawData = await fetchData('https://raw.githubusercontent.com/kenzouno1/DiaGioiHanhChinhVN/master/data.json');
  
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

  const output = `// Dữ liệu hành chính Việt Nam - 63 tỉnh/thành phố
// Nguồn: https://github.com/kenzouno1/DiaGioiHanhChinhVN
// Cấu trúc: { code, name, districts: [{ code, name, wards: [{ code, name }] }] }

export const provinces = ${JSON.stringify(provinces, null, 2)};
`;

  const outputPath = path.join(__dirname, 'vietnam-address-data.js');
  fs.writeFileSync(outputPath, output, 'utf8');
  
  console.log('Done!');
  console.log('Total provinces:', provinces.length);
  
  const hcm = provinces.find(p => p.code === '79');
  if (hcm) {
    console.log('HCM districts:', hcm.districts.length);
    console.log('HCM first district:', hcm.districts[0]?.name, '- wards:', hcm.districts[0]?.wards.length);
  }
  
  const fileSize = fs.statSync(outputPath).size;
  console.log('File size:', Math.round(fileSize / 1024), 'KB');
}

main().catch(console.error);

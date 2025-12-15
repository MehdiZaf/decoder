// api/decode.js - Ultra Simple Version
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'No data' });

    console.log('Processing data of length:', data.length);

    // ساده‌ترین روش: پیدا کردن "eyJ" و تا انتها
    const startIndex = data.indexOf('eyJ');
    if (startIndex === -1) {
      return res.status(400).json({ error: 'No eyJ found (not JSON base64)' });
    }

    // از eyJ تا انتها
    let base64Str = data.substring(startIndex);
    
    // حذف تمام @
    base64Str = base64Str.replace(/@/g, '');
    
    // حذف =هایی که padding نیستند
    // =های معتبر فقط در انتها هستند
    let cleaned = '';
    let hasEquals = false;
    
    for (let i = 0; i < base64Str.length; i++) {
      const char = base64Str[i];
      
      if (char === '=') {
        // اگر قبلاً = ندیده بودیم یا این = در انتهاست
        if (!hasEquals || i >= base64Str.length - 4) {
          cleaned += char;
          hasEquals = true;
        }
        // =های وسط را حذف کن
      } else {
        cleaned += char;
      }
    }
    
    // padding
    while (cleaned.length % 4 !== 0) {
      cleaned += '=';
    }
    
    console.log('Final base64:', cleaned.length, 'chars');
    
    // decode
    const decoded = Buffer.from(cleaned, 'base64').toString('utf8');
    console.log('Decoded:', decoded.length, 'chars');
    
    const jsonResult = JSON.parse(decoded);
    
    return res.json({
      success: true,
      data: jsonResult
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message,
      hint: 'Data should contain base64 encoded JSON starting with eyJ'
    });
  }
}

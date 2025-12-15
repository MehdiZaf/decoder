// api/decode.js - با fallbackهای متعدد
export default async function handler(req, res) {
  // CORS headers اضافه کن
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST method with {"data": "encoded_string"}' });
  }

  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'No data provided' });
    }

    console.log('Processing data length:', data.length);
    
    // لیست روش‌های استخراج
    const extractionMethods = [
      // روش ۱: == ... @ (جدیدترین)
      (str) => {
        const eqIndex = str.indexOf('==');
        const atIndex = str.indexOf('@', eqIndex + 2);
        if (eqIndex !== -1 && atIndex !== -1 && atIndex > eqIndex) {
          return str.substring(eqIndex + 2, atIndex);
        }
        return null;
      },
      
      // روش ۲: == ... @@
      (str) => {
        const eqIndex = str.indexOf('==');
        const atIndex = str.indexOf('@@', eqIndex + 2);
        if (eqIndex !== -1 && atIndex !== -1 && atIndex > eqIndex) {
          return str.substring(eqIndex + 2, atIndex);
        }
        return null;
      },
      
      // روش ۳: = ... @
      (str) => {
        const eqIndex = str.indexOf('=');
        const atIndex = str.indexOf('@', eqIndex + 1);
        if (eqIndex !== -1 && atIndex !== -1 && atIndex > eqIndex) {
          return str.substring(eqIndex + 1, atIndex);
        }
        return null;
      },
      
      // روش ۴: کل رشته
      (str) => str
    ];

    let base64Str = '';
    let methodUsed = 'none';

    // امتحان همه روش‌ها
    for (let i = 0; i < extractionMethods.length; i++) {
      try {
        const result = extractionMethods[i](data);
        if (result) {
          base64Str = result;
          methodUsed = method_${i + 1};
          console.log(Using ${methodUsed}, extracted ${base64Str.length} chars);
          break;
        }
      } catch (e) {
        console.log(Method ${i + 1} failed:, e.message);
      }
    }

    // پاکسازی
    base64Str = base64Str.replace(/\s/g, '');
    
    // padding
    while (base64Str.length % 4 !== 0) {
      base64Str += '=';
    }

    console.log('Final base64:', base64Str.length, 'chars');

    // decode
    const decoded = Buffer.from(base64Str, 'base64').toString('utf8');
    console.log('Decoded:', decoded.length, 'chars');
    
    const jsonResult = JSON.parse(decoded);
    
    return res.json({
      success: true,
      method: methodUsed,
      data: jsonResult
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message,
      step: 'processing'
    });
  }
}

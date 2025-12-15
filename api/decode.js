// api/decode.js - CommonJS version
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST method' });
  }

  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'No data provided' });
    }

    // پیدا کردن "eyJ"
    const startIndex = data.indexOf('eyJ');
    if (startIndex === -1) {
      return res.status(400).json({ error: 'No JSON data found (eyJ not found)' });
    }

    // استخراج
    let base64 = data.substring(startIndex);
    
    // حذف @ و =های اضافی
    base64 = base64.replace(/@/g, '');
    
    // فقط =های انتهایی را نگه دار
    let cleaned = '';
    let equalsCount = 0;
    
    for (let i = 0; i < base64.length; i++) {
      const char = base64[i];
      
      if (char === '=') {
        // فقط اگر در 4 کاراکتر انتهایی است نگه دار
        if (i >= base64.length - 4) {
          cleaned += char;
          equalsCount++;
        }
      } else {
        cleaned += char;
      }
    }
    
    // padding
    while (cleaned.length % 4 !== 0) {
      cleaned += '=';
    }
    
    // decode
    const decoded = Buffer.from(cleaned, 'base64').toString('utf8');
    const jsonResult = JSON.parse(decoded);
    
    return res.json({
      success: true,
      data: jsonResult
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: error.message,
      hint: 'Failed to decode data'
    });
  }
};

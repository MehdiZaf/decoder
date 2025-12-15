// decode.js - برای Vercel/Netlify Functions
export default async function handler(req, res) {
  // فقط POST قبول کن
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { data } = req.body;
    
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'Data field is required' });
    }

    console.log('📥 Received data length:', data.length);
    
    // 1. استخراج بخش base64
    let base64Part = data;
    let format = 'unknown';
    
    // فرمت ۳: encrypted==json_base64@iv (جدیدترین)
    if (data.includes('==') && data.includes('@')) {
      format = 'format3';
      const parts = data.split('@');
      if (parts.length >= 2) {
        const beforeAt = parts[0];
        const base64Parts = beforeAt.split('==');
        if (base64Parts.length >= 2) {
          base64Part = base64Parts[base64Parts.length - 1];
        }
      }
    }
    // فرمت ۲: encrypted==json_base64@@iv
    else if (data.includes('==') && data.includes('@@')) {
      format = 'format2';
      const parts = data.split('@@');
      if (parts.length >= 2) {
        const beforeAt = parts[0];
        const base64Parts = beforeAt.split('==');
        if (base64Parts.length >= 2) {
          base64Part = base64Parts[base64Parts.length - 1];
        }
      }
    }
    // فرمت ۱: encrypted=json_base64@iv
    else if (data.includes('=') && data.includes('@')) {
      format = 'format1';
      const parts = data.split('@');
      if (parts.length >= 2) {
        const beforeAt = parts[0];
        const base64Parts = beforeAt.split('=');
        if (base64Parts.length >= 2) {
          base64Part = base64Parts[base64Parts.length - 1];
        }
      }
    }
    
    console.log(🔍 Format detected: ${format});
    console.log(📦 Base64 part length: ${base64Part.length});
    
    // 2. پاکسازی
    let cleanBase64 = base64Part.replace(/\s/g, '');
    
    // 3. اضافه کردن padding
    while (cleanBase64.length % 4 !== 0) {
      cleanBase64 += '=';
    }
    
    console.log(🔧 Clean base64 length: ${cleanBase64.length});
    
    // 4. Decode
    const decodedString = Buffer.from(cleanBase64, 'base64').toString('utf8');
    console.log(📖 Decoded length: ${decodedString.length});
    
    // 5. Parse JSON
    const jsonData = JSON.parse(decodedString);
    
    // 6. برگرداندن نتیجه
    return res.status(200).json({
      ...jsonData,
      _metadata: {
        format,
        decodedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

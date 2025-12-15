// api/decode.js - برای Vercel Serverless Functions
export default async function handler(req, res) {
  // فقط POST requests را قبول کن
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are accepted' 
    });
  }

  try {
    // دریافت body
    const body = req.body;
    
    if (!body || !body.data) {
      return res.status(400).json({ 
        error: 'Bad request',
        message: 'Missing "data" field in request body' 
      });
    }

    const encodedString = body.data;
    console.log('📥 Received data length:', encodedString.length);

    // 1. استخراج بخش base64
    let base64Part = encodedString;
    
    // فرمت ۳: encrypted==json_base64@iv (جدیدترین)
    if (encodedString.includes('==') && encodedString.includes('@')) {
      const parts = encodedString.split('@');
      if (parts.length >= 2) {
        const beforeAt = parts[0];
        const base64Parts = beforeAt.split('==');
        if (base64Parts.length >= 2) {
          base64Part = base64Parts[base64Parts.length - 1];
        }
      }
    }
    // فرمت ۲: encrypted==json_base64@@iv
    else if (encodedString.includes('==') && encodedString.includes('@@')) {
      const parts = encodedString.split('@@');
      if (parts.length >= 2) {
        const beforeAt = parts[0];
        const base64Parts = beforeAt.split('==');
        if (base64Parts.length >= 2) {
          base64Part = base64Parts[base64Parts.length - 1];
        }
      }
    }
    // فرمت ۱: encrypted=json_base64@iv
    else if (encodedString.includes('=') && encodedString.includes('@')) {
      const parts = encodedString.split('@');
      if (parts.length >= 2) {
        const beforeAt = parts[0];
        const base64Parts = beforeAt.split('=');
        if (base64Parts.length >= 2) {
          base64Part = base64Parts[base64Parts.length - 1];
        }
      }
    }
    
    console.log('📦 Base64 extracted:', base64Part.length, 'chars');

    // 2. پاکسازی
    let cleanBase64 = base64Part.replace(/\s/g, '');

    // 3. اضافه کردن padding
    while (cleanBase64.length % 4 !== 0) {
      cleanBase64 += '=';
    }

    console.log('🔧 Clean base64:', cleanBase64.length, 'chars');

    // 4. Decode با Buffer
    const decodedString = Buffer.from(cleanBase64, 'base64').toString('utf8');
    console.log('📖 Decoded length:', decodedString.length);

    // 5. Parse JSON
    const jsonData = JSON.parse(decodedString);

    // 6. برگرداندن پاسخ
    return res.status(200).json({
      success: true,
      data: jsonData,
      decodedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    
    // برای debugging، جزئیات خطا را برگردان
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      // فقط در development جزئیات stack را برگردان
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
}

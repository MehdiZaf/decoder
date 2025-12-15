// Vercel Function - Simple Neshan Decoder
export default async function handler(req, res) {
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

    console.log('📥 Received data length:', data.length);
    console.log('🔍 First 100 chars:', data.substring(0, 100));

    // ------------------------------------------------------------
    // روش جدید شما: پیدا کردن JSON base64 با "eyJ"
    // ------------------------------------------------------------
    
    // 1. پیدا کردن شروع JSON ("eyJ" که معادل {" در base64 است)
    const startMarker = 'eyJ';
    const startIndex = data.indexOf(startMarker);
    
    if (startIndex === -1) {
      // شاید base64 معکوس است یا encoding متفاوت
      // جستجوی pattern‌های دیگر
      const patterns = ['eyJ', 'e30', 'WyJ', 'W3s'];
      for (const pattern of patterns) {
        const idx = data.indexOf(pattern);
        if (idx !== -1) {
          startIndex = idx;
          console.log(✅ Found pattern "${pattern}" at ${idx});
          break;
        }
      }
      
      if (startIndex === -1) {
        throw new Error('Could not find JSON start marker (eyJ)');
      }
    }
    
    console.log('📍 JSON starts at position:', startIndex);

    // 2. استخراج از startIndex به بعد
    let jsonBase64 = data.substring(startIndex);
    console.log('📦 Extracted from start, length:', jsonBase64.length);

    // 3. حذف تمام @ و = اضافی از JSON
    // اما نه =های پایانی که padding هستند
    console.log('🧹 Cleaning @ and = from JSON part...');
    
    // اول @ها را حذف کن
    jsonBase64 = jsonBase64.replace(/@/g, '');
    console.log('   Removed @ characters');
    
    // حالا =های وسط را پیدا و حذف کن (نه =های انتهایی)
    // =های معتبر padding فقط در انتها هستند
    let cleaned = '';
    let inJson = true;
    
    for (let i = 0; i < jsonBase64.length; i++) {
      const char = jsonBase64[i];
      
      if (char === '=' && inJson) {
        // بررسی کن آیا این = بخشی از base64 معتبر است یا خیر
        const remaining = jsonBase64.substring(i);
        
        // اگر = در انتهاست و padding است، نگه دار
        if (remaining.match(/^=+$/)) {
          cleaned += char; // padding انتهایی
        } else {
          // = وسط است، حذف کن
          console.log(   Removed = at position ${i});
        }
      } else {
        cleaned += char;
      }
    }
    
    jsonBase64 = cleaned;
    console.log('✅ After cleaning, length:', jsonBase64.length);
    console.log('📋 First 80 chars cleaned:', jsonBase64.substring(0, 80));

    // 4. اضافه کردن padding اگر لازم باشد
    let cleanBase64 = jsonBase64.replace(/\s/g, '');
    
    // حذف =های اضافی که ممکن است باقی مانده باشد
    while (cleanBase64.includes('==') && !cleanBase64.endsWith('==')) {
      cleanBase64 = cleanBase64.replace('==', '');
    }
    
    // حالا padding اضافه کن
    const mod = cleanBase64.length % 4;
    if (mod !== 0) {
      cleanBase64 += '='.repeat(4 - mod);
    }
    
    console.log('🔧 Final base64 length:', cleanBase64.length);

    // 5. Decode
    console.log('🔧 Decoding...');
    const decoded = Buffer.from(cleanBase64, 'base64').toString('utf8');
    console.log('✅ Decoded length:', decoded.length);
    console.log('🔍 First 200 chars decoded:', decoded.substring(0, 200));

    // 6. Parse JSON
    console.log('📄 Parsing JSON...');
    const jsonData = JSON.parse(decoded);
    console.log('🎉 JSON parsed successfully!');
    // 7. برگرداندن نتیجه
    return res.status(200).json({
      success: true,
      data: jsonData,
      metadata: {
        originalLength: data.length,
        cleanedLength: cleanBase64.length,
        decodedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      step: 'processing'
    });
  }
}

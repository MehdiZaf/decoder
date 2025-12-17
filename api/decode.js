// Neshan API Decoder - COMPLETE VERSION
// این کد تمام استثناها را مدیریت می‌کند

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { data } = req.body;
    
    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'No data provided or data is not a string' });
    }

    console.log('Starting decode process');
    console.log('Data length:', data.length);
    console.log('First 100 chars:', data.substring(0, 100));
    console.log('Last 100 chars:', data.substring(data.length - 100));

    // ------------------------------------------------------------
    // STEP 1: بررسی ساختار کلی داده
    // ------------------------------------------------------------
    
    // داده‌های Neshan معمولاً ساختار زیر را دارند:
    // [encrypted_part]==[json_base64]@[iv]
    // یا [encrypted_part]==[json_base64]@@[iv]
    
    let workingData = data;
    
    // اگر = و @ دارد، ساختار خاص Neshan است
    if (data.includes('==') && data.includes('@')) {
      console.log('Detected Neshan format with == and @');
      
      // پیدا کردن موقعیت ==
      const eqIndex = data.indexOf('==');
      
      // پیدا کردن @ بعد از ==
      const atIndex = data.indexOf('@', eqIndex + 2);
      
      if (eqIndex !== -1 && atIndex !== -1) {
        // استخراج بخش بین == و @
        workingData = data.substring(eqIndex + 2, atIndex);
        console.log('Extracted between == and @, length:', workingData.length);
      }
    }
    
    // اگر همچنان داده طولانی است، eyJ را پیدا کن
    if (workingData.length > 1000) {
      const eyjIndex = workingData.indexOf('eyJ');
      if (eyjIndex !== -1) {
        workingData = workingData.substring(eyjIndex);
        console.log('Trimmed to eyJ, new length:', workingData.length);
      }
    }

    // ------------------------------------------------------------
    // STEP 2: پاک‌سازی اولیه
    // ------------------------------------------------------------
    
    console.log('Initial cleaning...');
    
    // حذف @ (مهم!)
    let cleaned = workingData.replace(/@/g, '');
    console.log('Removed @ characters');
    
    // حذف whitespace
    cleaned = cleaned.replace(/\s/g, '');
    console.log('Removed whitespace');
    
    // فقط کاراکترهای base64 مجاز
    let base64Only = '';
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      const code = cleaned.charCodeAt(i);
      
      if (
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        (code >= 48 && code <= 57) || // 0-9
        code === 43 || // +
        code === 47 || // /
        code === 61    // =
      ) {
        base64Only += char;
      }
    }
    
    console.log('Base64 only length:', base64Only.length);

    // ------------------------------------------------------------
    // STEP 3: پیدا کردن طول معتبر base64
    // ------------------------------------------------------------
    
    console.log('Finding valid base64 length...');
    
    let validLength = base64Only.length;
    
    // روش ۱: جستجوی الگوی پایان JSON
    const endPatterns = [
      'In0=', 'fQ==', 'In19', 'fX0=', 'In1dfQ==', 'fV19',
      'IiJ9', 'IiJdfQ==', 'W10=', 'XSw=', 'Iiw=', 'Iicl'
    ];
    
    for (const pattern of endPatterns) {
      const idx = base64Only.indexOf(pattern);
      if (idx !== -1) {
        validLength = idx + pattern.length;
        console.log('Found end pattern:', pattern, 'at', idx, 'new length:', validLength);
        break;
      }
    }
    
    // روش ۲: جستجوی معکوس برای base64 معتبر
    if (validLength === base64Only.length) {
      console.log('No end pattern found, testing lengths...');
      
      for (let testLength = base64Only.length; testLength > 100; testLength--) {
        const testStr = base64Only.substring(0, testLength);
        const padded = testStr + '='.repeat((4 - testStr.length % 4) % 4);
        
        try {
          const decoded = Buffer.from(padded, 'base64').toString('utf8');
          
          // بررسی اینکه آیا decode شده معقول است
          if (decoded.includes('{') && decoded.includes('}') && decoded.length > 50) {
            // بررسی quote balance
            const quoteCount = (decoded.match(/"/g) || []).length;
            if (quoteCount % 2 === 0) { // تعداد quotes باید زوج باشد
              validLength = testLength;
              console.log('Found valid length by testing:', validLength);
              break;
            }
          }
        } catch (e) {
          // ادامه بده
        }
      }
    }
    
    const finalBase64 = base64Only.substring(0, validLength);
    console.log('Final base64 length:', finalBase64.length);
    console.log('First 80 chars:', finalBase64.substring(0, 80));
    console.log('Last 80 chars:', finalBase64.substring(Math.max(0, finalBase64.length - 80)));

    // ------------------------------------------------------------
    // STEP 4: Decode و fix کردن
    // ------------------------------------------------------------
    
    const padded = finalBase64 + '='.repeat((4 - finalBase64.length % 4) % 4);
    console.log('Padded length:', padded.length);
    
    let decoded;
    try {
      decoded = Buffer.from(padded, 'base64').toString('utf8');
      console.log('Decode successful, length:', decoded.length);
    } catch (e) {
      console.error('Decode failed:', e.message);
      throw new Error('Base64 decode failed: ' + e.message);
    }
    
    console.log('Decoded first 300:', decoded.substring(0, 300));
    console.log('Decoded last 100:', decoded.substring(Math.max(0, decoded.length - 100)));

    // ------------------------------------------------------------
    // STEP 5: پاک‌سازی و fix کردن JSON
    // ------------------------------------------------------------
    
    console.log('Cleaning JSON...');
    
    // 1. حذف کاراکترهای کنترلی
    let clean = '';
    for (let i = 0; i < decoded.length; i++) {
      const code = decoded.charCodeAt(i);
      if (code >= 32 || code === 9 || code === 10 || code === 13) {
        clean += decoded[i];
      } else {
        clean += ' ';
      }
    }
    
    // 2. fix کردن common issues
    let fixed = clean;
    
    // الف: fix کردن broken Unicode (مشکل فارسی)
    if (fixed.includes('\\u')) {
      try {
        fixed = JSON.parse('"' + fixed + '"');
      } catch (e) {
        // ignore
      }
    }
    
    // ب: balance کردن quotes
    const openQuotes = (fixed.match(/"/g) || []).length;
    if (openQuotes % 2 !== 0) {
      console.log('Unbalanced quotes, adding closing quote');
      fixed += '"';
    }
    
    // ج: balance کردن braces
    const openBraces = (fixed.match(/{/g) || []).length;
    const closeBraces = (fixed.match(/}/g) || []).length;
    
    if (openBraces > closeBraces) {
      console.log('Adding missing closing braces');
      for (let i = 0; i < openBraces - closeBraces; i++) {
        fixed += '}';
      }
    }
    
    // د: balance کردن brackets
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    
    if (openBrackets > closeBrackets) {
      console.log('Adding missing closing brackets');
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        fixed += ']';
      }
    }
    
    // ه: حذف trailing commas
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
    
    console.log('Fixed JSON length:', fixed.length);
    console.log('Fixed last 100:', fixed.substring(Math.max(0, fixed.length - 100)));

    // ------------------------------------------------------------
    // STEP 6: Extract JSON object با روش‌های مختلف
    // ------------------------------------------------------------
    
    console.log('Extracting JSON object...');
    
    let jsonData;
    let jsonString;
    
    // روش ۱: مستقیماً parse کن
    try {
      jsonData = JSON.parse(fixed);
      jsonString = fixed;
      console.log('Direct parse successful');
    } catch (e1) {
      console.log('Direct parse failed:', e1.message);
      
      // روش ۲: پیدا کردن اولین { و آخرین }
      const firstBrace = fixed.indexOf('{');
      const lastBrace = fixed.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          jsonString = fixed.substring(firstBrace, lastBrace + 1);
          jsonData = JSON.parse(jsonString);
          console.log('Extracted by braces successful');
        } catch (e2) {
          console.log('Extract by braces failed:', e2.message);
          
          // روش ۳: پیدا کردن کامل‌ترین JSON با regex
          const jsonRegex = /({[^{}]*{[^{}]*}[^{}]*})|({[^{}]*})/g;
          const matches = fixed.match(jsonRegex) || [];
          
          for (const match of matches) {
            try {
              jsonData = JSON.parse(match);
              jsonString = match;
              console.log('Regex match successful');
              break;
            } catch (e3) {
              // continue
            }
          }
          
          if (!jsonData) {
            // روش ۴: manual reconstruction
            console.log('Attempting manual reconstruction...');
            jsonData = manualReconstruct(fixed);
          }
        }
      }
    }
    
    // ------------------------------------------------------------
    // STEP 7: اعتبارسنجی
    // ------------------------------------------------------------
    
    if (!jsonData || typeof jsonData !== 'object') {
      throw new Error('Could not extract valid JSON object');
    }
    
    console.log('Successfully parsed JSON');
    console.log('Object keys:', Object.keys(jsonData));
    
    if (jsonData.lines && Array.isArray(jsonData.lines)) {
      console.log('Found lines array with', jsonData.lines.length, 'items');
    }

    // ------------------------------------------------------------
    // STEP 8: برگرداندن نتیجه
    // ------------------------------------------------------------
    
    return res.status(200).json({
      success: true,
      data: jsonData,
      metadata: {
        processingTime: new Date().toISOString(),
        originalLength: data.length,
        decodedLength: decoded.length,
        fixedLength: fixed.length
      }
    });

  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// ------------------------------------------------------------
// تابع کمکی برای reconstruct کردن JSON
// ------------------------------------------------------------

function manualReconstruct(str) {
  console.log('Manual reconstruction of:', str.substring(0, 200));
  
  // پیدا کردن شروع
  const start = str.indexOf('{');
  if (start === -1) throw new Error('No JSON object found');
  
  let result = '';
  let braceCount = 0;
  let inString = false;
  let escape = false;
  
  for (let i = start; i < str.length; i++) {
    const char = str[i];
    result += char;
    
    if (escape) {
      escape = false;
      continue;
    }
    
    if (char === '\\') {
      escape = true;
      continue;
    }
    
    if (char === '"' && !escape) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          // به پایان object رسیدیم
          break;
        }
      }
    }
  }
  
  // اگر braces balanced نیستند، fix کن
  if (braceCount > 0) {
    for (let i = 0; i < braceCount; i++) {
      result += '}';
    }
  }
  
  console.log('Reconstructed:', result.substring(0, 200));
  
  try {
    return JSON.parse(result);
  } catch (e) {
    // یک بار دیگر fix common issues
    const fixed = result
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/'/g, '"')
      .replace(/(\w+):/g, '"$1":');
    
    return JSON.parse(fixed);
  }
}

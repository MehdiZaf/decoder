// Neshan API Decoder - Universal Version
// این کد هر نوع JSON encoded را decode می‌کند

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

    // ------------------------------------------------------------
    // STEP 1: پیدا کردن شروع JSON در base64
    // ------------------------------------------------------------
    
    // تمام patternهای ممکن برای شروع JSON در base64
    const startPatterns = [
      'eyJ',  // {"   - رایج‌ترین
      'e30',  // {}
      'WyJ',  // ["
      'W3s',  // [{
      'In0',  // "}
      'fQ',   // }
      'W10',  // []
      'IiI'   // ""
    ];

    let startIndex = -1;
    let startPattern = '';
    
    for (const pattern of startPatterns) {
      const idx = data.indexOf(pattern);
      if (idx !== -1) {
        startIndex = idx;
        startPattern = pattern;
        console.log(`Found start pattern "${pattern}" at position ${idx}`);
        break;
      }
    }

    if (startIndex === -1) {
      // اگر pattern پیدا نکردیم، سعی می‌کنیم base64 معتبر پیدا کنیم
      console.log('No start pattern found, searching for valid base64...');
      
      // جستجو برای هر substring که ممکن است base64 معتبر باشد
      for (let i = 0; i < data.length - 10; i++) {
        for (let j = Math.min(i + 1000, data.length); j > i + 20; j--) {
          const testStr = data.substring(i, j);
          const clean = testStr.replace(/[^A-Za-z0-9+/=]/g, '');
          
          if (clean.length > 20) {
            const padded = clean + '='.repeat((4 - clean.length % 4) % 4);
            try {
              // تست decode
              const decoded = Buffer.from(padded, 'base64').toString('utf8');
              // تست اینکه آیا JSON است
              JSON.parse(decoded);
              startIndex = i;
              startPattern = 'auto_detected';
              console.log(`Auto-detected JSON at position ${i}, length ${j-i}`);
              break;
            } catch (e) {
              // ادامه بده
            }
          }
        }
        if (startIndex !== -1) break;
      }
    }

    if (startIndex === -1) {
      throw new Error('Could not find JSON data in input');
    }

    console.log(`Using start position: ${startIndex}, pattern: ${startPattern}`);

    // ------------------------------------------------------------
    // STEP 2: استخراج بخش base64
    // ------------------------------------------------------------
    
    let jsonBase64 = data.substring(startIndex);
    console.log(`Extracted base64 length: ${jsonBase64.length}`);

    // ------------------------------------------------------------
    // STEP 3: حذف کاراکترهای اضافی و مخرب
    // ------------------------------------------------------------
    
    console.log('Cleaning data...');
    
    // حذف کاراکترهای قطعاً مضر
    jsonBase64 = jsonBase64.replace(/@/g, '');
    console.log('Removed @ characters');
    
    // حذف whitespace و خطوط جدید
    jsonBase64 = jsonBase64.replace(/\s/g, '');
    console.log('Removed whitespace');
    
    // حذف کاراکترهای غیر base64 (به جز =)
    let cleaned = '';
    for (let i = 0; i < jsonBase64.length; i++) {
      const char = jsonBase64[i];
      const code = jsonBase64.charCodeAt(i);
      
      if (
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        (code >= 48 && code <= 57) || // 0-9
        code === 43 || // +
        code === 47 || // /
        code === 61    // =
      ) {
        cleaned += char;
      } else {
        console.log(`Removed invalid character at position ${i}: code ${code}`);
      }
    }
    
    jsonBase64 = cleaned;
    console.log(`After cleaning: ${jsonBase64.length} characters`);

    // ------------------------------------------------------------
    // STEP 4: پیدا کردن پایان واقعی JSON base64
    // ------------------------------------------------------------
    
    console.log('Finding valid base64 end...');
    
    let maxValidLength = 0;
    let validBase64 = '';
    
    // تست طول‌های مختلف
    for (let testLength = jsonBase64.length; testLength > 20; testLength--) {
      const testStr = jsonBase64.substring(0, testLength);
      const padded = testStr + '='.repeat((4 - testStr.length % 4) % 4);
      
      try {
        // تست decode
        const decoded = Buffer.from(padded, 'base64').toString('utf8');
        
        // تست parse JSON (با کنترل خطا)
        try {
          JSON.parse(decoded);
          // اگر به اینجا رسیدیم، base64 معتبر است
          if (testLength > maxValidLength) {
            maxValidLength = testLength;
            validBase64 = testStr;
          }
        } catch (jsonError) {
          // شاید JSON ناقص است، اما base64 معتبر است
          // بررسی کن آیا string معقولی است
          if (decoded.length > 10 && decoded.includes('{') && decoded.includes('}')) {
            if (testLength > maxValidLength) {
              maxValidLength = testLength;
              validBase64 = testStr;
            }
          }
        }
      } catch (e) {
        // base64 نامعتبر، ادامه بده
      }
    }
    
    if (!validBase64) {
      // اگر نتوانستیم پیدا کنیم، از heuristic استفاده می‌کنیم
      console.log('Could not find valid base64 with testing, using heuristic...');
      
      // الگوهای پایان JSON
      const endPatterns = [
        'fQ==', 'fX0=', 'fV19', 'In0=', 'In19', 'In1dfQ==',
        'fQo=', 'fQ==', 'IiJ9', 'IiJdfQ==', 'W10=', 'XSw='
      ];
      
      for (const pattern of endPatterns) {
        const idx = jsonBase64.indexOf(pattern);
        if (idx !== -1) {
          validBase64 = jsonBase64.substring(0, idx + pattern.length);
          console.log(`Found end pattern "${pattern}" at ${idx}`);
          break;
        }
      }
      
      // اگر باز هم پیدا نکردیم، از کل string استفاده می‌کنیم
      if (!validBase64) {
        validBase64 = jsonBase64;
        console.log('Using entire string as base64');
      }
    }
    
    console.log(`Valid base64 length: ${validBase64.length}`);
    console.log(`Base64 sample (first 80): ${validBase64.substring(0, 80)}`);
    console.log(`Base64 sample (last 80): ${validBase64.substring(Math.max(0, validBase64.length - 80))}`);

    // ------------------------------------------------------------
    // STEP 5: اضافه کردن padding و decode
    // ------------------------------------------------------------
    
    const finalBase64 = validBase64 + '='.repeat((4 - validBase64.length % 4) % 4);
    console.log(`Final base64 with padding: ${finalBase64.length} chars`);
    
    let decodedString;
    try {
      decodedString = Buffer.from(finalBase64, 'base64').toString('utf8');
      console.log('Base64 decode successful');
    } catch (decodeError) {
      console.error('Buffer decode failed:', decodeError.message);
      throw new Error(`Base64 decode failed: ${decodeError.message}`);
    }
    
    console.log(`Decoded length: ${decodedString.length}`);
    console.log(`Decoded sample (first 200): ${decodedString.substring(0, 200)}`);

    // ------------------------------------------------------------
    // STEP 6: پاک‌سازی JSON string
    // ------------------------------------------------------------
    
    console.log('Cleaning JSON string...');
    
    // حذف کاراکترهای کنترلی و غیر printable
    let cleanJson = '';
    let removedCount = 0;
    
    for (let i = 0; i < decodedString.length; i++) {
      const char = decodedString[i];
      const code = decodedString.charCodeAt(i);
      
      // نگه داشتن: printable characters, newline, tab, carriage return
      if (
        code === 10 || // \n
        code === 13 || // \r
        code === 9  || // \t
        (code >= 32 && code <= 126) || // printable ASCII
        (code >= 128) // Unicode
      ) {
        cleanJson += char;
      } else {
        removedCount++;
        // جایگزین با space یا حذف
        if (code === 0) {
          // null character - حذف کن
        } else {
          cleanJson += ' ';
        }
      }
    }
    
    console.log(`Removed ${removedCount} control characters`);
    console.log(`Clean JSON length: ${cleanJson.length}`);

    // ------------------------------------------------------------
    // STEP 7: Parse JSON با روش‌های مختلف
    // ------------------------------------------------------------
    
    console.log('Parsing JSON...');
    
    let jsonData;
    const parseErrors = [];
    
    // روش ۱: parse مستقیم
    try {
      jsonData = JSON.parse(cleanJson);
      console.log('JSON parse successful on first attempt');
    } catch (error1) {
      parseErrors.push(`Attempt 1: ${error1.message}`);
      console.log(`Parse attempt 1 failed: ${error1.message}`);
      
      // روش ۲: fix trailing commas
      try {
        const fixedJson = cleanJson
          .replace(/,\s*([}\]])/g, '$1') // حذف trailing commas
          .replace(/([{\[,])\s*([}\]])/g, '$1$2'); // حذف empty elements
        
        jsonData = JSON.parse(fixedJson);
        console.log('JSON parse successful after fixing trailing commas');
      } catch (error2) {
        parseErrors.push(`Attempt 2: ${error2.message}`);
        console.log(`Parse attempt 2 failed: ${error2.message}`);
        
        // روش ۳: fix quotes
        try {
          const quoteFixed = cleanJson
            .replace(/'/g, '"') // single quotes to double quotes
            .replace(/(\w+)\s*:/g, '"$1":') // unquoted keys
            .replace(/:\s*'([^']+)'/g, ':"$1"'); // single quoted values
        
          jsonData = JSON.parse(quoteFixed);
          console.log('JSON parse successful after fixing quotes');
        } catch (error3) {
          parseErrors.push(`Attempt 3: ${error3.message}`);
          console.log(`Parse attempt 3 failed: ${error3.message}`);
          
          // روش ۴: extract JSON با regex
          try {
            // سعی کن JSON object یا array را با regex پیدا کنی
            const jsonMatch = cleanJson.match(/(\{[^]*\}|\[[^]*\])/);
            if (jsonMatch) {
              jsonData = JSON.parse(jsonMatch[0]);
              console.log('JSON parse successful with regex extraction');
            } else {
              throw new Error('No JSON object/array found');
            }
          } catch (error4) {
            parseErrors.push(`Attempt 4: ${error4.message}`);
            console.log(`Parse attempt 4 failed: ${error4.message}`);
            
            // همه روش‌ها شکست خورد
            throw new Error(`All JSON parse attempts failed. Errors: ${parseErrors.join('; ')}`);
          }
        }
      }
    }

    // ------------------------------------------------------------
    // STEP 8: اعتبارسنجی داده
    // ------------------------------------------------------------
    
    console.log('Validating data...');
    
    if (!jsonData || typeof jsonData !== 'object') {
      throw new Error('Parsed data is not a valid object');
    }
    
    // بررسی ساختار رایج Neshan
    if (jsonData.lines && Array.isArray(jsonData.lines)) {
      console.log(`Found ${jsonData.lines.length} bus lines`);
    } else if (Object.keys(jsonData).length > 0) {
      console.log(`Found object with keys: ${Object.keys(jsonData).join(', ')}`);
    } else {
      console.log('Parsed empty object');
    }

    // ------------------------------------------------------------
    // STEP 9: برگرداندن نتیجه
    // ------------------------------------------------------------
    
    console.log('Process completed successfully');
    
    return res.status(200).json({
      success: true,
      data: jsonData,
      metadata: {
        processingTime: new Date().toISOString(),
        originalLength: data.length,
        cleanedLength: cleanJson.length,
        parseAttempts: parseErrors.length + 1,
        format: 'universal_decoder'
      }
    });

  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString(),
      hint: 'Make sure data contains valid base64 encoded JSON'
    });
  }
}

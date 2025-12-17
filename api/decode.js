// Neshan API Decoder - UNIVERSAL VERSION
// این کد تمام حالت‌ها را پوشش می‌دهد

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
    // STEP 1: تحلیل ساختار داده
    // ------------------------------------------------------------
    
    console.log('Analyzing data structure...');
    
    const hasDoubleEqual = data.includes('==');
    const hasSingleAt = data.includes('@');
    
    console.log('Has ==:', hasDoubleEqual);
    console.log('Has @:', hasSingleAt);
    
    let jsonBase64 = '';
    
    // ------------------------------------------------------------
    // حالت ۱: داده‌هایی که JSON آنها تکه تکه شده
    // ------------------------------------------------------------
    if (hasDoubleEqual && hasSingleAt) {
      console.log('Detected fragmented JSON format');
      
      // پیدا کردن موقعیت ==
      const eqIndex = data.indexOf('==');
      
      // پیدا کردن تمام @ بعد از ==
      const afterEq = data.substring(eqIndex + 2);
      
      // جمع‌آوری تمام تکه‌های base64
      let allParts = '';
      
      // قسمت اول (بین == و اولین @)
      const firstAt = afterEq.indexOf('@');
      if (firstAt !== -1) {
        allParts += afterEq.substring(0, firstAt);
        
        // قسمت‌های بعدی (بعد از @)
        let remaining = afterEq.substring(firstAt + 1);
        
        // حذف IV در انتها اگر وجود دارد
        // IV معمولاً 16-32 کاراکتر base64 است
        if (remaining.length > 30) {
          // احتمالاً JSON ادامه دارد
          // پیدا کردن پایان JSON
          const endPatterns = ['In0=', 'fQ==', 'In19', 'fX0=', 'In1dfQ==', 'fV19'];
          
          for (const pattern of endPatterns) {
            const idx = remaining.indexOf(pattern);
            if (idx !== -1) {
              allParts += remaining.substring(0, idx + pattern.length);
              console.log('Found end pattern in second part:', pattern);
              break;
            }
          }
          
          // اگر pattern پیدا نکردیم، سعی کنیم تا @ بعدی یا انتها
          if (allParts === afterEq.substring(0, firstAt)) {
            const nextAt = remaining.indexOf('@');
            if (nextAt !== -1) {
              allParts += remaining.substring(0, nextAt);
              console.log('Using up to next @');
            } else {
              allParts += remaining;
              console.log('Using entire remaining part');
            }
          }
        } else {
          // باقیمانده کوتاه است، احتمالاً IV است
          console.log('Remaining part is likely IV, length:', remaining.length);
        }
      }
      
      jsonBase64 = allParts;
      console.log('Combined JSON base64 length:', jsonBase64.length);
      
    } else {
      // ------------------------------------------------------------
      // حالت ۲: داده معمولی
      // ------------------------------------------------------------
      console.log('Detected standard format');
      
      // پیدا کردن شروع JSON
      const startMarkers = ['eyJ', 'e30', 'WyJ', 'W3s'];
      let startIndex = -1;
      
      for (const marker of startMarkers) {
        const idx = data.indexOf(marker);
        if (idx !== -1) {
          startIndex = idx;
          console.log('Found start marker:', marker, 'at', idx);
          break;
        }
      }
      
      if (startIndex === -1) {
        throw new Error('Could not find JSON start marker');
      }
      
      jsonBase64 = data.substring(startIndex);
      console.log('Extracted base64 length:', jsonBase64.length);
    }

    // ------------------------------------------------------------
    // STEP 2: پاک‌سازی base64
    // ------------------------------------------------------------
    
    console.log('Cleaning base64...');
    
    // حذف @ (مهم!)
    let cleaned = jsonBase64.replace(/@/g, '');
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
    // STEP 3: پیدا کردن پایان واقعی JSON
    // ------------------------------------------------------------
    
    console.log('Finding exact JSON end...');
    
    // روش ۱: جستجوی الگوهای پایان
    let validLength = base64Only.length;
    const endPatterns = [
      'In0=', 'fQ==', 'In19', 'fX0=', 'In1dfQ==', 'fV19',
      'IiJ9', 'IiJdfQ==', 'W10=', 'XSw=', 'Iiw=', 'Iicl'
    ];
    
    for (const pattern of endPatterns) {
      const idx = base64Only.indexOf(pattern);
      if (idx !== -1) {
        validLength = idx + pattern.length;
        console.log('Found end pattern:', pattern, 'at', idx);
        break;
      }
    }
    
    // روش ۲: تست decode برای پیدا کردن طول معتبر
    if (validLength === base64Only.length) {
      console.log('No end pattern found, testing lengths...');
      
      let maxValid = 0;
      let bestDecoded = '';
      
      for (let testLength = base64Only.length; testLength > 50; testLength -= 1) {
        const testStr = base64Only.substring(0, testLength);
        const padded = testStr + '='.repeat((4 - testStr.length % 4) % 4);
        
        try {
          const decoded = Buffer.from(padded, 'base64').toString('utf8');
          
          // بررسی اینکه آیا JSON معتبر است
          if (decoded.includes('{') && decoded.includes('}')) {
            // بررسی ساختار
            const openBraces = (decoded.match(/{/g) || []).length;
            const closeBraces = (decoded.match(/}/g) || []).length;
            const openBrackets = (decoded.match(/\[/g) || []).length;
            const closeBrackets = (decoded.match(/\]/g) || []).length;
            
            // اگر ساختار balanced است یا close بیشتر است (ممکن است incomplete باشد)
            if (openBraces <= closeBraces && openBrackets <= closeBrackets) {
              if (testLength > maxValid) {
                maxValid = testLength;
                bestDecoded = decoded;
              }
            }
          }
        } catch (e) {
          // ادامه بده
        }
      }
      
      if (maxValid > 0) {
        validLength = maxValid;
        console.log('Found valid length by testing:', validLength);
        console.log('Sample decoded:', bestDecoded.substring(0, 100));
      }
    }
    
    const finalBase64 = base64Only.substring(0, validLength);
    console.log('Final base64 length:', finalBase64.length);
    console.log('First 80 chars:', finalBase64.substring(0, 80));
    console.log('Last 80 chars:', finalBase64.substring(Math.max(0, finalBase64.length - 80)));

    // ------------------------------------------------------------
    // STEP 4: Decode
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
    
    console.log('Decoded sample (first 200):', decoded.substring(0, 200));
    console.log('Decoded sample (last 100):', decoded.substring(Math.max(0, decoded.length - 100)));

    // ------------------------------------------------------------
    // STEP 5: Fix و parse کردن JSON
    // ------------------------------------------------------------
    
    console.log('Processing JSON...');
    
    // پاک‌سازی کاراکترهای کنترلی
    let clean = '';
    for (let i = 0; i < decoded.length; i++) {
      const code = decoded.charCodeAt(i);
      if (code >= 32 || code === 9 || code === 10 || code === 13) {
        clean += decoded[i];
      } else if (code === 0) {
        // null character - حذف
      } else {
        clean += ' ';
      }
    }
    
    // Fix کردن common issues
    let fixed = clean;
    
    // 1. Balance braces و brackets
    const openBraces = (fixed.match(/{/g) || []).length;
    const closeBraces = (fixed.match(/}/g) || []).length;
    const openBrackets = (fixed.match(/\[/g) || []).length;
    const closeBrackets = (fixed.match(/\]/g) || []).length;
    
    console.log('Braces - Open:', openBraces, 'Close:', closeBraces);
    console.log('Brackets - Open:', openBrackets, 'Close:', closeBrackets);
    
    if (openBraces > closeBraces) {
      console.log('Adding missing closing braces');
      for (let i = 0; i < openBraces - closeBraces; i++) {
        fixed += '}';
      }
    }
    
    if (openBrackets > closeBrackets) {
      console.log('Adding missing closing brackets');
      for (let i = 0; i < openBrackets - closeBrackets; i++) {
        fixed += ']';
      }
    }
    
    // 2. حذف trailing commas
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
    
    // 3. Balance quotes
    const quotes = (fixed.match(/"/g) || []).length;
    if (quotes % 2 !== 0) {
      console.log('Unbalanced quotes, fixing...');
      fixed += '"';
    }
    
    // 4. Fix broken strings (مخصوص فارسی)
    if (fixed.includes('\\u')) {
      try {
        fixed = JSON.parse('"' + fixed.replace(/^"|"$/g, '') + '"');
      } catch (e) {
        // ignore
      }
    }
    
    console.log('Fixed JSON length:', fixed.length);

    // ------------------------------------------------------------
    // STEP 6: Extract کامل‌ترین JSON object
    // ------------------------------------------------------------
    
    console.log('Extracting complete JSON...');
    
    let jsonData;
    
    // روش ۱: مستقیماً parse
    try {
      jsonData = JSON.parse(fixed);
      console.log('Direct parse successful');
    } catch (e1) {
      console.log('Direct parse failed:', e1.message);
      
      // روش ۲: پیدا کردن outermost object
      const firstBrace = fixed.indexOf('{');
      const lastBrace = fixed.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          const extracted = fixed.substring(firstBrace, lastBrace + 1);
          jsonData = JSON.parse(extracted);
          console.log('Extracted by braces successful');
        } catch (e2) {
          console.log('Extract by braces failed:', e2.message);
          
          // روش ۳: manual reconstruction برای داده‌های تکه‌تکه
          jsonData = reconstructCompleteJson(fixed);
        }
      } else {
        // روش ۴: آخرین چاره
        jsonData = { error: 'Could not parse JSON', raw: fixed.substring(0, 200) };
      }
    }

    // ------------------------------------------------------------
    // STEP 7: اعتبارسنجی و کامل کردن داده
    // ------------------------------------------------------------
    
    console.log('Validating and completing data...');
    
    // بررسی ساختار Neshan
    if (jsonData && typeof jsonData === 'object' && !jsonData.error) {
      // اگر lines وجود دارد اما array نیست، آن را تبدیل کن
      if (jsonData.lines && !Array.isArray(jsonData.lines)) {
        console.log('Converting lines to array');
        jsonData.lines = [jsonData.lines];
      }
      
      // اگر lines وجود ندارد اما properties شبیه bus دارد، آن را در array قرار بده
      if (!jsonData.lines && (jsonData.busNumber || jsonData.title)) {
        console.log('Creating lines array from object');
        jsonData.lines = [jsonData];
        // properties تکراری را حذف کن
        delete jsonData.busNumber;
        delete jsonData.title;
        delete jsonData.etaText;
        delete jsonData.etaValue;
        delete jsonData.originName;
        delete jsonData.iconUrl;
        delete jsonData.destinationName;
        delete jsonData.slug;
      }
      
      // شمارش اتوبوس‌ها
      if (jsonData.lines && Array.isArray(jsonData.lines)) {
        console.log('Found', jsonData.lines.length, 'bus lines');
        
        // نمایش نمونه
        jsonData.lines.forEach((line, index) => {
          console.log(`  ${index + 1}. Bus ${line.busNumber || 'N/A'}: ${line.title || 'No title'} - ETA: ${line.etaText || 'N/A'}`);
        });
      }
    }
    
    // ------------------------------------------------------------
    // STEP 8: برگرداندن نتیجه
    // ------------------------------------------------------------
    
    console.log('Process completed successfully');
    
    return res.status(200).json({
      success: true,
      data: jsonData,
      metadata: {
        processingTime: new Date().toISOString(),
        originalLength: data.length,
        decodedLength: decoded.length,
        linesCount: jsonData.lines ? jsonData.lines.length : 0
      }
    });

  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    console.error('Error stack:', error.stack);
    
    // حتی در صورت خطا، سعی کن چیزی برگردانی
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
      rawData: req.body.data ? req.body.data.substring(0, 200) : 'no data'
    });
  }
}

// ------------------------------------------------------------
// تابع reconstructCompleteJson
// ------------------------------------------------------------

function reconstructCompleteJson(str) {
  console.log('Attempting manual reconstruction...');
  
  // پیدا کردن شروع اولین {
  const start = str.indexOf('{');
  if (start === -1) {
    throw new Error('No JSON object found');
  }
  
  let result = '';
  let braceStack = [];
  let inString = false;
  let escape = false;
  
  for (let i = start; i < str.length; i++) {
    const char = str[i];
    
    if (escape) {
      result += char;
      escape = false;
      continue;
    }
    
    if (char === '\\') {
      result += char;
      escape = true;
      continue;
    }
    
    if (char === '"' && !escape) {
      inString = !inString;
      result += char;
      continue;
    }
    
    if (!inString) {
      if (char === '{' || char === '[') {
        braceStack.push(char);
        result += char;
      } else if (char === '}') {
        if (braceStack.length > 0 && braceStack[braceStack.length - 1] === '{') {
          braceStack.pop();
          result += char;
        } else {
          // unmatched، اضافه نکن
        }
      } else if (char === ']') {
        if (braceStack.length > 0 && braceStack[braceStack.length - 1] === '[') {
          braceStack.pop();
          result += char;
        } else {
          // unmatched، اضافه نکن
        }
      } else {
        result += char;
      }
    } else {
      result += char;
    }
    
    // اگر stack خالی شد و در string نیستیم، احتمالاً JSON کامل است
    if (braceStack.length === 0 && !inString && result.trim().length > 10) {
      break;
    }
  }
  
  // اگر stack هنوز خالی نیست، آن را close کن
  while (braceStack.length > 0) {
    const last = braceStack.pop();
    result += last === '{' ? '}' : ']';
  }
  
  console.log('Reconstructed length:', result.length);
  console.log('Reconstructed sample:', result.substring(0, 200));
  
  try {
    // Fix common issues قبل از parse
    const fixed = result
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/'/g, '"')
      .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":');
    
    return JSON.parse(fixed);
  } catch (e) {
    console.log('Reconstruction failed:', e.message);
    
    // آخرین تلاش: extract با regex
    const jsonMatch = str.match(/(\{[^{}]*(\{[^{}]*\}[^{}]*)*\})/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        throw new Error('Could not reconstruct JSON: ' + e.message);
      }
    }
    
    throw new Error('Could not reconstruct JSON');
  }
}

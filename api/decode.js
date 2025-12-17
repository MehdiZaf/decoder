// Neshan API Decoder - ULTIMATE VERSION
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

    // ------------------------------------------------------------
    // STEP 1: استخراج ALL بخش‌های base64 از داده
    // ------------------------------------------------------------
    
    console.log('Extracting ALL base64 parts...');
    
    // الگو: پیدا کردن تمام sequenceهای base64
    const base64Regex = /[A-Za-z0-9+/=]{20,}/g;
    const allMatches = data.match(base64Regex) || [];
    
    console.log('Found', allMatches.length, 'potential base64 segments');
    
    // طولانی‌ترین segment را انتخاب کن (احتمالاً JSON است)
    let longestSegment = '';
    for (const match of allMatches) {
      if (match.length > longestSegment.length) {
        longestSegment = match;
      }
    }
    
    if (!longestSegment) {
      throw new Error('No base64 data found');
    }
    
    console.log('Longest segment length:', longestSegment.length);
    console.log('First 100 chars:', longestSegment.substring(0, 100));

    // ------------------------------------------------------------
    // STEP 2: پاک‌سازی کامل base64
    // ------------------------------------------------------------
    
    console.log('Cleaning base64...');
    
    // حذف @ (همیشه مضر)
    let cleaned = longestSegment.replace(/@/g, '');
    
    // فقط کاراکترهای base64 معتبر
    let validChars = '';
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
        validChars += char;
      } else {
        console.log('Removed invalid character:', char, 'code:', code);
      }
    }
    
    console.log('Valid characters length:', validChars.length);

    // ------------------------------------------------------------
    // STEP 3: پیدا کردن طول معتبر base64 با روش‌های مختلف
    // ------------------------------------------------------------
    
    console.log('Finding valid base64 length...');
    
    let validLength = validChars.length;
    let foundValid = false;
    
    // روش ۱: جستجوی الگوهای پایان JSON
    const endPatterns = [
      'In0=', 'fQ==', 'In19', 'fX0=', 'In1dfQ==', 'fV19',
      'IiJ9', 'IiJdfQ==', 'W10=', 'XSw=', 'Iiw=', 'Iicl',
      'LnBuZw==', 'LnBuZyI=', '.png"', '.png"}', '.png"]}'
    ];
    
    for (const pattern of endPatterns) {
      const idx = validChars.indexOf(pattern);
      if (idx !== -1) {
        validLength = idx + pattern.length;
        console.log('Found end pattern:', pattern, 'at position', idx);
        foundValid = true;
        break;
      }
    }
    
    // روش ۲: اگر pattern پیدا نکردیم، decode تستی
    if (!foundValid) {
      console.log('No end pattern found, testing decode...');
      
      for (let testLength = validChars.length; testLength > 100; testLength--) {
        const testStr = validChars.substring(0, testLength);
        const padded = testStr + '='.repeat((4 - testStr.length % 4) % 4);
        
        try {
          const decoded = Buffer.from(padded, 'base64').toString('utf8');
          
          // بررسی اینکه آیا decode موفق بود
          if (decoded.length > 10 && decoded.includes('{') && decoded.includes('}')) {
            // بررسی کاراکترهای کنترل
            let hasControlChars = false;
            for (let j = 0; j < decoded.length; j++) {
              const code = decoded.charCodeAt(j);
              if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
                hasControlChars = true;
                break;
              }
            }
            
            if (!hasControlChars) {
              validLength = testLength;
              console.log('Found valid length by decode test:', validLength);
              foundValid = true;
              break;
            }
          }
        } catch (e) {
          // continue
        }
      }
    }
    
    // اگر باز هم پیدا نکردیم، 90% طول را بگیر
    if (!foundValid) {
      validLength = Math.floor(validChars.length * 0.9);
      console.log('Using 90% of length:', validLength);
    }
    
    const finalBase64 = validChars.substring(0, validLength);
    console.log('Final base64 length:', finalBase64.length);

    // ------------------------------------------------------------
    // STEP 4: Decode با error handling کامل
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
    
    console.log('First 200 chars:', decoded.substring(0, 200));
    console.log('Last 100 chars:', decoded.substring(Math.max(0, decoded.length - 100)));

    // ------------------------------------------------------------
    // STEP 5: پاک‌سازی کامل JSON از کاراکترهای کنترل
    // ------------------------------------------------------------
    
    console.log('Cleaning control characters...');
    
    let cleanJson = '';
    let removedCount = 0;
    
    for (let i = 0; i < decoded.length; i++) {
      const char = decoded[i];
      const code = decoded.charCodeAt(i);
      
      // فقط کاراکترهای مجاز:
      // 9: tab, 10: newline, 13: carriage return, 32-126: printable ASCII, 128+: Unicode
      if (
        code === 9 ||    // \t
        code === 10 ||   // \n
        code === 13 ||   // \r
        (code >= 32 && code <= 126) || // printable ASCII
        (code >= 128)    // Unicode (فارسی و ...)
      ) {
        cleanJson += char;
      } else {
        removedCount++;
        // برای کاراکترهای کنترل، حذف کن (نه جایگزین با space)
      }
    }
    
    console.log('Removed', removedCount, 'control characters');
    console.log('Clean JSON length:', cleanJson.length);
    
    // حذف null bytes اگر وجود دارد
    cleanJson = cleanJson.replace(/\0/g, '');
    
    // حذف BOM اگر وجود دارد
    if (cleanJson.charCodeAt(0) === 0xFEFF) {
      cleanJson = cleanJson.substring(1);
    }

    // ------------------------------------------------------------
    // STEP 6: Fix کردن JSON با روش‌های مختلف
    // ------------------------------------------------------------
    
    console.log('Fixing JSON...');
    
    // روش ۱: حذف trailing commas
    let fixed = cleanJson.replace(/,\s*([}\]])/g, '$1');
    
    // روش ۲: balance کردن quotes
    const quotes = (fixed.match(/"/g) || []).length;
    if (quotes % 2 !== 0) {
      console.log('Fixing unbalanced quotes');
      // quotes فرد است، یک " اضافه کن
      fixed += '"';
    }
    
    // روش ۳: balance کردن braces و brackets
    let openBraces = (fixed.match(/{/g) || []).length;
    let closeBraces = (fixed.match(/}/g) || []).length;
    let openBrackets = (fixed.match(/\[/g) || []).length;
    let closeBrackets = (fixed.match(/\]/g) || []).length;
    
    console.log('Braces:', openBraces, 'open,', closeBraces, 'close');
    console.log('Brackets:', openBrackets, 'open,', closeBrackets, 'close');
    
    // اضافه کردن }های از دست رفته
    if (openBraces > closeBraces) {
      const missing = openBraces - closeBraces;
      console.log('Adding', missing, 'missing closing braces');
      for (let i = 0; i < missing; i++) {
        fixed += '}';
      }
      closeBraces += missing;
    }
    
    // اضافه کردن ]های از دست رفته
    if (openBrackets > closeBrackets) {
      const missing = openBrackets - closeBrackets;
      console.log('Adding', missing, 'missing closing brackets');
      for (let i = 0; i < missing; i++) {
        fixed += ']';
      }
      closeBrackets += missing;
    }
    
    // روش ۴: fix کردن broken URLs (مشکل رایج)
    if (fixed.includes('http') && !fixed.includes('.png"')) {
      // اگر URL قطع شده، آن را کامل کن
      const urlMatch = fixed.match(/https?:\/\/[^"]+/);
      if (urlMatch && !urlMatch[0].endsWith('.png')) {
        console.log('Fixing broken URL');
        fixed = fixed.replace(urlMatch[0], urlMatch[0] + '.png"');
      }
    }
    
    console.log('Fixed JSON length:', fixed.length);
    console.log('Fixed last 100 chars:', fixed.substring(Math.max(0, fixed.length - 100)));

    // ------------------------------------------------------------
    // STEP 7: Parse JSON با fallbackهای متعدد
    // ------------------------------------------------------------
    
    console.log('Parsing JSON with multiple fallbacks...');
    
    let jsonData = null;
    let parseMethod = '';
    
    // لیست روش‌های parse
    const parseMethods = [
      {
        name: 'direct',
        parse: (str) => JSON.parse(str)
      },
      {
        name: 'remove_trailing_commas',
        parse: (str) => JSON.parse(str.replace(/,\s*([}\]])/g, '$1'))
      },
      {
        name: 'fix_quotes',
        parse: (str) => JSON.parse(str.replace(/'/g, '"').replace(/(\w+):/g, '"$1":'))
      },
      {
        name: 'extract_object',
        parse: (str) => {
          const firstBrace = str.indexOf('{');
          const lastBrace = str.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1) {
            return JSON.parse(str.substring(firstBrace, lastBrace + 1));
          }
          throw new Error('No object found');
        }
      },
      {
        name: 'extract_array',
        parse: (str) => {
          const firstBracket = str.indexOf('[');
          const lastBracket = str.lastIndexOf(']');
          if (firstBracket !== -1 && lastBracket !== -1) {
            return JSON.parse(str.substring(firstBracket, lastBracket + 1));
          }
          throw new Error('No array found');
        }
      }
    ];
    
    // امتحان همه روش‌ها
    for (const method of parseMethods) {
      try {
        jsonData = method.parse(fixed);
        parseMethod = method.name;
        console.log('Parse successful with method:', method.name);
        break;
      } catch (e) {
        console.log('Parse failed with method', method.name, ':', e.message);
      }
    }
    
    // اگر همه روش‌ها شکست خوردند، manual reconstruction
    if (!jsonData) {
      console.log('All parse methods failed, attempting manual reconstruction...');
      jsonData = manualJsonReconstruction(fixed);
      parseMethod = 'manual_reconstruction';
    }

    // ------------------------------------------------------------
    // STEP 8: نرمال‌سازی ساختار داده
    // ------------------------------------------------------------
    
    console.log('Normalizing data structure...');
    
    // حالت ۱: اگر root object است و lines دارد
    if (jsonData && typeof jsonData === 'object' && jsonData.lines) {
      if (!Array.isArray(jsonData.lines)) {
        jsonData.lines = [jsonData.lines];
      }
    }
    // حالت ۲: اگر root array است (مستقیم lines است)
    else if (jsonData && Array.isArray(jsonData)) {
      jsonData = { lines: jsonData };
    }
    // حالت ۳: اگر object است اما lines ندارد (یک اتوبوس)
    else if (jsonData && typeof jsonData === 'object' && jsonData.busNumber) {
      jsonData = { lines: [jsonData] };
    }
    // حالت ۴: اگر چیزی parse نشد
    else if (!jsonData || typeof jsonData !== 'object') {
      jsonData = { lines: [], error: 'Could not parse bus data' };
    }
    
    // بررسی و fix کردن هر خط اتوبوس
    if (jsonData.lines && Array.isArray(jsonData.lines)) {
      console.log('Processing', jsonData.lines.length, 'bus lines');
      
      const validLines = [];
      
      for (let i = 0; i < jsonData.lines.length; i++) {
        const line = jsonData.lines[i];
        
        // اگر line معتبر نیست، skip کن
        if (!line || typeof line !== 'object') {
          console.log('Skipping invalid line at index', i);
          continue;
        }
        
        // fix کردن properties
        const fixedLine = {
          busNumber: String(line.busNumber || line.busnumber || ''),
          title: String(line.title || ''),
          etaText: String(line.etaText || line.etatext || line.eta || ''),
          etaValue: line.etaValue !== undefined ? line.etaValue : 
                    line.etavalue !== undefined ? line.etavalue : null,
          originName: String(line.originName || line.originname || line.origin || ''),
          destinationName: String(line.destinationName || line.destinationname || line.destination || ''),
          iconUrl: String(line.iconUrl || line.iconurl || line.icon || ''),
          slug: line.slug || null
        };
        
        // حذف خطوط خالی
        if (fixedLine.busNumber || fixedLine.title) {
          validLines.push(fixedLine);
        }
      }
      
      jsonData.lines = validLines;
      console.log('Valid lines after processing:', jsonData.lines.length);
      
      // نمایش نمونه
      jsonData.lines.slice(0, 3).forEach((line, idx) => {
        console.log(`  ${idx + 1}. Bus ${line.busNumber}: ${line.title} - ETA: ${line.etaText}`);
      });
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
        cleanJsonLength: cleanJson.length,
        linesCount: jsonData.lines ? jsonData.lines.length : 0,
        parseMethod: parseMethod
      }
    });

  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    console.error('Error stack:', error.stack);
    
    // حتی در صورت خطا، یک پاسخ ساختاریافته برگردان
    return res.status(500).json({
      success: false,
      error: 'Processing failed',
      message: error.message,
      data: { lines: [] },
      timestamp: new Date().toISOString()
    });
  }
}

// ------------------------------------------------------------
// تابع manualJsonReconstruction
// ------------------------------------------------------------

function manualJsonReconstruction(str) {
  console.log('Manual JSON reconstruction');
  console.log('Input length:', str.length);
  
  // پیدا کردن شروع اولین { یا [
  const firstBrace = str.indexOf('{');
  const firstBracket = str.indexOf('[');
  
  let start = -1;
  let isObject = true;
  
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    isObject = true;
    console.log('Starting with object at position', start);
  } else if (firstBracket !== -1) {
    start = firstBracket;
    isObject = false;
    console.log('Starting with array at position', start);
  } else {
    throw new Error('No JSON structure found');
  }
  
  // بازسازی دستی
  let result = '';
  let stack = [];
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
        stack.push(char);
        result += char;
      } else if (char === '}' || char === ']') {
        if (stack.length > 0) {
          const last = stack[stack.length - 1];
          if ((char === '}' && last === '{') || (char === ']' && last === '[')) {
            stack.pop();
            result += char;
          } else {
            // unmatched، skip
          }
        } else {
          // extra closing، skip
        }
      } else {
        // فقط کاراکترهای معتبر را اضافه کن
        const code = char.charCodeAt(0);
        if (code >= 32 && code <= 126 || code >= 128) {
          result += char;
        }
      }
    } else {
      // در string هستیم، همه کاراکترها را اضافه کن (به جز کنترل‌کاراکترها)
      const code = char.charCodeAt(0);
      if (code >= 32 || code === 9 || code === 10 || code === 13) {
        result += char;
      }
    }
    
    // اگر stack خالی شد، احتمالاً به پایان رسیدیم
    if (stack.length === 0 && result.length > 50) {
      // بررسی کن که آیا ساختار معقولی داریم
      if ((isObject && result.includes('}')) || (!isObject && result.includes(']'))) {
        break;
      }
    }
  }
  
  // اگر stack خالی نیست، آن را close کن
  while (stack.length > 0) {
    const last = stack.pop();
    result += last === '{' ? '}' : ']';
  }
  
  console.log('Reconstructed length:', result.length);
  console.log('Result sample:', result.substring(0, 200));
  
  try {
    // یک بار fix common issues
    const fixed = result
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/'/g, '"')
      .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
      .replace(/:\s*'([^']+)'/g, ':"$1"');
    
    return JSON.parse(fixed);
  } catch (e) {
    console.log('Reconstruction parse failed:', e.message);
    
    // آخرین تلاش: extract با regex ساده
    const simpleMatch = str.match(/(\{[^{}]*(\{[^{}]*\}[^{}]*)*\})|(\[[^\[\]]*(\[[^\[\]]*\][^\[\]]*)*\])/);
    if (simpleMatch) {
      try {
        const simpleJson = simpleMatch[0]
          .replace(/[^\x20-\x7E\u0600-\u06FF]/g, '') // حذف non-printable
          .replace(/,\s*([}\]])/g, '$1');
        
        return JSON.parse(simpleJson);
      } catch (e2) {
        // return empty structure
        return { lines: [] };
      }
    }
    
    // return empty structure
    return { lines: [] };
  }
}

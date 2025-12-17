// Neshan API Decoder - FINAL ULTIMATE VERSION
// این کد فقط بخش JSON را استخراج و decode می‌کند

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
    // STEP 1: پیدا کردن بخش JSON (بعد از ==)
    // ------------------------------------------------------------
    
    console.log('Looking for JSON section...');
    
    let jsonSection = '';
    
    // روش ۱: اگر == دارد، بخش بعد از == را بگیر
    if (data.includes('==')) {
      const eqIndex = data.indexOf('==');
      const afterEq = data.substring(eqIndex + 2);
      console.log('Found == at position', eqIndex);
      
      // بخش بعد از == تا اولین @ یا تا انتها
      let endIndex = afterEq.length;
      
      // پیدا کردن @ بعد از ==
      const atIndex = afterEq.indexOf('@');
      if (atIndex !== -1) {
        endIndex = atIndex;
        console.log('Found @ after == at position', atIndex);
      }
      
      jsonSection = afterEq.substring(0, endIndex);
      console.log('Extracted JSON section after ==, length:', jsonSection.length);
    }
    
    // روش ۲: اگر == ندارد اما = دارد
    else if (data.includes('=')) {
      const lastEqIndex = data.lastIndexOf('=');
      const afterLastEq = data.substring(lastEqIndex + 1);
      console.log('Found last = at position', lastEqIndex);
      
      // بخش بعد از آخرین = تا اولین @ یا تا انتها
      let endIndex = afterLastEq.length;
      const atIndex = afterLastEq.indexOf('@');
      if (atIndex !== -1) {
        endIndex = atIndex;
      }
      
      jsonSection = afterLastEq.substring(0, endIndex);
      console.log('Extracted JSON section after last =, length:', jsonSection.length);
    }
    
    // روش ۳: اگر هیچکدام نبود، کل داده
    else {
      jsonSection = data;
      console.log('Using entire data as JSON section');
    }
    
    // اگر هنوز خیلی طولانی است، eyJ را پیدا کن
    if (jsonSection.length > 1000) {
      const eyjIndex = jsonSection.indexOf('eyJ');
      if (eyjIndex !== -1) {
        jsonSection = jsonSection.substring(eyjIndex);
        console.log('Trimmed to eyJ, new length:', jsonSection.length);
      }
    }

    // ------------------------------------------------------------
    // STEP 2: حذف تمام @ از JSON section
    // ------------------------------------------------------------
    
    console.log('Removing all @ characters...');
    let withoutAt = jsonSection.replace(/@/g, '');
    console.log('After removing @:', withoutAt.length);

    // ------------------------------------------------------------
    // STEP 3: پیدا کردن پایان واقعی JSON base64
    // ------------------------------------------------------------
    
    console.log('Finding exact JSON end...');
    
    // الگوهای پایان JSON در base64
    const endPatterns = [
      'In0=', 'fQ==', 'In19', 'fX0=', 'In1dfQ==', 'fV19',
      'IiJ9', 'IiJdfQ==', 'W10=', 'XSw=', 'Iiw=',
      '.png"', '.png"}', '.png"]}', '.png",', '.png"],',
      'LnBuZw==', 'LnBuZyI=', 'LnBuZyJ9', 'LnBuZyJdfQ=='
    ];
    
    let validBase64 = '';
    let foundEnd = false;
    
    // جستجوی هر الگو
    for (const pattern of endPatterns) {
      const idx = withoutAt.indexOf(pattern);
      if (idx !== -1) {
        validBase64 = withoutAt.substring(0, idx + pattern.length);
        console.log('Found end pattern:', pattern, 'at position', idx);
        console.log('Valid base64 length:', validBase64.length);
        foundEnd = true;
        break;
      }
    }
    
    // اگر pattern پیدا نکردیم، از ابتدا تا انتهای string معتبر base64 را بگیر
    if (!foundEnd) {
      console.log('No end pattern found, finding valid base64...');
      
      // حذف کاراکترهای غیر base64 از انتها
      let cleanEnd = '';
      let lastValidIndex = withoutAt.length;
      
      for (let i = withoutAt.length - 1; i >= 0; i--) {
        const char = withoutAt[i];
        const code = withoutAt.charCodeAt(i);
        
        if (
          (code >= 65 && code <= 90) || // A-Z
          (code >= 97 && code <= 122) || // a-z
          (code >= 48 && code <= 57) || // 0-9
          code === 43 || // +
          code === 47 || // /
          code === 61    // =
        ) {
          cleanEnd = char + cleanEnd;
        } else {
          lastValidIndex = i;
          break;
        }
      }
      
      validBase64 = withoutAt.substring(0, lastValidIndex);
      console.log('Valid base64 by cleaning end, length:', validBase64.length);
    }
    
    // اگر هنوز خیلی کوتاه است، مشکل داریم
    if (validBase64.length < 50) {
      console.log('Warning: Valid base64 too short, trying alternative...');
      
      // سعی کن base64 معتبر پیدا کنی
      const base64Regex = /[A-Za-z0-9+/=]{100,}/g;
      const matches = data.match(base64Regex) || [];
      
      for (const match of matches) {
        // بررسی کن آیا با eyJ شروع می‌شود
        if (match.startsWith('eyJ')) {
          validBase64 = match;
          console.log('Found base64 starting with eyJ, length:', validBase64.length);
          break;
        }
      }
      
      // اگر هنوز پیدا نکردیم، طولانی‌ترین را بگیر
      if (validBase64.length < 50 && matches.length > 0) {
        validBase64 = matches.reduce((a, b) => a.length > b.length ? a : b);
        console.log('Using longest base64 segment, length:', validBase64.length);
      }
    }
    
    console.log('Final base64 length:', validBase64.length);
    console.log('First 100 chars:', validBase64.substring(0, 100));
    console.log('Last 100 chars:', validBase64.substring(Math.max(0, validBase64.length - 100)));

    // ------------------------------------------------------------
    // STEP 4: پاک‌سازی کامل base64
    // ------------------------------------------------------------
    
    console.log('Final cleaning of base64...');
    
    // فقط کاراکترهای base64 معتبر
    let cleanBase64 = '';
    for (let i = 0; i < validBase64.length; i++) {
      const char = validBase64[i];
      const code = validBase64.charCodeAt(i);
      
      if (
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        (code >= 48 && code <= 57) || // 0-9
        code === 43 || // +
        code === 47 || // /
        code === 61    // =
      ) {
        cleanBase64 += char;
      }
    }
    
    console.log('Clean base64 length:', cleanBase64.length);

    // ------------------------------------------------------------
    // STEP 5: Decode با padding مناسب
    // ------------------------------------------------------------
    
    // اضافه کردن padding
    const paddingNeeded = (4 - (cleanBase64.length % 4)) % 4;
    const paddedBase64 = cleanBase64 + '='.repeat(paddingNeeded);
    
    console.log('Padded base64 length:', paddedBase64.length);
    
    let decoded;
    try {
      decoded = Buffer.from(paddedBase64, 'base64').toString('utf8');
      console.log('Decode successful, length:', decoded.length);
    } catch (e) {
      console.error('Decode failed:', e.message);
      
      // اگر decode شکست خورد، سعی کن با حذف کاراکترهای اضافی
      let fixedBase64 = cleanBase64;
      
      // حذف =های اضافی از وسط
      fixedBase64 = fixedBase64.replace(/=+/g, '=');
      fixedBase64 = fixedBase64.replace(/([^=])=([^=])/g, '$1$2');
      
      // فقط =های انتهایی را نگه دار
      const lastEqIndex = fixedBase64.lastIndexOf('=');
      if (lastEqIndex !== -1 && lastEqIndex < fixedBase64.length - 4) {
        fixedBase64 = fixedBase64.substring(0, lastEqIndex + 1);
      }
      
      const rePadded = fixedBase64 + '='.repeat((4 - fixedBase64.length % 4) % 4);
      
      try {
        decoded = Buffer.from(rePadded, 'base64').toString('utf8');
        console.log('Decode successful after fixing, length:', decoded.length);
      } catch (e2) {
        throw new Error('Base64 decode failed even after fixing: ' + e2.message);
      }
    }
    
    console.log('First 200 chars decoded:', decoded.substring(0, 200));
    console.log('Last 100 chars decoded:', decoded.substring(Math.max(0, decoded.length - 100)));

    // ------------------------------------------------------------
    // STEP 6: پاک‌سازی کامل JSON از کاراکترهای کنترل
    // ------------------------------------------------------------
    
    console.log('Removing control characters...');
    
    let cleanJson = '';
    let removedCount = 0;
    
    for (let i = 0; i < decoded.length; i++) {
      const char = decoded[i];
      const code = decoded.charCodeAt(i);
      
      // نگه داشتن: printable chars, newline, tab, carriage return, Unicode
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
        // حذف کاراکتر کنترل
      }
    }
    
    console.log('Removed', removedCount, 'control characters');
    console.log('Clean JSON length:', cleanJson.length);
    
    // حذف null bytes
    cleanJson = cleanJson.replace(/\0/g, '');
    
    // حذف BOM
    if (cleanJson.charCodeAt(0) === 0xFEFF) {
      cleanJson = cleanJson.substring(1);
    }

    // ------------------------------------------------------------
    // STEP 7: Extract و fix کردن JSON
    // ------------------------------------------------------------
    
    console.log('Extracting and fixing JSON...');
    
    // پیدا کردن اولین { یا [
    const firstBrace = cleanJson.indexOf('{');
    const firstBracket = cleanJson.indexOf('[');
    
    let jsonStart = -1;
    let isObject = true;
    
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      jsonStart = firstBrace;
      isObject = true;
    } else if (firstBracket !== -1) {
      jsonStart = firstBracket;
      isObject = false;
    } else {
      throw new Error('No JSON structure found in decoded data');
    }
    
    console.log('JSON starts at position', jsonStart, 'isObject:', isObject);
    
    // استخراج JSON با balance checking
    let extracted = '';
    let stack = [];
    let inString = false;
    let escape = false;
    
    for (let i = jsonStart; i < cleanJson.length; i++) {
      const char = cleanJson[i];
      
      if (escape) {
        extracted += char;
        escape = false;
        continue;
      }
      
      if (char === '\\') {
        extracted += char;
        escape = true;
        continue;
      }
      
      if (char === '"' && !escape) {
        inString = !inString;
        extracted += char;
        continue;
      }
      
      if (!inString) {
        if (char === '{' || char === '[') {
          stack.push(char);
          extracted += char;
        } else if (char === '}' || char === ']') {
          if (stack.length > 0) {
            const last = stack[stack.length - 1];
            if ((char === '}' && last === '{') || (char === ']' && last === '[')) {
              stack.pop();
              extracted += char;
              
              // اگر stack خالی شد، احتمالاً به پایان رسیدیم
              if (stack.length === 0 && extracted.length > 100) {
                // بررسی کن که آیا ساختار معقولی داریم
                const openBraces = (extracted.match(/{/g) || []).length;
                const closeBraces = (extracted.match(/}/g) || []).length;
                const openBrackets = (extracted.match(/\[/g) || []).length;
                const closeBrackets = (extracted.match(/\]/g) || []).length;
                
                if (openBraces === closeBraces && openBrackets === closeBrackets) {
                  break;
                }
              }
            } else {
              // unmatched، skip
            }
          } else {
            // extra closing، skip
          }
        } else {
          extracted += char;
        }
      } else {
        extracted += char;
      }
    }
    
    // اگر stack خالی نیست، آن را close کن
    while (stack.length > 0) {
      const last = stack.pop();
      extracted += last === '{' ? '}' : ']';
    }
    
    console.log('Extracted JSON length:', extracted.length);
    console.log('First 200 chars extracted:', extracted.substring(0, 200));
    console.log('Last 100 chars extracted:', extracted.substring(Math.max(0, extracted.length - 100)));

    // ------------------------------------------------------------
    // STEP 8: Fix کردن common JSON issues
    // ------------------------------------------------------------
    
    console.log('Fixing common JSON issues...');
    
    let fixed = extracted;
    
    // 1. حذف trailing commas
    fixed = fixed.replace(/,\s*([}\]])/g, '$1');
    
    // 2. balance کردن quotes
    const quotes = (fixed.match(/"/g) || []).length;
    if (quotes % 2 !== 0) {
      console.log('Fixing unbalanced quotes');
      fixed += '"';
    }
    
    // 3. fix کردن broken URLs
    if (fixed.includes('http') && fixed.includes('static.neshan.org')) {
      // پیدا کردن URLهای قطع شده
      const urlRegex = /https?:\/\/static\.neshan\.org[^"]*/g;
      const urlMatches = fixed.match(urlRegex) || [];
      
      for (const url of urlMatches) {
        if (!url.endsWith('.png')) {
          const fixedUrl = url + '.png';
          fixed = fixed.replace(url, fixedUrl);
          console.log('Fixed broken URL:', url.substring(0, 50) + '...');
        }
      }
    }
    
    // 4. حذف کاراکترهای عجیب و غریب
    fixed = fixed.replace(/[^\x20-\x7E\u0600-\u06FF\uFB8A\u067E\u0686\u06AF\u200C\u200F]/g, '');
    
    console.log('Fixed JSON length:', fixed.length);

    // ------------------------------------------------------------
    // STEP 9: Parse JSON
    // ------------------------------------------------------------
    
    console.log('Parsing JSON...');
    
    let jsonData;
    
    try {
      jsonData = JSON.parse(fixed);
      console.log('JSON parse successful');
    } catch (e) {
      console.log('JSON parse failed:', e.message);
      
      // یک بار دیگر fix کن
      const reFixed = fixed
        .replace(/'/g, '"')
        .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
        .replace(/:\s*'([^']+)'/g, ':"$1"');
      
      try {
        jsonData = JSON.parse(reFixed);
        console.log('JSON parse successful after re-fixing');
      } catch (e2) {
        console.log('Re-fix also failed:', e2.message);
        
        // آخرین تلاش: extract با regex
        const simpleRegex = isObject ? 
          /(\{[^{}]*(\{[^{}]*\}[^{}]*)*\})/ :
          /(\[[^\[\]]*(\[[^\[\]]*\][^\[\]]*)*\])/;
        
        const match = fixed.match(simpleRegex);
        if (match) {
          try {
            jsonData = JSON.parse(match[0]);
            console.log('JSON parse successful with regex extraction');
          } catch (e3) {
            console.log('Regex extraction failed:', e3.message);
            jsonData = { lines: [], error: 'Could not parse JSON' };
          }
        } else {
          jsonData = { lines: [], error: 'No valid JSON found' };
        }
      }
    }

    // ------------------------------------------------------------
    // STEP 10: نرمال‌سازی داده‌ها
    // ------------------------------------------------------------
    
    console.log('Normalizing data...');
    
    // اگر خطا داریم، برگردان
    if (jsonData.error) {
      return res.status(200).json({
        success: false,
        data: jsonData,
        metadata: {
          processingTime: new Date().toISOString(),
          error: jsonData.error
        }
      });
    }
    
    // حالت‌های مختلف ساختار داده
    let lines = [];
    
    // حالت ۱: lines array
    if (jsonData.lines && Array.isArray(jsonData.lines)) {
      lines = jsonData.lines;
    }
    // حالت ۲: root array (مستقیم lines)
    else if (Array.isArray(jsonData)) {
      lines = jsonData;
      jsonData = { lines: jsonData };
    }
    // حالت ۳: single object با busNumber
    else if (jsonData.busNumber) {
      lines = [jsonData];
      jsonData = { lines: lines };
    }
    // حالت ۴: object با properties مختلف
    else if (typeof jsonData === 'object') {
      // بررسی کن آیا properties شبیه bus دارد
      const busKeys = Object.keys(jsonData).filter(k => 
        k.includes('bus') || k.includes('Bus') || 
        k.includes('line') || k.includes('Line')
      );
      
      if (busKeys.length > 0) {
        lines = [jsonData];
        jsonData = { lines: lines };
      }
    }
    
    // پاک‌سازی و فرمت کردن هر خط
    const processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (!line || typeof line !== 'object') {
        continue;
      }
      
      // استخراج مقادیر از هر نام ممکن
      const busNumber = String(
        line.busNumber || line.busnumber || line.bus || 
        line.number || line.line || line.route || ''
      );
      
      const title = String(
        line.title || line.name || line.routeName || ''
      );
      
      const etaText = String(
        line.etaText || line.etatext || line.eta || 
        line.arrival || line.time || ''
      );
      
      const etaValue = line.etaValue !== undefined ? line.etaValue :
                      line.etavalue !== undefined ? line.etavalue :
                      line.value !== undefined ? line.value : null;
      
      const originName = String(
        line.originName || line.originname || line.origin || 
        line.from || line.start || ''
      );
      
      const destinationName = String(
        line.destinationName || line.destinationname || 
        line.destination || line.to || line.end || ''
      );
      
      const iconUrl = String(
        line.iconUrl || line.iconurl || line.icon || 
        line.image || line.url || ''
      );
      
      const slug = line.slug || null;
      
      // فقط اگر داده معتبری داریم اضافه کن
      if (busNumber || title) {
        processedLines.push({
          busNumber,
          title,
          etaText,
          etaValue,
          originName,
          destinationName,
          iconUrl,
          slug
        });
      }
    }
    
    // به روز کردن jsonData
    jsonData.lines = processedLines;
    
    console.log('Processed', processedLines.length, 'bus lines');
    
    // نمایش نمونه
    processedLines.slice(0, Math.min(3, processedLines.length)).forEach((line, idx) => {
      console.log(`  ${idx + 1}. Bus ${line.busNumber}: ${line.title} - ETA: ${line.etaText}`);
    });

    // ------------------------------------------------------------
    // STEP 11: برگرداندن نتیجه
    // ------------------------------------------------------------
    
    console.log('Process completed successfully');
    
    return res.status(200).json({
      success: true,
      data: jsonData,
      metadata: {
        processingTime: new Date().toISOString(),
        originalLength: data.length,
        linesCount: processedLines.length,
        decodedLength: decoded.length
      }
    });

  } catch (error) {
    console.error('FATAL ERROR:', error.message);
    console.error('Error stack:', error.stack);
    
    // حتی در صورت خطا، ساختار صحیح برگردان
    return res.status(200).json({
      success: false,
      data: { lines: [] },
      error: error.message,
      metadata: {
        processingTime: new Date().toISOString(),
        error: 'Processing failed'
      }
    });
  }
}

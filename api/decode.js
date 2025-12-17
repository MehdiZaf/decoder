// api/decode.js
export default async function handler(req, res) {
  // لاگ ورودی
  console.log('=== API DECODE STARTED ===');
  console.log('Method:', req.method);
  console.log('Headers:', req.headers);
  
  // پشتیبانی از CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    console.log('Wrong method, returning 405');
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.',
      receivedMethod: req.method
    });
  }

  try {
    const body = req.body;
    console.log('Request body type:', typeof body);
    console.log('Request body keys:', Object.keys(body || {}));
    
    if (!body || Object.keys(body).length === 0) {
      console.log('Empty body received');
      return res.status(400).json({
        success: false,
        error: 'No data provided in request body'
      });
    }
    
    const { data } = body;
    
    if (!data) {
      console.log('No "data" field in body');
      return res.status(400).json({
        success: false,
        error: 'Missing "data" field in request body',
        receivedFields: Object.keys(body)
      });
    }
    
    console.log('Data type:', typeof data);
    console.log('Data length:', data.length);
    console.log('First 500 chars of data:', data.substring(0, 500));
    
    // پردازش داده
    const result = await processBusData(data);
    
    console.log('=== API DECODE COMPLETED ===');
    console.log('Found buses:', result.totalBuses);
    
    return res.status(200).json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
      processingTime: result.processingTime
    });
    
  } catch (error) {
    console.error('=== API DECODE ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function processBusData(rawData) {
  const startTime = Date.now();
  
  console.log('\n=== PROCESS BUS DATA START ===');
  console.log('Raw data length:', rawData.length);
  
  // 1. استخراج بخش اصلی
  const extracted = extractMainContent(rawData);
  console.log('Extracted length:', extracted.length);
  console.log('Extracted first 200 chars:', extracted.substring(0, 200));
  
  // 2. تشخیص و decode اگر base64 باشد
  const decoded = await decodeIfBase64(extracted);
  console.log('Decoded length:', decoded.length);
  console.log('Decoded first 200 chars:', decoded.substring(0, 200));
  
  // 3. پاکسازی
  const cleaned = cleanText(decoded);
  console.log('Cleaned length:', cleaned.length);
  
  // 4. استخراج JSON
  const jsonData = extractJsonData(cleaned);
  console.log('JSON extracted, type:', typeof jsonData);
  
  // 5. استخراج اتوبوس‌ها
  const buses = extractBusesFromData(jsonData, cleaned);
  console.log('Buses found:', buses.length);
  
  const processingTime = Date.now() - startTime;
  
  console.log('=== PROCESS BUS DATA END ===\n');
  
  return {
    totalBuses: buses.length,
    buses: buses,
    processingTime: `${processingTime}ms`,
    rawDataSample: rawData.substring(0, 100),
    extractedSample: extracted.substring(0, 100),
    decodedSample: decoded.substring(0, 100)
  };
}

function extractMainContent(text) {
  console.log('Extracting main content...');
  
  // چندین استراتژی برای استخراج
  
  // استراتژی 1: پیدا کردن base64 بعد از ==
  const doubleEqualsIndex = text.lastIndexOf('==');
  if (doubleEqualsIndex !== -1) {
    const afterEquals = text.substring(doubleEqualsIndex + 2);
    console.log('Found == at position', doubleEqualsIndex, 'after length:', afterEquals.length);
    
    // حذف کاراکترهای @
    const withoutAt = afterEquals.replace(/@/g, '');
    
    // پیدا کردن پایان معتبر
    const base64Match = withoutAt.match(/^[A-Za-z0-9+/]+=*/);
    if (base64Match && base64Match[0].length > 50) {
      console.log('Strategy 1 successful, length:', base64Match[0].length);
      return base64Match[0];
    }
  }
  
  // استراتژی 2: پیدا کردن eyJ (شروع base64 با JSON)
  const eyjIndex = text.indexOf('eyJ');
  if (eyjIndex !== -1) {
    const afterEyj = text.substring(eyjIndex);
    const base64Match = afterEyj.match(/^[A-Za-z0-9+/]+=*/);
    if (base64Match && base64Match[0].length > 50) {
      console.log('Strategy 2 successful, length:', base64Match[0].length);
      return base64Match[0];
    }
  }
  
  // استراتژی 3: پیدا کردن هر base64 طولانی
  const base64Regex = /[A-Za-z0-9+/]{100,}=*/g;
  const matches = text.match(base64Regex);
  if (matches && matches.length > 0) {
    // طولانی‌ترین را انتخاب کن
    const longest = matches.reduce((a, b) => a.length > b.length ? a : b);
    console.log('Strategy 3 successful, length:', longest.length);
    return longest;
  }
  
  // استراتژی 4: برگرداندن کل متن
  console.log('Strategy 4: Using entire text');
  return text;
}

async function decodeIfBase64(text) {
  console.log('Checking if base64...');
  
  // بررسی valid بودن base64
  if (!isValidBase64(text)) {
    console.log('Not valid base64, returning as is');
    return text;
  }
  
  try {
    // سعی در decode
    const decoded = Buffer.from(text, 'base64').toString('utf8');
    console.log('Base64 decoded successfully');
    return decoded;
  } catch (error) {
    console.log('Base64 decode failed:', error.message);
    return text;
  }
}

function cleanText(text) {
  console.log('Cleaning text...');
  
  let cleaned = text;
  
  // حذف کاراکترهای کنترلی
  cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  
  // حذف null bytes
  cleaned = cleaned.replace(/\0/g, '');
  
  // حذف کاراکترهای خاص
  cleaned = cleaned.replace(/@/g, '');
  
  // trim
  cleaned = cleaned.trim();
  
  console.log('Cleaned from', text.length, 'to', cleaned.length, 'chars');
  return cleaned;
}

function extractJsonData(text) {
  console.log('Extracting JSON data...');
  
  // اول سعی می‌کنیم مستقیماً JSON.parse کنیم
  try {
    const parsed = JSON.parse(text);
    console.log('Direct JSON parse successful');
    return parsed;
  } catch (e) {
    console.log('Direct parse failed:', e.message);
  }
  
  // اگر نشد، سعی می‌کنیم JSON را از متن استخراج کنیم
  try {
    // پیدا کردن اولین { یا [
    const startObj = text.indexOf('{');
    const startArray = text.indexOf('[');
    
    let start = -1;
    let endChar = '';
    
    if (startObj !== -1 && (startArray === -1 || startObj < startArray)) {
      start = startObj;
      endChar = '}';
    } else if (startArray !== -1) {
      start = startArray;
      endChar = ']';
    }
    
    if (start !== -1) {
      // پیدا کردن پایان متناسب
      let depth = 0;
      let inString = false;
      let escapeNext = false;
      let end = -1;
      
      for (let i = start; i < text.length; i++) {
        const char = text[i];
        
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }
        
        if (!inString) {
          if (char === '{' || char === '[') {
            depth++;
          } else if (char === '}' || char === ']') {
            depth--;
            if (depth === 0) {
              end = i + 1;
              break;
            }
          }
        }
      }
      
      if (end !== -1) {
        const jsonStr = text.substring(start, end);
        console.log('Extracted JSON string, length:', jsonStr.length);
        
        try {
          const parsed = JSON.parse(jsonStr);
          console.log('Extracted JSON parse successful');
          return parsed;
        } catch (e) {
          console.log('Extracted JSON parse failed:', e.message);
          
          // تلاش برای رفع مشکلات
          const fixed = fixJsonString(jsonStr);
          try {
            const parsed = JSON.parse(fixed);
            console.log('Fixed JSON parse successful');
            return parsed;
          } catch (e2) {
            console.log('Fixed JSON also failed');
          }
        }
      }
    }
  } catch (e) {
    console.log('JSON extraction error:', e.message);
  }
  
  // اگر هیچکدام کار نکرد، متن خام را برمی‌گردانیم
  console.log('Returning raw text as data');
  return { rawText: text };
}

function extractBusesFromData(jsonData, rawText) {
  console.log('Extracting buses from data...');
  
  const buses = [];
  
  // روش 1: از JSON پارس شده
  if (jsonData && typeof jsonData === 'object') {
    // ساختارهای مختلف
    const possiblePaths = [
      jsonData.lines,          // {lines: [...]}
      jsonData.buses,          // {buses: [...]}
      jsonData.data,           // {data: [...]}
      jsonData.result,         // {result: [...]}
      jsonData.items,          // {items: [...]}
      jsonData.values,         // {values: [...]}
      jsonData                // ممکن است مستقیماً آرایه باشد
    ];
    
    for (const data of possiblePaths) {
      if (Array.isArray(data) && data.length > 0) {
        console.log('Found array with', data.length, 'items');
        
        data.forEach((item, index) => {
          if (item && typeof item === 'object') {
            const bus = createBusObject(item, index);
            if (bus) {
              buses.push(bus);
            }
          }
        });
        
        if (buses.length > 0) {
          console.log('Extracted', buses.length, 'buses from JSON array');
          break;
        }
      }
    }
  }
  
  // روش 2: اگر هنوز اتوبوسی نداریم، از regex روی متن خام استفاده می‌کنیم
  if (buses.length === 0) {
    console.log('No buses found in JSON, trying regex on raw text...');
    const regexBuses = extractBusesWithRegex(rawText);
    buses.push(...regexBuses);
  }
  
  // روش 3: استخراج شماره اتوبوس‌ها
  if (buses.length === 0) {
    console.log('Trying to extract bus numbers...');
    const busNumbers = extractBusNumbers(rawText);
    busNumbers.forEach((number, index) => {
      buses.push({
        id: index + 1,
        busNumber: number,
        title: `اتوبوس ${number}`,
        etaText: '',
        etaValue: null,
        originName: '',
        destinationName: '',
        iconUrl: null,
        slug: null,
        extractedBy: 'numberPattern'
      });
    });
  }
  
  console.log('Total buses extracted:', buses.length);
  return buses;
}

function createBusObject(item, index) {
  try {
    // پیدا کردن شماره اتوبوس از فیلدهای مختلف
    const busNumber = 
      item.busNumber || 
      item.number || 
      item.line || 
      item.lineNumber || 
      item.bus || 
      item.id || 
      `BUS_${index + 1}`;
    
    // پیدا کردن عنوان
    const title = 
      item.title || 
      item.name || 
      item.route || 
      item.description || 
      '';
    
    // پیدا کردن ETA
    const etaText = 
      item.etaText || 
      item.eta || 
      item.time || 
      item.arrivalTime || 
      '';
    
    return {
      id: index + 1,
      busNumber,
      title,
      etaText,
      etaValue: item.etaValue || item.timeValue || null,
      originName: item.originName || item.origin || '',
      destinationName: item.destinationName || item.destination || '',
      iconUrl: item.iconUrl || item.icon || null,
      slug: item.slug || null,
      extractedBy: 'jsonParse'
    };
  } catch (error) {
    console.error('Error creating bus object:', error);
    return null;
  }
}

function extractBusesWithRegex(text) {
  const buses = [];
  let id = 1;
  
  console.log('Extracting with regex, text length:', text.length);
  
  // الگوی اصلی: "busNumber":"..."
  const busNumberRegex = /"busNumber"\s*:\s*"([^"]+)"/g;
  let match;
  
  while ((match = busNumberRegex.exec(text)) !== null) {
    const busNumber = match[1];
    console.log('Found bus number via regex:', busNumber);
    
    // سعی می‌کنیم اطلاعات بیشتر را از اطراف این match پیدا کنیم
    const start = Math.max(0, match.index - 200);
    const end = Math.min(text.length, match.index + 400);
    const context = text.substring(start, end);
    
    // استخراج title از context
    let title = '';
    const titleMatch = context.match(/"title"\s*:\s*"([^"]+)"/);
    if (titleMatch) {
      title = titleMatch[1];
    }
    
    // استخراج etaText از context
    let etaText = '';
    const etaMatch = context.match(/"etaText"\s*:\s*"([^"]+)"/);
    if (etaMatch) {
      etaText = etaMatch[1];
    }
    
    buses.push({
      id: id++,
      busNumber,
      title: title || `اتوبوس ${busNumber}`,
      etaText,
      etaValue: null,
      originName: '',
      destinationName: '',
      iconUrl: null,
      slug: null,
      extractedBy: 'regex'
    });
  }
  
  // اگر با busNumber چیزی پیدا نکردیم، سایر الگوها را امتحان می‌کنیم
  if (buses.length === 0) {
    const numberRegex = /"number"\s*:\s*"(\d+(?:\.\d+)?)"/g;
    while ((match = numberRegex.exec(text)) !== null) {
      const number = match[1];
      // فقط اعداد معقول (مثل شماره اتوبوس)
      if (parseFloat(number) > 5 && parseFloat(number) < 1000) {
        buses.push({
          id: id++,
          busNumber: number,
          title: `اتوبوس ${number}`,
          etaText: '',
          etaValue: null,
          originName: '',
          destinationName: '',
          iconUrl: null,
          slug: null,
          extractedBy: 'numberRegex'
        });
      }
    }
  }
  
  console.log('Regex extracted', buses.length, 'buses');
  return buses;
}

function extractBusNumbers(text) {
  // پیدا کردن اعدادی که ممکن است شماره اتوبوس باشند
  const numberPattern = /\b\d{1,3}(?:\.\d{1,2})?\b/g;
  const matches = text.match(numberPattern) || [];
  
  // فیلتر کردن: فقط اعداد معقول برای شماره اتوبوس
  const busNumbers = [];
  const seen = new Set();
  
  for (const num of matches) {
    const n = parseFloat(num);
    // معیارهای شماره اتوبوس: معمولاً بین 5 تا 999 و اغلب بدون اعشار یا با یک رقم اعشار
    if (n >= 5 && n <= 999 && !seen.has(num)) {
      // بررسی کنید که آیا این عدد در یک زمینه معقول ظاهر شده است
      const index = text.indexOf(num);
      const context = text.substring(Math.max(0, index - 20), Math.min(text.length, index + 20));
      
      // اگر در نزدیکی کلمات کلیدی باشد، احتمالاً شماره اتوبوس است
      if (context.includes('bus') || context.includes('خط') || context.includes('اتوبوس')) {
        busNumbers.push(num);
        seen.add(num);
      }
    }
  }
  
  console.log('Extracted bus numbers:', busNumbers);
  return busNumbers;
}

function fixJsonString(jsonStr) {
  let fixed = jsonStr;
  
  // رفع نقل قول‌های ناتمام
  const quoteCount = (fixed.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    fixed = fixed + '"';
  }
  
  // حذف ویرگول اضافی قبل از } یا ]
  fixed = fixed.replace(/,\s*([\]}])/g, '$1');
  
  // بستن براکت‌های باز
  const openBraces = (fixed.match(/\{/g) || []).length;
  const closeBraces = (fixed.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    fixed = fixed + '}'.repeat(openBraces - closeBraces);
  }
  
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) {
    fixed = fixed + ']'.repeat(openBrackets - closeBrackets);
  }
  
  return fixed;
}

function isValidBase64(str) {
  if (typeof str !== 'string') return false;
  
  // طول باید مضرب ۴ باشد
  if (str.length % 4 !== 0) return false;
  
  // الگوی base64
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(str)) return false;
  
  // سعی در decode برای اطمینان
  try {
    Buffer.from(str, 'base64');
    return true;
  } catch (e) {
    return false;
  }
}

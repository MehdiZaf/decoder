// api/decode.js
export default async function handler(req, res) {
  // فقط POST را قبول می‌کنیم
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed. Use POST.'
    });
  }

  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'No data provided in request body'
      });
    }
    
    console.log('Starting decode process');
    console.log('Input data length:', data.length);
    
    // 1. استخراج کامل JSON از داده ورودی
    const extractedData = extractCompleteData(data);
    
    // 2. پردازش و استخراج تمام اتوبوس‌ها
    const result = processExtractedData(extractedData);
    
    return res.status(200).json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Handler Error:', error);
    
    // تلاش برای استخراج حداقلی
    try {
      const fallbackResult = fallbackExtraction(req.body.data);
      if (fallbackResult.buses.length > 0) {
        return res.status(200).json({
          success: true,
          ...fallbackResult,
          warning: 'Used fallback extraction method',
          timestamp: new Date().toISOString()
        });
      }
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// تابع استخراج داده کامل
function extractCompleteData(rawData) {
  console.log('=== Starting data extraction ===');
  
  // چندین استراتژی برای استخراج
  
  // استراتژی 1: پیدا کردن base64 بعد از ==
  const strategies = [
    // استراتژی 1: پیدا کردن == و سپس base64
    () => {
      const startMarker = '==';
      const startIndex = rawData.lastIndexOf(startMarker);
      if (startIndex !== -1) {
        let extracted = rawData.substring(startIndex + startMarker.length);
        // حذف کاراکترهای مزاحم
        extracted = extracted.replace(/@/g, '');
        console.log('Strategy 1: Found after ==, length:', extracted.length);
        return extracted;
      }
      return null;
    },
    
    // استراتژی 2: پیدا کردن eyJ (شروع base64 با JSON)
    () => {
      const startIndex = rawData.indexOf('eyJ');
      if (startIndex !== -1) {
        let extracted = rawData.substring(startIndex);
        console.log('Strategy 2: Found eyJ at', startIndex, 'length:', extracted.length);
        return extracted;
      }
      return null;
    },
    
    // استراتژی 3: پیدا کردن هر base64 معتبر
    () => {
      const base64Regex = /[A-Za-z0-9+/]{100,}={0,2}/g;
      const matches = rawData.match(base64Regex);
      if (matches && matches.length > 0) {
        // طولانی‌ترین match را انتخاب کن
        const longest = matches.reduce((a, b) => a.length > b.length ? a : b);
        console.log('Strategy 3: Found base64, length:', longest.length);
        return longest;
      }
      return null;
    },
    
    // استراتژی 4: کل داده
    () => {
      console.log('Strategy 4: Using entire data, length:', rawData.length);
      return rawData;
    }
  ];
  
  // اجرای استراتژی‌ها تا زمانی که داده معتبر پیدا شود
  for (const strategy of strategies) {
    const result = strategy();
    if (result && result.length > 50) { // حداقل طول
      console.log('Using extracted data length:', result.length);
      return result;
    }
  }
  
  return rawData;
}

// تابع پردازش داده استخراج شده
function processExtractedData(extractedData) {
  console.log('=== Processing extracted data ===');
  
  let decodedString = extractedData;
  
  // 1. ابتدا سعی می‌کنیم base64 decode کنیم
  try {
    if (isValidBase64(extractedData)) {
      decodedString = Buffer.from(extractedData, 'base64').toString('utf8');
      console.log('Base64 decoded successfully, length:', decodedString.length);
      console.log('First 200 chars:', decodedString.substring(0, 200));
    }
  } catch (e) {
    console.log('Base64 decode failed, using as plain text');
  }
  
  // 2. پاکسازی
  decodedString = cleanJsonString(decodedString);
  
  // 3. تلاش برای پارس JSON
  let parsedData;
  try {
    parsedData = JSON.parse(decodedString);
    console.log('JSON parsed successfully');
  } catch (parseError) {
    console.log('JSON parse failed, trying to fix...');
    // تلاش برای رفع مشکلات JSON
    const fixedJson = fixJsonString(decodedString);
    try {
      parsedData = JSON.parse(fixedJson);
      console.log('Fixed JSON parsed successfully');
    } catch (e) {
      console.log('Could not parse even fixed JSON');
      parsedData = { raw: decodedString };
    }
  }
  
  // 4. استخراج اتوبوس‌ها
  const buses = extractAllBuses(parsedData, decodedString);
  
  console.log(`Found ${buses.length} buses`);
  
  return {
    totalBuses: buses.length,
    buses: buses,
    rawDataLength: extractedData.length,
    decodedLength: decodedString.length
  };
}

// تابع استخراج تمام اتوبوس‌ها
function extractAllBuses(parsedData, rawString) {
  const buses = [];
  
  // روش 1: از JSON پارس شده
  if (parsedData && typeof parsedData === 'object') {
    // ساختارهای مختلف
    const structures = [
      parsedData.lines,              // {lines: [...]}
      parsedData.buses,              // {buses: [...]}
      parsedData.data,               // {data: [...]}
      parsedData,                    // مستقیماً آرایه
      parsedData.result,             // {result: [...]}
      parsedData.items               // {items: [...]}
    ];
    
    for (const structure of structures) {
      if (Array.isArray(structure) && structure.length > 0) {
        console.log(`Found array with ${structure.length} items`);
        
        structure.forEach((item, index) => {
          if (item && typeof item === 'object') {
            const bus = normalizeBusObject(item, index);
            if (bus) {
              buses.push(bus);
            }
          }
        });
        
        if (buses.length > 0) break;
      }
    }
  }
  
  // روش 2: اگر هنوز اتوبوسی پیدا نکردیم، از regex استفاده می‌کنیم
  if (buses.length === 0) {
    console.log('Using regex extraction from raw string');
    buses.push(...extractBusesWithRegex(rawString));
  }
  
  // روش 3: از کل raw data اصلی
  if (buses.length === 0) {
    buses.push(...extractBusesWithRegex(JSON.stringify(parsedData)));
  }
  
  return buses;
}

// نرمال‌سازی شیء اتوبوس
function normalizeBusObject(busObj, index) {
  try {
    // پیدا کردن شماره اتوبوس
    const busNumber = 
      busObj.busNumber || 
      busObj.number || 
      busObj.line || 
      busObj.lineNumber || 
      busObj.bus || 
      `BUS_${index + 1}`;
    
    // پیدا کردن عنوان
    const title = 
      busObj.title || 
      busObj.name || 
      busObj.route || 
      busObj.description || 
      '';
    
    // پیدا کردن ETA
    const etaText = 
      busObj.etaText || 
      busObj.eta || 
      busObj.time || 
      busObj.arrivalTime || 
      '';
    
    return {
      id: index + 1,
      busNumber,
      title,
      etaText,
      etaValue: busObj.etaValue || busObj.timeValue || null,
      originName: busObj.originName || busObj.origin || '',
      destinationName: busObj.destinationName || busObj.destination || '',
      iconUrl: busObj.iconUrl || busObj.icon || null,
      slug: busObj.slug || null,
      rawData: busObj
    };
  } catch (e) {
    console.error('Error normalizing bus object:', e);
    return null;
  }
}

// استخراج با regex (برای مواقع اضطراری)
function extractBusesWithRegex(text) {
  const buses = [];
  
  // الگوهای مختلف برای پیدا کردن اتوبوس‌ها
  const patterns = [
    // "busNumber":"..."
    /"busNumber"\s*:\s*"([^"]+)"/g,
    // "number":"..."
    /"number"\s*:\s*"([^"]+)"/g,
    // "line":"..."
    /"line"\s*:\s*"([^"]+)"/g
  ];
  
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    matches.forEach((match, index) => {
      if (match[1]) {
        buses.push({
          id: buses.length + 1,
          busNumber: match[1],
          title: `اتوبوس ${match[1]}`,
          etaText: '',
          etaValue: null,
          originName: '',
          destinationName: '',
          iconUrl: null,
          slug: null
        });
      }
    });
    
    if (buses.length > 0) break;
  }
  
  return buses;
}

// پاکسازی JSON string
function cleanJsonString(str) {
  let cleaned = str;
  
  // حذف کاراکترهای کنترلی
  cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  
  // حذف null bytes
  cleaned = cleaned.replace(/\0/g, '');
  
  // رفع نقل قول‌های ناتمام
  const quoteCount = (cleaned.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    cleaned = cleaned + '"';
  }
  
  // حذف ویرگول اضافی قبل از }
  cleaned = cleaned.replace(/,\s*}/g, '}');
  cleaned = cleaned.replace(/,\s*\]/g, ']');
  
  return cleaned.trim();
}

// رفع مشکلات JSON
function fixJsonString(str) {
  let fixed = str;
  
  try {
    // اگر با }{ جدا شده باشند
    fixed = fixed.replace(/\}\s*\{/g, '},{');
    
    // اگر آرایه ناقص باشد
    if (fixed.includes('[') && !fixed.includes(']')) {
      fixed = fixed + ']';
    }
    
    // اگر آبجکت ناقص باشد
    if (fixed.includes('{') && !fixed.includes('}')) {
      fixed = fixed + '}';
    }
    
    // رفع URLهای شکسته
    fixed = fixed.replace(/"(https?:\/\/[^"]*)$/, '"$1"');
    
  } catch (e) {
    console.error('Error fixing JSON:', e);
  }
  
  return fixed;
}

// بررسی valid بودن base64
function isValidBase64(str) {
  try {
    if (str.length % 4 !== 0) {
      return false;
    }
    
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(str)) {
      return false;
    }
    
    // سعی در decode
    Buffer.from(str, 'base64');
    return true;
  } catch (e) {
    return false;
  }
}

// fallback extraction (حداقلی)
function fallbackExtraction(rawData) {
  console.log('=== Fallback extraction ===');
  
  const buses = extractBusesWithRegex(rawData);
  
  // همچنین سعی می‌کنیم الگوهای دیگر را پیدا کنیم
  if (buses.length === 0) {
    // الگوی کلی برای پیدا کردن هر متنی که شبیه شماره اتوبوس باشد
    const busPattern = /(\d{1,3}(?:\.\d{1,2})?)/g;
    const matches = rawData.match(busPattern);
    
    if (matches) {
      const uniqueNumbers = [...new Set(matches)];
      uniqueNumbers.forEach((num, index) => {
        if (parseFloat(num) > 10) { // فیلتر اعداد کوچک
          buses.push({
            id: index + 1,
            busNumber: num,
            title: `اتوبوس ${num}`,
            etaText: '',
            etaValue: null,
            originName: '',
            destinationName: '',
            iconUrl: null,
            slug: null
          });
        }
      });
    }
  }
  
  return {
    totalBuses: buses.length,
    buses: buses,
    note: 'Extracted using fallback method'
  };
}

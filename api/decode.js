// api/decode.js
export default async function handler(req, res) {
  console.log('=== API DECODE STARTED ===');
  console.log('Method:', req.method);
  
  // پشتیبانی از CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
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
    
    console.log('Data length:', data.length);
    console.log('Data sample (first 200):', data.substring(0, 200));
    
    // پردازش داده
    const result = await decodeAndExtractAllBuses(data);
    
    console.log('=== API DECODE COMPLETED ===');
    console.log('Found buses:', result.totalBuses);
    
    return res.status(200).json({
      success: true,
      ...result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('=== API DECODE ERROR ===');
    console.error('Error:', error.message);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

async function decodeAndExtractAllBuses(rawData) {
  const startTime = Date.now();
  
  console.log('\n=== DECODE AND EXTRACT ALL BUSES ===');
  console.log('Raw input length:', rawData.length);
  
  // 1. ابتدا سعی می‌کنیم مستقیماً decode کنیم (ممکن است کل داده base64 باشد)
  let decodedText = rawData;
  
  // 2. بررسی و decode اگر base64 باشد
  const base64Sections = extractAllBase64Sections(rawData);
  console.log(`Found ${base64Sections.length} potential base64 sections`);
  
  // 3. سعی می‌کنیم هر بخش base64 را decode کنیم
  const allDecodedResults = [];
  
  for (let i = 0; i < base64Sections.length; i++) {
    const section = base64Sections[i];
    console.log(`\nProcessing base64 section ${i + 1}, length: ${section.length}`);
    
    try {
      // اضافه کردن padding اگر لازم باشد
      const paddedSection = addBase64Padding(section);
      
      // decode
      const decoded = Buffer.from(paddedSection, 'base64').toString('utf8');
      console.log(`Section ${i + 1} decoded successfully, length: ${decoded.length}`);
      console.log(`First 100 chars: ${decoded.substring(0, 100)}`);
      
      allDecodedResults.push({
        source: `base64_section_${i + 1}`,
        text: decoded,
        length: decoded.length
      });
      
    } catch (decodeError) {
      console.log(`Section ${i + 1} decode failed: ${decodeError.message}`);
    }
  }
  
  // 4. اگر هیچ بخشی decode نشد، کل داده را به عنوان متن در نظر بگیر
  if (allDecodedResults.length === 0) {
    allDecodedResults.push({
      source: 'raw_text',
      text: rawData,
      length: rawData.length
    });
  }
  
  // 5. پردازش تمام نتایج decode شده
  const allBuses = [];
  
  for (const result of allDecodedResults) {
    console.log(`\nProcessing ${result.source}...`);
    const buses = extractBusesFromText(result.text);
    console.log(`Found ${buses.length} buses in ${result.source}`);
    allBuses.push(...buses);
  }
  
  // 6. حذف موارد تکراری
  const uniqueBuses = removeDuplicateBuses(allBuses);
  
  const processingTime = Date.now() - startTime;
  
  console.log('\n=== FINAL RESULTS ===');
  console.log(`Total unique buses: ${uniqueBuses.length}`);
  console.log(`Processing time: ${processingTime}ms`);
  
  return {
    totalBuses: uniqueBuses.length,
    buses: uniqueBuses,
    processingTime: `${processingTime}ms`,
    rawDataLength: rawData.length,
    decodedSections: allDecodedResults.length,
    debug: {
      rawSample: rawData.substring(0, 100),
      firstBase64Section: base64Sections[0] ? base64Sections[0].substring(0, 100) : 'none'
    }
  };
}

function extractAllBase64Sections(text) {
  const sections = [];
  
  // الگوی base64 استاندارد
  const base64Regex = /(eyJ[a-zA-Z0-9+/]*=*)/g;
  const matches = text.match(base64Regex) || [];
  
  // همچنین الگوهای دیگر base64
  const alternativePatterns = [
    /([A-Za-z0-9+/]{50,}=*)/g,
    /==([A-Za-z0-9+/]{20,})=*/g
  ];
  
  for (const pattern of alternativePatterns) {
    const altMatches = text.match(pattern) || [];
    altMatches.forEach(match => {
      // حذف == از ابتدا اگر وجود دارد
      const cleanMatch = match.startsWith('==') ? match.substring(2) : match;
      if (cleanMatch.length >= 20) {
        matches.push(cleanMatch);
      }
    });
  }
  
  // فیلتر کردن و مرتب‌سازی بر اساس طول
  const uniqueMatches = [...new Set(matches)];
  uniqueMatches.sort((a, b) => b.length - a.length);
  
  // فقط موارد با طول کافی
  return uniqueMatches.filter(section => section.length >= 20);
}

function addBase64Padding(str) {
  let padded = str;
  
  // حذف کاراکترهای غیر base64
  padded = padded.replace(/[^A-Za-z0-9+/=]/g, '');
  
  // اضافه کردن padding اگر لازم باشد
  const padCount = 4 - (padded.length % 4);
  if (padCount < 4) {
    padded += '='.repeat(padCount);
  }
  
  return padded;
}

function extractBusesFromText(text) {
  console.log('Extracting buses from text, length:', text.length);
  
  const buses = [];
  
  // 1. سعی می‌کنیم JSON را مستقیماً parse کنیم
  try {
    const jsonData = JSON.parse(text);
    const jsonBuses = extractBusesFromJSON(jsonData);
    buses.push(...jsonBuses);
    console.log(`Extracted ${jsonBuses.length} buses from direct JSON parse`);
  } catch (e) {
    console.log('Direct JSON parse failed, trying other methods...');
  }
  
  // 2. استخراج JSON از متن
  if (buses.length === 0) {
    const jsonStrings = extractJSONStrings(text);
    for (const jsonStr of jsonStrings) {
      try {
        const jsonData = JSON.parse(jsonStr);
        const jsonBuses = extractBusesFromJSON(jsonData);
        buses.push(...jsonBuses);
        console.log(`Extracted ${jsonBuses.length} buses from extracted JSON`);
      } catch (e) {
        // ignore
      }
    }
  }
  
  // 3. استخراج با regex از متن خام
  if (buses.length === 0) {
    const regexBuses = extractBusesWithAdvancedRegex(text);
    buses.push(...regexBuses);
    console.log(`Extracted ${regexBuses.length} buses with regex`);
  }
  
  // 4. استخراج از ساختارهای خاص
  const structuredBuses = extractFromStructures(text);
  buses.push(...structuredBuses);
  console.log(`Extracted ${structuredBuses.length} buses from structures`);
  
  return buses;
}

function extractJSONStrings(text) {
  const jsonStrings = [];
  
  // پیدا کردن تمام { ... } یا [ ... ]
  const jsonPattern = /(\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\})|(\[(?:[^\[\]]|(?:\[(?:[^\[\]]|(?:\[[^\[\]]*\]))*\]))*\])/g;
  
  let match;
  while ((match = jsonPattern.exec(text)) !== null) {
    const jsonStr = match[0];
    if (jsonStr.length > 50) { // حداقل طول برای JSON معنی‌دار
      jsonStrings.push(jsonStr);
    }
  }
  
  // همچنین پیدا کردن JSONهای ناقص و تلاش برای ترمیم آنها
  const start = text.indexOf('{"lines":');
  if (start !== -1) {
    // پیدا کردن پایان احتمالی
    let depth = 0;
    let inString = false;
    let escape = false;
    
    for (let i = start; i < text.length; i++) {
      const char = text[i];
      
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
        if (char === '{' || char === '[') {
          depth++;
        } else if (char === '}' || char === ']') {
          depth--;
          if (depth === 0) {
            const jsonStr = text.substring(start, i + 1);
            jsonStrings.push(jsonStr);
            break;
          }
        }
      }
    }
  }
  
  return jsonStrings;
}

function extractBusesFromJSON(jsonData) {
  const buses = [];
  
  if (!jsonData || typeof jsonData !== 'object') {
    return buses;
  }
  
  // ساختارهای مختلف
  const structures = [
    { path: 'lines', isArray: true },
    { path: 'buses', isArray: true },
    { path: 'data', isArray: true },
    { path: 'items', isArray: true },
    { path: 'results', isArray: true },
    { path: '', isArray: Array.isArray(jsonData) } // اگر خود jsonData آرایه باشد
  ];
  
  for (const structure of structures) {
    let items = [];
    
    if (structure.path && jsonData[structure.path]) {
      items = jsonData[structure.path];
    } else if (structure.isArray) {
      items = jsonData;
    }
    
    if (Array.isArray(items)) {
      items.forEach((item, index) => {
        if (item && typeof item === 'object') {
          const bus = createCompleteBusObject(item, index + 1);
          if (bus) {
            buses.push(bus);
          }
        }
      });
      
      if (buses.length > 0) {
        break;
      }
    }
  }
  
  return buses;
}

function createCompleteBusObject(item, id) {
  try {
    // استخراج شماره اتوبوس از فیلدهای مختلف
    const busNumber = 
      item.busNumber || 
      item.number || 
      item.line || 
      item.lineNumber || 
      item.bus || 
      item.routeNumber || 
      item.id || 
      `BUS_${id}`;
    
    // استخراج عنوان
    const title = 
      item.title || 
      item.name || 
      item.route || 
      item.description || 
      item.displayName || 
      '';
    
    // استخراج ETA
    const etaText = 
      item.etaText || 
      item.eta || 
      item.time || 
      item.arrivalTime || 
      item.arrival || 
      '';
    
    // استخراج مقادیر عددی
    const etaValue = 
      item.etaValue || 
      item.timeValue || 
      item.duration || 
      item.minutes || 
      null;
    
    // مبدأ و مقصد
    const originName = 
      item.originName || 
      item.origin || 
      item.from || 
      item.start || 
      '';
    
    const destinationName = 
      item.destinationName || 
      item.destination || 
      item.to || 
      item.end || 
      '';
    
    // URL تصویر
    const iconUrl = 
      item.iconUrl || 
      item.icon || 
      item.image || 
      item.photo || 
      null;
    
    // slug
    const slug = 
      item.slug || 
      item.code || 
      item.shortName || 
      null;
    
    // اطلاعات اضافی
    const additionalInfo = {
      vehicleType: item.vehicleType || item.type || 'bus',
      status: item.status || item.state || 'active',
      distance: item.distance || item.distanceValue || null,
      coordinates: item.coordinates || item.location || null,
      frequency: item.frequency || item.interval || null
    };
    
    return {
      id: id,
      busNumber,
      title,
      etaText,
      etaValue,
      originName,
      destinationName,
      iconUrl,
      slug,
      additionalInfo,
      rawItem: Object.keys(item).length > 10 ? { ...item } : item // برای جلوگیری از حجم زیاد
    };
  } catch (error) {
    console.error('Error creating bus object:', error);
    return null;
  }
}

function extractBusesWithAdvancedRegex(text) {
  const buses = [];
  const busMap = new Map(); // برای جلوگیری از تکرار
  
  // الگوهای پیشرفته برای پیدا کردن اتوبوس‌ها
  const patterns = [
    // الگوی کامل برای busNumber و title
    /"busNumber"\s*:\s*"([^"]+)"[^{}]*"title"\s*:\s*"([^"]+)"/g,
    
    // الگوی ساده‌تر
    /"busNumber"\s*:\s*"([^"]+)"/g,
    /"number"\s*:\s*"(\d+(?:\.\d+)?)"/g,
    /"line"\s*:\s*"([^"]+)"/g,
    
    // الگوهای فارسی
    /"عنوان"\s*:\s*"([^"]+)"[^{}]*"شماره"\s*:\s*"([^"]+)"/g,
    /"شماره"\s*:\s*"([^"]+)"/g
  ];
  
  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)];
    
    for (const match of matches) {
      let busNumber, title;
      
      if (match.length >= 3) {
        // اگر هم شماره و هم عنوان را گرفتیم
        busNumber = match[1];
        title = match[2];
      } else {
        // فقط شماره
        busNumber = match[1];
        title = `اتوبوس ${busNumber}`;
      }
      
      // فقط اگر شماره معتبر باشد
      if (busNumber && busNumber.length > 0 && !busMap.has(busNumber)) {
        // سعی می‌کنیم ETA را از اطراف پیدا کنیم
        const start = Math.max(0, match.index - 200);
        const end = Math.min(text.length, match.index + 500);
        const context = text.substring(start, end);
        
        let etaText = '';
        const etaMatch = context.match(/"etaText"\s*:\s*"([^"]+)"/);
        if (etaMatch) {
          etaText = etaMatch[1];
        }
        
        const bus = {
          id: buses.length + 1,
          busNumber,
          title,
          etaText,
          etaValue: null,
          originName: '',
          destinationName: '',
          iconUrl: null,
          slug: null,
          extractedBy: 'regex'
        };
        
        buses.push(bus);
        busMap.set(busNumber, true);
      }
    }
    
    if (buses.length > 0) {
      break;
    }
  }
  
  return buses;
}

function extractFromStructures(text) {
  const buses = [];
  
  // الگو برای پیدا کردن آرایه lines
  const linesMatch = text.match(/"lines"\s*:\s*(\[[^\]]*?\])/);
  if (linesMatch) {
    try {
      const linesStr = linesMatch[1];
      const linesData = JSON.parse(linesStr);
      
      if (Array.isArray(linesData)) {
        linesData.forEach((item, index) => {
          const bus = createCompleteBusObject(item, index + 1);
          if (bus) {
            buses.push(bus);
          }
        });
      }
    } catch (e) {
      console.log('Failed to parse lines array:', e.message);
    }
  }
  
  // الگو برای پیدا کردن آبجکت‌های تکی
  const objectPattern = /\{([^{}]*"busNumber"[^{}]*)\}/g;
  let match;
  
  while ((match = objectPattern.exec(text)) !== null) {
    try {
      const objStr = `{${match[1]}}`;
      const obj = JSON.parse(objStr);
      const bus = createCompleteBusObject(obj, buses.length + 1);
      if (bus) {
        buses.push(bus);
      }
    } catch (e) {
      // ignore
    }
  }
  
  return buses;
}

function removeDuplicateBuses(buses) {
  const uniqueBuses = [];
  const seen = new Set();
  
  for (const bus of buses) {
    const key = `${bus.busNumber}_${bus.title}`;
    if (!seen.has(key) && bus.busNumber) {
      seen.add(key);
      uniqueBuses.push(bus);
    }
  }
  
  // مرتب‌سازی بر اساس شماره اتوبوس
  uniqueBuses.sort((a, b) => {
    // تبدیل به عدد برای مرتب‌سازی صحیح
    const numA = parseFloat(a.busNumber) || 0;
    const numB = parseFloat(b.busNumber) || 0;
    return numA - numB;
  });
  
  // تنظیم مجدد idها
  uniqueBuses.forEach((bus, index) => {
    bus.id = index + 1;
  });
  
  return uniqueBuses;
}

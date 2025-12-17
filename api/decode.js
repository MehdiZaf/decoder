const extractCompleteJSON = (data) => {
    // 1. پیدا کردن شروع JSON (پس از ==)
    const startMarker = '==';
    const startIndex = data.lastIndexOf(startMarker);
    
    if (startIndex === -1) {
        throw new Error('Start marker (==) not found');
    }
    
    // 2. استخراج بخش بعد از ==
    let jsonSection = data.substring(startIndex + startMarker.length);
    
    // 3. حذف تمام @ کاراکترها
    jsonSection = jsonSection.replace(/@/g, '');
    
    // 4. پیدا کردن انتهای JSON معتبر
    let endIndex = -1;
    
    // روش 1: جستجوی انتهای JSON با پیدا کردن }
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;
    
    for (let i = 0; i < jsonSection.length; i++) {
        const char = jsonSection[i];
        
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
            if (char === '{') {
                braceCount++;
            } else if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                    // پیدا شدن انتهای آبجکت اصلی
                    endIndex = i + 1;
                    
                    // بررسی اینکه بعد از این کاراکتر احتمالاً ] هم هست (اگر آرایه باشد)
                    if (i + 1 < jsonSection.length && jsonSection[i + 1] === ']') {
                        endIndex = i + 2;
                    }
                    break;
                }
            } else if (char === '[' && braceCount === 0) {
                // اگر با آرایه شروع شود
                braceCount++;
            } else if (char === ']' && braceCount === 1) {
                braceCount--;
                if (braceCount === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }
    }
    
    // 5. اگر انتهای JSON پیدا نشد، از روش fallback استفاده می‌کنیم
    if (endIndex === -1) {
        // روش 2: جستجوی الگوی JSON
        const jsonPattern = /(\{[\s\S]*\})|(\[[\s\S]*\])/;
        const match = jsonSection.match(jsonPattern);
        
        if (match) {
            jsonSection = match[0];
            endIndex = match[0].length;
        } else {
            // روش 3: استفاده از base64 معتبر
            const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
            const base64Match = jsonSection.match(base64Pattern);
            
            if (base64Match) {
                jsonSection = base64Match[0];
                endIndex = base64Match[0].length;
            }
        }
    } else {
        // برش JSON کامل
        jsonSection = jsonSection.substring(0, endIndex);
    }
    
    // 6. پاکسازی نهایی
    jsonSection = jsonSection.trim();
    
    // حذف کاراکترهای غیرمجاز در انتها
    while (jsonSection.length > 0) {
        const lastChar = jsonSection.charCodeAt(jsonSection.length - 1);
        if (lastChar < 32 || lastChar > 126) {
            jsonSection = jsonSection.slice(0, -1);
        } else {
            break;
        }
    }
    
    return jsonSection;
};

const decodeAndParse = (inputData) => {
    try {
        console.log('Starting decode process');
        console.log('Data length:', inputData.length);
        
        // 1. استخراج JSON کامل
        const jsonStr = extractCompleteJSON(inputData);
        console.log('Extracted JSON length:', jsonStr.length);
        
        // 2. اگر JSON مستقیماً base64 نباشد، سعی می‌کنیم decode کنیم
        let decodedStr = jsonStr;
        
        // بررسی اینکه آیا رشته base64 است
        const base64Regex = /^[A-Za-z0-9+/]+=*$/;
        if (base64Regex.test(jsonStr) && jsonStr.length % 4 === 0) {
            try {
                decodedStr = atob(jsonStr);
                console.log('Base64 decoded successfully, length:', decodedStr.length);
            } catch (e) {
                console.log('Not a valid base64, using as raw JSON');
            }
        }
        
        // 3. پاکسازی JSON
        // حذف کاراکترهای کنترلی
        let cleanJson = decodedStr.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
        
        // رفع مشکلات نقل قول‌های نامتعادل
        const quoteCount = (cleanJson.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
            // اضافه کردن نقل قول پایانی اگر تعداد فرد باشد
            cleanJson = cleanJson.replace(/"([^"]*)$/, '"$1"');
        }
        
        // 4. پارس کردن JSON
        console.log('Parsing JSON...');
        const parsedData = JSON.parse(cleanJson);
        
        // 5. استخراج تمام اتوبوس‌ها
        let allBuses = [];
        
        if (parsedData.lines && Array.isArray(parsedData.lines)) {
            allBuses = parsedData.lines;
        } else if (Array.isArray(parsedData)) {
            allBuses = parsedData;
        } else if (parsedData.buses && Array.isArray(parsedData.buses)) {
            allBuses = parsedData.buses;
        } else if (parsedData.data && Array.isArray(parsedData.data)) {
            allBuses = parsedData.data;
        } else {
            // اگر ساختار متفاوت بود، سعی می‌کنیم کلیدهای عددی یا موارد مشابه را پیدا کنیم
            Object.keys(parsedData).forEach(key => {
                const value = parsedData[key];
                if (Array.isArray(value)) {
                    // بررسی اینکه آیا آرایه شامل اتوبوس است
                    if (value.length > 0 && value[0].busNumber) {
                        allBuses = allBuses.concat(value);
                    }
                }
            });
        }
        
        console.log(`Found ${allBuses.length} bus lines`);
        
        // 6. فرمت کردن خروجی
        const formattedBuses = allBuses.map((bus, index) => ({
            id: index + 1,
            busNumber: bus.busNumber || bus.number || bus.line || 'N/A',
            title: bus.title || bus.name || bus.route || 'N/A',
            etaText: bus.etaText || bus.eta || bus.time || 'N/A',
            etaValue: bus.etaValue || null,
            originName: bus.originName || bus.origin || 'N/A',
            destinationName: bus.destinationName || bus.destination || 'N/A',
            iconUrl: bus.iconUrl || bus.icon || null,
            slug: bus.slug || null
        }));
        
        console.log('Process completed successfully');
        return {
            success: true,
            totalBuses: formattedBuses.length,
            buses: formattedBuses,
            rawData: parsedData
        };
        
    } catch (error) {
        console.error('Error in decodeAndParse:', error.message);
        
        // تلاش fallback: استخراج با regex
        try {
            const busRegex = /"busNumber"\s*:\s*"([^"]+)"/g;
            const buses = [];
            let match;
            
            while ((match = busRegex.exec(inputData)) !== null) {
                buses.push({
                    busNumber: match[1]
                });
            }
            
            if (buses.length > 0) {
                return {
                    success: true,
                    totalBuses: buses.length,
                    buses: buses,
                    warning: 'Partial extraction using regex'
                };
            }
        } catch (regexError) {
            console.error('Regex extraction failed:', regexError);
        }
        
        return {
            success: false,
            error: error.message,
            totalBuses: 0,
            buses: []
        };
    }
};

// استفاده از تابع
// در endpoint اصلی:
app.post('/api/decode', async (req, res) => {
    try {
        const { data } = req.body;
        
        if (!data) {
            return res.status(400).json({
                success: false,
                error: 'No data provided'
            });
        }
        
        const result = decodeAndParse(data);
        
        if (result.success) {
            return res.json(result);
        } else {
            return res.status(500).json(result);
        }
        
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

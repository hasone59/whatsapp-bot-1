const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// API Routes
app.get('/api/settings', (req, res) => {
    try {
        const settingsData = fs.readFileSync('./settings.json', 'utf8');
        const settings = JSON.parse(settingsData);
        res.json(settings);
    } catch (error) {
        console.error('Error reading settings:', error);
        res.status(500).json({ error: 'Failed to read settings' });
    }
});

app.post('/api/settings', (req, res) => {
    try {
        const settings = req.body;
        
        // التحقق من صحة البيانات
        if (!settings.bot_settings || !settings.job_categories) {
            return res.status(400).json({ error: 'Invalid settings format' });
        }
        
        // حفظ الإعدادات
        fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2), 'utf8');
        
        console.log('✅ Settings saved successfully');
        res.json({ message: 'Settings saved successfully' });
    } catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

app.post('/api/settings/reset', (req, res) => {
    try {
        // إعدادات افتراضية
        const defaultSettings = {
            "bot_settings": {
                "welcome_message": "مرحباً! اكتب 'وظائف' للحصول على قائمة الوظائف المتاحة.",
                "invalid_number_message": "يرجى إدخال رقم من 1 إلى 6 فقط.",
                "jobs_menu_title": "📋 قائمة الوظائف المتاحة",
                "jobs_menu_subtitle": "اختر نوع الوظائف:",
                "jobs_menu_instruction": "ادخل رقم فقط من 1 إلى 6"
            },
            "job_categories": [
                {
                    "id": "1",
                    "arabic_id": "١",
                    "title": "وظائف عسكرية",
                    "emoji": "1️⃣",
                    "url": "https://jobs.moi.gov.sa",
                    "description": "وظائف عسكرية"
                },
                {
                    "id": "2", 
                    "arabic_id": "٢",
                    "title": "وظائف مدنية",
                    "emoji": "2️⃣", 
                    "url": "https://www.mcs.gov.sa",
                    "description": "وظائف مدنية"
                },
                {
                    "id": "3",
                    "arabic_id": "٣", 
                    "title": "وظائف طبية",
                    "emoji": "3️⃣",
                    "url": "https://www.moh.gov.sa", 
                    "description": "وظائف طبية"
                },
                {
                    "id": "4",
                    "arabic_id": "٤",
                    "title": "وظائف شركات", 
                    "emoji": "4️⃣",
                    "url": "https://www.linkedin.com/jobs/",
                    "description": "وظائف شركات"
                },
                {
                    "id": "5",
                    "arabic_id": "٥",
                    "title": "وظائف للمقيمين",
                    "emoji": "5️⃣", 
                    "url": "https://www.expatriates.com/classifieds/",
                    "description": "وظائف للمقيمين"
                },
                {
                    "id": "6",
                    "arabic_id": "٦",
                    "title": "وظائف حسب المدينة",
                    "emoji": "6️⃣",
                    "url": "",
                    "description": "أرسل اسم المدينة مثل (الرياض، جدة، الدمام...)"
                }
            ]
        };
        
        fs.writeFileSync('./settings.json', JSON.stringify(defaultSettings, null, 2), 'utf8');
        
        console.log('✅ Settings reset successfully');
        res.json({ message: 'Settings reset successfully' });
    } catch (error) {
        console.error('Error resetting settings:', error);
        res.status(500).json({ error: 'Failed to reset settings' });
    }
});

// Serve admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Redirect root to admin
app.get('/', (req, res) => {
    res.redirect('/admin');
});

// API endpoint for bot status
app.get('/api/bot-status', (req, res) => {
    res.json({ 
        status: 'running',
        message: 'Bot is running on server'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🌐 Admin panel running on http://localhost:${PORT}`);
    console.log(`📱 Open http://localhost:${PORT}/admin in your browser`);
});

module.exports = app; 
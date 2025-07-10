// ================================
//        WhatsApp Bot - وظائف
// ================================
// هذا البوت يرد تلقائياً على رسائل واتساب ويوفر قائمة وظائف وروابطها
// يعتمد على مكتبة Baileys
// ================================

// ====== الاستيراد ======
const {
  default: makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require('fs');
const qrcode = require('qrcode-terminal');

const AUTH_FOLDER = "./auth_info_baileys";
if (!fs.existsSync(AUTH_FOLDER)) {
  fs.mkdirSync(AUTH_FOLDER);
}

const processedMessages = new Set();

// ====== إعدادات قابلة للتعديل ======
// تحميل الإعدادات من ملف خارجي
let botSettings = {};
let jobCategories = [];

// دالة تحميل الإعدادات
function loadSettings() {
  try {
    const settingsData = fs.readFileSync('./settings.json', 'utf8');
    const settings = JSON.parse(settingsData);
    botSettings = settings.bot_settings;
    jobCategories = settings.job_categories;
    console.log("✅ تم تحميل الإعدادات بنجاح");
  } catch (error) {
    console.error("❌ خطأ في تحميل الإعدادات:", error);
    // إعدادات افتراضية في حالة فشل التحميل
    botSettings = {
      welcome_message: "مرحباً! اكتب 'وظائف' للحصول على قائمة الوظائف المتاحة.",
      invalid_number_message: "يرجى إدخال رقم من 1 إلى 6 فقط.",
      jobs_menu_title: "📋 قائمة الوظائف المتاحة",
      jobs_menu_subtitle: "اختر نوع الوظائف:",
      jobs_menu_instruction: "ادخل رقم فقط من 1 إلى 6"
    };
    jobCategories = [];
  }
}

// دالة إعادة تحميل الإعدادات (مفيدة عند التعديل)
function reloadSettings() {
  loadSettings();
  console.log("🔄 تم إعادة تحميل الإعدادات");
}

// تحميل الإعدادات عند بدء التشغيل
loadSettings();

// --- تتبع من أرسلنا له الرسالة الترحيبية ---
const greetedUsers = new Set();

// ====== منطق البوت الأساسي ======
async function startBot() {
  try {
    console.log("🚀 بدء تشغيل بوت الواتساب...");
    const { version } = await fetchLatestBaileysVersion();
    console.log(`📦 إصدار Baileys: ${version}`);
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    console.log("🔐 تم تحميل الجلسة");
    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false
    });
    console.log("🔌 تم إنشاء الاتصال");
    setupEventHandlers(sock, saveCreds);
    console.log("✅ البوت جاهز! انتظر رمز QR...");
  } catch (error) {
    console.error("❌ خطأ في تشغيل البوت:", error);
  }
}

function setupEventHandlers(sock, saveCreds) {
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    console.log("📡 Connection state:", connection);
    if (qr) {
      console.log("\n📱 Scan the following QR code to log in:");
      qrcode.generate(qr, { small: true });
      console.log("\nIf the code does not appear, copy the above code and scan it from the WhatsApp app.");
    }
    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom) &&
        lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
      console.log("🔌 Disconnected due to:", lastDisconnect?.error);
      if (shouldReconnect) {
        console.log("🔄 Reconnecting...");
        setTimeout(() => startBot(), 3000);
      } else {
        console.log("🛑 Logged out");
        // حذف مجلد الجلسة عند تسجيل الخروج
        try {
          fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
          console.log("🗑️ auth_info_baileys folder deleted.");
        } catch (e) {
          console.error("❌ Failed to delete auth_info_baileys folder:", e);
        }
      }
    }
    if (connection === "open") {
      console.log("✅ Connected successfully!");
      console.log("🤖 Bot is ready to receive messages");
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;
    if (msg.key.fromMe) return; // تجاهل رسائل البوت نفسه
    const sender = msg.key.remoteJid;
    const messageId = msg.key.id;
    const text = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || 
                 msg.message.imageMessage?.caption || "";
    if (!text) return;
    if (processedMessages.has(messageId)) {
      console.log(`🚫 رسالة مكررة تم تجاهلها: ${messageId}`);
      return;
    }
    processedMessages.add(messageId);
    if (processedMessages.size > 100) {
      const firstKey = processedMessages.values().next().value;
      processedMessages.delete(firstKey);
    }
    console.log(`📨 رسالة من ${sender}: ${text}`);
    
    // إعادة تحميل الإعدادات قبل معالجة كل رسالة (للتأكد من التحديثات)
    reloadSettings();
    
    await handleMessage(sock, sender, text, msg);
  });

  sock.ev.on("creds.update", saveCreds);
}

async function handleMessage(sock, sender, text, msg) {
  try {
    // تجاهل رسائل القروبات - لا نرد عليها أبداً
    if (sender.endsWith('@g.us')) {
      console.log(`🚫 رسالة من قروب تم تجاهلها: ${sender}`);
      return;
    }
    
    const lowerText = text.toLowerCase().trim();
    // إذا كتب "وظائف" أرسل القائمة دائماً
    if (lowerText === "وظائف") {
      await sendJobOptions(sock, sender);
      return;
    }
    // تحقق إذا كانت الرسالة رقم واحد فقط (عربي أو إنجليزي)
    const onlyNumber = text.trim().replace(/[ 0-F 00-FF]/g, ''); // إزالة المسافات والعربية
    // regex: يقبل فقط رقم واحد (عربي أو إنجليزي) بدون أي نص آخر
    if (/^[0-9]$/.test(text.trim()) || /^[٠-٩]$/.test(text.trim())) {
      // تحويل الرقم العربي إلى إنجليزي إن وجد
      const arabicToEnglish = (d) => ({
        '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
      })[text.trim()] || text.trim();
      
      const validNumbers = jobCategories.map(cat => cat.id);
      if (validNumbers.includes(arabicToEnglish(text.trim()))) {
        const response = getJobResponse(text);
        if (response) {
          await sock.sendMessage(sender, { text: response });
          return;
        }
      } else {
        await sock.sendMessage(sender, { text: botSettings.invalid_number_message });
        return;
      }
    } else {
      // إذا كتب رقم أكثر من خانة أو نص مع الرقم
      if (/^[0-9٠-٩]+$/.test(text.trim())) {
        await sock.sendMessage(sender, { text: botSettings.invalid_number_message });
        return;
      }
    }
    // إذا كتب أي شيء آخر، أرسل الرسالة الترحيبية مرة واحدة فقط لكل مستخدم حقيقي
    if (!greetedUsers.has(sender)) {
      greetedUsers.add(sender);
      await sock.sendMessage(sender, { text: botSettings.welcome_message });
    }
    // إذا أرسلناها من قبل، لا نرد
  } catch (error) {
    console.error("❌ خطأ في معالجة الرسالة:", error);
  }
}

// إرسال قائمة الوظائف باستخدام أزرار الرد العادية (reply buttons)
async function sendJobOptions(sock, sender) {
  let menu = `*${botSettings.jobs_menu_title}*\n\n${botSettings.jobs_menu_subtitle}\n`;
  
  jobCategories.forEach(category => {
    menu += `${category.emoji} ${category.title}\n`;
  });
  
  menu += `\n*${botSettings.jobs_menu_instruction}*`;
  
  await sock.sendMessage(sender, { text: menu });
}

// استخراج الرد المناسب بناءً على الرقم (عربي أو إنجليزي)
function getJobResponse(text) {
  // استخراج أول رقم (عربي أو إنجليزي) من الرسالة بالكامل
  const match = text.match(/[0-9٠-٩]/);
  if (!match) return undefined;
  
  // تحويل الرقم العربي إلى إنجليزي إن وجد
  const arabicToEnglish = (d) => ({
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
  })[d] || d;
  
  const normalized = arabicToEnglish(match[0]);
  
  // البحث عن الفئة المطابقة
  const category = jobCategories.find(cat => cat.id === normalized || cat.arabic_id === match[0]);
  
  if (!category) return undefined;
  
  // بناء الرد
  if (category.url && category.url.trim() !== '') {
    return `🔗 *${category.title}:*\n${category.url}`;
  } else {
    return `🔍 *${category.title}:*\n${category.description}`;
  }
}

// 🚀 بدء تشغيل البوت
console.log("🎯 بوت الواتساب للوظائف");
console.log("📱 سيظهر رمز QR قريباً...");
startBot();

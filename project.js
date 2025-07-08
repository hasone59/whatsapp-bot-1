const {
makeWASocket,
useMultiFileAuthState,
DisconnectReason,
fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const { Boom } = require("@hapi/boom");

// ⚙️ تهيئة الاتصال
async function createSocket() {
const { state, saveCreds } = await useMultiFileAuthState("auth_info");
const { version } = await fetchLatestBaileysVersion();

const sock = makeWASocket({
version,
auth: state,
printQRInTerminal: true
});

setupConnectionHandlers(sock);
setupMessageHandler(sock);
sock.ev.on("creds.update", saveCreds);

return sock;
}

// 🔁 التعامل مع الاتصال
function setupConnectionHandlers(sock) {
sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
if (connection === "close") {
    const isLoggedOut =
    lastDisconnect?.error instanceof Boom &&
    lastDisconnect.error.output.statusCode === DisconnectReason.loggedOut;

    console.log("🔌 الاتصال انقطع!");

    if (!isLoggedOut) {
    console.log("🔁 إعادة الاتصال...");
    createSocket(); // إعادة تشغيل الاتصال
    } else {
    console.log("🛑 تم تسجيل الخروج، لن يُعاد الاتصال تلقائيًا.");
    }
} else if (connection === "open") {
    console.log("✅ تم الاتصال بواتساب");
}
});
}

// 📨 استقبال ومعالجة الرسائل
function setupMessageHandler(sock) {
sock.ev.on("messages.upsert", async ({ messages }) => {
const msg = messages[0];
if (!msg.message) return;

const sender = msg.key.remoteJid;
const text =
    msg.message.conversation || msg.message.extendedTextMessage?.text;
if (!text) return;

console.log("📨 الرسالة:", text);

if (text.toLowerCase() === "وظائف") {
    await sendOptions(sock, sender);
    return;
}

const response = getResponse(text);
if (response) {
    await sock.sendMessage(sender, { text: response });
}
});
}

// 📋 إرسال قائمة الوظائف
async function sendOptions(sock, to) {
const menu = `📋 اختر نوع الوظائف:
1. وظائف عسكرية
2. وظائف مدنية
3. وظائف طبية
4. وظائف شركات
5. وظائف للمقيمين
6. وظائف حسب المدينة
(اكتب رقم الخيار فقط)`;

await sock.sendMessage(to, { text: menu });
}

// 🔗 روابط الخيارات
function getResponse(text) {
const responses = {
"1": "🔗 وظائف عسكرية: https://jobs.moi.gov.sa",
"2": "🔗 وظائف مدنية: https://www.mcs.gov.sa",
"3": "🔗 وظائف طبية: https://www.moh.gov.sa",
"4": "🔗 وظائف شركات: https://www.linkedin.com/jobs/",
"5": "🔗 وظائف للمقيمين: https://www.expatriates.com/classifieds/",
"6": "🔍 أرسل اسم المدينة مثل (الرياض، جدة...)"
};

return responses[text];
}

// 🚀 تشغيل البوت
createSocket();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// Google Sheets Configuration
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwCY149vEyfPzJX52hjLQOGV0PWtdaakUkMslsOhK0dsMm3s84jBYBIPjcXSnJGWxEVdg/exec'; // Replace with your deployed web app URL

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// User session storage
const userState = {};

// Product and service data (customize as needed)
const products = {
    'vario': 'Grand FIlano',
    'aerox': 'Yamaha Aerox 155',
    'nmax': 'Yamaha NMAX'
};

const services = {
    'ganti oli': 'Ganti Oli Mesin',
    'servis berkala': 'Servis Berkala',
    'tune up': 'Tune Up'
};

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('message', async msg => {
    try {
        const sender = msg.from;
        const text = msg.body.toLowerCase().trim();
        const contact = await msg.getContact();
        const userName = contact.pushname || 'Pelanggan';

        // Clear session if inactive for 10 minutes
        if (userState[sender] && (Date.now() - userState[sender].lastActive > 600000)) {
            delete userState[sender];
        }

        // Main menu handler
        if (!userState[sender]) {
            await sendMainMenu(msg, userName);
            userState[sender] = { 
                step: 'main_menu',
                lastActive: Date.now(),
                data: {} 
            };
            return;
        }

        // Handle responses based on current step
        switch (userState[sender].step) {
            case 'main_menu':
                await handleMainMenu(msg, sender, text, userName);
                break;
                
            case 'sales':
                await handleSales(msg, sender, text, userName);
                break;
                
            case 'service_menu':
                await handleServiceMenu(msg, sender, text, userName);
                break;
                
            case 'sparepart':
                await handleSparepart(msg, sender, text, userName);
                break;
                
            case 'service_form':
                await handleServiceForm(msg, sender, text, userName);
                break;
                
            case 'other':
                await handleOther(msg, sender, text, userName);
                break;
        }

    } catch (error) {
        console.error('Error handling message:', error);
    }
});

// Handle missed calls
client.on('call', async call => {
    if (call.isMissed) {
        const chat = await call.getChat();
        const contact = await call.getContact();
        const userName = contact.pushname || 'Pelanggan';
        
        await chat.sendMessage(
            `Halo ${userName}, kami melihat Anda menelepon. Silahkan pilih layanan:\n` +
            `1. Sales\n` +
            `2. Service\n` +
            `3. Hal lain\n\n` +
            `*Balas angka saja*`
        );
    }
});

// Helper functions
async function sendMainMenu(msg, userName) {
    await msg.reply(
        `Halo ${userName}, selamat datang di Yamaha SIP!\n\n` +
        `Pilih layanan:\n` +
        `1. Sales\n` +
        `2. Service\n` +
        `3. Hal lain\n\n` +
        `*Balas angka saja*`
    );
}

async function handleMainMenu(msg, sender, text, userName) {
    if (text === '1') {
        await msg.reply(
            `Minat dengan unit apa? (Contoh: Nmax Neo)\n` +
            `Pembelian *cash* atau *kredit*?\n` +
            `Domisilinya mana?`
        );
        userState[sender] = { 
            step: 'sales',
            lastActive: Date.now(),
            data: { type: 'sales', name: userName }
        };
    } else if (text === '2') {
        await msg.reply(
            `Pilih layanan:\n` +
            `1. Sparepart\n` +
            `2. Service\n\n` +
            `*Balas angka saja*`
        );
        userState[sender] = { 
            step: 'service_menu',
            lastActive: Date.now(),
            data: { type: 'service', name: userName }
        };
    } else if (text === '3') {
        await msg.reply(
            `Silahkan sampaikan kebutuhan Anda...`
        );
        userState[sender] = { 
            step: 'other',
            lastActive: Date.now(),
            data: { type: 'other', name: userName }
        };
    } else {
        await msg.reply(
            `Maaf, pilihan tidak valid. Silahkan pilih:\n` +
            `1. Sales\n` +
            `2. Service\n` +
            `3. Hal lain\n\n` +
            `*Balas angka saja*`
        );
    }
}

async function handleSales(msg, sender, text, userName) {
    userState[sender].data.details = text;
    
    // Send data to Google Sheets
    try {
        await axios.post(WEB_APP_URL, {
            timestamp: new Date().toISOString(),
            name: userName,
            phone: sender.replace('@c.us', ''),
            service_type: 'sales',
            details: text,
            status: 'new'
        });
        
        await msg.reply(
            `Terima kasih ${userName}!\n` +
            `Tim sales kami akan segera menghubungi Anda mengenai:\n` +
            `*${text}*\n\n` +
            `Butuh bantuan lain? Ketik *menu* untuk kembali ke menu utama.`
        );
    } catch (error) {
        console.error('Error sending to Google Sheets:', error);
        await msg.reply(
            `Terima kasih ${userName}!\n` +
            `Tim kami akan segera menghubungi Anda.\n\n` +
            `*Catatan: Sistem penyimpanan sedang gangguan, mohon info ulang ke CS kami.*`
        );
    }
    
    delete userState[sender];
}

async function handleServiceMenu(msg, sender, text, userName) {
    if (text === '1') {
        await msg.reply(
            `Sparepart apa yang Anda butuhkan?\n` +
            `Domisilinya mana? (Contoh: Oli mesin, Bandung)`
        );
        userState[sender].step = 'sparepart';
        userState[sender].lastActive = Date.now();
    } else if (text === '2') {
        await msg.reply(
            `Mohon isi form berikut:\n\n` +
            `Nama: ${userName}\n` +
            `No. HP: ${sender.replace('@c.us', '')}\n` +
            `Kota: \n` +
            `Alamat: \n` +
            `Unit motor: \n` +
            `Kendala: \n` +
            `Jemput/Datang ke bengkel: \n\n` +
            `Silahkan balas dengan melengkapi data di atas.`
        );
        userState[sender].step = 'service_form';
        userState[sender].lastActive = Date.now();
    } else {
        await msg.reply(
            `Maaf, pilihan tidak valid. Silahkan pilih:\n` +
            `1. Sparepart\n` +
            `2. Service\n\n` +
            `*Balas angka saja*`
        );
    }
}

async function handleSparepart(msg, sender, text, userName) {
    userState[sender].data.details = text;
    
    try {
        await axios.post(WEB_APP_URL, {
            timestamp: new Date().toISOString(),
            name: userName,
            phone: sender.replace('@c.us', ''),
            service_type: 'sparepart',
            details: text,
            status: 'new'
        });
        
        await msg.reply(
            `Terima kasih ${userName}!\n` +
            `Tim sparepart kami akan cek ketersediaan:\n` +
            `*${text}*\n\n` +
            `Kami akan menghubungi Anda segera.`
        );
    } catch (error) {
        console.error('Error sending to Google Sheets:', error);
        await msg.reply(
            `Terima kasih ${userName}!\n` +
            `Tim kami akan segera menghubungi Anda.\n\n` +
            `*Catatan: Sistem penyimpanan sedang gangguan.*`
        );
    }
    
    delete userState[sender];
}

async function handleServiceForm(msg, sender, text, userName) {
    userState[sender].data.details = text;
    
    try {
        await axios.post(WEB_APP_URL, {
            timestamp: new Date().toISOString(),
            name: userName,
            phone: sender.replace('@c.us', ''),
            service_type: 'service',
            details: text,
            status: 'new'
        });
        
        await msg.reply(
            `Terima kasih ${userName}!\n` +
            `Form service telah kami terima:\n` +
            `\`\`\`${text}\`\`\`\n\n` +
            `Teknisi kami akan menghubungi Anda dalam 1x24 jam.`
        );
    } catch (error) {
        console.error('Error sending to Google Sheets:', error);
        await msg.reply(
            `Terima kasih ${userName}!\n` +
            `Tim kami akan segera menghubungi Anda.\n\n` +
            `*Catatan: Sistem penyimpanan sedang gangguan.*`
        );
    }
    
    delete userState[sender];
}

async function handleOther(msg, sender, text, userName) {
    userState[sender].data.details = text;
    
    try {
        await axios.post(WEB_APP_URL, {
            timestamp: new Date().toISOString(),
            name: userName,
            phone: sender.replace('@c.us', ''),
            service_type: 'other',
            details: text,
            status: 'new'
        });
        
        await msg.reply(
            `Terima kasih ${userName}!\n` +
            `Pesan Anda telah kami terima:\n` +
            `*${text}*\n\n` +
            `CS kami akan membalas secepatnya.`
        );
    } catch (error) {
        console.error('Error sending to Google Sheets:', error);
        await msg.reply(
            `Terima kasih ${userName}!\n` +
            `Pesan Anda telah kami terima.\n\n` +
            `*Catatan: Sistem penyimpanan sedang gangguan.*`
        );
    }
    
    delete userState[sender];
}



// Error handling
client.on('auth_failure', msg => {
    console.error('Authentication failure', msg);
});

client.on('disconnected', reason => {
    console.log('Client was logged out', reason);
    console.log("Data to be sent:", {
        name: userName,
        phone: sender.replace('@c.us', ''),
        service_type: userState[sender].data.type,
        details: text
      });
});

// Initialize client
client.initialize();
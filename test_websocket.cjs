const WebSocket = require('ws');

async function testWebSocket() {
    console.log('WebSocket test başlıyor...');
    
    const ws = new WebSocket('ws://localhost:8001/research_ws');
    
    ws.on('open', () => {
        console.log('✅ WebSocket bağlantısı açıldı');
        
        setTimeout(() => {
            const message = { topic: 'test araştırması', model: 'gemma-3-27b-it' };
            console.log('📤 Mesaj gönderiliyor:', JSON.stringify(message));
            ws.send(JSON.stringify(message));
        }, 1000);
    });
    
    ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        console.log('📥 Mesaj alındı:', message.type, '-', message.message);
        
        if (message.type === 'result') {
            console.log('✅ Research tamamlandı!');
            ws.close();
        }
        
        if (message.type === 'error') {
            console.log('❌ Hata:', message.data);
            ws.close();
        }
    });
    
    ws.on('close', () => {
        console.log('🔚 WebSocket bağlantısı kapandı');
        process.exit(0);
    });
    
    ws.on('error', (error) => {
        console.log('❌ WebSocket hatası:', error.message);
        process.exit(1);
    });
}

testWebSocket();
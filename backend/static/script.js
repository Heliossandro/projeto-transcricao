let mediaRecorder;
let isRecording = false;
let audioChunks = [];
let intervalId;

const recordBtn = document.getElementById("recordBtn");
const originalText = document.getElementById("originalText");
const translatedText = document.getElementById("translatedText");

// Texto acumulado
let fullText = "";
let fullTranslation = "";

// Atualize a parte do MediaRecorder para forçar codec Opus:

recordBtn.addEventListener("click", async () => {
    if (!isRecording) {
        // INICIAR
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true
                } 
            });
            
            // Forçar codec Opus para melhor compatibilidade
            const options = {
                mimeType: 'audio/webm; codecs=opus',
                audioBitsPerSecond: 16000
            };
            
            mediaRecorder = new MediaRecorder(stream, options);
            
            audioChunks = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                    console.log(`📦 Chunk: ${event.data.size} bytes`);
                }
            };
            
            mediaRecorder.start(500); // Coletar a cada 500ms
            isRecording = true;
            
            recordBtn.textContent = "⏹️ Parar";
            recordBtn.classList.add("recording");
            originalText.textContent = "Ouvindo... 🎤";
            translatedText.textContent = "-";
            
            intervalId = setInterval(sendAudio, 800); // Enviar a cada 800ms
            
        } catch (error) {
            console.error("❌ Erro microfone:", error);
            alert("Erro ao acessar microfone: " + error.message);
        }
    } else {
        // PARAR
        isRecording = false;
        clearInterval(intervalId);
        
        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
        }
        if (mediaRecorder && mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        
        recordBtn.textContent = "🎤 Iniciar";
        recordBtn.classList.remove("recording");
    }
});

async function sendAudio() {
    if (!isRecording || audioChunks.length === 0) return;
    
    const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
    audioChunks = []; // Limpa para o próximo chunk
    
    try {
        const formData = new FormData();
        formData.append("audio", audioBlob, "voice.webm");
        
        const sourceLang = document.getElementById("sourceLang").value;
        const targetLang = document.getElementById("targetLang").value;
        formData.append("source_lang", sourceLang);
        formData.append("target_lang", targetLang);
        
        console.log("📤 Enviando áudio...");
        
        const response = await fetch("/stream", {
            method: "POST",
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log("✅ Resposta:", result);
        
        // Atualizar texto
        if (result.original && result.original.trim() !== "") {
            if (result.is_partial) {
                // Texto parcial - mostra temporariamente
                originalText.textContent = fullText + " " + result.original + " ...";
            } else {
                // Texto final - adiciona ao acumulado
                if (!fullText.includes(result.original)) {
                    fullText += (fullText ? " " : "") + result.original;
                    originalText.textContent = fullText;
                }
            }
        }
        
        // Atualizar tradução (apenas para texto final)
        if (result.translated && result.translated.trim() !== "" && !result.is_partial) {
            if (!fullTranslation.includes(result.translated)) {
                fullTranslation += (fullTranslation ? " " : "") + result.translated;
                translatedText.textContent = fullTranslation;
            }
        }
        
    } catch (error) {
        console.error("❌ Erro ao enviar áudio:", error);
    }
}
// Debug - verificar se os elementos existem
console.log("🔍 Inicializando...");
console.log("recordBtn:", document.getElementById("recordBtn"));
console.log("originalText:", document.getElementById("originalText"));
console.log("translatedText:", document.getElementById("translatedText"));

// Verificar se há erros no console
window.addEventListener('error', function(e) {
    console.error('❌ Erro global:', e.error);
});
let mediaRecorder;
let audioChunks = [];
let isRecording = false;
let intervalId = null;

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const originalText = document.getElementById("originalText");
const translatedText = document.getElementById("translatedText");

startBtn.onclick = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    isRecording = true;

    startBtn.disabled = true;
    stopBtn.disabled = false;

    mediaRecorder.addEventListener("dataavailable", event => {
        audioChunks.push(event.data);
    });

    // A cada 5 segundos, envia um trecho de áudio
    intervalId = setInterval(sendAudio, 5000);
};

stopBtn.onclick = () => {
    isRecording = false;
    clearInterval(intervalId);
    mediaRecorder.stop();
    startBtn.disabled = false;
    stopBtn.disabled = true;
};

// Função que envia áudio ao servidor Flask
async function sendAudio() {
    if (!isRecording || audioChunks.length === 0) return;

    const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
    audioChunks = []; // limpa para o próximo trecho

    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('source_lang', document.getElementById('sourceLang').value);
    formData.append('target_lang', document.getElementById('targetLang').value);

    const response = await fetch('/translate_audio', {
        method: 'POST',
        body: formData
    });

    const data = await response.json();
    originalText.textContent = data.original;
    translatedText.textContent = data.traduzido;
}

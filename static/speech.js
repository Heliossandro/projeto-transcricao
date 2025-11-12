const translatedText = document.getElementById("translatedText");
const btnGravar = document.getElementById("btnGravar");
const btnLimpar = document.getElementById("btnLimpar");
const btnParar = document.getElementById("btnParar");
const btnBaixar = document.getElementById("btnBaixar");
const btnFalar = document.getElementById("btnFalar");
const btnPararFala = document.getElementById("btnPararFala");
const btnModoEscuro = document.getElementById("btnModoEscuro");
const sourceLang = document.getElementById("sourceLang");
const targetLang = document.getElementById("targetLang");
const speedControl = document.getElementById("speed");
const speedValue = document.getElementById("speedValue");
const statusIndicator = document.getElementById("statusIndicator");
const avatarMouth = document.querySelector('.avatar-mouth');

class SpeechApi {
    constructor() {
        const SpeechToText = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechToText) {
            alert("Seu navegador não suporta reconhecimento de voz!");
            return;
        }

        this.speechApi = new SpeechToText();
        this.speechApi.continuous = true;
        this.speechApi.interimResults = true;
        this.speechApi.maxAlternatives = 1;

        // Síntese de voz
        this.synth = window.speechSynthesis;
        this.currentUtterance = null;
        
        this.updateLanguage();
        this.finalTranslatedText = '';
        this.isSpeaking = false;

        this.speechApi.onresult = async (e) => {
            let currentInterimText = '';
            
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const transcript = e.results[i][0].transcript;
                
                if (e.results[i].isFinal) {
                    const translated = await this.translateText(transcript);
                    if (translated) {
                        this.finalTranslatedText += translated + ' ';
                        translatedText.value = this.finalTranslatedText;
                        this.updateStatus('Traduzido ✓', 'success');
                    }
                } else {
                    currentInterimText = transcript;
                    if (currentInterimText.trim()) {
                        const translatedInterim = await this.translateText(currentInterimText);
                        if (translatedInterim) {
                            translatedText.value = this.finalTranslatedText + translatedInterim;
                            this.updateStatus('Ouvindo...', 'listening');
                        }
                    }
                }
            }
            
            translatedText.scrollTop = translatedText.scrollHeight;
        };

        this.speechApi.onerror = (e) => {
            console.error("Erro no reconhecimento de voz:", e.error);
            this.updateStatus('Erro no reconhecimento', 'error');
        };

        this.speechApi.onend = () => {
            btnGravar.disabled = false;
            btnParar.disabled = true;
            this.updateStatus('Pronto', 'ready');
        };
    }

    updateLanguage() {
        this.speechApi.lang = sourceLang.value;
    }

    updateStatus(message, type) {
        statusIndicator.textContent = message;
        statusIndicator.className = `status-indicator ${type}`;
    }

    animateAvatarSpeaking(isSpeaking) {
        if (isSpeaking) {
            avatarMouth.classList.add('speaking');
        } else {
            avatarMouth.classList.remove('speaking');
        }
    }

    speakText(text) {
        if (this.isSpeaking) {
            this.stopSpeaking();
        }

        if (!text.trim()) {
            alert("Não há texto para falar!");
            return;
        }

        this.currentUtterance = new SpeechSynthesisUtterance(text);
        
        // Configura a velocidade da voz
        this.currentUtterance.rate = parseFloat(speedControl.value);
        
        // Configura a língua baseada no targetLang
        this.currentUtterance.lang = this.getLanguageCode(targetLang.value);
        
        this.currentUtterance.onstart = () => {
            this.isSpeaking = true;
            this.animateAvatarSpeaking(true);
            this.updateStatus('Falando...', 'speaking');
            btnFalar.disabled = true;
            btnPararFala.disabled = false;
        };

        this.currentUtterance.onend = () => {
            this.isSpeaking = false;
            this.animateAvatarSpeaking(false);
            this.updateStatus('Pronto', 'ready');
            btnFalar.disabled = false;
            btnPararFala.disabled = true;
        };

        this.currentUtterance.onerror = (e) => {
            console.error('Erro na síntese de voz:', e);
            this.isSpeaking = false;
            this.animateAvatarSpeaking(false);
            this.updateStatus('Erro na fala', 'error');
            btnFalar.disabled = false;
            btnPararFala.disabled = true;
        };

        this.synth.speak(this.currentUtterance);
    }

    stopSpeaking() {
        if (this.synth.speaking) {
            this.synth.cancel();
            this.isSpeaking = false;
            this.animateAvatarSpeaking(false);
            this.updateStatus('Fala interrompida', 'ready');
            btnFalar.disabled = false;
            btnPararFala.disabled = true;
        }
    }

    getLanguageCode(lang) {
        const languageMap = {
            'en': 'en-US',
            'es': 'es-ES',
            'fr': 'fr-FR',
            'de': 'de-DE',
            'it': 'it-IT',
            'ja': 'ja-JP',
            'pt': 'pt-BR',
            'ru': 'ru-RU',
            'zh-CN': 'zh-CN',
            'ko': 'ko-KR',
            'ar': 'ar-SA'
        };
        return languageMap[lang] || 'en-US';
    }

    async translateText(text) {
        if (!text.trim()) return '';

        const source = sourceLang.value.split('-')[0];
        const target = targetLang.value;

        try {
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${source}|${target}`);
            const data = await response.json();
            
            if (data.responseStatus === 200) {
                return data.responseData.translatedText;
            } else {
                throw new Error('API MyMemory falhou');
            }
        } catch (error) {
            try {
                const googleResponse = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(text)}`);
                const googleData = await googleResponse.json();
                
                if (googleData && googleData[0]) {
                    let translated = '';
                    googleData[0].forEach(item => {
                        if (item[0]) translated += item[0];
                    });
                    return translated;
                }
            } catch (googleError) {
                console.error('Erro em todas as APIs de tradução:', googleError);
                return text;
            }
        }
        
        return '';
    }

    start() {
        try {
            this.updateLanguage();
            this.finalTranslatedText = '';
            translatedText.value = '';
            this.updateStatus('Ouvindo...', 'listening');
            this.speechApi.start();
        } catch (error) {
            console.log("Reconhecimento já iniciado");
        }
    }

    stop() {
        this.speechApi.stop();
    }
}

// Modo Escuro
class DarkMode {
    constructor() {
        this.isDarkMode = localStorage.getItem('darkMode') === 'true';
        this.init();
    }

    init() {
        this.applyMode();
        this.updateButton();
    }

    toggle() {
        this.isDarkMode = !this.isDarkMode;
        localStorage.setItem('darkMode', this.isDarkMode);
        this.applyMode();
        this.updateButton();
    }

    applyMode() {
        if (this.isDarkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    updateButton() {
        btnModoEscuro.textContent = this.isDarkMode ? '☀️' : '🌙';
    }
}

// Exportador PDF
class PDFExporter {
    constructor() {
        this.jsPDF = window.jspdf.jsPDF;
    }

    exportToPDF(text, sourceLang, targetLang) {
        const doc = new this.jsPDF();
        
        // Configurações do documento
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let yPosition = margin;
        
        // Cabeçalho
        doc.setFontSize(20);
        doc.setTextColor(40, 40, 40);
        doc.text('TRADUÇÃO DE VOZ', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;
        
        // Informações da tradução
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        const sourceLangText = sourceLang.options[sourceLang.selectedIndex].text;
        const targetLangText = targetLang.options[targetLang.selectedIndex].text;
        doc.text(`De: ${sourceLangText} → Para: ${targetLangText}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 10;
        
        // Data e hora
        const now = new Date();
        doc.text(`Gerado em: ${now.toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 20;
        
        // Linha divisória
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 15;
        
        // Texto traduzido
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'bold');
        doc.text('TEXTO TRADUZIDO:', margin, yPosition);
        yPosition += 10;
        
        doc.setFont(undefined, 'normal');
        const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
        
        lines.forEach(line => {
            if (yPosition > doc.internal.pageSize.getHeight() - margin) {
                doc.addPage();
                yPosition = margin;
            }
            doc.text(line, margin, yPosition);
            yPosition += 7;
        });
        
        // Rodapé
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
        }
        
        // Salvar PDF
        const filename = `traducao_${sourceLang.value}_para_${targetLang.value}.pdf`;
        doc.save(filename);
    }
}

// Inicialização
const speech = new SpeechApi();
const darkMode = new DarkMode();
const pdfExporter = new PDFExporter();

// Event Listeners
btnGravar.addEventListener("click", () => {
    btnGravar.disabled = true;
    btnParar.disabled = false;
    speech.start();
});

btnParar.addEventListener("click", () => {
    btnGravar.disabled = false;
    btnParar.disabled = true;
    speech.stop();
});

btnFalar.addEventListener("click", () => {
    const text = translatedText.value;
    speech.speakText(text);
});

btnPararFala.addEventListener("click", () => {
    speech.stopSpeaking();
});

btnLimpar.addEventListener("click", () => {
    translatedText.value = "";
    speech.finalTranslatedText = '';
    speech.updateStatus('Pronto', 'ready');
});

btnBaixar.addEventListener("click", () => {
    const text = translatedText.value;
    
    if (!text.trim()) {
        alert("Não há tradução para exportar em PDF!");
        return;
    }

    try {
        pdfExporter.exportToPDF(text, sourceLang, targetLang);
    } catch (error) {
        console.error('Erro ao gerar PDF:', error);
        alert('Erro ao gerar PDF. Tente novamente.');
    }
});

btnModoEscuro.addEventListener("click", () => {
    darkMode.toggle();
});

speedControl.addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    let speedText = 'Normal';
    
    if (value < 0.8) speedText = 'Lento';
    else if (value > 1.2) speedText = 'Rápido';
    
    speedValue.textContent = speedText;
});

sourceLang.addEventListener("change", () => {
    speech.updateLanguage();
});